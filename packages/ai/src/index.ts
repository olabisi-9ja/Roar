// Roar's AI agents (SPEC section 7). Each agent is one structured model call with its own prompt and output
// schema. Microsoft Foundry is the primary provider: Claude through its Anthropic-compatible route, or an
// Azure OpenAI model through its OpenAI-compatible route (the latter is available on free-trial subscriptions).
// The direct Claude API (ANTHROPIC_API_KEY) remains a local-development fallback. With no provider, every
// agent returns null and callers keep their rule-based behaviour.
import Anthropic from "@anthropic-ai/sdk";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { foundryOpenAiBaseUrl, normalizeBaseUrl, normalizeFoundryResource, normalizeOpenAiBaseUrl } from "./config.js";

type AnthropicClient = Anthropic | AnthropicFoundry;
type Client = AnthropicClient | OpenAI;
type ClientKind = "anthropic" | "openai";
export type AiProvider = "microsoft-foundry" | "azure-openai" | "anthropic" | "none";

type AiContent =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: Buffer };

export type AiConfigStatus = {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  /** Safe-to-display explanation of why AI is disabled. Never contains credentials. */
  error: string | null;
};

const env = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

function createClient(): { client: Client | null; kind: ClientKind | null; status: AiConfigStatus } {
  const model = env("AI_MODEL") || "claude-opus-5-5";
  const enabledFlag = env("AI_ENABLED")?.toLowerCase();
  const disabled = (error: string | null = null): { client: null; kind: null; status: AiConfigStatus } => ({
    client: null,
    kind: null,
    status: { enabled: false, provider: "none", model, error },
  });

  if (enabledFlag && ["0", "false", "no", "off"].includes(enabledFlag)) return disabled();
  if (enabledFlag && !["1", "true", "yes", "on"].includes(enabledFlag)) {
    return disabled("AI_ENABLED must be one of true/false, 1/0, yes/no, or on/off.");
  }

  const providerRaw = env("AI_PROVIDER")?.toLowerCase();
  const provider =
    providerRaw === "foundry" || providerRaw === "microsoft-foundry"
      ? "microsoft-foundry"
      : providerRaw === "azure-openai" || providerRaw === "foundry-openai"
        ? "azure-openai"
        : providerRaw === "anthropic"
          ? "anthropic"
          : providerRaw;
  if (provider && !["microsoft-foundry", "azure-openai", "anthropic"].includes(provider)) {
    return disabled("AI_PROVIDER must be microsoft-foundry, azure-openai, anthropic, or unset.");
  }

  const resourceRaw = env("ANTHROPIC_FOUNDRY_RESOURCE");
  const baseRaw = env("ANTHROPIC_FOUNDRY_BASE_URL");
  const foundryKey = env("ANTHROPIC_FOUNDRY_API_KEY");
  const openAiResourceRaw = env("AZURE_OPENAI_RESOURCE");
  const openAiBaseRaw = env("AZURE_OPENAI_BASE_URL");
  const openAiKey = env("AZURE_OPENAI_API_KEY");

  if (provider === "anthropic") {
    if (resourceRaw || baseRaw || openAiResourceRaw || openAiBaseRaw) {
      return disabled("AI_PROVIDER=anthropic cannot be combined with Microsoft Foundry settings.");
    }
    const apiKey = env("ANTHROPIC_API_KEY");
    if (!apiKey) return disabled("AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY.");
    const { url: baseURL, warning } = normalizeBaseUrl(env("ANTHROPIC_BASE_URL"));
    if (env("ANTHROPIC_BASE_URL") && !baseURL) return disabled(warning ?? "ANTHROPIC_BASE_URL is invalid.");
    if (warning) console.warn(`[ai] ${warning}`);
    try {
      const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}), timeout: 60_000, maxRetries: 2 });
      return { client, kind: "anthropic", status: { enabled: true, provider: "anthropic", model, error: null } };
    } catch (error) {
      return disabled(error instanceof Error ? error.message : "Could not create the Claude API client.");
    }
  }

  if (provider === "azure-openai") {
    if (openAiResourceRaw && openAiBaseRaw) {
      return disabled("Set only one of AZURE_OPENAI_RESOURCE or AZURE_OPENAI_BASE_URL.");
    }
    if (!openAiResourceRaw && !openAiBaseRaw) {
      return disabled("AI_PROVIDER=azure-openai requires AZURE_OPENAI_RESOURCE or AZURE_OPENAI_BASE_URL.");
    }
    if (!openAiKey) return disabled("AZURE_OPENAI_API_KEY is required for Azure OpenAI.");
    const resource = normalizeFoundryResource(openAiResourceRaw);
    if (openAiResourceRaw && !resource) {
      return disabled("AZURE_OPENAI_RESOURCE must be the Foundry resource name or endpoint.");
    }
    const { url: explicitBaseURL, warning } = normalizeOpenAiBaseUrl(openAiBaseRaw);
    if (openAiBaseRaw && !explicitBaseURL) return disabled(warning ?? "The Azure OpenAI base URL is invalid.");
    if (warning) console.warn(`[ai] ${warning}`);
    const baseURL = resource ? foundryOpenAiBaseUrl(resource) : explicitBaseURL;
    if (!baseURL) return disabled("Could not determine the Azure OpenAI base URL.");
    try {
      const client = new OpenAI({
        apiKey: openAiKey,
        baseURL,
        defaultHeaders: { "api-key": openAiKey },
        timeout: 60_000,
        maxRetries: 2,
      });
      return { client, kind: "openai", status: { enabled: true, provider: "azure-openai", model, error: null } };
    } catch (error) {
      return disabled(error instanceof Error ? error.message : "Could not create the Azure OpenAI client.");
    }
  }

  if (resourceRaw || baseRaw) {
    if (resourceRaw && baseRaw) return disabled("Set only one of ANTHROPIC_FOUNDRY_RESOURCE or ANTHROPIC_FOUNDRY_BASE_URL.");
    const { url: baseURL, warning } = normalizeBaseUrl(baseRaw);
    if (baseRaw && !baseURL) return disabled(warning ?? "The Foundry base URL is invalid.");
    if (warning) console.warn(`[ai] ${warning}`);
    const resource = normalizeFoundryResource(resourceRaw);
    if (resourceRaw && !resource) return disabled("ANTHROPIC_FOUNDRY_RESOURCE must be the Foundry resource name or endpoint.");
    if (!foundryKey) return disabled("ANTHROPIC_FOUNDRY_API_KEY is required for Microsoft Foundry.");
    try {
      const client = new AnthropicFoundry({
        apiKey: foundryKey,
        ...(resource ? { resource } : { baseURL }),
        timeout: 60_000,
        maxRetries: 2,
      });
      return { client, kind: "anthropic", status: { enabled: true, provider: "microsoft-foundry", model, error: null } };
    } catch (error) {
      return disabled(error instanceof Error ? error.message : "Could not create the Microsoft Foundry client.");
    }
  }

  if (provider === "microsoft-foundry") {
    return disabled("Microsoft Foundry is selected but no resource or base URL is set.");
  }
  // Do not silently use ambient OS credentials (for example a shell-level ANTHROPIC_API_KEY).
  return provider
    ? disabled("Set AI_PROVIDER=microsoft-foundry (with Foundry settings), AI_PROVIDER=azure-openai (with OpenAI settings), or AI_PROVIDER=anthropic (with a Claude API key).")
    : disabled();
}

