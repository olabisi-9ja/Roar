import React from "react";
import {
  AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";

const ANTON = "Anton";
const BARLOW = "Barlow Condensed";
loadFont({ family: ANTON, url: staticFile("fonts/anton-latin-400-normal.woff2"), weight: "400" });
loadFont({ family: BARLOW, url: staticFile("fonts/barlow-condensed-latin-600-normal.woff2"), weight: "600" });
loadFont({ family: BARLOW, url: staticFile("fonts/barlow-condensed-latin-800-normal.woff2"), weight: "800" });

export const AD_FRAMES = 2400; // 80 s at 30 fps
const s = (sec: number) => Math.round(sec * 30);
const GOLD = "#FEB703";
const INK = "#3A0648";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ---------- looks ---------- */

type Grade = "bw" | "color" | "night" | "warm";
const FILTER: Record<Grade, string> = {
  bw: "grayscale(1) contrast(1.25) brightness(0.92)",
  color: "contrast(1.12) saturate(1.15)",
  night: "contrast(1.2) saturate(0.55) brightness(0.8) hue-rotate(-8deg)",
  warm: "contrast(1.08) saturate(1.1) sepia(0.12)",
};

/** A stock shot: slow push-in, graded, cropped to fill. */
const Shot: React.FC<{ src: string; grade?: Grade; from?: number; rate?: number; zoom?: [number, number]; origin?: string; blur?: number }> = ({
  src, grade = "color", from = 0, rate = 1, zoom = [1.02, 1.1], origin = "50% 50%", blur = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], zoom, clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={from}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: origin, filter: `${FILTER[grade]}${blur ? ` blur(${blur}px)` : ""}` }}
      />
    </AbsoluteFill>
  );
};

const Fade: React.FC<{ inF?: number; outF?: number; children: React.ReactNode }> = ({ inF = 0, outF = 0, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = Math.min(inF ? interpolate(frame, [0, inF], [0, 1], clamp) : 1, outF ? interpolate(frame, [durationInFrames - outF, durationInFrames], [1, 0], clamp) : 1);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.22 }}>
      <svg width="100%" height="100%">
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 12} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
);

const Letterbox: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, background: "#000" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: "#000" }} />
  </>
);

const Flash: React.FC<{ len?: number }> = ({ len = 8 }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, len], [0.9, 0], clamp) }} />;
};

/* ---------- the "eyes": a gold trail leaves each lens ---------- */

const Trail: React.FC<{ x: number; y: number; to?: [number, number]; delay?: number }> = ({ x, y, to = [1980, 300], delay = 10 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const len = 2600;
  const d = `M ${x} ${y} C ${x + 300} ${y - 120}, ${to[0] - 500} ${to[1] + 200}, ${to[0]} ${to[1]}`;
  const dot = interpolate(frame - delay, [0, 6, 30], [0, 1, 0.6], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080}>
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={d} stroke={GOLD} strokeWidth={4} fill="none" filter="url(#glow)" strokeDasharray={len} strokeDashoffset={len * (1 - p)} strokeLinecap="round" />
        <circle cx={x} cy={y} r={10 + 8 * dot} fill={GOLD} opacity={dot} filter="url(#glow)" />
      </svg>
    </AbsoluteFill>
  );
};

const RecDot: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label = "REC" }) => {
  const frame = useCurrentFrame();
  const on = Math.floor(frame / 12) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 10, fontFamily: BARLOW, fontWeight: 800, fontSize: 30, color: "#fff", letterSpacing: 3, textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, background: "#F15326", opacity: on ? 1 : 0.25 }} />{label}
    </div>
  );
};

/* ---------- devices ---------- */

const PHONE_H = 920;
const PHONE_W = Math.round((PHONE_H * 780) / 1688);

type Seg = { from: number; dur: number; rate?: number }; // from: seconds into the recording; dur: frames on screen

