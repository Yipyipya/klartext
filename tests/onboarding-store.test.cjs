const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createOnboardingStore } = require("../desktop/onboarding-store");

function setup(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-onboarding-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "profile", "onboarding.json");
  const store = createOnboardingStore({ fs, statePath, ...options });
  return { directory, statePath, store };
}

test("neue Profile starten unvollständig und speichern den Fortschritt atomar", (t) => {
  const { statePath, store } = setup(t);
  assert.deepEqual(store.load(), { schemaVersion: 1, completed: false, step: 1, sampleCompleted: false, completedAt: null });
  store.update({ step: 3 });
  assert.equal(fs.existsSync(`${statePath}.next`), false);
  const restarted = createOnboardingStore({ fs, statePath });
  assert.equal(restarted.load().step, 3);
  assert.equal(restarted.current().completed, false);
});

test("Einrichtung kann erst nach einer erfolgreichen Probe abgeschlossen werden", (t) => {
  let clock = 1_800_000_000_000;
  const { statePath, store } = setup(t, { now: () => clock });
  store.load();
  assert.throws(() => store.complete(), /SAMPLE_REQUIRED/);
  store.update({ step: 4, sampleCompleted: true });
  const completed = store.complete();
  assert.equal(completed.completed, true);
  assert.equal(completed.completedAt, clock);
  assert.doesNotMatch(fs.readFileSync(statePath, "utf8"), /text|audio|key/i);
});

test("beschädigter Einrichtungsstand wird gesichert und sicher neu begonnen", (t) => {
  const { statePath, store } = setup(t);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, "{kaputt");
  assert.equal(store.load().completed, false);
  assert.equal(fs.readFileSync(`${statePath}.recovery`, "utf8"), "{kaputt");
});

test("unbekannte Felder können den Einrichtungsstand nicht erweitern", (t) => {
  const { store } = setup(t);
  store.load();
  assert.throws(() => store.update({ apiKey: "secret" }), /UPDATE_INVALID/);
});
