export type CleanupLevel = "aus" | "sanft" | "stark";

export interface DictEntry {
  from: string;
  to: string;
}

export type WhisperQuality = "genau" | "schnell";

export const WHISPER_MODELS: Record<WhisperQuality, string> = {
  genau: "onnx-community/whisper-small",
  schnell: "onnx-community/whisper-base",
};

export interface Settings {
  lang: string; // BCP-47, z. B. "de-DE"
  cleanup: CleanupLevel;
  autoCopy: boolean;
  dictionary: DictEntry[];
  whisperModel: WhisperQuality;
  polish: boolean; // KI-Feinschliff über die Claude-API
  apiKey: string; // eigener Claude-API-Key des Nutzers, bleibt im localStorage dieses Geräts
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "de-DE",
  cleanup: "sanft",
  autoCopy: true,
  dictionary: [],
  whisperModel: "genau",
  polish: false,
  apiKey: "",
};

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "de-DE", label: "Deutsch" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "it-IT", label: "Italiano" },
  { code: "pt-PT", label: "Português" },
  { code: "nl-NL", label: "Nederlands" },
  { code: "pl-PL", label: "Polski" },
  { code: "tr-TR", label: "Türkçe" },
  { code: "ru-RU", label: "Русский" },
  { code: "uk-UA", label: "Українська" },
  { code: "ar-SA", label: "العربية" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "zh-CN", label: "中文" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
];

export interface HistoryEntry {
  id: string;
  ts: number;
  source: "diktat" | "datei";
  text: string;
  raw?: string;
  label?: string;
  words: number;
  durationSec?: number;
}

const SETTINGS_KEY = "klartext.settings";
const HISTORY_KEY = "klartext.history";
const MAX_HISTORY = 300;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Speicher voll oder blockiert – Einstellungen gelten dann nur für die Sitzung
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function persistHistory(list: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch {
    // Wenn localStorage voll ist, älteste Hälfte verwerfen und erneut versuchen
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(list.slice(0, Math.floor(MAX_HISTORY / 2)))
      );
    } catch {
      /* endgültig aufgeben */
    }
  }
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const list = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  persistHistory(list);
  return list;
}

export function removeHistory(id: string): HistoryEntry[] {
  const list = loadHistory().filter((e) => e.id !== id);
  persistHistory(list);
  return list;
}

export function clearHistory(): HistoryEntry[] {
  persistHistory([]);
  return [];
}

export interface Stats {
  totalWords: number;
  entries: number;
  avgWpm: number | null;
  streakDays: number;
}

export function computeStats(history: HistoryEntry[]): Stats {
  const totalWords = history.reduce((n, e) => n + e.words, 0);
  const timed = history.filter(
    (e) => e.source === "diktat" && e.durationSec && e.durationSec > 2 && e.words > 0
  );
  const avgWpm = timed.length
    ? Math.round(
        timed.reduce((n, e) => n + e.words / (e.durationSec! / 60), 0) / timed.length
      )
    : null;

  // Serie: aufeinanderfolgende Kalendertage (heute rückwärts) mit mindestens einem Eintrag
  const days = new Set(
    history.map((e) => new Date(e.ts).toISOString().slice(0, 10))
  );
  let streakDays = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streakDays++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return { totalWords, entries: history.length, avgWpm, streakDays };
}
