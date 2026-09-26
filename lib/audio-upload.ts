import { MAX_AUDIO_BYTES, type CloudTranscriptionOptions } from "./cloud-transcribe";
import {
  DEFAULT_COMPATIBLE_AUDIO_BYTES,
  MAX_GROQ_AUDIO_BYTES,
  transcribeWithCloudProvider,
  type CloudTranscriptionRequest,
} from "../shared/cloud-transcription-providers";
import { uiText, type InterfaceLanguage } from "../shared/i18n";

export type UploadTranscriptionOptions = Omit<CloudTranscriptionOptions, "apiKey"> & { apiKey?: string } & Partial<Pick<
  CloudTranscriptionRequest,
  "provider" | "model" | "baseUrl" | "maxAudioBytes"
>>;

export type DecodedAudio = { channels: Float32Array[]; sampleRate: number; duration: number };
export type AudioRange = { start: number; end: number };

export const MAX_WEB_UPLOAD_FILE_BYTES = 100_000_000;
export const MAX_WEB_UPLOAD_QUEUE_FILES = 12;
export const MAX_WEB_UPLOAD_QUEUE_BYTES = 300_000_000;

export type UploadQueueBudget = { count: number; bytes: number };
export type UploadRejection =
  | "unsupported-type"
  | "empty-file"
  | "file-too-large"
  | "queue-full"
  | "queue-bytes-exceeded";

type UploadCandidate = Pick<File, "name" | "type" | "size">;
export type UploadAdmissionDecision<T extends UploadCandidate> =
  | { file: T; accepted: true }
  | { file: T; accepted: false; reason: UploadRejection };

export function admitUploadFiles<T extends UploadCandidate>(
  files: readonly T[],
  currentBudget: UploadQueueBudget,
): { decisions: UploadAdmissionDecision<T>[]; nextBudget: UploadQueueBudget } {
  let count = currentBudget.count;
  let bytes = currentBudget.bytes;
  const decisions = files.map((file): UploadAdmissionDecision<T> => {
    const supported = file.type.startsWith("audio/")
      || file.type.startsWith("video/")
      || /\.(mp3|m4a|wav|ogg|oga|webm|mp4|aac|flac)$/i.test(file.name);
    let reason: UploadRejection | undefined;
    if (!supported) reason = "unsupported-type";
    else if (!Number.isSafeInteger(file.size) || file.size <= 0) reason = "empty-file";
    else if (file.size > MAX_WEB_UPLOAD_FILE_BYTES) reason = "file-too-large";
    else if (count >= MAX_WEB_UPLOAD_QUEUE_FILES) reason = "queue-full";
    else if (bytes + file.size > MAX_WEB_UPLOAD_QUEUE_BYTES) reason = "queue-bytes-exceeded";
    if (reason) return { file, accepted: false, reason };
    count += 1;
    bytes += file.size;
    return { file, accepted: true };
  });
  return { decisions, nextBudget: { count, bytes } };
}

export function releaseUploadBudget(
  currentBudget: UploadQueueBudget,
  file: Pick<File, "size">,
): UploadQueueBudget {
  return {
    count: Math.max(0, currentBudget.count - 1),
    bytes: Math.max(0, currentBudget.bytes - file.size),
  };
}

export function canUploadDirectly(file: File, maxBytes = MAX_AUDIO_BYTES): boolean {
  return file.size <= maxBytes && /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(file.name);
}

/** Metadaten sind optional: ein nicht unterstützter Browser-Codec darf den
 * direkten Cloud-Upload nicht verhindern (z. B. ALAC in einer M4A-Datei). */
export function readAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const finish = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    const timer = setTimeout(finish, 4000);
    audio.preload = "metadata";
    audio.onloadedmetadata = finish;
    audio.onerror = finish;
    audio.src = url;
  });
}

export async function decodeAudio(file: Blob, local = false, interfaceLanguage: InterfaceLanguage = "de"): Promise<DecodedAudio> {
  // Vollständiges Dekodieren braucht deutlich mehr RAM als die komprimierte Datei.
  if (file.size > MAX_WEB_UPLOAD_FILE_BYTES) throw new Error(uiText(interfaceLanguage, "Zum Aufteilen im Browser bitte eine Datei unter 100 MB verwenden oder die Aufnahme als MP3 unter 24 MB exportieren.", "To split audio in the browser, use a file under 100 MB or export the recording as an MP3 under 24 MB."));
  const duration = await readAudioDuration(file);
  if (duration > 1800) throw new Error(uiText(interfaceLanguage, "Zum Aufteilen im Browser bitte Abschnitte bis 30 Minuten verwenden oder als MP3 unter 24 MB exportieren.", "To split audio in the browser, use sections up to 30 minutes or export as an MP3 under 24 MB."));
  const ctx = new AudioContext({ sampleRate: local ? 16000 : 48000 });
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > 1800) throw new Error(uiText(interfaceLanguage, "Bitte Abschnitte bis 30 Minuten verwenden.", "Please use sections up to 30 minutes."));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    return { channels, sampleRate: decoded.sampleRate, duration: decoded.duration };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Bitte") || error.message.startsWith("Please"))) throw error;
    throw new Error(uiText(interfaceLanguage, "Der Browser kann dieses Audio nicht öffnen. Bitte als MP3 oder WAV exportieren. Bei großen Apple-Lossless-M4A-Dateien hilft auch Safari.", "The browser cannot open this audio. Export it as MP3 or WAV. Safari may also help with large Apple Lossless M4A files."));
  } finally {
    await ctx.close();
  }
}

