import type { DictionaryEntry } from "./settings";
import type { InterfaceLanguage } from "./i18n";
import { transcribeWithOpenAIProvider } from "./openai-provider";

export const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const DEEPGRAM_TRANSCRIPTION_URL = "https://api.deepgram.com/v1/listen";
export const MAX_GROQ_AUDIO_BYTES = 24_000_000;
export const MAX_DEEPGRAM_AUDIO_BYTES = 2_000_000_000;
export const DEFAULT_COMPATIBLE_AUDIO_BYTES = 24_000_000;

export type CloudTranscriptionProvider = "openai" | "groq" | "deepgram" | "openai-compatible";

export interface CloudTranscriptionRequest {
  provider: CloudTranscriptionProvider;
  apiKey?: string;
  model: string;
  language: string;
  dictionary: DictionaryEntry[];
  context?: string;
  fileName?: string;
  baseUrl?: string;
  maxAudioBytes?: number;
  /** Test and host override. Product callers normally use the five-minute cap. */
  timeoutMs?: number;
  signal?: AbortSignal;
  interfaceLanguage?: InterfaceLanguage;
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs = 300_000): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function requestTimeout(request: CloudTranscriptionRequest): number {
  return Math.max(1, Math.min(300_000, request.timeoutMs ?? 300_000));
}

function primaryLanguage(language: string): string {
  return language.trim().split("-")[0]?.toLowerCase() || "de";
}

function defaultFileName(audio: Blob): string {
  const type = audio.type.toLowerCase();
  if (type.includes("flac")) return "dictation.flac";
  if (type.includes("mpeg")) return "dictation.mp3";
  if (type.includes("ogg")) return "dictation.ogg";
  if (type.includes("mp4")) return "dictation.m4a";
  if (type.includes("wav")) return "dictation.wav";
  return "dictation.webm";
}

function cleanTerm(value: string): string | null {
  const term = value.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim();
  return term ? term.slice(0, 120) : null;
}

function promptFor(request: CloudTranscriptionRequest): string {
  const context = request.context?.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  const terms = Array.from(new Set(request.dictionary.map((entry) => cleanTerm(entry.to)).filter(Boolean))).slice(0, 40);
  return [context, terms.length ? `Preferred spellings: ${terms.join(", ")}` : ""].filter(Boolean).join(". ").slice(0, 900);
}

function assertRequest(audio: Blob, request: CloudTranscriptionRequest, maxBytes: number, keyRequired = true): void {
  if (keyRequired && !request.apiKey?.trim()) throw new Error(`${request.provider.toUpperCase()}_API_KEY_MISSING`);
  if (!request.model.trim()) throw new Error(`${request.provider.toUpperCase()}_MODEL_MISSING`);
  if (!audio.size) throw new Error(`${request.provider.toUpperCase()}_AUDIO_EMPTY`);
  if (audio.size > maxBytes) throw new Error(`${request.provider.toUpperCase()}_AUDIO_TOO_LARGE`);
}

async function responseDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return "";
  try {
    const payload = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof payload.error === "string") return payload.error.slice(0, 500);
    return (payload.error?.message || payload.message || "").slice(0, 500);
  } catch {
    return text.replace(/\s+/g, " ").trim().slice(0, 500);
  }
}

async function expectJson(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(`${provider}_TRANSCRIPTION_${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json().catch(() => { throw new Error(`${provider}_TRANSCRIPTION_INVALID_JSON`); });
}

export async function transcribeWithGroqProvider(audio: Blob, request: CloudTranscriptionRequest): Promise<string> {
  assertRequest(audio, request, MAX_GROQ_AUDIO_BYTES);
  const form = new FormData();
  form.append("model", request.model.trim());
  form.append("file", audio, request.fileName || defaultFileName(audio));
  form.append("language", primaryLanguage(request.language));
  form.append("response_format", "json");
  form.append("temperature", "0");
  const prompt = promptFor(request);
  if (prompt) form.append("prompt", prompt);
  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${request.apiKey!.trim()}` },
    body: form,
    redirect: "error",
    signal: requestSignal(request.signal, requestTimeout(request)),
  });
  const payload = await expectJson(response, "GROQ") as { text?: string };
  const text = payload.text?.trim();
  if (!text) throw new Error("GROQ_TRANSCRIPTION_EMPTY");
  return text;
}

