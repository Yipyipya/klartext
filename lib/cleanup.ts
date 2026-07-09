import type { Settings, DictEntry } from "./store";

// \b funktioniert nicht mit Umlauten, deshalb Lookarounds über Leerzeichen/Interpunktion
const FILLER_DE =
  /(^|[\s,„("'-])(?:ähm+|ähh+|äh+|ehm+|öhm+|hmm+|mhm+)(?=[\s.,!?:;…)"'-]|$)/gi;
const FILLER_EN =
  /(^|[\s,("'-])(?:um+|uh+|uhm+|erm+|hmm+|mhm+)(?=[\s.,!?:;…)"'-]|$)/gi;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyDictionary(text: string, dict: DictEntry[]): string {
  let t = text;
  for (const { from, to } of dict) {
    if (!from.trim()) continue;
    t = t.replace(new RegExp(escapeRegExp(from.trim()), "gi"), to);
  }
  return t;
}

export function cleanTranscript(text: string, settings: Settings): string {
  let t = text;

  if (settings.cleanup !== "aus") {
    const filler = settings.lang.startsWith("de") ? FILLER_DE : FILLER_EN;
    t = t.replace(filler, "$1");
  }

  if (settings.cleanup === "stark") {
    // doppelte Wörter ("ich ich glaube") zusammenziehen
    t = t.replace(/(^|\s)(\p{L}{2,})(?:\s+\2)+(?=\s|[.,!?]|$)/giu, "$1$2");
  }

  t = t
    .replace(/\s+([,.!?;:…])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (settings.cleanup !== "aus" && t) {
    t = t.replace(/(^|[.!?…]\s+)(\p{Ll})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
  }
  if (settings.cleanup === "stark" && t && !/[.!?…"')\]]$/.test(t)) {
    t += ".";
  }

  return applyDictionary(t, settings.dictionary);
}
