"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Back, Crowns } from "@/components/Bits";
import { leaderboard, me } from "@/lib/data";

const TABS = ["Section C", "Friends", "Stadium"];

export default function Leaderboard() {
  const [tab, setTab] = useState(TABS[0]);
  const [first, second, third] = leaderboard;
  const rest = leaderboard.slice(3);

  const podium = (p: typeof first, size: number, pos: number) => (
    <div>
      <div className={`av ${p.accent}`} style={{ width: size, height: size, margin: "0 auto", fontSize: size / 3.4, boxShadow: "0 0 0 4px var(--paper), 0 6px 18px rgba(58,6,72,.2)" }}>{p.initials}</div>
      <span className={`score ${pos === 1 ? "o" : "t"}`} style={{ margin: "-12px auto 0", position: "relative", width: 34, minWidth: 0, height: 26 }}>{pos}</span>
      <div className="h3" style={{ fontSize: 17, marginTop: 6 }}>{p.name}</div>
      <div className="small">{p.crowns.toLocaleString()}</div>
    </div>
  );

  return (
    <>
      <main className="scr enter">
        <div className="between"><Back href="/play" /><h1 className="d4" style={{ margin: 0 }}>Leaderboard</h1><Crowns n={me.crowns} /></div>
        <div className="seg">
          {TABS.map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", alignItems: "end", textAlign: "center", gap: 6 }}>
          {podium(second, 72, 2)}
          {podium(first, 96, 1)}
          {podium(third, 72, 3)}
        </div>
        <div>
          {rest.map((p) => (
            <div key={p.rank} className="li">
              <span className={`av ${p.me ? "o" : "t"}`}>{p.initials}</span>
              <span className="grow"><b className="h3" style={{ fontSize: 18 }}>{p.name}</b><span className="small" style={{ display: "block" }}>{p.crowns.toLocaleString()} crowns</span></span>
              {p.me && <span className="tag">Me</span>}
              <span className={`score ${p.accent}`}>{p.rank}</span>
            </div>
          ))}
        </div>
      </main>
      <Nav />
    </>
  );
}
