import { MAX_AUDIO_BYTES, transcribeWithOpenAI, type CloudTranscriptionOptions } from "./cloud-transcribe";

export type DecodedAudio = { channels: Float32Array[]; sampleRate: number; duration: number };
export type AudioRange = { start: number; end: number };

export function canUploadDirectly(file: File): boolean {
  return file.size <= MAX_AUDIO_BYTES && /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(file.name);
}

/** Metadaten sind optional: ein nicht unterstützter Browser-Codec darf den
 * direkten Cloud-Upload nicht verhindern (z. B. ALAC in einer M4A-Datei). */
export function readAudioDuration(file: File): Promise<number> {
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

export async function decodeAudio(file: File, local = false): Promise<DecodedAudio> {
  // Vollständiges Dekodieren braucht deutlich mehr RAM als die komprimierte Datei.
  if (file.size > 100_000_000) throw new Error("Zum Aufteilen im Browser bitte eine Datei unter 100 MB verwenden oder die Aufnahme als MP3 unter 24 MB exportieren.");
  const duration = await readAudioDuration(file);
  if (duration > 1800) throw new Error("Zum Aufteilen im Browser bitte Abschnitte bis 30 Minuten verwenden oder als MP3 unter 24 MB exportieren.");
  const ctx = new AudioContext({ sampleRate: local ? 16000 : 48000 });
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > 1800) throw new Error("Bitte Abschnitte bis 30 Minuten verwenden.");
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    return { channels, sampleRate: decoded.sampleRate, duration: decoded.duration };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Bitte")) throw error;
    throw new Error("Der Browser kann dieses Audio nicht öffnen. Bitte als MP3 oder WAV exportieren. Bei großen Apple-Lossless-M4A-Dateien hilft auch Safari.");
  } finally {
    await ctx.close();
  }
}

/** Keine Lücken oder Überlappungen. Suche in den letzten 15 s vor dem Limit
 * das leiseste 200-ms-Fenster, damit Schnitte möglichst in Sprechpausen liegen. */
export function splitAudio(channels: Float32Array[], sampleRate: number, maxBytes = MAX_AUDIO_BYTES): AudioRange[] {
  const length = channels[0]?.length ?? 0;
  if (!length || !channels.every((c) => c.length === length) || sampleRate <= 0) throw new Error("Ungültige Audiodaten.");
  const maxSamples = Math.floor((maxBytes - 44) / (2 * channels.length));
  if (maxSamples < 1) throw new Error("Audio-Limit zu klein.");
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
  options: CloudTranscriptionOptions,
  progress: (detail: string, partial: string) => void,
  dependencies = { decode: decodeAudio, duration: readAudioDuration, transcribe: transcribeWithOpenAI }
): Promise<{ raw: string; duration: number }> {
  if (!options.apiKey.trim()) throw new Error("Bitte trage deinen OpenAI API-Key in den Einstellungen ein.");
  if (!file.size) throw new Error("Die Audiodatei ist leer.");
  if (canUploadDirectly(file)) {
    progress("Originaldatei", "");
    const duration = dependencies.duration(file);
    const raw = await dependencies.transcribe(file, { ...options, fileName: file.name });
    return { raw, duration: await duration };
  }
  progress("Audio wird für Abschnitte vorbereitet …", "");
  const audio = await dependencies.decode(file);
  const ranges = splitAudio(audio.channels, audio.sampleRate);
  const texts: string[] = [];
  for (const [i, range] of ranges.entries()) {
    options.signal?.throwIfAborted();
    progress(`Abschnitt ${i + 1} von ${ranges.length}`, texts.join("\n\n"));
    const blob = new Blob([encodeWav(audio.channels, audio.sampleRate, range)], { type: "audio/wav" });
    texts.push(await dependencies.transcribe(blob, {
      ...options, fileName: `abschnitt-${i + 1}.wav`,
      context: `${options.context ?? ""}${texts.length ? ` Vorheriger Abschnitt (nur Kontext): ${texts.at(-1)!.slice(-600)}` : ""}`,
    }));
  }
  return { raw: texts.join("\n\n"), duration: audio.duration };
}