/** Keine Lücken oder Überlappungen. Suche in den letzten 15 s vor dem Limit
 * das leiseste 200-ms-Fenster, damit Schnitte möglichst in Sprechpausen liegen. */
export function splitAudio(channels: Float32Array[], sampleRate: number, maxBytes = MAX_AUDIO_BYTES, interfaceLanguage: InterfaceLanguage = "de"): AudioRange[] {
  const length = channels[0]?.length ?? 0;
  if (!length || !channels.every((c) => c.length === length) || sampleRate <= 0) throw new Error(uiText(interfaceLanguage, "Ungültige Audiodaten.", "Invalid audio data."));
  const maxSamples = Math.floor((maxBytes - 44) / (2 * channels.length));
  if (maxSamples < 1) throw new Error(uiText(interfaceLanguage, "Audio-Limit zu klein.", "Audio limit is too small."));
  const ranges: AudioRange[] = [];
  let start = 0;
  while (start < length) {
    let end = Math.min(length, start + maxSamples);
    if (end < length) {
      const windowSize = Math.max(1, Math.floor(sampleRate * 0.2));
      const from = Math.max(start + Math.floor(maxSamples * 0.8), end - 15 * sampleRate);
      let bestEnergy = Infinity;
      const limit = end;
      for (let p = from; p + windowSize <= limit; p += windowSize) {
        let energy = 0;
        for (const channel of channels) {
          for (let i = p; i < p + windowSize; i++) energy += channel[i] * channel[i];
        }
        if (energy <= bestEnergy) {
          bestEnergy = energy;
          end = p + Math.floor(windowSize / 2);
        }
      }
    }
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

export function encodeWav(channels: Float32Array[], sampleRate: number, range: AudioRange): ArrayBuffer {
  const count = range.end - range.start;
  const buffer = new ArrayBuffer(44 + count * channels.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
  write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, buffer.byteLength - 44, true);
  let offset = 44;
  for (let i = range.start; i < range.end; i++) for (const channel of channels) {
    const sample = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    offset += 2;
  }
  return buffer;
}

export async function transcribeUpload(
  file: File,
  options: UploadTranscriptionOptions,
  progress: (detail: string, partial: string) => void,
  dependencies = { decode: decodeAudio, duration: readAudioDuration, transcribe: transcribeWithCloudProvider }
): Promise<{ raw: string; duration: number }> {
  const provider = options.provider || "openai";
  const interfaceLanguage = options.interfaceLanguage ?? "de";
  if (provider !== "openai-compatible" && !options.apiKey?.trim()) {
    throw new Error(uiText(interfaceLanguage, `Bitte trage deinen ${provider === "groq" ? "Groq" : "OpenAI"} API-Key in den Einstellungen ein.`, `Add your ${provider === "groq" ? "Groq" : "OpenAI"} API key in Settings.`));
  }
  const request: CloudTranscriptionRequest = {
    ...options,
    provider,
    model: options.model || "gpt-transcribe",
  };
  const maxBytes = request.maxAudioBytes
    ?? (provider === "groq" ? MAX_GROQ_AUDIO_BYTES
      : provider === "openai-compatible" ? DEFAULT_COMPATIBLE_AUDIO_BYTES
        : MAX_AUDIO_BYTES);
  if (!file.size) throw new Error(uiText(interfaceLanguage, "Die Audiodatei ist leer.", "The audio file is empty."));
  if (canUploadDirectly(file, maxBytes)) {
    progress(uiText(interfaceLanguage, "Originaldatei", "Original file"), "");
    const duration = dependencies.duration(file);
    const raw = await dependencies.transcribe(file, { ...request, fileName: file.name });
    return { raw, duration: await duration };
  }
  progress(uiText(interfaceLanguage, "Audio wird für Abschnitte vorbereitet …", "Preparing audio segments …"), "");
  const audio = await dependencies.decode(file, false, interfaceLanguage);
  const ranges = splitAudio(audio.channels, audio.sampleRate, maxBytes, interfaceLanguage);
  const texts: string[] = [];
  for (const [i, range] of ranges.entries()) {
    request.signal?.throwIfAborted();
    progress(uiText(interfaceLanguage, `Abschnitt ${i + 1} von ${ranges.length}`, `Segment ${i + 1} of ${ranges.length}`), texts.join("\n\n"));
    const blob = new Blob([encodeWav(audio.channels, audio.sampleRate, range)], { type: "audio/wav" });
    texts.push(await dependencies.transcribe(blob, {
      ...request, fileName: `abschnitt-${i + 1}.wav`,
      context: `${request.context ?? ""}${texts.length ? ` Vorheriger Abschnitt (nur Kontext): ${texts.at(-1)!.slice(-600)}` : ""}`,
    }));
  }
  return { raw: texts.join("\n\n"), duration: audio.duration };
}
