// Roar's AI agents (SPEC section 7). Each agent is one structured Claude call with its own prompt and output
// schema. Runs on Microsoft Foundry when ANTHROPIC_FOUNDRY_RESOURCE is set, else the Claude API
// (ANTHROPIC_API_KEY, handy for local dev). With neither, every agent returns null and callers keep their rules.
import Anthropic from "@anthropic-ai/sdk";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = process.env["ANTHROPIC_FOUNDRY_RESOURCE"] || process.env["ANTHROPIC_FOUNDRY_BASE_URL"]
  ? new AnthropicFoundry()
  : process.env["ANTHROPIC_API_KEY"] ? new Anthropic() : null;
// On Foundry this is the deployment name.
const MODEL = process.env["AI_MODEL"] || "claude-opus-5-5";

export const aiEnabled = () => client !== null;
export const aiModel = () => MODEL;

async function ask<T extends z.ZodType>(system: string, content: Anthropic.ContentBlockParam[], schema: T): Promise<z.infer<T> | null> {
  if (!client) return null;
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }],
  });
  // ponytail: a refusal just means "no AI opinion"; callers fall back to rules. Add the refusal-fallback middleware if that gets common.
  if (res.stop_reason === "refusal") return null;
  return res.parsed_output ?? null;
}

const LEAGUE = "Roar League is a fictional football league. Clubs, players and matches are synthetic.";

// ---- Moment Analyst: what does this fan photo or clip show? ----

export const MomentAnalysis = z.object({
  eventType: z.enum(["goal", "celebration", "player", "crowd", "foul", "security", "other"]),
  confidence: z.number().describe("0 to 1"),
  description: z.string().describe("One plain sentence about what the media shows, max 140 characters"),
  players: z.array(z.string()).describe("Player names you can tie to the media from the match context, else empty"),
  severity: z.enum(["normal", "medium", "critical"]).describe("Safety severity; normal unless something unsafe is visible"),
  safetyRelevant: z.boolean().describe("True if it shows injury, fighting, fire, crush risk, pitch invasion or similar"),
  tags: z.array(z.string()).describe("Up to 5 short lowercase labels"),
});
export type MomentAnalysis = z.infer<typeof MomentAnalysis>;

export type MatchContext = { home: string; away: string; score: string; minute: number | null; recentEvents: string[] };

const context = (m: MatchContext) =>
  `Match: ${m.home} ${m.score} ${m.away}, minute ${m.minute ?? "unknown"}.\nOfficial events in the last few minutes:\n${m.recentEvents.join("\n") || "none"}`;

export function analyseMoment(input: {
  match: MatchContext;
  section: string | null;
  // Photos only. ponytail: videos are judged from match context alone until Video Indexer or a poster frame is wired in.
  image?: { data: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
  isVideo: boolean;
}) {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data.toString("base64") } });
  content.push({
    type: "text",
    text: `${context(input.match)}\nFan seat section: ${input.section ?? "unknown"}.\n${
      input.image ? "Classify the attached fan photo." : `A fan just uploaded a ${input.isVideo ? "video clip" : "photo"} you cannot see. Infer the most likely event from the match context and keep confidence at 0.5 or below.`
    }`,
  });
  return ask(
    `You are Roar's Moment Analyst. Fans in the stadium upload photos and short clips; you classify each one so it can join the live Moments feed. ${LEAGUE}
Prefer the official match events to anchor what a clip shows: a celebration right after a goal is "celebration" or "goal". Use "crowd" for atmosphere, tifos and chants. Only name players that appear in the match context. Be honest with confidence: blurry or ambiguous media scores low.`,
    content,
    MomentAnalysis,
  );
}

// ---- Storyteller: title and summary for a Moment ----

export const MomentStory = z.object({
  title: z.string().describe("Punchy feed headline, max 60 characters, no emoji"),
  description: z.string().describe("Two short sentences for fans, max 250 characters"),
});

export function tellMoment(input: { match: MatchContext; eventType: string; angles: number; analyses: string[] }) {
  return ask(
    `You are Roar's Storyteller. You write the headline and summary for a Moment on the fans' live feed, built from what fans in the stadium captured. ${LEAGUE}
Write like a sharp matchday social editor: specific, energetic, factual. Never invent players, scores or events beyond the context given.`,
    [{
      type: "text",
      text: `${context(input.match)}\nMoment type: ${input.eventType}. Fan angles: ${input.angles}.\nWhat the Moment Analyst saw:\n${input.analyses.map((a) => `- ${a}`).join("\n")}`,
    }],
    MomentStory,
  );
}

// ---- Safety Analyst: triage a fan SOS report ----

export const SafetyAssessment = z.object({
  type: z.enum(["MEDICAL", "SECURITY", "FIRE", "OVERCROWDING", "OTHER"]),
  severity: z.enum(["NORMAL", "MEDIUM", "CRITICAL"]),
  confidence: z.number().describe("0 to 1"),
});

export function assessIncident(input: { type: string; section: string | null; description: string | null; minute: number | null; nearbyReports: number }) {
  return ask(
    `You are Roar's Safety Analyst. Fans send SOS reports from their seats; you triage them for stadium security staff.
CRITICAL means life or limb at risk now (unconscious fan, fire, crush, weapon, serious violence). MEDIUM needs a steward soon. NORMAL is a non-urgent nuisance.
Correct the fan's chosen type if the description clearly says otherwise. Several reports from the same section raise severity. When unsure, err towards the higher severity: a false alarm costs less than a missed one.`,
    [{
      type: "text",
      text: `Reported type: ${input.type}\nSection: ${input.section ?? "unknown"}\nMatch minute: ${input.minute ?? "unknown"}\nOther open reports from this section in the last 10 minutes: ${input.nearbyReports}\nFan's description: ${input.description?.trim() || "(none given)"}`,
    }],
    SafetyAssessment,
  );
}
