import { GROQ_CREDENTIAL_REF } from "./credential-refs";
import { normalizeCompatibleBaseUrl } from "./cloud-transcription-providers";

export interface ModelListResult {
  supported: boolean;
  models: string[];
}

export interface ModelListOptions {
  apiKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs = 8_000): AbortSignal {
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(30_000, timeoutMs)));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function modelsFrom(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return Array.from(new Set(data
    .map((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
      ? (item as { id: string }).id.trim() : "")
    .filter(Boolean))).slice(0, 500);
}

async function errorFor(response: Response, code: string): Promise<Error> {
  const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 500);
  return new Error(`${code}_${response.status}${detail ? `: ${detail}` : ""}`);
}

export async function listGroqTranscriptionModels(options: ModelListOptions): Promise<ModelListResult> {
  if (!options.apiKey?.trim()) throw new Error(`${GROQ_CREDENTIAL_REF.toUpperCase()}_MISSING`);
  const response = await (options.fetcher || fetch)("https://api.groq.com/openai/v1/models", {
    method: "GET",
    headers: { Authorization: `Bearer ${options.apiKey.trim()}`, Accept: "application/json" },
    redirect: "error",
    cache: "no-store",
    signal: requestSignal(options.signal, options.timeoutMs),
  });
  if (!response.ok) throw await errorFor(response, "GROQ_MODELS");
  const payload = await response.json().catch(() => { throw new Error("GROQ_MODELS_INVALID_JSON"); });
  const models = modelsFrom(payload).filter((id) => /whisper/i.test(id));
  return { supported: true, models };
}

export async function listCompatibleModels(baseUrl: string, options: ModelListOptions = {}): Promise<ModelListResult> {
  const normalized = normalizeCompatibleBaseUrl(baseUrl);
  if (!normalized) throw new Error("COMPATIBLE_BASE_URL_INVALID");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.apiKey?.trim()) headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  const response = await (options.fetcher || fetch)(`${normalized}/models`, {
    method: "GET",
    headers,
    redirect: "error",
    cache: "no-store",
    signal: requestSignal(options.signal, options.timeoutMs),
  });
  if ([404, 405, 501].includes(response.status)) return { supported: false, models: [] };
  if (!response.ok) throw await errorFor(response, "COMPATIBLE_MODELS");
  const payload = await response.json().catch(() => { throw new Error("COMPATIBLE_MODELS_INVALID_JSON"); });
  return { supported: true, models: modelsFrom(payload) };
}
