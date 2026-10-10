// Writes every scripted match to datasets/<id>.json: the synthetic dataset deliverable (brief item v).
// Run: npm run export -w @inside/matchdata
import { mkdirSync, writeFileSync } from "node:fs";
import { generateMatch, SCRIPTS, validateMatch } from "./index.js";

mkdirSync("datasets", { recursive: true });
for (const script of SCRIPTS) {
  const d = generateMatch(script);
  const { ok, problems } = validateMatch(d);
  if (!ok) throw new Error(`${script.id}: ${problems.join("; ")}`);
  writeFileSync(`datasets/${script.id}.json`, JSON.stringify(d));
  console.log(`datasets/${script.id}.json  ${d.events.length} events`);
}
