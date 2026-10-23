"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Back } from "@/components/Bits";
import { Loading, Problem, SourceNote } from "@/components/LiveBits";
import { useApi, useCurrentMatch } from "@/lib/live";
import { langQuery, speak, stopSpeaking, useLang } from "@/lib/lang";

type Segment = {
  id: string;
  minute: number | null;
  kind: string;
  official: boolean;
  seconds: number;
  line: string;
  media: { id: string; url: string; type: "PHOTO" | "VIDEO" } | null;
};
type Recap = { length: number; headline: string; score: string; source: "ai" | "rules"; segments: Segment[] };

const LENGTHS = [15, 30, 60] as const;
const ACCENT: Record<string, string> = { GOAL: "y", CELEBRATION: "g", CROWD: "b", PLAYER: "y", FOUL: "o", OTHER: "b" };

/** Highlight recap: the best fan angles and goals, cut to 15/30/60 seconds, narrated in the fan's language. */
export default function RecapPage() {
  const { match, error: matchError } = useCurrentMatch();
  const lang = useLang();
  const [length, setLength] = useState<(typeof LENGTHS)[number]>(30);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const id = match?.fixture.id;
  const { data, error, loading } = useApi<Recap>(id ? `/matches/${id}/recap?length=${length}${langQuery(lang, "&")}` : null);
  // Past the last segment the recap has ended; no extra state needed.
  const seg = playing ? data?.segments[index] : undefined;

  // Advance segment by segment; narration starts with each one.
  useEffect(() => {
    const s = playing ? data?.segments[index] : undefined;
    if (!s) return;
    stopSpeaking();
    if (!muted) speak(s.line, lang);
    const t = setTimeout(() => setIndex((i) => i + 1), s.seconds * 1000);
    return () => clearTimeout(t);
  }, [playing, index, data, lang, muted]);

  useEffect(() => () => stopSpeaking(), []);

  const play = () => {
    setIndex(0);
    setPlaying(true);
  };
  const stop = () => {
    stopSpeaking();
    setPlaying(false);
  };

  if (seg && data) {
    return (
      <main className="feed" aria-label="Recap" style={{ height: "100dvh" }}>
        <section>
          {seg.media?.type === "VIDEO" ? (
            <video key={seg.id} className="media" src={seg.media.url} autoPlay muted loop playsInline />
          ) : seg.media ? (
            <img key={seg.id} className="media" src={seg.media.url} alt="" />
          ) : (
            <div className="vid" style={{ position: "absolute", inset: 0, borderRadius: 0, display: "grid", placeItems: "center" }}>
              <div className="d1" style={{ color: "var(--yellow)" }}>{seg.minute ?? ""}{seg.minute !== null ? "'" : ""}</div>
            </div>
          )}
          <div className="scrim" />
          <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", left: 16, right: 16, zIndex: 3 }}>
            <div className="flex" style={{ gap: 4 }} aria-hidden="true">
              {data.segments.map((s, i) => (
                <div key={s.id} style={{ flex: s.seconds, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--paper)", width: i < index ? "100%" : i > index ? "0%" : undefined, animation: i === index ? `recapFill ${s.seconds}s linear forwards` : undefined }} />
                </div>
              ))}
            </div>
            <div className="between" style={{ marginTop: 12 }}>
              <span className="chip">{data.score}</span>
              <div className="flex">
                <button type="button" className="iconbtn" aria-label={muted ? "Turn narration on" : "Mute narration"} aria-pressed={muted} onClick={() => { setMuted(!muted); stopSpeaking(); }}>
                  <Icon name={muted ? "mute" : "sound"} />
                </button>
                <button type="button" className="iconbtn" aria-label="Close recap" onClick={stop}><Icon name="x" /></button>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 18, right: 18, bottom: 60, color: "var(--paper)", zIndex: 2 }} aria-live="polite">
            <span className={`tag ${ACCENT[seg.kind] ?? "b"}`}>{seg.official ? "Official" : "From the stands"}{seg.minute !== null ? ` · ${seg.minute}'` : ""}</span>
            <div className="d2" style={{ marginTop: 10 }}>{seg.line}</div>
          </div>
        </section>
        <style>{`@keyframes recapFill { from { width: 0% } to { width: 100% } }`}</style>
      </main>
    );
  }

  return (
    <main className="scr no-nav enter">
      <div className="between"><Back href="/home" /><span className="tag b"><Icon name="ai" size="s" />AI recap</span></div>
      <h1 className="d2" style={{ margin: 0 }}>{data?.headline ?? "Match recap"}</h1>
      <p className="body">The best fan angles and goals, cut to length and narrated in your language. Change language from the menu.</p>
      <div className="grid3" role="group" aria-label="Recap length">
        {LENGTHS.map((l) => (
          <button key={l} type="button" className={`card ${length === l ? "y sel" : "t"}`} aria-pressed={length === l} onClick={() => setLength(l)} style={{ padding: 14, textAlign: "center" }}>
            <div className="d3">{l}s</div>
          </button>
        ))}
      </div>
      {matchError && !match && <Problem error={matchError} />}
      {loading && id && <Loading label="Cutting the recap…" />}
      {error && !data && <Problem error={error} />}
      {data && data.segments.length === 0 && <p className="body">Nothing to recap yet. Goals and published fan Moments appear here.</p>}
      {data && data.segments.length > 0 && (
        <>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {data.segments.map((s) => (
              <li key={s.id} className="li">
                <span className={`score ${ACCENT[s.kind] ?? "b"}`}>{s.minute !== null ? `${s.minute}'` : "–"}</span>
                <span className="grow" style={{ fontWeight: 600 }}>{s.line}</span>
                <span className="small">{s.seconds}s</span>
              </li>
            ))}
          </ol>
          <button type="button" className="pill big full" onClick={play}><Icon name="go" />Play {data.length}s recap</button>
          {data.source === "ai" && <p className="small">Narration written by Roar&apos;s Recap Writer agent.</p>}
        </>
      )}
      <SourceNote source={match?.source} />
    </main>
  );
}
