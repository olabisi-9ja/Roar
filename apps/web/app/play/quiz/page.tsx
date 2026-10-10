"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Back } from "@/components/Bits";
import { quiz } from "@/lib/data";

export default function Quiz() {
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = n >= quiz.length;

  if (done) {
    const crowns = score * 15;
    return (
      <main className="scr no-nav enter center" style={{ textAlign: "center" }}>
        <Icon name="crown" style={{ width: 64, height: 64, color: "var(--yellow)", marginTop: 40 }} />
        <div className="d1" style={{ fontSize: 120 }}>+{crowns}</div>
        <div className="d4">{score} of {quiz.length} right</div>
        <div className="card o" style={{ width: "100%" }}><b className="h3">You moved up in Section C</b></div>
        <div className="col mt-auto" style={{ width: "100%" }}>
          <Link className="pill full big" href="/play/leaderboard">See leaderboard</Link>
          <button type="button" className="pill full ghost" onClick={() => { setN(0); setScore(0); setPicked(null); }}>Play again</button>
        </div>
      </main>
    );
  }

  const item = quiz[n];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === item.answer) setScore((s) => s + 1);
  }

  return (
    <main className="scr no-nav enter">
      <div className="between"><Back href="/play" /><span className="lab">Question {n + 1} of {quiz.length}</span><span className="chip"><Icon name="ai" size="s" style={{ color: "var(--blue)" }} />AI</span></div>
      <div className="prog"><i style={{ width: `${(n / quiz.length) * 100}%`, background: "var(--green)" }} /></div>
      <div className="vid" style={{ height: 180, display: "flex", alignItems: "flex-end", padding: 14 }}><span className="tag w">Fan clip · North stand</span></div>
      <h1 className="d3" style={{ margin: 0 }}>{item.q}</h1>
      <div className="col" style={{ gap: 10 }} aria-live="polite">
        {item.options.map((o, i) => {
          const cls = !answered ? "" : i === item.answer ? "right" : i === picked ? "wrong" : "";
          return (
            <button key={o} type="button" className={`choice ${cls}`} onClick={() => choose(i)} disabled={answered && cls === ""}>
              <b>{"ABCD"[i]}</b>{o}
            </button>
          );
        })}
      </div>
      <button type="button" className="pill full big mt-auto" disabled={!answered} onClick={() => { setN(n + 1); setPicked(null); }}>
        {n + 1 === quiz.length ? "Finish" : "Next"}
      </button>
    </main>
  );
}
