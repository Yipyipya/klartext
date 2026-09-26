const path = require("path");

// Bis zu dieser Größe geht eine Datei unverändert an einen Cloud-Anbieter;
// größere Dateien werden vorher in Abschnitte unter dieser Grenze geteilt.
const MAX_CLOUD_AUDIO_BYTES = 24_000_000;
const MAX_LOCAL_AUDIO_BYTES = 100_000_000;
// Obergrenze für Import und Aufnahme (lange Meetings, Video-Dateien).
const MAX_IMPORT_AUDIO_BYTES = 1_000_000_000;
const MAX_QUEUE_JOBS = 12;
const AUDIO_TYPES = Object.freeze({
  ".wav": { mimeType: "audio/wav", matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE" },
  ".mp3": { mimeType: "audio/mpeg", matches: (b) => ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  ".mpeg": { mimeType: "audio/mpeg", matches: (b) => b[0] === 0xff && (b[1] & 0xe0) === 0xe0 },
  ".mpga": { mimeType: "audio/mpeg", matches: (b) => b[0] === 0xff && (b[1] & 0xe0) === 0xe0 },
  ".m4a": { mimeType: "audio/mp4", matches: isMp4 },
  ".mp4": { mimeType: "audio/mp4", matches: isMp4 },
  ".webm": { mimeType: "audio/webm", matches: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  ".ogg": { mimeType: "audio/ogg", matches: (b) => ascii(b, 0, 4) === "OggS" },
  ".oga": { mimeType: "audio/ogg", matches: (b) => ascii(b, 0, 4) === "OggS" },
  ".flac": { mimeType: "audio/flac", matches: (b) => ascii(b, 0, 4) === "fLaC" },
});

function ascii(bytes, start, end) {
  return Buffer.from(bytes).subarray(start, end).toString("ascii");
}

function isMp4(bytes) {
  return bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp";
}

function maxBytesForPlan() {
  return MAX_IMPORT_AUDIO_BYTES;
}

/** Cloud-Aufträge über der Anbietergrenze werden in Abschnitte geteilt. */
function needsCloudSegmentation(size, plan) {
  return plan?.transcription?.provider !== "local" && Number(size) > MAX_CLOUD_AUDIO_BYTES;
}

function publicProgress(progress) {
  if (!progress || typeof progress !== "object") return null;
  const total = Math.max(0, Math.min(1000, Math.floor(Number(progress.total) || 0)));
  const current = Math.max(0, Math.min(total, Math.floor(Number(progress.current) || 0)));
  return total > 1 ? { current, total } : null;
}

function validateAudioFile({ name, size, header, plan }) {
  const safeName = path.basename(String(name || "")).slice(0, 180);
  const extension = path.extname(safeName).toLowerCase();
  const type = AUDIO_TYPES[extension];
  if (!type) throw new Error("UNSUPPORTED_AUDIO_TYPE");
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("AUDIO_FILE_EMPTY");
  if (size > maxBytesForPlan(plan)) throw new Error("AUDIO_FILE_TOO_LARGE");
  const bytes = Buffer.from(header || []);
  if (bytes.length < 12 || !type.matches(bytes)) throw new Error("AUDIO_FILE_SIGNATURE_INVALID");
  return { name: safeName, mimeType: type.mimeType, size };
}

function validateCapturedAudio({ byteLength, mimeType, plan }) {
  const normalizedType = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const extension = normalizedType === "audio/mp4" ? ".m4a" : normalizedType === "audio/wav" ? ".wav" : ".webm";
  if (!["audio/webm", "audio/mp4", "audio/wav"].includes(normalizedType)) throw new Error("UNSUPPORTED_RECORDING_TYPE");
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) throw new Error("AUDIO_RECORDING_EMPTY");
  if (byteLength > maxBytesForPlan(plan)) throw new Error("AUDIO_FILE_TOO_LARGE");
  return { name: `aufnahme-${Date.now()}${extension}`, mimeType: normalizedType, size: byteLength };
}

function transitionCapture(capture, action, value = null) {
  if (action === "start") {
    if (capture) throw new Error("CAPTURE_ALREADY_ACTIVE");
    if (!value?.id || !value?.context) throw new Error("CAPTURE_START_INVALID");
    return { ...value, state: "recording" };
  }
  if (!capture) throw new Error("CAPTURE_NOT_ACTIVE");
  if (action === "pause") {
    if (capture.state !== "recording") throw new Error("CAPTURE_NOT_RECORDING");
    return { ...capture, state: "paused" };
  }
  if (action === "resume") {
    if (capture.state !== "paused") throw new Error("CAPTURE_NOT_PAUSED");
    return { ...capture, state: "recording" };
  }
  if (action === "cancel" || action === "finish") return null;
  throw new Error("CAPTURE_ACTION_INVALID");
}

function publicHistoryMetadata(value) {
  if (!value || typeof value !== "object") return null;
  return {
    transcriptionProvider: String(value.transcriptionProvider || "").slice(0, 40),
    transcriptionModel: String(value.transcriptionModel || "").slice(0, 200),
    refinementProvider: String(value.refinementProvider || "").slice(0, 40),
    refinementModel: String(value.refinementModel || "").slice(0, 200),
    language: String(value.language || "").slice(0, 40),
    durationMs: Number.isFinite(value.durationMs)
      ? Math.max(0, Math.min(86_400_000, Math.round(value.durationMs))) : 0,
  };
}

function publicJob(job, activeId, queuedIds) {
  const metadata = publicHistoryMetadata(job.historyMetadata);
  return {
    id: job.id,
    source: job.source,
    name: job.name,
    size: job.size,
    status: job.status,
    stage: job.stage || null,
    rawText: job.rawText || "",
    text: job.text || "",
    warning: job.warning || null,
    error: job.error || null,
    progress: job.status === "processing" ? publicProgress(job.progress) : null,
    ...(metadata ? { metadata } : {}),
    createdAt: job.createdAt,
    queuePosition: job.id === activeId ? 0 : Math.max(0, queuedIds.indexOf(job.id) + 1),
  };
}

class SerialWorkspaceQueue {
  constructor(processJob, onChange = () => {}) {
    this.processJob = processJob;
    this.onChange = onChange;
    this.jobs = [];
    this.active = null;
    this.scheduled = false;
  }

  enqueue(job) {
    const pending = this.jobs.filter((entry) => ["queued", "processing"].includes(entry.status)).length;
    if (pending >= MAX_QUEUE_JOBS) throw new Error("WORKSPACE_QUEUE_FULL");
    const stored = { ...job, status: "queued", stage: "queued", createdAt: job.createdAt || Date.now() };
    this.jobs.unshift(stored);
    this.changed();
    this.schedule();
    return stored.id;
  }

  cancel(id) {
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job || !["queued", "processing"].includes(job.status)) return false;
    job.status = "cancelled";
    job.stage = null;
    if (this.active?.job.id === id) this.active.controller.abort();
    this.changed();
    return true;
  }

  removeTerminal(id) {
    const index = this.jobs.findIndex((entry) => entry.id === id && ["completed", "failed", "cancelled"].includes(entry.status));
    if (index < 0) return false;
    this.jobs.splice(index, 1);
    this.changed();
    return true;
  }

  snapshot() {
    const queuedIds = this.jobs.filter((entry) => entry.status === "queued").slice().reverse().map((entry) => entry.id);
    return this.jobs.map((job) => publicJob(job, this.active?.job.id, queuedIds));
  }

  isBusy() {
    return Boolean(this.active) || this.jobs.some((entry) => entry.status === "queued");
  }

  changed() {
    this.onChange(this.snapshot());
  }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.drain().catch(() => {});
    });
  }

  async drain() {
    if (this.active) return;
    const job = this.jobs.slice().reverse().find((entry) => entry.status === "queued");
    if (!job) return;
    const controller = new AbortController();
    this.active = { job, controller };
    job.status = "processing";
    job.stage = "preparing";
    this.changed();
    try {
      const result = await this.processJob(job, controller.signal, (stage) => {
        if (job.status !== "cancelled") {
          job.stage = stage;
          this.changed();
        }
      });
      if (job.status !== "cancelled" && !controller.signal.aborted) {
        Object.assign(job, result, { status: "completed", stage: null, error: null });
      }
    } catch (error) {
      if (job.status !== "cancelled" && !controller.signal.aborted) {
        job.status = "failed";
        job.stage = null;
        job.error = String(error?.message || error).slice(0, 240);
      }
    } finally {
      this.active = null;
      this.changed();
      this.schedule();
    }
  }
}

module.exports = {
  AUDIO_TYPES,
  MAX_CLOUD_AUDIO_BYTES,
  MAX_LOCAL_AUDIO_BYTES,
  MAX_IMPORT_AUDIO_BYTES,
  needsCloudSegmentation,
  MAX_QUEUE_JOBS,
  SerialWorkspaceQueue,
  maxBytesForPlan,
  validateAudioFile,
  validateCapturedAudio,
  transitionCapture,
};
