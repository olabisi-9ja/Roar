import { Suspense } from "react";
import type { CuratedMoment, MatchList, MediaItem } from "@inside/types";
import { adminFetch, publicJson } from "@/lib/api";
import { publishMoment, rejectMedia, retryAnalysis, setMomentStatus, setPromoted } from "./actions";

export default function CuratePage(props: PageProps<"/curate">) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8">
      <header>
        <p className="label">For You feed</p>
        <h1 className="display mt-2 text-5xl">Feed curation</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">AI on Microsoft Foundry reads every fan clip and drafts a Moment. Check it, publish it, and it lands in every fan&apos;s feed.</p>
      </header>
      <Suspense fallback={<p className="label">Loading…</p>}>
        <Curate searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

const KINDS = [["CROWD", "Crowd moment"], ["CELEBRATION", "Celebration"], ["GOAL", "Goal"], ["PLAYER", "Player"], ["OTHER", "Fan moment"]] as const;
const KIND_TONE: Record<string, string> = { GOAL: "var(--yellow)", CELEBRATION: "var(--green)", CROWD: "var(--blue)", PLAYER: "var(--yellow)", FOUL: "var(--orange)", OTHER: "var(--blue)" };

function Preview({ media, className = "" }: { media: { id: string; type: "PHOTO" | "VIDEO" }; className?: string }) {
  const cls = `w-full bg-[var(--ink)] object-cover ${className}`;
  return media.type === "VIDEO"
    ? <video src={`/media/${media.id}`} autoPlay loop muted playsInline className={cls} />
    : <img src={`/media/${media.id}`} alt="Fan upload" className={cls} />;
}

function KindTag({ m }: { m: CuratedMoment }) {
  return (
    <span className="tag text-[var(--ink)]" style={{ background: KIND_TONE[m.kind] ?? "var(--blue)" }}>
      {m.kind.toLowerCase()}{m.minute ? ` · ${m.minute}'` : ""}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="flex items-center gap-3">
        <span className="display text-3xl">{title}</span>
        <span className="tag bg-[var(--panel-2)]">{count}</span>
      </h2>
      {children}
    </section>
  );
}

