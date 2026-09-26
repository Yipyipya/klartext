import {
  MAX_OPENAI_AUDIO_BYTES,
  transcribeWithOpenAIProvider,
} from "../shared/openai-provider";
import type { DictEntry } from "./store";
import type { InterfaceLanguage } from "../shared/i18n";

export { OPENAI_TRANSCRIPTION_CAPABILITIES } from "../shared/provider-contracts";
export const MAX_AUDIO_BYTES = MAX_OPENAI_AUDIO_BYTES;

export interface CloudTranscriptionOptions {
  apiKey: string;
  language: string;
  dictionary: DictEntry[];
  context?: string;
  fileName?: string;
  signal?: AbortSignal;
  interfaceLanguage?: InterfaceLanguage;
}

export async function transcribeWithOpenAI(
  audio: Blob,
  options: CloudTranscriptionOptions,
): Promise<string> {
  return transcribeWithOpenAIProvider(audio, {
    ...options,
    model: "gpt-transcribe",
  });
}
