"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCurrentMatch } from "@/lib/live";
import { queueIncident, sendIncident, type IncidentPayload } from "@/lib/incidents";

const HOLD_MS = 2000;
const TYPES = ["Medical", "Security", "Fire", "Crowding", "Something else"];
const API_TYPE: Record<string, string> = { Medical: "MEDICAL", Security: "SECURITY", Fire: "FIRE", Crowding: "OVERCROWDING", "Something else": "OTHER" };
type Stage = "hold" | "details" | "sent";

export default function Sos() {
  const [stage, setStage] = useState<Stage>("hold");
  const [progress, setProgress] = useState(0);
  const [type, setType] = useState("Medical");
  const [section, setSection] = useState("");
  const [row, setRow] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState("");
  const [ref, setRef] = useState("");
  const [queued, setQueued] = useState(false);
  const [queueNote, setQueueNote] = useState("No network right now.");
  const { match, list } = useCurrentMatch();
  const start = useRef(0);
  const payloadRef = useRef<IncidentPayload | null>(null);

  async function send() {
    setSending(true);
    setFailed("");
    const seat = section.trim();
    if (!seat) {
      setFailed("Enter the section printed on your ticket or the nearest stadium sign.");
      setSending(false);
      return;
    }
    // SOS must not depend on the match picker: use the loaded match, then any known fixture as the venue key.
    const matchId = match?.fixture.id ?? list?.live[0]?.id ?? list?.upcoming[0]?.id ?? list?.recent[0]?.id;
    if (!matchId) {
      setFailed("We couldn't attach this report to a venue. Call 999 and find the nearest steward now.");
      setSending(false);
      return;
    }
    const payload: IncidentPayload = {
      matchId,
      type: API_TYPE[type],
      section: seat,
      row: row.trim() || undefined,
      description: description.trim() || undefined,
    };
    payloadRef.current = payload;
    try {
      const result = await sendIncident(payload);
      if (result.ok) {
        setRef(result.id.slice(-6).toUpperCase());
        setQueued(false);
        setStage("sent");
        return;
      }
      if (result.reason === "network" || result.reason === "retryable") {
        // Keep the report on the device and say so. Never claim security has it.
        const local = queueIncident(payload);
        setRef(local.slice(-6).toUpperCase());
        setQueueNote(result.reason === "network" ? "No network right now." : "The security queue is busy right now.");
        setQueued(true);
        setStage("sent");
        return;
      }
      setFailed(result.error ?? "We couldn't send this report. Call 999 if this is life-threatening.");
    } catch {
      setFailed("We couldn't send this report. Call 999 if this is life-threatening, and find the nearest steward now.");
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    if (!payloadRef.current) return;
    setSending(true);
    const result = await sendIncident(payloadRef.current);
    setSending(false);
    if (result.ok) {
      setRef(result.id.slice(-6).toUpperCase());
      setQueued(false);
      return;
    }
    if (result.reason === "rejected") {
      setFailed(result.error ?? "We couldn't send this report. Call 999 if this is life-threatening.");
      setStage("details");
      return;
    }
    setQueueNote(result.reason === "network" ? "Still offline." : "The security queue is still busy.");
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
        <div className="col" style={{ gap: 10 }}>
          <label className="field"><span className="lab">Your section</span><input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. 112" aria-label="Your section" maxLength={10} autoComplete="off" /></label>
          <label className="field"><span className="lab">Row (optional)</span><input value={row} onChange={(e) => setRow(e.target.value)} placeholder="e.g. 14" aria-label="Your row" maxLength={10} autoComplete="off" /></label>
          <label className="field"><span className="lab">What can you see? (optional)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what is happening" aria-label="Description of the emergency" maxLength={500} rows={3} style={{ resize: "vertical" }} /></label>
        </div>
        <Link className="pill full ghost" href="/capture"><Icon name="cam" size="s" />Add photo or video (optional)</Link>
        {failed && (
          <div role="alert" className="card o" style={{ padding: "14px 16px", borderRadius: 18, fontWeight: 700 }}>
            <p style={{ margin: 0 }}>{failed}</p>
            <a className="pill full big o" href="tel:999" style={{ marginTop: 10 }}>Call 999 now</a>
          </div>
        )}
        <button type="button" className="pill full big o mt-auto" onClick={send} disabled={sending}>{sending ? "Sending…" : failed ? "Try again" : "Send report"}</button>
      </main>
    );
  }

  if (stage === "sent") {
    return (
      <main className="scr no-nav enter" role="status">
        <div className={`card ${queued ? "y" : "g"}`} style={{ padding: 24 }}>
          <Icon name={queued ? "timer" : "shield"} size="l" />
          <div className="d2" style={{ marginTop: 8 }}>{queued ? "Saved on this phone" : "Report received"}</div>
          <p style={{ marginTop: 6, fontWeight: 600 }}>
            {queued
              ? `${queueNote} We have not sent this report yet. It will retry automatically when the queue is reachable — if this is life-threatening, call 999 now.`
              : `Your ${type.toLowerCase()} report is in the stadium security queue. We have not confirmed that a steward has seen it yet.`}
          </p>
        </div>
        <div>
          <div className="li"><span className="av g" style={{ width: 34, height: 34 }}><Icon name={queued ? "timer" : "check"} size="s" /></span><span className="grow h3" style={{ fontSize: 18 }}>{queued ? "Waiting for network" : "Submitted to the security queue"}</span></div>
          <div className="li" style={{ opacity: 0.6 }}><span className="av t" style={{ width: 34, height: 34 }}><Icon name="timer" size="s" /></span><span className="grow h3" style={{ fontSize: 18 }}>Security acknowledgement</span><span className="tag">Not yet</span></div>
        </div>
        {queued && (
          <button type="button" className="pill full big" onClick={retry} disabled={sending}>{sending ? "Trying…" : "Try sending now"}</button>
        )}
        <p className="small">Reference {ref}. If you are in immediate danger, call 999 and find the nearest steward now.</p>
        <a className="pill full big o" href="tel:999">Call 999</a>
        <Link className="pill full ghost" href="/home">Back to Roar</Link>
      </main>
    );
  }

  return (
    <main className="scr no-nav enter center" style={{ textAlign: "center" }}>
      <div className="between" style={{ alignSelf: "stretch" }}><Link className="iconbtn" href="/home" aria-label="Close"><Icon name="x" /></Link><span className="tag o">SOS</span></div>
      <h1 className="d2" style={{ margin: "20px 0 0" }}>Are you in danger?</h1>
      <p className="body" style={{ maxWidth: 300 }}>Hold the button for 2 seconds. You&apos;ll enter your exact section on the next screen.</p>
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
        aria-label="Hold for 2 seconds to report an emergency"
      >
        <span className="ring" style={{ background: `conic-gradient(var(--ink) ${progress * 360}deg, transparent 0)`, mask: "radial-gradient(circle, transparent 136px, #000 137px)" }} />
        <span><span className="d3" style={{ display: "block", fontSize: 46 }}>Hold</span><span className="h3" style={{ display: "block" }}>to report</span></span>
      </button>
      <p className="small" style={{ marginTop: 44 }}>Release to cancel. In a life-threatening emergency, call 999.</p>
    </main>
  );
}
