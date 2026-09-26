const path = require("path");

const HISTORY_SCHEMA_VERSION = 1;
const MAX_HISTORY_ENTRIES = 500;
const MAX_TEXT_LENGTH = 1_000_000;

function cleanString(value, max = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanOptional(value, max = 240) {
  const text = cleanString(value, max).trim();
  return text || null;
}

function cleanMetadata(value) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    transcriptionProvider: cleanString(metadata.transcriptionProvider, 40),
    transcriptionModel: cleanString(metadata.transcriptionModel, 200),
    refinementProvider: cleanString(metadata.refinementProvider, 40),
    refinementModel: cleanString(metadata.refinementModel, 200),
    language: cleanString(metadata.language, 40),
    durationMs: Number.isFinite(metadata.durationMs)
      ? Math.max(0, Math.min(86_400_000, Math.round(metadata.durationMs))) : 0,
  };
}

function cleanEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = cleanString(value.id, 180).trim();
  if (!id) return null;
  const createdAt = Number.isFinite(value.createdAt) ? Math.max(0, Math.round(value.createdAt)) : Date.now();
  const updatedAt = Number.isFinite(value.updatedAt) ? Math.max(createdAt, Math.round(value.updatedAt)) : createdAt;
  const source = value.source === "recording" ? "recording" : "file";
  const status = value.status === "failed" ? "failed" : "completed";
  return {
    id,
    source,
    name: path.basename(cleanString(value.name, 180) || (source === "recording" ? "Aufnahme" : "Audiodatei")),
    size: Number.isSafeInteger(value.size) ? Math.max(0, value.size) : 0,
    status,
    rawText: cleanString(value.rawText),
    text: cleanString(value.text),
    warning: cleanOptional(value.warning),
    error: cleanOptional(value.error),
    metadata: cleanMetadata(value.metadata),
    createdAt,
    updatedAt,
    edited: value.edited === true,
  };
}

function publicEntry(entry) {
  return structuredClone(entry);
}

function createWorkspaceStore({ fs, historyPath, log = () => {}, now = Date.now, maxEntries = MAX_HISTORY_ENTRIES }) {
  const recoveryPath = `${historyPath}.recovery`;
  let entries = [];
  const removedIds = new Set();

  function write() {
    const pendingPath = `${historyPath}.next`;
    fs.writeFileSync(pendingPath, JSON.stringify({ schemaVersion: HISTORY_SCHEMA_VERSION, entries }), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(pendingPath, historyPath);
  }

  function load() {
    let raw = null;
    try {
      raw = fs.readFileSync(historyPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.schemaVersion !== HISTORY_SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
        throw new Error("WORKSPACE_HISTORY_SCHEMA_INVALID");
      }
      entries = parsed.entries.map(cleanEntry).filter(Boolean).slice(0, maxEntries);
      removedIds.clear();
      return list();
    } catch (error) {
      if (raw !== null) {
        try {
          if (!fs.existsSync(recoveryPath)) fs.writeFileSync(recoveryPath, raw, { encoding: "utf8", mode: 0o600 });
        } catch {
          // Recovery is best effort; an unreadable profile must not stop the app.
        }
        log("Beschädigter Verlauf wurde gesichert", error);
      }
      entries = [];
      removedIds.clear();
      return [];
    }
  }

  function list() {
    return entries.map(publicEntry);
  }

  function search(query) {
    const needle = cleanString(query, 200).trim().toLocaleLowerCase("de");
    if (!needle) return list();
    return entries.filter((entry) => [
      entry.name,
      entry.rawText,
      entry.text,
      entry.warning,
      entry.error,
      ...Object.values(entry.metadata),
    ].some((value) => String(value || "").toLocaleLowerCase("de").includes(needle))).map(publicEntry);
  }

  function upsertFromJob(job) {
    if (!job || !["completed", "failed"].includes(job.status)) return false;
    if (removedIds.has(job.id)) return false;
    const existing = entries.find((entry) => entry.id === job.id);
    const candidate = cleanEntry({
      ...job,
      text: existing?.edited ? existing.text : job.text,
      edited: existing?.edited || false,
      updatedAt: existing?.updatedAt || now(),
    });
    if (!candidate) return false;
    const next = existing ? entries.map((entry) => entry.id === candidate.id ? candidate : entry) : [candidate, ...entries];
    const limited = next.slice(0, maxEntries);
    if (JSON.stringify(limited) === JSON.stringify(entries)) return false;
    entries = limited;
    write();
    return true;
  }

  function updateText(id, text) {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) throw new Error("HISTORY_ENTRY_NOT_FOUND");
    entry.text = cleanString(text);
    entry.updatedAt = now();
    entry.edited = true;
    write();
    return publicEntry(entry);
  }

  function remove(id) {
    const next = entries.filter((entry) => entry.id !== id);
    if (next.length === entries.length) return false;
    removedIds.add(id);
    entries = next;
    write();
    removeRecoveryArtifacts();
    return true;
  }

  function removeRecoveryArtifacts() {
    let removed = false;
    for (const candidate of [recoveryPath, `${historyPath}.next`]) {
      try {
        fs.unlinkSync(candidate);
        removed = true;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return removed;
  }

  function clear() {
    const hadEntries = entries.length > 0;
    for (const entry of entries) removedIds.add(entry.id);
    entries = [];
    write();
    return removeRecoveryArtifacts() || hadEntries;
  }

  function get(id) {
    const entry = entries.find((candidate) => candidate.id === id);
    return entry ? publicEntry(entry) : null;
  }

  return { load, list, search, upsertFromJob, updateText, remove, clear, get, paths: { historyPath, recoveryPath } };
}

function historyExport(entry, format) {
  const title = entry.source === "recording" ? "Nivune-Aufnahme" : path.basename(cleanString(entry.name, 180));
  const result = entry.text || entry.rawText;
  if (format === "txt") return `${result}${result.endsWith("\n") ? "" : "\n"}`;
  if (format !== "md") throw new Error("HISTORY_EXPORT_FORMAT_INVALID");
  const metadata = entry.metadata || {};
  const lines = [
    `# ${title.replace(/^#+\s*/, "")}`,
    "",
    `- Datum: ${new Date(entry.createdAt).toISOString()}`,
    `- Transkription: ${metadata.transcriptionProvider || "unbekannt"}${metadata.transcriptionModel ? ` · ${metadata.transcriptionModel}` : ""}`,
    `- Überarbeitung: ${metadata.refinementProvider || "keine"}${metadata.refinementModel ? ` · ${metadata.refinementModel}` : ""}`,
    `- Sprache: ${metadata.language || "unbekannt"}`,
    "",
    "## Ergebnis",
    "",
    result,
  ];
  if (entry.rawText && entry.rawText !== result) lines.push("", "## Original", "", entry.rawText);
  if (entry.warning) lines.push("", "## Hinweis", "", entry.warning);
  if (entry.error) lines.push("", "## Fehler", "", entry.error);
  return `${lines.join("\n")}\n`;
}

module.exports = {
  HISTORY_SCHEMA_VERSION,
  MAX_HISTORY_ENTRIES,
  MAX_TEXT_LENGTH,
  createWorkspaceStore,
  historyExport,
};
