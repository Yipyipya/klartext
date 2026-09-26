const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createWorkspaceStore, historyExport } = require("../desktop/workspace-store");

function temporaryStore(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-history-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const historyPath = path.join(directory, "workspace-history.json");
  return { historyPath, store: createWorkspaceStore({ fs, historyPath, ...options }) };
}

function completedJob(overrides = {}) {
  return {
    id: "job-1",
    source: "file",
    name: "../gespräch.wav",
    size: 1234,
    status: "completed",
    rawText: "also roher text",
    text: "Also, fertiger Text.",
    warning: null,
    error: null,
    createdAt: 1_700_000_000_000,
    metadata: {
      transcriptionProvider: "local",
      transcriptionModel: "whisper-small",
      refinementProvider: "deterministic",
      refinementModel: "",
      language: "de-DE",
      durationMs: 4_200,
    },
    bytes: Buffer.from("audio must not persist"),
    path: "/private/audio.wav",
    context: { transcriptionKey: "secret", dictionary: ["private"] },
    ...overrides,
  };
}

test("lokaler Verlauf speichert Ergebnisse atomar ohne Audio, Pfade oder Schlüssel", (t) => {
  const { historyPath, store } = temporaryStore(t, { now: () => 1_700_000_000_500 });
  store.load();
  assert.equal(store.upsertFromJob(completedJob()), true);
  assert.equal(fs.existsSync(`${historyPath}.next`), false);
  const persisted = fs.readFileSync(historyPath, "utf8");
  assert.doesNotMatch(persisted, /audio must not persist|\/private\/audio|secret|dictionary/);
  const entry = store.list()[0];
  assert.equal(entry.name, "gespräch.wav");
  assert.equal(entry.rawText, "also roher text");
  assert.equal(entry.text, "Also, fertiger Text.");

  const reloaded = createWorkspaceStore({ fs, historyPath });
  assert.deepEqual(reloaded.load(), store.list());
});

test("Verlaufssuche, Bearbeitung und Einzel-/Gesamtlöschung bleiben lokal nutzbar", (t) => {
  let now = 1_700_000_001_000;
  const { store } = temporaryStore(t, { now: () => ++now });
  store.load();
  store.upsertFromJob(completedJob());
  store.upsertFromJob(completedJob({ id: "job-2", name: "english.wav", rawText: "hello world", text: "Hello world." }));
  assert.deepEqual(store.search("whisper-small").map((entry) => entry.id), ["job-2", "job-1"]);
  assert.deepEqual(store.search("GESPRÄCH").map((entry) => entry.id), ["job-1"]);
  store.updateText("job-1", "Von mir bearbeitet.");
  store.upsertFromJob(completedJob({ text: "Queue-Version" }));
  assert.equal(store.get("job-1").text, "Von mir bearbeitet.");
  assert.equal(store.get("job-1").edited, true);
  assert.equal(store.remove("job-2"), true);
  assert.equal(store.upsertFromJob(completedJob({ id: "job-2" })), false);
  assert.equal(store.list().length, 1);
  assert.equal(store.clear(), true);
  assert.equal(store.upsertFromJob(completedJob()), false);
  assert.deepEqual(store.list(), []);
});

test("fehlgeschlagene Verfeinerung behält Roh- und Teilergebnis", (t) => {
  const { store } = temporaryStore(t);
  store.load();
  store.upsertFromJob(completedJob({
    status: "failed",
    rawText: "Verständlicher Rohtext",
    text: "",
    error: "Textserver nicht erreichbar",
  }));
  assert.deepEqual(store.list().map(({ status, rawText, error }) => ({ status, rawText, error })), [{
    status: "failed",
    rawText: "Verständlicher Rohtext",
    error: "Textserver nicht erreichbar",
  }]);
});

test("beschädigter Verlauf wird gesichert und startet leer", (t) => {
  const messages = [];
  const { historyPath, store } = temporaryStore(t, { log: (...args) => messages.push(args) });
  fs.writeFileSync(historyPath, "{kaputt");
  assert.deepEqual(store.load(), []);
  assert.equal(fs.readFileSync(`${historyPath}.recovery`, "utf8"), "{kaputt");
  assert.equal(messages.length, 1);
});

test("Gesamtlöschung entfernt auch Recovery- und ausstehende Verlaufskopien", (t) => {
  const { historyPath, store } = temporaryStore(t);
  fs.writeFileSync(historyPath, "{kaputt");
  assert.deepEqual(store.load(), []);
  fs.writeFileSync(`${historyPath}.next`, "alte private Daten");
  assert.equal(fs.existsSync(`${historyPath}.recovery`), true);
  assert.equal(store.clear(), true);
  assert.equal(fs.existsSync(`${historyPath}.recovery`), false);
  assert.equal(fs.existsSync(`${historyPath}.next`), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(historyPath, "utf8")).entries, []);
});

test("TXT- und Markdown-Export verwenden das editierte Ergebnis und sichere Metadaten", () => {
  const entry = completedJob({ text: "Bearbeitet." });
  assert.equal(historyExport(entry, "txt"), "Bearbeitet.\n");
  const markdown = historyExport(entry, "md");
  assert.match(markdown, /^# gespräch\.wav/m);
  assert.match(markdown, /## Ergebnis\n\nBearbeitet\./);
  assert.match(markdown, /## Original\n\nalso roher text/);
  assert.doesNotMatch(markdown, /secret|private/);
});
