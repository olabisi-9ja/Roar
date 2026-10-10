import Link from "next/link";
import { Suspense } from "react";

type Health = { status: string; db: string; stats?: string };

async function ApiStatus() {
  let health: Health | null = null;
  try {
    const res = await fetch(`${process.env["API_URL"] ?? "http://localhost:4000"}/health`, { cache: "no-store" });
    health = (await res.json()) as Health;
  } catch {}
  return <p className="text-[#82BA03]">{health ? `API ${health.status} · DB ${health.db} · data ${health.stats ?? "?"}` : "API unreachable"}</p>;
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#3A0648] text-white">
      <h1 className="text-3xl font-extrabold tracking-wide">ROAR · ADMIN</h1>
      <Suspense fallback={<p>Checking API…</p>}>
        <ApiStatus />
      </Suspense>
      <Link href="/curate" className="rounded-full bg-[#FEB703] px-6 py-3 font-bold text-[#3A0648]">Curate the For You feed</Link>
    </main>
  );
}
