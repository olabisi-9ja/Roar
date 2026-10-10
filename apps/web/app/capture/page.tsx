"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { me } from "@/lib/data";
import { useCurrentMatch } from "@/lib/live";
import { enqueue, upload } from "@/lib/uploads";

type Stage = "source" | "camera" | "preview" | "analysing" | "done";

const SOURCES: { id: string; title: string; sub: string; icon: IconName; accent: string; ready: boolean }[] = [
  { id: "phone", title: "Phone", sub: "Built-in camera", icon: "cam", accent: "o", ready: true },
  { id: "glasses", title: "Ray-Ban Meta", sub: "Needs the Roar glasses bridge app", icon: "glasses", accent: "y", ready: false },
  { id: "external", title: "External camera", sub: "USB or webcam on this device", icon: "ext", accent: "b", ready: true },
];

// ponytail: AI steps are simulated on a timer until the media-analysis worker exists.
const STEPS = ["Event detected", "Player identified", "Other angles found", "Building the Moment"];

export default function Capture() {
  const [stage, setStage] = useState<Stage>("source");
  const [source, setSource] = useState("phone");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState("");
  const [clip, setClip] = useState<Blob | null>(null);
  const [audience, setAudience] = useState("community");
  const [uploading, setUploading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [step, setStep] = useState(0);
  const { match } = useCurrentMatch();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopStream, []);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera needs a secure connection (https or localhost).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: source === "phone" ? { facingMode: "environment" } : true,
        audio: true,
      });
      streamRef.current = stream;
      setStage("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError("We couldn't open the camera. Check the browser's camera permission.");
    }
  }

  function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!streamRef.current) return;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(streamRef.current);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      setClip(blob);
      setClipUrl(URL.createObjectURL(blob));
      stopStream();
      setStage("preview");
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  async function send() {
    if (!clip || !match) {
      setError(match ? "Record a clip first." : "Pick a match before uploading.");
      return;
    }
    setError("");
    setUploading(true);
    const item = { blob: clip, filename: clip.type.includes("mp4") ? "clip.mp4" : "clip.webm", matchId: match.fixture.id, section: me.section, audience };
    try {
      if (!(await upload(item))) {
        // No signal in the stadium: keep the clip and send it when the network is back.
        await enqueue(item);
        setQueued(true);
        setUploading(false);
        setStage("done");
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Your clip is still here, try again.");
      setUploading(false);
      return;
    }
    setQueued(false);
    setUploading(false);
    setStage("analysing");
    setStep(0);
    STEPS.forEach((_, n) => setTimeout(() => setStep(n + 1), 900 * (n + 1)));
    setTimeout(() => setStage("done"), 900 * STEPS.length + 600);
  }

  if (stage === "camera") {
    return (
      <main className="cam">
        <video ref={videoRef} autoPlay playsInline muted />
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <div className="between" style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "max(20px, env(safe-area-inset-top)) 20px 0" }}>
          <button className="iconbtn" type="button" aria-label="Close camera" onClick={() => { stopStream(); setStage("source"); }}><Icon name="x" /></button>
          <span className="chip"><Icon name="pin" size="s" />Section {me.section}</span>
        </div>
        {recording && <span className="tag o" style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)" }}>● Recording</span>}
        <button type="button" className="rec" aria-label={recording ? "Stop recording" : "Start recording"} aria-pressed={recording} onClick={toggleRecord} style={{ position: "absolute", left: "50%", bottom: 44, transform: "translateX(-50%)" }}>
          <span />
        </button>
      </main>
    );
  }

  if (stage === "preview") {
    return (
      <main className="scr no-nav enter">
        <div className="between"><button className="iconbtn" type="button" aria-label="Retake" onClick={() => setStage("source")}><Icon name="back" /></button><span className="lab">Your clip</span></div>
        <video src={clipUrl} controls playsInline style={{ width: "100%", height: 330, objectFit: "cover", borderRadius: 28, background: "var(--ink)" }} />
        <label className="field"><input placeholder="Add a caption (optional)" aria-label="Caption" /></label>
        <div className="lab">Share with</div>
        <ShareWith value={audience} onChange={setAudience} />
        {error && <p role="alert" className="card o" style={{ padding: "12px 16px", borderRadius: 18, fontWeight: 600 }}>{error}</p>}
        <button type="button" className="pill full big mt-auto" onClick={send} disabled={uploading}>
          <Icon name="upload" />{uploading ? "Uploading…" : `Send to Roar${match ? ` · ${match.fixture.home.short} v ${match.fixture.away.short}` : ""}`}
        </button>
      </main>
    );
  }

  if (stage === "analysing") {
    return (
      <main className="scr no-nav enter">
        <div className="vid" style={{ height: 220 }} />
        <h1 className="d2" style={{ margin: 0 }}>AI is reading your moment</h1>
        <div className="prog"><i style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>
        <div className="col" style={{ gap: 10 }} aria-live="polite">
          {STEPS.map((s, n) => (
            <div key={s} className="card t flex" style={{ padding: "14px 16px", borderRadius: 20, opacity: n <= step ? 1 : 0.45 }}>
              <span className={`av ${n < step ? "g" : "b"}`} style={{ width: 34, height: 34 }}><Icon name={n < step ? "check" : "ai"} size="s" /></span>
              <span className="grow h3" style={{ fontSize: 18 }}>{s}</span>
            </div>
          ))}
        </div>
        <p className="small">Demo: these steps are simulated until the AI worker is connected.</p>
      </main>
    );
  }

  if (stage === "done") {
    return (
      <main className="scr no-nav enter center" style={{ textAlign: "center" }}>
        <div style={{ position: "relative", width: "100%", height: 230 }} aria-hidden="true">
          <div className="photo" style={{ position: "absolute", left: "50%", top: 20, width: 220, height: 200, marginLeft: -110, backgroundColor: "var(--yellow)", transform: "rotate(-3deg)" }}><span>Your clip</span></div>
          <i className="cf" style={{ left: 30, top: 20, background: "var(--orange)", transform: "rotate(30deg)" }} />
          <i className="cf" style={{ right: 30, top: 40, background: "var(--green)", transform: "rotate(-24deg)" }} />
          <i className="cf" style={{ left: 40, top: 170, background: "var(--blue)", transform: "rotate(70deg)" }} />
        </div>
        <h1 className="d2" style={{ margin: 0 }}>{queued ? "Saved on your phone" : "Your angle is in!"}</h1>
        <p className="body">{queued ? "No signal right now. It uploads by itself when you're back online. " : ""}{queued ? "Going to" : "Uploaded to"} {match ? `${match.fixture.home.name} v ${match.fixture.away.name}` : "the match"}. It joins the nearest Moment once AI analysis is connected.</p>
        <div className="card y" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><Icon name="crown" size="l" /><span className="d3">+50 crowns</span></div>
        <div className="col mt-auto" style={{ width: "100%" }}>
          <Link className="pill full big" href="/live">Back to live</Link>
          <button type="button" className="pill full ghost" onClick={() => setStage("source")}>Capture another</button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="scr enter">
        <h1 className="d2" style={{ margin: 0 }}>Pick your camera</h1>
        <p className="body">Every camera in the stadium can be an angle.</p>
        <div className="col" role="radiogroup" aria-label="Camera source">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              disabled={!s.ready}
              className={`card ${s.accent} ${source === s.id ? "sel" : ""}`}
              style={{ display: "flex", gap: 14, alignItems: "center", textAlign: "left", opacity: s.ready ? 1 : 0.55 }}
              onClick={() => setSource(s.id)}
            >
              <span className="iconbtn"><Icon name={s.icon} /></span>
              <span className="grow"><b className="d4" style={{ fontSize: 24, display: "block" }}>{s.title}</b><span style={{ fontWeight: 600 }}>{s.sub}</span></span>
            </button>
          ))}
        </div>
        {error && <p role="alert" className="card o" style={{ padding: "12px 16px", borderRadius: 18, fontWeight: 600 }}>{error}</p>}
        <p className="small">Your section is attached to clips, never your GPS.</p>
        <button type="button" className="pill full big" onClick={openCamera}>Open camera</button>
      </main>
      <Nav />
    </>
  );
}

function ShareWith({ value: v, onChange: setV }: { value: string; onChange: (v: string) => void }) {
  const opts = [["community", "Match community"], ["me", "Only me"], ["security", "Security only"]];
  return (
    <div className="col" style={{ gap: 8 }} role="radiogroup" aria-label="Share with">
      {opts.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={v === id} onClick={() => setV(id)} className="card t" style={{ padding: "14px 16px", borderRadius: 18, textAlign: "left", fontWeight: 600, background: v === id ? "var(--ink)" : undefined, color: v === id ? "var(--paper)" : undefined }}>
          {label}
        </button>
      ))}
    </div>
  );
}
