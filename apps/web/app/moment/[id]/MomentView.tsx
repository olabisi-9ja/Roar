"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { MatchDetail } from "@inside/types";
import { Icon } from "@/components/Icon";
import { Back } from "@/components/Bits";
import { Loading, Problem, SourceNote } from "@/components/LiveBits";
import { minuteText, momentOf, useApi } from "@/lib/live";

export function MomentView() {
  const { id } = useParams<{ id: string }>();
  // Event ids are "<fixtureId>-<index>".
  const fixtureId = id.slice(0, id.lastIndexOf("-"));
  const { data, error, loading } = useApi<MatchDetail>(`/matches/${fixtureId}`, true);
  const event = data?.events.find((e) => e.id === id);
  const f = data?.fixture;

  return (
    <main className="scr no-nav enter">
      <div className="between"><Back href="/live" />{event && f && <span className={`tag ${momentOf(event, f).accent}`}>{momentOf(event, f).label} · {minuteText(event)}</span>}</div>
      {loading && <Loading label="Loading moment…" />}
      {error && !data && <Problem error={error} />}
      {data && !event && <Problem error="This moment isn't available any more." />}

      {event && f && (() => {
        const m = momentOf(event, f);
        return (
          <>
            <div className="vid" style={{ height: 260, display: "flex", alignItems: "flex-end", padding: 16 }}>
              <span className="tag w">Fan angles appear here</span>
            </div>
            <h1 className="d2" style={{ margin: 0 }}>{m.title}</h1>
            <div className="card b" style={{ padding: 18 }}>
              <div className="flex"><Icon name="ai" size="s" /><span className="lab" style={{ color: "var(--ink)" }}>Official match event</span></div>
              <p style={{ marginTop: 8, fontSize: 18, lineHeight: 1.35, fontWeight: 600 }}>{m.summary}</p>
              <p className="small" style={{ color: "var(--ink)", marginTop: 6 }}>{f.home.name} {f.score ? `${f.score[0]}–${f.score[1]}` : ""} {f.away.name} · {minuteText(event)}</p>
            </div>
            <div className="card y">
              <div className="h3">Were you there?</div>
              <p style={{ fontWeight: 600, marginTop: 4 }}>Clips filmed within 10 seconds of {minuteText(event)} join this Moment as new angles.</p>
              <Link className="pill sm" href="/capture" style={{ marginTop: 12 }}><Icon name="upload" size="s" />Add your angle</Link>
            </div>
            <div className="flex mt-auto">
              <button type="button" className="pill grow"><Icon name="heart" size="s" />React</button>
              <button type="button" className="pill ghost grow"><Icon name="share" size="s" />Share</button>
            </div>
            <SourceNote source={data?.source} />
          </>
        );
      })()}
    </main>
  );
}
