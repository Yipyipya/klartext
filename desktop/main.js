const electron = require("electron");
const {
  app,
  BrowserWindow,
  WebContentsView,
  Tray,
  Menu,
  globalShortcut,
  clipboard,
  ipcMain,
  screen,
  systemPreferences,
  shell,
  nativeImage,
  Notification,
  dialog,
  powerSaveBlocker,
  nativeTheme,
  session,
} = electron;
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { validateSettingsPatch } = require("./settings-contract");
const sharedCore = require("./shared-core.cjs");
const { createDesktopSettingsStore } = require("./settings-store");
const { configureLogin } = require("./startup");
const { configureRuntime, createFileLogger, installPipeGuards } = require("./runtime");
const { inspectLocalRuntimeAssets } = require("./runtime-assets");
const { ACCESSIBILITY_SETTINGS_URL, getPasteAccess } = require("./accessibility");
const {
  loadEnrolledWakeModels,
  saveEnrolledWakeModels,
  removeEnrolledWakeModels,
} = require("./wake-runtime");
const { DEFAULT_WAKE_PHRASE, defaultWakePhrase } = require("./wake-phrase");
const { trimTailMs, stripTrailingStopCommand } = require("./wake-controller");
const {
  SerialWorkspaceQueue,
  validateAudioFile,
  validateCapturedAudio,
  transitionCapture,
} = require("./workspace-jobs");
const { createWorkspaceStore, historyExport, MAX_TEXT_LENGTH } = require("./workspace-store");
const { createWorkspaceRecordingStore, MAX_FRAGMENT_BYTES } = require("./workspace-recordings");
const { createOnboardingStore } = require("./onboarding-store");
const { configureMediaPermissions } = require("./media-permissions");
const { validateSystemResultPayload } = require("./audio-runtime");

const WEB_URL = sharedCore.WEB_APP_URL;
const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";
const SETTINGS_PREVIEW = process.argv.includes("--settings-preview");
const SETTINGS_SMOKE = process.argv.includes("--settings-smoke-test");
const WORKSPACE_PREVIEW = process.argv.includes("--workspace-preview");
const WORKSPACE_SMOKE = process.argv.includes("--workspace-smoke-test");
const ONBOARDING_PREVIEW = process.argv.includes("--onboarding-preview");
const ONBOARDING_SMOKE = process.argv.includes("--onboarding-smoke-test");
const ONBOARDING_TEST = process.argv.includes("--onboarding-test");
const ONBOARDING_TEST_PROFILE = process.argv.find((value) => value.startsWith("--onboarding-test-profile="))?.split("=")[1] || "";
const MODEL_SMOKE = process.argv.includes("--model-smoke-test");
const MODEL_SMOKE_PROFILE = process.argv.find((value) => value.startsWith("--model-smoke-profile="))?.split("=")[1] || "";
const ONBOARDING_PREVIEW_STEP = Math.max(1, Math.min(4, Number(process.argv.find((value) => value.startsWith("--onboarding-preview-step="))?.split("=")[1]) || 4));
const SMOKE_TEST = process.argv.includes("--smoke-test") || SETTINGS_PREVIEW || SETTINGS_SMOKE
  || WORKSPACE_PREVIEW || WORKSPACE_SMOKE || ONBOARDING_PREVIEW || ONBOARDING_SMOKE || MODEL_SMOKE;
const SETUP_VOICE = process.argv.includes("--setup-voice");
const ALPHA_BUILD = app.getName() === "Nivune Alpha"
  || path.basename(process.execPath) === "Nivune Alpha"
  || process.env.NIVUNE_ALPHA_BUILD === "1"
  || process.env.KLARTEXT_ALPHA_BUILD === "1";

// Der lokale Wake-Word-Renderer muss auch als vollständig unsichtbares
// Menüleistenfenster kontinuierlich Audio verarbeiten. Diese Schalter gelten
// nur für Nivune und verhindern, dass Chromium ihn im Hintergrund einfriert.
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
const runtime = configureRuntime(app, process.platform, process.env, SMOKE_TEST, ALPHA_BUILD);
if (MODEL_SMOKE) {
  const safeProfile = /^nivune-model-smoke-[a-zA-Z0-9_-]+$/.test(MODEL_SMOKE_PROFILE)
    ? path.join(app.getPath("temp"), MODEL_SMOKE_PROFILE)
    : null;
  if (!safeProfile || !fs.existsSync(safeProfile)) {
    console.error("MODEL_SMOKE_FAILED: isolated cache profile is missing");
    process.exit(1);
  }
  app.setPath("userData", safeProfile);
}
if (ONBOARDING_TEST) {
  const reusableProfile = /^(?:nivune|klartext)-onboarding-test-[a-zA-Z0-9_-]+$/.test(ONBOARDING_TEST_PROFILE)
    ? path.join(app.getPath("temp"), ONBOARDING_TEST_PROFILE)
    : null;
  app.setPath("userData", reusableProfile && fs.existsSync(reusableProfile)
    ? reusableProfile
    : fs.mkdtempSync(path.join(app.getPath("temp"), "nivune-onboarding-test-")));
}
const HOTKEY = runtime.hotkey;
const HOTKEY_LABEL = runtime.hotkeyLabel;
const HOTKEY_LABEL_ENGLISH = runtime.hotkeyLabelEnglish;
const logPath = path.join(app.getPath("userData"), "nivune.log");
const logError = createFileLogger(fs, logPath);
installPipeGuards([process.stdout, process.stderr], (error) => logError("Ausgabekanal geschlossen", error));

const PILL_W = 520;
const PILL_H = 210; // Platz für die Live-Mitschrift über der Pill

let pill = null;
let onboardingAudioView = null;
let onboardingAudioReady = false;
let activeRecordingContents = null;
let tray = null;
let recording = false;
let processing = false;
let starting = false;
let recordingTrigger = null;
let pillReady = false;
let preparation = "Wird vorbereitet …";
let loginState = { supported: false, enabled: false, detail: "Autostart wird geprüft …" };
let isQuitting = false;
let wakeWin = null;
let wakeReady = false;
let wakeGeneration = 0;
let pendingWakeConfig = null;
let wakeStatus = { state: "disabled", detail: "Sprachaktivierung ist ausgeschaltet" };
let wakeModelsAvailable = false;
let wakePhrase = DEFAULT_WAKE_PHRASE;
let wakePowerSaveBlockerId = null;
let wakeReadyTimer = null;
let wakeReloadAttempts = 0;
const localRuntimeStatus = inspectLocalRuntimeAssets(fs, __dirname);
let localModelStatus = localRuntimeStatus.ready
  ? { choice: null, state: "missing", progress: 0, files: 0, error: null }
  : { choice: null, state: "error", progress: 0, files: 0, error: "LOCAL_RUNTIME_MISSING" };
let localModelCommandId = 0;
let ollamaStatus = { state: "idle", models: [], error: null };
let transcriptionProviderStatus = { state: "idle", models: [], supported: true, error: null };
let refinementProviderStatus = { state: "idle", models: [], supported: true, error: null };
// Updateprüfung nur auf ausdrücklichen Befehl; es wird nie etwas heruntergeladen oder installiert.
let updateStatus = { state: "idle", latest: null, error: null };
let workspaceCapture = null;
let workspaceQueue = null;
let workspaceJobSequence = 0;
let workspaceLocalSequence = 0;
const workspaceLocalRequests = new Map();
const workspacePersistedJobIds = new Set();
let onboardingState = { schemaVersion: 1, completed: false, step: 1, sampleCompleted: false, completedAt: null };
let onboardingSample = { state: "idle", text: "", error: null };

function showUserWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (IS_MAC) {
    void app.dock?.show();
    app.focus({ steal: true });
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function syncDockVisibility() {
  if (!IS_MAC || isQuitting) return;
  const hasVisibleSurface = [settingsWin, onboardingWin, workspaceWin, keyWin, wakeSetupWin]
    .some((window) => window && !window.isDestroyed() && window.isVisible());
  if (!hasVisibleSurface) app.dock?.hide();
}

function createOnboardingAudioView() {
  if (!onboardingWin || onboardingWin.isDestroyed() || onboardingAudioView) return;
  onboardingAudioReady = false;
  onboardingAudioView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  onboardingAudioView.setBounds({ x: 0, y: 0, width: 1, height: 1 });
  onboardingAudioView.setVisible(false);
  onboardingAudioView.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  onboardingAudioView.webContents.on("will-navigate", (event) => event.preventDefault());
  onboardingAudioView.webContents.on("render-process-gone", (_event, details) => {
    onboardingAudioReady = false;
    logError("Audiokomponente der Ersteinrichtung wurde unerwartet beendet", details?.reason || "unbekannt");
  });
  onboardingWin.contentView.addChildView(onboardingAudioView);
  onboardingAudioView.webContents.loadFile(path.join(__dirname, "pill.html"));
}

function destroyOnboardingAudioView() {
  const view = onboardingAudioView;
  onboardingAudioView = null;
  onboardingAudioReady = false;
  if (!view) return;
  try {
    if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.contentView.removeChildView(view);
  } catch { /* parent window is already closing */ }
  try {
    if (!view.webContents.isDestroyed()) view.webContents.close();
  } catch { /* renderer is already closed */ }
}

function currentRecordingContents() {
  return activeRecordingContents && !activeRecordingContents.isDestroyed()
    ? activeRecordingContents
    : null;
}

function workspaceIsBusy() {
  return Boolean(workspaceCapture) || Boolean(workspaceQueue?.isBusy());
}

function anyAudioWorkBusy() {
  return recording || processing || starting || workspaceIsBusy();
}

function syncWakeAudioState() {
  setWakeRecordingState(recording || workspaceIsBusy());
}

function configureCurrentLogin(force = false) {
  if (ALPHA_BUILD) {
    return { supported: false, enabled: false, detail: "Autostart ist in der internen Alpha deaktiviert." };
  }
  return configureLogin(app, settings, process.platform, process.execPath, force);
}

function getCurrentPasteAccess() {
  if (!IS_MAC) return getPasteAccess(process.platform, true);
  try {
    // Nur lesen: Ein Aufnahme-Start darf niemals einen Bedienungshilfen-Dialog auslösen.
    return getPasteAccess(process.platform, systemPreferences.isTrustedAccessibilityClient(false));
  } catch (error) {
    logError("Bedienungshilfen-Status konnte nicht gelesen werden", error);
    return getPasteAccess(process.platform, false);
  }
}

// Nur eine Instanz zulassen. Ohne das startet jeder Aufruf eine neue Kopie
// (mehrfach im Task-Manager, „(2)“/„(3)“, jeweils eigener RAM-Verbrauch).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
app.on("second-instance", (_event, argv) => {
  // Zweiter Start: vorhandene Instanz zeigt ihr Menü, statt sich zu verdoppeln.
  if (argv.includes("--setup-voice")) openWakeSetupWindow();
  else if (!onboardingState.completed) openOnboardingWindow();
  else openWorkspaceWindow();
});

/* ---------- Einstellungen (userData/settings.json) ---------- */
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const settingsStore = createDesktopSettingsStore({
  fs,
  settingsPath: settingsPath(),
  schema: sharedCore,
  log: logError,
});
const workspaceHistoryStore = createWorkspaceStore({
  fs,
  historyPath: path.join(app.getPath("userData"), "workspace-history.json"),
  log: logError,
});
const workspaceRecordingStore = createWorkspaceRecordingStore({
  fs,
  rootPath: path.join(app.getPath("userData"), "workspace-recordings"),
  log: logError,
});
const onboardingStore = createOnboardingStore({
  fs,
  statePath: path.join(app.getPath("userData"), "onboarding.json"),
  log: logError,
});

function loadSettings() {
  return settingsStore.load().settings;
}

function saveSettings(s) {
  try {
    settings = settingsStore.save(s);
  } catch (error) {
    logError("Einstellungen konnten nicht gespeichert werden", error);
  }
}

let settings = null;
const credentialCache = new Map();

function uiText(german, english) {
  return settings?.interfaceLanguage === "en" ? english : german;
}

function localizedShortcutLabel() {
  return settings?.interfaceLanguage === "en" ? HOTKEY_LABEL_ENGLISH : HOTKEY_LABEL;
}

function localizedRuntimeText(value) {
  if (settings?.interfaceLanguage !== "en") return value;
  const exact = new Map([
    ["Wird vorbereitet …", "Preparing …"],
    ["Lokales Modell bereit", "Local model ready"],
    ["Lokales Modell nicht geladen", "Local model not downloaded"],
    ["Lokaler Modelldownload unvollständig", "Local model download incomplete"],
    ["Lokales Modell konnte nicht geprüft werden", "Local model status could not be checked"],
    ["Lokales Modell wird geprüft …", "Checking local model …"],
    ["Lokale Laufzeitdateien fehlen", "Local runtime files are missing"],
    ["Sprachaktivierung ist ausgeschaltet", "Voice activation is off"],
    ["Persönlicher Startbefehl fehlt", "Personal start phrase is missing"],
    ["Persönlicher Startbefehl noch nicht eingerichtet", "Personal start phrase not set up yet"],
    ["Startbefehl wird eingerichtet …", "Setting up start phrase …"],
    ["Sprachlistener konnte nicht gestartet werden", "Voice listener could not start"],
    ["Sprachlistener wird neu gestartet …", "Restarting voice listener …"],
    ["Mikrofonzugriff für Nivune erlauben", "Allow microphone access for Nivune"],
    ["Persönlicher Startbefehl wird vorbereitet …", "Preparing personal start phrase …"],
    ["Persönlicher Startbefehl wird vorbereitet …", "Preparing personal start phrase …"],
    ["Lokale Spracherkennung fehlt", "Local voice detection is missing"],
    ["Persönlicher Startbefehl wird geladen …", "Loading personal start phrase …"],
    ["Mikrofon wird verbunden …", "Connecting microphone …"],
    ["Bereit für „Diktat starten“", "Ready for “Start dictation”"],
    ["Sprachmodell bitte neu einlernen", "Please set up the voice model again"],
    ["Autostart: nur in der installierten App", "Launch at login: installed app only"],
    ["Autostart: zuerst nach Programme verschieben", "Launch at login: move the app to Applications first"],
    ["Autostart: aktiv", "Launch at login: on"],
    ["Autostart: aus", "Launch at login: off"],
    ["Autostart: bitte in macOS freigeben", "Launch at login: allow it in macOS"],
    ["Autostart: aus oder vom System blockiert", "Launch at login: off or blocked by the system"],
    ["Autostart: bitte in den Systemeinstellungen prüfen", "Launch at login: check System Settings"],
    ["Autostart ist in der internen Alpha deaktiviert.", "Launch at login is disabled in the internal alpha."],
    ["Autostart wird am Ende der Einrichtung gewählt.", "Launch at login is selected at the end of setup."],
    ["Autostart ist erst in der installierten App verfügbar.", "Launch at login is only available in the installed app."],
    ["In der isolierten Vorschau deaktiviert.", "Disabled in the isolated preview."],
    ["Mikrofon ist freigegeben.", "Microphone access is allowed."],
    ["Mikrofonzugriff ist nicht erlaubt.", "Microphone access is not allowed."],
    ["Mikrofonzugriff ist eingeschränkt.", "Microphone access is restricted."],
    ["Freigabe wird beim ersten Diktat angefragt.", "Permission will be requested on the first dictation."],
    ["Wird beim ersten Diktat vom Betriebssystem angefragt.", "The operating system will ask on the first dictation."],
    ["Bedienungshilfen sind freigegeben.", "Accessibility access is allowed."],
    ["Bedienungshilfen bitte in macOS freigeben.", "Please allow Accessibility access in macOS."],
    ["Einfügen per Tastatursimulation. Einzelne Apps können es einschränken.", "Paste uses keyboard simulation. Some apps may restrict it."],
    ["OpenAI API-Key fehlt", "OpenAI API key missing"],
    ["Groq API-Key fehlt", "Groq API key missing"],
    ["Groq-Modell fehlt", "Groq model missing"],
    ["Sichere Server-Adresse fehlt", "Secure server address missing"],
    ["Modell-ID fehlt", "Model ID missing"],
    ["Sichere Textserver-Adresse fehlt", "Secure text server address missing"],
    ["Textmodell-ID fehlt", "Text model ID missing"],
  ]);
  if (exact.has(value)) return exact.get(value);
  const download = /^Lokales Modell lädt … (\d+) %$/.exec(value || "");
  if (download) return `Downloading local model … ${download[1]}%`;
  const wakeReady = /^Bereit für „(.+)“$/.exec(value || "");
  if (wakeReady) return `Ready for “${wakeReady[1]}”`;
  if (String(value || "").startsWith("Qualitätsmodus · ")) return `Quality mode · ${String(value).slice("Qualitätsmodus · ".length)}`;
  return value;
}

function providerLabel(provider = settings?.transcriptionProvider) {
  return provider === "groq" ? "Groq"
    : provider === "openai-compatible-refinement" ? uiText("kompatibler Textserver", "compatible text server")
      : provider === "openai-compatible" ? uiText("kompatibler Server", "compatible server") : "OpenAI";
}

function encryptedCredential(provider = "openai") {
  if (provider === "groq") return settings?.groqKeyEnc || null;
  if (provider === "openai-compatible") return settings?.compatibleTranscriptionKeyEnc || null;
  if (provider === "openai-compatible-refinement") return settings?.compatibleRefinementKeyEnc || null;
  return settings?.openaiKeyEnc || null;
}

// Keys, die das Betriebssystem nicht mehr entschlüsseln kann (etwa ein von der
// früheren Klartext-App gespeicherter Key), gelten als fehlend statt als gespeichert.
const unreadableCredentials = new Map();

function getProviderKey(provider = "openai") {
  const encrypted = encryptedCredential(provider);
  if (!encrypted) return null;
  const cached = credentialCache.get(provider);
  if (cached?.encrypted === encrypted) return cached.value;
  if (unreadableCredentials.get(provider) === encrypted) return null;
  try {
    // safeStorage touches the macOS Keychain. Resolve it only when an encrypted
    // credential is actually needed so a fully local setup stays Keychain-free.
    const value = electron.safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    credentialCache.set(provider, { encrypted, value });
    unreadableCredentials.delete(provider);
    return value;
  } catch (error) {
    unreadableCredentials.set(provider, encrypted);
    logError(`Gespeicherter ${provider}-Key ist nicht entschlüsselbar und muss neu hinterlegt werden`, error?.message || "");
    return null;
  }
}

function hasStoredKey(provider) {
  const encrypted = encryptedCredential(provider);
  return Boolean(encrypted) && unreadableCredentials.get(provider) !== encrypted;
}

function qualitySetupIssue() {
  const provider = settings.transcriptionProvider || "openai";
  if (provider === "openai" && !hasStoredKey("openai")) return { type: "key", provider, message: "OpenAI API-Key fehlt" };
  if (provider === "groq" && !hasStoredKey("groq")) return { type: "key", provider, message: "Groq API-Key fehlt" };
  if (provider === "groq" && !settings.groqModel?.trim()) return { type: "settings", provider, message: "Groq-Modell fehlt" };
  if (provider === "openai-compatible") {
    if (!sharedCore.normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl || "")) return { type: "settings", provider, message: "Sichere Server-Adresse fehlt" };
    if (!settings.compatibleTranscriptionModel?.trim()) return { type: "settings", provider, message: "Modell-ID fehlt" };
  }
  return null;
}

