// Translation cache in front of the Translator agent. Feed text repeats on every poll, so each
// (language, text) pair is translated once per process. English source text is the fallback.
import { translateTexts, type Language } from "@inside/ai";

const MAX_ENTRIES = 5000;
const cache = new Map<string, string>();
const key = (lang: Language, text: string) => `${lang}\u0000${text}`;

export async function translate(texts: string[], lang: Language): Promise<string[]> {
  if (lang === "en") return texts;
  const missing = [...new Set(texts.filter((t) => t && !cache.has(key(lang, t))))];
  if (missing.length) {
    const out = await translateTexts(missing, lang).catch(() => null);
    if (out) {
      missing.forEach((t, i) => cache.set(key(lang, t), out[i]!));
      // Oldest entries go first; Map keeps insertion order.
      for (const k of cache.keys()) {
        if (cache.size <= MAX_ENTRIES) break;
        cache.delete(k);
      }
    }
  }
  return texts.map((t) => cache.get(key(lang, t)) ?? t);
}

export const clearTranslations = () => cache.clear();
