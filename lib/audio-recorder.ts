import { uiText, type InterfaceLanguage } from "../shared/i18n";

export const MAX_LIVE_RECORDING_SECONDS = 10 * 60;

export interface AudioCapture {
  stop: () => Promise<Blob>;
  dispose: () => void;
}

/** Eine vollständige Aufnahme statt Safari-MP4-Fragmente und paralleler
 * SpeechRecognition. Format-Erkennung ist eine Präferenz, kein Erfolgsnachweis. */
export function createAudioCapture(stream: MediaStream, stopTimeoutMs = 10_000, interfaceLanguage: InterfaceLanguage = "de"): AudioCapture {
  const text = (german: string, english: string) => uiText(interfaceLanguage, german, english);
  if (typeof MediaRecorder === "undefined") throw new Error(text("Dieser Browser unterstützt keine Audioaufnahme.", "This browser does not support audio recording."));
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
      recorder.onerror = () => finish(new Error(text("Die Audioaufnahme wurde unterbrochen. Bitte erneut aufnehmen.", "The audio recording was interrupted. Please try again.")));
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: activeRecorder.mimeType || chunks[0]?.type || mimeType || "" });
        finish(audio.size ? audio : new Error(text("Die Aufnahme enthält kein Audio. Bitte das Mikrofon prüfen und erneut aufnehmen.", "The recording contains no audio. Check the microphone and try again.")));
      };
      recorder.start(); // Erst beim Stoppen einen vollständigen Container abgeben.
      return {
        async stop() {
          if (!stopping && !settled) {
            stopping = true;
            timeout = setTimeout(() => finish(new Error(text("Der Browser konnte die Aufnahme nicht abschließen. Bitte erneut aufnehmen.", "The browser could not finish the recording. Please try again."))), stopTimeoutMs);
            try {
              if (activeRecorder.state !== "inactive") activeRecorder.stop();
              // Bei einem automatischen Stop können dataavailable/stop noch ausstehen.
            } catch {
              finish(new Error(text("Die Aufnahme konnte nicht abgeschlossen werden. Bitte erneut aufnehmen.", "The recording could not be completed. Please try again.")));
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
          finish(new Error(text("Audioaufnahme abgebrochen.", "Audio recording cancelled.")));
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
  throw new Error(text("Der Browser konnte keine Audioaufnahme starten. Bitte die Mikrofonfreigabe prüfen und Safari aktualisieren.", "The browser could not start audio recording. Check microphone permission and update Safari."));
}
