import type { InterfaceLanguage } from "./i18n";
import { LOCAL_MODELS } from "./local-models";
import { DEFAULT_OLLAMA_BASE_URL, normalizeOllamaBaseUrl } from "./local-endpoints";
import {
  GROQ_CREDENTIAL_REF,
  OPENAI_CREDENTIAL_REF,
  compatibleCredentialRef,
} from "./credential-refs";
import { normalizeCompatibleBaseUrl } from "./cloud-transcription-providers";

export const SETTINGS_SCHEMA_VERSION = 1 as const;
export { compatibleCredentialRef, GROQ_CREDENTIAL_REF, OPENAI_CREDENTIAL_REF, sanitizeCredentialRecord } from "./credential-refs";
export const LEGACY_PERSONAL_CONTEXT =
  "Software, KI, Automatisierung, Produktarbeit und persönliche Nachrichten";

export type CleanupLevel = "aus" | "sanft" | "stark";
export type Theme = "system" | "light" | "dark";
export type TranscriptionProvider = "local" | "openai" | "groq" | "openai-compatible";
export type RefinementProvider = "none" | "deterministic" | "openai" | "openai-compatible" | "ollama";

export interface DictionaryEntry {
  from: string;
  to: string;
}

export interface TranscriptionProfile {
  id: string;
  provider: TranscriptionProvider;
  model: string;
  credentialRef?: string;
  baseUrl?: string;
}

export interface RefinementProfile {
  id: string;
  provider: RefinementProvider;
  model?: string;
  credentialRef?: string;
  baseUrl?: string;
}

export interface PersistedSettingsV1 {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  interfaceLanguage: InterfaceLanguage;
  spokenLanguage: string;
  activeTranscriptionProfileId: string;
  activeRefinementProfileId: string;
  transcriptionProfiles: Record<string, TranscriptionProfile>;
  refinementProfiles: Record<string, RefinementProfile>;
  cleanupLevel: CleanupLevel;
  context: string;
  dictionary: DictionaryEntry[];
  behavior: {
    autoCopy: boolean;
    launchAtLogin: boolean;
    voiceActivation: boolean;
  };
  appearance: { theme: Theme };
}

export interface MigrationOptions {
  spokenLanguage?: string;
  launchAtLogin?: boolean;
}

export interface MigrationResult {
  settings: PersistedSettingsV1;
  migrated: boolean;
  issues: string[];
  legacyCredentials: {
    openaiApiKey?: string;
    openaiKeyEnc?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
  issues: string[],
  field: string,
): T {
  if (typeof value === "string" && choices.includes(value as T)) return value as T;
  if (value !== undefined) issues.push(field);
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean, issues: string[], field: string): boolean {
  if (typeof value === "boolean") return value;
  if (value !== undefined) issues.push(field);
  return fallback;
}

function asString(value: unknown, fallback: string, max: number, issues: string[], field: string): string {
  if (typeof value === "string") return value.slice(0, max);
  if (value !== undefined) issues.push(field);
  return fallback;
}

function dictionaryFrom(value: unknown, issues: string[]): DictionaryEntry[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push("dictionary");
    return [];
  }
  const entries: DictionaryEntry[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.from !== "string" || typeof item.to !== "string") {
      issues.push("dictionary");
      continue;
    }
    const from = item.from.trim().slice(0, 120);
    const to = item.to.trim().slice(0, 120);
    if (from && to) entries.push({ from, to });
  }
  return entries.slice(0, 500);
}

function withLegacyPersonalRule(dictionary: DictionaryEntry[]): DictionaryEntry[] {
  if (dictionary.some((entry) => entry.from.toLocaleLowerCase("de") === "sigil")) return dictionary;
  return [...dictionary, { from: "Sigil", to: "Sigill" }];
}

