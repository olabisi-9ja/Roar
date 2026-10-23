import Link from "next/link";
import { Suspense } from "react";
import { adminFetch } from "@/lib/api";
import { revokePartner } from "./actions";
import { CreatePartner } from "./CreatePartner";

type Partner = { id: string; name: string; webhookUrl: string | null; language: string; active: boolean; createdAt: string; lastUsedAt: string | null; hasWebhook: boolean };
const btn = "rounded-full px-4 py-2 text-sm font-bold";

export default function PartnersPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 text-[#3A0648]">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight">Partners</h1>
          <p className="mt-1 text-[rgba(58,6,72,0.72)]">Studios and streaming platforms pull published Moments and recaps from <code>/partner/v1</code> and get a signed webhook when a Moment goes live, in their language.</p>
        </div>
        <Link href="/" className={`${btn} bg-[#3A0648] text-white`}>Admin home</Link>
      </header>
      <CreatePartner />
      <Suspense fallback={<p className="mt-6">Loading…</p>}>
        <Partners />
      </Suspense>
      <section className="mt-10 grid gap-2 text-sm">
        <h2 className="text-xl font-extrabold uppercase">Quick start</h2>
        <code className="block overflow-x-auto rounded-2xl bg-[rgba(58,6,72,0.06)] p-4">curl -H &quot;x-api-key: roar_pk_…&quot; $API/partner/v1/matches/rl-01/moments?lang=fr</code>
        <code className="block overflow-x-auto rounded-2xl bg-[rgba(58,6,72,0.06)] p-4">curl -H &quot;x-api-key: roar_pk_…&quot; $API/partner/v1/matches/rl-01/recap?length=30</code>
        <p>Webhooks: <code>POST</code> with <code>x-roar-event: moment.published</code>, <code>x-roar-timestamp</code> and <code>x-roar-signature: sha256=HMAC(secret, timestamp + &quot;.&quot; + body)</code>.</p>
        <p>Embeddable widget: <code>&lt;iframe src=&quot;https://&lt;fan web app&gt;/widget.html?match=rl-01&amp;lang=fr&quot;&gt;</code></p>
      </section>
    </main>
  );
}

async function Partners() {
  const res = await adminFetch("/admin/partners");
  if (!res.ok) return <p className="mt-6 font-bold">Could not load partners ({res.status}).</p>;
  const { partners } = (await res.json()) as { partners: Partner[] };
  if (!partners.length) return <p className="mt-6">No partners yet.</p>;
  return (
    <ul className="mt-6 grid gap-3">
      {partners.map((p) => (
        <li key={p.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 ${p.active ? "bg-[rgba(58,6,72,0.06)]" : "opacity-50"}`}>
          <div>
            <p className="text-lg font-extrabold">{p.name} <span className="ml-2 rounded-full bg-[#00A6ED] px-3 py-1 text-xs uppercase">{p.language}</span></p>
            <p className="text-sm">{p.hasWebhook ? `Webhook → ${p.webhookUrl}` : "Pull only"} · {p.lastUsedAt ? `last call ${new Date(p.lastUsedAt).toLocaleString()}` : "never called"}</p>
          </div>
          {p.active ? (
            <form action={revokePartner.bind(null, p.id)}><button className={`${btn} bg-[#F15326] text-[#3A0648]`}>Revoke key</button></form>
          ) : <span className="font-bold">Revoked</span>}
        </li>
      ))}
    </ul>
  );
}
