import Link from "next/link";
import { Suspense } from "react";
import type { MatchList } from "@inside/types";
import { adminFetch, publicJson } from "@/lib/api";
import { setIncidentStatus } from "./actions";

type IncidentRow = {
  id: string;
  type: string;
  severity: string;
  status: string;
  section: string | null;
  description: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
  reportedBy: { name: string };
  match: { homeTeam: string; awayTeam: string } | null;
  media: { mediaId: string }[];
};

// Mirrors the API state machine so the dashboard never offers a transition the API will reject.
const NEXT: Record<string, string[]> = {
  OPEN: ["ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "FALSE_POSITIVE"],
  ACKNOWLEDGED: ["ASSIGNED", "RESOLVED", "FALSE_POSITIVE", "OPEN"],
  ASSIGNED: ["RESOLVED", "FALSE_POSITIVE", "ACKNOWLEDGED", "OPEN"],
  RESOLVED: ["OPEN"],
  FALSE_POSITIVE: ["OPEN"],
};

const TONE: Record<string, string> = {
  CRITICAL: "bg-[#F15326] text-white",
  MEDIUM: "bg-[#FEB703] text-[#3A0648]",
  NORMAL: "bg-[rgba(58,6,72,0.1)] text-[#3A0648]",
};
const btn = "rounded-full px-4 py-2 text-sm font-bold";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function IncidentsPage(props: { searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 text-[#3A0648]">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight">Security incidents</h1>
          <p className="mt-1 text-[rgba(58,6,72,0.72)]">Live SOS reports from fans, newest and most severe first. Every status change is a server-side transition.</p>
        </div>
        <Link href="/" className={`${btn} bg-[#3A0648] text-white`}>Admin home</Link>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <Incidents searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Incidents({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const list = await publicJson<MatchList>("/matches");
  const fixtures = [...list.live, ...list.upcoming, ...list.recent];
  const matchId = typeof sp["match"] === "string" ? sp["match"] : "";
  const status = typeof sp["status"] === "string" ? sp["status"] : "";

  const query = new URLSearchParams();
  if (matchId) query.set("matchId", matchId);
  if (status) query.set("status", status);
  const res = await adminFetch(`/admin/incidents${query.size ? `?${query}` : ""}`);
  if (res.status === 401) {
    return <p className="rounded-2xl bg-[#F15326] p-4 font-bold text-white">The API rejected the admin token. Check ADMIN_TOKEN in the repo .env and restart both apps.</p>;
  }
  const { incidents } = (await res.json()) as { incidents: IncidentRow[] };

  return (
    <div className="grid gap-6">
      <form className="flex flex-wrap items-center gap-3" action="/incidents">
        <label className="font-bold" htmlFor="match">Match</label>
        <select id="match" name="match" defaultValue={matchId} className="rounded-xl bg-[rgba(58,6,72,0.05)] px-3 py-2">
          <option value="">All matches</option>
          {fixtures.map((f) => <option key={f.id} value={f.id}>{f.home.name} v {f.away.name}</option>)}
        </select>
        <label className="font-bold" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="rounded-xl bg-[rgba(58,6,72,0.05)] px-3 py-2">
          <option value="">All statuses</option>
          {["OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "FALSE_POSITIVE"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <button className={`${btn} bg-[#3A0648] text-white`}>Filter</button>
        <Link href="/incidents" className={`${btn} bg-white`}>Refresh</Link>
      </form>

      {incidents.length === 0 && <p className="text-[rgba(58,6,72,0.72)]">No incidents match this filter.</p>}

      <div className="grid gap-4">
        {incidents.map((incident) => (
          <article key={incident.id} className="grid gap-3 rounded-3xl bg-[rgba(58,6,72,0.05)] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${TONE[incident.severity] ?? TONE.NORMAL}`}>{incident.severity}</span>
              <b className="text-lg">{incident.type.toLowerCase()}</b>
              <span className="text-sm font-semibold">Section {incident.section ?? "unknown"}</span>
              <span className="ml-auto text-sm font-bold uppercase tracking-wide">{incident.status.toLowerCase()}</span>
            </div>
            <p className="text-sm text-[rgba(58,6,72,0.72)]">
              {incident.match ? `${incident.match.homeTeam} v ${incident.match.awayTeam} · ` : ""}
              reported by {incident.reportedBy?.name ?? "a fan"} · {new Date(incident.createdAt).toLocaleString()}
              {incident.confidence !== null ? ` · AI confidence ${Math.round(incident.confidence * 100)}%` : ""}
              {incident.media.length ? ` · ${incident.media.length} linked clip${incident.media.length > 1 ? "s" : ""}` : ""}
            </p>
            {incident.description && <p className="rounded-2xl bg-white p-4 font-semibold">{incident.description}</p>}
            <div className="flex flex-wrap gap-2">
              {(NEXT[incident.status] ?? []).map((next) => (
                <form key={next} action={setIncidentStatus.bind(null, incident.id, next)}>
                  <button className={`${btn} ${next === "RESOLVED" ? "bg-[#82BA03] text-[#3A0648]" : next === "FALSE_POSITIVE" ? "bg-white" : "bg-[#FEB703]"}`}>
                    Mark {next.toLowerCase().replace("_", " ")}
                  </button>
                </form>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
