"use client";

import { useRouter } from "next/navigation";
import type { Fixture } from "@inside/types";
import { Icon } from "@/components/Icon";
import { Loading, Problem, Scoreline, SourceNote, StatusTag, TeamLogo } from "@/components/LiveBits";
import { selectMatch, useApi } from "@/lib/live";
import type { MatchList } from "@inside/types";

export default function Matches() {
  const router = useRouter();
  const { data, error, loading } = useApi<MatchList>("/matches", true);

  const open = (f: Fixture) => {
    selectMatch(f.id);
    router.push("/live");
  };

  const row = (f: Fixture, featured = false) => (
    <button key={f.id} type="button" className={`card ${featured ? "o" : "t"}`} style={{ textAlign: "left", padding: featured ? 20 : "16px 20px" }} onClick={() => open(f)}>
      <div className="between"><StatusTag f={f} />{f.venue && <span className="lab" style={{ color: "var(--ink)" }}>{f.venue}</span>}</div>
      <div className="flex" style={{ marginTop: 12, gap: 12 }}>
        <TeamLogo src={f.home.logo} /><TeamLogo src={f.away.logo} />
      </div>
      <div style={{ marginTop: 6 }}><Scoreline f={f} size={featured ? "d3" : "h3"} /></div>
    </button>
  );

  return (
    <main className="scr no-nav enter">
      <h1 className="d2" style={{ margin: 0 }}>What are you watching?</h1>
      <div className="flex"><span className="tag">Roar League · Matchday 1</span></div>
      <SourceNote source={data?.source} />
      {loading && <Loading label="Loading fixtures…" />}
      {error && <Problem error={error} />}

      {data && data.live.length > 0 && <><div className="lab">Live now</div>{data.live.map((f) => row(f, true))}</>}
      {data && data.upcoming.length > 0 && <><div className="lab">Coming up</div>{data.upcoming.slice(0, 5).map((f) => row(f))}</>}
      {data && data.recent.length > 0 && <><div className="lab">Recent results</div>{data.recent.map((f) => row(f))}</>}
      {data && !data.live.length && !data.upcoming.length && !data.recent.length && <p className="body">No fixtures yet.</p>}

      <button type="button" className="card t" style={{ padding: "16px 20px", textAlign: "left" }} onClick={() => router.push("/live")}>
        <div className="between"><div><div className="h3">Watching from home</div><div className="small">Follow the match without capturing</div></div><Icon name="chev" /></div>
      </button>
    </main>
  );
}
