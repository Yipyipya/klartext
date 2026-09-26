const path = require("path");
const crypto = require("crypto");

const RECORDING_SCHEMA_VERSION = 1;
const MAX_FRAGMENT_BYTES = 16_000_000;
const MAX_RECORDING_BYTES = 250_000_000;
const MAX_FRAGMENTS = 10_000;
const PROVIDERS = new Set(["local", "openai", "groq", "openai-compatible", "none", "deterministic", "ollama"]);

function text(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function safeId(value) {
  const id = text(value, 180);
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error("RECORDING_ID_INVALID");
  return id;
}

function safeProfile(value, fallbackProvider) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const provider = PROVIDERS.has(source.provider) ? source.provider : fallbackProvider;
  return {
    id: text(source.id, 120),
    provider,
    model: text(source.model, 200),
    baseUrl: text(source.baseUrl, 500),
    credentialRef: text(source.credentialRef, 500),
  };
}

function safePlan(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const dictionary = Array.isArray(source.dictionary) ? source.dictionary : [];
  return {
    transcription: safeProfile(source.transcription, "local"),
    refinement: safeProfile(source.refinement, "none"),
    language: text(source.language, 40),
    cleanupLevel: ["aus", "sanft", "stark"].includes(source.cleanupLevel) ? source.cleanupLevel : "sanft",
    context: text(source.context, 20_000),
    dictionary: dictionary.slice(0, 500).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const from = text(entry.from, 120).trim();
      const to = text(entry.to, 120).trim();
      return from && to ? [{ from, to }] : [];
    }),
  };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function publicRecovery(manifest) {
  const plan = manifest.plan || {};
  return {
    id: manifest.id,
    name: manifest.name,
    state: manifest.state,
    size: manifest.totalBytes,
    durationMs: manifest.durationMs,
    fragments: manifest.fragments.length,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    canProcess: manifest.fragments.length > 0,
    retrySafety: manifest.uncertainStage ? "confirmation-required" : "safe",
    uncertainStage: manifest.uncertainStage || null,
    error: manifest.error || null,
    metadata: manifest.metadata || {
      transcriptionProvider: plan.transcription?.provider || "",
      transcriptionModel: plan.transcription?.model || "",
      refinementProvider: plan.refinement?.provider || "",
      refinementModel: plan.refinement?.model || "",
      language: plan.language || "",
      durationMs: manifest.durationMs,
    },
  };
}