/** Real app recording in a phone, cut from several segments of one take. */
const Phone: React.FC<{ src: string; segs: Seg[]; x?: number; tilt?: number }> = ({ src, segs, x = 960, tilt = 0 }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 18], [60, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  let at = 0;
  return (
    <div style={{ position: "absolute", left: x - PHONE_W / 2 - 14, top: 540 - PHONE_H / 2 - 14 + enter, width: PHONE_W + 28, height: PHONE_H + 28, borderRadius: 64, background: "#0b0b0f", boxShadow: "0 40px 120px rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,.12) inset", transform: `rotate(${tilt}deg)`, opacity: interpolate(frame, [0, 10], [0, 1], clamp) }}>
      <div style={{ position: "absolute", left: 14, top: 14, width: PHONE_W, height: PHONE_H, borderRadius: 50, overflow: "hidden", background: "#fff" }}>
        {segs.map((sg, i) => {
          const start = at;
          at += sg.dur;
          return (
            <Sequence key={i} from={start} durationInFrames={sg.dur} layout="none">
              <OffthreadVideo src={staticFile(src)} startFrom={s(sg.from)} playbackRate={sg.rate ?? 1} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            </Sequence>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: "50%", top: 26, width: 110, height: 30, marginLeft: -55, borderRadius: 20, background: "#0b0b0f" }} />
    </div>
  );
};

/** Real admin recording in a floating window, pushing in on a region. */
const Console: React.FC<{ src: string; from: number; rate?: number; zoom: [number, number]; origin: string }> = ({ src, from, rate = 1, zoom, origin }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], zoom, { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const enter = interpolate(frame, [0, 20], [0.94, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1600, height: 900, borderRadius: 22, overflow: "hidden", boxShadow: "0 50px 140px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.12)", transform: `scale(${enter})`, background: "#12021A" }}>
        <OffthreadVideo src={staticFile(src)} startFrom={s(from)} playbackRate={rate} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: origin }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- scenes ---------- */

const Eye: React.FC<{ src: string; x: number; y: number; rec?: [number, number]; grade?: Grade; zoom?: [number, number]; origin?: string }> = ({ src, x, y, rec, grade = "bw", zoom = [1.06, 1.14], origin }) => (
  <AbsoluteFill>
    <Shot src={src} grade={grade} zoom={zoom} origin={origin} />
    <Trail x={x} y={y} />
    {rec && <RecDot x={rec[0]} y={rec[1]} />}
  </AbsoluteFill>
);

const Split: React.FC = () => {
  const frame = useCurrentFrame();
  const tiles: [string, Grade][] = [["clips/crowd.mp4", "color"], ["clips/confetti.mp4", "color"], ["clips/phonerec.mp4", "color"], ["clips/arena.mp4", "color"]];
  const gap = interpolate(frame, [0, 14], [0, 10], clamp);
  const pull = interpolate(frame, [80, 120], [1, 0.0], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap, transform: `scale(${0.6 + 0.4 * pull})`, opacity: 0.25 + 0.75 * pull }}>
        {tiles.map(([src, g], i) => (
          <div key={i} style={{ position: "relative", overflow: "hidden" }}>
            <Sequence from={i * 4} layout="none"><Shot src={src} grade={g} from={s(1 + i)} /></Sequence>
          </div>
        ))}
      </div>
      {[[480, 270], [1440, 270], [480, 810], [1440, 810]].map(([x, y], i) => (
        <Trail key={i} x={x} y={y} to={[960, 540]} delay={50} />
      ))}
    </AbsoluteFill>
  );
};

