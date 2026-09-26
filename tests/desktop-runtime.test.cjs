const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { MAX_LOG_BYTES, configureRuntime, createFileLogger, installPipeGuards } = require("../desktop/runtime");
const {
  DEFAULT_NO_SPEECH_MS,
  DEFAULT_SILENCE_MS,
  MAX_SYSTEM_AUDIO_BYTES,
  MAX_SYSTEM_DICTATION_SAMPLES,
  MAX_SYSTEM_TEXT_LENGTH,
  createSilenceMonitor,
  ensureAudioContextRunning,
  validateSystemResultPayload,
} = require("../desktop/audio-runtime");

test("Systemdiktat begrenzt Renderer-Payloads vor der Verarbeitung", () => {
  const exactAudio = new ArrayBuffer(MAX_SYSTEM_AUDIO_BYTES);
  assert.equal(validateSystemResultPayload({ audio: exactAudio }, true).audio.byteLength, MAX_SYSTEM_AUDIO_BYTES);
  assert.throws(
    () => validateSystemResultPayload({ audio: new ArrayBuffer(MAX_SYSTEM_AUDIO_BYTES + 1) }, true),
    (error) => error.code === "SYSTEM_AUDIO_TOO_LARGE"
  );
  assert.throws(
    () => validateSystemResultPayload({ audio: "kein Puffer" }, true),
    (error) => error.code === "SYSTEM_AUDIO_INVALID"
  );
  assert.equal(validateSystemResultPayload({ text: "Hallo" }, false).text, "Hallo");
  assert.throws(
    () => validateSystemResultPayload({ text: "x".repeat(MAX_SYSTEM_TEXT_LENGTH + 1) }, false),
    (error) => error.code === "SYSTEM_TEXT_TOO_LARGE"
  );
  assert.equal(MAX_SYSTEM_DICTATION_SAMPLES, 16_000 * 10 * 60);
});

test("Desktop stoppt Aufnahme am Samplelimit und meldet den Grund über eine enge Bridge", () => {
  const pillSource = fs.readFileSync(path.join(__dirname, "../desktop/pill.html"), "utf8");
  const preloadSource = fs.readFileSync(path.join(__dirname, "../desktop/preload.js"), "utf8");
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(pillSource, /MAX_SYSTEM_DICTATION_SAMPLES/);
  assert.match(pillSource, /window\.klartext\.limit\(\)/);
  assert.match(preloadSource, /ipcRenderer\.send\("recording-limit"\)/);
  assert.match(mainSource, /stopRecording\("limit"\)/);
  assert.match(mainSource, /validateSystemResultPayload\(value, quality\)/);
});
const { ACCESSIBILITY_SETTINGS_URL, getPasteAccess } = require("../desktop/accessibility");
const { REQUIRED_LOCAL_RUNTIME_FILES, inspectLocalRuntimeAssets } = require("../desktop/runtime-assets");

function mockRuntimeApp(packaged) {
  let userData = "/profile/nivune-desktop";
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
  assert.equal(mac.currentUserData(), "/profile/nivune-desktop-development");
  assert.equal(macRuntime.hotkey, "Alt+Shift+Space");
  assert.equal(macRuntime.hotkeyLabelEnglish, "⌥ + ⇧ + Space");

  const windows = mockRuntimeApp(false);
  assert.equal(configureRuntime(windows, "win32", {}).hotkey, "Control+Alt+Shift+Space");
});

test("Paket-Smoke-Test erhält ein isoliertes temporäres Profil und einen alternativen Shortcut", () => {
  const app = mockRuntimeApp(true);
  const runtime = configureRuntime(app, "darwin", {}, true);
  assert.match(app.currentUserData(), /^\/tmp\/nivune-smoke-\d+$/);
  assert.equal(runtime.hotkey, "Alt+Shift+Space");
});