function transcriptionProfilesFrom(
  value: unknown,
  defaults: Record<string, TranscriptionProfile>,
  issues: string[],
): Record<string, TranscriptionProfile> {
  if (!isRecord(value)) {
    issues.push("transcriptionProfiles");
    return structuredClone(defaults);
  }
  const result: Record<string, TranscriptionProfile> = {};
  for (const [key, candidate] of Object.entries(value).slice(0, 30)) {
    if (!isRecord(candidate)) { issues.push(`transcriptionProfiles.${key}`); continue; }
    const provider = asChoice(
      candidate.provider,
      ["local", "openai", "groq", "openai-compatible"],
      "local",
      issues,
      `transcriptionProfiles.${key}.provider`,
    );
    const id = asString(candidate.id, key, 120, issues, `transcriptionProfiles.${key}.id`);
    const model = asString(candidate.model, "", 200, issues, `transcriptionProfiles.${key}.model`).trim();
    if (!id || (!model && provider !== "openai-compatible")) { issues.push(`transcriptionProfiles.${key}`); continue; }
    const requestedBaseUrl = typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : "";
    const baseUrl = provider === "openai-compatible" && requestedBaseUrl
      ? normalizeCompatibleBaseUrl(requestedBaseUrl)
      : null;
    if (provider === "openai-compatible" && requestedBaseUrl && !baseUrl) {
      issues.push(`transcriptionProfiles.${key}.baseUrl`);
    }
    result[key] = {
      id,
      provider,
      model,
      ...(provider === "openai" ? { credentialRef: OPENAI_CREDENTIAL_REF } : {}),
      ...(provider === "groq" ? { credentialRef: GROQ_CREDENTIAL_REF } : {}),
      ...(provider === "openai-compatible" ? {
        baseUrl: baseUrl || "",
        ...(baseUrl ? { credentialRef: compatibleCredentialRef("transcription", baseUrl) || undefined } : {}),
      } : {}),
    };
  }
  for (const [key, profile] of Object.entries(defaults)) if (!result[key]) result[key] = structuredClone(profile);
  return result;
}

function refinementProfilesFrom(
  value: unknown,
  defaults: Record<string, RefinementProfile>,
  issues: string[],
): Record<string, RefinementProfile> {
  if (!isRecord(value)) {
    issues.push("refinementProfiles");
    return structuredClone(defaults);
  }
  const result: Record<string, RefinementProfile> = {};
  for (const [key, candidate] of Object.entries(value).slice(0, 30)) {
    if (!isRecord(candidate)) { issues.push(`refinementProfiles.${key}`); continue; }
    const provider = asChoice(candidate.provider, ["none", "deterministic", "openai", "openai-compatible", "ollama"], "none", issues, `refinementProfiles.${key}.provider`);
    const id = asString(candidate.id, key, 120, issues, `refinementProfiles.${key}.id`);
    const model = typeof candidate.model === "string" ? candidate.model.trim().slice(0, 200) : undefined;
    // Kompatible Profile dürfen unausgefüllt gespeichert werden und bleiben dann
    // durch die Aufnahme-Preflightprüfung inaktiv. So erzeugt schon das neutrale
    // Standardprofil keine falsche Migrationswarnung.
    if (!id || (provider === "openai" && !model)) { issues.push(`refinementProfiles.${key}`); continue; }
    const requestedBaseUrl = typeof candidate.baseUrl === "string"
      ? candidate.baseUrl.trim()
      : provider === "ollama" ? DEFAULT_OLLAMA_BASE_URL : "";
    const baseUrl = provider === "ollama"
      ? normalizeOllamaBaseUrl(requestedBaseUrl)
      : provider === "openai-compatible" && requestedBaseUrl
        ? normalizeCompatibleBaseUrl(requestedBaseUrl)
        : null;
    if (provider === "ollama" && !baseUrl) issues.push(`refinementProfiles.${key}.baseUrl`);
    if (provider === "openai-compatible" && requestedBaseUrl && !baseUrl) issues.push(`refinementProfiles.${key}.baseUrl`);
    result[key] = {
      id,
      provider,
      ...(model ? { model } : {}),
      ...(provider === "openai" ? { credentialRef: OPENAI_CREDENTIAL_REF } : {}),
      ...(provider === "ollama" ? { baseUrl: baseUrl || DEFAULT_OLLAMA_BASE_URL } : {}),
      ...(provider === "openai-compatible" ? {
        baseUrl: baseUrl || "",
        ...(baseUrl ? { credentialRef: compatibleCredentialRef("refinement", baseUrl) || undefined } : {}),
      } : {}),
    };
  }
  for (const [key, profile] of Object.entries(defaults)) if (!result[key]) result[key] = structuredClone(profile);
  return result;
}

