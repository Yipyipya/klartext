import {
  GROQ_CREDENTIAL_REF,
  OPENAI_CREDENTIAL_REF,
  applyRuntimeChoices,
  createDefaultSettings,
  localModelChoice,
  migrateSettings,
  type CleanupLevel,
  type DictionaryEntry,
  type PersistedSettingsV1,
  type RefinementProvider,
} from "../shared/settings";
import { translate, type InterfaceLanguage } from "../shared/i18n";
import { LOCAL_MODELS } from "../shared/local-models";
import { DEFAULT_OLLAMA_BASE_URL } from "../shared/local-endpoints";
import { compatibleCredentialRef, sanitizeCredentialRecord } from "../shared/credential-refs";
import { normalizeCompatibleBaseUrl } from "../shared/cloud-transcription-providers";

export type { CleanupLevel };

export type DictEntry = DictionaryEntry;

export type WhisperQuality = "genau" | "schnell";
export type TranscriptionMode = "quality" | "local";
export type QualityTranscriptionProvider = "openai" | "groq" | "openai-compatible";

export const WHISPER_MODELS: Record<WhisperQuality, string> = {
  genau: LOCAL_MODELS.genau.id,
  schnell: LOCAL_MODELS.schnell.id,
};

export interface Settings {
  interfaceLanguage: InterfaceLanguage;
  lang: string; // BCP-47, z. B. "de-DE"
  cleanup: CleanupLevel;
  autoCopy: boolean;
  dictionary: DictEntry[];
  transcriptionMode: TranscriptionMode;
  transcriptionProvider: QualityTranscriptionProvider;
  openaiApiKey: string;
  groqApiKey: string;
  groqModel: string;
  compatibleTranscriptionBaseUrl: string;
  compatibleTranscriptionModel: string;
  compatibleTranscriptionApiKey: string;
  compatibleTranscriptionCredentialRef: string;
  context: string;
  whisperModel: WhisperQuality;
  refinementProvider: RefinementProvider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  compatibleRefinementBaseUrl: string;
  compatibleRefinementModel: string;
  compatibleRefinementApiKey: string;
  compatibleRefinementCredentialRef: string;
  /** Web: API-Keys bewusst im lokalen Browserspeicher statt nur in der Sitzung halten. */
  rememberKeysOnDevice: boolean;
}

function runtimeSettings(
  persisted: PersistedSettingsV1,
  credentials: Record<string, string> = {},
  rememberKeysOnDevice = false,
): Settings {
  const transcription = persisted.transcriptionProfiles[persisted.activeTranscriptionProfileId]
    || persisted.transcriptionProfiles["openai-default"];
  const groq = persisted.transcriptionProfiles["groq-default"];
  const compatible = persisted.transcriptionProfiles["compatible-default"];
  const compatibleRef = compatible?.credentialRef
    || compatibleCredentialRef("transcription", compatible?.baseUrl || "");
  const refinement = persisted.refinementProfiles[persisted.activeRefinementProfileId]
    || persisted.refinementProfiles.none;
  const ollama = persisted.refinementProfiles["ollama-default"];
  const compatibleRefinement = persisted.refinementProfiles["compatible-default"];
  const compatibleRefinementRef = compatibleRefinement?.credentialRef
    || compatibleCredentialRef("refinement", compatibleRefinement?.baseUrl || "");
  return {
    interfaceLanguage: persisted.interfaceLanguage,
    lang: persisted.spokenLanguage,
    cleanup: persisted.cleanupLevel,
    autoCopy: persisted.behavior.autoCopy,
    dictionary: persisted.dictionary,
    transcriptionMode: transcription?.provider === "local" ? "local" : "quality",
    transcriptionProvider: transcription?.provider === "groq" || transcription?.provider === "openai-compatible"
      ? transcription.provider : "openai",
    openaiApiKey: credentials[OPENAI_CREDENTIAL_REF] || "",
    groqApiKey: credentials[GROQ_CREDENTIAL_REF] || "",
    groqModel: groq?.model || "whisper-large-v3",
    compatibleTranscriptionBaseUrl: compatible?.baseUrl || "",
    compatibleTranscriptionModel: compatible?.model || "",
    compatibleTranscriptionApiKey: compatibleRef ? credentials[compatibleRef] || "" : "",
    compatibleTranscriptionCredentialRef: compatibleRef || "",
    context: persisted.context,
    whisperModel: localModelChoice(persisted),
    refinementProvider: refinement?.provider || "none",
    ollamaBaseUrl: ollama?.baseUrl || DEFAULT_OLLAMA_BASE_URL,
    ollamaModel: ollama?.model || "",
    compatibleRefinementBaseUrl: compatibleRefinement?.baseUrl || "",
    compatibleRefinementModel: compatibleRefinement?.model || "",
    compatibleRefinementApiKey: compatibleRefinementRef ? credentials[compatibleRefinementRef] || "" : "",
    compatibleRefinementCredentialRef: compatibleRefinementRef || "",
    rememberKeysOnDevice,
  };
}