test("interne Alpha teilt weder Profil, Bundle-ID noch Produktiv-Shortcut", () => {
  const app = mockRuntimeApp(true);
  const runtime = configureRuntime(app, "darwin", {}, false, true);
  assert.equal(app.currentUserData(), "/profile/Nivune Alpha");
  assert.equal(runtime.alphaBuild, true);
  assert.equal(runtime.hotkey, "Alt+Shift+Space");
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  assert.match(packageJson.scripts["pack:alpha"], /app\.nivune\.desktop\.alpha/);
  assert.match(packageJson.scripts["pack:alpha"], /Nivune Alpha/);
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(mainSource, /path\.basename\(process\.execPath\) === "Nivune Alpha"/);
});

test("Installierte App verwendet das Nivune-Profil und den gewohnten Shortcut", () => {
  const mac = mockRuntimeApp(true);
  const macRuntime = configureRuntime(mac, "darwin", {});
  assert.equal(macRuntime.hotkey, "Alt+Space");
  assert.equal(macRuntime.hotkeyLabelEnglish, "⌥ + Space");
  assert.equal(mac.currentUserData(), "/profile/nivune-desktop");
  const windows = mockRuntimeApp(true);
  assert.equal(configureRuntime(windows, "win32", {}).hotkey, "Control+Shift+Space");
});

test("Bestehende Klartext-Profile einschließlich Modellcache bleiben ohne Kopie nutzbar", () => {
  const existing = new Set([
    "/profile/klartext-desktop", "/profile/klartext-desktop/settings.json",
    "/profile/Klartext Alpha", "/profile/Klartext Alpha/settings.json",
  ]);
  const fakeFs = { existsSync: (target) => existing.has(target) };

  const packaged = mockRuntimeApp(true);
  configureRuntime(packaged, "darwin", {}, false, false, fakeFs);
  assert.equal(packaged.currentUserData(), "/profile/klartext-desktop");

  const alpha = mockRuntimeApp(true);
  configureRuntime(alpha, "darwin", {}, false, true, fakeFs);
  assert.equal(alpha.currentUserData(), "/profile/Klartext Alpha");
});

