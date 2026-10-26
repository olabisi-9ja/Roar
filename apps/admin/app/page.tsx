import Link from "next/link";
import { Suspense } from "react";
import type { CuratedMoment, Fixture, MatchList, MediaItem } from "@inside/types";
import { adminFetch, publicJson } from "@/lib/api";

type IncidentLite = { id: string; severity: string; status: string; type: string; section: string | null; createdAt: string };

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8">
      <header>
        <p className="label">Matchday operations</p>
        <h1 className="display mt-2 text-5xl">Overview</h1>
      </header>
      <Suspense fallback={<p className="label">Loading the stadium…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

function Score({ f }: { f: Fixture }) {
  return (
    <div className="panel relative overflow-hidden p-6">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_right,rgba(254,183,3,0.18),transparent_70%)]" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="tag bg-[var(--panel-2)]">
          {f.status === "LIVE" && <span className="dot live-dot" />}
          {f.status === "LIVE" ? `Live · ${f.minute ?? 0}'` : f.statusText}
        </span>
        <span className="label">{f.venue}</span>
      </div>
      <div className="relative mt-5 flex items-center gap-6">
        <span className="display text-4xl md:text-5xl">{f.home.name}</span>
        <span className="display rounded-2xl bg-[var(--yellow)] px-4 py-2 text-5xl text-[var(--ink)]">{f.score ? `${f.score[0]}–${f.score[1]}` : "v"}</span>
        <span className="display text-4xl md:text-5xl">{f.away.name}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone: string; href: string }) {
  return (
    <Link href={href} className="panel group flex flex-col gap-2 p-5 transition-colors hover:bg-[var(--panel-2)]">
      <span className="label">{label}</span>
      <span className="display text-6xl" style={{ color: tone }}>{value}</span>
      <span className="text-sm text-[var(--muted)] group-hover:text-white">Open →</span>
    </Link>
  );
}

async function Dashboard() {
  const list = await publicJson<MatchList>("/matches");
  const fixture = list.live[0] ?? list.upcoming[0] ?? list.recent[0];
  const [mediaRes, momentsRes, incidentsRes] = await Promise.all([
    fixture ? adminFetch(`/admin/media?matchId=${encodeURIComponent(fixture.id)}`) : null,
    fixture ? adminFetch(`/admin/moments?matchId=${encodeURIComponent(fixture.id)}`) : null,
    adminFetch("/admin/incidents"),
  ]);
  if (incidentsRes.status === 401) return <p className="panel p-4 font-bold text-[var(--orange)]">The API rejected the admin token. Check ADMIN_TOKEN.</p>;
  const media = mediaRes?.ok ? ((await mediaRes.json()) as { media: MediaItem[] }).media : [];
  const moments = momentsRes?.ok ? ((await momentsRes.json()) as { moments: CuratedMoment[] }).moments : [];
  const { incidents } = (await incidentsRes.json()) as { incidents: IncidentLite[] };
  const open = incidents.filter((i) => !["RESOLVED", "FALSE_POSITIVE"].includes(i.status));
  const critical = open.filter((i) => i.severity === "CRITICAL");

  return (
    <div className="grid gap-6">
      {fixture && <Score f={fixture} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fan clips received" value={media.length} tone="var(--blue)" href="/curate" />
        <Stat label="AI moments to review" value={moments.filter((m) => m.status === "PROCESSING").length} tone="var(--yellow)" href="/curate" />
        <Stat label="Live on the feed" value={moments.filter((m) => m.status === "PUBLISHED").length} tone="var(--green)" href="/curate" />
        <Stat label="Open incidents" value={open.length} tone={critical.length ? "var(--orange)" : "white"} href="/incidents" />
      </div>
      {critical.length > 0 && (
        <Link href="/incidents" className="panel flex flex-wrap items-center gap-4 border-[var(--orange)] bg-[rgba(241,83,38,0.12)] p-5">
          <span className="dot crit-dot" />
          <span className="display text-2xl">{critical.length} critical {critical.length === 1 ? "incident" : "incidents"}</span>
          <span className="text-[var(--muted)]">
            {critical.slice(0, 3).map((i) => `${i.type.toLowerCase()} · section ${i.section ?? "?"}`).join("  ·  ")}
          </span>
          <span className="btn btn-o ml-auto">Respond</span>
        </Link>
      )}
    </div>
  );
}
