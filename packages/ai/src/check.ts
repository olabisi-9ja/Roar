// Smoke test the agents against the configured model: npm run check -w @inside/ai (needs Foundry or a Claude API key).
import assert from "node:assert/strict";
import { aiEnabled, aiModel, aiStatus, analyseMoment, assessIncident, tellMoment } from "./index.js";

console.log("AI configuration:", aiStatus());
assert.ok(aiEnabled(), "Set AI_PROVIDER=azure-openai with AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY, AI_PROVIDER=microsoft-foundry with ANTHROPIC_FOUNDRY_RESOURCE + ANTHROPIC_FOUNDRY_API_KEY, or AI_PROVIDER=anthropic + ANTHROPIC_API_KEY, in the repo .env");
assert.ok(aiModel().length > 0);
const match = { home: "Harbour City", away: "Kingsford Rovers", score: "1-0", minute: 63, recentEvents: ["62' Goal Right-footed shot T. Okafor (Harbour City)"] };

// This smoke test intentionally omits a poster frame, so it also verifies the low-confidence fallback.
const moment = await analyseMoment({ match, section: "112", isVideo: true });
console.log("Moment Analyst:", moment);
assert.ok(moment && ["goal", "celebration"].includes(moment.eventType) && moment.confidence <= 0.5);

const story = await tellMoment({ match, eventType: "goal", angles: 3, analyses: [moment.description] });
console.log("Storyteller:", story);
assert.ok(story && story.title.length > 0);

const sos = await assessIncident({ type: "OTHER", section: "112 · Row 4", description: "man collapsed, not breathing", minute: 63, nearbyReports: 1 });
console.log("Safety Analyst:", sos);
assert.ok(sos && sos.type === "MEDICAL" && sos.severity === "CRITICAL");
console.log("All agents OK");