export function createDefaultSettings(options: MigrationOptions = {}): PersistedSettingsV1 {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    interfaceLanguage: "de",
    spokenLanguage: options.spokenLanguage ?? "de-DE",
    activeTranscriptionProfileId: "openai-default",
    activeRefinementProfileId: "openai-default",
    transcriptionProfiles: {
      "local-default": {
        id: "local-default",
        provider: "local",
        model: LOCAL_MODELS.genau.id,
      },
      "openai-default": {
        id: "openai-default",
        provider: "openai",
        model: "gpt-transcribe",
        credentialRef: OPENAI_CREDENTIAL_REF,
      },
      "groq-default": {
        id: "groq-default",
        provider: "groq",
        model: "whisper-large-v3",
        credentialRef: GROQ_CREDENTIAL_REF,
      },
      "compatible-default": {
        id: "compatible-default",
        provider: "openai-compatible",
        model: "",
        baseUrl: "",
      },
    },
    refinementProfiles: {
      none: { id: "none", provider: "none" },
      deterministic: { id: "deterministic", provider: "deterministic" },
      "ollama-default": {
        id: "ollama-default",
        provider: "ollama",
        model: "",
        baseUrl: DEFAULT_OLLAMA_BASE_URL,
      },
      "openai-default": {
        id: "openai-default",
        provider: "openai",
        model: "gpt-5.4-mini",
        credentialRef: OPENAI_CREDENTIAL_REF,
      },
      "compatible-default": {
        id: "compatible-default",
        provider: "openai-compatible",
        model: "",
        baseUrl: "",
      },
    },
    cleanupLevel: "sanft",
    context: "",
    dictionary: [],
    behavior: {
      autoCopy: true,
      launchAtLogin: options.launchAtLogin ?? true,
      voiceActivation: false,
    },
    appearance: { theme: "system" },
  };
}

function migrateV1(input: Record<string, unknown>, defaults: PersistedSettingsV1): MigrationResult {
  const issues: string[] = [];
  const transcriptionProfiles = transcriptionProfilesFrom(input.transcriptionProfiles, defaults.transcriptionProfiles, issues);
  const refinementProfiles = refinementProfilesFrom(input.refinementProfiles, defaults.refinementProfiles, issues);

  const requestedTranscription = asString(
    input.activeTranscriptionProfileId,
    defaults.activeTranscriptionProfileId,
    120,
    issues,
    "activeTranscriptionProfileId",
  );
  const requestedRefinement = asString(
    input.activeRefinementProfileId,
    defaults.activeRefinementProfileId,
    120,
    issues,
    "activeRefinementProfileId",
  );
  const behavior = isRecord(input.behavior) ? input.behavior : {};
  const appearance = isRecord(input.appearance) ? input.appearance : {};

  return {
    migrated: false,
    issues,
    legacyCredentials: {},
    settings: {
      ...defaults,
      interfaceLanguage: asChoice(input.interfaceLanguage, ["de", "en"], defaults.interfaceLanguage, issues, "interfaceLanguage"),
      spokenLanguage: asString(input.spokenLanguage, defaults.spokenLanguage, 35, issues, "spokenLanguage"),
      transcriptionProfiles,
      refinementProfiles,
      activeTranscriptionProfileId: Object.hasOwn(transcriptionProfiles, requestedTranscription)
        ? requestedTranscription : (issues.push("activeTranscriptionProfileId"), defaults.activeTranscriptionProfileId),
      activeRefinementProfileId: Object.hasOwn(refinementProfiles, requestedRefinement)
        ? requestedRefinement : (issues.push("activeRefinementProfileId"), defaults.activeRefinementProfileId),
      cleanupLevel: asChoice(input.cleanupLevel, ["aus", "sanft", "stark"], defaults.cleanupLevel, issues, "cleanupLevel"),
      context: asString(input.context, defaults.context, 4000, issues, "context"),
      dictionary: dictionaryFrom(input.dictionary, issues),
      behavior: {
        autoCopy: asBoolean(behavior.autoCopy, defaults.behavior.autoCopy, issues, "behavior.autoCopy"),
        launchAtLogin: asBoolean(behavior.launchAtLogin, defaults.behavior.launchAtLogin, issues, "behavior.launchAtLogin"),
        voiceActivation: asBoolean(behavior.voiceActivation, defaults.behavior.voiceActivation, issues, "behavior.voiceActivation"),
      },
      appearance: {
        theme: asChoice(appearance.theme, ["system", "light", "dark"], defaults.appearance.theme, issues, "appearance.theme"),
      },
    },
  };
}

