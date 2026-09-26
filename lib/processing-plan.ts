import type { ProcessingPlan } from "../shared/processing";
import { GROQ_CREDENTIAL_REF, OPENAI_CREDENTIAL_REF } from "../shared/settings";
import { compatibleCredentialRef } from "../shared/credential-refs";
import { WHISPER_MODELS, type Settings } from "./store";

export function createProcessingPlan(settings: Settings): ProcessingPlan {
  const quality = settings.transcriptionMode === "quality";
  const refinementProvider = settings.refinementProvider || (quality ? "openai" : "deterministic");
  const refinement = settings.cleanup === "aus" || refinementProvider === "none"
    ? { id: "none", provider: "none" as const }
    : refinementProvider === "ollama"
      ? {
          id: "ollama-default",
          provider: "ollama" as const,
          model: settings.ollamaModel,
          baseUrl: settings.ollamaBaseUrl,
        }
      : refinementProvider === "openai"
        ? {
            id: "openai-default",
            provider: "openai" as const,
            model: "gpt-5.4-mini",
            credentialRef: OPENAI_CREDENTIAL_REF,
          }
        : refinementProvider === "openai-compatible"
          ? {
              id: "compatible-default",
              provider: "openai-compatible" as const,
              model: settings.compatibleRefinementModel,
              baseUrl: settings.compatibleRefinementBaseUrl,
              credentialRef: compatibleCredentialRef("refinement", settings.compatibleRefinementBaseUrl) || undefined,
            }
        : { id: "deterministic", provider: "deterministic" as const };
  return {
    transcription: quality
      ? settings.transcriptionProvider === "groq"
        ? {
            id: "groq-default",
            provider: "groq",
            model: settings.groqModel,
            credentialRef: GROQ_CREDENTIAL_REF,
          }
        : settings.transcriptionProvider === "openai-compatible"
          ? {
              id: "compatible-default",
              provider: "openai-compatible",
              model: settings.compatibleTranscriptionModel,
              baseUrl: settings.compatibleTranscriptionBaseUrl,
              credentialRef: compatibleCredentialRef("transcription", settings.compatibleTranscriptionBaseUrl) || undefined,
            }
          : {
              id: "openai-default",
              provider: "openai",
              model: "gpt-transcribe",
              credentialRef: OPENAI_CREDENTIAL_REF,
            }
      : {
          id: "local-default",
          provider: "local",
          model: WHISPER_MODELS[settings.whisperModel],
        },
    refinement,
    language: settings.lang,
    context: settings.context,
    dictionary: settings.dictionary,
    cleanupLevel: settings.cleanup,
  };
}
