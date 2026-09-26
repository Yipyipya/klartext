import type { DictionaryEntry } from "./settings";
import { translate, type InterfaceLanguage } from "./i18n";
import { buildRefinementInput, buildRefinementSystemPrompt, splitRefinementText } from "./refinement-prompt";

export const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const MAX_OPENAI_AUDIO_BYTES = 24_000_000;

export interface OpenAITranscriptionOptions {
  apiKey: string;
  model?: string;
  language: string;
  dictionary: DictionaryEntry[];
  context?: string;
  fileName?: string;
  signal?: AbortSignal;
  interfaceLanguage?: InterfaceLanguage;
}

export interface OpenAIRefinementOptions {
  apiKey: string;
  model?: string;
  language?: string;
  context?: string;
  dictionary?: DictionaryEntry[];
  signal?: AbortSignal;
  interfaceLanguage?: InterfaceLanguage;
}

const DEFAULT_TERMS = [
  "OpenAI", "ChatGPT", "Claude", "Make", "n8n", "HubSpot", "Pipedrive",
  "Supabase", "Next.js", "Wispr Flow", "Nivune",
];

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function cleanKeyword(value: string): string | null {
  const keyword = value.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim();
  return keyword ? keyword.slice(0, 120) : null;
}

function expectedLanguages(language: string): string[] {
  const primary = language.split("-")[0]?.toLowerCase() || "de";
  return primary === "de" ? ["de", "en"] : [primary];
}

function contextPrompt(language: string, context?: string): string {
  const primary = language.startsWith("de") ? "German" : "the selected language";
  const personalContext = context?.trim()
    ? ` The user's context is: ${context.trim().slice(0, 900)}.`
    : "";
  return `Personal dictation in ${primary}, sometimes containing English product names and technical terms. Preserve the spoken language and intended wording.${personalContext}`;
}

function defaultFileName(audio: Blob): string {
  return audio.type.includes("wav")
    ? "dictation.wav"
    : audio.type.includes("mp4") ? "dictation.m4a" : "dictation.webm";
}

export async function transcribeWithOpenAIProvider(
  audio: Blob,
  options: OpenAITranscriptionOptions,
): Promise<string> {
  const interfaceLanguage = options.interfaceLanguage ?? "de";
  if (!options.apiKey.trim()) throw new Error(translate(interfaceLanguage, "error.openai.apiKeyMissing"));
  if (!audio.size) throw new Error(translate(interfaceLanguage, "error.openai.audioEmpty"));
  if (audio.size > MAX_OPENAI_AUDIO_BYTES) {
    throw new Error(translate(interfaceLanguage, "error.openai.audioTooLarge"));
  }

  const form = new FormData();
  form.append("model", options.model || "gpt-transcribe");
  form.append("file", audio, options.fileName || defaultFileName(audio));
  form.append("prompt", contextPrompt(options.language, options.context));
  const keywords = Array.from(new Set([
    ...DEFAULT_TERMS,
    ...options.dictionary.map((entry) => entry.to),
  ])).map(cleanKeyword).filter((value): value is string => Boolean(value)).slice(0, 80);
  for (const keyword of keywords) form.append("keywords[]", keyword);
  for (const language of expectedLanguages(options.language)) form.append("languages[]", language);

  const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey.trim()}` },
    body: form,
    redirect: "error",
    signal: requestSignal(options.signal, 300_000),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      detail = payload.error?.message || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    const help = response.status === 401
      ? translate(interfaceLanguage, "error.openai.invalidKey")
      : response.status === 429
        ? translate(interfaceLanguage, "error.openai.rateLimit")
        : response.status === 413
          ? translate(interfaceLanguage, "error.openai.fileTooLarge")
          : translate(interfaceLanguage, "error.openai.failure", { status: response.status });
    throw new Error(`${help}${detail ? ` ${detail}` : ""}`);
  }
  const result = (await response.json()) as { text?: string };
  const text = result.text?.trim();
  if (!text) throw new Error("TRANSCRIPTION_EMPTY");
  return text;
}

type ResponsePayload = {
  status?: string;
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

function readOutputText(payload: ResponsePayload): string {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return (payload.output || []).flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text!.trim()).filter(Boolean).join("\n").trim();
}

export async function refineWithOpenAIProvider(
  text: string,
  options: OpenAIRefinementOptions,
): Promise<string> {
  const input = text.trim();
  if (!input || !options.apiKey.trim()) return input;
  if (input.length > 12_000) {
    const parts = splitRefinementText(input);
    const refined: string[] = [];
    for (const part of parts) refined.push(await refineWithOpenAIProvider(part, options));
    return refined.join("\n\n");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model || "gpt-5.4-mini",
      instructions: buildRefinementSystemPrompt(options),
      input: buildRefinementInput(input, options),
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
      max_output_tokens: Math.min(16000, Math.max(512, Math.ceil(input.length / 2))),
      store: false,
    }),
    redirect: "error",
    signal: requestSignal(options.signal, 120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`REFINEMENT_${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const payload = (await response.json()) as ResponsePayload;
  if (payload.status !== "completed") throw new Error("REFINEMENT_INCOMPLETE");
  const refined = readOutputText(payload);
  if (!refined) throw new Error("REFINEMENT_EMPTY");
  return refined;
}
