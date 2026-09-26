import {
  normalizeCompatibleBaseUrl,
  transcribeWithCloudProvider,
  type CloudTranscriptionRequest,
} from "../shared/cloud-transcription-providers";
import { refineTranscript } from "./refine-transcript";
import { runProcessingJob, type ProcessingResult, type ProcessingStage } from "../shared/processing";
import { createProcessingPlan } from "./processing-plan";
import type { Settings } from "./store";
import { translate, uiText } from "../shared/i18n";

export interface QualityDictationJob {
  audio: Blob;
  settings: Settings;
  prefix: string;
  duration: number;
  raw?: string;
}

export function createCloudTranscriptionRequest(
  settings: Settings,
  overrides: Partial<Pick<CloudTranscriptionRequest, "language" | "fileName" | "signal">> = {},
): CloudTranscriptionRequest {
  if (settings.transcriptionProvider === "groq") {
    if (!settings.groqApiKey.trim()) throw new Error(uiText(settings.interfaceLanguage, "Bitte trage deinen Groq API-Key in den Einstellungen ein.", "Add your Groq API key in Settings."));
    if (!settings.groqModel.trim()) throw new Error(uiText(settings.interfaceLanguage, "Bitte wähle ein Groq-Transkriptionsmodell aus.", "Choose a Groq transcription model."));
    return {
      provider: "groq",
      apiKey: settings.groqApiKey,
      model: settings.groqModel,
      language: overrides.language || settings.lang,
      dictionary: settings.dictionary,
      context: settings.context,
      interfaceLanguage: settings.interfaceLanguage,
      ...overrides,
    };
  }
  if (settings.transcriptionProvider === "openai-compatible") {
    const baseUrl = normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl);
    if (!baseUrl) throw new Error(uiText(settings.interfaceLanguage, "Bitte trage eine sichere kompatible Server-Adresse ein (HTTPS oder lokales HTTP).", "Enter a secure compatible server address (HTTPS or local HTTP)."));
    if (!settings.compatibleTranscriptionModel.trim()) throw new Error(uiText(settings.interfaceLanguage, "Bitte trage die Modell-ID des kompatiblen Servers ein.", "Enter the compatible server's model ID."));
    return {
      provider: "openai-compatible",
      apiKey: settings.compatibleTranscriptionApiKey,
      model: settings.compatibleTranscriptionModel,
      baseUrl,
      language: overrides.language || settings.lang,
      dictionary: settings.dictionary,
      context: settings.context,
      interfaceLanguage: settings.interfaceLanguage,
      ...overrides,
    };
  }
  if (!settings.openaiApiKey.trim()) throw new Error(translate(settings.interfaceLanguage, "error.openai.apiKeyMissing"));
  return {
    provider: "openai",
    apiKey: settings.openaiApiKey,
    model: "gpt-transcribe",
    language: overrides.language || settings.lang,
    dictionary: settings.dictionary,
    context: settings.context,
    interfaceLanguage: settings.interfaceLanguage,
    ...overrides,
  };
}

export async function processExistingTranscript(
  rawText: string,
  settings: Settings,
  onStage: (stage: ProcessingStage) => void = () => {},
  signal?: AbortSignal,
  refiner = refineTranscript,
): Promise<ProcessingResult> {
  const plan = createProcessingPlan(settings);
  return runProcessingJob({ rawText, plan }, {
    transcribe: async () => { throw new Error("PROCESSING_RAW_TEXT_EXPECTED"); },
    refine: (raw, profile) => refiner(raw, profile, settings, signal),
  }, onStage);
}

/** Browser-Text ist ausdrücklich kein Ersatz für eine fehlgeschlagene KI-Anfrage.
 * Rohtext bleibt am Job, damit ein Feinschliff-Retry keine neue Audioanfrage braucht. */
export async function processQualityDictation(
  job: QualityDictationJob,
  onStage: (message: string) => void,
  dependencies = { transcribe: transcribeWithCloudProvider, refine: refineTranscript },
): Promise<{ text: string; raw: string; warning?: string }> {
  const s = job.settings;
  if (job.raw === undefined && !job.audio?.size) throw new Error(translate(s.interfaceLanguage, "error.local.audioEmpty"));
  const plan = createProcessingPlan(s);
  const transcriptionRequest = job.raw === undefined ? createCloudTranscriptionRequest(s) : null;
  let result;
  try {
    result = await runProcessingJob({ audio: job.audio, rawText: job.raw, plan }, {
      transcribe: (audio) => dependencies.transcribe(audio, transcriptionRequest!),
      refine: (raw, profile) => dependencies.refine(raw, profile, s),
    }, (stage) => {
      if (stage === "transcribing") onStage(translate(s.interfaceLanguage, "processing.cloudTranscribing"));
      if (stage === "refining") onStage(translate(s.interfaceLanguage, "processing.refining"));
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROCESSING_TRANSCRIPTION_EMPTY") {
      throw new Error(translate(s.interfaceLanguage, "error.local.noSpeech"));
    }
    throw error;
  }
  job.raw = result.rawText;
  return {
    text: result.text,
    raw: result.rawText,
    warning: result.warning
      ? uiText(s.interfaceLanguage, "KI-Feinschliff fehlgeschlagen. Die Transkription ist erhalten, wurde aber noch nicht automatisch kopiert oder im Verlauf gespeichert.", "AI refinement failed. The transcription was preserved but has not yet been copied automatically or saved to history.")
      : undefined,
  };
}
