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
  loadEnrolledWakeModels,
  saveEnrolledWakeModels,
  removeEnrolledWakeModels,
} = require("../desktop/wake-runtime");

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
    stripTrailingStopCommand("Das ist der fertige Text. Klartext fertig."),
    "Das ist der fertige Text."
  );
  assert.equal(
    stripTrailingStopCommand("Ich erkläre, warum Klartext fertig manchmal schwierig ist."),
    "Ich erkläre, warum Klartext fertig manchmal schwierig ist."
  );
  assert.equal(
    stripTrailingStopCommand("Der Text ist fertig. Klartext fertig. Klartext fertig."),
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
  };

  const supplied = WAKE_MODEL_SPECS.map((spec, index) => ({
    key: spec.key,
    base64: Buffer.alloc(2_000, index + 1).toString("base64"),
  }));
  const saved = await saveEnrolledWakeModels({ fsPromises, modelDir: "/models", models: supplied });
  const loaded = await loadEnrolledWakeModels({ fsPromises, modelDir: "/models" });

  assert.equal(writes.length, 1);
  assert.equal(writes.every((write) => write.options.mode === 0o600), true);
  assert.deepEqual(loaded, saved);
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
        { key: "start", base64: "zu-klein" },
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
  assert.equal(removed.length, 2);
});
