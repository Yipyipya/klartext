const path = require("path");

const ONBOARDING_SCHEMA_VERSION = 1;

function normalize(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    completed: source.completed === true,
    step: Math.max(1, Math.min(4, Math.round(Number(source.step) || 1))),
    sampleCompleted: source.sampleCompleted === true,
    completedAt: Number.isFinite(source.completedAt) ? source.completedAt : null,
  };
}

function createOnboardingStore({ fs, statePath, now = Date.now, log = () => {} }) {
  const recoveryPath = `${statePath}.recovery`;
  let state = normalize(null);

  function ensureDirectory() {
    fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
  }

  function write(next) {
    ensureDirectory();
    const pending = `${statePath}.next`;
    fs.writeFileSync(pending, JSON.stringify(next), { encoding: "utf8", mode: 0o600 });
    try { fs.chmodSync(pending, 0o600); } catch (error) { log("Einrichtungsdatei-Rechte konnten nicht gesetzt werden", error); }
    fs.renameSync(pending, statePath);
  }

  function load() {
    let raw = null;
    try {
      raw = fs.readFileSync(statePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.schemaVersion !== ONBOARDING_SCHEMA_VERSION) throw new Error("ONBOARDING_SCHEMA_INVALID");
      state = normalize(parsed);
    } catch (error) {
      state = normalize(null);
      if (raw !== null) {
        try {
          if (!fs.existsSync(recoveryPath)) fs.writeFileSync(recoveryPath, raw, { encoding: "utf8", mode: 0o600 });
        } catch { /* best effort */ }
        log("Beschädigter Einrichtungsstand wurde gesichert", error);
      }
    }
    return structuredClone(state);
  }

  function update(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("ONBOARDING_UPDATE_INVALID");
    const allowed = new Set(["step", "sampleCompleted"]);
    if (Object.keys(patch).some((key) => !allowed.has(key))) throw new Error("ONBOARDING_UPDATE_INVALID");
    state = normalize({ ...state, ...patch, completed: false, completedAt: null });
    write(state);
    return structuredClone(state);
  }

  function complete() {
    if (!state.sampleCompleted) throw new Error("ONBOARDING_SAMPLE_REQUIRED");
    state = normalize({ ...state, completed: true, step: 4, completedAt: now() });
    write(state);
    return structuredClone(state);
  }

  function current() {
    return structuredClone(state);
  }

  return { load, update, complete, current, paths: { statePath, recoveryPath } };
}

module.exports = { ONBOARDING_SCHEMA_VERSION, createOnboardingStore };
