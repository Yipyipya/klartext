import { refineWithOpenAIProvider } from "../shared/openai-provider";
import { refineWithOllamaProvider } from "../shared/ollama-provider";
import { refineWithCompatibleProvider } from "../shared/compatible-refinement-provider";
import type { InterfaceLanguage } from "../shared/i18n";
import type { RefinementProfile } from "../shared/settings";
import type { Settings } from "./store";

export async function refineTranscriptWithOpenAI(
  text: string,
  apiKey: string,
  signal?: AbortSignal,
  interfaceLanguage?: InterfaceLanguage,
): Promise<string> {
  return refineWithOpenAIProvider(text, { apiKey, model: "gpt-5.4-mini", signal, interfaceLanguage });
}

export async function refineTranscript(
  text: string,
  profile: RefinementProfile,
  settings: Settings,
  signal?: AbortSignal,
): Promise<string> {
  if (profile.provider === "ollama") {
    return refineWithOllamaProvider(text, {
      baseUrl: profile.baseUrl || settings.ollamaBaseUrl,
      model: profile.model || settings.ollamaModel,
      language: settings.lang,
      context: settings.context,
      dictionary: settings.dictionary,
      signal,
      interfaceLanguage: settings.interfaceLanguage,
    });
  }
  if (profile.provider === "openai") {
    return refineWithOpenAIProvider(text, {
      apiKey: settings.openaiApiKey,
      model: profile.model || "gpt-5.4-mini",
      language: settings.lang,
      context: settings.context,
      dictionary: settings.dictionary,
      signal,
      interfaceLanguage: settings.interfaceLanguage,
    });
  }
  if (profile.provider === "openai-compatible") {
    return refineWithCompatibleProvider(text, {
      apiKey: settings.compatibleRefinementApiKey,
      baseUrl: profile.baseUrl || settings.compatibleRefinementBaseUrl,
      model: profile.model || settings.compatibleRefinementModel,
      language: settings.lang,
      context: settings.context,
      dictionary: settings.dictionary,
      signal,
    });
  }
  return text;
}