export async function transcribeWithDeepgramProvider(audio: Blob, request: CloudTranscriptionRequest): Promise<string> {
  assertRequest(audio, request, MAX_DEEPGRAM_AUDIO_BYTES);
  const url = new URL(DEEPGRAM_TRANSCRIPTION_URL);
  url.searchParams.set("model", request.model.trim());
  url.searchParams.set("language", primaryLanguage(request.language));
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("mip_opt_out", "true");
  if (request.model.startsWith("nova-3")) {
    for (const term of Array.from(new Set(request.dictionary.map((entry) => cleanTerm(entry.to)).filter(Boolean))).slice(0, 40)) {
      url.searchParams.append("keyterm", term!);
    }
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${request.apiKey!.trim()}`,
      "Content-Type": audio.type || "application/octet-stream",
    },
    body: audio,
    redirect: "error",
    signal: requestSignal(request.signal, requestTimeout(request)),
  });
  const payload = await expectJson(response, "DEEPGRAM") as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  const text = payload.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
  if (!text) throw new Error("DEEPGRAM_TRANSCRIPTION_EMPTY");
  return text;
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Compatible servers use a base URL ending before `/audio/transcriptions`.
 * Remote clear-text HTTP, credentials, query strings and fragments are rejected. */
export function normalizeCompatibleAudioBaseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) return null;
    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = path === "/" ? "" : path;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const normalizeCompatibleBaseUrl = normalizeCompatibleAudioBaseUrl;

export async function transcribeWithCompatibleProvider(audio: Blob, request: CloudTranscriptionRequest): Promise<string> {
  const maxBytes = request.maxAudioBytes ?? DEFAULT_COMPATIBLE_AUDIO_BYTES;
  assertRequest(audio, request, maxBytes, false);
  const baseUrl = normalizeCompatibleAudioBaseUrl(request.baseUrl || "");
  if (!baseUrl) throw new Error("COMPATIBLE_BASE_URL_INVALID");
  const form = new FormData();
  form.append("model", request.model.trim());
  form.append("file", audio, request.fileName || defaultFileName(audio));
  form.append("language", primaryLanguage(request.language));
  form.append("response_format", "json");
  const prompt = promptFor(request);
  if (prompt) form.append("prompt", prompt);
  const headers: Record<string, string> = {};
  if (request.apiKey?.trim()) headers.Authorization = `Bearer ${request.apiKey.trim()}`;
  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers,
    body: form,
    redirect: "error",
    signal: requestSignal(request.signal, requestTimeout(request)),
  });
  const payload = await expectJson(response, "COMPATIBLE") as { text?: string };
  const text = payload.text?.trim();
  if (!text) throw new Error("COMPATIBLE_TRANSCRIPTION_EMPTY");
  return text;
}

export async function transcribeWithCloudProvider(audio: Blob, request: CloudTranscriptionRequest): Promise<string> {
  if (request.provider === "openai") {
    return transcribeWithOpenAIProvider(audio, {
      apiKey: request.apiKey || "",
      model: request.model,
      language: request.language,
      dictionary: request.dictionary,
      context: request.context,
      fileName: request.fileName,
      signal: request.signal,
      interfaceLanguage: request.interfaceLanguage,
    });
  }
  if (request.provider === "groq") return transcribeWithGroqProvider(audio, request);
  if (request.provider === "deepgram") return transcribeWithDeepgramProvider(audio, request);
  return transcribeWithCompatibleProvider(audio, request);
}
