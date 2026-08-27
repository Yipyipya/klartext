import { transcribeWithOpenAI } from "./cloud-transcribe";
import { refineTranscriptWithOpenAI } from "./refine-transcript";
import { cleanTranscript } from "./cleanup";
import type { Settings } from "./store";

export interface QualityDictationJob {
  audio: Blob;
  settings: Settings;
  prefix: string;
  duration: number;
  raw?: string;
}

/** Browser-Text ist ausdrücklich kein Ersatz für eine fehlgeschlagene KI-Anfrage.
 * Rohtext bleibt am Job, damit ein Feinschliff-Retry keine neue Audioanfrage braucht. */
export async function processQualityDictation(
  job: QualityDictationJob,
  onStage: (message: string) => void,
  dependencies = { transcribe: transcribeWithOpenAI, refine: refineTranscriptWithOpenAI },
): Promise<{ text: string; raw: string; warning?: string }> {
  const s = job.settings;
  if (!s.openaiApiKey.trim()) throw new Error("Bitte trage deinen OpenAI API-Key in den Einstellungen ein.");
  if (!job.audio?.size) throw new Error("Keine nutzbare Audioaufnahme vorhanden. Bitte erneut aufnehmen.");
  if (job.raw === undefined) {
    onStage("Audio wird transkribiert …");
    const raw = await dependencies.transcribe(job.audio, {
      apiKey: s.openaiApiKey, language: s.lang, dictionary: s.dictionary, context: s.context,
    });
    if (!raw.trim()) throw new Error("Keine Sprache erkannt. Bitte Mikrofon prüfen und erneut aufnehmen.");
    job.raw = raw;
  }
  let text = job.raw;
  let warning: string | undefined;
  if (s.cleanup !== "aus") {
    onStage("Text wird geglättet …");
    try {
      text = await dependencies.refine(job.raw, s.openaiApiKey);
      if (!text.trim()) throw new Error("Der Feinschliff hat keinen Text zurückgegeben.");
    } catch {
      text = job.raw;
      warning = "KI-Feinschliff fehlgeschlagen. Die Transkription ist erhalten, wurde aber noch nicht automatisch kopiert oder im Verlauf gespeichert.";
    }
  }
  return { text: cleanTranscript(text, s), raw: job.raw, warning };
}
