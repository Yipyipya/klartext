const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  START_LABEL,
  STOP_LABEL,
  START_CONFIRM_QUIET_MS,
  createCommandGate,
  detectionSensitivity,
  hasRequiredLeadIn,
  keywordAction,
  stripTrailingStopCommand,
  trimTailMs,
} = require("../desktop/wake-controller");
const {
  WAKE_MODEL_SPECS,
  WAKE_PHRASE_METADATA_FILE,
  loadEnrolledWakeModels,
  saveEnrolledWakeModels,
  removeEnrolledWakeModels,
} = require("../desktop/wake-runtime");
const {
  DEFAULT_WAKE_PHRASE,
  DEFAULT_WAKE_PHRASE_ENGLISH,
  LEGACY_WAKE_PHRASE,
  defaultWakePhrase,
  normalizeWakePhrase,
} = require("../desktop/wake-phrase");

test("Persönliche Startbefehle sind sprachunabhängig, kurz und sicher begrenzt", () => {
  assert.equal(defaultWakePhrase("de"), DEFAULT_WAKE_PHRASE);
  assert.equal(defaultWakePhrase("en"), DEFAULT_WAKE_PHRASE_ENGLISH);
  assert.equal(normalizeWakePhrase("  Hello   Nivune  "), "Hello Nivune");
  assert.equal(normalizeWakePhrase("Los geht’s"), "Los geht’s");
  assert.equal(normalizeWakePhrase("Bonjour à tous"), "Bonjour à tous");
  for (const invalid of ["Nivune", "eins zwei drei vier fünf sechs", "Hey <script>", "a".repeat(41)]) {
    assert.equal(normalizeWakePhrase(invalid), "");
  }
});

test("Nur der Startbefehl löst eine Aktion aus", () => {
  assert.equal(keywordAction(START_LABEL, false), "start");
  assert.equal(keywordAction(START_LABEL, true), "ignore");
  assert.equal(keywordAction(STOP_LABEL, true), "ignore");
  assert.equal(keywordAction(STOP_LABEL, false), "ignore");
  assert.equal(keywordAction("zufälliger Satz", false), "ignore");
});

test("Während einer Aufnahme wird die Startempfindlichkeit nicht gelockert", () => {
  const idle = detectionSensitivity(false);
  const recording = detectionSensitivity(true);

  assert.deepEqual(recording, idle);
});

test("Erkannter Endbefehl wird nur am Textende entfernt", () => {
  assert.equal(
    stripTrailingStopCommand("Das ist der fertige Text. Diktat fertig."),
    "Das ist der fertige Text."
  );
  assert.equal(
    stripTrailingStopCommand("Ich erkläre, warum Diktat fertig manchmal schwierig ist."),
    "Ich erkläre, warum Diktat fertig manchmal schwierig ist."
  );
  assert.equal(
    stripTrailingStopCommand("Der Text ist fertig. Diktat fertig. Klartext fertig."),
    "Der Text ist fertig."
  );
});

test("Der Startbefehl braucht anschließend bestätigte Ruhe", () => {
  let now = 0;
  const gate = createCommandGate({ now: () => now });

  assert.equal(gate.detect("start", { score: 0.43 }).state, "detected");
  assert.equal(gate.observeQuiet(true), null);
  now = START_CONFIRM_QUIET_MS;
  assert.equal(gate.observeQuiet(true).state, "confirmed");

});

test("Endtreffer werden auch innerhalb des Gates vollständig ignoriert", () => {
  const gate = createCommandGate();
  gate.setRecording(true);
  assert.equal(gate.detect("stop", { score: 1 }), null);
  assert.equal(gate.observeQuiet(true), null);
});

test("Nur der Startbefehl erfüllt die Vorpause", () => {
  assert.equal(hasRequiredLeadIn("start", 149), false);
  assert.equal(hasRequiredLeadIn("start", 150), true);
  assert.equal(hasRequiredLeadIn("stop", Number.POSITIVE_INFINITY), false);
});

test("Automatische Enden schneiden kein mögliches Nutz-Audio ab", () => {
  assert.equal(trimTailMs("manual"), 0);
  assert.equal(trimTailMs("wake-command"), 0);
  assert.equal(trimTailMs("silence"), 0);
});

test("Persönliche Sprachmodelle werden lokal gespeichert und wieder geladen", async () => {
  const files = new Map();
  const writes = [];
  const fsPromises = {
    async mkdir() {},
    async readFile(filePath) {
      if (!files.has(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return files.get(filePath);
    },
    async writeFile(filePath, data, options) {
      files.set(filePath, Buffer.from(data));
      writes.push({ filePath, options });
    },
    async rename(from, to) {
      files.set(to, files.get(from));
      files.delete(from);
    },
  };

  const supplied = WAKE_MODEL_SPECS.map((spec, index) => ({
    key: spec.key,
    label: "Hello Nivune",
    base64: Buffer.alloc(2_000, index + 1).toString("base64"),
  }));
  const saved = await saveEnrolledWakeModels({ fsPromises, modelDir: "/models", models: supplied });
  const loaded = await loadEnrolledWakeModels({ fsPromises, modelDir: "/models" });

  assert.equal(writes.length, 2);
  assert.equal(writes.every((write) => write.options.mode === 0o600), true);
  assert.deepEqual(loaded, saved);
  assert.equal(loaded[0].label, "Hello Nivune");
  assert.equal(files.has(`/models/${WAKE_PHRASE_METADATA_FILE}`), true);
});

test("Bestehende Modelle ohne Phrasenmetadatei bleiben Hey-Klartext-kompatibel", async () => {
  const loaded = await loadEnrolledWakeModels({
    modelDir: "/models",
    fsPromises: {
      async readFile(filePath) {
        if (filePath.endsWith("hey-klartext.rpw")) return Buffer.alloc(2_000, 1);
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
    },
  });
  assert.equal(loaded[0].label, LEGACY_WAKE_PHRASE);
});

test("Fehlende oder ungültige Sprachmodelle aktivieren den Listener nicht", async () => {
  const fsPromises = {
    async mkdir() {},
    async readFile() { throw new Error("missing"); },
    async writeFile() { assert.fail("ungültiges Modell darf nicht gespeichert werden"); },
  };
  assert.equal(await loadEnrolledWakeModels({ fsPromises, modelDir: "/models" }), null);
  await assert.rejects(
    saveEnrolledWakeModels({
      fsPromises,
      modelDir: "/models",
      models: [
        { key: "start", label: DEFAULT_WAKE_PHRASE, base64: "zu-klein" },
      ],
    }),
    /Ungültig/
  );
});

test("Persönliche Sprachmodelle lassen sich vollständig entfernen", async () => {
  const removed = [];
  await removeEnrolledWakeModels({
    modelDir: "/models",
    fsPromises: {
      async unlink(filePath) {
        removed.push(filePath);
        if (filePath.endsWith("klartext-fertig.rpw")) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
    },
  });
  assert.equal(removed.length, 5);
});