test("von Electron vorab angelegter leerer Nivune-Ordner verdrängt das Klartext-Profil nicht", () => {
  // Electron erzeugt den Standardordner bereits vor dem ersten Main-Code.
  // Maßgeblich ist deshalb, ob ein Profil Nivune-Daten enthält.
  const existing = new Set([
    "/profile/nivune-desktop",
    "/profile/Nivune Alpha",
    "/profile/klartext-desktop",
    "/profile/klartext-desktop/settings.json",
    "/profile/Klartext Alpha",
    "/profile/Klartext Alpha/settings.json",
  ]);
  const fakeFs = { existsSync: (target) => existing.has(target) };
  const packaged = mockRuntimeApp(true);
  configureRuntime(packaged, "darwin", {}, false, false, fakeFs);
  assert.equal(packaged.currentUserData(), "/profile/klartext-desktop");
  const alpha = mockRuntimeApp(true);
  configureRuntime(alpha, "darwin", {}, false, true, fakeFs);
  assert.equal(alpha.currentUserData(), "/profile/Klartext Alpha");

  existing.add("/profile/nivune-desktop/settings.json");
  const migrated = mockRuntimeApp(true);
  configureRuntime(migrated, "darwin", {}, false, false, fakeFs);
  assert.equal(migrated.currentUserData(), "/profile/nivune-desktop", "ein genutztes Nivune-Profil hat Vorrang");

  const fresh = mockRuntimeApp(true);
  configureRuntime(fresh, "darwin", {}, false, false, { existsSync: (target) => target === "/profile/nivune-desktop" });
  assert.equal(fresh.currentUserData(), "/profile/nivune-desktop", "ohne Altprofil bleibt es beim Nivune-Ordner");
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

test("Dateilogger rotiert bei einem Megabyte und setzt private Dateirechte", () => {
  const calls = [];
  const fakeFs = {
    mkdirSync() {},
    statSync: () => ({ size: MAX_LOG_BYTES }),
    existsSync: () => true,
    unlinkSync: (file) => calls.push(["unlink", file]),
    renameSync: (from, to) => calls.push(["rename", from, to]),
    appendFileSync: (file, _value, options) => calls.push(["append", file, options.mode]),
    chmodSync: (file, mode) => calls.push(["chmod", file, mode]),
  };
  createFileLogger(fakeFs, "/logs/klartext.log")("neuer Eintrag");
  assert.deepEqual(calls, [
    ["unlink", "/logs/klartext.log.1"],
    ["rename", "/logs/klartext.log", "/logs/klartext.log.1"],
    ["append", "/logs/klartext.log", 0o600],
    ["chmod", "/logs/klartext.log", 0o600],
  ]);
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

test("Stille wird auf dem tatsächlichen Aufnahmestream erst nach Sprache beendet", () => {
  let now = 0;
  const monitor = createSilenceMonitor({ now: () => now });
  monitor.observeRms(0.01);
  monitor.observeRms(0.01);
  assert.equal(monitor.hasHeardVoice(), true);
  now = DEFAULT_SILENCE_MS - 1;
  assert.equal(monitor.shouldAutoStop(), false);
  now = DEFAULT_SILENCE_MS;
  assert.equal(monitor.shouldAutoStop(), true);
  assert.equal(monitor.shouldAutoStop(), false);
});

test("Leise Eingabe ohne bestätigte Stimme wird nicht nach neun Sekunden abgeschnitten", () => {
  let now = 0;
  const monitor = createSilenceMonitor({ now: () => now });
  monitor.observeRms(0.0005);
  now = DEFAULT_SILENCE_MS;
  assert.equal(monitor.shouldAutoStop(), false);
  now = DEFAULT_NO_SPEECH_MS;
  assert.equal(monitor.shouldAutoStop(), true);
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

test("Desktop-Whisper lädt Laufzeit und WASM aus dem Paket", () => {
  const pillSource = fs.readFileSync(path.join(__dirname, "../desktop/pill.html"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  assert.doesNotMatch(pillSource, /import\s*\(\s*["']https?:/);
  assert.match(pillSource, /whisper-bundle\.js/);
  assert.match(pillSource, /ort-wasm-simd-threaded\.asyncify\.wasm/);
  for (const file of ["whisper-bundle.js", "ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"]) {
    assert.ok(packageJson.build.files.includes(file));
  }
});

test("Desktop-Paket liefert nur gebündelte Laufzeit statt ungenutzter Node-Module aus", () => {
  const packageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  assert.ok(packageConfig.build.files.includes("shared-core.cjs"));
  assert.ok(packageConfig.build.files.includes("whisper-bundle.js"));
  assert.ok(packageConfig.build.files.includes("ort-wasm-simd-threaded.asyncify.wasm"));
  assert.ok(packageConfig.build.files.includes("!node_modules/**"));
});

test("Desktop-Paket deaktiviert Node-Einstiege und erzwingt ASAR-Integrität", () => {
  const hook = fs.readFileSync(path.join(__dirname, "../desktop/adhoc-sign.js"), "utf8");
  assert.match(hook, /RunAsNode\]: false/);
  assert.match(hook, /EnableNodeOptionsEnvironmentVariable\]: false/);
  assert.match(hook, /EnableNodeCliInspectArguments\]: false/);
  assert.match(hook, /EnableEmbeddedAsarIntegrityValidation\]: true/);
  assert.match(hook, /OnlyLoadAppFromAsar\]: true/);
  assert.match(hook, /const isInternalAlpha = appName === "Nivune Alpha"/);
  assert.match(hook, /EnableCookieEncryption\]: !isInternalAlpha/);
  assert.match(hook, /LoadBrowserProcessSpecificV8Snapshot\]: false/);
  assert.match(hook, /GrantFileProtocolExtraPrivileges\]: true/);
  assert.match(hook, /WasmTrapHandlers\]: true/);
  assert.match(hook, /strictlyRequireAllFuses: true/);
  assert.match(hook, /await import\("@electron\/fuses"\)/);
  assert.match(hook, /NSAppTransportSecurity\.NSAllowsArbitraryLoads/);
  assert.match(hook, /NSCameraUsageDescription/);
  const packageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  assert.equal(packageConfig.build.mac.extendInfo.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
});

test("Onboarding zeigt Setupfehler als Text und aktualisiert die Sprachoption nach dem Einlernen", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const rendererSource = fs.readFileSync(path.join(__dirname, "../desktop/onboarding-renderer.js"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../desktop/resonanz.css"), "utf8");

  assert.match(mainSource, /setupIssue: issue \? localizedRuntimeText\(issue\) : null/);
  assert.doesNotMatch(mainSource, /setupIssue: issue \? \{ \.\.\.issue/);
  assert.match(rendererSource, /typeof state\.setupIssue === "string"/);
  assert.match(mainSource, /awaitingOnboardingChoice/);
  assert.match(mainSource, /syncOnboardingWindow\(\);\n    setTimeout\(\(\) => wakeSetupWin\?\.close/);
  assert.match(rendererSource, /closest\("\.finish-choice"\)\.dataset\.disabled/);
  assert.match(styles, /\.finish-choice\[data-disabled=true\]/);
});

test("Lokaler Onboarding-Pfad lädt safeStorage nicht vorsorglich", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const electronImport = mainSource.slice(0, mainSource.indexOf("const { execFile }"));
  assert.doesNotMatch(electronImport, /\bsafeStorage\s*,/);
  assert.match(mainSource, /electron\.safeStorage\.decryptString/);
  assert.match(mainSource, /electron\.safeStorage\.encryptString/);
});

test("Desktop-Fenster sind sandboxed und blockieren Navigation", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  for (const windowName of ["pill", "keyWin", "wakeSetupWin", "wakeWin"]) {
    assert.match(mainSource, new RegExp(`${windowName}\\.webContents\\.setWindowOpenHandler`));
    assert.match(mainSource, new RegExp(`${windowName}\\.webContents\\.on\\(\\"will-navigate\\"`));
  }
  assert.ok((mainSource.match(/sandbox: true/g) || []).length >= 7);
  assert.ok((mainSource.match(/nodeIntegration: false/g) || []).length >= 7);
  assert.ok((mainSource.match(/contextIsolation: true/g) || []).length >= 7);
});

test("Desktop-HTML setzt CSP und das Key-Fenster verwendet kein Inline-Skript", () => {
  const protectedPages = ["keywin.html", "pill.html", "wake.html", "wakekey.html", "workspace.html", "settings.html", "onboarding.html"];
  for (const page of protectedPages) {
    const html = fs.readFileSync(path.join(__dirname, "../desktop", page), "utf8");
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /object-src 'none'/, `${page} blockiert Plugins nicht explizit`);
  }
  const keyWindow = fs.readFileSync(path.join(__dirname, "../desktop/keywin.html"), "utf8");
  assert.match(keyWindow, /script src="keywin-renderer\.js"/);
  assert.doesNotMatch(keyWindow, /<script>(.|\n)*<\/script>/);
  const packageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  assert.ok(packageConfig.build.files.includes("keywin-renderer.js"));
});

test("Audio-Renderer erlaubt das interne ONNX-WebGPU-Modul aus einem Blob", () => {
  const pillSource = fs.readFileSync(path.join(__dirname, "../desktop/pill.html"), "utf8");
  assert.match(pillSource, /script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:/);
  assert.match(pillSource, /worker-src 'self' blob:/);
});

test("Desktop erkennt fehlende lokale Laufzeitdateien vor einem Diktat", () => {
  const existing = new Set(REQUIRED_LOCAL_RUNTIME_FILES.slice(0, -1));
  const fakeFs = { existsSync: (file) => existing.has(path.basename(file)) };
  assert.deepEqual(inspectLocalRuntimeAssets(fakeFs, "/app"), {
    ready: false,
    missing: [REQUIRED_LOCAL_RUNTIME_FILES.at(-1)],
  });
  assert.deepEqual(inspectLocalRuntimeAssets({ existsSync: () => true }, "/app"), {
    ready: true,
    missing: [],
  });
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  for (const file of [...REQUIRED_LOCAL_RUNTIME_FILES, "runtime-assets.js"]) {
    assert.ok(packageJson.build.files.includes(file));
  }
});

test("Desktop-Modellmanager lädt sichtbar und startet fertige Modelle cache-only", () => {
  const pillSource = fs.readFileSync(path.join(__dirname, "../desktop/pill.html"), "utf8");
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const settingsSource = fs.readFileSync(path.join(__dirname, "../desktop/settings.html"), "utf8");
  assert.match(settingsSource, /model-download/);
  assert.match(settingsSource, /model-cancel/);
  assert.match(settingsSource, /model-remove/);
  assert.match(pillSource, /local_files_only:\s*!allowDownload/);
  assert.match(pillSource, /await pipeline\("automatic-speech-recognition", model\.id, \{\s*\.\.\.common,\s*device: "wasm"/);
  assert.match(pillSource, /loadedBackend = "wasm"/);
  assert.match(pillSource, /isLocalModelCacheUrl/);
  assert.match(pillSource, /cache\.delete/);
  assert.match(pillSource, /activeModelController\?\.abort/);
  assert.match(mainSource, /localModelStatus\.state !== "ready"/);
  assert.match(mainSource, /sendLocalModelCommand\("download"\)/);
});

test("Desktop-Ergebnisse laufen durch den gemeinsamen Verarbeitungskern", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(mainSource, /sharedCore\.runProcessingJob/);
  assert.match(mainSource, /sharedCore\.transcribeWithCloudProvider/);
  assert.match(mainSource, /sharedCore\.refineWithOpenAIProvider/);
  assert.doesNotMatch(mainSource, /function canonicalizeTerms/);
  assert.doesNotMatch(mainSource, /api\.openai\.com\/v1\/audio\/transcriptions/);
  assert.doesNotMatch(mainSource, /api\.openai\.com\/v1\/responses/);
});

test("Systemweites Diktat gibt auf macOS Fokus an die vorherige App zurück", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(mainSource, /workspaceWin\.hide\(\);[\s\S]{0,500}if \(IS_MAC\) app\.hide\(\);[\s\S]{0,500}startRecording\("workspace"\)/);
  assert.match(mainSource, /delay 0\.12[\s\S]{0,200}keystroke "v" using command down/);
});

test("Desktop-Qualitätsmodus routet nur das ausdrücklich gewählte 1.0-Profil", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const settingsHtml = fs.readFileSync(path.join(__dirname, "../desktop/settings.html"), "utf8");
  assert.match(mainSource, /transcriptionProvider === "groq"/);
  assert.match(mainSource, /transcriptionProvider === "openai-compatible"/);
  assert.match(mainSource, /normalizeCompatibleBaseUrl/);
  assert.match(settingsHtml, /OpenAI · empfohlen/);
  assert.match(settingsHtml, /Eigener kompatibler Server/);
  assert.doesNotMatch(settingsHtml, /Deepgram/);
});

test("Desktop-Einstellungen erhalten Bereinigung und lokalen Refinement-Anbieter vollständig", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const rendererSource = fs.readFileSync(path.join(__dirname, "../desktop/settings-renderer.js"), "utf8");
  const preloadSource = fs.readFileSync(path.join(__dirname, "../desktop/settings-preload.js"), "utf8");
  const htmlSource = fs.readFileSync(path.join(__dirname, "../desktop/settings.html"), "utf8");
  for (const field of ["cleanup", "refinementProvider", "ollamaBaseUrl", "ollamaModel"]) {
    assert.match(mainSource, new RegExp(`${field}: settings\\.${field}`));
    assert.match(rendererSource, new RegExp(`\\b${field}\\b`));
  }
  assert.match(mainSource, /sharedCore\.refineWithOllamaProvider/);
  assert.match(mainSource, /sharedCore\.listOllamaModels/);
  assert.match(mainSource, /ipcMain\.on\("settings-rendered"/);
  assert.match(rendererSource, /api\.rendered/);
  assert.match(preloadSource, /ipcRenderer\.send\("settings-rendered"/);
  assert.match(htmlSource, /data-setting="interfaceLanguage"/);
  assert.match(htmlSource, /src="i18n-renderer\.js"/);
  assert.match(rendererSource, /setLanguage\(s\.interfaceLanguage\)/);
});

test("Desktop routet kompatible Textüberarbeitung mit eigenem Ziel und Key", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const settingsHtml = fs.readFileSync(path.join(__dirname, "../desktop/settings.html"), "utf8");
  assert.match(mainSource, /sharedCore\.refineWithCompatibleProvider/);
  assert.match(mainSource, /getProviderKey\("openai-compatible-refinement"\)/);
  assert.match(mainSource, /compatibleRefinementCredentialRef/);
  assert.match(settingsHtml, /compatibleRefinementBaseUrl/);
  assert.match(settingsHtml, /Textserver-Key \(optional\)/);
});

test("Desktop-Arbeitsbereich kapselt vier 1.0-Bereiche hinter enger IPC-Brücke", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const preloadSource = fs.readFileSync(path.join(__dirname, "../desktop/workspace-preload.js"), "utf8");
  const rendererSource = fs.readFileSync(path.join(__dirname, "../desktop/workspace-renderer.js"), "utf8");
  const htmlSource = fs.readFileSync(path.join(__dirname, "../desktop/workspace.html"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));

  for (const page of ["dictation", "recordings", "files", "history"]) {
    assert.match(htmlSource, new RegExp(`data-page="${page}"`));
    assert.match(htmlSource, new RegExp(`data-panel="${page}"`));
  }
  for (const file of ["workspace.html", "workspace-preload.js", "workspace-renderer.js", "workspace-jobs.js", "workspace-recordings.js", "workspace-store.js"]) {
    assert.ok(packageJson.build.files.includes(file));
  }
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /requireWorkspaceSender/);
  assert.match(mainSource, /Nivune öffnen/);
  assert.match(preloadSource, /workspace-read/);
  assert.match(preloadSource, /workspace-action/);
  assert.match(preloadSource, /workspace-append-recording-fragment/);
  assert.match(preloadSource, /workspace-finish-recording/);
  assert.doesNotMatch(preloadSource, /workspace-submit-audio/);
  assert.doesNotMatch(preloadSource, /shell|fs|child_process|ipcRenderer:\s*ipcRenderer/);
  assert.match(rendererSource, /querySelectorAll\("\[data-page\]"\)/);
  assert.match(rendererSource, /MediaRecorder/);
  assert.match(rendererSource, /pause-recording/);
  assert.match(rendererSource, /resume-recording/);
  assert.match(rendererSource, /set-audio-retention/);
  assert.match(rendererSource, /retry-recovery/);
  assert.match(rendererSource, /confirmUncertain/);
  assert.match(mainSource, /dialog\.showOpenDialog/);
  assert.match(mainSource, /validateAudioFile/);
  assert.match(mainSource, /SerialWorkspaceQueue/);
  assert.match(mainSource, /createWorkspaceStore/);
  assert.match(mainSource, /createWorkspaceRecordingStore/);
  assert.match(mainSource, /workspaceRecordingStore\.markTranscribed/);
  assert.match(mainSource, /recovery\.uncertainStage && payload\?\.confirmUncertain !== true/);
  assert.doesNotMatch(mainSource, /workspace-submit-audio/);
  assert.match(mainSource, /save-history-text/);
  assert.match(mainSource, /export-history/);
  assert.match(mainSource, /export-settings/);
  assert.match(mainSource, /import-settings/);
  assert.match(mainSource, /syncWakeAudioState/);
  assert.match(rendererSource, /history-search/);
  assert.match(rendererSource, /clear-history/);
  assert.match(rendererSource, /TXT exportieren/);
  assert.match(rendererSource, /Markdown exportieren/);
  assert.match(rendererSource, /api\.rendered/);
  assert.match(htmlSource, /src="i18n-renderer\.js"/);
  assert.match(rendererSource, /setLanguage\(state\.interfaceLanguage\)/);
});

