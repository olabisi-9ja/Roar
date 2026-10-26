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
  CRITICAL: "var(--orange)",
  MEDIUM: "var(--yellow)",
  NORMAL: "var(--blue)",
};
const ACTION: Record<string, string> = { ACKNOWLEDGED: "btn-ghost", ASSIGNED: "btn-y", RESOLVED: "btn-g", FALSE_POSITIVE: "btn-ghost", OPEN: "btn-ghost" };
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(iso).toLocaleDateString();
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function IncidentsPage(props: { searchParams: Search }) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Stewards and safety</p>
          <h1 className="display mt-2 text-5xl">Security incidents</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">Live SOS reports from fans, most severe first. Every status change is a server-side transition.</p>
        </div>
        <Link href="/incidents" className="btn btn-ghost">Refresh</Link>
      </header>
      <Suspense fallback={<p className="label">Loading…</p>}>
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
    return <p className="panel p-4 font-bold text-[var(--orange)]">The API rejected the admin token. Check ADMIN_TOKEN in the repo .env and restart both apps.</p>;
  }
  const { incidents } = (await res.json()) as { incidents: IncidentRow[] };
  const open = incidents.filter((i) => !["RESOLVED", "FALSE_POSITIVE"].includes(i.status));

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {(["CRITICAL", "MEDIUM", "NORMAL"] as const).map((sev) => (
          <div key={sev} className="panel p-5">
            <p className="label">Open · {sev.toLowerCase()}</p>
            <p className="display mt-2 text-5xl" style={{ color: TONE[sev] }}>{open.filter((i) => i.severity === sev).length}</p>
          </div>
        ))}
      </div>

      <form className="panel flex flex-wrap items-center gap-3 p-3" action="/incidents">
        <label className="label pl-2" htmlFor="match">Match</label>
        <select id="match" name="match" defaultValue={matchId} className="field min-w-0 flex-1">
          <option value="">All matches</option>
          {fixtures.map((f) => <option key={f.id} value={f.id}>{f.home.name} v {f.away.name}</option>)}
        </select>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="field">
          <option value="">All statuses</option>
          {["OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "FALSE_POSITIVE"].map((s) => <option key={s} value={s}>{s.toLowerCase().replace("_", " ")}</option>)}
        </select>
        <button className="btn btn-y">Filter</button>
      </form>

      {incidents.length === 0 && <p className="text-[var(--muted)]">No incidents match this filter.</p>}

      <div className="grid gap-4">
        {incidents.map((incident) => {
          const tone = TONE[incident.severity] ?? TONE["NORMAL"];
          const active = !["RESOLVED", "FALSE_POSITIVE"].includes(incident.status);
          return (
            <article key={incident.id} className={`panel relative grid gap-4 overflow-hidden p-6 pl-8 ${active ? "" : "opacity-60"}`}>
              <span className="absolute inset-y-0 left-0 w-2" style={{ background: tone }} aria-hidden />
              <div className="flex flex-wrap items-center gap-3">
                <span className="tag text-[var(--ink)]" style={{ background: tone }}>
                  {incident.severity === "CRITICAL" && active && <span className="dot crit-dot" />}
                  {incident.severity}
                </span>
                <b className="display text-3xl">{incident.type.toLowerCase()}</b>
                <span className="tag bg-[var(--panel-2)]">Section {incident.section ?? "unknown"}</span>
                <span className="label ml-auto">{incident.status.toLowerCase().replace("_", " ")} · {ago(incident.createdAt)}</span>
              </div>
              {incident.description && <p className="rounded-2xl bg-[var(--panel-2)] p-4 text-lg font-semibold">{incident.description}</p>}
              <p className="text-sm text-[var(--muted)]">
                {incident.match ? `${incident.match.homeTeam} v ${incident.match.awayTeam} · ` : ""}
                reported by {incident.reportedBy?.name ?? "a fan"} · {new Date(incident.createdAt).toLocaleString()}
                {incident.confidence !== null ? ` · AI confidence ${Math.round(incident.confidence * 100)}%` : ""}
                {incident.media.length ? ` · ${incident.media.length} linked clip${incident.media.length > 1 ? "s" : ""}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {(NEXT[incident.status] ?? []).map((next) => (
                  <form key={next} action={setIncidentStatus.bind(null, incident.id, next)}>
                    <button className={`btn ${ACTION[next] ?? "btn-ghost"}`}>
                      {next === "OPEN" ? "Reopen" : `Mark ${next.toLowerCase().replace("_", " ")}`}
                    </button>
                  </form>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
