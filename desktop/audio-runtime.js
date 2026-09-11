(function exposeAudioRuntime(root) {
  const DEFAULT_SILENCE_MS = 9_000;
  const DEFAULT_NO_SPEECH_MS = 20_000;

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
    ensureAudioContextRunning,
    createSilenceMonitor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KlartextAudioRuntime = api;
})(typeof window !== "undefined" ? window : null);
