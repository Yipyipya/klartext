import type { DictEntry } from "./store";

const TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
export const MAX_AUDIO_BYTES = 24_000_000; // Sicherheitsabstand zum 25-MB-Limit

export interface CloudTranscriptionOptions {
  apiKey: string;
  language: string;
  dictionary: DictEntry[];
  context?: string;
  fileName?: string;
  signal?: AbortSignal;
}

const DEFAULT_TERMS = [
  "OpenAI",
  "ChatGPT",
  "Claude",
  "Make",
  "n8n",
  "HubSpot",
  "Pipedrive",
  "Supabase",
  "Next.js",
  "Wispr Flow",
  "Klartext",
  "Sigill",
];

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

/**
 * Hochwertige Transkription über gpt-transcribe.
 * Der API-Key wird direkt vom Gerät des Nutzers an OpenAI gesendet.
 */
export async function transcribeWithOpenAI(
  audio: Blob,
  options: CloudTranscriptionOptions
): Promise<string> {
  if (!options.apiKey.trim()) throw new Error("Bitte trage deinen OpenAI API-Key in den Einstellungen ein.");
  if (!audio.size) throw new Error("Die Audiodatei ist leer.");
  if (audio.size > MAX_AUDIO_BYTES) throw new Error("Die Aufnahme ist zu groß für eine einzelne Anfrage. Bitte nutze den Datei-Upload zum Aufteilen.");

  const form = new FormData();
  form.append("model", "gpt-transcribe");
  form.append(
    "file",
    audio,
    options.fileName || (audio.type.includes("wav") ? "dictation.wav" : audio.type.includes("mp4") ? "dictation.m4a" : "dictation.webm")
  );
  form.append("prompt", contextPrompt(options.language, options.context));

  const keywords = Array.from(
    new Set([
      ...DEFAULT_TERMS,
      ...options.dictionary.map((entry) => entry.to),
    ])
  )
    .map(cleanKeyword)
    .filter((value): value is string => Boolean(value))
    .slice(0, 80);

  for (const keyword of keywords) form.append("keywords[]", keyword);
  for (const language of expectedLanguages(options.language)) {
    form.append("languages[]", language);
  }

  const response = await fetch(TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey.trim()}` },
    body: form,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(300_000)]) : AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      detail = payload.error?.message || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    const help = response.status === 401 ? "Bitte prüfe deinen OpenAI API-Key."
      : response.status === 429 ? "OpenAI-Limit erreicht. Bitte prüfe Guthaben und Nutzungslimit oder versuche es später erneut."
      : response.status === 413 ? "Die Datei überschreitet das Upload-Limit."
      : `OpenAI konnte die Datei nicht verarbeiten (${response.status}).`;
    throw new Error(`${help}${detail ? ` ${detail}` : ""}`);
  }

  const result = (await response.json()) as { text?: string };
  const text = result.text?.trim();
  if (!text) throw new Error("TRANSCRIPTION_EMPTY");
  return text;
}
