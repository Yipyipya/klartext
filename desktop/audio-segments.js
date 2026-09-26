// Aufteilung langer Aufnahmen (z. B. aufgezeichneter Meetings) in Abschnitte.
// Läuft im Audio-Renderer (als klassisches Skript) und in Node-Tests (CommonJS).
(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.nivuneAudioSegments = api;
})(typeof self !== "undefined" ? self : globalThis, () => {
  const SAMPLE_RATE = 16000;
  const WAV_HEADER_BYTES = 44;
  /** Obergrenze für lange Dateien; begrenzt den Arbeitsspeicher beim Dekodieren. */
  const MAX_SEGMENTED_SECONDS = 2 * 60 * 60;
  /** Lokale Whisper-Verarbeitung in Abschnitten: Fortschritt und Abbruch zwischen Abschnitten. */
  const LOCAL_SEGMENT_SECONDS = 5 * 60;

  /** Mischt alle Kanäle zu Mono. */
  function mixToMono(channels) {
    const length = channels[0]?.length || 0;
    if (channels.length === 1) return channels[0];
    const mono = new Float32Array(length);
    for (const channel of channels) {
      for (let index = 0; index < length; index += 1) mono[index] += channel[index] / channels.length;
    }
    return mono;
  }

  /**
   * Teilt ohne Lücken oder Überlappungen. In den letzten 15 Sekunden vor der
   * Grenze wird das leiseste 200-ms-Fenster gesucht, damit Schnitte möglichst
   * in Sprechpausen liegen.
   */
  function splitRanges(samples, sampleRate, maxSamples) {
    const length = samples?.length || 0;
    if (!length || sampleRate <= 0) throw new Error("AUDIO_DECODE_EMPTY");
    if (!Number.isSafeInteger(maxSamples) || maxSamples < sampleRate) throw new Error("AUDIO_SEGMENT_LIMIT_INVALID");
    const ranges = [];
    let start = 0;
    while (start < length) {
      let end = Math.min(length, start + maxSamples);
      if (end < length) {
        const windowSize = Math.max(1, Math.floor(sampleRate * 0.2));
        const from = Math.max(start + Math.floor(maxSamples * 0.8), end - 15 * sampleRate);
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

  /** Maximale Samples je Abschnitt, damit ein 16-Bit-Mono-WAV unter maxBytes bleibt. */
  function maxSamplesForBytes(maxBytes) {
    return Math.floor((maxBytes - WAV_HEADER_BYTES) / 2);
  }

  function encodeWavMono(samples, sampleRate, range) {
    const count = range.end - range.start;
    const buffer = new ArrayBuffer(WAV_HEADER_BYTES + count * 2);
    const view = new DataView(buffer);
    const write = (offset, value) => {
      for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    };
    write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
    write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, count * 2, true);
    let offset = WAV_HEADER_BYTES;
    for (let index = range.start; index < range.end; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
    return buffer;
  }

  /**
   * Letzter Teil des vorigen Segments als reiner Kontext für das nächste.
   * Anbieter kürzen den Kontext auf etwa 500 Zeichen am Ende; deshalb werden
   * Basis-Kontext und Übergang so begrenzt, dass der Übergang vollständig bleibt.
   */
  function continuationContext(baseContext, previousText) {
    const tail = String(previousText || "").replace(/\s+/g, " ").trim().slice(-280).trim();
    const base = String(baseContext || "").trim();
    if (!tail) return base;
    const shortBase = base.slice(0, 150).trim();
    return `${shortBase}${shortBase ? " " : ""}Vorheriger Abschnitt (nur Kontext, nicht wiederholen): ${tail}`;
  }

  return {
    SAMPLE_RATE,
    WAV_HEADER_BYTES,
    MAX_SEGMENTED_SECONDS,
    LOCAL_SEGMENT_SECONDS,
    mixToMono,
    splitRanges,
    maxSamplesForBytes,
    encodeWavMono,
    continuationContext,
  };
});
