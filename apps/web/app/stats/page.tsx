"use client";

import { useEffect, useState } from "react";
import type { MatchInsights } from "@inside/matchdata";
import { Nav } from "@/components/Nav";
import { Back } from "@/components/Bits";
import { Loading, Problem, SourceNote, StatusTag } from "@/components/LiveBits";
import { kickoffText, minuteText, scoreline, useApi, useCurrentMatch } from "@/lib/live";

type Mode = "fan" | "analyst";
const MODE_KEY = "roar.statsMode";

const STATE_TEXT = {
  home_control: (h: string) => `${h} in control`,
  away_control: (_h: string, a: string) => `${a} in control`,
  balanced: () => "Evenly balanced",
  chaos: () => "Chaos: end to end",
};

export default function Stats() {
  const { match, error, loading } = useCurrentMatch();
  const f = match?.fixture;
  const ins = useApi<MatchInsights>(f ? `/matches/${f.id}/insights` : null, true).data;
  const [mode, setMode] = useState<Mode>("fan");
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "analyst") setMode("analyst");
    } catch {}
  }, []);
  const pick = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  const goals = match?.events.filter((e) => e.type === "Goal") ?? [];
  const now = ins?.now;
  const recent = ins?.timeline.slice(-30) ?? [];
  const nameOf = (side: "home" | "away") => (side === "home" ? f?.home.short : f?.away.short);

  return (
    <>
      <main className="scr enter">
        <div className="between"><Back href="/home" />{f && <StatusTag f={f} />}</div>
        {loading && <Loading />}
        {error && !match && <Problem error={error} />}

        {f && (
          <div className="card ink">
            <div className="between" style={{ textAlign: "center" }}>
              <div className="d4" style={{ width: 70 }}>{f.home.short}</div>
              <div className="d1" style={{ fontSize: 72 }}>{scoreline(f)}</div>
              <div className="d4" style={{ width: 70 }}>{f.away.short}</div>
            </div>
            <p className="small" style={{ color: "rgba(255,255,255,.8)", textAlign: "center", marginTop: 8 }}>
              {f.status === "SCHEDULED" ? `Kick-off ${kickoffText(f.kickoff)}` : goals.map((g) => `${minuteText(g)} ${g.player ?? ""}`).join(" · ") || f.statusText}
            </p>
          </div>
        )}

        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={mode === "fan"} onClick={() => pick("fan")}>Fan</button>
          <button type="button" aria-pressed={mode === "analyst"} onClick={() => pick("analyst")}>Analyst</button>
        </div>

        {f && now && (
          <section className="card t" aria-label="Control and chaos">
            <div className="between">
              <span className="h3">{STATE_TEXT[now.state](f.home.name, f.away.name)}</span>
              <span className="lab">Last 5 min</span>
            </div>
            <div className="between lab" style={{ marginTop: 12, color: "var(--ink)" }}><span>{f.home.short}</span><span>Control</span><span>{f.away.short}</span></div>
            <div style={{ display: "flex", gap: 4, marginTop: 6 }} role="img" aria-label={`Control ${now.homeControl} to ${100 - now.homeControl}`}>
              <i style={{ height: 12, borderRadius: 999, background: "var(--orange)", flex: Math.max(now.homeControl, 1) }} />
              <i style={{ height: 12, borderRadius: 999, background: "var(--blue)", flex: Math.max(100 - now.homeControl, 1) }} />
            </div>
            <div className="between lab" style={{ marginTop: 12, color: "var(--ink)" }}><span>Calm</span><span>Chaos {now.chaos}</span><span>Wild</span></div>
            <div className="prog" style={{ marginTop: 6, height: 10 }}><i style={{ width: `${now.chaos}%`, background: now.chaos >= 50 ? "var(--orange)" : "var(--green)" }} /></div>
            {mode === "analyst" && (
              <p className="small" style={{ marginTop: 10 }}>
                Control blends possession share (50%), pass accuracy gap (25%) and territory (25%) over a 5-minute window. Chaos blends possession switches per minute, overall pass accuracy, and shots plus fouls per minute.
              </p>
            )}
          </section>
        )}

        {f && recent.length > 1 && (
          <section aria-label="Momentum">
            <div className="between"><h2 className="d4" style={{ margin: 0 }}>Momentum</h2><span className="lab">Last {recent.length} min</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 2, height: 110, marginTop: 10 }} role="img" aria-label={`Momentum now ${now?.momentum ?? 0}, positive favours ${f.home.name}`}>
              {recent.map((p, i) => (
                <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <i style={{ display: "block", height: `${Math.max(0, p.momentum) / 2}%`, background: "var(--orange)", borderRadius: "3px 3px 0 0" }} />
                  <i style={{ display: "block", height: `${Math.max(0, -p.momentum) / 2}%`, background: "var(--blue)", borderRadius: "0 0 3px 3px" }} />
                </div>
              ))}
            </div>
            <div className="between small"><span>{recent[0]!.minute}&apos;</span><span>Up: {f.home.short} · Down: {f.away.short}</span><span>{recent.at(-1)!.minute}&apos;</span></div>
          </section>
        )}

        {ins && (
          <div className="grid2">
            <div className="card y" style={{ padding: 16 }}>
              <div className="lab" style={{ color: "var(--ink)" }}>Fastest shot</div>
              <div className="d3">{ins.speed.fastestShot ? `${Math.round(ins.speed.fastestShot.speedKmh)}` : "–"}<span className="h3"> km/h</span></div>
              <div className="small" style={{ color: "var(--ink)" }}>{ins.speed.fastestShot ? `${ins.speed.fastestShot.playerName}, ${ins.speed.fastestShot.minute}'` : "No shots yet"}</div>
            </div>
            <div className="card g" style={{ padding: 16 }}>
              <div className="lab" style={{ color: "var(--ink)" }}>Pass accuracy</div>
              <div className="d3">{ins.passQuality.home.accuracy}–{ins.passQuality.away.accuracy}<span className="h3">%</span></div>
              <div className="small" style={{ color: "var(--ink)" }}>{f?.home.short} v {f?.away.short}</div>
            </div>
          </div>
        )}

        {mode === "analyst" && ins && f && (
          <section aria-label="Pass quality">
            <h2 className="d4" style={{ margin: 0 }}>Pass quality</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 15 }}>
              <thead>
                <tr className="lab"><th style={{ textAlign: "left", padding: "6px 0" }}>Metric</th><th>{f.home.short}</th><th>{f.away.short}</th></tr>
              </thead>
              <tbody>
                {([
                  ["Attempted", "attempts"],
                  ["Completed", "completed"],
                  ["Average distance (m)", "avgDistance"],
                  ["Average difficulty (0–1)", "avgDifficulty"],
                  ["Hard passes completed", "hardCompleted"],
                  ["Progressive passes", "progressive"],
                  ["Average ball speed (km/h)", "avgSpeedKmh"],
                ] as const).map(([label, k]) => (
                  <tr key={k} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 0" }}>{label}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{ins.passQuality.home[k]}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{ins.passQuality.away[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {mode === "analyst" && (
          <div className="col" style={{ gap: 14 }}>
            <h2 className="d4" style={{ margin: 0 }}>Team stats</h2>
            {match?.stats.map((s) => (
              <div key={s.label}>
                <div className="between h3" style={{ fontSize: 17 }}><span>{s.home}{s.unit ?? ""}</span><span className="lab">{s.label}</span><span>{s.away}{s.unit ?? ""}</span></div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <i style={{ height: 10, borderRadius: 999, background: "var(--orange)", flex: s.home || 0.0001 }} />
                  <i style={{ height: 10, borderRadius: 999, background: "var(--blue)", flex: s.away || 0.0001 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === "analyst" && ins && ins.players.length > 0 && (
          <section aria-label="Players">
            <h2 className="d4" style={{ margin: 0 }}>Players</h2>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 360 }}>
                <thead>
                  <tr className="lab"><th style={{ textAlign: "left", padding: "6px 0" }}>Player</th><th>km</th><th>Top km/h</th><th>Pass %</th><th>xG</th></tr>
                </thead>
                <tbody>
                  {[...ins.players].sort((a, b) => b.distanceKm - a.distanceKm).map((p) => (
                    <tr key={p.playerId} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "7px 0" }}><span className={`tag ${p.side === "home" ? "o" : "b"}`} style={{ padding: "1px 6px", marginRight: 6 }}>{nameOf(p.side)}</span>{p.number}. {p.name}</td>
                      <td style={{ textAlign: "center" }}>{p.distanceKm}</td>
                      <td style={{ textAlign: "center" }}>{p.topSpeedKmh}</td>
                      <td style={{ textAlign: "center" }}>{p.passes.attempts ? p.passes.accuracy : "–"}</td>
                      <td style={{ textAlign: "center" }}>{p.xg || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {ins && ins.moments.length > 0 && (
          <section aria-label="Key moments">
            <h2 className="d4" style={{ margin: 0 }}>Key moments</h2>
            <div>
              {ins.moments.filter((m) => mode === "analyst" || m.weight >= 2).slice(0, mode === "analyst" ? 25 : 8).map((m) => (
                <div key={m.id} className="li" style={{ alignItems: "flex-start" }}>
                  <span className={`score ${m.kind === "goal" ? "y" : m.kind === "state_change" || m.kind === "momentum_swing" ? "b" : m.kind === "card" ? "o" : "t"}`}>{m.minute}&apos;</span>
                  <span className="grow">
                    <span style={{ display: "block", fontWeight: 600 }}>{m.headline}</span>
                    {mode === "analyst" && Object.keys(m.evidence.metrics).length > 0 && (
                      <span className="small" style={{ display: "block", marginTop: 4 }}>
                        Evidence: {Object.entries(m.evidence.metrics).map(([k, v]) => `${k} ${v}`).join(" · ")} · events {m.evidence.eventIds.map((id) => id.split("-").pop()).join(", ")}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
        <SourceNote source={match?.source} />
      </main>
      <Nav />
    </>
  );
}
