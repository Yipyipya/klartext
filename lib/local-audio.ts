import type { DecodedAudio } from "./audio-upload";
import { translate, uiText, type InterfaceLanguage } from "../shared/i18n";

export interface LocalAudioOptions {
  language: string | null;
  model: string;
  signal?: AbortSignal;
  interfaceLanguage?: InterfaceLanguage;
}

export type LocalProgress = (event: { type: "model" | "status"; detail: string }) => void;

export function mixToMono(audio: DecodedAudio, interfaceLanguage: InterfaceLanguage = "de"): Float32Array {
  const length = audio.channels[0]?.length ?? 0;
  if (!length || !audio.channels.every((channel) => channel.length === length)) {
    throw new Error(uiText(interfaceLanguage, "Ungültige lokale Audiodaten.", "Invalid local audio data."));
  }
  const mono = new Float32Array(length);
  for (const channel of audio.channels) {
    for (let index = 0; index < length; index += 1) mono[index] += channel[index] / audio.channels.length;
  }
  return mono;
}

export async function transcribeLocalAudioWith(
  audio: Blob,
  options: LocalAudioOptions,
  progress: LocalProgress,
  dependencies: {
    decode: (audio: Blob, local: boolean, interfaceLanguage?: InterfaceLanguage) => Promise<DecodedAudio>;
    transcribePcm: (pcm: Float32Array, options: LocalAudioOptions, progress: LocalProgress) => Promise<string>;
  },
): Promise<string> {
  const interfaceLanguage = options.interfaceLanguage ?? "de";
  if (!audio.size) throw new Error(translate(interfaceLanguage, "error.local.audioEmpty"));
  progress({ type: "status", detail: translate(interfaceLanguage, "processing.localPreparing") });
  const decoded = await dependencies.decode(audio, true, interfaceLanguage);
  const text = await dependencies.transcribePcm(mixToMono(decoded, interfaceLanguage), options, progress);
  if (!text.trim()) throw new Error(translate(interfaceLanguage, "error.local.noSpeech"));
  return text.trim();
}
