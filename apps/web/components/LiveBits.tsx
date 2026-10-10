import type { Fixture, StatsSource } from "@inside/types";
import { clock, scoreline } from "@/lib/live";

export function SourceNote({ source }: { source?: StatsSource }) {
  if (!source) return null;
  return <p className="small">Roar League: synthetic, football-realistic match data. Fictional clubs and players.</p>;
}

export function Problem({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card o" style={{ padding: "14px 16px", borderRadius: 18 }}>
      <p style={{ fontWeight: 600 }}>{error}</p>
      {onRetry && <button type="button" className="pill sm" style={{ marginTop: 10 }} onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Loading({ label = "Loading the match…" }: { label?: string }) {
  return <p className="body" aria-live="polite">{label}</p>;
}

export function TeamLogo({ src, size = 28 }: { src: string | null; size?: number }) {
  if (!src) return null;
  return <img src={src} alt="" width={size} height={size} style={{ objectFit: "contain" }} />;
}

export function StatusTag({ f }: { f: Fixture }) {
  if (f.status === "LIVE") return <span className="tag">● Live {clock(f)}</span>;
  if (f.status === "FINISHED") return <span className="tag line">Full time</span>;
  return <span className="tag line">{clock(f)}</span>;
}

export function Scoreline({ f, size = "d3" }: { f: Fixture; size?: string }) {
  return <div className={size}>{f.home.name} {scoreline(f)} {f.away.name}</div>;
}
