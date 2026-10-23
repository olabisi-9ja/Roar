"use client";

import { LANGS, setLang, useLang, type Lang } from "@/lib/lang";

/** Language for AI summaries, tactics, recaps and audio. */
export function LangPicker() {
  const lang = useLang();
  return (
    <label className="li" style={{ cursor: "pointer" }}>
      <span className="grow"><b className="h3" style={{ fontSize: 18 }}>Language</b><span className="small" style={{ display: "block" }}>Moments, tactics, recaps and audio</span></span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Language"
        style={{ font: "700 16px var(--cond)", padding: "8px 12px", borderRadius: 999, border: 0, background: "var(--tint-2)", color: "var(--ink)" }}
      >
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
