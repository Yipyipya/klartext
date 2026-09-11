(function exposeWakeController(root) {
  const START_LABEL = "Hey Klartext";
  const STOP_LABEL = "Klartext fertig";
  const START_CONFIRM_QUIET_MS = 250;
  const START_LEAD_IN_QUIET_MS = 150;
  const CANDIDATE_TIMEOUT_MS = 2_000;
  const START_SENSITIVITY = Object.freeze({
    minScores: 3,
    threshold: 0.42,
    averagedThreshold: 0.16,
  });

  function detectionSensitivity(_recording) {
    return START_SENSITIVITY;
  }

  function keywordAction(label, recording) {
    if (label === START_LABEL && !recording) return "start";
    return "ignore";
  }

  function hasRequiredLeadIn(action, quietBeforeMs) {
    return action === "start" && Number(quietBeforeMs) >= START_LEAD_IN_QUIET_MS;
  }

  function trimTailMs(_reason) {
    // Nie pauschal mehrere Sekunden entfernen. Der Endbefehl wird gezielt aus
    // dem fertigen Text gestrichen; Audio zu kürzen kann dagegen letzte
    // diktierte Wörter unwiederbringlich abschneiden.
    return 0;
  }

  function stripTrailingStopCommand(text) {
    return String(text || "")
      .replace(/(?:\s*["'„“”]?Klartext[\s,.-]+fertig["'„“”]?[.!?…]*)+\s*$/iu, "")
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
        if (action !== "start" || recording) return null;
        const currentTime = now();
        candidate = {
          action,
          details,
          createdAt: currentTime,
          quietSince: null,
        };
        return { ...candidate, state: "detected" };
      },
      observeQuiet(quiet) {
        const currentTime = now();
        if (!candidate) return null;
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
        if (currentTime - candidate.quietSince < START_CONFIRM_QUIET_MS) return null;
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
    START_LEAD_IN_QUIET_MS,
    CANDIDATE_TIMEOUT_MS,
    START_SENSITIVITY,
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