function createWorkspaceRecordingStore({ fs, rootPath, log = () => {}, now = Date.now }) {
  const settingsPath = path.join(rootPath, "settings.json");
  let retainAfterSuccess = false;

  function ensureRoot() {
    fs.mkdirSync(rootPath, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(rootPath, 0o700); } catch (error) { log("Audio-Speicherrechte konnten nicht gesetzt werden", error); }
  }

  function directoryFor(id) {
    return path.join(rootPath, safeId(id));
  }

  function manifestPath(id) {
    return path.join(directoryFor(id), "manifest.json");
  }

  function writeJsonAtomic(filePath, value) {
    const pending = `${filePath}.next`;
    fs.writeFileSync(pending, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    try { fs.chmodSync(pending, 0o600); } catch (error) { log("Manifest-Rechte konnten nicht gesetzt werden", error); }
    fs.renameSync(pending, filePath);
  }

  function readManifest(id) {
    const parsed = JSON.parse(fs.readFileSync(manifestPath(id), "utf8"));
    if (parsed?.schemaVersion !== RECORDING_SCHEMA_VERSION || parsed.id !== safeId(id) || !Array.isArray(parsed.fragments)) {
      throw new Error("RECORDING_MANIFEST_INVALID");
    }
    return parsed;
  }

  function writeManifest(manifest) {
    manifest.updatedAt = now();
    writeJsonAtomic(manifestPath(manifest.id), manifest);
  }

  function load() {
    ensureRoot();
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      retainAfterSuccess = parsed?.schemaVersion === 1 && parsed.retainAfterSuccess === true;
    } catch {
      retainAfterSuccess = false;
    }
    return listRecoverable();
  }

  function begin({ id, name, plan, interfaceLanguage, createdAt = now() }) {
    const normalizedId = safeId(id);
    const directory = directoryFor(normalizedId);
    if (fs.existsSync(directory)) throw new Error("RECORDING_ALREADY_EXISTS");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(directory, 0o700); } catch (error) { log("Aufnahmeordner-Rechte konnten nicht gesetzt werden", error); }
    const safe = safePlan(plan);
    const manifest = {
      schemaVersion: RECORDING_SCHEMA_VERSION,
      id: normalizedId,
      name: path.basename(text(name, 180) || "Aufnahme"),
      state: "recording",
      mimeType: "",
      totalBytes: 0,
      durationMs: 0,
      fragments: [],
      plan: safe,
      interfaceLanguage: text(interfaceLanguage, 10) || "de",
      rawText: "",
      uncertainStage: null,
      error: null,
      createdAt,
      updatedAt: createdAt,
    };
    writeJsonAtomic(manifestPath(normalizedId), manifest);
    return publicRecovery(manifest);
  }

  function appendFragment({ id, sequence, bytes, mimeType, durationMs }) {
    const manifest = readManifest(id);
    if (manifest.state !== "recording") throw new Error("RECORDING_NOT_ACTIVE");
    const payload = Buffer.from(bytes || []);
    if (!payload.length || payload.length > MAX_FRAGMENT_BYTES) throw new Error("RECORDING_FRAGMENT_INVALID");
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= MAX_FRAGMENTS) throw new Error("RECORDING_SEQUENCE_INVALID");
    const checksum = sha256(payload);
    if (sequence < manifest.fragments.length) {
      const existing = manifest.fragments[sequence];
      if (existing.size === payload.length && existing.sha256 === checksum) return publicRecovery(manifest);
      throw new Error("RECORDING_FRAGMENT_CONFLICT");
    }
    if (sequence !== manifest.fragments.length) throw new Error("RECORDING_FRAGMENT_OUT_OF_ORDER");
    if (manifest.totalBytes + payload.length > MAX_RECORDING_BYTES) throw new Error("RECORDING_TOO_LARGE");
    const normalizedMime = text(mimeType, 100).split(";")[0].trim().toLowerCase();
    if (!manifest.mimeType) manifest.mimeType = normalizedMime;
    if (manifest.mimeType !== normalizedMime) throw new Error("RECORDING_MIME_CHANGED");
    const fileName = `fragment-${String(sequence).padStart(5, "0")}.audio`;
    const filePath = path.join(directoryFor(id), fileName);
    const pending = `${filePath}.next`;
    fs.writeFileSync(pending, payload, { mode: 0o600 });
    try { fs.chmodSync(pending, 0o600); } catch (error) { log("Fragment-Rechte konnten nicht gesetzt werden", error); }
    fs.renameSync(pending, filePath);
    manifest.fragments.push({ sequence, fileName, size: payload.length, sha256: checksum });
    manifest.totalBytes += payload.length;
    manifest.durationMs = Math.max(manifest.durationMs, Math.max(0, Math.min(86_400_000, Math.round(Number(durationMs) || 0))));
    writeManifest(manifest);
    return publicRecovery(manifest);
  }

  function finalize(id, durationMs) {
    const manifest = readManifest(id);
    if (!manifest.fragments.length) throw new Error("RECORDING_EMPTY");
    if (manifest.state === "recording") manifest.state = "ready";
    manifest.durationMs = Math.max(manifest.durationMs, Math.max(0, Math.min(86_400_000, Math.round(Number(durationMs) || 0))));
    manifest.error = null;
    writeManifest(manifest);
    return publicRecovery(manifest);
  }

  function readAudio(id) {
    const manifest = readManifest(id);
    const parts = manifest.fragments.map((fragment) => {
      const bytes = fs.readFileSync(path.join(directoryFor(id), fragment.fileName));
      if (bytes.length !== fragment.size || sha256(bytes) !== fragment.sha256) throw new Error("RECORDING_FRAGMENT_CORRUPT");
      return bytes;
    });
    return { bytes: Buffer.concat(parts, manifest.totalBytes), manifest };
  }

  function transition(id, state, changes = {}) {
    const manifest = readManifest(id);
    Object.assign(manifest, changes, { state });
    writeManifest(manifest);
    return manifest;
  }

  function markQueued(id) {
    return transition(id, "queued", { error: null });
  }

  function markTranscriptionStarted(id, cloud) {
    return transition(id, "transcribing", { uncertainStage: cloud ? "transcription" : null, error: null });
  }

  function markTranscribed(id, rawText) {
    return transition(id, "transcribed", { rawText: text(rawText, 1_000_000), uncertainStage: null, error: null });
  }

  function markRefinementStarted(id, cloud) {
    return transition(id, "refining", { uncertainStage: cloud ? "refinement" : null, error: null });
  }

  function markFailed(id, error) {
    return transition(id, "failed", { error: text(error, 240) });
  }

  function complete(id) {
    if (!retainAfterSuccess) return remove(id);
    const manifest = readManifest(id);
    manifest.state = "completed";
    manifest.uncertainStage = null;
    manifest.error = null;
    manifest.rawText = "";
    manifest.metadata = publicRecovery(manifest).metadata;
    manifest.plan = null;
    writeManifest(manifest);
    return true;
  }

  function remove(id) {
    const directory = directoryFor(id);
    if (!fs.existsSync(directory)) return false;
    fs.rmSync(directory, { recursive: true, force: true });
    return true;
  }

  function listManifests() {
    ensureRoot();
    const result = [];
    for (const name of fs.readdirSync(rootPath)) {
      if (name === "settings.json" || name.endsWith(".next")) continue;
      try {
        const manifest = readManifest(name);
        result.push(manifest);
      } catch (error) {
        log("Arbeitsaufnahme konnte nicht gelesen werden", error);
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  function listRecoverable() {
    return listManifests().filter((manifest) => manifest.state !== "completed").map(publicRecovery);
  }

  function getRecovery(id) {
    const manifest = readManifest(id);
    return manifest.state === "completed" ? null : structuredClone(manifest);
  }

  function hasRetainedAudio(id) {
    try { return readManifest(id).state === "completed"; } catch { return false; }
  }

  function listRetainedIds() {
    return listManifests().filter((manifest) => manifest.state === "completed").map((manifest) => manifest.id);
  }

  function removeCompleted() {
    let count = 0;
    for (const manifest of listManifests()) {
      if (manifest.state === "completed" && remove(manifest.id)) count += 1;
    }
    return count;
  }

  function getRetention() {
    return retainAfterSuccess;
  }

  function setRetention(value) {
    retainAfterSuccess = value === true;
    ensureRoot();
    writeJsonAtomic(settingsPath, { schemaVersion: 1, retainAfterSuccess });
    if (!retainAfterSuccess) removeCompleted();
    return retainAfterSuccess;
  }

  return {
    load,
    begin,
    appendFragment,
    finalize,
    readAudio,
    markQueued,
    markTranscriptionStarted,
    markTranscribed,
    markRefinementStarted,
    markFailed,
    complete,
    remove,
    listRecoverable,
    getRecovery,
    hasRetainedAudio,
    listRetainedIds,
    removeCompleted,
    getRetention,
    setRetention,
    paths: { rootPath, settingsPath },
  };
}

module.exports = {
  MAX_FRAGMENT_BYTES,
  MAX_FRAGMENTS,
  MAX_RECORDING_BYTES,
  RECORDING_SCHEMA_VERSION,
  createWorkspaceRecordingStore,
};
