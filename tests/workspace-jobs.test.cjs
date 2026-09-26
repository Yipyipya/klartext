const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  SerialWorkspaceQueue,
  validateAudioFile,
  validateCapturedAudio,
  transitionCapture,
} = require("../desktop/workspace-jobs");

const localPlan = { transcription: { provider: "local" } };
const cloudPlan = { transcription: { provider: "openai" } };
const wavHeader = Buffer.from("RIFF....WAVEfmt ", "ascii");

test("Desktop-Dateiimport akzeptiert nur passende Audioendung, Signatur und Profilgröße", () => {
  assert.deepEqual(validateAudioFile({ name: "../memo.wav", size: 1024, header: wavHeader, plan: cloudPlan }), {
    name: "memo.wav", mimeType: "audio/wav", size: 1024,
  });
  assert.throws(() => validateAudioFile({ name: "memo.txt", size: 10, header: wavHeader, plan: cloudPlan }), /UNSUPPORTED_AUDIO_TYPE/);
  assert.throws(() => validateAudioFile({ name: "memo.wav", size: 10, header: Buffer.alloc(16), plan: cloudPlan }), /SIGNATURE/);
  assert.throws(() => validateAudioFile({ name: "memo.wav", size: 24_000_001, header: wavHeader, plan: cloudPlan }), /TOO_LARGE/);
  assert.doesNotThrow(() => validateAudioFile({ name: "memo.wav", size: 24_000_001, header: wavHeader, plan: localPlan }));
});

test("Arbeitsbereich-Aufnahmen begrenzen Typ und Größe vor der Queue", () => {
  assert.equal(validateCapturedAudio({ byteLength: 4096, mimeType: "audio/webm;codecs=opus", plan: cloudPlan }).mimeType, "audio/webm");
  assert.throws(() => validateCapturedAudio({ byteLength: 4096, mimeType: "audio/aac", plan: cloudPlan }), /UNSUPPORTED_RECORDING_TYPE/);
  assert.throws(() => validateCapturedAudio({ byteLength: 24_000_001, mimeType: "audio/webm", plan: cloudPlan }), /TOO_LARGE/);
});

test("Aufnahmezustand erlaubt nur Start, Pause, Fortsetzen und Abschluss in Reihenfolge", () => {
  const started = transitionCapture(null, "start", { id: "capture-1", context: { plan: localPlan } });
  assert.equal(started.state, "recording");
  const paused = transitionCapture(started, "pause");
  assert.equal(paused.state, "paused");
  assert.throws(() => transitionCapture(paused, "pause"), /NOT_RECORDING/);
  const resumed = transitionCapture(paused, "resume");
  assert.equal(resumed.state, "recording");
  assert.equal(transitionCapture(resumed, "finish"), null);
  assert.throws(() => transitionCapture(null, "resume"), /NOT_ACTIVE/);
});

test("Arbeitsbereich-Queue verarbeitet strikt seriell und in Einfügereihenfolge", async () => {
  const order = [];
  let concurrent = 0;
  let maxConcurrent = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const queue = new SerialWorkspaceQueue(async (job, _signal, stage) => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    order.push(`start:${job.id}`);
    stage("transcribing");
    if (job.id === "one") await firstGate;
    concurrent -= 1;
    order.push(`end:${job.id}`);
    return { rawText: job.id, text: job.id };
  });
  queue.enqueue({ id: "one", source: "file", name: "one.wav", size: 1 });
  queue.enqueue({ id: "two", source: "file", name: "two.wav", size: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ["start:one"]);
  releaseFirst();
  while (queue.isBusy()) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(maxConcurrent, 1);
  assert.deepEqual(order, ["start:one", "end:one", "start:two", "end:two"]);
});

test("Abbruch entfernt wartende Arbeit und signalisiert den aktiven Auftrag", async () => {
  let aborted = false;
  const queue = new SerialWorkspaceQueue(async (_job, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
  }));
  queue.enqueue({ id: "active", source: "file", name: "a.wav", size: 1 });
  queue.enqueue({ id: "waiting", source: "file", name: "b.wav", size: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queue.cancel("waiting"), true);
  assert.equal(queue.cancel("active"), true);
  while (queue.isBusy()) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(aborted, true);
  assert.deepEqual(queue.snapshot().map((job) => [job.id, job.status]), [["waiting", "cancelled"], ["active", "cancelled"]]);
  assert.equal(queue.removeTerminal("active"), true);
  assert.equal(queue.removeTerminal("active"), false);
  assert.deepEqual(queue.snapshot().map((job) => job.id), ["waiting"]);
});

test("Renderer-Snapshots enthalten weder Audiodaten, Dateipfade, Zieladressen noch Schlüssel", async () => {
  let release;
  const queue = new SerialWorkspaceQueue(async () => new Promise((resolve) => { release = () => resolve({ rawText: "roh", text: "fertig" }); }));
  queue.enqueue({
    id: "private",
    source: "file",
    name: "memo.wav",
    size: 16,
    path: "/private/secret/memo.wav",
    bytes: Buffer.from("private audio"),
    context: { plan: localPlan, transcriptionKey: "secret-key", refinementKey: "other-key" },
    historyMetadata: {
      transcriptionProvider: "local",
      transcriptionModel: "whisper-small",
      refinementProvider: "none",
      language: "de-DE",
      endpoint: "https://private.example",
      key: "metadata-secret",
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  const serialized = JSON.stringify(queue.snapshot());
  assert.doesNotMatch(serialized, /private audio|secret-key|other-key|metadata-secret|private\.example|\/private\/secret/);
  assert.match(serialized, /whisper-small/);
  queue.cancel("private");
  release();
  while (queue.isBusy()) await new Promise((resolve) => setImmediate(resolve));
});
