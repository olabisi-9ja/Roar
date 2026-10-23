"use client";

import { useSyncExternalStore } from "react";

// Same codes as the API's Translator (packages/ai LANGUAGES). Names are shown in their own language.
export const LANGS = [
  { code: "en", name: "English", voice: "en-GB" },
  { code: "fr", name: "Français", voice: "fr-FR" },
  { code: "es", name: "Español", voice: "es-ES" },
  { code: "pt", name: "Português", voice: "pt-BR" },
  { code: "de", name: "Deutsch", voice: "de-DE" },
  { code: "ar", name: "العربية", voice: "ar-SA" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];

const KEY = "roar.lang";
const EVENT = "roar:lang";

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return LANGS.some((l) => l.code === v) ? (v as Lang) : "en";
  } catch {
    return "en";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // private mode: stays English for this visit
  }
  window.dispatchEvent(new Event(EVENT));
}

export const useLang = () => useSyncExternalStore(subscribe, read, () => "en" as Lang);

/** Query suffix for API calls; English needs none. */
export const langQuery = (lang: Lang, sep: "?" | "&" = "?") => (lang === "en" ? "" : `${sep}lang=${lang}`);

/** Read text aloud in the fan's language with the browser's speech engine. Returns false when unsupported. */
export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGS.find((l) => l.code === lang)?.voice ?? "en-GB";
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
