"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { me } from "@/lib/data";
import { useApi, useCurrentMatch } from "@/lib/live";
import { enqueue, upload } from "@/lib/uploads";

type Stage = "source" | "camera" | "preview" | "analysing" | "done";

const SOURCES: { id: string; title: string; sub: string; icon: IconName; accent: string; ready: boolean }[] = [
  { id: "phone", title: "Phone", sub: "Built-in camera", icon: "cam", accent: "o", ready: true },
  { id: "glasses", title: "Ray-Ban Meta", sub: "Needs the Roar glasses bridge app", icon: "glasses", accent: "y", ready: false },
  { id: "external", title: "External camera", sub: "USB or webcam on this device", icon: "ext", accent: "b", ready: true },
];

const STEPS = ["Clip uploaded", "AI is reading the frame", "Checking the match context"];

type AnalysisStatus = {
  id: string;
  status: string;
  audience: string;
  aiStatus: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
  aiError: string | null;
  analysis: { eventType: string; confidence: number; description: string; severity: string; safetyRelevant: boolean } | null;
  moment: { id: string; status: string; title: string } | null;
};

/** Grab a JPEG frame from a recorded clip so the video analyst has visual context. */
function makePoster(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let settled = false;
    let fallback = 0;
    const finish = (result: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const capture = () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const scale = Math.min(1, 1280 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((result) => finish(result), "image/jpeg", 0.82);
      } catch {
        finish(null);
      }
    };
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.25, Math.max(0, (Number.isFinite(video.duration) ? video.duration : 1) / 4));
      } catch {
        capture();
      }
    };
    video.onseeked = capture;
    video.onerror = () => finish(null);
    fallback = window.setTimeout(capture, 2500);
    video.src = url;
  });
}

export default function Capture() {
  const [stage, setStage] = useState<Stage>("source");
  const [source, setSource] = useState("phone");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState("");
  const [clip, setClip] = useState<Blob | null>(null);
  const [poster, setPoster] = useState<Blob | null>(null);
  const [audience, setAudience] = useState("community");
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const { match } = useCurrentMatch();
  const status = useApi<AnalysisStatus>(stage === "analysing" && uploadId ? `/media/${uploadId}/status` : null, true, 1500);
  const ai = status.data;
  const terminal = !!ai && ["SUCCEEDED", "FAILED", "SKIPPED"].includes(ai.aiStatus);
  const step = !ai || ai.aiStatus === "QUEUED" ? 0 : ai.aiStatus === "RUNNING" ? 1 : 2;
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
    setPoster(null);
    setUploadId(null);
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
      setPoster(null);
      void makePoster(blob).then(setPoster);
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
    const posterFrame = poster ?? (await makePoster(clip));
    if (posterFrame && !poster) setPoster(posterFrame);
    const item = {
      blob: clip,
      poster: posterFrame ?? undefined,
      filename: clip.type.includes("mp4") ? "clip.mp4" : "clip.webm",
      matchId: match.fixture.id,
      section: me.section,
      audience,
    };
    try {
      const result = await upload(item);
      if (!result) {
        // No signal in the stadium: keep the clip and send it when the network is back.
        await enqueue(item);
        setUploading(false);
        setStage("done");
        return;
      }
      setUploadId(result.id);
      setUploading(false);
      setStage("analysing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Your clip is still here, try again.");
      setUploading(false);
    }
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
        <div className="lab">Share with</div>
        <ShareWith value={audience} onChange={setAudience} />
        <p className="small">Private and security-only clips are never sent to AI or shown on the public feed.</p>
        {error && <p role="alert" className="card o" style={{ padding: "12px 16px", borderRadius: 18, fontWeight: 600 }}>{error}</p>}
        <button type="button" className="pill full big mt-auto" onClick={send} disabled={uploading}>
          <Icon name="upload" />{uploading ? "Uploading…" : `Send to Roar${match ? ` · ${match.fixture.home.short} v ${match.fixture.away.short}` : ""}`}
        </button>
      </main>
    );
  }

  if (stage === "analysing") {
    const message = !ai
      ? "Upload received. Waiting for AI analysis to start."
      : ai.aiStatus === "QUEUED" || ai.aiStatus === "RUNNING"
        ? "Analysis is running. Your clip is already saved; you can leave this screen."
        : ai.aiStatus === "FAILED"
          ? "AI analysis couldn't finish. Your clip is saved for moderator review."
          : ai.aiStatus === "SKIPPED"
            ? ai.audience !== "community"
              ? "This clip is private, so AI analysis is skipped. It won't appear on the public feed."
              : ai.aiError ?? "AI analysis is not enabled. Your clip is saved for moderator review."
            : ai.moment
              ? ai.moment.status === "PUBLISHED"
                ? `AI matched your clip to “${ai.moment.title}”. It's live.`
                : `AI matched your clip to “${ai.moment.title}”. It's waiting for a moderator.`
              : "AI couldn't confidently match this clip to a Moment. It's saved for moderator review.";
    return (
      <main className="scr no-nav enter">
        {clipUrl
          ? <video src={clipUrl} autoPlay muted loop playsInline style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 28, background: "var(--ink)" }} />
          : <div className="vid" style={{ height: 220 }} />}
        <h1 className="d2" style={{ margin: 0 }}>{terminal ? "Your clip is saved" : "AI is reading your moment"}</h1>
        <div className="prog"><i style={{ width: `${terminal ? 100 : ((step + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="col" style={{ gap: 10 }} aria-live="polite">
          {STEPS.map((s, n) => (
            <div key={s} className="card t flex" style={{ padding: "14px 16px", borderRadius: 20, opacity: n <= step ? 1 : 0.45 }}>
              <span className={`av ${n < step || terminal ? "g" : "b"}`} style={{ width: 34, height: 34 }}><Icon name={n < step || terminal ? "check" : "ai"} size="s" /></span>
              <span className="grow h3" style={{ fontSize: 18 }}>{s}</span>
            </div>
          ))}
        </div>
        {ai?.analysis && (
          <div className="card t" style={{ padding: "14px 16px", borderRadius: 20 }}>
            <b className="h3" style={{ fontSize: 18 }}>{ai.analysis.eventType.toLowerCase()} · {Math.round(ai.analysis.confidence * 100)}% confidence</b>
            <p className="small" style={{ margin: "6px 0 0" }}>{ai.analysis.description}</p>
          </div>
        )}
        <p className={`card ${terminal ? "g" : "t"}`} style={{ padding: "14px 16px", borderRadius: 18, fontWeight: 600 }}>{message}</p>
        {status.error && <p role="alert" className="small">Couldn&apos;t refresh the analysis status. Your clip is still saved.</p>}
        <div className="col mt-auto" style={{ width: "100%" }}>
          <Link className="pill full big" href="/live">Back to live</Link>
          {terminal && (
            <button
              type="button"
              className="pill full ghost"
              onClick={() => { setStage("source"); setClip(null); setClipUrl(""); setPoster(null); setUploadId(null); }}
            >
              Capture another
            </button>
          )}
        </div>
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
        <h1 className="d2" style={{ margin: 0 }}>Saved on your phone</h1>
        <p className="body">No signal right now. Your clip will upload when you&apos;re back online. AI analysis runs after the upload, so you can leave this screen.</p>
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
