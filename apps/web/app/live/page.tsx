"use client";

import Link from "next/link";
import type { CuratedMoment, Fixture, MatchEvent } from "@inside/types";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { MenuButton } from "@/components/Menu";
import { CallItCard } from "@/components/CallIt";
import { kickoffText, minuteText, momentOf, scoreline, useApi, useCurrentMatch } from "@/lib/live";
import { rankFeed } from "@/lib/feed";

const KIND_LABEL: Record<string, [string, string]> = {
  CROWD: ["Crowd moment", "b"],
  CELEBRATION: ["Celebration", "g"],
  GOAL: ["Goal", "y"],
  PLAYER: ["Player", "y"],
  FOUL: ["Foul", "o"],
  OTHER: ["Fan moment", "b"],
};

function Header({ f }: { f: Fixture }) {
  return (
    <div className="between" style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "max(16px, env(safe-area-inset-top)) 16px 0", zIndex: 3 }}>
      <Link href="/home" className="chip" aria-label="Open match centre">
        {f.status === "LIVE" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />}
        {f.home.short} {scoreline(f)} {f.away.short}{f.status === "LIVE" && f.minute !== null ? ` · ${f.minute}'` : f.status === "FINISHED" ? " · FT" : ""}
      </Link>
      <div className="flex"><Link className="pill sm o" href="/sos">SOS</Link><MenuButton light /></div>
    </div>
  );
}

function Rail() {
  return (
    <div style={{ position: "absolute", right: 16, bottom: 250, display: "flex", flexDirection: "column", gap: 16, zIndex: 2 }}>
      <button className="iconbtn" type="button" aria-label="React"><Icon name="heart" /></button>
      <button className="iconbtn" type="button" aria-label="Share"><Icon name="share" /></button>
      <Link className="iconbtn" href="/capture" aria-label="Add your angle"><Icon name="cam" /></Link>
    </div>
  );
}

function CuratedSlide({ m }: { m: CuratedMoment }) {
  const [label, accent] = KIND_LABEL[m.kind] ?? KIND_LABEL["OTHER"]!;
  return (
    <>
      {m.media?.type === "VIDEO" ? (
        <video className="media" src={m.media.url} autoPlay muted loop playsInline aria-label={m.title} />
      ) : m.media ? (
        <img className="media" src={m.media.url} alt={m.title} />
      ) : (
        <div className="vid" />
      )}
      <div className="scrim" />
      <div style={{ position: "absolute", left: 18, right: 80, bottom: 120, color: "var(--paper)", zIndex: 2 }}>
        <div className="flex" style={{ flexWrap: "wrap" }}>
          <span className={`tag ${accent}`}>{label}{m.minute !== null ? ` · ${m.minute}'` : ""}</span>
          {m.source === "ai" ? <span className="tag w"><Icon name="ai" size="s" style={{ color: "var(--blue)" }} />Picked by AI</span> : <span className="tag w">Picked by Roar</span>}
          {m.promoted && <span className="tag y">Featured</span>}
        </div>
        <div className="d2" style={{ marginTop: 10 }}>{m.title}</div>
        {m.description && <p style={{ marginTop: 8, fontSize: 15 }}>{m.description}</p>}
      </div>
    </>
  );
}

function EventSlide({ e, f, angle }: { e: MatchEvent; f: Fixture; angle?: CuratedMoment }) {
  const m = momentOf(e, f);
  return (
    <>
      {angle?.media ? (
        <>
          {angle.media.type === "VIDEO"
            ? <video className="media" src={angle.media.url} autoPlay muted loop playsInline aria-label={angle.title} />
            : <img className="media" src={angle.media.url} alt={angle.title} />}
          <div className="scrim" />
        </>
      ) : (
        <div className="vid"><span className="evmark" aria-hidden="true">{minuteText(e)}</span></div>
      )}
      <Link href={`/moment/${e.id}`} style={{ position: "absolute", left: 18, right: 80, bottom: 120, color: "var(--paper)", zIndex: 2 }}>
        <div className="flex" style={{ flexWrap: "wrap" }}>
          <span className={`tag ${m.accent}`}>{m.label} · {minuteText(e)}</span>
          {angle && <span className="tag w"><Icon name="cam" size="s" />Fan angle</span>}
        </div>
        <div className="d2" style={{ marginTop: 10 }}>{m.title}</div>
        <p style={{ marginTop: 8, fontSize: 15 }}>{angle ? angle.title : m.summary}</p>
        <p className="lab" style={{ marginTop: 8, color: "var(--paper)" }}>Tap for details · swipe up for more</p>
      </Link>
    </>
  );
}

export default function ForYou() {
  const { match, error, loading } = useCurrentMatch();
  const f = match?.fixture;
  const curated = useApi<{ moments: CuratedMoment[] }>(f ? `/matches/${f.id}/moments` : null, true);
  const items = match ? rankFeed(match.events, curated.data?.moments ?? []) : [];

  return (
    <>
      <main className="feed" aria-label="For You">
        {items.length === 0 && (
          <section>
            <div className="vid" />
            {f && <Header f={f} />}
            <div style={{ position: "absolute", left: 18, right: 18, bottom: 140, color: "var(--paper)" }}>
              <div className="d2">{loading ? "Loading…" : error && !f ? "Can't reach live data" : "No moments yet"}</div>
              <p style={{ marginTop: 8 }}>
                {error && !f ? error : f?.status === "SCHEDULED" ? `Kick-off ${kickoffText(f.kickoff)}. Goals, crowd moments and celebrations appear here.` : "Goals, crowd moments and celebrations appear here as they happen."}
              </p>
              <Link className="pill w" href="/capture" style={{ marginTop: 16 }}><Icon name="cam" size="s" />Capture from your seat</Link>
            </div>
          </section>
        )}

        {f && items.map((item, i) => (
          <section key={item.kind === "event" ? item.e.id : item.m.id} aria-label={item.kind === "event" ? momentOf(item.e, f).title : item.m.title}>
            {item.kind === "event" ? <EventSlide e={item.e} f={f} angle={item.angle} /> : <CuratedSlide m={item.m} />}
            <Header f={f} />
            {i === 0 && f.status === "LIVE" && <div style={{ position: "absolute", top: 64, left: 0, right: 0, zIndex: 3 }}><CallItCard fixture={f} /></div>}
            <Rail />
          </section>
        ))}
      </main>
      <Nav />
    </>
  );
}