test("Sprechblase und Arbeitsbereich teilen einen zentral begrenzten Mikrofon-Handler", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const permissionSource = fs.readFileSync(path.join(__dirname, "../desktop/media-permissions.js"), "utf8");
  const packageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));

  assert.equal((mainSource.match(/configureMediaPermissions\(/g) || []).length, 1);
  assert.doesNotMatch(mainSource, /webContents\.session\.setPermissionRequestHandler/);
  assert.match(permissionSource, /setPermissionCheckHandler/);
  assert.match(permissionSource, /setPermissionRequestHandler/);
  assert.match(permissionSource, /permission !== "media"/);
  assert.ok(packageConfig.build.files.includes("media-permissions.js"));
});

test("Desktop-Ersteinrichtung führt ohne automatische Hintergrundaktivierung bis zum Probentext", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const preloadSource = fs.readFileSync(path.join(__dirname, "../desktop/onboarding-preload.js"), "utf8");
  const rendererSource = fs.readFileSync(path.join(__dirname, "../desktop/onboarding-renderer.js"), "utf8");
  const htmlSource = fs.readFileSync(path.join(__dirname, "../desktop/onboarding.html"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  for (const file of ["onboarding.html", "onboarding-preload.js", "onboarding-renderer.js", "i18n-renderer.js", "onboarding-store.js"]) {
    assert.ok(packageJson.build.files.includes(file));
  }
  for (const step of ["language", "provider", "sample", "finish"]) assert.match(htmlSource, new RegExp(`data-step="${step}"`));
  assert.match(htmlSource, /Auf diesem Gerät/);
  assert.match(htmlSource, /Eigener Server/);
  assert.match(htmlSource, /Probeaufnahme starten/);
  assert.match(htmlSource, /Dein Text geht nicht verloren/);
  assert.match(preloadSource, /onboarding-read/);
  assert.match(preloadSource, /onboarding-action/);
  assert.doesNotMatch(preloadSource, /shell|fs|child_process|ipcRenderer:\s*ipcRenderer/);
  assert.match(rendererSource, /launchAtLogin/);
  assert.match(rendererSource, /set-interface-language/);
  assert.match(mainSource, /interfaceLanguage: settings\.interfaceLanguage/);
  assert.match(htmlSource, /data-interface-language="en"/);
  assert.match(rendererSource, /voiceActivation/);
  assert.match(mainSource, /startRecording\("onboarding"\)/);
  assert.match(mainSource, /clipboard\.writeText\(finalText\)/);
  assert.match(mainSource, /Autostart wird am Ende der Einrichtung gewählt/);
  assert.match(mainSource, /onboardingState\.sampleCompleted/);
  assert.match(mainSource, /onboardingStore\.update\(\{ step: 3, sampleCompleted: true \}\)/);
  assert.match(mainSource, /continue-after-sample/);
  assert.match(htmlSource, /data-action="continue-after-sample"/);
  assert.doesNotMatch(htmlSource, /data-next="4" id="sample-next"/);
  assert.match(rendererSource, /visibleStep !== step/);
  assert.match(rendererSource, /\$\("sample-card"\)\.dataset\.state = sampleState/);
  assert.match(htmlSource, /id="sample-card" data-state="idle"/);
  assert.match(mainSource, /Math\.max\(previousStatus\.progress \|\| 0, reportedProgress\)/);
  assert.match(mainSource, /app\.dock\?\.show\(\)/);
  assert.match(mainSource, /syncDockVisibility/);
  assert.match(mainSource, /WebContentsView/);
  assert.match(mainSource, /createOnboardingAudioView/);
  assert.match(mainSource, /trigger === "onboarding" \? onboardingAudioView\?\.webContents : pill\?\.webContents/);
  assert.match(mainSource, /activeRecordingContents = audioContents/);
  assert.match(mainSource, /trigger !== "onboarding"[\s\S]*pill\.showInactive\(\)/);
  assert.match(mainSource, /app\.focus\(\{ steal: true \}\)/);
  assert.match(mainSource, /onboardingAudioView\.setVisible\(false\)/);
  assert.match(mainSource, /destroyOnboardingAudioView/);
  assert.match(mainSource, /if \(ONBOARDING_TEST\) setTimeout\(quitApp, 750\)\.unref\(\)/);
  assert.doesNotMatch(mainSource, /pill\.setParentWindow\(onboardingWin\)/);
  assert.doesNotMatch(mainSource, /fullscreenable: false/);
});

test("Desktop lässt den persönlichen Startbefehl frei wählen und paketiert seine Regeln", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const setupSource = fs.readFileSync(path.join(__dirname, "../desktop/wakesetup-renderer.js"), "utf8");
  const wakeSource = fs.readFileSync(path.join(__dirname, "../desktop/wake-renderer.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../desktop/wakekey.html"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));

  assert.match(html, /id="wake-phrase"/);
  assert.match(setupSource, /normalizeWakePhrase/);
  assert.match(setupSource, /label: phrase\.label/);
  assert.match(mainSource, /phrase: wakePhrase/);
  assert.match(wakeSource, /config\.phrase/);
  assert.ok(packageJson.build.files.includes("wake-phrase.js"));
});