/** Migrates the unversioned 0.3.0 web or desktop object into the shared schema.
 * Secret values are returned separately and never copied into the new settings. */
export function migrateSettings(input: unknown, options: MigrationOptions = {}): MigrationResult {
  const defaults = createDefaultSettings(options);
  if (!isRecord(input)) {
    return {
      settings: defaults,
      migrated: input !== undefined && input !== null,
      issues: input === undefined || input === null ? [] : ["root"],
      legacyCredentials: {},
    };
  }
  if (input.schemaVersion === SETTINGS_SCHEMA_VERSION) return migrateV1(input, defaults);

  const issues: string[] = [];
  const mode = asChoice(
    input.transcriptionMode ?? input.mode,
    ["quality", "local"],
    "quality",
    issues,
    "transcriptionMode",
  );
  const cleanupLevel = asChoice(input.cleanup, ["aus", "sanft", "stark"], "sanft", issues, "cleanup");
  const localModel = asChoice(input.whisperModel ?? input.model, ["genau", "schnell"], "genau", issues, "whisperModel");
  const dictionary = withLegacyPersonalRule(dictionaryFrom(input.dictionary, issues));
  const settings = createDefaultSettings(options);
  settings.spokenLanguage = asString(input.lang, settings.spokenLanguage, 35, issues, "lang");
  settings.activeTranscriptionProfileId = mode === "local" ? "local-default" : "openai-default";
  settings.transcriptionProfiles["local-default"].model = LOCAL_MODELS[localModel].id;
  settings.cleanupLevel = cleanupLevel;
  settings.activeRefinementProfileId = cleanupLevel === "aus"
    ? "none"
    : mode === "quality" ? "openai-default" : "deterministic";
  settings.context = asString(input.context, settings.context, 4000, issues, "context");
  settings.dictionary = dictionary;
  settings.behavior.autoCopy = asBoolean(input.autoCopy, settings.behavior.autoCopy, issues, "autoCopy");
  settings.behavior.launchAtLogin = asBoolean(input.launchAtLogin, settings.behavior.launchAtLogin, issues, "launchAtLogin");
  settings.behavior.voiceActivation = asBoolean(input.voiceActivation, settings.behavior.voiceActivation, issues, "voiceActivation");
  settings.appearance.theme = asChoice(input.theme, ["system", "light", "dark"], settings.appearance.theme, issues, "theme");

  return {
    settings,
    migrated: true,
    issues,
    legacyCredentials: {
      openaiApiKey: typeof input.openaiApiKey === "string" ? input.openaiApiKey : undefined,
      openaiKeyEnc: typeof input.openaiKeyEnc === "string" ? input.openaiKeyEnc : undefined,
    },
  };
}

export function localModelChoice(settings: PersistedSettingsV1): "genau" | "schnell" {
  return settings.transcriptionProfiles["local-default"]?.model === LOCAL_MODELS.schnell.id ? "schnell" : "genau";
}

