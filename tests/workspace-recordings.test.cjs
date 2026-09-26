const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createWorkspaceRecordingStore } = require("../desktop/workspace-recordings");

function setup(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-recordings-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const rootPath = path.join(directory, "workspace-recordings");
  const store = createWorkspaceRecordingStore({ fs, rootPath, ...options });
  store.load();
  return { directory, rootPath, store };
}

function plan() {
  return {
    transcription: { id: "openai-default", provider: "openai", model: "gpt-transcribe", credentialRef: "provider:openai" },
    refinement: { id: "none", provider: "none" },
    language: "de-DE",
    cleanupLevel: "sanft",
    context: "Persönlicher Kontext",
    dictionary: [{ from: "Klara", to: "Clara" }],
    transcriptionKey: "must-not-persist",
  };
}

test("Aufnahmefragmente werden atomar, geordnet und idempotent gesichert", (t) => {
  let clock = 1_700_000_000_000;
  const { rootPath, store } = setup(t, { now: () => ++clock });
  store.begin({ id: "recording-1", name: "Aufnahme.webm", plan: plan(), interfaceLanguage: "de" });
  store.appendFragment({ id: "recording-1", sequence: 0, bytes: Buffer.from("alpha"), mimeType: "audio/webm;codecs=opus", durationMs: 5_000 });
  store.appendFragment({ id: "recording-1", sequence: 0, bytes: Buffer.from("alpha"), mimeType: "audio/webm", durationMs: 5_000 });
  store.appendFragment({ id: "recording-1", sequence: 1, bytes: Buffer.from("beta"), mimeType: "audio/webm", durationMs: 10_000 });
  assert.throws(() => store.appendFragment({ id: "recording-1", sequence: 3, bytes: Buffer.from("gap"), mimeType: "audio/webm" }), /OUT_OF_ORDER/);
  const finalized = store.finalize("recording-1", 10_200);
  assert.equal(finalized.fragments, 2);
  assert.equal(finalized.durationMs, 10_200);
  assert.equal(store.readAudio("recording-1").bytes.toString(), "alphabeta");
  assert.equal(fs.existsSync(path.join(rootPath, "recording-1", "manifest.json.next")), false);
  assert.equal(fs.existsSync(path.join(rootPath, "recording-1", "fragment-00000.audio.next")), false);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(rootPath).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(rootPath, "recording-1")).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(rootPath, "recording-1", "manifest.json")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(rootPath, "recording-1", "fragment-00000.audio")).mode & 0o777, 0o600);
  }
});

test("viele fortlaufende Fragmente bleiben nach einem Neustart vollständig und geordnet", (t) => {
  const { rootPath, store } = setup(t);
  store.begin({ id: "long-running", name: "Lange Aufnahme", plan: plan(), interfaceLanguage: "de" });
  const expected = [];
  for (let sequence = 0; sequence < 360; sequence += 1) {
    const bytes = Buffer.from(`fragment-${String(sequence).padStart(3, "0")};`);
    expected.push(bytes);
    store.appendFragment({
      id: "long-running",
      sequence,
      bytes,
      mimeType: "audio/webm",
      durationMs: (sequence + 1) * 5_000,
    });
  }
  const restarted = createWorkspaceRecordingStore({ fs, rootPath });
  restarted.load();
  const recovery = restarted.listRecoverable()[0];
  assert.equal(recovery.fragments, 360);
  assert.equal(recovery.durationMs, 1_800_000);
  assert.deepEqual(restarted.readAudio("long-running").bytes, Buffer.concat(expected));
});

