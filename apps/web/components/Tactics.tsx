"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { useApi } from "@/lib/live";
import { langQuery, speak, stopSpeaking, useLang } from "@/lib/lang";

type Tactics = {
  headline: string;
  points: string[];
  source: "ai" | "rules";
  facts: { passes: number; players: number; progressM: number; durationS: number; xg: number };
};

/** Tactics Analyst: why the goal worked, from the event data, at the fan's depth and language. */
export function TacticsCard({ matchId, eventId }: { matchId: string; eventId: string }) {
  const lang = useLang();
  const [depth, setDepth] = useState<"beginner" | "expert">("beginner");
  const [speaking, setSpeaking] = useState(false);
  const { data, error, loading } = useApi<Tactics>(`/matches/${matchId}/events/${eventId}/tactics?depth=${depth}${langQuery(lang, "&")}`);

  const listen = () => {
    if (!data) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    stopSpeaking();
    if (speak([data.headline, ...data.points].join(". "), lang, () => setSpeaking(false))) setSpeaking(true);
  };

  return (
    <section className="card t" aria-label="Why it worked" style={{ padding: 18 }}>
      <div className="between">
        <div className="flex"><Icon name="ai" size="s" style={{ color: "var(--blue)" }} /><span className="lab" style={{ color: "var(--ink)" }}>Why it worked</span></div>
        <div className="flex" role="group" aria-label="Explanation depth">
          {(["beginner", "expert"] as const).map((d) => (
            <button key={d} type="button" className={`pill sm ${depth === d ? "" : "ghost"}`} aria-pressed={depth === d} onClick={() => setDepth(d)} style={{ minHeight: 30, padding: "0 12px", fontSize: 13 }}>
              {d === "beginner" ? "Simple" : "Expert"}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="body" style={{ marginTop: 10 }}>Reading the build-up…</p>}
      {error && !data && <p className="body" style={{ marginTop: 10 }}>{error}</p>}
      {data && (
        <>
          <div className="d4" style={{ marginTop: 10 }}>{data.headline}</div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
            {data.points.map((p) => <li key={p} style={{ fontWeight: 600, lineHeight: 1.35 }}>{p}</li>)}
          </ul>
          <div className="grid3" style={{ marginTop: 14 }}>
            <Fact n={data.facts.passes} label="Passes" />
            <Fact n={`${data.facts.progressM}m`} label="Gained" />
            <Fact n={data.facts.xg.toFixed(2)} label="xG" />
          </div>
          <button type="button" className="pill sm" onClick={listen} style={{ marginTop: 14 }} aria-pressed={speaking}>
            <Icon name={speaking ? "mute" : "sound"} size="s" />{speaking ? "Stop" : "Listen"}
          </button>
        </>
      )}
    </section>
  );
}

function Fact({ n, label }: { n: string | number; label: string }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: 16, padding: "10px 8px", textAlign: "center" }}>
      <div className="d4">{n}</div>
      <div className="lab">{label}</div>
    </div>
  );
}