export const DEFAULT_SETTINGS: Settings = runtimeSettings(createDefaultSettings());

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

export const SETTINGS_KEY = "klartext.settings";
export const SETTINGS_BACKUP_KEY = "klartext.settings.backup.0.3.0";
export const SETTINGS_RECOVERY_KEY = "klartext.settings.recovery";
export const CREDENTIALS_KEY = "klartext.credentials.v1";
/** Nur der Wert "device" erlaubt dauerhafte Keys; alles andere bedeutet Sitzung. */
export const CREDENTIAL_PERSISTENCE_KEY = "klartext.credentials.persistence";
const HISTORY_KEY = "klartext.history";
const MAX_HISTORY = 300;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function readCredentialPreference(): boolean {
  try {
    return localStorage.getItem(CREDENTIAL_PERSISTENCE_KEY) === "device";
  } catch {
    return false;
  }
}

function readCredentialStore(storage: Storage): Record<string, string> {
  const parsed = JSON.parse(storage.getItem(CREDENTIALS_KEY) || "{}") as {
    schemaVersion?: unknown;
    credentials?: unknown;
  };
  if (parsed.schemaVersion !== 1 || !parsed.credentials || typeof parsed.credentials !== "object") return {};
  return sanitizeCredentialRecord(parsed.credentials);
}

function readCredentials(rememberOnDevice = readCredentialPreference()): Record<string, string> {
  try {
    const sessionCredentials = readCredentialStore(sessionStorage);
    if (rememberOnDevice) {
      const deviceCredentials = readCredentialStore(localStorage);
      return Object.keys(deviceCredentials).length ? deviceCredentials : sessionCredentials;
    }
    if (Object.keys(sessionCredentials).length) {
      localStorage.removeItem(CREDENTIALS_KEY);
      return sessionCredentials;
    }
    const legacyCredentials = readCredentialStore(localStorage);
    if (!Object.keys(legacyCredentials).length) {
      localStorage.removeItem(CREDENTIALS_KEY);
      return {};
    }
    if (writeCredentials(legacyCredentials, false)) localStorage.removeItem(CREDENTIALS_KEY);
    return legacyCredentials;
  } catch {
    return {};
  }
}

function writeCredentials(credentials: Record<string, string>, rememberOnDevice = readCredentialPreference()) {
  try {
    const payload = JSON.stringify({ schemaVersion: 1, credentials });
    if (rememberOnDevice) {
      localStorage.setItem(CREDENTIALS_KEY, payload);
      sessionStorage.removeItem(CREDENTIALS_KEY);
    } else {
      sessionStorage.setItem(CREDENTIALS_KEY, payload);
      localStorage.removeItem(CREDENTIALS_KEY);
    }
    return true;
  } catch {
    // Speicher voll oder blockiert: Zugangsdaten gelten dann nur im Arbeitsspeicher.
    return false;
  }
}

function persistSettings(settings: PersistedSettingsV1) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface SettingsLoadResult {
  settings: Settings;
  migrated: boolean;
  warning?: string;
}