test("Neustart findet unvollständige Aufnahme ohne Schlüssel im Rendererstatus wieder", (t) => {
  const { rootPath, store } = setup(t);
  store.begin({ id: "recover-me", name: "Aufnahme", plan: plan(), interfaceLanguage: "de" });
  store.appendFragment({ id: "recover-me", sequence: 0, bytes: Buffer.from("fragment"), mimeType: "audio/webm", durationMs: 4_000 });
  const restarted = createWorkspaceRecordingStore({ fs, rootPath });
  const recoveries = restarted.load();
  assert.equal(recoveries.length, 1);
  assert.equal(recoveries[0].canProcess, true);
  assert.equal(recoveries[0].metadata.transcriptionProvider, "openai");
  const serializedPublic = JSON.stringify(recoveries);
  assert.doesNotMatch(serializedPublic, /Persönlicher Kontext|Klara|credentialRef|baseUrl|must-not-persist/);
  const serializedManifest = fs.readFileSync(path.join(rootPath, "recover-me", "manifest.json"), "utf8");
  assert.doesNotMatch(serializedManifest, /must-not-persist|transcriptionKey/);
});

test("unsicherer Cloud-Zustand wird nicht als sicherer Retry ausgegeben", (t) => {
  const { store } = setup(t);
  store.begin({ id: "cloud", name: "Cloud", plan: plan(), interfaceLanguage: "de" });
  store.appendFragment({ id: "cloud", sequence: 0, bytes: Buffer.from("audio"), mimeType: "audio/webm", durationMs: 3_000 });
  store.finalize("cloud", 3_000);
  store.markQueued("cloud");
  store.markTranscriptionStarted("cloud", true);
  assert.equal(store.listRecoverable()[0].retrySafety, "confirmation-required");
  assert.equal(store.listRecoverable()[0].uncertainStage, "transcription");
  store.markTranscribed("cloud", "Bereits bezahlter Rohtext");
  assert.equal(store.listRecoverable()[0].retrySafety, "safe");
  store.markRefinementStarted("cloud", true);
  store.markFailed("cloud", "Verbindung beendet");
  const recovery = store.listRecoverable()[0];
  assert.equal(recovery.uncertainStage, "refinement");
  assert.equal(store.getRecovery("cloud").rawText, "Bereits bezahlter Rohtext");
});

test("erfolgreiche Arbeitskopien werden standardmäßig entfernt", (t) => {
  const { rootPath, store } = setup(t);
  store.begin({ id: "temporary", name: "Temporär", plan: plan(), interfaceLanguage: "de" });
  store.appendFragment({ id: "temporary", sequence: 0, bytes: Buffer.from("audio"), mimeType: "audio/webm", durationMs: 1_000 });
  assert.equal(store.complete("temporary"), true);
  assert.equal(fs.existsSync(path.join(rootPath, "temporary")), false);
});

test("dauerhafte Audioaufbewahrung braucht eine ausdrückliche Einstellung und lässt sich zurücknehmen", (t) => {
  const { rootPath, store } = setup(t);
  assert.equal(store.getRetention(), false);
  assert.equal(store.setRetention(true), true);
  store.begin({ id: "retained", name: "Behalten", plan: plan(), interfaceLanguage: "de" });
  store.appendFragment({ id: "retained", sequence: 0, bytes: Buffer.from("audio"), mimeType: "audio/webm", durationMs: 1_000 });
  store.complete("retained");
  assert.equal(store.hasRetainedAudio("retained"), true);
  assert.equal(store.listRecoverable().length, 0);
  assert.equal(store.setRetention(false), false);
  assert.equal(fs.existsSync(path.join(rootPath, "retained")), false);
});

test("beschädigte Fragmente werden vor einer Wiederverarbeitung erkannt", (t) => {
  const { rootPath, store } = setup(t);
  store.begin({ id: "corrupt", name: "Kaputt", plan: plan(), interfaceLanguage: "de" });
  store.appendFragment({ id: "corrupt", sequence: 0, bytes: Buffer.from("audio"), mimeType: "audio/webm", durationMs: 1_000 });
  fs.writeFileSync(path.join(rootPath, "corrupt", "fragment-00000.audio"), "changed");
  assert.throws(() => store.readAudio("corrupt"), /CORRUPT/);
});
