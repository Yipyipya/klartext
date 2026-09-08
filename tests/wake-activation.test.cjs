const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  START_LABEL,
  STOP_LABEL,
  SILENCE_MS,
  createSilenceGate,
  detectionSensitivity,
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

test("Wake Words starten und beenden nur im passenden Zustand", () => {
  assert.equal(keywordAction(START_LABEL, false), "start");
  assert.equal(keywordAction(START_LABEL, true), "ignore");
  assert.equal(keywordAction(STOP_LABEL, true), "stop");
  assert.equal(keywordAction(STOP_LABEL, false), "ignore");
  assert.equal(keywordAction("zufälliger Satz", false), "ignore");
});

test("Startbefehl bleibt strenger als der Endbefehl", () => {
  const idle = detectionSensitivity(false);
  const recording = detectionSensitivity(true);

  assert.ok(idle.minScores >= recording.minScores);
  assert.ok(idle.threshold > recording.threshold);
  assert.ok(idle.averagedThreshold > recording.averagedThreshold);
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
});

test("Neun Sekunden ohne erkannte Stimme beenden genau einmal", () => {
  let now = 1_000;
  const gate = createSilenceGate({ now: () => now });
  gate.setRecording(true);
  now += SILENCE_MS - 1;
  assert.equal(gate.shouldAutoStop(), false);
  gate.observe(0.8);
  now += SILENCE_MS - 1;
  assert.equal(gate.shouldAutoStop(), false);
  now += 1;
  assert.equal(gate.shouldAutoStop(), true);
  assert.equal(gate.shouldAutoStop(), false);
});

test("Leise Hintergrundgeräusche verlängern den Stille-Timer nicht", () => {
  let now = 0;
  const gate = createSilenceGate({ now: () => now, voiceThreshold: 0.55 });
  gate.setRecording(true);
  now = 8_500;
  gate.observe(0.2);
  now = 9_000;
  assert.equal(gate.shouldAutoStop(), true);
});

test("Sprachende und Stille werden vor der Transkription abgeschnitten", () => {
  assert.equal(trimTailMs("manual"), 0);
  assert.equal(trimTailMs("wake-command"), 2_000);
  assert.equal(trimTailMs("silence"), 8_000);
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

  assert.equal(writes.length, 2);
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
        { key: "start", base64: Buffer.alloc(2_000).toString("base64") },
        { key: "stop", base64: "zu-klein" },
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