async function Curate({ searchParams }: { searchParams: PageProps<"/curate">["searchParams"] }) {
  const sp = await searchParams;
  const list = await publicJson<MatchList>("/matches");
  const fixtures = [...list.live, ...list.upcoming, ...list.recent];
  const matchId = typeof sp["match"] === "string" ? sp["match"] : fixtures[0]?.id;
  if (!matchId) return <p>No matches found.</p>;
  const [mediaRes, momentsRes] = await Promise.all([adminFetch(`/admin/media?matchId=${encodeURIComponent(matchId)}`), adminFetch(`/admin/moments?matchId=${encodeURIComponent(matchId)}`)]);
  if (mediaRes.status === 401) return <p className="panel p-4 font-bold text-[var(--orange)]">The API rejected the admin token. Check ADMIN_TOKEN in the repo .env and restart both apps.</p>;
  const { media } = (await mediaRes.json()) as { media: MediaItem[] };
  const { moments } = (await momentsRes.json()) as { moments: CuratedMoment[] };
  const used = new Set(moments.filter((m) => m.status !== "REMOVED").map((m) => m.media?.id));
  const queue = media.filter((m) => m.status === "PROCESSING" && !used.has(m.id));
  const drafts = moments.filter((m) => m.status === "PROCESSING");
  const live = moments.filter((m) => m.status === "PUBLISHED");
  const removed = moments.filter((m) => m.status === "REMOVED");

  return (
    <div className="grid gap-12">
      <form className="panel flex flex-wrap items-center gap-3 p-3" action="/curate">
        <label className="label pl-2" htmlFor="match">Match</label>
        <select id="match" name="match" defaultValue={matchId} className="field min-w-0 flex-1">
          {fixtures.map((f) => <option key={f.id} value={f.id}>{f.home.name} {f.score ? `${f.score[0]}–${f.score[1]}` : "v"} {f.away.name} ({f.status.toLowerCase()})</option>)}
        </select>
        <button className="btn btn-y">Open</button>
      </form>

      <Section title="Picked by AI" count={drafts.length}>
        {drafts.length === 0 && <p className="text-[var(--muted)]">No AI drafts waiting. New fan clips are analysed as they arrive.</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((m) => (
            <article key={m.id} className="panel overflow-hidden">
              <div className="relative">
                {m.media ? <Preview media={m.media} className="aspect-[4/5]" /> : <div className="aspect-[4/5] bg-[var(--ink)]" />}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <KindTag m={m} />
                  <span className="tag bg-white text-[var(--ink)]"><span className="dot" style={{ background: "var(--blue)" }} />AI draft</span>
                </div>
              </div>
              <div className="grid gap-3 p-5">
                <h3 className="display text-2xl leading-tight">{m.title}</h3>
                {m.description && <p className="text-sm text-[var(--muted)]">{m.description}</p>}
                <form className="flex gap-2">
                  <button formAction={setMomentStatus.bind(null, m.id, "PUBLISHED")} className="btn btn-y flex-1">Publish</button>
                  <button formAction={setMomentStatus.bind(null, m.id, "REMOVED")} className="btn btn-ghost">Discard</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Fan uploads waiting" count={queue.length}>
        {queue.length === 0 && <p className="text-[var(--muted)]">Nothing waiting. Clips fans share with the match community appear here.</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((m) => (
            <article key={m.id} className="panel overflow-hidden">
              <Preview media={m} className="aspect-[4/5]" />
              <form action={publishMoment} className="grid gap-2 p-4">
                <p className="label">
                  {m.type} · Section {m.section ?? "?"} · {new Date(m.uploadedAt).toLocaleTimeString()} · AI {m.aiStatus?.toLowerCase() ?? "queued"}
                </p>
                {m.aiError && <p className="text-xs font-semibold text-[var(--orange)]">AI: {m.aiError}</p>}
                {(m.aiStatus === "FAILED" || m.aiStatus === "SKIPPED") && (
                  <button formAction={retryAnalysis.bind(null, m.id)} className="btn btn-ghost">Retry AI analysis</button>
                )}
                <input type="hidden" name="matchId" value={matchId} />
                <input type="hidden" name="mediaId" value={m.id} />
                <label className="sr-only" htmlFor={`t-${m.id}`}>Title</label>
                <input id={`t-${m.id}`} name="title" required maxLength={80} placeholder="Title, e.g. The North Bank sings" className="field" />
                <label className="sr-only" htmlFor={`d-${m.id}`}>Description</label>
                <input id={`d-${m.id}`} name="description" maxLength={300} placeholder="One line on what's happening" className="field" />
                <div className="flex gap-2">
                  <select name="kind" aria-label="Type" className="field flex-1">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <input name="minute" type="number" min={1} max={130} placeholder="Min" aria-label="Match minute" className="field w-24" />
                </div>
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="promoted" className="h-4 w-4 accent-[#FEB703]" />Feature it (pin to top)</label>
                <div className="flex gap-2">
                  <button className="btn btn-y flex-1">Publish to For You</button>
                  <button formAction={rejectMedia.bind(null, m.id)} className="btn btn-o">Reject</button>
                </div>
              </form>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Live on the feed" count={live.length}>
        {live.length === 0 && <p className="text-[var(--muted)]">Nothing published for this match yet.</p>}
        <div className="grid gap-3">
          {live.map((m) => (
            <article key={m.id} className="panel flex flex-wrap items-center gap-4 p-3 pr-5">
              {m.media ? <Preview media={m.media} className="h-20 !w-16 flex-none rounded-2xl" /> : <div className="h-20 w-16 flex-none rounded-2xl bg-[var(--ink)]" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <KindTag m={m} />
                  <span className="tag bg-[var(--panel-2)]">{m.source === "ai" ? "Picked by AI" : "Editor"}</span>
                  {m.promoted && <span className="tag bg-[var(--yellow)] text-[var(--ink)]">Featured</span>}
                </div>
                <p className="mt-2 truncate text-lg font-bold">{m.title}</p>
              </div>
              <form className="flex gap-2">
                <button formAction={setPromoted.bind(null, m.id, !m.promoted)} className={`btn ${m.promoted ? "btn-ghost" : "btn-y"}`}>{m.promoted ? "Unfeature" : "Feature"}</button>
                <button formAction={setMomentStatus.bind(null, m.id, "REMOVED")} className="btn btn-o">Take down</button>
              </form>
            </article>
          ))}
        </div>
      </Section>

      {removed.length > 0 && (
        <details className="panel p-5">
          <summary className="label cursor-pointer">Taken down ({removed.length})</summary>
          <ul className="mt-4 grid gap-2">
            {removed.map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-[var(--muted)]">
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <form><button formAction={setMomentStatus.bind(null, m.id, "PUBLISHED")} className="btn btn-ghost">Restore</button></form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