const PhoneOver: React.FC<{ bg: string; bgGrade?: Grade; bgFrom?: number; children: React.ReactNode }> = ({ bg, bgGrade = "color", bgFrom = 0, children }) => (
  <AbsoluteFill>
    <Shot src={bg} grade={bgGrade} from={bgFrom} blur={14} zoom={[1.15, 1.2]} />
    <AbsoluteFill style={{ background: "rgba(10,2,16,0.35)" }} />
    {children}
  </AbsoluteFill>
);

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const bars: [string, number][] = [["#F15326", 0.63], ["#FEB703", 1], ["#82BA03", 0.8], ["#00A6ED", 0.49]];
  const logoIn = interpolate(frame, [0, 24], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const word = interpolate(frame, [18, 40], [0, 1], clamp);
  const line = interpolate(frame, [50, 72], [0, 1], clamp);
  const built = interpolate(frame, [95, 120], [0, 1], clamp);
  const out = interpolate(frame, [215, 240], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#12021A", alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ display: "flex", alignItems: "center", gap: 46, transform: `scale(${0.9 + 0.1 * logoIn})` }}>
        <div style={{ width: 210, height: 210, borderRadius: 54, background: INK, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, opacity: logoIn, boxShadow: "0 0 120px rgba(254,183,3,.25)" }}>
          {bars.map(([c, h], i) => {
            const pulse = 0.75 + 0.25 * Math.sin((frame + i * 9) / 7);
            return <div key={i} style={{ width: 26, height: 128 * h * (frame < 40 ? logoIn : pulse), borderRadius: 13, background: c }} />;
          })}
        </div>
        <div style={{ fontFamily: ANTON, fontSize: 230, color: "#fff", lineHeight: 1, opacity: word, transform: `translateX(${(1 - word) * 30}px)` }}>ROAR</div>
      </div>
      <div style={{ marginTop: 50, fontFamily: BARLOW, fontWeight: 800, fontSize: 64, color: GOLD, letterSpacing: 2, opacity: line, transform: `translateY(${(1 - line) * 16}px)` }}>EVERY FAN IS A CAMERA.</div>
      <div style={{ marginTop: 70, fontFamily: BARLOW, fontWeight: 600, fontSize: 30, color: "rgba(255,255,255,.7)", letterSpacing: 6, opacity: built }}>BUILT ON MICROSOFT FOUNDRY · AZURE</div>
    </AbsoluteFill>
  );
};

/* ---------- timeline ---------- */

const T = {
  aerial: [0, 150], glasses: [150, 60], phonerec: [210, 60], broadcast: [270, 60], phonedark: [330, 60], penalty: [390, 60],
  crowd: [450, 90], split: [540, 120], capture: [660, 240], admin: [900, 120], bus: [1020, 90], feed: [1110, 180], manphone: [1290, 150],
  arena: [1440, 90], sos: [1530, 180], incident: [1710, 90], police: [1800, 30], lights: [1830, 30],
  homefan: [1860, 120], family: [1980, 90], crowdwide: [2070, 90], end: [2160, 240],
} as const;

const At: React.FC<{ k: keyof typeof T; children: React.ReactNode }> = ({ k, children }) => (
  <Sequence from={T[k][0]} durationInFrames={T[k][1]}>{children}</Sequence>
);

