(function exposeWakeController(root) {
  const START_LABEL = "Hey Klartext";
  const STOP_LABEL = "Klartext fertig";
  const START_CONFIRM_QUIET_MS = 250;
  const STOP_CONFIRM_QUIET_MS = 550;
  const START_LEAD_IN_QUIET_MS = 150;
  // Do not require silence before the stop phrase. Microphone noise and normal
  // sentence rhythm made this reject intentional commands. The post-command
  // quiet window still distinguishes an actual ending from continuous speech.
  const STOP_LEAD_IN_QUIET_MS = 0;
  const CANDIDATE_TIMEOUT_MS = 2_000;
  const START_SENSITIVITY = Object.freeze({
    minScores: 3,
    threshold: 0.42,
    averagedThreshold: 0.16,
  });
  const STOP_SENSITIVITY = Object.freeze({
    minScores: 2,
    threshold: 0.36,
    averagedThreshold: 0.12,
  });

  function detectionSensitivity(recording) {
    return recording ? STOP_SENSITIVITY : START_SENSITIVITY;
  }

  function keywordAction(label, recording) {
    if (label === START_LABEL && !recording) return "start";
    if (label === STOP_LABEL && recording) return "stop";
    return "ignore";
  }

  function hasRequiredLeadIn(action, quietBeforeMs) {
    const required = action === "stop" ? STOP_LEAD_IN_QUIET_MS : START_LEAD_IN_QUIET_MS;
    return Number(quietBeforeMs) >= required;
  }

  function trimTailMs(_reason) {
    // Nie pauschal mehrere Sekunden entfernen. Der Endbefehl wird gezielt aus
    // dem fertigen Text gestrichen; Audio zu kürzen kann dagegen letzte
    // diktierte Wörter unwiederbringlich abschneiden.
    return 0;
  }

  function stripTrailingStopCommand(text) {
    return String(text || "")
      .replace(/\s*["'„“”]?Klartext[\s,.-]+fertig["'„“”]?[.!?…]*\s*$/iu, "")
      .trimEnd();
  }

  function createCommandGate(options = {}) {
    const now = options.now ?? Date.now;
    let recording = false;
    let candidate = null;

    return {
      setRecording(active) {
        recording = Boolean(active);
        candidate = null;
      },
      isRecording() {
        return recording;
      },
      detect(action, details) {
        if ((action === "start" && recording) || (action === "stop" && !recording)) return false;
        if (action !== "start" && action !== "stop") return false;
        candidate = {
          action,
          details,
          createdAt: now(),
          quietSince: null,
        };
        return true;
      },
      observeQuiet(quiet) {
        if (!candidate) return null;
        const currentTime = now();
        if (currentTime - candidate.createdAt > CANDIDATE_TIMEOUT_MS) {
          const rejected = { ...candidate, state: "rejected" };
          candidate = null;
          return rejected;
        }
        if (!quiet) {
          candidate.quietSince = null;
          return null;
        }
        candidate.quietSince ??= currentTime;
        const requiredQuiet = candidate.action === "stop" ? STOP_CONFIRM_QUIET_MS : START_CONFIRM_QUIET_MS;
        if (currentTime - candidate.quietSince < requiredQuiet) return null;
        const confirmed = { ...candidate, state: "confirmed" };
        candidate = null;
        return confirmed;
      },
      cancelCandidate() {
        if (!candidate) return null;
        const rejected = { ...candidate, state: "rejected" };
        candidate = null;
        return rejected;
      },
    };
  }

  const api = {
    START_LABEL,
    STOP_LABEL,
    START_CONFIRM_QUIET_MS,
    STOP_CONFIRM_QUIET_MS,
    START_LEAD_IN_QUIET_MS,
    STOP_LEAD_IN_QUIET_MS,
    CANDIDATE_TIMEOUT_MS,
    START_SENSITIVITY,
    STOP_SENSITIVITY,
    detectionSensitivity,
    keywordAction,
    hasRequiredLeadIn,
    trimTailMs,
    stripTrailingStopCommand,
    createCommandGate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KlartextWakeController = api;
})(typeof window !== "undefined" ? window : null);
