import type { DictionaryEntry } from "./settings";
import { normalizeCompatibleBaseUrl } from "./cloud-transcription-providers";
import {
  buildRefinementInput,
  buildRefinementSystemPrompt,
  splitRefinementText,
} from "./refinement-prompt";

export interface CompatibleRefinementOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  language?: string;
  context?: string;
  dictionary?: DictionaryEntry[];
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(180_000, timeoutMs)));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function responseError(response: Response): Promise<Error> {
  const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 500);
  return new Error(`COMPATIBLE_REFINEMENT_${response.status}${detail ? `: ${detail}` : ""}`);
}

export async function refineWithCompatibleProvider(
  text: string,
  options: CompatibleRefinementOptions,
): Promise<string> {
  const input = text.trim();
  if (!input) return input;
  const model = options.model.trim();
  if (!model) throw new Error("COMPATIBLE_REFINEMENT_MODEL_MISSING");
  const baseUrl = normalizeCompatibleBaseUrl(options.baseUrl);
  if (!baseUrl) throw new Error("COMPATIBLE_REFINEMENT_BASE_URL_INVALID");
  const system = buildRefinementSystemPrompt(options);
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (options.apiKey?.trim()) headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  const refined: string[] = [];
  for (const part of splitRefinementText(input)) {
    const response = await (options.fetcher || fetch)(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: buildRefinementInput(part, options) },
        ],
        temperature: 0,
        stream: false,
      }),
      redirect: "error",
      signal: requestSignal(options.signal, options.timeoutMs ?? 120_000),
    });
    if (!response.ok) throw await responseError(response);
    const payload = await response.json().catch(() => { throw new Error("COMPATIBLE_REFINEMENT_INVALID_JSON"); }) as {
      choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }>;
    };
    const choice = payload.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("COMPATIBLE_REFINEMENT_INCOMPLETE");
    const output = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
    if (!output) throw new Error("COMPATIBLE_REFINEMENT_EMPTY");
    refined.push(output);
  }
  return refined.join("\n\n");
}