export function loadSettingsResult(): SettingsLoadResult {
  if (typeof window === "undefined") return { settings: DEFAULT_SETTINGS, migrated: false };
  const raw = localStorage.getItem(SETTINGS_KEY);
  let parsed: unknown;
  let parseFailed = false;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parseFailed = true;
      try {
        if (!localStorage.getItem(SETTINGS_RECOVERY_KEY)) localStorage.setItem(SETTINGS_RECOVERY_KEY, raw);
      } catch { /* Der defekte Originalwert bleibt unangetastet, falls selbst das Backup scheitert. */ }
    }
  }
  const migration = migrateSettings(parsed);
  const interfaceLanguage = migration.settings.interfaceLanguage;
  const rememberKeysOnDevice = readCredentialPreference();
  const credentials = readCredentials(rememberKeysOnDevice);
  const legacyKey = migration.legacyCredentials.openaiApiKey?.trim();
  let credentialMigrationFailed = false;
  if (legacyKey && !credentials[OPENAI_CREDENTIAL_REF]) {
    credentials[OPENAI_CREDENTIAL_REF] = legacyKey;
    credentialMigrationFailed = !writeCredentials(credentials, rememberKeysOnDevice);
  }
  if (raw && migration.migrated && !parseFailed) {
    try {
      if (!localStorage.getItem(SETTINGS_BACKUP_KEY)) localStorage.setItem(SETTINGS_BACKUP_KEY, raw);
    } catch { /* Migration funktioniert weiter; fehlendes Backup wird über die Warnung sichtbar. */ }
  }
  if (raw && !credentialMigrationFailed && (migration.migrated || migration.issues.length || parseFailed)) {
    try { persistSettings(migration.settings); } catch { /* Laufzeiteinstellungen bleiben nutzbar. */ }
  }
  return {
    settings: runtimeSettings(migration.settings, {
      ...credentials,
      ...(legacyKey && !credentials[OPENAI_CREDENTIAL_REF] ? { [OPENAI_CREDENTIAL_REF]: legacyKey } : {}),
    }, rememberKeysOnDevice),
    migrated: migration.migrated,
    warning: credentialMigrationFailed
      ? translate(interfaceLanguage, "settings.migration.credentials")
      : parseFailed
      ? translate(interfaceLanguage, "settings.migration.corrupt")
      : migration.issues.length
        ? translate(interfaceLanguage, "settings.migration.invalid")
        : undefined,
  };
}

export function loadSettings(): Settings {
  return loadSettingsResult().settings;
}

export function saveSettings(settings: Settings) {
  try {
    let current = createDefaultSettings();
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try { current = migrateSettings(JSON.parse(raw)).settings; } catch { /* sichere Defaults */ }
    }
    const persisted = applyRuntimeChoices(current, settings);
    const remember = settings.rememberKeysOnDevice === true;
    const credentials = readCredentials(readCredentialPreference());
    const key = settings.openaiApiKey.trim();
    if (key) credentials[OPENAI_CREDENTIAL_REF] = key;
    else delete credentials[OPENAI_CREDENTIAL_REF];
    const groqKey = settings.groqApiKey.trim();
    if (groqKey) credentials[GROQ_CREDENTIAL_REF] = groqKey;
    else delete credentials[GROQ_CREDENTIAL_REF];
    for (const ref of Object.keys(credentials)) {
      if (ref.startsWith("provider:openai-compatible:transcription:")) delete credentials[ref];
    }
    const compatibleBaseUrl = normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl);
    const compatibleRef = compatibleBaseUrl
      ? compatibleCredentialRef("transcription", compatibleBaseUrl)
      : null;
    const compatibleKey = settings.compatibleTranscriptionApiKey.trim();
    if (compatibleRef && compatibleKey && settings.compatibleTranscriptionCredentialRef === compatibleRef) {
      credentials[compatibleRef] = compatibleKey;
    }
    else if (compatibleRef) delete credentials[compatibleRef];
    for (const ref of Object.keys(credentials)) {
      if (ref.startsWith("provider:openai-compatible:refinement:")) delete credentials[ref];
    }
    const compatibleRefinementBaseUrl = normalizeCompatibleBaseUrl(settings.compatibleRefinementBaseUrl);
    const compatibleRefinementRef = compatibleRefinementBaseUrl
      ? compatibleCredentialRef("refinement", compatibleRefinementBaseUrl)
      : null;
    const compatibleRefinementKey = settings.compatibleRefinementApiKey.trim();
    if (compatibleRefinementRef && compatibleRefinementKey
      && settings.compatibleRefinementCredentialRef === compatibleRefinementRef) {
      credentials[compatibleRefinementRef] = compatibleRefinementKey;
    }
    else if (compatibleRefinementRef) delete credentials[compatibleRefinementRef];
    if (!writeCredentials(credentials, remember)) return;
    if (remember) localStorage.setItem(CREDENTIAL_PERSISTENCE_KEY, "device");
    else localStorage.removeItem(CREDENTIAL_PERSISTENCE_KEY);
    persistSettings(persisted);
  } catch {
    // Speicher voll oder blockiert – Einstellungen gelten dann nur für die Sitzung.
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
