"use client";

import { useState } from "react";
import type { Fixture } from "@inside/types";

/** Live prediction built from the current match state. */
export function callItFor(f: Fixture) {
  const minute = f.minute ?? 0;
  const by = Math.min(90, Math.ceil((minute + 10) / 5) * 5);
  const [h, a] = f.score ?? [0, 0];
  const team = h === a ? null : h > a ? f.away.name : f.home.name; // the team chasing the game
  return {
    question: team ? `Will ${team} score before ${by}'?` : `Will anyone score before ${by}'?`,
    why: team ? `${team} are behind with ${Math.max(0, 90 - minute)} minutes left.` : `It's level at ${minute}'.`,
  };
}

export function CallItCard({ fixture }: { fixture: Fixture }) {
  const [pick, setPick] = useState<"yes" | "no" | null>(null);
  const q = callItFor(fixture);
  return (
    <div className="card y" style={{ margin: "14px 18px 0", padding: "12px 14px", borderRadius: 20 }}>
      <div className="lab" style={{ color: "var(--ink)" }}>Call It · live</div>
      <div className="h3" style={{ fontSize: 18 }}>{q.question}</div>
      <div className="flex" style={{ marginTop: 10 }}>
        <button type="button" className={`pill sm grow ${pick === "yes" ? "" : "w"}`} aria-pressed={pick === "yes"} onClick={() => setPick("yes")}>Yes</button>
        <button type="button" className={`pill sm grow ${pick === "no" ? "" : "w"}`} aria-pressed={pick === "no"} onClick={() => setPick("no")}>No</button>
      </div>
      {pick && <p className="small" style={{ color: "var(--ink)", marginTop: 8, fontWeight: 600 }}>Locked in. +50 crowns if you&apos;re right.</p>}
    </div>
  );
}