export function applyRuntimeChoices(
  current: PersistedSettingsV1,
  runtime: {
    interfaceLanguage?: InterfaceLanguage;
    lang?: string;
    transcriptionMode?: "quality" | "local";
    mode?: "quality" | "local";
    transcriptionProvider?: Exclude<TranscriptionProvider, "local">;
    groqModel?: string;
    compatibleTranscriptionBaseUrl?: string;
    compatibleTranscriptionModel?: string;
    whisperModel?: "genau" | "schnell";
    model?: "genau" | "schnell";
    cleanup?: CleanupLevel;
    refinementProvider?: RefinementProvider;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
    compatibleRefinementBaseUrl?: string;
    compatibleRefinementModel?: string;
    context?: string;
    dictionary?: DictionaryEntry[];
    autoCopy?: boolean;
    launchAtLogin?: boolean;
    voiceActivation?: boolean;
    theme?: Theme;
  },
): PersistedSettingsV1 {
  const next = structuredClone(current);
  const mode = runtime.transcriptionMode ?? runtime.mode;
  if (runtime.interfaceLanguage !== undefined) next.interfaceLanguage = runtime.interfaceLanguage;
  if (runtime.lang !== undefined) next.spokenLanguage = runtime.lang;
  if (mode === "local") {
    next.activeTranscriptionProfileId = "local-default";
  } else if (mode === "quality") {
    next.activeTranscriptionProfileId = ({
      openai: "openai-default",
      groq: "groq-default",
      "openai-compatible": "compatible-default",
    } as const)[runtime.transcriptionProvider || "openai"];
  }
  const groq = next.transcriptionProfiles["groq-default"] || {
    id: "groq-default",
    provider: "groq" as const,
    model: "whisper-large-v3",
    credentialRef: GROQ_CREDENTIAL_REF,
  };
  if (runtime.groqModel !== undefined) groq.model = runtime.groqModel.trim().slice(0, 200);
  next.transcriptionProfiles["groq-default"] = groq;
  const compatible = next.transcriptionProfiles["compatible-default"] || {
    id: "compatible-default",
    provider: "openai-compatible" as const,
    model: "",
    baseUrl: "",
  };
  if (runtime.compatibleTranscriptionBaseUrl !== undefined) {
    const requested = runtime.compatibleTranscriptionBaseUrl.trim();
    const normalized = requested ? normalizeCompatibleBaseUrl(requested) : null;
    compatible.baseUrl = normalized || requested.slice(0, 500);
    const credentialRef = normalized ? compatibleCredentialRef("transcription", normalized) : null;
    if (credentialRef) compatible.credentialRef = credentialRef;
    else delete compatible.credentialRef;
  }
  if (runtime.compatibleTranscriptionModel !== undefined) {
    compatible.model = runtime.compatibleTranscriptionModel.trim().slice(0, 200);
  }
  next.transcriptionProfiles["compatible-default"] = compatible;
  const model = runtime.whisperModel ?? runtime.model;
  if (model) next.transcriptionProfiles["local-default"].model = LOCAL_MODELS[model].id;
  if (runtime.cleanup) next.cleanupLevel = runtime.cleanup;
  const ollama = next.refinementProfiles["ollama-default"] || {
    id: "ollama-default",
    provider: "ollama" as const,
    model: "",
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
  };
  if (runtime.ollamaBaseUrl !== undefined) {
    ollama.baseUrl = normalizeOllamaBaseUrl(runtime.ollamaBaseUrl) || DEFAULT_OLLAMA_BASE_URL;
  }
  if (runtime.ollamaModel !== undefined) ollama.model = runtime.ollamaModel.trim().slice(0, 200);
  next.refinementProfiles["ollama-default"] = ollama;
  const compatibleRefinement = next.refinementProfiles["compatible-default"] || {
    id: "compatible-default",
    provider: "openai-compatible" as const,
    model: "",
    baseUrl: "",
  };
  if (runtime.compatibleRefinementBaseUrl !== undefined) {
    const requested = runtime.compatibleRefinementBaseUrl.trim();
    const normalized = requested ? normalizeCompatibleBaseUrl(requested) : null;
    compatibleRefinement.baseUrl = normalized || requested.slice(0, 500);
    const credentialRef = normalized ? compatibleCredentialRef("refinement", normalized) : null;
    if (credentialRef) compatibleRefinement.credentialRef = credentialRef;
    else delete compatibleRefinement.credentialRef;
  }
  if (runtime.compatibleRefinementModel !== undefined) {
    compatibleRefinement.model = runtime.compatibleRefinementModel.trim().slice(0, 200);
  }
  next.refinementProfiles["compatible-default"] = compatibleRefinement;
  if (next.cleanupLevel === "aus") {
    next.activeRefinementProfileId = "none";
  } else if (runtime.refinementProvider) {
    next.activeRefinementProfileId = ({
      none: "none",
      deterministic: "deterministic",
      openai: "openai-default",
      "openai-compatible": "compatible-default",
      ollama: "ollama-default",
    } as const)[runtime.refinementProvider];
  }
  if (runtime.context !== undefined) next.context = runtime.context.slice(0, 4000);
  if (runtime.dictionary) next.dictionary = dictionaryFrom(runtime.dictionary, []);
  if (runtime.autoCopy !== undefined) next.behavior.autoCopy = runtime.autoCopy;
  if (runtime.launchAtLogin !== undefined) next.behavior.launchAtLogin = runtime.launchAtLogin;
  if (runtime.voiceActivation !== undefined) next.behavior.voiceActivation = runtime.voiceActivation;
  if (runtime.theme) next.appearance.theme = runtime.theme;
  return next;
}
