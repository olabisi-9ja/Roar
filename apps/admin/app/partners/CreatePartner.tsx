"use client";

import { useActionState } from "react";
import { createPartner, type Created } from "./actions";

const LANGS = [["en", "English"], ["fr", "French"], ["es", "Spanish"], ["pt", "Portuguese"], ["de", "German"], ["ar", "Arabic"]] as const;
const field = "rounded-xl bg-[rgba(58,6,72,0.06)] px-4 py-3";

export function CreatePartner() {
  const [state, action, pending] = useActionState<Created, FormData>(createPartner, null);
  return (
    <form action={action} className="grid gap-3 rounded-3xl bg-[#FEB703] p-6 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
      <label className="grid gap-1 text-sm font-bold">Partner name<input name="name" required maxLength={80} className={field} placeholder="Northside Sports TV" /></label>
      <label className="grid gap-1 text-sm font-bold">Webhook URL (optional)<input name="webhookUrl" type="url" maxLength={500} className={field} placeholder="https://studio.example/roar-webhook" /></label>
      <label className="grid gap-1 text-sm font-bold">Language
        <select name="language" className={field} defaultValue="en">{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
      </label>
      <button disabled={pending} className="rounded-full bg-[#3A0648] px-6 py-3 font-bold text-white disabled:opacity-50">{pending ? "Creating…" : "Create key"}</button>
      {state && "error" in state && <p role="alert" className="font-bold sm:col-span-4">{state.error}</p>}
      {state && "apiKey" in state && (
        <div role="status" className="grid gap-2 rounded-2xl bg-white p-4 sm:col-span-4">
          <p className="font-bold">Copy these now for {state.name}. They are not shown again.</p>
          <code className="break-all text-sm">x-api-key: {state.apiKey}</code>
          {state.webhookSecret && <code className="break-all text-sm">Webhook signing secret: {state.webhookSecret}</code>}
        </div>
      )}
    </form>
  );
}
