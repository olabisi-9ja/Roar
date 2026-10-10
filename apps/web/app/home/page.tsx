"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { TopBar } from "@/components/Bits";
import { InstallBanner } from "@/components/Pwa";
import { Loading, Problem, SourceNote, StatusTag, TeamLogo } from "@/components/LiveBits";
import { me } from "@/lib/data";
import { kickoffText, minuteText, momentOf, scoreline, useCurrentMatch } from "@/lib/live";

export default function Home() {
  const { match, error, loading, empty } = useCurrentMatch();
  const f = match?.fixture;
  const latest = match ? [...match.events].reverse().slice(0, 4) : [];
  const lastGoal = match?.events.filter((e) => e.type === "Goal").at(-1);

  return (
    <>
      <main className="scr enter">
        <TopBar />
        <InstallBanner />
        <div className="between"><span className="lab">Section {me.section}{f?.venue ? ` · ${f.venue}` : ""}</span><Link className="lab" href="/matches" style={{ color: "var(--ink)" }}>Change match</Link></div>

        {loading && <Loading />}
        {error && !match && <Problem error={error} />}
        {empty && <p className="body">No Roar League fixtures right now.</p>}

        {f && (
          <Link className="card o" href={f.status === "SCHEDULED" ? "/stats" : "/live"} style={{ minHeight: 300 }}>
            <div className="between"><StatusTag f={f} /><span className="flex"><TeamLogo src={f.home.logo} size={32} /><TeamLogo src={f.away.logo} size={32} /></span></div>
            <div className="d3" style={{ marginTop: 12, maxWidth: 230 }}>{f.home.name} {scoreline(f)} {f.away.name}</div>
            <p style={{ marginTop: 6, fontWeight: 600, maxWidth: 210 }}>
              {f.status === "SCHEDULED" ? `Kicks off ${kickoffText(f.kickoff)}` : lastGoal ? `${lastGoal.player ?? "Goal"} scored at ${minuteText(lastGoal)}.` : f.statusText}
            </p>
            <div className="photo" style={{ position: "absolute", right: -6, bottom: 0, width: 170, height: 150, borderRadius: "18px 0 0 0" }}><span>Crowd cut-out</span></div>
            <i className="cf" style={{ left: 170, top: 70, background: "var(--yellow)", transform: "rotate(30deg)" }} />
            <span className="pill sm" style={{ position: "absolute", left: 20, bottom: 20 }}>{f.status === "LIVE" ? "Watch live" : f.status === "FINISHED" ? "Relive it" : "Match info"}</span>
          </Link>
        )}

        <div className="between"><h2 className="d4" style={{ margin: 0 }}>Play now</h2><Link className="lab" href="/play" style={{ color: "var(--ink)" }}>All games</Link></div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", margin: "0 -22px", padding: "0 22px" }}>
          <Link className="card y" href="/play/call-it" style={{ flex: "none", width: 170, height: 140, padding: 16 }}><span className="tag w">Live</span><div className="d4" style={{ marginTop: 10 }}>Call It</div><p className="small" style={{ color: "var(--ink)" }}>Predict the next goal</p></Link>
          <Link className="card g" href="/play/quiz" style={{ flex: "none", width: 170, height: 140, padding: 16 }}><span className="tag w">Quiz</span><div className="d4" style={{ marginTop: 10 }}>Match Quiz</div><p className="small" style={{ color: "var(--ink)" }}>Test what you saw</p></Link>
          <Link className="card b" href="/stats" style={{ flex: "none", width: 170, height: 140, padding: 16 }}><span className="tag w">Live</span><div className="d4" style={{ marginTop: 10 }}>Stats</div><p className="small" style={{ color: "var(--ink)" }}>Real match numbers</p></Link>
        </div>

        {f && (
          <>
            <h2 className="d4" style={{ margin: 0 }}>Latest moments</h2>
            {latest.length === 0 && <p className="body">No goals, cards or subs yet. Moments appear here as they happen.</p>}
            <div>
              {latest.map((e) => {
                const m = momentOf(e, f);
                return (
                  <div key={e.id} className="li">
                    <span className={`score ${m.accent}`}>{minuteText(e)}</span>
                    <span className="grow"><b className="h3" style={{ fontSize: 18 }}>{m.title}</b><span className="small" style={{ display: "block" }}>{m.summary}</span></span>
                    <Link className="iconbtn" href={`/moment/${e.id}`} aria-label={`Open ${m.title}`}><Icon name="chev" /></Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <SourceNote source={match?.source} />
      </main>
      <Nav />
    </>
  );
}
