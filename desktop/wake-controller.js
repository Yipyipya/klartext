(function exposeWakeController(root) {
  const START_LABEL = "Hey Klartext";
  const STOP_LABEL = "Klartext fertig";
  const SILENCE_MS = 9_000;
  const VOICE_THRESHOLD = 0.55;
  const START_SENSITIVITY = Object.freeze({
    minScores: 3,
    threshold: 0.45,
    averagedThreshold: 0.18,
  });
  const STOP_SENSITIVITY = Object.freeze({
    minScores: 2,
    threshold: 0.38,
    averagedThreshold: 0.14,
  });

  function detectionSensitivity(recording) {
    return recording ? STOP_SENSITIVITY : START_SENSITIVITY;
  }

  function keywordAction(label, recording) {
    if (label === START_LABEL && !recording) return "start";
    if (label === STOP_LABEL && recording) return "stop";
    return "ignore";
  }

  function trimTailMs(reason) {
    if (reason === "wake-command") return 2_000;
    if (reason === "silence") return 8_000;
    return 0;
  }

  function stripTrailingStopCommand(text) {
    return String(text || "")
      .replace(/\s*["'„“”]?Klartext[\s,.-]+fertig["'„“”]?[.!?…]*\s*$/iu, "")
      .trimEnd();
  }

  function createSilenceGate(options = {}) {
    const silenceMs = options.silenceMs ?? SILENCE_MS;
    const voiceThreshold = options.voiceThreshold ?? VOICE_THRESHOLD;
    const now = options.now ?? Date.now;
    let recording = false;
    let lastVoiceAt = 0;
    let stopSent = false;

    return {
      setRecording(active) {
        recording = Boolean(active);
        stopSent = false;
        lastVoiceAt = recording ? now() : 0;
      },
      isRecording() {
        return recording;
      },
      observe(probability) {
        if (recording && Number(probability) >= voiceThreshold) lastVoiceAt = now();
      },
      shouldAutoStop() {
        if (!recording || stopSent || now() - lastVoiceAt < silenceMs) return false;
        stopSent = true;
        return true;
      },
      remainingMs() {
        if (!recording) return null;
        return Math.max(0, silenceMs - (now() - lastVoiceAt));
      },
    };
  }

  const api = {
    START_LABEL,
    STOP_LABEL,
    SILENCE_MS,
    VOICE_THRESHOLD,
    START_SENSITIVITY,
    STOP_SENSITIVITY,
    detectionSensitivity,
    keywordAction,
    trimTailMs,
    stripTrailingStopCommand,
    createSilenceGate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KlartextWakeController = api;
})(typeof window !== "undefined" ? window : null);
