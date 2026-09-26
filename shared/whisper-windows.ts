// Lokale Whisper-Transkription langer Audios in eigenen Fenstern unter 30 s.
//
// Die in Transformers.js eingebaute Fensterung (chunk_length_s + stride) setzt
// überlappende Fenster ohne Zeitmarken wieder zusammen und verlor dabei im
// Praxistest mit einer einstündigen Aufnahme rund die Hälfte des Textes.
// Whisper verarbeitet bis zu 30 Sekunden nativ; deshalb schneiden wir selbst an
// der leisesten Stelle vor der Grenze und fügen die Einzeltexte aneinander.

export const WHISPER_WINDOW_SECONDS = 28;

export interface SampleRange {
  start: number;
  end: number;
}

/** Lückenlose Fenster; Schnitt an der leisesten 200-ms-Stelle im letzten Fünftel. */
export function speechWindows(samples: Float32Array, sampleRate: number, maxSeconds = WHISPER_WINDOW_SECONDS): SampleRange[] {
  const length = samples.length;
  if (!length) return [];
  const maxSamples = Math.floor(maxSeconds * sampleRate);
  if (maxSamples < sampleRate) throw new Error("WHISPER_WINDOW_INVALID");
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.2));
  const ranges: SampleRange[] = [];
  let start = 0;
  while (start < length) {
    let end = Math.min(length, start + maxSamples);
    if (end < length) {
      const from = start + Math.floor(maxSamples * 0.8);
      let bestEnergy = Infinity;
      const limit = end;
      for (let position = from; position + windowSize <= limit; position += windowSize) {
        let energy = 0;
        for (let index = position; index < position + windowSize; index += 1) energy += samples[index] * samples[index];
        if (energy <= bestEnergy) {
          bestEnergy = energy;
          end = position + Math.floor(windowSize / 2);
        }
      }
    }
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

type WhisperOutput = { text?: string } | Array<{ text?: string }>;
export type WhisperTranscriber = (audio: Float32Array, options: Record<string, unknown>) => Promise<WhisperOutput>;

function outputText(output: WhisperOutput): string {
  return (Array.isArray(output) ? output.map((item) => item.text ?? "").join(" ") : output.text ?? "").trim();
}

/**
 * Transkribiert Fenster für Fenster. `shouldStop` erlaubt Abbruch zwischen
 * Fenstern; `onWindow` meldet Fortschritt.
 */
export async function transcribeInWindows(
  transcriber: WhisperTranscriber,
  samples: Float32Array,
  sampleRate: number,
  options: { language?: string },
  hooks: { shouldStop?: () => boolean; onWindow?: (current: number, total: number) => void } = {},
): Promise<string> {
  const windows = speechWindows(samples, sampleRate);
  const texts: string[] = [];
  for (const [index, window] of windows.entries()) {
    if (hooks.shouldStop?.()) break;
    hooks.onWindow?.(index + 1, windows.length);
    // Sehr kurze Reste (unter 0,3 s) enthalten keine Sprache und neigen zu Halluzinationen.
    if (window.end - window.start < sampleRate * 0.3 && windows.length > 1) continue;
    const text = outputText(await transcriber(samples.subarray(window.start, window.end), {
      language: options.language || undefined,
      task: "transcribe",
    }));
    if (text) texts.push(text);
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}
