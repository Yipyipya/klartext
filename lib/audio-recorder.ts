export interface AudioCapture {
  stop: () => Promise<Blob>;
  dispose: () => void;
}

/** Eine vollständige Aufnahme statt Safari-MP4-Fragmente und paralleler
 * SpeechRecognition. Format-Erkennung ist eine Präferenz, kein Erfolgsnachweis. */
export function createAudioCapture(stream: MediaStream, stopTimeoutMs = 10_000): AudioCapture {
  if (typeof MediaRecorder === "undefined") throw new Error("Dieser Browser unterstützt keine Audioaufnahme.");
  const formats = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  const candidates: Array<string | undefined> = formats.filter((format) =>
    typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(format)
  );
  candidates.push(undefined); // Browser-Standard als letzter Versuch.

  for (const mimeType of candidates) {
    let recorder: MediaRecorder | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const chunks: Blob[] = [];
    let settled = false;
    let stopping = false;
    let resolveResult!: (result: Blob | Error) => void;
    const result = new Promise<Blob | Error>((resolve) => { resolveResult = resolve; });
    const finish = (value: Blob | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveResult(value);
    };
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const activeRecorder = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => finish(new Error("Die Audioaufnahme wurde unterbrochen. Bitte erneut aufnehmen."));
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: activeRecorder.mimeType || chunks[0]?.type || mimeType || "" });
        finish(audio.size ? audio : new Error("Die Aufnahme enthält kein Audio. Bitte das Mikrofon prüfen und erneut aufnehmen."));
      };
      recorder.start(); // Erst beim Stoppen einen vollständigen Container abgeben.
      return {
        async stop() {
          if (!stopping && !settled) {
            stopping = true;
            timeout = setTimeout(() => finish(new Error("Der Browser konnte die Aufnahme nicht abschließen. Bitte erneut aufnehmen.")), stopTimeoutMs);
            try {
              if (activeRecorder.state !== "inactive") activeRecorder.stop();
              // Bei einem automatischen Stop können dataavailable/stop noch ausstehen.
            } catch {
              finish(new Error("Die Aufnahme konnte nicht abgeschlossen werden. Bitte erneut aufnehmen."));
            }
          }
          const value = await result;
          if (value instanceof Error) throw value;
          return value;
        },
        dispose() {
          activeRecorder.ondataavailable = null;
          activeRecorder.onstop = null;
          activeRecorder.onerror = null;
          if (activeRecorder.state !== "inactive") {
            try { activeRecorder.stop(); } catch { /* bereits beendet */ }
          }
          finish(new Error("Audioaufnahme abgebrochen."));
          chunks.length = 0;
        },
      };
    } catch {
      // Auch bei positivem isTypeSupported kann der Encoder beim Start scheitern.
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* nächstes Format */ }
      }
    }
  }
  throw new Error("Der Browser konnte keine Audioaufnahme starten. Bitte die Mikrofonfreigabe prüfen und Safari aktualisieren.");
}
