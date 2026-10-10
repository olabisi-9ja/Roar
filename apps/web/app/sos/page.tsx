"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { me } from "@/lib/data";
import { postJson, useCurrentMatch } from "@/lib/live";

const HOLD_MS = 2000;
const TYPES = ["Medical", "Security", "Fire", "Crowding", "Something else"];
const API_TYPE: Record<string, string> = { Medical: "MEDICAL", Security: "SECURITY", Fire: "FIRE", Crowding: "OVERCROWDING", "Something else": "OTHER" };
type Stage = "hold" | "details" | "sent";

export default function Sos() {
  const [stage, setStage] = useState<Stage>("hold");
  const [progress, setProgress] = useState(0);
  const [type, setType] = useState("Medical");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState("");
  const [ref, setRef] = useState("");
  const { match } = useCurrentMatch();
  const start = useRef(0);

  async function send() {
    setSending(true);
    setFailed("");
    try {
      if (!match) throw new Error("No match selected.");
      const res = await postJson<{ id: string }>("/incidents", { matchId: match.fixture.id, type: API_TYPE[type], section: me.section, row: String(me.row) });
      setRef(res.id.slice(-6).toUpperCase());
      setStage("sent");
    } catch {
      setFailed("We couldn't reach stadium security. Find the nearest steward now, or call 999 if it's life-threatening.");
    } finally {
      setSending(false);
    }
  }
  const raf = useRef(0);

  function begin() {
    start.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        navigator.vibrate?.(200);
        setStage("details");
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }
  function cancel() {
    cancelAnimationFrame(raf.current);
    setProgress(0);
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (stage === "details") {
    return (
      <main className="scr no-nav enter">
        <div className="between"><button type="button" className="iconbtn" aria-label="Cancel alert" onClick={() => { setStage("hold"); setProgress(0); }}><Icon name="x" /></button><span className="tag o">Alert started</span></div>
        <h1 className="d2" style={{ margin: 0 }}>What&apos;s happening?</h1>
        <div className="grid2" role="radiogroup" aria-label="Type of emergency">
          {TYPES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={`card ${type === t ? "o sel" : "t"}`} style={{ textAlign: "left", padding: 18, gridColumn: t === "Something else" ? "1 / -1" : undefined }}>
              <span className="d4" style={{ fontSize: 22 }}>{t}</span>
            </button>
          ))}
        </div>
        <Link className="pill full ghost" href="/capture"><Icon name="cam" size="s" />Add photo or video (optional)</Link>
        <div className="card t flex" style={{ padding: "14px 16px", borderRadius: 20 }}>
          <Icon name="pin" />
          <span className="grow"><b className="h3" style={{ fontSize: 18 }}>Section {me.section} · Row {me.row}</b><span className="small" style={{ display: "block" }}>Shared with security only</span></span>
        </div>
        {failed && <p role="alert" className="card o" style={{ padding: "14px 16px", borderRadius: 18, fontWeight: 700 }}>{failed}</p>}
        <button type="button" className="pill full big o mt-auto" onClick={send} disabled={sending}>{sending ? "Sending…" : failed ? "Try again" : "Send alert"}</button>
      </main>
    );
  }

  if (stage === "sent") {
    return (
      <main className="scr no-nav enter" role="status">
        <div className="card g" style={{ padding: 24 }}>
          <Icon name="shield" size="l" />
          <div className="d2" style={{ marginTop: 8 }}>Help is coming</div>
          <p style={{ marginTop: 6, fontWeight: 600 }}>{type} alert sent. Stay where you are. A steward is on the way.</p>
        </div>
        <div>
          <div className="li"><span className="av g" style={{ width: 34, height: 34 }}><Icon name="check" size="s" /></span><span className="grow h3" style={{ fontSize: 18 }}>Alert sent</span></div>
          <div className="li"><span className="av g" style={{ width: 34, height: 34 }}><Icon name="check" size="s" /></span><span className="grow h3" style={{ fontSize: 18 }}>Seen by security</span></div>
          <div className="li"><span className="av y" style={{ width: 34, height: 34 }}><Icon name="pin" size="s" /></span><span className="grow h3" style={{ fontSize: 18 }}>Steward on the way</span><span className="tag y">~2 min</span></div>
          <div className="li" style={{ opacity: 0.5 }}><span className="av t" style={{ width: 34, height: 34 }} /><span className="grow h3" style={{ fontSize: 18 }}>Resolved</span></div>
        </div>
        <p className="small">Alert reference {ref}. Security sees it on their dashboard now.</p>
        <Link className="pill full ghost mt-auto" href="/home">Back to Roar</Link>
      </main>
    );
  }

  return (
    <main className="scr no-nav enter center" style={{ textAlign: "center" }}>
      <div className="between" style={{ alignSelf: "stretch" }}><Link className="iconbtn" href="/home" aria-label="Close"><Icon name="x" /></Link><span className="tag o">SOS</span></div>
      <h1 className="d2" style={{ margin: "20px 0 0" }}>Are you in danger?</h1>
      <p className="body" style={{ maxWidth: 300 }}>Hold the button for 2 seconds. Stadium security will see Section {me.section}, Row {me.row}.</p>
      <button
        type="button"
        className="hold"
        style={{ marginTop: 30 }}
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) begin(); }}
        onKeyUp={cancel}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Hold for 2 seconds to alert security"
      >
        <span className="ring" style={{ background: `conic-gradient(var(--ink) ${progress * 360}deg, transparent 0)`, mask: "radial-gradient(circle, transparent 136px, #000 137px)" }} />
        <span><span className="d3" style={{ display: "block", fontSize: 46 }}>Hold</span><span className="h3" style={{ display: "block" }}>to alert security</span></span>
      </button>
      <p className="small" style={{ marginTop: 44 }}>Release to cancel. In a life-threatening emergency, also call 999.</p>
    </main>
  );
}