function refinementSetupIssue() {
  if (settings.cleanup === "aus" || ["none", "deterministic", "ollama"].includes(settings.refinementProvider)) return null;
  if (settings.refinementProvider === "openai" && !hasStoredKey("openai")) {
    return { type: "key", provider: "openai", message: "OpenAI API-Key fehlt" };
  }
  if (settings.refinementProvider === "openai-compatible") {
    if (!sharedCore.normalizeCompatibleBaseUrl(settings.compatibleRefinementBaseUrl || "")) {
      return { type: "settings", provider: "openai-compatible-refinement", message: "Sichere Textserver-Adresse fehlt" };
    }
    if (!settings.compatibleRefinementModel?.trim()) {
      return { type: "settings", provider: "openai-compatible-refinement", message: "Textmodell-ID fehlt" };
    }
  }
  return null;
}

/* ---------- Pill-Fenster ---------- */
function createPill() {
  pill = new BrowserWindow({
    width: PILL_W,
    height: PILL_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false, // stiehlt der Ziel-App nie den Fokus – wichtig fürs Einfügen
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  pill.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  pill.webContents.on("will-navigate", (event) => event.preventDefault());
  pill.setAlwaysOnTop(true, "screen-saver");
  pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pill.webContents.on("render-process-gone", (_event, details) => {
    logError("Aufnahmefenster wurde unerwartet beendet", details?.reason || "unbekannt");
  });
  // Alle Fenster teilen dieselbe Electron-Session. Deshalb darf genau ein
  // zentraler Handler die bekannten Audio-Renderer freigeben; fensterspezifische
  // Handler würden sich gegenseitig ersetzen und etwa die Sprechblase sperren,
  // sobald der Arbeitsbereich geöffnet wurde.
  configureMediaPermissions(pill.webContents.session, () => [
    pill?.webContents,
    onboardingAudioView?.webContents,
    workspaceWin?.webContents,
    wakeSetupWin?.webContents,
    wakeWin?.webContents,
  ]);
  pill.loadFile("pill.html");
}

function positionPill() {
  // Auf dem Bildschirm anzeigen, auf dem der Mauszeiger ist (dort arbeitet der Nutzer)
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const wa = display.workArea;
  pill.setBounds({
    x: Math.round(wa.x + (wa.width - PILL_W) / 2),
    y: Math.round(wa.y + wa.height - PILL_H - 24),
    width: PILL_W,
    height: PILL_H,
  });
}

/* ---------- Aufnahme-Steuerung ---------- */
async function startRecording(trigger = "shortcut") {
  const audioContents = trigger === "onboarding" ? onboardingAudioView?.webContents : pill?.webContents;
  const audioReady = trigger === "onboarding" ? onboardingAudioReady : pillReady;
  if (recording || starting || processing || workspaceIsBusy() || !audioContents || audioContents.isDestroyed() || !audioReady) return false;
  if (settings.mode === "quality") {
    const issue = qualitySetupIssue();
    if (issue?.type === "key") openKeyWindow(issue.provider);
    if (issue?.type === "settings") {
      preparation = issue.message;
      openSettingsWindow();
      updateTray();
    }
    if (issue) return false;
  }
  const refinementIssue = refinementSetupIssue();
  if (refinementIssue?.type === "key") openKeyWindow(refinementIssue.provider);
  if (refinementIssue?.type === "settings") {
    preparation = refinementIssue.message;
    openSettingsWindow();
    updateTray();
  }
  if (refinementIssue) return false;
  if (settings.mode === "local" && (localModelStatus.choice !== settings.model || localModelStatus.state !== "ready")) {
    preparation = "Lokales Modell zuerst in den Einstellungen herunterladen";
    openSettingsWindow();
    updateTray();
    return false;
  }
  starting = true;
  updateTray();
  try {
    // Nur die Mikrofonfreigabe ist für die Aufnahme nötig. Bedienungshilfen werden
    // erst nach der Transkription fürs automatische Einfügen ausgewertet.
    if (IS_MAC && systemPreferences.getMediaAccessStatus("microphone") !== "granted") {
      const allowed = await systemPreferences.askForMediaAccess("microphone");
      if (!allowed) return false;
    }
    if (trigger === "voice") {
      shell.beep();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch (error) {
    logError("Mikrofonberechtigung konnte nicht geprüft werden", error);
    return false;
  } finally {
    starting = false;
    updateTray();
  }
  recording = true;
  recordingTrigger = trigger;
  activeRecordingContents = audioContents;
  if (trigger !== "onboarding") {
    positionPill();
    // Das vorher aktive Textfeld muss den Fokus behalten, damit das Ergebnis an
    // exakt derselben Cursorposition eingefügt werden kann.
    pill.showInactive();
    pill.moveTop();
    pill.setAlwaysOnTop(true, "screen-saver");
  }
  audioContents.send("start", {
    interfaceLanguage: settings.interfaceLanguage,
    lang: settings.lang,
    mode: settings.mode,
    model: settings.model,
    hasOpenAIKey: settings.mode === "quality",
    trigger,
  });
  if (trigger === "onboarding") {
    // Die Probe läuft in einem WebContentsView des Einrichtungsfensters. Es gibt
    // deshalb kein zweites macOS-Fenster, das Fokus oder Space wechseln könnte.
    showUserWindow(onboardingWin);
  }
  syncWakeAudioState();
  if (trigger === "voice") {
    logError("Sprachbefehl hat Aufnahme gestartet", `Pill sichtbar: ${pill.isVisible()}`);
  }
  globalShortcut.register("Escape", cancelRecording);
  updateTray();
  return true;
}

function stopRecording(reason = "manual") {
  const audioContents = currentRecordingContents();
  if (!recording || !audioContents) return;
  recording = false;
  processing = true;
  if (recordingTrigger === "onboarding") onboardingSample = { state: "processing", text: "", error: null };
  audioContents.send("stop", { reason, trimTailMs: trimTailMs(reason) });
  syncWakeAudioState();
  globalShortcut.unregister("Escape");
  updateTray();
  if (recordingTrigger === "onboarding") showUserWindow(onboardingWin);
}

function cancelRecording() {
  const audioContents = currentRecordingContents();
  if (!audioContents || processing) return;
  const trigger = recordingTrigger;
  recording = false;
  recordingTrigger = null;
  activeRecordingContents = null;
  audioContents.send("cancel");
  syncWakeAudioState();
  if (trigger !== "onboarding") pill?.hide();
  globalShortcut.unregister("Escape");
  updateTray();
  if (trigger === "onboarding") {
    onboardingSample = { state: "idle", text: "", error: null };
    openOnboardingWindow();
    syncOnboardingWindow();
  }
}

function toggleRecording() {
  if (recording) stopRecording();
  else startRecording();
}

/* ---------- Hochwertige Transkription (eigener OpenAI API-Key) ---------- */
function getOpenAIKey() { return getProviderKey("openai"); }

async function transcribeWithSelectedProvider(audio) {
  const provider = settings.transcriptionProvider || "openai";
  const key = getProviderKey(provider);
  if (!audio?.byteLength) throw new Error("Audio fehlt");
  if (provider !== "openai-compatible" && !key) throw new Error(`${providerLabel(provider)}-Key fehlt`);
  return sharedCore.transcribeWithCloudProvider(new Blob([audio], { type: "audio/wav" }), {
    provider,
    apiKey: key || "",
    model: provider === "groq" ? settings.groqModel
      : provider === "openai-compatible" ? settings.compatibleTranscriptionModel : "gpt-transcribe",
    baseUrl: provider === "openai-compatible" ? settings.compatibleTranscriptionBaseUrl : undefined,
    language: settings.lang,
    dictionary: settings.dictionary || [],
    context: settings.context,
    fileName: "dictation.wav",
    interfaceLanguage: settings.interfaceLanguage,
  });
}

async function refineWithOpenAI(text, model = "gpt-5.4-mini") {
  const key = getOpenAIKey();
  return sharedCore.refineWithOpenAIProvider(text, {
    apiKey: key || "",
    model,
    language: settings.lang,
    context: settings.context,
    dictionary: settings.dictionary || [],
    interfaceLanguage: settings.interfaceLanguage,
  });
}

async function refineText(text, profile) {
  if (profile.provider === "ollama") {
    return sharedCore.refineWithOllamaProvider(text, {
      baseUrl: profile.baseUrl || settings.ollamaBaseUrl,
      model: profile.model || settings.ollamaModel,
      language: settings.lang,
      context: settings.context,
      dictionary: settings.dictionary || [],
      interfaceLanguage: settings.interfaceLanguage,
    });
  }
  if (profile.provider === "openai") return refineWithOpenAI(text, profile.model);
  if (profile.provider === "openai-compatible") {
    return sharedCore.refineWithCompatibleProvider(text, {
      baseUrl: profile.baseUrl || settings.compatibleRefinementBaseUrl,
      model: profile.model || settings.compatibleRefinementModel,
      apiKey: getProviderKey("openai-compatible-refinement") || "",
      language: settings.lang,
      context: settings.context,
      dictionary: settings.dictionary || [],
    });
  }
  return text;
}

function currentProcessingPlan() {
  const quality = settings.mode === "quality";
  const refinement = settings.cleanup === "aus" || settings.refinementProvider === "none"
    ? { id: "none", provider: "none" }
    : settings.refinementProvider === "ollama"
      ? { id: "ollama-default", provider: "ollama", model: settings.ollamaModel, baseUrl: settings.ollamaBaseUrl }
      : settings.refinementProvider === "openai"
        ? { id: "openai-default", provider: "openai", model: "gpt-5.4-mini", credentialRef: sharedCore.OPENAI_CREDENTIAL_REF }
        : settings.refinementProvider === "openai-compatible"
          ? { id: "compatible-default", provider: "openai-compatible", model: settings.compatibleRefinementModel, baseUrl: settings.compatibleRefinementBaseUrl, credentialRef: settings.compatibleRefinementCredentialRef || undefined }
          : { id: "deterministic", provider: "deterministic" };
  return {
    transcription: quality
      ? settings.transcriptionProvider === "groq"
        ? { id: "groq-default", provider: "groq", model: settings.groqModel, credentialRef: sharedCore.GROQ_CREDENTIAL_REF }
        : settings.transcriptionProvider === "openai-compatible"
          ? { id: "compatible-default", provider: "openai-compatible", model: settings.compatibleTranscriptionModel, baseUrl: settings.compatibleTranscriptionBaseUrl, credentialRef: settings.compatibleTranscriptionCredentialRef || undefined }
          : { id: "openai-default", provider: "openai", model: "gpt-transcribe", credentialRef: sharedCore.OPENAI_CREDENTIAL_REF }
      : { id: "local-default", provider: "local", model: settings.model === "schnell" ? "onnx-community/whisper-base" : "onnx-community/whisper-small" },
    refinement,
    language: settings.lang,
    context: settings.context,
    dictionary: structuredClone(settings.dictionary || []),
    cleanupLevel: settings.cleanup || "sanft",
  };
}

function captureProcessingContext() {
  const plan = structuredClone(currentProcessingPlan());
  return {
    plan,
    interfaceLanguage: settings.interfaceLanguage,
    transcriptionKey: getProviderKey(plan.transcription.provider) || "",
    refinementKey: plan.refinement.provider === "openai-compatible"
      ? getProviderKey("openai-compatible-refinement") || ""
      : plan.refinement.provider === "openai" ? getOpenAIKey() || "" : "",
  };
}

function assertWorkspaceProcessingReady(context) {
  const profile = context.plan.transcription;
  if (profile.provider !== "local" && profile.provider !== "openai-compatible" && !context.transcriptionKey) {
    throw new Error(`${providerLabel(profile.provider)}-Key fehlt.`);
  }
  if (!profile.model?.trim()) throw new Error("Bitte zuerst ein Transkriptionsmodell wählen.");
  if (profile.provider === "openai-compatible" && !sharedCore.normalizeCompatibleBaseUrl(profile.baseUrl || "")) {
    throw new Error("Bitte zuerst eine sichere Server-Adresse einrichten.");
  }
  if (profile.provider === "local" && (localModelStatus.choice !== settings.model || localModelStatus.state !== "ready")) {
    throw new Error("Bitte zuerst das lokale Modell in den Einstellungen herunterladen.");
  }
  const refinement = context.plan.refinement;
  if (refinement.provider === "openai" && !context.refinementKey) throw new Error("OpenAI-Key für den Feinschliff fehlt.");
  if (refinement.provider === "openai-compatible" && (!refinement.model?.trim() || !sharedCore.normalizeCompatibleBaseUrl(refinement.baseUrl || ""))) {
    throw new Error("Bitte zuerst den kompatiblen Textserver vollständig einrichten.");
  }
  if (refinement.provider === "ollama" && !refinement.model?.trim()) throw new Error("Bitte zuerst ein Ollama-Modell wählen.");
}

async function transcribeWorkspaceCloud(audio, job, signal) {
  const { plan, transcriptionKey, interfaceLanguage } = job.context;
  const profile = plan.transcription;
  return sharedCore.transcribeWithCloudProvider(audio, {
    provider: profile.provider,
    apiKey: transcriptionKey,
    model: profile.model,
    baseUrl: profile.baseUrl,
    language: plan.language,
    dictionary: plan.dictionary,
    context: plan.context,
    fileName: job.name,
    signal,
    interfaceLanguage,
  });
}

async function refineWorkspaceText(text, profile, plan, context, signal) {
  if (profile.provider === "ollama") {
    return sharedCore.refineWithOllamaProvider(text, {
      baseUrl: profile.baseUrl,
      model: profile.model,
      language: plan.language,
      context: plan.context,
      dictionary: plan.dictionary,
      signal,
      interfaceLanguage: context.interfaceLanguage,
    });
  }
  if (profile.provider === "openai") {
    return sharedCore.refineWithOpenAIProvider(text, {
      apiKey: context.refinementKey,
      model: profile.model,
      language: plan.language,
      context: plan.context,
      dictionary: plan.dictionary,
      signal,
      interfaceLanguage: context.interfaceLanguage,
    });
  }
  if (profile.provider === "openai-compatible") {
    return sharedCore.refineWithCompatibleProvider(text, {
      baseUrl: profile.baseUrl,
      model: profile.model,
      apiKey: context.refinementKey,
      language: plan.language,
      context: plan.context,
      dictionary: plan.dictionary,
      signal,
    });
  }
  return text;
}

/* ---------- Ergebnis: kopieren + an Cursor-Position einfügen ---------- */
ipcMain.on("result", async (_e, value) => {
  const recordingContents = currentRecordingContents();
  if (_e.sender !== recordingContents || !processing) return;
  const trigger = recordingTrigger;
  recordingTrigger = null;
  const quality = settings.mode === "quality";
  const plan = currentProcessingPlan();
  let finalText = "";
  let processingError = null;
  try {
    const payload = validateSystemResultPayload(value, quality);
    const result = await sharedCore.runProcessingJob({
      audio: quality ? payload.audio : undefined,
      rawText: quality ? undefined : String(payload.text || ""),
      plan,
    }, {
      transcribe: (audio) => transcribeWithSelectedProvider(audio),
      refine: (raw, profile) => refineText(raw, profile),
    }, (stage) => {
      if (stage === "transcribing") recordingContents.send("processing-start");
      if (stage === "refining") recordingContents.send("refining-start");
    });
    finalText = result.text;
    if (result.warning) logError("Text-Feinschliff fehlgeschlagen, Transkription wird beibehalten");
  } catch (err) {
    processingError = err;
    logError(quality ? "Cloud-Transkription fehlgeschlagen" : "Lokale Transkription fehlgeschlagen", err);
    if (Notification.isSupported()) {
      new Notification({
        title: uiText("Nivune konnte nicht transkribieren", "Nivune could not transcribe"),
        body: err?.code === "SYSTEM_AUDIO_TOO_LARGE"
          ? uiText("Die Aufnahme war zu lang. Für lange Aufnahmen nutze bitte den Datei-Upload.", "The recording was too long. Please use file upload for long recordings.")
          : quality ? uiText(`Bitte prüfe ${providerLabel()} und deine Internetverbindung.`, `Please check ${providerLabel()} and your internet connection.`) : uiText("Bitte prüfe das lokale Modell und versuche es erneut.", "Please check the local model and try again."),
      }).show();
    }
  }

  // Der reservierte Endbefehl gehört nie in das Ergebnis. Die Bereinigung ist
  // absichtlich nur am Textende aktiv, damit Erwähnungen mitten im Diktat
  // erhalten bleiben. Sie greift auch, falls Stille und Wake-Word fast
  // gleichzeitig eintreffen und der Stille-Grund zuerst übermittelt wird.
  finalText = stripTrailingStopCommand(finalText);

  if (!finalText) {
    processing = false;
    activeRecordingContents = null;
    updateTray();
    if (trigger !== "onboarding") pill?.hide();
    if (trigger === "onboarding") {
      onboardingSample = {
        state: "error",
        text: "",
        error: String(processingError?.message || uiText("Die Probeaufnahme enthielt keinen nutzbaren Text.", "The test recording did not contain usable text.")).slice(0, 240),
      };
      openOnboardingWindow();
      syncOnboardingWindow();
    }
    return;
  }
  activeRecordingContents = null;
  if (trigger !== "onboarding") pill?.hide();
  clipboard.writeText(finalText);

  if (trigger === "onboarding") {
    processing = false;
    onboardingSample = { state: "completed", text: finalText, error: null };
    // Der erfolgreiche Text bleibt sichtbar, bis die Person bewusst weitergeht.
    onboardingState = onboardingStore.update({ step: 3, sampleCompleted: true });
    updateTray();
    openOnboardingWindow();
    syncOnboardingWindow();
    return;
  }

  const pasteAccess = getCurrentPasteAccess();
  if (!pasteAccess.canPaste) {
    processing = false;
    updateTray();
    logError("Automatisches Einfügen ist nicht freigegeben; Text wurde kopiert");
    if (Notification.isSupported()) {
      new Notification({
        title: uiText("Text wurde kopiert", "Text copied"),
        body: uiText("Für automatisches Einfügen Nivune einmal neu unter Bedienungshilfen freigeben.", "To paste automatically, allow Nivune again under Accessibility."),
      }).show();
    }
    return;
  }

  const onErr = (err) => {
    processing = false;
    updateTray();
    if (err) {
      logError("Einfügen fehlgeschlagen, der Text liegt in der Zwischenablage", err);
    }
  };
  if (IS_MAC) {
    // Braucht Bedienungshilfen-Berechtigung (Systemeinstellungen → Datenschutz)
    // Der kurze Abstand gibt macOS Zeit, nach einem Start aus dem Arbeitsbereich
    // die zuvor aktive Ziel-App wieder vollständig in den Vordergrund zu holen.
    execFile(
      "osascript",
      ["-e", 'delay 0.12', "-e", 'tell application "System Events" to keystroke "v" using command down'],
      onErr
    );
  } else if (IS_WIN) {
    // Kurz warten, bis die vorher aktive App wieder im Vordergrund ist, dann Strg+V senden
    execFile(
      "powershell",
      [
        "-NoProfile",
        "-WindowStyle",
        "Hidden",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 120; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ],
      onErr
    );
  } else {
    processing = false;
    updateTray();
  }
});

/* ---------- API-Key-Fenster ---------- */
let keyWin = null;
let keyWinProvider = "openai";

function openKeyWindow(provider = "openai") {
  keyWinProvider = ["openai", "groq", "openai-compatible", "openai-compatible-refinement"].includes(provider) ? provider : "openai";
  const keyConfig = () => ({
    provider: keyWinProvider,
    label: providerLabel(keyWinProvider),
    optional: keyWinProvider.startsWith("openai-compatible"),
    interfaceLanguage: settings.interfaceLanguage,
  });
  // Das Key-Fenster gehört zum aufrufenden Fenster (Einrichtung, Einstellungen,
  // Arbeitsbereich) und erscheint davor, statt unbemerkt dahinter zu öffnen.
  const owner = [onboardingWin, settingsWin, workspaceWin]
    .filter((window) => window && !window.isDestroyed() && window.isVisible())
    .sort((a, b) => Number(b.isFocused()) - Number(a.isFocused()))[0] || null;
  if (keyWin) {
    keyWin.webContents.send("api-key-config", keyConfig());
    showUserWindow(keyWin);
    keyWin.moveTop();
    return;
  }
  keyWin = new BrowserWindow({
    width: 540,
    height: 390,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    ...(owner ? { parent: owner, modal: true } : {}),
    title: uiText("Nivune – Beste Qualität", "Nivune – Best quality"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  keyWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  keyWin.webContents.on("will-navigate", (event) => event.preventDefault());
  keyWin.once("ready-to-show", () => {
    showUserWindow(keyWin);
    keyWin?.moveTop();
  });
  keyWin.webContents.once("did-finish-load", () => {
    keyWin?.webContents.send("api-key-config", keyConfig());
  });
  keyWin.loadFile("keywin.html");
  keyWin.on("closed", () => {
    keyWin = null;
    syncDockVisibility();
  });
}

ipcMain.on("save-api-key", (_e, input) => {
  if (_e.sender !== keyWin?.webContents || !input || typeof input !== "object") return;
  const { provider, key } = input;
  if (provider !== keyWinProvider || typeof key !== "string" || key.length > 4096) return;
  const trimmed = key.trim();
  const field = provider === "groq" ? "groqKeyEnc"
    : provider === "openai-compatible" ? "compatibleTranscriptionKeyEnc"
      : provider === "openai-compatible-refinement" ? "compatibleRefinementKeyEnc" : "openaiKeyEnc";
  if (trimmed && electron.safeStorage.isEncryptionAvailable()) {
    settings[field] = electron.safeStorage.encryptString(trimmed).toString("base64");
    credentialCache.set(provider, { encrypted: settings[field], value: trimmed });
    unreadableCredentials.delete(provider);
  } else {
    settings[field] = null;
    credentialCache.delete(provider);
  }
  saveSettings(settings);
  keyWin?.close();
  updateTray();
});

ipcMain.on("close-key-window", (event) => { if (event.sender === keyWin?.webContents) keyWin.close(); });

/* ---------- Eigenes Einstellungsfenster ---------- */
let settingsWin = null;
function settingsSnapshot() {
  const paste = getCurrentPasteAccess();
  let microphone = "Wird beim ersten Diktat vom Betriebssystem angefragt.";
  if (IS_MAC || IS_WIN) {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    microphone = ({ granted: "Mikrofon ist freigegeben.", denied: "Mikrofonzugriff ist nicht erlaubt.", restricted: "Mikrofonzugriff ist eingeschränkt.", "not-determined": "Freigabe wird beim ersten Diktat angefragt." })[status] || microphone;
  }
  // No API key, encrypted key, filesystem path or enrollment data leaves main.
  return {
    interfaceLanguage: settings.interfaceLanguage,
    lang: settings.lang, mode: settings.mode, model: settings.model,
    transcriptionProvider: settings.transcriptionProvider || "openai",
    groqModel: settings.groqModel,
    compatibleTranscriptionBaseUrl: settings.compatibleTranscriptionBaseUrl,
    compatibleTranscriptionModel: settings.compatibleTranscriptionModel,
    cleanup: settings.cleanup,
    refinementProvider: settings.refinementProvider,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    ollamaModel: settings.ollamaModel,
    compatibleRefinementBaseUrl: settings.compatibleRefinementBaseUrl,
    compatibleRefinementModel: settings.compatibleRefinementModel,
    context: settings.context, theme: settings.theme || "system",
    voiceActivation: settings.voiceActivation,
    hasKey: hasStoredKey("openai"),
    hasOpenAIKey: hasStoredKey("openai"),
    hasGroqKey: hasStoredKey("groq"),
    hasCompatibleTranscriptionKey: hasStoredKey("openai-compatible"),
    hasCompatibleRefinementKey: hasStoredKey("openai-compatible-refinement"),
    login: SMOKE_TEST ? { supported: false, enabled: false, detail: localizedRuntimeText("In der isolierten Vorschau deaktiviert.") } : { ...loginState, detail: localizedRuntimeText(loginState.detail) },
    wakeModelsAvailable,
    wakePhrase,
    wakeStatus: { ...wakeStatus, detail: localizedRuntimeText(wakeStatus.detail) },
    microphone: localizedRuntimeText(microphone),
    pasteDetail: localizedRuntimeText(IS_MAC ? (paste.canPaste ? "Bedienungshilfen sind freigegeben." : "Bedienungshilfen bitte in macOS freigeben.") : "Einfügen per Tastatursimulation. Einzelne Apps können es einschränken."),
    localModelStatus,
    localRuntimeStatus,
    ollamaStatus,
    transcriptionProviderStatus,
    refinementProviderStatus,
    platform: process.platform,
    shortcut: localizedShortcutLabel(),
    version: app.getVersion(),
    updateStatus,
    busy: anyAudioWorkBusy(), preview: SMOKE_TEST,
  };
}
function syncSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("settings-changed", settingsSnapshot());
}
function openSettingsWindow() {
  if (!settings) return;
  if (settingsWin && !settingsWin.isDestroyed()) {
    showUserWindow(settingsWin);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 850, height: 700, minWidth: 690, minHeight: 590,
    title: uiText("Nivune · Einstellungen", "Nivune · Settings"), backgroundColor: nativeTheme.shouldUseDarkColors ? "#151b27" : "#fbfcfe",
    show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "settings-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWin.webContents.on("will-navigate", event => event.preventDefault());
  settingsWin.once("ready-to-show", () => showUserWindow(settingsWin));
  settingsWin.on("focus", syncSettingsWindow);
  settingsWin.on("closed", () => {
    settingsWin = null;
    syncDockVisibility();
    if (SETTINGS_PREVIEW && !isQuitting) quitApp();
  });
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
}
function requireSettingsSender(event) {
  if (!settingsWin || event.sender !== settingsWin.webContents || event.senderFrame !== settingsWin.webContents.mainFrame) throw new Error("Ungültiges Einstellungsfenster.");
}
ipcMain.handle("settings-read", event => {
  requireSettingsSender(event);
  return settingsSnapshot();
});
ipcMain.on("settings-rendered", (event, state) => {
  requireSettingsSender(event);
  if (!SETTINGS_SMOKE) return;
  const expectedHidden = settings.cleanup === "aus" || settings.refinementProvider !== "ollama";
  const expectedCompatibleRefinementHidden = settings.cleanup === "aus" || settings.refinementProvider !== "openai-compatible";
  const valid = state && typeof state === "object"
    && state.cleanup === settings.cleanup
    && state.refinementProvider === settings.refinementProvider
    && state.ollamaBaseUrl === settings.ollamaBaseUrl
    && state.ollamaModel === settings.ollamaModel
    && state.ollamaBoxHidden === expectedHidden
    && state.compatibleRefinementBaseUrl === settings.compatibleRefinementBaseUrl
    && state.compatibleRefinementModel === settings.compatibleRefinementModel
    && state.compatibleRefinementBoxHidden === expectedCompatibleRefinementHidden
    && state.transcriptionProvider === settings.transcriptionProvider
    && state.providerBoxHidden === (settings.mode !== "quality" || settings.transcriptionProvider === "openai");
  if (!valid) {
    console.error("SETTINGS_SMOKE_FAILED: renderer values differ from isolated settings snapshot");
    process.exitCode = 1;
    quitApp();
    return;
  }
  console.log("SETTINGS_SMOKE_OK: settings renderer values connected, isolated profile, no microphone or login registration");
  quitApp();
});
ipcMain.handle("settings-update", async (event, input) => {
  requireSettingsSender(event);
  const patch = validateSettingsPatch(input);
  if (anyAudioWorkBusy() && Object.keys(patch).some(key => key !== "theme")) throw new Error("Bitte warte, bis die aktuelle Audioarbeit abgeschlossen ist.");
  if (SMOKE_TEST && (Object.hasOwn(patch, "launchAtLogin") || Object.hasOwn(patch, "voiceActivation"))) throw new Error("In der isolierten Vorschau nicht verfügbar.");
  if (patch.voiceActivation && !wakeModelsAvailable) throw new Error("Bitte zuerst den persönlichen Startbefehl einrichten.");
  const next = { ...settings, ...patch };
  const previous = settings;
  saveSettings(next);
  if (["ollamaBaseUrl", "ollamaModel"].some(key => Object.hasOwn(patch, key))) {
    ollamaStatus = { state: "idle", models: [], error: null };
  }
  if (["transcriptionProvider", "groqModel", "compatibleTranscriptionBaseUrl", "compatibleTranscriptionModel"].some(key => Object.hasOwn(patch, key))) {
    transcriptionProviderStatus = { state: "idle", models: [], supported: true, error: null };
  }
  if (["refinementProvider", "compatibleRefinementBaseUrl", "compatibleRefinementModel"].some(key => Object.hasOwn(patch, key))) {
    refinementProviderStatus = { state: "idle", models: [], supported: true, error: null };
  }
  if (Object.hasOwn(patch, "theme")) nativeTheme.themeSource = settings.theme;
  if (Object.hasOwn(patch, "launchAtLogin")) loginState = configureCurrentLogin(true);
  if (previous.mode !== settings.mode || previous.model !== settings.model || previous.transcriptionProvider !== settings.transcriptionProvider) prepareSelectedMode();
  if (previous.voiceActivation !== settings.voiceActivation) await refreshWakeActivation();
  updateTray();
  return settingsSnapshot();
});
ipcMain.handle("settings-action", async (event, action) => {
  requireSettingsSender(event);
  if (["key", "provider-key", "provider-test", "refinement-key", "refinement-test", "voice-setup", "model-download", "model-cancel", "model-remove", "ollama-test"].includes(action) && anyAudioWorkBusy()) throw new Error("Bitte warte, bis die aktuelle Audioarbeit abgeschlossen ist.");
  if (SMOKE_TEST && !["refresh", "key", "provider-key", "refinement-key"].includes(action)) throw new Error("Systemaktionen sind in der isolierten Vorschau deaktiviert.");
  switch (action) {
    case "key": openKeyWindow(); break;
    case "provider-key":
      if (settings.transcriptionProvider === "openai-compatible"
        && !sharedCore.normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl || "")) {
        throw new Error("Bitte zuerst eine sichere Server-Adresse speichern.");
      }
      openKeyWindow(settings.transcriptionProvider);
      break;
    case "provider-test":
      if (settings.transcriptionProvider === "openai") throw new Error("OpenAI wird beim Diktat geprüft.");
      transcriptionProviderStatus = { state: "checking", models: [], supported: true, error: null };
      syncSettingsWindow();
      try {
        const result = settings.transcriptionProvider === "groq"
          ? await sharedCore.listGroqTranscriptionModels({ apiKey: getProviderKey("groq") || "" })
          : await sharedCore.listCompatibleModels(settings.compatibleTranscriptionBaseUrl, { apiKey: getProviderKey("openai-compatible") || "" });
        transcriptionProviderStatus = { state: "ready", models: result.models, supported: result.supported, error: null };
        if (settings.transcriptionProvider === "groq" && result.models.length && !result.models.includes(settings.groqModel)) {
          saveSettings({ ...settings, groqModel: result.models[0] });
        }
      } catch (error) {
        transcriptionProviderStatus = { state: "error", models: [], supported: true, error: String(error?.message || error).slice(0, 240) };
      }
      break;
    case "refinement-key":
      if (!sharedCore.normalizeCompatibleBaseUrl(settings.compatibleRefinementBaseUrl || "")) {
        throw new Error("Bitte zuerst eine sichere Textserver-Adresse speichern.");
      }
      openKeyWindow("openai-compatible-refinement");
      break;
    case "refinement-test":
      refinementProviderStatus = { state: "checking", models: [], supported: true, error: null };
      syncSettingsWindow();
      try {
        const result = await sharedCore.listCompatibleModels(settings.compatibleRefinementBaseUrl, {
          apiKey: getProviderKey("openai-compatible-refinement") || "",
        });
        refinementProviderStatus = { state: "ready", models: result.models, supported: result.supported, error: null };
      } catch (error) {
        refinementProviderStatus = { state: "error", models: [], supported: true, error: String(error?.message || error).slice(0, 240) };
      }
      break;
    case "voice-setup": openWakeSetupWindow(); break;
    case "microphone":
      await shell.openExternal(IS_MAC ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone" : IS_WIN ? "ms-settings:privacy-microphone" : "https://klartext-ai.vercel.app"); break;
    case "accessibility": if (IS_MAC) await shell.openExternal(ACCESSIBILITY_SETTINGS_URL); break;
    case "logs": shell.showItemInFolder(logPath); break;
    case "model-download": sendLocalModelCommand("download"); break;
    case "model-cancel": sendLocalModelCommand("cancel"); break;
    case "model-remove": sendLocalModelCommand("remove"); break;
    case "ollama-test":
      ollamaStatus = { state: "checking", models: [], error: null };
      syncSettingsWindow();
      try {
        const models = await sharedCore.listOllamaModels({ baseUrl: settings.ollamaBaseUrl });
        ollamaStatus = { state: "ready", models, error: null };
        if (!settings.ollamaModel && models[0]) saveSettings({ ...settings, ollamaModel: models[0] });
      } catch (error) {
        ollamaStatus = { state: "error", models: [], error: String(error?.message || error).slice(0, 240) };
      }
      break;
    case "update-check": await runUpdateCheck(); break;
    case "update-open": openOfficialReleasePage(); break;
    case "refresh": break;
    default: throw new Error("Unbekannte Aktion.");
  }
  return settingsSnapshot();
});

/* ---------- Manuelle Updateprüfung ---------- */
async function runUpdateCheck() {
  if (SMOKE_TEST) throw new Error(uiText("Systemaktionen sind in der isolierten Vorschau deaktiviert.", "System actions are disabled in the isolated preview."));
  if (updateStatus.state === "checking") return updateStatus;
  updateStatus = { state: "checking", latest: null, error: null };
  syncSettingsWindow();
  const result = await sharedCore.checkForUpdate({ currentVersion: app.getVersion() });
  updateStatus = result.state === "error"
    ? { state: "error", latest: null, error: result.error }
    : { state: result.state, latest: result.latest, error: null };
  if (result.state === "error") logError("Updateprüfung fehlgeschlagen", result.error);
  updateTray();
  syncSettingsWindow();
  return updateStatus;
}
function openOfficialReleasePage() {
  const target = updateStatus.latest?.url && sharedCore.isOfficialReleaseUrl(updateStatus.latest.url)
    ? updateStatus.latest.url
    : sharedCore.RELEASES_PAGE_URL;
  void shell.openExternal(target);
}

/* ---------- Geführte Ersteinrichtung ---------- */
let onboardingWin = null;

function onboardingSetupIssue() {
  try {
    const context = captureProcessingContext();
    assertWorkspaceProcessingReady(context);
    if (settings.mode === "local" && (localModelStatus.choice !== settings.model || localModelStatus.state !== "ready")) {
      return "Lade zuerst das gewählte lokale Sprachmodell vollständig herunter.";
    }
    return null;
  } catch (error) {
    return String(error?.message || error).slice(0, 240);
  }
}

function onboardingSnapshot() {
  const paste = getCurrentPasteAccess();
  const previewState = ONBOARDING_PREVIEW ? {
    ...onboardingState,
    step: ONBOARDING_PREVIEW_STEP,
    sampleCompleted: true,
  } : onboardingState;
  const previewSample = ONBOARDING_PREVIEW
    ? { state: "completed", text: "Das ist meine erste Nivune-Probeaufnahme.", error: null }
    : onboardingSample;
  const provider = settings.mode === "local" ? "local" : settings.transcriptionProvider || "openai";
  const issue = ONBOARDING_PREVIEW ? null : onboardingSetupIssue();
  return {
    step: previewState.step,
    completed: previewState.completed,
    sampleCompleted: previewState.sampleCompleted,
    interfaceLanguage: settings.interfaceLanguage,
    language: settings.lang,
    provider,
    localModel: settings.model,
    localModelStatus,
    localRuntimeReady: localRuntimeStatus.ready,
    setupReady: !issue,
    setupIssue: issue ? localizedRuntimeText(issue) : null,
    hasProviderKey: ONBOARDING_PREVIEW ? provider !== "local" : provider === "openai" ? hasStoredKey("openai")
      : provider === "groq" ? hasStoredKey("groq")
        : provider === "openai-compatible" ? hasStoredKey("openai-compatible") : false,
    compatibleBaseUrl: settings.compatibleTranscriptionBaseUrl || "",
    compatibleModel: settings.compatibleTranscriptionModel || "",
    sample: previewSample,
    pasteReady: paste.canPaste,
    pasteDetail: IS_MAC
      ? paste.canPaste
        ? uiText("Automatisches Einfügen ist freigegeben.", "Automatic paste is allowed.")
        : uiText("Der Text wird immer kopiert. Für automatisches Einfügen kannst du Nivune zusätzlich unter Bedienungshilfen freigeben.", "Text is always copied. For automatic paste, you can also allow Nivune under Accessibility.")
      : uiText("Der Text wird immer kopiert; Nivune versucht zusätzlich, ihn an der Cursorposition einzufügen.", "Text is always copied; Nivune also tries to paste it at the cursor position."),
    platform: process.platform,
    shortcut: localizedShortcutLabel(),
    wakeModelsAvailable,
    login: { ...loginState, detail: localizedRuntimeText(loginState.detail) },
    busy: anyAudioWorkBusy(),
    preview: SMOKE_TEST,
    version: app.getVersion(),
  };
}

function syncOnboardingWindow() {
  if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.webContents.send("onboarding-changed", onboardingSnapshot());
}

function openOnboardingWindow() {
  if (!settings || onboardingState.completed) return;
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    showUserWindow(onboardingWin);
    return;
  }
  onboardingWin = new BrowserWindow({
    width: 840,
    height: 720,
    minWidth: 680,
    minHeight: 600,
    title: uiText("Nivune · Erste Einrichtung", "Nivune · First setup"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#151b27" : "#fbfcfe",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "onboarding-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  onboardingWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  onboardingWin.webContents.on("will-navigate", (event) => event.preventDefault());
  createOnboardingAudioView();
  onboardingWin.once("ready-to-show", () => showUserWindow(onboardingWin));
  onboardingWin.on("close", (event) => {
    if (recordingTrigger === "onboarding" && (recording || processing)) {
      event.preventDefault();
      showUserWindow(onboardingWin);
    }
  });
  onboardingWin.on("closed", () => {
    destroyOnboardingAudioView();
    onboardingWin = null;
    syncDockVisibility();
    if (ONBOARDING_PREVIEW && !isQuitting) quitApp();
  });
  onboardingWin.loadFile(path.join(__dirname, "onboarding.html"));
}

function requireOnboardingSender(event) {
  if (!onboardingWin || event.sender !== onboardingWin.webContents || event.senderFrame !== onboardingWin.webContents.mainFrame) {
    throw new Error("Ungültige Ersteinrichtung.");
  }
}

ipcMain.handle("onboarding-read", (event) => {
  requireOnboardingSender(event);
  return onboardingSnapshot();
});

ipcMain.on("onboarding-rendered", (event, state) => {
  requireOnboardingSender(event);
  if (!ONBOARDING_SMOKE) return;
  const valid = state && typeof state === "object"
    && state.steps === "language,provider,sample,finish"
    && state.provider === onboardingSnapshot().provider
    && state.clipboardExplained === true;
  if (!valid) {
    console.error("ONBOARDING_SMOKE_FAILED: renderer differs from isolated onboarding snapshot");
    process.exitCode = 1;
    quitApp();
    return;
  }
  console.log("ONBOARDING_SMOKE_OK: guided setup rendered through restricted IPC without microphone, download or login registration");
  quitApp();
});

ipcMain.handle("onboarding-action", async (event, action, payload) => {
  requireOnboardingSender(event);
  if (SMOKE_TEST) throw new Error("Systemaktionen sind in der isolierten Vorschau deaktiviert.");
  if (action === "set-interface-language") {
    const patch = validateSettingsPatch({ interfaceLanguage: payload?.language });
    saveSettings({ ...settings, ...patch });
    updateTray();
    return onboardingSnapshot();
  }
  if (action === "set-language") {
    const patch = validateSettingsPatch({ lang: payload?.language });
    saveSettings({ ...settings, ...patch });
    onboardingSample = { state: "idle", text: "", error: null };
    onboardingState = onboardingStore.update({ step: 2, sampleCompleted: false });
    updateTray();
    return onboardingSnapshot();
  }
  if (action === "select-provider") {
    const provider = payload?.provider;
    if (!["local", "openai", "groq", "openai-compatible"].includes(provider)) throw new Error("Unbekannter Transkriptionsweg.");
    const patch = provider === "local"
      ? { mode: "local", refinementProvider: "deterministic" }
      : { mode: "quality", transcriptionProvider: provider, refinementProvider: "deterministic" };
    saveSettings({ ...settings, ...validateSettingsPatch(patch) });
    onboardingSample = { state: "idle", text: "", error: null };
    onboardingState = onboardingStore.update({ step: 2, sampleCompleted: false });
    prepareSelectedMode();
    updateTray();
    return onboardingSnapshot();
  }
  if (action === "set-local-model") {
    saveSettings({ ...settings, ...validateSettingsPatch({ model: payload?.model }) });
    onboardingSample = { state: "idle", text: "", error: null };
    onboardingState = onboardingStore.update({ step: 2, sampleCompleted: false });
    prepareSelectedMode();
    updateTray();
    return onboardingSnapshot();
  }
  if (action === "save-compatible") {
    const patch = validateSettingsPatch({
      compatibleTranscriptionBaseUrl: payload?.baseUrl,
      compatibleTranscriptionModel: payload?.model,
    });
    saveSettings({ ...settings, ...patch });
    transcriptionProviderStatus = { state: "idle", models: [], supported: true, error: null };
    onboardingSample = { state: "idle", text: "", error: null };
    onboardingState = onboardingStore.update({ step: 2, sampleCompleted: false });
    updateTray();
    return onboardingSnapshot();
  }
  if (action === "manage-key") {
    if (settings.transcriptionProvider === "openai-compatible"
      && !sharedCore.normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl || "")) {
      throw new Error("Speichere zuerst eine sichere Server-Adresse.");
    }
    openKeyWindow(settings.transcriptionProvider);
    return onboardingSnapshot();
  }
  if (action === "model-download" || action === "model-cancel") {
    sendLocalModelCommand(action === "model-download" ? "download" : "cancel");
    return onboardingSnapshot();
  }
  if (action === "start-sample") {
    if (anyAudioWorkBusy()) throw new Error("Bitte warte, bis die aktuelle Audioarbeit abgeschlossen ist.");
    const issue = onboardingSetupIssue();
    if (issue) throw new Error(issue);
    onboardingSample = { state: "recording", text: "", error: null };
    onboardingState = onboardingStore.update({ step: 3, sampleCompleted: false });
    syncOnboardingWindow();
    const started = await startRecording("onboarding");
    if (!started) {
      onboardingSample = { state: "error", text: "", error: "Die Probeaufnahme konnte nicht gestartet werden." };
      syncOnboardingWindow();
    }
    return onboardingSnapshot();
  }
  if (action === "copy-sample") {
    if (!onboardingSample.text) throw new Error("Noch kein Probentext vorhanden.");
    clipboard.writeText(onboardingSample.text);
    return { ...onboardingSnapshot(), notice: "Probentext wurde kopiert." };
  }
  if (action === "continue-after-sample") {
    if (!onboardingState.sampleCompleted || onboardingSample.state !== "completed") {
      throw new Error("Schließe zuerst eine Probeaufnahme erfolgreich ab.");
    }
    onboardingState = onboardingStore.update({ step: 4, sampleCompleted: true });
    return onboardingSnapshot();
  }
  if (action === "accessibility") {
    if (IS_MAC) await shell.openExternal(ACCESSIBILITY_SETTINGS_URL);
    return onboardingSnapshot();
  }
  if (action === "voice-setup") {
    openWakeSetupWindow();
    return onboardingSnapshot();
  }
  if (action === "finish") {
    if (!onboardingState.sampleCompleted || onboardingSample.state !== "completed") {
      throw new Error("Schließe zuerst eine Probeaufnahme erfolgreich ab.");
    }
    if (typeof payload?.launchAtLogin !== "boolean" || typeof payload?.voiceActivation !== "boolean") {
      throw new Error("Ungültige Abschlussauswahl.");
    }
    if (payload.launchAtLogin && !loginState.supported) throw new Error("Autostart ist in dieser App-Ausführung nicht verfügbar.");
    if (payload.voiceActivation && !wakeModelsAvailable) throw new Error("Richte zuerst deinen persönlichen Startbefehl ein.");
    saveSettings({ ...settings, ...validateSettingsPatch({
      launchAtLogin: payload.launchAtLogin,
      voiceActivation: payload.voiceActivation,
    }) });
    loginState = configureCurrentLogin(true);
    await refreshWakeActivation();
    onboardingState = onboardingStore.complete();
    onboardingWin?.close();
    if (ONBOARDING_TEST) setTimeout(quitApp, 750).unref();
    else openWorkspaceWindow();
    updateTray();
    return { ...onboardingSnapshot(), notice: "Nivune ist eingerichtet." };
  }
  throw new Error("Unbekannte Einrichtungsaktion.");
});

/* ---------- Desktop-Arbeitsbereich ---------- */
let workspaceWin = null;

function nextWorkspaceJobId(prefix) {
  workspaceJobSequence += 1;
  return `${prefix}-${Date.now()}-${workspaceJobSequence}`;
}

function workspaceHistoryMetadata(context, durationMs = 0) {
  const plan = context.plan;
  return {
    transcriptionProvider: plan.transcription.provider,
    transcriptionModel: plan.transcription.model || "",
    refinementProvider: plan.refinement.provider,
    refinementModel: plan.refinement.model || "",
    language: plan.language,
    durationMs,
  };
}

function workspaceContextFromRecovery(manifest) {
  const plan = structuredClone(manifest.plan);
  let transcriptionKey = "";
  if (plan.transcription.provider === "openai" || plan.transcription.provider === "groq") {
    transcriptionKey = getProviderKey(plan.transcription.provider) || "";
  } else if (plan.transcription.provider === "openai-compatible"
    && sharedCore.normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl || "") === plan.transcription.baseUrl
    && settings.compatibleTranscriptionCredentialRef === plan.transcription.credentialRef) {
    transcriptionKey = getProviderKey("openai-compatible") || "";
  }
  let refinementKey = "";
  if (plan.refinement.provider === "openai") refinementKey = getOpenAIKey() || "";
  if (plan.refinement.provider === "openai-compatible"
    && sharedCore.normalizeCompatibleBaseUrl(settings.compatibleRefinementBaseUrl || "") === plan.refinement.baseUrl
    && settings.compatibleRefinementCredentialRef === plan.refinement.credentialRef) {
    refinementKey = getProviderKey("openai-compatible-refinement") || "";
  }
  return {
    plan,
    interfaceLanguage: manifest.interfaceLanguage || settings.interfaceLanguage,
    transcriptionKey,
    refinementKey,
  };
}

function enqueueRecoveredRecording(id) {
  let manifest = workspaceRecordingStore.getRecovery(id);
  if (!manifest) throw new Error("Die Arbeitskopie wurde nicht gefunden.");
  if (!manifest.fragments.length) throw new Error("Diese Arbeitskopie enthält noch kein Audio.");
  if (manifest.state === "recording") {
    workspaceRecordingStore.finalize(id, manifest.durationMs);
    manifest = workspaceRecordingStore.getRecovery(id);
  }
  const context = workspaceContextFromRecovery(manifest);
  assertWorkspaceProcessingReady(context);
  try {
    validateCapturedAudio({ byteLength: manifest.totalBytes, mimeType: manifest.mimeType, plan: context.plan });
  } catch (error) {
    throw workspaceAudioError(error, context.plan);
  }
  workspaceQueue.removeTerminal(id);
  workspacePersistedJobIds.delete(id);
  workspaceRecordingStore.markQueued(id);
  try {
    workspaceQueue.enqueue({
      id,
      source: "recording",
      name: manifest.name,
      mimeType: manifest.mimeType,
      size: manifest.totalBytes,
      durationMs: manifest.durationMs,
      recordingId: id,
      rawText: manifest.rawText || "",
      context,
      historyMetadata: workspaceHistoryMetadata(context, manifest.durationMs),
    });
  } catch (error) {
    workspaceRecordingStore.markFailed(id, String(error?.message || error));
    throw workspaceAudioError(error, context.plan);
  }
}

function workspaceAudioError(error, plan) {
  const code = String(error?.message || error);
  if (code === "UNSUPPORTED_AUDIO_TYPE") return new Error("Bitte WAV, MP3, M4A, MP4, WebM, OGG oder FLAC auswählen.");
  if (code === "AUDIO_FILE_SIGNATURE_INVALID") return new Error("Dateiendung und Audioinhalt passen nicht zusammen.");
  if (code === "AUDIO_FILE_EMPTY" || code === "AUDIO_RECORDING_EMPTY") return new Error("Die Aufnahme oder Audiodatei ist leer.");
  if (code === "UNSUPPORTED_RECORDING_TYPE") return new Error("Dieses Aufnahmeformat wird nicht unterstützt.");
  if (code === "WORKSPACE_QUEUE_FULL") return new Error("Die Warteschlange ist voll. Bitte warte oder brich einen Auftrag ab.");
  if (code === "AUDIO_FILE_TOO_LARGE") {
    return new Error(plan?.transcription?.provider === "local"
      ? "Lokale Dateien dürfen in diesem Schritt höchstens 100 MB groß sein."
      : "Cloud-Aufträge dürfen in diesem Schritt höchstens 24 MB groß sein.");
  }
  return error instanceof Error ? error : new Error(code);
}

function requestWorkspaceLocalTranscription(job, signal, update) {
  if (!pill || !pillReady) return Promise.reject(new Error("Lokale Transkriptionslaufzeit ist noch nicht bereit."));
  const requestId = `local-${++workspaceLocalSequence}`;
  return new Promise((resolve, reject) => {
    const abort = () => {
      workspaceLocalRequests.delete(requestId);
      pill?.webContents.send("workspace-local-cancel", requestId);
      reject(new DOMException("Abgebrochen", "AbortError"));
    };
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    workspaceLocalRequests.set(requestId, {
      resolve: (text) => { signal.removeEventListener("abort", abort); resolve(text); },
      reject: (error) => { signal.removeEventListener("abort", abort); reject(error); },
    });
    update("transcribing");
    const bytes = Uint8Array.from(job.bytes);
    pill.webContents.send("workspace-local-transcribe", {
      requestId,
      bytes,
      mimeType: job.mimeType,
      language: job.context.plan.language,
      model: job.context.plan.transcription.model,
    });
  });
}

async function processWorkspaceJob(job, signal, update) {
  try {
    const { plan } = job.context;
    let rawText = String(job.rawText || "");
    if (!rawText) {
      if (job.recordingId) {
        const recovered = workspaceRecordingStore.readAudio(job.recordingId);
        job.bytes = recovered.bytes;
        job.mimeType = recovered.manifest.mimeType;
        job.name = recovered.manifest.name;
      }
      if (job.recordingId) workspaceRecordingStore.markTranscriptionStarted(job.recordingId, plan.transcription.provider !== "local");
      if (plan.transcription.provider === "local") {
        rawText = await requestWorkspaceLocalTranscription(job, signal, update);
      } else {
        update("transcribing");
        const audio = new Blob([job.bytes], { type: job.mimeType });
        rawText = await transcribeWorkspaceCloud(audio, job, signal);
      }
      if (job.recordingId) workspaceRecordingStore.markTranscribed(job.recordingId, rawText);
    }
    job.rawText = String(rawText || "");
    signal.throwIfAborted();
    let refinementMarked = false;
    return sharedCore.runProcessingJob({ rawText, plan }, {
      transcribe: () => { throw new Error("WORKSPACE_TRANSCRIPTION_ALREADY_COMPLETE"); },
      refine: (text, profile, processingPlan) => refineWorkspaceText(text, profile, processingPlan, job.context, signal),
    }, (stage) => {
      if (stage === "refining" && job.recordingId && !refinementMarked) {
        refinementMarked = true;
        workspaceRecordingStore.markRefinementStarted(
          job.recordingId,
          ["openai", "openai-compatible"].includes(plan.refinement.provider),
        );
      }
      update(stage);
    });
  } finally {
    job.bytes = null;
    job.context.transcriptionKey = "";
    job.context.refinementKey = "";
  }
}

workspaceQueue = new SerialWorkspaceQueue(processWorkspaceJob, (jobs) => {
  for (const job of jobs) {
    if (!["completed", "failed"].includes(job.status) || workspacePersistedJobIds.has(job.id)) continue;
    try {
      workspaceHistoryStore.upsertFromJob(job);
      if (job.source === "recording") {
        if (job.status === "completed") workspaceRecordingStore.complete(job.id);
        else workspaceRecordingStore.markFailed(job.id, job.error || "Verarbeitung fehlgeschlagen");
      }
      workspacePersistedJobIds.add(job.id);
    } catch (error) {
      logError("Arbeitsbereich-Verlauf konnte nicht gespeichert werden", error);
    }
  }
  syncWakeAudioState();
  updateTray();
  syncWorkspaceWindow();
});

ipcMain.on("workspace-local-result", (event, payload) => {
  if (event.sender !== pill?.webContents) return;
  const pending = workspaceLocalRequests.get(payload?.requestId);
  if (!pending) return;
  workspaceLocalRequests.delete(payload.requestId);
  if (payload?.error) pending.reject(new Error(String(payload.error).slice(0, 240)));
  else pending.resolve(String(payload?.text || ""));
});

function refinementLabel() {
  if (settings.cleanup === "aus" || settings.refinementProvider === "none") return uiText("Aus", "Off");
  if (settings.refinementProvider === "deterministic") return uiText("Lokale Regeln", "Local rules");
  if (settings.refinementProvider === "ollama") return `Ollama · ${settings.ollamaModel || uiText("Modell wählen", "Choose model")}`;
  if (settings.refinementProvider === "openai-compatible") return `${uiText("Eigener Textserver", "Own text server")} · ${settings.compatibleRefinementModel || uiText("Modell wählen", "Choose model")}`;
  return "OpenAI";
}

function workspaceSnapshot() {
  const captureState = workspaceCapture?.state || "idle";
  const jobs = workspaceQueue.snapshot();
  const activeJobIds = new Set(jobs.filter((job) => ["queued", "processing"].includes(job.status)).map((job) => job.id));
  const retainedIds = new Set(workspaceRecordingStore.listRetainedIds());
  const storedHistory = workspaceHistoryStore.list();
  const history = WORKSPACE_PREVIEW && !storedHistory.length ? [{
    id: "preview-history-entry",
    source: "recording",
    name: "Beispielaufnahme",
    size: 482_000,
    status: "completed",
    rawText: "das ist eine beispiel aufnahme für den lokalen verlauf",
    text: "Das ist eine Beispielaufnahme für den lokalen Verlauf.",
    warning: uiText(
      "Der optionale Feinschliff war nicht erreichbar; das lokale Ergebnis bleibt nutzbar.",
      "Optional refinement was unavailable; the local result remains usable.",
    ),
    error: null,
    metadata: {
      transcriptionProvider: "local",
      transcriptionModel: "whisper-small",
      refinementProvider: "ollama",
      refinementModel: "lokales Modell",
      language: "de-DE",
      durationMs: 18_400,
    },
    createdAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 86_400_000,
    edited: false,
    audioRetained: true,
  }] : storedHistory.map((entry) => ({ ...entry, audioRetained: retainedIds.has(entry.id) }));
  const storedRecoveries = workspaceRecordingStore.listRecoverable().filter((entry) => !activeJobIds.has(entry.id));
  const recoveries = WORKSPACE_PREVIEW && !storedRecoveries.length ? [{
    id: "preview-recovery-entry",
    name: "Unterbrochene Aufnahme",
    state: "recording",
    size: 184_000,
    durationMs: 42_000,
    fragments: 9,
    createdAt: Date.now() - 3_600_000,
    updatedAt: Date.now() - 3_590_000,
    canProcess: true,
    retrySafety: "confirmation-required",
    uncertainStage: "transcription",
    error: "App wurde während der Verarbeitung beendet.",
    metadata: {
      transcriptionProvider: "openai",
      transcriptionModel: "gpt-transcribe",
      refinementProvider: "none",
      refinementModel: "",
      language: "de-DE",
      durationMs: 42_000,
    },
  }] : storedRecoveries;
  return {
    interfaceLanguage: settings.interfaceLanguage,
    version: app.getVersion(),
    shortcut: settings.interfaceLanguage === "en" ? HOTKEY_LABEL_ENGLISH : HOTKEY_LABEL,
    audioDestination: settings.mode === "local" ? "Auf diesem Gerät" : providerLabel(),
    refinementDestination: refinementLabel(),
    busy: anyAudioWorkBusy(),
    globalBusy: recording || processing || starting,
    captureState,
    captureId: workspaceCapture?.id || null,
    busyLabel: recording ? "Systemweites Diktat läuft …"
      : processing ? "Systemweites Diktat wird verarbeitet …"
        : starting ? "Systemweites Diktat startet …"
          : captureState === "recording" ? "Aufnahme läuft …"
            : captureState === "paused" ? "Aufnahme pausiert"
              : workspaceQueue.isBusy() ? "Warteschlange wird verarbeitet …" : "Bereit",
    jobs,
    history,
    recoveries,
    audioRetention: workspaceRecordingStore.getRetention(),
    recordingStorageLabel: "Nivune-Profil/workspace-recordings",
    preview: SMOKE_TEST,
  };
}

function syncWorkspaceWindow() {
  if (workspaceWin && !workspaceWin.isDestroyed()) workspaceWin.webContents.send("workspace-changed", workspaceSnapshot());
}

function openWorkspaceWindow() {
  if (!settings) return;
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    showUserWindow(workspaceWin);
    return;
  }
  workspaceWin = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 680,
    minHeight: 540,
    title: "Nivune",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#151b27" : "#fbfcfe",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "workspace-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  workspaceWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  workspaceWin.webContents.on("will-navigate", (event) => event.preventDefault());
  workspaceWin.once("ready-to-show", () => showUserWindow(workspaceWin));
  workspaceWin.on("closed", () => {
    if (workspaceCapture) {
      workspaceCapture.context.transcriptionKey = "";
      workspaceCapture.context.refinementKey = "";
      workspaceCapture = transitionCapture(workspaceCapture, "cancel");
      syncWakeAudioState();
      updateTray();
    }
    workspaceWin = null;
    syncDockVisibility();
    if (WORKSPACE_PREVIEW && !isQuitting) quitApp();
  });
  workspaceWin.loadFile(path.join(__dirname, "workspace.html"));
}

function requireWorkspaceSender(event) {
  if (!workspaceWin || event.sender !== workspaceWin.webContents || event.senderFrame !== workspaceWin.webContents.mainFrame) {
    throw new Error(uiText("Ungültiger Arbeitsbereich.", "Invalid workspace window."));
  }
}

function workspaceEntryId(payload) {
  const id = typeof payload?.id === "string" ? payload.id : "";
  if (!id || id.length > 180) throw new Error(uiText("Ungültiger Verlaufseintrag.", "Invalid history entry."));
  return id;
}

function workspaceExportBaseName(entry) {
  const source = entry.source === "recording" ? `aufnahme-${new Date(entry.createdAt).toISOString().slice(0, 10)}` : path.parse(entry.name).name;
  return source.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "nivune-export";
}

ipcMain.handle("workspace-read", (event) => {
  requireWorkspaceSender(event);
  return workspaceSnapshot();
});

ipcMain.on("workspace-rendered", (event, state) => {
  requireWorkspaceSender(event);
  if (!WORKSPACE_SMOKE) return;
  const valid = state && typeof state === "object"
    && Array.isArray(state.pages)
    && state.pages.join(",") === "dictation,recordings,files,history"
    && state.audioDestination === workspaceSnapshot().audioDestination
    && state.refinementDestination === workspaceSnapshot().refinementDestination;
  if (!valid) {
    console.error("WORKSPACE_SMOKE_FAILED: renderer differs from isolated workspace snapshot");
    process.exitCode = 1;
    quitApp();
    return;
  }
  console.log("WORKSPACE_SMOKE_OK: four desktop areas rendered through restricted IPC, no microphone or login registration");
  quitApp();
});

ipcMain.handle("workspace-action", async (event, action, payload) => {
  requireWorkspaceSender(event);
  if (SMOKE_TEST) throw new Error(uiText("Systemaktionen sind in der isolierten Vorschau deaktiviert.", "System actions are disabled in the isolated preview."));
  if (action === "open-settings") {
    openSettingsWindow();
    return workspaceSnapshot();
  }
  if (action === "save-history-text") {
    const id = workspaceEntryId(payload);
    if (typeof payload?.text !== "string" || payload.text.length > MAX_TEXT_LENGTH) throw new Error(uiText("Der bearbeitete Text ist zu lang.", "The edited text is too long."));
    workspaceHistoryStore.updateText(id, payload.text);
    return { ...workspaceSnapshot(), notice: uiText("Änderung lokal gespeichert.", "Change saved locally.") };
  }
  if (action === "delete-history") {
    const id = workspaceEntryId(payload);
    if (!workspaceHistoryStore.remove(id)) throw new Error(uiText("Der Verlaufseintrag wurde nicht gefunden.", "The history entry was not found."));
    if (workspaceRecordingStore.hasRetainedAudio(id)) workspaceRecordingStore.remove(id);
    return { ...workspaceSnapshot(), notice: uiText("Verlaufseintrag gelöscht.", "History entry deleted.") };
  }
  if (action === "clear-history") {
    workspaceHistoryStore.clear();
    workspaceRecordingStore.removeCompleted();
    return { ...workspaceSnapshot(), notice: uiText("Lokalen Verlauf vollständig gelöscht.", "Local history deleted completely.") };
  }
  if (action === "set-audio-retention") {
    if (typeof payload?.enabled !== "boolean") throw new Error(uiText("Ungültige Aufbewahrungseinstellung.", "Invalid retention setting."));
    const enabled = workspaceRecordingStore.setRetention(payload.enabled);
    return {
      ...workspaceSnapshot(),
      notice: enabled
        ? uiText("Dauerhafte Audioaufbewahrung ist für neue erfolgreiche Aufnahmen aktiviert.", "Permanent audio retention is enabled for new successful recordings.")
        : uiText("Arbeitskopien werden nach Erfolg gelöscht; bisher aufbewahrtes Audio wurde entfernt.", "Working copies are deleted after success; previously retained audio was removed."),
    };
  }
  if (action === "show-recording-storage") {
    const error = await shell.openPath(workspaceRecordingStore.paths.rootPath);
    if (error) throw new Error(uiText("Der Speicherort konnte nicht geöffnet werden.", "The storage location could not be opened."));
    return workspaceSnapshot();
  }
  if (action === "retry-recovery") {
    if (recording || processing || starting || workspaceCapture) throw new Error(uiText("Bitte beende zuerst die laufende Aufnahme.", "Please finish the current recording first."));
    const id = workspaceEntryId(payload);
    const recovery = workspaceRecordingStore.getRecovery(id);
    if (!recovery) throw new Error(uiText("Die Arbeitskopie wurde nicht gefunden.", "The working copy was not found."));
    if (recovery.uncertainStage && payload?.confirmUncertain !== true) {
      throw new Error(uiText("Dieser Cloud-Schritt benötigt vor einer Wiederholung eine ausdrückliche Bestätigung.", "This cloud step requires explicit confirmation before it is repeated."));
    }
    enqueueRecoveredRecording(id);
    return { ...workspaceSnapshot(), notice: uiText("Arbeitskopie wurde zur Verarbeitung eingereiht.", "Working copy queued for processing.") };
  }
  if (action === "discard-recovery") {
    const id = workspaceEntryId(payload);
    workspaceQueue.removeTerminal(id);
    workspacePersistedJobIds.delete(id);
    if (!workspaceRecordingStore.remove(id)) throw new Error(uiText("Die Arbeitskopie wurde nicht gefunden.", "The working copy was not found."));
    return { ...workspaceSnapshot(), notice: uiText("Lokale Audio-Arbeitskopie gelöscht.", "Local audio working copy deleted.") };
  }
  if (action === "remove-retained-audio") {
    const id = workspaceEntryId(payload);
    if (!workspaceRecordingStore.hasRetainedAudio(id) || !workspaceRecordingStore.remove(id)) {
      throw new Error(uiText("Für diesen Eintrag ist kein Audio mehr gespeichert.", "No audio is stored for this entry."));
    }
    return { ...workspaceSnapshot(), notice: uiText("Aufbewahrtes Audio gelöscht; der Text bleibt erhalten.", "Retained audio deleted; the text remains available.") };
  }
  if (action === "export-history") {
    const entry = workspaceHistoryStore.get(workspaceEntryId(payload));
    if (!entry) throw new Error(uiText("Der Verlaufseintrag wurde nicht gefunden.", "The history entry was not found."));
    const format = payload?.format === "md" ? "md" : payload?.format === "txt" ? "txt" : "";
    if (!format) throw new Error(uiText("Unbekanntes Exportformat.", "Unknown export format."));
    const selected = await dialog.showSaveDialog(workspaceWin, {
      title: format === "md" ? uiText("Als Markdown exportieren", "Export as Markdown") : uiText("Als Text exportieren", "Export as text"),
      defaultPath: `${workspaceExportBaseName(entry)}.${format}`,
      filters: [{ name: format === "md" ? "Markdown" : "Text", extensions: [format] }],
    });
    if (selected.canceled || !selected.filePath) return workspaceSnapshot();
    await fs.promises.writeFile(selected.filePath, historyExport(entry, format), { encoding: "utf8", mode: 0o600 });
    return { ...workspaceSnapshot(), notice: uiText(`${format.toUpperCase()} wurde exportiert.`, `${format.toUpperCase()} was exported.`) };
  }
  if (action === "export-settings") {
    const selected = await dialog.showSaveDialog(workspaceWin, {
      title: uiText("Einstellungen exportieren", "Export settings"),
      defaultPath: "nivune-einstellungen.json",
      filters: [{ name: uiText("Nivune-Einstellungen", "Nivune settings"), extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePath) return workspaceSnapshot();
    const exported = JSON.stringify(settingsStore.exportSettings(), null, 2);
    if (/KeyEnc|ApiKey|encrypted/i.test(exported)) throw new Error(uiText("Der Export enthält unerwartete Zugangsdatenfelder.", "The export contains unexpected credential fields."));
    await fs.promises.writeFile(selected.filePath, `${exported}\n`, { encoding: "utf8", mode: 0o600 });
    return { ...workspaceSnapshot(), notice: uiText("Einstellungen ohne Zugangsdaten exportiert.", "Settings exported without credentials.") };
  }
  if (action === "import-settings") {
    if (anyAudioWorkBusy()) throw new Error(uiText("Bitte warte, bis die aktuelle Audioarbeit abgeschlossen ist.", "Please wait until the current audio task is complete."));
    const selected = await dialog.showOpenDialog(workspaceWin, {
      title: uiText("Nivune-Einstellungen importieren", "Import Nivune settings"),
      properties: ["openFile"],
      filters: [{ name: uiText("Nivune-Einstellungen", "Nivune settings"), extensions: ["json"] }],
    });
    if (selected.canceled || selected.filePaths.length !== 1) return workspaceSnapshot();
    const filePath = selected.filePaths[0];
    let imported;
    let handle;
    try {
      handle = await fs.promises.open(filePath, "r");
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 1_000_000) throw new Error("SETTINGS_IMPORT_INVALID");
      if (anyAudioWorkBusy()) throw new Error(uiText("Während der Dateiauswahl wurde Audioarbeit gestartet. Bitte versuche den Import danach erneut.", "An audio task started while choosing the file. Please try the import again afterward."));
      const bytes = Buffer.alloc(1_000_001);
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      if (bytesRead > 1_000_000) throw new Error("SETTINGS_IMPORT_INVALID");
      const input = bytes.subarray(0, bytesRead).toString("utf8");
      imported = settingsStore.importSettings(JSON.parse(input));
    } catch (error) {
      if (String(error?.message) === "SETTINGS_IMPORT_INVALID" || error instanceof SyntaxError) {
        throw new Error(uiText("Das ist keine gültige Nivune-Einstellungsdatei.", "This is not a valid Nivune settings file."));
      }
      throw error;
    } finally {
      await handle?.close();
    }
    const previous = settings;
    settings = imported.settings;
    credentialCache.clear();
    nativeTheme.themeSource = settings.theme;
    if (!SMOKE_TEST) loginState = configureCurrentLogin(true);
    if (previous.mode !== settings.mode || previous.model !== settings.model || previous.transcriptionProvider !== settings.transcriptionProvider) prepareSelectedMode();
    if (previous.voiceActivation !== settings.voiceActivation) await refreshWakeActivation();
    updateTray();
    syncSettingsWindow();
    return {
      ...workspaceSnapshot(),
      notice: imported.targetsDeactivated
        ? uiText("Einstellungen importiert. Netzwerkziele und Sprachaktivierung bleiben bis zu deiner ausdrücklichen Auswahl deaktiviert.", "Settings imported. Network endpoints and voice activation remain disabled until you explicitly select them.")
        : uiText("Einstellungen ohne Zugangsdaten importiert. Sprachaktivierung bleibt deaktiviert.", "Settings imported without credentials. Voice activation remains disabled."),
    };
  }
  if (action === "start-dictation") {
    if (anyAudioWorkBusy()) throw new Error(uiText("Bitte warte, bis die aktuelle Audioarbeit abgeschlossen ist.", "Please wait until the current audio task is complete."));
    workspaceWin.hide();
    // `BrowserWindow.hide()` allein lässt Nivune auf macOS mitunter als aktive
    // App zurück. Das App-Hide übergibt den Fokus zuverlässig an die Anwendung,
    // die vor dem Arbeitsbereich aktiv war; die Sprechblase erscheint danach mit
    // `showInactive()` und stiehlt diesen Fokus nicht wieder.
    if (IS_MAC) app.hide();
    syncDockVisibility();
    setTimeout(() => startRecording("workspace"), 180);
    return workspaceSnapshot();
  }
  if (action === "start-recording") {
    if (anyAudioWorkBusy()) throw new Error(uiText("Bitte warte, bis die aktuelle Audioarbeit abgeschlossen ist.", "Please wait until the current audio task is complete."));
    const context = captureProcessingContext();
    assertWorkspaceProcessingReady(context);
    if (IS_MAC && systemPreferences.getMediaAccessStatus("microphone") !== "granted") {
      const allowed = await systemPreferences.askForMediaAccess("microphone");
      if (!allowed) throw new Error(uiText("Kein Mikrofonzugriff. Bitte die Mikrofonberechtigung für Nivune erlauben.", "No microphone access. Please allow microphone permission for Nivune."));
    }
    workspaceCapture = transitionCapture(null, "start", { id: nextWorkspaceJobId("recording"), context, startedAt: Date.now() });
    try {
      workspaceRecordingStore.begin({
        id: workspaceCapture.id,
        name: "Arbeitsbereich-Aufnahme",
        plan: context.plan,
        interfaceLanguage: context.interfaceLanguage,
        createdAt: workspaceCapture.startedAt,
      });
    } catch (error) {
      workspaceCapture = transitionCapture(workspaceCapture, "cancel");
      throw error;
    }
    syncWakeAudioState();
    updateTray();
    return workspaceSnapshot();
  }
  if (action === "pause-recording" || action === "resume-recording") {
    const expected = action === "pause-recording" ? "recording" : "paused";
    if (!workspaceCapture || workspaceCapture.state !== expected) throw new Error(uiText("Die Aufnahme ist nicht im erwarteten Zustand.", "The recording is not in the expected state."));
    workspaceCapture = transitionCapture(workspaceCapture, action === "pause-recording" ? "pause" : "resume");
    updateTray();
    return workspaceSnapshot();
  }
  if (action === "cancel-recording") {
    if (workspaceCapture) {
      workspaceRecordingStore.remove(workspaceCapture.id);
      workspaceCapture.context.transcriptionKey = "";
      workspaceCapture.context.refinementKey = "";
    }
    workspaceCapture = transitionCapture(workspaceCapture, "cancel");
    syncWakeAudioState();
    updateTray();
    return workspaceSnapshot();
  }
  if (action === "interrupt-recording") {
    if (!workspaceCapture) return workspaceSnapshot();
    workspaceCapture.context.transcriptionKey = "";
    workspaceCapture.context.refinementKey = "";
    workspaceCapture = transitionCapture(workspaceCapture, "cancel");
    syncWakeAudioState();
    updateTray();
    return workspaceSnapshot();
  }
  if (action === "import-file") {
    if (workspaceCapture || recording || processing || starting) throw new Error(uiText("Während einer Aufnahme kann keine Datei gewählt werden.", "You cannot choose a file while recording."));
    const context = captureProcessingContext();
    assertWorkspaceProcessingReady(context);
    const selected = await dialog.showOpenDialog(workspaceWin, {
      title: uiText("Audiodatei auswählen", "Choose audio file"),
      properties: ["openFile"],
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "mpeg", "mpga", "m4a", "mp4", "webm", "ogg", "oga", "flac"] }],
    });
    if (selected.canceled || selected.filePaths.length !== 1) return workspaceSnapshot();
    const filePath = selected.filePaths[0];
    const handle = await fs.promises.open(filePath, "r");
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error(uiText("Bitte eine reguläre Audiodatei auswählen.", "Please choose a regular audio file."));
      const header = Buffer.alloc(32);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      let metadata;
      try {
        metadata = validateAudioFile({ name: path.basename(filePath), size: stat.size, header: header.subarray(0, bytesRead), plan: context.plan });
      } catch (error) {
        throw workspaceAudioError(error, context.plan);
      }
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < bytes.length) {
        const part = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!part.bytesRead) break;
        offset += part.bytesRead;
      }
      if (offset !== stat.size) throw new Error(uiText("Die Audiodatei wurde während des Imports verändert.", "The audio file changed during import."));
      try {
        workspaceQueue.enqueue({
          id: nextWorkspaceJobId("file"),
          source: "file",
          ...metadata,
          bytes,
          context,
          historyMetadata: workspaceHistoryMetadata(context),
        });
      } catch (error) {
        throw workspaceAudioError(error, context.plan);
      }
    } finally {
      await handle.close();
    }
    return workspaceSnapshot();
  }
  if (action === "cancel-job") {
    const id = typeof payload?.id === "string" ? payload.id : "";
    if (!workspaceQueue.cancel(id)) throw new Error("Dieser Auftrag kann nicht mehr abgebrochen werden.");
    return workspaceSnapshot();
  }
  throw new Error("Unbekannte Arbeitsbereichsaktion.");
});

ipcMain.handle("workspace-append-recording-fragment", async (event, payload) => {
  requireWorkspaceSender(event);
  if (!workspaceCapture || payload?.captureId !== workspaceCapture.id) throw new Error("Die Aufnahme ist nicht mehr aktiv.");
  const suppliedBytes = payload?.bytes;
  const byteLength = suppliedBytes instanceof ArrayBuffer || ArrayBuffer.isView(suppliedBytes)
    ? suppliedBytes.byteLength : 0;
  if (!byteLength || byteLength > MAX_FRAGMENT_BYTES) throw new Error("RECORDING_FRAGMENT_INVALID");
  const bytes = Buffer.from(suppliedBytes);
  workspaceRecordingStore.appendFragment({
    id: workspaceCapture.id,
    sequence: payload?.sequence,
    bytes,
    mimeType: payload?.mimeType,
    durationMs: payload?.durationMs,
  });
  return { stored: true, sequence: payload.sequence };
});

ipcMain.handle("workspace-finish-recording", async (event, payload) => {
  requireWorkspaceSender(event);
  if (!workspaceCapture || payload?.captureId !== workspaceCapture.id) throw new Error("Die Aufnahme ist nicht mehr aktiv.");
  const capture = workspaceCapture;
  try {
    const durationMs = Math.max(0, Math.min(86_400_000, Number(payload?.durationMs) || 0));
    const finalized = workspaceRecordingStore.finalize(capture.id, durationMs);
    const manifest = workspaceRecordingStore.getRecovery(capture.id);
    let metadata;
    try {
      metadata = validateCapturedAudio({ byteLength: manifest.totalBytes, mimeType: manifest.mimeType, plan: capture.context.plan });
    } catch (error) {
      throw workspaceAudioError(error, capture.context.plan);
    }
    workspaceCapture = transitionCapture(workspaceCapture, "finish");
    workspaceRecordingStore.markQueued(capture.id);
    workspaceQueue.enqueue({
      id: capture.id,
      source: "recording",
      ...metadata,
      durationMs: finalized.durationMs,
      recordingId: capture.id,
      context: capture.context,
      historyMetadata: workspaceHistoryMetadata(capture.context, finalized.durationMs),
    });
    syncWakeAudioState();
    updateTray();
    return workspaceSnapshot();
  } catch (error) {
    if (workspaceCapture) workspaceCapture = transitionCapture(workspaceCapture, "cancel");
    syncWakeAudioState();
    updateTray();
    syncWorkspaceWindow();
    throw workspaceAudioError(error, capture.context.plan);
  }
});

nativeTheme.on("updated", () => {
  syncSettingsWindow();
  syncWorkspaceWindow();
});

/* ---------- Persönlicher Startbefehl und Hintergrundlistener ---------- */
let wakeSetupWin = null;

const wakeModelDir = () => path.join(app.getPath("userData"), "wake-models");

function openWakeSetupWindow() {
  if (wakeSetupWin) {
    showUserWindow(wakeSetupWin);
    return;
  }
  wakeGeneration += 1;
  pendingWakeConfig = { enabled: false };
  if (wakeReady && !wakeWin?.isDestroyed()) wakeWin.webContents.send("wake-configure", pendingWakeConfig);
  wakeStatus = { state: "setup", detail: "Startbefehl wird eingerichtet …" };
  updateTray();
  wakeSetupWin = new BrowserWindow({
    width: 620,
    height: 650,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: uiText("Nivune – Sprachaktivierung", "Nivune – Voice activation"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  wakeSetupWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  wakeSetupWin.webContents.on("will-navigate", (event) => event.preventDefault());
  wakeSetupWin.once("ready-to-show", () => showUserWindow(wakeSetupWin));
  const setupPhrase = wakeModelsAvailable ? wakePhrase : defaultWakePhrase(settings.interfaceLanguage);
  wakeSetupWin.loadFile("wakekey.html", { query: { lang: settings.interfaceLanguage, phrase: setupPhrase } });
  wakeSetupWin.on("closed", () => {
    wakeSetupWin = null;
    syncDockVisibility();
    refreshWakeActivation();
  });
}

function setWakeRecordingState(active) {
  if (wakeReady && !wakeWin?.isDestroyed()) {
    wakeWin.webContents.send("wake-recording-state", Boolean(active));
  }
}

function createWakeWindow() {
  if (wakeWin && !wakeWin.isDestroyed()) return wakeWin;
  wakeReady = false;
  wakeReloadAttempts = 0;
  wakeWin = new BrowserWindow({
    // Das Fenster bleibt sichtbar, aber leer und praktisch unsichtbar. Ein
    // komplett außerhalb des Bildschirms liegendes Fenster kann von macOS bei
    // getUserMedia pausiert werden. focusable: false erhält trotzdem immer das
    // zuvor aktive Textfeld.
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    show: true,
    opacity: 0.01,
    transparent: true,
    backgroundColor: "#00000000",
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "wake-preload.js"),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  wakeWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  wakeWin.webContents.on("will-navigate", (event) => event.preventDefault());
  wakeWin.setIgnoreMouseEvents(true);
  wakeWin.loadFile("wake.html");
  wakeWin.webContents.on("did-finish-load", () => {
    logError("Sprachlistener-Seite wurde geladen");
    clearTimeout(wakeReadyTimer);
    wakeReadyTimer = setTimeout(() => {
      if (!wakeReady && !isQuitting && wakeWin && !wakeWin.isDestroyed()) {
        wakeReloadAttempts += 1;
        if (wakeReloadAttempts <= 2) {
          logError("Sprachlistener antwortet nicht und wird neu geladen", `Versuch ${wakeReloadAttempts}`);
          wakeWin.webContents.reloadIgnoringCache();
        } else {
          wakeStatus = { state: "error", detail: "Sprachlistener konnte nicht gestartet werden" };
          logError("Sprachlistener blieb nach zwei Neustarts ohne Antwort");
          updateTray();
        }
      }
    }, 4_000);
  });
  wakeWin.webContents.on("render-process-gone", (_event, details) => {
    logError("Sprachlistener wurde unerwartet beendet", details?.reason || "unbekannt");
    wakeReady = false;
    wakeStatus = { state: "error", detail: "Sprachlistener wird neu gestartet …" };
    updateTray();
    if (!isQuitting) {
      wakeWin?.destroy();
      wakeWin = null;
      setTimeout(() => refreshWakeActivation(), 750).unref();
    }
  });
  wakeWin.webContents.on("did-fail-load", (_event, code, description) => {
    logError("Sprachlistener konnte nicht geladen werden", `${code}: ${description}`);
  });
  wakeWin.on("closed", () => {
    clearTimeout(wakeReadyTimer);
    wakeReadyTimer = null;
    wakeWin = null;
    wakeReady = false;
  });
  return wakeWin;
}

async function refreshWakeActivation() {
  const generation = ++wakeGeneration;
  const keywords = await loadEnrolledWakeModels({ fsPromises: fs.promises, modelDir: wakeModelDir() });
  if (generation !== wakeGeneration) return;
  wakeModelsAvailable = Boolean(keywords);
  wakePhrase = keywords?.[0]?.label || defaultWakePhrase(settings.interfaceLanguage);
  if (!settings.voiceActivation || !keywords) {
    if (wakePowerSaveBlockerId !== null && powerSaveBlocker.isStarted(wakePowerSaveBlockerId)) {
      powerSaveBlocker.stop(wakePowerSaveBlockerId);
    }
    wakePowerSaveBlockerId = null;
    pendingWakeConfig = { enabled: false };
    wakeStatus = {
      state: keywords ? "disabled" : "setup-required",
      detail: keywords ? "Sprachaktivierung ist ausgeschaltet" : "Persönlicher Startbefehl noch nicht eingerichtet",
    };
    if (wakeReady && !wakeWin?.isDestroyed()) wakeWin.webContents.send("wake-configure", pendingWakeConfig);
    updateTray();
    return;
  }

  if (wakePowerSaveBlockerId === null || !powerSaveBlocker.isStarted(wakePowerSaveBlockerId)) {
    wakePowerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
  }
  if (IS_MAC) {
    const microphoneStatus = systemPreferences.getMediaAccessStatus("microphone");
    logError("Mikrofonstatus für Sprachaktivierung", microphoneStatus);
    if (microphoneStatus !== "granted") {
      const granted = await systemPreferences.askForMediaAccess("microphone");
      if (!granted) {
        wakeStatus = { state: "error", detail: "Mikrofonzugriff für Nivune erlauben" };
        updateTray();
        return;
      }
    }
  }
  wakeStatus = { state: "preparing", detail: "Persönlicher Startbefehl wird vorbereitet …" };
  updateTray();
  let wasmBase64;
  try {
    const wasm = await fs.promises.readFile(path.join(__dirname, "rustpotter-runtime.wasm"));
    wasmBase64 = wasm.toString("base64");
  } catch (error) {
    wakeStatus = { state: "error", detail: "Lokale Spracherkennung fehlt" };
    logError("Rustpotter-WASM konnte nicht gelesen werden", error);
    updateTray();
    return;
  }
  if (generation !== wakeGeneration) return;
  pendingWakeConfig = { enabled: true, keywords, phrase: wakePhrase, wasmBase64 };
  createWakeWindow();
  if (wakeReady) wakeWin.webContents.send("wake-configure", pendingWakeConfig);
}

ipcMain.handle("save-wake-models", async (event, models) => {
  if (event.sender !== wakeSetupWin?.webContents) return { ok: false, error: "Ungültiges Fenster" };
  try {
    const savedModels = await saveEnrolledWakeModels({ fsPromises: fs.promises, modelDir: wakeModelDir(), models });
    wakeModelsAvailable = true;
    wakePhrase = savedModels[0]?.label || DEFAULT_WAKE_PHRASE;
    // During onboarding, enrollment only prepares the personal phrase. The
    // final checkbox remains the user's explicit opt-in for background audio.
    const awaitingOnboardingChoice = Boolean(onboardingWin && !onboardingWin.isDestroyed() && !onboardingState.completed);
    settings.voiceActivation = awaitingOnboardingChoice ? false : true;
    saveSettings(settings);
    await refreshWakeActivation();
    syncOnboardingWindow();
    setTimeout(() => wakeSetupWin?.close(), 650);
    return { ok: true };
  } catch (error) {
    logError("Persönlicher Startbefehl konnte nicht gespeichert werden", error);
    return { ok: false, error: String(error?.message || error).slice(0, 180) };
  }
});

ipcMain.on("close-wake-setup", (event) => {
  if (event.sender === wakeSetupWin?.webContents) wakeSetupWin.close();
});

ipcMain.on("wake-ready", (event) => {
  if (event.sender !== wakeWin?.webContents) return;
  wakeReady = true;
  wakeReloadAttempts = 0;
  clearTimeout(wakeReadyTimer);
  wakeReadyTimer = null;
  logError("Sprachlistener-Fenster ist bereit");
  if (pendingWakeConfig) wakeWin.webContents.send("wake-configure", pendingWakeConfig);
});

ipcMain.on("wake-status", (event, value) => {
  if (event.sender !== wakeWin?.webContents) return;
  wakeStatus = {
    state: value?.state || "error",
    detail: String(value?.detail || "Unbekannter Status").slice(0, 180),
  };
  logError(`Sprachaktivierung: ${wakeStatus.state}`, wakeStatus.detail);
  updateTray();
});

ipcMain.on("wake-detected", (event, value) => {
  if (event.sender !== wakeWin?.webContents || !settings.voiceActivation) return;
  const action = typeof value === "string" ? value : value?.action;
  const details = typeof value === "object" ? value?.details : null;
  const score = Number.isFinite(details?.score) ? `; Score: ${details.score.toFixed(3)}` : "";
  logError("Sprachbefehl erkannt", `${action}; Aufnahme aktiv: ${recording}${score}`);
  if (action === "start") startRecording("voice");
});

ipcMain.on("wake-candidate", (event, value) => {
  if (event.sender !== wakeWin?.webContents || !settings.voiceActivation) return;
  const action = value?.action === "stop" ? "stop" : "start";
  const state = ["detected", "confirmed", "rejected"].includes(value?.state) ? value.state : "unknown";
  const score = Number.isFinite(value?.details?.score) ? `; Score: ${value.details.score.toFixed(3)}` : "";
  logError("Sprachbefehl-Kandidat", `${action}; ${state}${score}`);
});

ipcMain.on("recording-silence", (event) => {
  if (event.sender !== currentRecordingContents() || !recording) return;
  logError("Aufnahmeende durch bestätigte Stille");
  stopRecording("silence");
});

ipcMain.on("recording-limit", (event) => {
  if (event.sender !== currentRecordingContents() || !recording) return;
  logError("Aufnahmeende durch maximale Diktatdauer");
  stopRecording("limit");
});

ipcMain.on("pill-error", (_e, message) => {
  if (_e.sender !== currentRecordingContents()) return;
  const trigger = recordingTrigger;
  recordingTrigger = null;
  activeRecordingContents = null;
  logError("Aufnahmefehler", message);
  if (trigger !== "onboarding") pill?.hide();
  recording = false;
  processing = false;
  syncWakeAudioState();
  globalShortcut.unregister("Escape");
  updateTray();
  if (trigger === "onboarding") {
    onboardingSample = { state: "error", text: "", error: String(message || uiText("Aufnahme fehlgeschlagen.", "Recording failed.")).slice(0, 240) };
    openOnboardingWindow();
    syncOnboardingWindow();
  }
  if (Notification.isSupported()) {
    new Notification({
      title: uiText("Nivune konnte nicht aufnehmen", "Nivune could not record"),
      body: String(message || uiText("Bitte prüfe Mikrofon und Audioeinstellungen.", "Please check the microphone and audio settings.")).slice(0, 240),
    }).show();
  }
});

function prepareSelectedMode() {
  if (SMOKE_TEST || !pillReady || anyAudioWorkBusy()) return;
  if (settings.mode === "local" && !localRuntimeStatus.ready) {
    preparation = "Lokale Laufzeitdateien fehlen";
    localModelStatus = { choice: settings.model, state: "error", progress: 0, files: 0, error: "LOCAL_RUNTIME_MISSING" };
    updateTray();
    return;
  }
  preparation = settings.mode === "local" ? "Lokales Modell wird geprüft …" : `Qualitätsmodus · ${providerLabel()}`;
  if (settings.mode === "local") sendLocalModelCommand("inspect");
  pill.webContents.send("prepare", { interfaceLanguage: settings.interfaceLanguage, mode: settings.mode, model: settings.model });
  updateTray();
}

ipcMain.on("renderer-ready", (event) => {
  if (event.sender === onboardingAudioView?.webContents) {
    onboardingAudioReady = true;
    syncOnboardingWindow();
    return;
  }
  if (event.sender !== pill?.webContents) return;
  pillReady = true;
  if (SMOKE_TEST) {
    if (MODEL_SMOKE) {
      pill.webContents.send("prepare", { interfaceLanguage: "en", mode: "local", model: "genau" });
      return;
    }
    if (SETTINGS_PREVIEW || SETTINGS_SMOKE) { openSettingsWindow(); return; }
    if (WORKSPACE_PREVIEW || WORKSPACE_SMOKE) { openWorkspaceWindow(); return; }
    if (ONBOARDING_PREVIEW || ONBOARDING_SMOKE) { openOnboardingWindow(); return; }
    console.log("SMOKE_OK: renderer ready, no microphone or login registration");
    quitApp();
    return;
  }
  prepareSelectedMode();
  if (!onboardingState.completed) openOnboardingWindow();
});

ipcMain.on("prepared", (event, result) => {
  if (event.sender !== pill?.webContents || result.mode !== settings.mode || result.model !== settings.model) return;
  if (MODEL_SMOKE) {
    if (result.ok) {
      console.log(`MODEL_SMOKE_OK: ${result.modelId}; revision=${result.revision}; backend=${result.backend}; local_files_only=${result.localFilesOnly}; network=offline`);
    } else {
      console.error(`MODEL_SMOKE_FAILED: ${String(result.reason || "unknown error").slice(0, 300)}`);
      process.exitCode = 1;
    }
    quitApp();
    return;
  }
  preparation = result.ok
    ? settings.mode === "local" ? "Lokales Modell bereit" : "Qualitätsmodus bereit"
    : "Lokales Modell in den Einstellungen herunterladen";
  updateTray();
});

function sendLocalModelCommand(action) {
  if (!pillReady || !pill || pill.isDestroyed()) return;
  if (!localRuntimeStatus.ready) {
    localModelStatus = { choice: settings.model, state: "error", progress: 0, files: 0, error: "LOCAL_RUNTIME_MISSING" };
    updateTray();
    return;
  }
  const id = `model-${++localModelCommandId}`;
  if (action === "download") localModelStatus = { choice: settings.model, state: "downloading", progress: 0, files: 0, error: null };
  else if (action !== "cancel") localModelStatus = { choice: settings.model, state: "checking", progress: 0, files: 0, error: null };
  pill.webContents.send("model-command", { id, action, choice: settings.model });
  updateTray();
}

ipcMain.on("model-status", (event, status) => {
  if (event.sender !== pill?.webContents || !status || status.choice !== settings.model) return;
  if (!localRuntimeStatus.ready) return;
  const state = ["missing", "partial", "downloading", "ready"].includes(status.state) ? status.state : "error";
  const previousStatus = localModelStatus;
  const reportedProgress = Math.max(0, Math.min(state === "downloading" ? 99 : 100, Number(status.progress || (state === "ready" ? 100 : 0))));
  const progress = state === "downloading"
    && previousStatus.choice === status.choice
    && previousStatus.state === "downloading"
    ? Math.max(previousStatus.progress || 0, reportedProgress)
    : reportedProgress;
  localModelStatus = {
    choice: status.choice,
    state,
    progress,
    loaded: Math.max(0, Number(status.loaded || 0)),
    total: Math.max(0, Number(status.total || 0)),
    files: Math.max(0, Number(status.files || 0)),
    error: status.error ? String(status.error).slice(0, 240) : null,
  };
  if (state === "ready") preparation = "Lokales Modell bereit";
  else if (state === "downloading") preparation = `Lokales Modell lädt … ${localModelStatus.progress} %`;
  else if (state === "missing") preparation = "Lokales Modell nicht geladen";
  else if (state === "partial") preparation = "Lokaler Modelldownload unvollständig";
  else preparation = "Lokales Modell konnte nicht geprüft werden";
  // Download-Callbacks können mehrmals pro Prozentpunkt eintreffen. Nur eine
  // sichtbare Änderung neu rendern, damit die Einstellungsfenster ruhig bleiben.
  if (previousStatus.choice !== localModelStatus.choice
    || previousStatus.state !== localModelStatus.state
    || previousStatus.progress !== localModelStatus.progress
    || previousStatus.error !== localModelStatus.error) updateTray();
});

/* ---------- Tray (Menüleiste) ---------- */
function updateTray() {
  syncSettingsWindow();
  syncWorkspaceWindow();
  syncOnboardingWindow();
  if (!tray) return;
  const pasteAccess = getCurrentPasteAccess();
  if (IS_MAC) tray.setTitle(recording || workspaceCapture ? " ●" : processing || workspaceQueue?.isBusy() ? " ···" : "");
  const langItems = [
    [uiText("Deutsch", "German"), "de"],
    ["English", "en"],
    [uiText("Automatisch erkennen", "Detect automatically"), ""],
  ].map(([label, code]) => ({
    label,
    type: "radio",
    checked: settings.lang === code,
    click: () => {
      settings.lang = code;
      saveSettings(settings);
      updateTray();
    },
  }));

  const modelItems = [
    [uiText("Genau (empfohlen, ~250 MB)", "Accurate (recommended, ~250 MB)"), "genau"],
    [uiText("Schnell (~80 MB)", "Fast (~80 MB)"), "schnell"],
  ].map(([label, value]) => ({
    label,
    type: "radio",
    checked: settings.model === value,
    click: () => {
      settings.model = value;
      saveSettings(settings);
      prepareSelectedMode();
      updateTray();
    },
  }));

  const modeItems = [
    [uiText("Beste Qualität (gewählter Anbieter)", "Best quality (selected provider)"), "quality"],
    [uiText("Lokal und offline", "Local and offline"), "local"],
  ].map(([label, value]) => ({
    label,
    type: "radio",
    checked: settings.mode === value,
    click: () => {
      settings.mode = value;
      saveSettings(settings);
      prepareSelectedMode();
      updateTray();
    },
  }));

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: uiText("Nivune öffnen …", "Open Nivune …"), click: () => onboardingState.completed ? openWorkspaceWindow() : openOnboardingWindow() },
      { label: uiText("Einstellungen …", "Settings …"), accelerator: "CommandOrControl+,", click: openSettingsWindow },
      { type: "separator" },
      {
        label: workspaceIsBusy() ? uiText("Arbeitsbereich ist beschäftigt …", "Workspace is busy …") : processing ? uiText("Text wird verarbeitet …", "Processing text …") : recording ? uiText("Aufnahme beenden", "Stop recording") : uiText("Diktieren", "Dictate"),
        enabled: pillReady && !processing && !starting && !workspaceIsBusy(),
        accelerator: HOTKEY,
        click: toggleRecording,
      },
      { type: "separator" },
      { label: localizedRuntimeText(preparation), enabled: false },
      { label: uiText("Sprache", "Language"), submenu: langItems, enabled: !anyAudioWorkBusy() },
      { label: uiText("Transkription", "Transcription"), submenu: modeItems, enabled: !anyAudioWorkBusy() },
      ...(settings.mode === "local" ? [{ label: uiText("Lokales Modell", "Local model"), submenu: modelItems, enabled: !anyAudioWorkBusy() }] : []),
      { type: "separator" },
      {
        label: settings.mode === "quality" && !qualitySetupIssue()
          ? uiText(`Beste Qualität: ${providerLabel()} bereit ✓`, `Best quality: ${providerLabel()} ready ✓`)
          : settings.mode === "quality" ? uiText(`Beste Qualität: ${qualitySetupIssue()?.message || "Einrichtung fehlt"}`, `Best quality: ${localizedRuntimeText(qualitySetupIssue()?.message || "Setup missing")}`) : uiText("Beste Qualität: nicht aktiv", "Best quality: inactive"),
        enabled: false,
      },
      {
        label: uiText(
          `${providerLabel()} ${settings.transcriptionProvider === "openai-compatible" ? "Server-Key" : "API-Key"} verwalten …`,
          `Manage ${providerLabel()} ${settings.transcriptionProvider === "openai-compatible" ? "server key" : "API key"} …`,
        ),
        enabled: !anyAudioWorkBusy(),
        click: () => openKeyWindow(settings.transcriptionProvider),
      },
      ...(encryptedCredential(settings.transcriptionProvider)
        ? [
            {
              label: uiText(`${providerLabel()}-Key entfernen`, `Remove ${providerLabel()} key`),
              enabled: !anyAudioWorkBusy(),
              click: () => {
                const provider = settings.transcriptionProvider || "openai";
                const field = provider === "groq" ? "groqKeyEnc" : provider === "openai-compatible" ? "compatibleTranscriptionKeyEnc" : "openaiKeyEnc";
                settings[field] = null;
                credentialCache.delete(provider);
                saveSettings(settings);
                updateTray();
              },
            },
          ]
        : []),
      { type: "separator" },
      {
        label: uiText(`Sprachaktivierung: „${wakePhrase}“`, `Voice activation: “${wakePhrase}”`),
        type: "checkbox",
        checked: Boolean(settings.voiceActivation && wakeModelsAvailable),
        enabled: !anyAudioWorkBusy(),
        click: (item) => {
          if (item.checked && !wakeModelsAvailable) {
            settings.voiceActivation = false;
            saveSettings(settings);
            openWakeSetupWindow();
            updateTray();
            return;
          }
          settings.voiceActivation = item.checked;
          saveSettings(settings);
          updateTray();
          refreshWakeActivation();
        },
      },
      {
        label: settings.voiceActivation && wakeModelsAvailable
          ? localizedRuntimeText(wakeStatus.detail)
          : wakeModelsAvailable ? uiText("Sprachaktivierung ist ausgeschaltet", "Voice activation is off") : uiText("Persönlicher Startbefehl fehlt", "Personal start phrase is missing"),
        enabled: false,
      },
      {
        label: uiText(`Ende: 9 Sekunden Stille oder ${HOTKEY_LABEL}`, `Stop: 9 seconds of silence or ${HOTKEY_LABEL_ENGLISH}`),
        enabled: false,
      },
      {
        label: wakeModelsAvailable ? uiText("Startbefehl neu einlernen …", "Set up start phrase again …") : uiText("Startbefehl einrichten …", "Set up start phrase …"),
        enabled: !anyAudioWorkBusy(),
        click: openWakeSetupWindow,
      },
      ...(wakeModelsAvailable
        ? [
            {
              label: uiText("Persönliche Sprachmodelle entfernen", "Remove personal voice models"),
              enabled: !anyAudioWorkBusy(),
              click: async () => {
                try {
                  await removeEnrolledWakeModels({ fsPromises: fs.promises, modelDir: wakeModelDir() });
                  wakeModelsAvailable = false;
                  wakePhrase = DEFAULT_WAKE_PHRASE;
                  settings.voiceActivation = false;
                  saveSettings(settings);
                  updateTray();
                  await refreshWakeActivation();
                } catch (error) {
                  logError("Persönliche Sprachmodelle konnten nicht entfernt werden", error);
                }
              },
            },
          ]
        : []),
      { type: "separator" },
      {
        label: uiText("Bei der Anmeldung starten", "Launch at login"),
        type: "checkbox",
        checked: loginState.enabled,
        enabled: loginState.supported,
        click: (item) => {
          settings.launchAtLogin = item.checked;
          loginState = configureCurrentLogin(true);
          saveSettings(settings);
          updateTray();
        },
      },
      { label: localizedRuntimeText(loginState.detail), enabled: false },
      ...(IS_MAC ? [{ label: uiText("Anmeldeobjekte in macOS öffnen", "Open Login Items in macOS"), click: () => shell.openExternal("x-apple.systempreferences:com.apple.LoginItems-Settings.extension") }] : []),
      {
        label: uiText("Diagnoseprotokoll anzeigen", "Show diagnostic log"),
        click: () => {
          logError("Diagnoseprotokoll geöffnet");
          shell.showItemInFolder(logPath);
        },
      },
      { type: "separator" },
      { label: uiText("Nivune Web-App öffnen", "Open Nivune web app"), click: () => shell.openExternal(WEB_URL) },
      { label: uiText(`Version ${app.getVersion()}`, `Version ${app.getVersion()}`), enabled: false },
      updateStatus.state === "available"
        ? { label: uiText(`Version ${updateStatus.latest.version} verfügbar: Download-Seite öffnen`, `Version ${updateStatus.latest.version} available: open download page`), click: openOfficialReleasePage }
        : {
            label: updateStatus.state === "checking"
              ? uiText("Suche nach Updates …", "Checking for updates …")
              : uiText("Nach Updates suchen …", "Check for updates …"),
            enabled: updateStatus.state !== "checking" && !SMOKE_TEST,
            click: async () => {
              const status = await runUpdateCheck().catch(() => updateStatus);
              if (Notification.isSupported()) {
                new Notification({
                  title: "Nivune",
                  body: status.state === "available"
                    ? uiText(`Version ${status.latest.version} ist verfügbar. Download über das Menü.`, `Version ${status.latest.version} is available. Download via the menu.`)
                    : status.state === "current"
                      ? uiText("Nivune ist aktuell.", "Nivune is up to date.")
                      : uiText("Updateprüfung nicht möglich. Details in den Einstellungen.", "Could not check for updates. See settings for details."),
                }).show();
              }
            },
          },
      ...(IS_MAC
        ? [
            {
              label: pasteAccess.canPaste
                ? uiText("Automatisches Einfügen: bereit ✓", "Automatic paste: ready ✓")
                : uiText("Automatisches Einfügen: Freigabe erneuern", "Automatic paste: renew permission"),
              enabled: false,
            },
            {
              label: uiText("Bedienungshilfen in macOS öffnen", "Open Accessibility settings in macOS"),
              click: () => shell.openExternal(ACCESSIBILITY_SETTINGS_URL),
            },
          ]
        : []),
      { type: "separator" },
      { label: uiText("Nivune beenden", "Quit Nivune"), click: quitApp },
    ])
  );
  tray.setToolTip(uiText(`Nivune – ${HOTKEY_LABEL} zum Diktieren`, `Nivune – ${HOTKEY_LABEL_ENGLISH} to dictate`));
}

function createTray() {
  // Template-Glyph adapts to macOS appearance; Windows uses the app icon.
  let img = nativeImage.createEmpty();
  if (IS_MAC) {
    img = nativeImage.createFromPath(path.join(__dirname, "trayTemplate@2x.png")).resize({ width: 18, height: 18 });
    img.setTemplateImage(true);
  } else {
    try {
      img = nativeImage
        .createFromPath(path.join(__dirname, "icon.png"))
        .resize({ width: 16, height: 16 });
    } catch {
      /* ohne Icon zeigt Windows ein Standard-Symbol */
    }
  }
  tray = new Tray(img);
  if (!IS_MAC) tray.setTitle("Nivune"); // no-op auf Windows, Fallback auf Linux
  // Auf Windows öffnet ein normaler Linksklick sonst nichts – Menü zeigen.
  if (!IS_MAC) tray.on("click", () => tray.popUpContextMenu());
  updateTray();
}

/* ---------- Sauberes Beenden ---------- */
function quitApp() {
  isQuitting = true;
  try {
    globalShortcut.unregisterAll();
  } catch {
    /* egal */
  }
  try {
    pill?.destroy();
  } catch {
    /* egal */
  }
  try {
    settingsWin?.destroy();
  } catch { /* already closed */ }
  try {
    workspaceWin?.destroy();
  } catch { /* already closed */ }
  try {
    keyWin?.destroy();
  } catch {
    /* egal */
  }
  try {
    wakeSetupWin?.destroy();
  } catch {
    /* egal */
  }
  try {
    wakeWin?.destroy();
  } catch {
    /* egal */
  }
  try {
    tray?.destroy();
  } catch {
    /* egal */
  }
  try {
    if (wakePowerSaveBlockerId !== null && powerSaveBlocker.isStarted(wakePowerSaveBlockerId)) {
      powerSaveBlocker.stop(wakePowerSaveBlockerId);
    }
  } catch {
    /* egal */
  }
  app.quit();
}

/* ---------- App-Start ---------- */
app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) {
    // Eine andere Instanz läuft bereits – diese Kopie sofort schließen.
    app.quit();
    return;
  }
  settings = loadSettings();
  if (MODEL_SMOKE) {
    settings = { ...settings, interfaceLanguage: "en", mode: "local", model: "genau" };
    session.defaultSession.enableNetworkEmulation({ offline: true });
  }
  workspaceHistoryStore.load();
  workspaceRecordingStore.load();
  onboardingState = onboardingStore.load();
  if (!onboardingState.completed && onboardingState.sampleCompleted) {
    // Der Probentext wird absichtlich nicht dauerhaft gespeichert. Nach einem
    // Neustart ist deshalb eine neue Probe nötig, bevor die Einrichtung endet.
    onboardingState = onboardingStore.update({ step: 3, sampleCompleted: false });
  }
  nativeTheme.themeSource = ["system", "light", "dark"].includes(settings.theme) ? settings.theme : "system";
  logError("Nivune-App gestartet", `Version ${app.getVersion()}`);
  if (!SMOKE_TEST && settings.mode === "quality") {
    // Nur im Cloud-Modus: früh erkennen, ob ein übernommener Key noch lesbar ist,
    // damit Einrichtung und Einstellungen nicht fälschlich „gespeichert“ zeigen.
    getProviderKey(settings.transcriptionProvider || "openai");
  }
  if (!SMOKE_TEST && onboardingState.completed) {
    loginState = configureCurrentLogin();
    saveSettings(settings);
  } else if (!SMOKE_TEST) {
    loginState = {
      supported: !ALPHA_BUILD && app.isPackaged && (IS_MAC || IS_WIN),
      enabled: false,
      detail: ALPHA_BUILD
        ? "Autostart ist in der internen Alpha deaktiviert."
        : app.isPackaged && (IS_MAC || IS_WIN)
          ? "Autostart wird am Ende der Einrichtung gewählt."
          : "Autostart ist erst in der installierten App verfügbar.",
    };
  }
  if (process.platform === "darwin") app.dock?.hide();

  createPill();
  createTray();

  const ok = SMOKE_TEST || globalShortcut.register(HOTKEY, toggleRecording);
  if (!ok) {
    preparation = uiText(`Shortcut ${HOTKEY_LABEL} ist bereits belegt`, `Shortcut ${HOTKEY_LABEL_ENGLISH} is already in use`);
    logError(`Globaler Shortcut ${HOTKEY} konnte nicht registriert werden`);
    updateTray();
    if (Notification.isSupported()) {
      new Notification({
        title: uiText("Nivune-Shortcut ist bereits belegt", "Nivune shortcut is already in use"),
        body: uiText(`${HOTKEY_LABEL} wird von einer anderen App verwendet. Diktieren bleibt über das Nivune-Menü möglich.`, `${HOTKEY_LABEL_ENGLISH} is used by another app. Dictation remains available from the Nivune menu.`),
      }).show();
    }
  }

  if (SMOKE_TEST) {
    if (!SETTINGS_PREVIEW && !WORKSPACE_PREVIEW) setTimeout(() => {
      if (MODEL_SMOKE) {
        console.error("MODEL_SMOKE_FAILED: timeout");
        process.exitCode = 1;
      } else {
        logError("SMOKE_TIMEOUT");
      }
      quitApp();
    }, MODEL_SMOKE ? 60_000 : 15_000).unref();
    return;
  }
  try {
    // Auch eine unterbrochene Einrichtung darf ein bereits gespeichertes
    // persönliches Modell wiederfinden. Ohne aktives Opt-in wird dabei weder
    // ein Listener gestartet noch Mikrofonzugriff angefragt.
    await refreshWakeActivation();
  } catch (error) {
    logError("Sprachaktivierung konnte beim App-Start nicht vorbereitet werden", error);
  }
  if (SETUP_VOICE) openWakeSetupWindow();
});

