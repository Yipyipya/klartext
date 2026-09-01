const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { configureRuntime, createFileLogger, installPipeGuards } = require("../desktop/runtime");
const { ensureAudioContextRunning } = require("../desktop/audio-runtime");
const { ACCESSIBILITY_SETTINGS_URL, getPasteAccess } = require("../desktop/accessibility");

function mockRuntimeApp(packaged) {
  let userData = "/profile/klartext-desktop";
  return {
    isPackaged: packaged,
    getPath: (name) => name === "userData" ? userData : name === "temp" ? "/tmp" : "",
    setPath: (name, value) => { if (name === "userData") userData = value; },
    currentUserData: () => userData,
  };
}

test("Entwicklungs-App teilt weder Profildaten noch Produktiv-Shortcut", () => {
  const mac = mockRuntimeApp(false);
  const macRuntime = configureRuntime(mac, "darwin", {});
  assert.equal(mac.currentUserData(), "/profile/klartext-desktop-development");
  assert.equal(macRuntime.hotkey, "Alt+Shift+Space");

  const windows = mockRuntimeApp(false);
  assert.equal(configureRuntime(windows, "win32", {}).hotkey, "Control+Alt+Shift+Space");
});

test("Paket-Smoke-Test erhält ein isoliertes temporäres Profil und einen alternativen Shortcut", () => {
  const app = mockRuntimeApp(true);
  const runtime = configureRuntime(app, "darwin", {}, true);
  assert.match(app.currentUserData(), /^\/tmp\/klartext-smoke-\d+$/);
  assert.equal(runtime.hotkey, "Alt+Shift+Space");
});

test("Installierte App behält Profil und gewohnten Shortcut", () => {
  const mac = mockRuntimeApp(true);
  assert.equal(configureRuntime(mac, "darwin", {}).hotkey, "Alt+Space");
  assert.equal(mac.currentUserData(), "/profile/klartext-desktop");
  const windows = mockRuntimeApp(true);
  assert.equal(configureRuntime(windows, "win32", {}).hotkey, "Control+Shift+Space");
});

test("EPIPE eines geschlossenen Terminals wird behandelt statt den Main-Prozess zu beenden", () => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const seen = [];
  installPipeGuards([stdout, stderr], (error) => seen.push(error.code));
  stdout.emit("error", Object.assign(new Error("closed"), { code: "EPIPE" }));
  stderr.emit("error", Object.assign(new Error("closed"), { code: "EPIPE" }));
  assert.deepEqual(seen, ["EPIPE", "EPIPE"]);
});

test("Dateilogger schluckt eigene Schreibfehler und begrenzt Einträge", () => {
  const writes = [];
  const fs = { mkdirSync() {}, appendFileSync: (_path, value) => writes.push(value) };
  const logger = createFileLogger(fs, "/logs/klartext.log");
  logger("Cloud fehlgeschlagen", new Error("401"));
  assert.match(writes[0], /Cloud fehlgeschlagen: Error: 401/);
  assert.doesNotThrow(() => createFileLogger({ mkdirSync() { throw new Error("readonly"); } }, "/x/log")("Fehler"));
});

test("Pausierter AudioContext wird vor der PCM-Aufnahme aktiviert", async () => {
  let resumes = 0;
  const context = { state: "suspended", async resume() { resumes++; this.state = "running"; } };
  assert.equal(await ensureAudioContextRunning(context), context);
  assert.equal(resumes, 1);
});

test("Nicht aktivierbarer AudioContext wird als Aufnahmefehler behandelt", async () => {
  await assert.rejects(ensureAudioContextRunning({ state: "suspended", async resume() {} }), /suspended/);
  await assert.rejects(ensureAudioContextRunning(null), /fehlt/);
});

test("Fehlende macOS-Bedienungshilfe blockiert nur das automatische Einfügen", () => {
  assert.deepEqual(getPasteAccess("darwin", false), {
    canPaste: false,
    needsAccessibility: true,
  });
  assert.match(ACCESSIBILITY_SETTINGS_URL, /Privacy_Accessibility$/);
});

test("Windows braucht keine macOS-Bedienungshilfe zum Einfügen", () => {
  assert.deepEqual(getPasteAccess("win32", false), {
    canPaste: true,
    needsAccessibility: false,
  });
});

test("Aufnahmecode löst keine Bedienungshilfen-Abfrage mehr aus", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.doesNotMatch(mainSource, /isTrustedAccessibilityClient\(true\)/);
  assert.match(mainSource, /isTrustedAccessibilityClient\(false\)/);
});
