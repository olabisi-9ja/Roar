"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Back } from "@/components/Bits";
import { callItFor } from "@/components/CallIt";
import { Loading, Problem } from "@/components/LiveBits";
import { kickoffText, useCurrentMatch } from "@/lib/live";

const WINDOW_SECONDS = 60;

export default function CallIt() {
  const { match, error, loading } = useCurrentMatch();
  const [pick, setPick] = useState<"yes" | "no">("yes");
  const [stake, setStake] = useState(50);
  const [locked, setLocked] = useState(false);
  const [left, setLeft] = useState(WINDOW_SECONDS);

  useEffect(() => {
    if (left <= 0 || locked) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, locked]);

  const f = match?.fixture;
  if (!f) {
    return (
      <main className="scr no-nav enter">
        <div className="between"><Back href="/play" /></div>
        {loading ? <Loading /> : <Problem error={error ?? "No match selected."} />}
      </main>
    );
  }
  if (f.status !== "LIVE") {
    return (
      <main className="scr no-nav enter">
        <div className="between"><Back href="/play" /><span className="tag line">{f.home.short} v {f.away.short}</span></div>
        <h1 className="d2" style={{ margin: 0 }}>Call It opens at kick-off</h1>
        <p className="body">{f.status === "SCHEDULED" ? `${f.home.name} v ${f.away.name} kicks off ${kickoffText(f.kickoff)}. A new live call appears every few minutes.` : "This match has finished. Pick a live match to play."}</p>
        <Link className="pill full big mt-auto" href="/matches">Pick a match</Link>
      </main>
    );
  }

  const q = callItFor(f);
  const closed = left <= 0;
  const opt = (id: "yes" | "no", label: string, accent: string) => (
    <button type="button" role="radio" aria-checked={pick === id} disabled={locked || closed} onClick={() => setPick(id)} className={`card ${pick === id ? `${accent} sel` : "t"}`} style={{ textAlign: "left" }}>
      <span className="d3">{label}</span>
    </button>
  );

  return (
    <main className="scr no-nav enter">
      <div className="between"><Back href="/play" /><span className="chip"><Icon name="timer" size="s" />0:{String(Math.max(left, 0)).padStart(2, "0")}</span></div>
      <div className="flex"><span className="tag b"><Icon name="ai" size="s" />Live call</span><span className="tag o">{f.home.short} {f.score?.[0]}–{f.score?.[1]} {f.away.short} · {f.minute}&apos;</span></div>
      <h1 className="d2" style={{ margin: 0 }}>{q.question}</h1>
      <p className="body">Why now: {q.why}</p>
      <div className="col" role="radiogroup" aria-label="Your call">
        {opt("yes", "Yes", "g")}
        {opt("no", "No", "y")}
      </div>
      <div className="card t between" style={{ padding: "14px 16px", borderRadius: 20 }}>
        <span className="h3" style={{ fontSize: 18 }}>Stake</span>
        <div className="flex">
          <button type="button" className="iconbtn" style={{ width: 38, height: 38 }} aria-label="Less" disabled={locked} onClick={() => setStake((s) => Math.max(10, s - 10))}>−</button>
          <span className="d4" style={{ width: 56, textAlign: "center" }} aria-live="polite">{stake}</span>
          <button type="button" className="iconbtn" style={{ width: 38, height: 38 }} aria-label="More" disabled={locked} onClick={() => setStake((s) => Math.min(200, s + 10))}>+</button>
        </div>
      </div>
      <p className="small">Win 2× your stake. Free to play: crowns can&apos;t be bought or cashed out.</p>
      {locked ? (
        <div className="card y mt-auto" role="status">
          <div className="d4">Locked in: {pick === "yes" ? "Yes" : "No"} · {stake} crowns</div>
          <p style={{ fontWeight: 600, marginTop: 6 }}>Settled automatically from the live match events when the window closes.</p>
          <Link className="pill sm" href="/play" style={{ marginTop: 12 }}>Back to games</Link>
        </div>
      ) : (
        <button type="button" className="pill full big mt-auto" disabled={closed} onClick={() => setLocked(true)}>{closed ? "Call closed" : "Lock it in"}</button>
      )}
    </main>
  );
}