app.on("window-all-closed", (e) => {
  // Menüleisten-/Tray-App bleibt im Hintergrund aktiv, außer beim echten Beenden.
  if (!isQuitting) e.preventDefault();
});
app.on("activate", () => {
  const existing = [keyWin, wakeSetupWin, onboardingWin, settingsWin, workspaceWin]
    .find((window) => window && !window.isDestroyed());
  if (existing) showUserWindow(existing);
  else if (!onboardingState.completed) openOnboardingWindow();
  else openWorkspaceWindow();
});
// Beenden von außen (Cmd+Q, Abmelden, Herunterfahren, Dock, AppleScript, SIGTERM)
// muss dieselbe Aufräumlogik nutzen. Sonst verhindert die nicht schließbare
// Aufnahmeblase, dass die App überhaupt endet.
app.on("before-quit", () => {
  if (isQuitting) return;
  isQuitting = true;
  try {
    pill?.destroy();
  } catch {
    /* bereits geschlossen */
  }
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (!isQuitting) quitApp();
  });
}
app.on("will-quit", () => {
  // Eine zweite Instanz kann noch vor app.whenReady() am Single-Instance-Lock
  // scheitern. globalShortcut ist in diesem frühen Shutdown noch nicht nutzbar.
  if (app.isReady()) globalShortcut.unregisterAll();
});
