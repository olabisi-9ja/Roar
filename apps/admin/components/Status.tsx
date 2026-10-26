type Health = { status: string; db: string; stats?: string; ai?: { enabled: boolean; provider: string; model: string; error: string | null } };

export async function getHealth(): Promise<Health | null> {
  try {
    const res = await fetch(`${process.env["API_URL"] ?? "http://localhost:4000"}/health`, { cache: "no-store" });
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

/** Sidebar footer: API, database and AI provider health. */
export async function SystemStatus() {
  const health = await getHealth();
  const rows: [string, string, boolean][] = health
    ? [
        ["API", health.status, health.status === "ok"],
        ["Database", health.db, health.db === "up"],
        ["AI", health.ai?.enabled ? health.ai.model : "off", !!health.ai?.enabled],
      ]
    : [["API", "unreachable", false]];
  return (
    <div className="grid gap-2">
      <p className="label">System</p>
      {rows.map(([name, value, ok]) => (
        <p key={name} className="flex items-center gap-2 text-sm">
          <span className="dot" style={{ background: ok ? "var(--green)" : "var(--orange)" }} />
          <span className="text-[var(--muted)]">{name}</span>
          <span className="ml-auto font-semibold">{value}</span>
        </p>
      ))}
      {health?.ai?.enabled && <p className="text-xs text-[var(--muted)]">Microsoft Foundry · {health.ai.provider}</p>}
    </div>
  );
}