export const Ad: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = (pts: number[], vals: number[]) => (f: number) => interpolate(f, pts, vals, clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 0–15 s: the stadium waits; every lens is an eye */}
      <At k="aerial"><Fade inF={30}><Shot src="clips/aerial.mp4" grade="bw" zoom={[1.0, 1.12]} /></Fade></At>
      <At k="glasses"><Eye src="clips/glasses.mp4" x={690} y={470} rec={[120, 110]} /></At>
      <At k="phonerec"><Eye src="clips/phonerec.mp4" x={900} y={330} /></At>
      <At k="broadcast"><Eye src="clips/broadcast.mp4" x={670} y={340} zoom={[2.2, 2.3]} origin="92% 40%" /></At>
      <At k="phonedark"><Eye src="clips/phonedark.mp4" x={1030} y={420} /></At>
      <At k="penalty"><Shot src="clips/penalty.mp4" grade="bw" zoom={[1.05, 1.25]} /></At>

      {/* 15 s: goal. Colour floods in. */}
      <At k="crowd"><Shot src="clips/crowd.mp4" grade="color" zoom={[1.15, 1.02]} /><Flash /></At>
      <At k="split"><Split /></At>

      {/* 22–34 s: the real product */}
      <At k="capture">
        <PhoneOver bg="clips/crowd.mp4" bgFrom={s(3)}>
          <Phone src="app/cap_crowd.mp4" segs={[{ from: 0.3, dur: 105 }, { from: 9.5, dur: 45 }, { from: 21.6, dur: 90 }]} />
        </PhoneOver>
      </At>
      <At k="admin">
        <PhoneOver bg="clips/arena.mp4" bgGrade="night">
          <Console src="app/adm_curate.mp4" from={0.4} zoom={[1.0, 1.45]} origin="28% 40%" />
        </PhoneOver>
      </At>

      {/* 34–48 s: fans who couldn't be there */}
      <At k="bus"><Shot src="clips/bus.mp4" grade="warm" zoom={[1.05, 1.15]} origin="45% 60%" /></At>
      <At k="feed">
        <PhoneOver bg="clips/busbg.mp4" bgGrade="warm">
          <Phone src="app/feed.mp4" segs={[{ from: 0, dur: 180 }]} />
        </PhoneOver>
      </At>
      <At k="manphone"><Fade outF={15}><Shot src="clips/manphone.mp4" grade="warm" zoom={[1.04, 1.12]} /></Fade></At>

      {/* 48–62 s: someone needs help */}
      <At k="arena"><Fade inF={20}><Shot src="clips/arena.mp4" grade="night" rate={0.6} from={s(2)} zoom={[1.1, 1.2]} /></Fade></At>
      <At k="sos">
        <PhoneOver bg="clips/arena.mp4" bgGrade="night" bgFrom={s(4)}>
          <Phone src="app/sos.mp4" segs={[{ from: 0.6, dur: 75, rate: 1.4 }, { from: 4.2, dur: 60, rate: 2.2 }, { from: 10.6, dur: 45 }]} />
        </PhoneOver>
      </At>
      <At k="incident">
        <PhoneOver bg="clips/lights.mp4" bgGrade="night">
          <Console src="app/adm_inc.mp4" from={0.2} zoom={[1.0, 1.35]} origin="62% 55%" />
        </PhoneOver>
      </At>
      <At k="police"><Shot src="clips/police.mp4" grade="night" zoom={[1.1, 1.18]} /></At>
      <At k="lights"><Shot src="clips/lights.mp4" grade="night" zoom={[1.0, 1.1]} /></At>

      {/* 62–72 s: release */}
      <At k="homefan"><Shot src="clips/homefan.mp4" grade="warm" zoom={[1.05, 1.12]} /><Flash len={6} /></At>
      <At k="family"><Shot src="clips/family.mp4" grade="warm" zoom={[1.04, 1.1]} /></At>
      <At k="crowdwide"><Fade outF={12}><Shot src="clips/crowdwide.mp4" grade="color" zoom={[1.02, 1.12]} /></Fade></At>

      {frame < T.end[0] && (<><Vignette /><Grain /><Letterbox /></>)}
      <At k="end"><EndCard /></At>

      {/* ---------- sound ---------- */}
      <Sequence from={0} durationInFrames={1440}>
        <Audio src={staticFile("audio/music.mp3")} startFrom={s(57.5)} volume={vol([0, 60, 1380, 1440], [0, 0.85, 0.85, 0])} />
      </Sequence>
      <Sequence from={1860} durationInFrames={540}>
        <Audio src={staticFile("audio/music.mp3")} startFrom={s(72.5)} volume={vol([0, 6, 420, 540], [0.4, 0.9, 0.9, 0])} />
      </Sequence>
      <Sequence from={0} durationInFrames={455}><Audio src={staticFile("audio/sfx_2111.mp3")} loop volume={vol([0, 45, 380, 455], [0, 0.35, 0.5, 0.2])} /></Sequence>
      <Sequence from={442}><Audio src={staticFile("audio/sfx_2918.mp3")} volume={0.55} /></Sequence>
      <Sequence from={450} durationInFrames={300}><Audio src={staticFile("audio/sfx_462.mp3")} volume={vol([0, 200, 300], [0.75, 0.5, 0])} /></Sequence>
      <Sequence from={470} durationInFrames={190}><Audio src={staticFile("audio/sfx_3022.mp3")} volume={vol([0, 150, 190], [0.35, 0.3, 0])} /></Sequence>
      {[655, 1015, 1525, 1705].map((f) => <Sequence key={f} from={f}><Audio src={staticFile("audio/sfx_1492.mp3")} volume={0.35} /></Sequence>)}
      <Sequence from={1420} durationInFrames={450}><Audio src={staticFile("audio/sfx_494.mp3")} volume={vol([0, 30, 400, 450], [0, 0.95, 0.95, 0])} /></Sequence>
      <Sequence from={1852}><Audio src={staticFile("audio/sfx_2918.mp3")} volume={0.5} /></Sequence>
      <Sequence from={1860} durationInFrames={300}><Audio src={staticFile("audio/sfx_363.mp3")} volume={vol([0, 240, 300], [0.4, 0.35, 0])} /></Sequence>
      <Sequence from={2140}><Audio src={staticFile("audio/sfx_614.mp3")} volume={0.6} /></Sequence>
    </AbsoluteFill>
  );
};
