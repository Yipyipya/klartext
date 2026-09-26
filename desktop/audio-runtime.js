(function exposeAudioRuntime(root) {
  const DEFAULT_SILENCE_MS = 9_000;
  const DEFAULT_NO_SPEECH_MS = 20_000;
  const SYSTEM_SAMPLE_RATE = 16_000;
  const MAX_SYSTEM_DICTATION_SECONDS = 10 * 60;
  const MAX_SYSTEM_DICTATION_SAMPLES = SYSTEM_SAMPLE_RATE * MAX_SYSTEM_DICTATION_SECONDS;
  const MAX_SYSTEM_AUDIO_BYTES = 44 + MAX_SYSTEM_DICTATION_SAMPLES * 2;
  const MAX_SYSTEM_TEXT_LENGTH = 1_000_000;

  function payloadError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function normalizeAudioBuffer(value) {
    let audio;
    if (value instanceof ArrayBuffer) {
      audio = value;
    } else if (ArrayBuffer.isView(value)) {
      audio = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    } else {
      throw payloadError("SYSTEM_AUDIO_INVALID", "Audio-Payload ist kein Binärpuffer");
    }
    if (!audio.byteLength) throw payloadError("SYSTEM_AUDIO_INVALID", "Audio-Payload ist leer");
    if (audio.byteLength > MAX_SYSTEM_AUDIO_BYTES) {
      throw payloadError("SYSTEM_AUDIO_TOO_LARGE", "Audio-Payload überschreitet die maximale Diktatdauer");
    }
    return audio;
  }

  function validateSystemResultPayload(value, quality) {
    const payload = typeof value === "string" ? { text: value, audio: null } : value;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw payloadError("SYSTEM_RESULT_INVALID", "Ungültiges Aufnahmeergebnis");
    }
    if (quality) return { text: "", audio: normalizeAudioBuffer(payload.audio) };
    if (typeof payload.text !== "string") {
      throw payloadError("SYSTEM_TEXT_INVALID", "Transkript-Payload ist kein Text");
    }
    if (payload.text.length > MAX_SYSTEM_TEXT_LENGTH) {
      throw payloadError("SYSTEM_TEXT_TOO_LARGE", "Transkript-Payload ist zu groß");
    }
    return { text: payload.text, audio: null };
  }

  async function ensureAudioContextRunning(context) {
    if (!context) throw new Error("AudioContext fehlt");
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") throw new Error(`AudioContext ist ${context.state}`);
    return context;
  }

  function createSilenceMonitor(options = {}) {
    const now = options.now ?? Date.now;
    const silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
    const noSpeechMs = options.noSpeechMs ?? DEFAULT_NO_SPEECH_MS;
    const minimumVoiceRms = options.minimumVoiceRms ?? 0.0015;
    let startedAt = now();
    let lastVoiceAt = 0;
    let voiceFrames = 0;
    let heardVoice = false;
    let stopSent = false;

    return {
      reset() {
        startedAt = now();
        lastVoiceAt = 0;
        voiceFrames = 0;
        heardVoice = false;
        stopSent = false;
      },
      observeRms(value) {
        const rms = Number(value);
        if (!Number.isFinite(rms) || rms < minimumVoiceRms) {
          voiceFrames = 0;
          return false;
        }
        voiceFrames += 1;
        if (voiceFrames >= 2) {
          heardVoice = true;
          lastVoiceAt = now();
          return true;
        }
        return false;
      },
      shouldAutoStop() {
        if (stopSent) return false;
        const elapsed = now() - (heardVoice ? lastVoiceAt : startedAt);
        const limit = heardVoice ? silenceMs : noSpeechMs;
        if (elapsed < limit) return false;
        stopSent = true;
        return true;
      },
      hasHeardVoice() {
        return heardVoice;
      },
    };
  }

  const api = {
    DEFAULT_SILENCE_MS,
    DEFAULT_NO_SPEECH_MS,
    MAX_SYSTEM_DICTATION_SECONDS,
    MAX_SYSTEM_DICTATION_SAMPLES,
    MAX_SYSTEM_AUDIO_BYTES,
    MAX_SYSTEM_TEXT_LENGTH,
    normalizeAudioBuffer,
    validateSystemResultPayload,
    ensureAudioContextRunning,
    createSilenceMonitor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.NivuneAudioRuntime = api;
})(typeof window !== "undefined" ? window : null);