test("Paketierter Modell-Smoke nutzt nur ein isoliertes Profil und gesperrtes Netzwerk", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const pillSource = fs.readFileSync(path.join(__dirname, "../desktop/pill.html"), "utf8");

  assert.match(mainSource, /--model-smoke-test/);
  assert.match(mainSource, /enableNetworkEmulation\(\{ offline: true \}\)/);
  assert.match(mainSource, /\^nivune-model-smoke-/);
  assert.match(mainSource, /MODEL_SMOKE_OK/);
  assert.match(pillSource, /local_files_only:\s*!allowDownload/);
  assert.match(pillSource, /localFilesOnly:\s*true/);
  assert.match(pillSource, /backend:\s*loadedBackend/);
});

test("Desktop räumt globale Shortcuts nur nach vollständigem Electron-Start auf", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(mainSource, /app\.on\("will-quit", \(\) => \{[\s\S]*?if \(app\.isReady\(\)\) globalShortcut\.unregisterAll\(\);\s*\}\);/);
});

test("nicht entschlüsselbare übernommene Keys gelten als fehlend statt als gespeichert", () => {
  const main = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(main, /unreadableCredentials\.set\(provider, encrypted\)/);
  assert.match(main, /function hasStoredKey\(provider\)/);
  assert.doesNotMatch(main, /Boolean\(settings\.[a-zA-Z]+KeyEnc\)/, "Statusanzeigen verwenden hasStoredKey");
  assert.match(main, /settings\.mode === "quality"\) \{[\s\S]{0,300}getProviderKey\(settings\.transcriptionProvider/);
});

test("Key-Fenster öffnet als Dialog vor dem aufrufenden Fenster", () => {
  const main = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(main, /\[onboardingWin, settingsWin, workspaceWin\][\s\S]{0,300}isFocused\(\)/);
  assert.match(main, /\.\.\.\(owner \? \{ parent: owner, modal: true \} : \{\}\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../desktop/keywin-renderer.js"), "utf8"), /Escape/);
});

test("Arbeitsbereich-Navigation nutzt gezeichnete Icons statt Textzeichen", () => {
  const html = fs.readFileSync(path.join(__dirname, "../desktop/workspace.html"), "utf8");
  const nav = html.slice(html.indexOf('<nav class="workspace-navigation"'), html.indexOf("</nav>"));
  assert.equal((nav.match(/<svg /g) || []).length, 4);
  assert.doesNotMatch(nav, /[⌁●▱↶]/);
});

test("Beenden von außen wird nicht durch die nicht schließbare Aufnahmeblase blockiert", () => {
  const main = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(main, /app\.on\("before-quit", \(\) => \{[\s\S]{0,120}isQuitting = true;[\s\S]{0,80}pill\?\.destroy\(\)/);
  assert.match(main, /for \(const signal of \["SIGTERM", "SIGINT"\]\)[\s\S]{0,80}quitApp\(\)/);
});
