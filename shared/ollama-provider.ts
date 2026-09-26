import type { InterfaceLanguage } from "./i18n";
import type { DictionaryEntry } from "./settings";
import { requireLocalOllamaBaseUrl } from "./local-endpoints";
import { buildRefinementInput, buildRefinementSystemPrompt, splitRefinementText } from "./refinement-prompt";

type Fetcher = typeof fetch;

export interface OllamaOptions {
  baseUrl: string;
  signal?: AbortSignal;
  interfaceLanguage?: InterfaceLanguage;
  fetcher?: Fetcher;
}

export interface OllamaRefinementOptions extends OllamaOptions {
  model: string;
  language?: string;
  context?: string;
  dictionary?: DictionaryEntry[];
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function responseError(response: Response, code: string): Promise<Error> {
  const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 500);
  return new Error(`${code}_${response.status}${detail ? `: ${detail}` : ""}`);
}

export async function listOllamaModels(options: OllamaOptions): Promise<string[]> {
  const baseUrl = requireLocalOllamaBaseUrl(options.baseUrl);
  const response = await (options.fetcher || fetch)(`${baseUrl}/api/tags`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: requestSignal(options.signal, 8_000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw await responseError(response, "OLLAMA_MODELS");
  const payload = await response.json() as { models?: Array<{ name?: unknown; model?: unknown }> };
  return Array.from(new Set((payload.models || [])
    .map((item) => typeof item.model === "string" ? item.model : typeof item.name === "string" ? item.name : "")
    .map((item) => item.trim()).filter(Boolean))).slice(0, 200);
}

export async function refineWithOllamaProvider(
  text: string,
  options: OllamaRefinementOptions,
): Promise<string> {
  const input = text.trim();
  if (!input) return input;
  const model = options.model.trim();
  if (!model) throw new Error("OLLAMA_MODEL_MISSING");
  const baseUrl = requireLocalOllamaBaseUrl(options.baseUrl);
  const parts = splitRefinementText(input);
  const system = buildRefinementSystemPrompt(options);
  const refined: string[] = [];
  for (const part of parts) {
    const response = await (options.fetcher || fetch)(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model,
        system,
        prompt: buildRefinementInput(part, options),
        stream: false,
        think: false,
        options: { temperature: 0 },
      }),
      signal: requestSignal(options.signal, 180_000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw await responseError(response, "OLLAMA_REFINEMENT");
    const payload = await response.json() as { response?: unknown; done?: unknown };
    const output = typeof payload.response === "string" ? payload.response.trim() : "";
    if (payload.done !== true || !output) throw new Error("OLLAMA_REFINEMENT_INCOMPLETE");
    refined.push(output);
  }
  return refined.join("\n\n");
}