const { client, kind: clientKind, status: config } = createClient();
// On Foundry this is the deployment name.
const MODEL = config.model;

if (config.error) console.warn(`[ai] AI disabled: ${config.error}`);
export const aiEnabled = () => client !== null;
export const aiModel = () => MODEL;
export const aiStatus = (): AiConfigStatus => ({ ...config });

function toAnthropicContent(content: AiContent[]): Anthropic.ContentBlockParam[] {
  return content.map((part) =>
    part.type === "text"
      ? { type: "text", text: part.text }
      : { type: "image", source: { type: "base64", media_type: part.mediaType, data: part.data.toString("base64") } },
  );
}

function toOpenAiContent(content: AiContent[]): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  return content.map((part) =>
    part.type === "text"
      ? { type: "text", text: part.text }
      : { type: "image_url", image_url: { url: `data:${part.mediaType};base64,${part.data.toString("base64")}` } },
  );
}

async function ask<T extends z.ZodType>(system: string, content: AiContent[], schema: T): Promise<z.infer<T> | null> {
  if (!client) return null;
  if (clientKind === "openai") {
    const res = await (client as OpenAI).chat.completions.parse({
      model: MODEL,
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: toOpenAiContent(content) },
      ],
      response_format: zodResponseFormat(schema, "result"),
    });
    const choice = res.choices[0];
    // A refusal or content-filter stop just means "no AI opinion"; callers fall back to rules.
    if (!choice || choice.finish_reason === "content_filter" || choice.message.refusal) return null;
    return (choice.message.parsed as z.infer<T> | undefined) ?? null;
  }
  const res = await (client as AnthropicClient).messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: toAnthropicContent(content) }],
  });
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
  // Photos directly; videos use a poster frame captured by the browser.
  image?: { data: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
  isVideo: boolean;
}) {
  const content: AiContent[] = [];
  if (input.image) content.push({ type: "image", mediaType: input.image.mediaType, data: input.image.data });
  content.push({
    type: "text",
    text: `${context(input.match)}\nFan seat section: ${input.section ?? "unknown"}.\n${
      input.image
        ? `Classify the attached ${input.isVideo ? "poster frame from a fan video clip" : "fan photo"}.`
        : `A fan just uploaded a ${input.isVideo ? "video clip" : "photo"} you cannot see. Infer the most likely event from the match context and keep confidence at 0.5 or below.`
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
