import { Suspense } from "react";
import type { CuratedMoment, MatchList, MediaItem } from "@inside/types";
import { adminFetch, publicJson } from "@/lib/api";
import { publishMoment, rejectMedia, retryAnalysis, setMomentStatus, setPromoted } from "./actions";

export default function CuratePage(props: PageProps<"/curate">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 text-[#3A0648]">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight">Curate the For You feed</h1>
          <p className="mt-1 text-[rgba(58,6,72,0.72)]">Turn fan uploads into crowd and celebration moments. Featured moments are pinned to the top of every fan&apos;s feed.</p>
        </div>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <Curate searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

const KINDS = [["CROWD", "Crowd moment"], ["CELEBRATION", "Celebration"], ["GOAL", "Goal"], ["PLAYER", "Player"], ["OTHER", "Fan moment"]] as const;
const btn = "rounded-full px-4 py-2 text-sm font-bold";

async function Curate({ searchParams }: { searchParams: PageProps<"/curate">["searchParams"] }) {
  const sp = await searchParams;
  const list = await publicJson<MatchList>("/matches");
  const fixtures = [...list.live, ...list.upcoming, ...list.recent];
  const matchId = typeof sp["match"] === "string" ? sp["match"] : fixtures[0]?.id;
  if (!matchId) return <p>No matches found.</p>;

  const [mediaRes, momentsRes] = await Promise.all([adminFetch(`/admin/media?matchId=${encodeURIComponent(matchId)}`), adminFetch(`/admin/moments?matchId=${encodeURIComponent(matchId)}`)]);
  if (mediaRes.status === 401) return <p className="rounded-2xl bg-[#F15326] p-4 font-bold">The API rejected the admin token. Check ADMIN_TOKEN in the repo .env and restart both apps.</p>;
  const { media } = (await mediaRes.json()) as { media: MediaItem[] };
  const { moments } = (await momentsRes.json()) as { moments: CuratedMoment[] };
  const used = new Set(moments.filter((m) => m.status !== "REMOVED").map((m) => m.media?.id));
  const queue = media.filter((m) => m.status === "PROCESSING" && !used.has(m.id));

  return (
    <div className="grid gap-10">
      <form className="flex flex-wrap items-center gap-3" action="/curate">
        <label className="font-bold" htmlFor="match">Match</label>
        <select id="match" name="match" defaultValue={matchId} className="rounded-xl bg-[rgba(58,6,72,0.05)] px-3 py-2">
          {fixtures.map((f) => <option key={f.id} value={f.id}>{f.home.name} {f.score ? `${f.score[0]}–${f.score[1]}` : "v"} {f.away.name} ({f.status.toLowerCase()})</option>)}
        </select>
        <button className={`${btn} bg-[#3A0648] text-white`}>Open</button>
      </form>

      <section>
        <h2 className="mb-4 text-2xl font-extrabold uppercase">Fan uploads waiting ({queue.length})</h2>
        {queue.length === 0 && <p className="text-[rgba(58,6,72,0.72)]">Nothing waiting. Clips fans share with the match community appear here.</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-3xl bg-[rgba(58,6,72,0.05)]">
              {m.type === "VIDEO" ? (
                <video src={`/media/${m.id}`} controls muted playsInline className="aspect-[9/12] w-full bg-[#3A0648] object-cover" />
              ) : (
                <img src={`/media/${m.id}`} alt="Fan upload" className="aspect-[9/12] w-full bg-[#3A0648] object-cover" />
              )}
              <form action={publishMoment} className="grid gap-2 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[rgba(58,6,72,0.72)]">
                  {m.type} · Section {m.section ?? "?"} · {new Date(m.uploadedAt).toLocaleTimeString()} · AI {m.aiStatus?.toLowerCase() ?? "queued"}
                </p>
                {m.aiError && <p className="text-xs font-semibold text-[#F15326]">AI: {m.aiError}</p>}
                {(m.aiStatus === "FAILED" || m.aiStatus === "SKIPPED") && (
                  <button formAction={retryAnalysis.bind(null, m.id)} className={`${btn} bg-white text-left`}>Retry AI analysis</button>
                )}
                <input type="hidden" name="matchId" value={matchId} />
                <input type="hidden" name="mediaId" value={m.id} />
                <label className="sr-only" htmlFor={`t-${m.id}`}>Title</label>
                <input id={`t-${m.id}`} name="title" required maxLength={80} placeholder="Title, e.g. The North Bank sings" className="rounded-xl bg-white px-3 py-2" />
                <label className="sr-only" htmlFor={`d-${m.id}`}>Description</label>
                <input id={`d-${m.id}`} name="description" maxLength={300} placeholder="One line on what's happening" className="rounded-xl bg-white px-3 py-2" />
                <div className="flex gap-2">
                  <select name="kind" aria-label="Type" className="flex-1 rounded-xl bg-white px-3 py-2">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <input name="minute" type="number" min={1} max={130} placeholder="Min" aria-label="Match minute" className="w-20 rounded-xl bg-white px-3 py-2" />
                </div>
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="promoted" className="h-4 w-4 accent-[#FEB703]" />Feature it (pin to top)</label>
                <div className="flex gap-2">
                  <button className={`${btn} flex-1 bg-[#3A0648] text-white`}>Publish to For You</button>
                  <button formAction={rejectMedia.bind(null, m.id)} className={`${btn} bg-[#F15326] text-[#3A0648]`}>Reject</button>
                </div>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-extrabold uppercase">On the feed ({moments.filter((m) => m.status === "PUBLISHED").length})</h2>
        <ul className="grid gap-3">
          {moments.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center gap-4 rounded-2xl p-4 ${m.status === "REMOVED" ? "bg-[rgba(58,6,72,0.05)] opacity-60" : "bg-[rgba(58,6,72,0.05)]"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{m.title} {m.promoted && <span className="ml-2 rounded-full bg-[#FEB703] px-2 py-0.5 text-xs uppercase">Featured</span>}</p>
                <p className="text-sm text-[rgba(58,6,72,0.72)]">{m.kind.toLowerCase()} · {m.minute ? `${m.minute}' · ` : ""}{m.source === "ai" ? "picked by AI" : "editor"} · {m.status.toLowerCase()}</p>
              </div>
              {m.status === "PUBLISHED" && (
                <form className="flex gap-2">
                  <button formAction={setPromoted.bind(null, m.id, !m.promoted)} className={`${btn} ${m.promoted ? "bg-white" : "bg-[#FEB703]"}`}>{m.promoted ? "Unfeature" : "Feature"}</button>
                  <button formAction={setMomentStatus.bind(null, m.id, "REMOVED")} className={`${btn} bg-[#F15326]`}>Take down</button>
                </form>
              )}
              {m.status === "PROCESSING" && (
                <form className="flex gap-2">
                  {m.media && <a href={`/media/${m.media.id}`} target="_blank" className={`${btn} bg-white`}>View clip</a>}
                  <button formAction={setMomentStatus.bind(null, m.id, "PUBLISHED")} className={`${btn} bg-[#FEB703]`}>Publish</button>
                  <button formAction={setMomentStatus.bind(null, m.id, "REMOVED")} className={`${btn} bg-[#F15326]`}>Discard</button>
                </form>
              )}
              {m.status === "REMOVED" && (
                <form><button formAction={setMomentStatus.bind(null, m.id, "PUBLISHED")} className={`${btn} bg-white`}>Restore</button></form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
