const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  clipboard,
  ipcMain,
  screen,
  systemPreferences,
  safeStorage,
  shell,
  nativeImage,
  Notification,
  powerSaveBlocker,
  nativeTheme,
} = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { validateSettingsPatch } = require("./settings-contract");
const { configureLogin } = require("./startup");
const { configureRuntime, createFileLogger, installPipeGuards } = require("./runtime");
const { ACCESSIBILITY_SETTINGS_URL, getPasteAccess } = require("./accessibility");
const {
  loadEnrolledWakeModels,
  saveEnrolledWakeModels,
  removeEnrolledWakeModels,
} = require("./wake-runtime");
const { trimTailMs, stripTrailingStopCommand } = require("./wake-controller");

const WEB_URL = "https://klartext-ai.vercel.app";
const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";
const SETTINGS_PREVIEW = process.argv.includes("--settings-preview");
const SETTINGS_SMOKE = process.argv.includes("--settings-smoke-test");
const SMOKE_TEST = process.argv.includes("--smoke-test") || SETTINGS_PREVIEW || SETTINGS_SMOKE;
const SETUP_VOICE = process.argv.includes("--setup-voice");

// Der lokale Wake-Word-Renderer muss auch als vollständig unsichtbares
// Menüleistenfenster kontinuierlich Audio verarbeiten. Diese Schalter gelten
// nur für Klartext und verhindern, dass Chromium ihn im Hintergrund einfriert.
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
const runtime = configureRuntime(app, process.platform, process.env, SMOKE_TEST);
const HOTKEY = runtime.hotkey;
const HOTKEY_LABEL = runtime.hotkeyLabel;
const logPath = path.join(app.getPath("userData"), "klartext.log");
const logError = createFileLogger(fs, logPath);
installPipeGuards([process.stdout, process.stderr], (error) => logError("Ausgabekanal geschlossen", error));

const PILL_W = 520;
const PILL_H = 210; // Platz für die Live-Mitschrift über der Pill

let pill = null;
let tray = null;
let recording = false;
let processing = false;
let starting = false;
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
let wakePowerSaveBlockerId = null;
let wakeReadyTimer = null;
let wakeReloadAttempts = 0;

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
  else openSettingsWindow();
});

/* ---------- Einstellungen (userData/settings.json) ---------- */
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

const SETTINGS_DEFAULTS = {
  lang: "de", // "de" | "en" | "" (= automatisch)
  mode: "quality", // "quality" (gpt-transcribe) | "local" (Whisper)
  model: "genau", // "genau" (whisper-small) | "schnell" (whisper-base)
  launchAtLogin: true,
  theme: "system",
  openaiKeyEnc: null, // verschlüsselt über Schlüsselbund / Credential Vault
  voiceActivation: false,
  context: "Software, KI, Automatisierung, Produktarbeit und persönliche Nachrichten",
};

function loadSettings() {
  try {
    return { ...SETTINGS_DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), "utf8")) };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

function saveSettings(s) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(s));
  } catch {
    /* nicht kritisch */
  }
}

let settings = null;
let cachedOpenAIKey = null;
let openAIKeyCacheReady = false;

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
    },
  });
  pill.setAlwaysOnTop(true, "screen-saver");
  pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pill.webContents.on("render-process-gone", (_event, details) => {
    logError("Aufnahmefenster wurde unerwartet beendet", details?.reason || "unbekannt");
  });
  // Mikrofon-Zugriff im Fenster erlauben (v. a. für Windows/Linux nötig)
  pill.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === "media" || permission === "microphone");
  });
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
  if (recording || starting || processing || !pill || !pillReady) return;
  const hasStoredOpenAIKey = Boolean(settings.openaiKeyEnc);
  if (settings.mode === "quality" && !hasStoredOpenAIKey) {
    openKeyWindow();
    return;
  }
  starting = true;
  updateTray();
  try {
    // Nur die Mikrofonfreigabe ist für die Aufnahme nötig. Bedienungshilfen werden
    // erst nach der Transkription fürs automatische Einfügen ausgewertet.
    if (IS_MAC && systemPreferences.getMediaAccessStatus("microphone") !== "granted") {
      const allowed = await systemPreferences.askForMediaAccess("microphone");
      if (!allowed) return;
    }
    if (trigger === "voice") {
      shell.beep();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch (error) {
    logError("Mikrofonberechtigung konnte nicht geprüft werden", error);
    return;
  } finally {
    starting = false;
    updateTray();
  }
  recording = true;
  positionPill();
  // Das vorher aktive Textfeld muss den Fokus behalten, damit das Ergebnis an
  // exakt derselben Cursorposition eingefügt werden kann.
  pill.showInactive();
  pill.moveTop();
  pill.setAlwaysOnTop(true, "screen-saver");
  pill.webContents.send("start", {
    lang: settings.lang,
    mode: settings.mode,
    model: settings.model,
    hasOpenAIKey: hasStoredOpenAIKey,
    trigger,
  });
  setWakeRecordingState(true);
  if (trigger === "voice") {
    logError("Sprachbefehl hat Aufnahme gestartet", `Pill sichtbar: ${pill.isVisible()}`);
  }
  globalShortcut.register("Escape", cancelRecording);
  updateTray();
}

function stopRecording(reason = "manual") {
  if (!recording || !pill) return;
  recording = false;
  processing = true;
  pill.webContents.send("stop", { reason, trimTailMs: trimTailMs(reason) });
  setWakeRecordingState(false);
  globalShortcut.unregister("Escape");
  updateTray();
}

function cancelRecording() {
  if (!pill || processing) return;
  recording = false;
  pill.webContents.send("cancel");
  setWakeRecordingState(false);
  pill.hide();
  globalShortcut.unregister("Escape");
  updateTray();
}

function toggleRecording() {
  if (recording) stopRecording();
  else startRecording();
}

/* ---------- Hochwertige Transkription (eigener OpenAI API-Key) ---------- */
function getOpenAIKey() {
  if (!settings?.openaiKeyEnc) return null;
  if (openAIKeyCacheReady) return cachedOpenAIKey;
  try {
    cachedOpenAIKey = safeStorage.decryptString(Buffer.from(settings.openaiKeyEnc, "base64"));
    openAIKeyCacheReady = true;
    return cachedOpenAIKey;
  } catch {
    return null;
  }
}

async function transcribeWithOpenAI(audio) {
  const key = getOpenAIKey();
  if (!key || !audio?.byteLength) throw new Error("OpenAI-Key oder Audio fehlt");
  if (audio.byteLength > 24_000_000) throw new Error("Die Aufnahme ist zu groß. Bitte lange Aufnahmen über den Datei-Upload transkribieren.");

  const form = new FormData();
  form.append("model", "gpt-transcribe");
  form.append("file", new Blob([audio], { type: "audio/wav" }), "dictation.wav");
  form.append(
    "prompt",
    `Personal dictation in ${settings.lang === "en" ? "English" : "German"}, sometimes containing English product names and technical terms. Preserve the spoken language and intended wording. The user's context is: ${settings.context}.`
  );
  for (const keyword of ["OpenAI", "ChatGPT", "Claude", "Make", "n8n", "HubSpot", "Supabase", "Next.js", "Wispr Flow", "Klartext", "Sigill"]) {
    form.append("keywords[]", keyword);
  }
  form.append("languages[]", settings.lang || "de");
  if ((settings.lang || "de") === "de") form.append("languages[]", "en");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI ${response.status}: ${detail}`);
  }
  const result = await response.json();
  if (!result?.text?.trim()) throw new Error("Leere Transkription");
  return result.text.trim();
}

const REFINEMENT_INSTRUCTIONS = `Du überarbeitest ein automatisch erzeugtes Diktat sehr vorsichtig.
Erhalte Inhalt, Sprache, Ton, Wortwahl, Namen und Fachbegriffe vollständig.
Korrigiere ausschließlich Interpunktion, Groß- und Kleinschreibung, offensichtliche Grammatikfehler, Füllwörter, unbeabsichtigte Wortwiederholungen und klare Selbstkorrekturen.
Formuliere keine Aussagen um, fasse nichts zusammen und ergänze keine Informationen.
Gib ausschließlich den fertigen Text zurück.`;

async function refineWithOpenAI(text) {
  const key = getOpenAIKey();
  if (!key || !text.trim()) return text.trim();
  // Im Fehlerfall bleibt die volle Transkription erhalten, niemals ein gekürztes Ergebnis.
  if (text.length > 24_000) throw new Error("Text-Feinschliff übersprungen: zu langer Text");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      instructions: REFINEMENT_INSTRUCTIONS,
      input: text.trim(),
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
      max_output_tokens: Math.min(16000, Math.max(512, Math.ceil(text.length / 2))),
      store: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`OpenAI refinement ${response.status}`);
  const payload = await response.json();
  if (payload.status !== "completed") throw new Error("Unvollständiger Text-Feinschliff");
  const output = payload.output_text?.trim() || (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!output) throw new Error("Leerer Text-Feinschliff");
  return output;
}

function canonicalizeTerms(text) {
  return text.replace(/\bSigil\b/gi, "Sigill");
}

/* ---------- Ergebnis: kopieren + an Cursor-Position einfügen ---------- */
ipcMain.on("result", async (_e, value) => {
  if (_e.sender !== pill?.webContents || !processing) return;
  const payload = typeof value === "string" ? { text: value, audio: null } : value || {};
  let finalText = canonicalizeTerms((payload.text || "").trim());

  if (settings.mode === "quality" && payload.audio?.byteLength && getOpenAIKey()) {
    try {
      pill?.webContents.send("processing-start");
      finalText = canonicalizeTerms(await transcribeWithOpenAI(payload.audio));
      try {
        pill?.webContents.send("refining-start");
        finalText = canonicalizeTerms(await refineWithOpenAI(finalText));
      } catch (refinementError) {
        logError("Text-Feinschliff fehlgeschlagen, Transkription wird beibehalten", refinementError);
      }
    } catch (err) {
      logError("Cloud-Transkription fehlgeschlagen", err);
      if (Notification.isSupported()) {
        new Notification({
          title: "Klartext konnte nicht transkribieren",
          body: payload.audio.byteLength > 24_000_000
            ? "Die Aufnahme war zu lang. Für lange Aufnahmen nutze bitte den Datei-Upload."
            : "Bitte prüfe deinen OpenAI API-Key und deine Internetverbindung.",
        }).show();
      }
    }
  }

  // Der reservierte Endbefehl gehört nie in das Ergebnis. Die Bereinigung ist
  // absichtlich nur am Textende aktiv, damit Erwähnungen mitten im Diktat
  // erhalten bleiben. Sie greift auch, falls Stille und Wake-Word fast
  // gleichzeitig eintreffen und der Stille-Grund zuerst übermittelt wird.
  finalText = stripTrailingStopCommand(finalText);

  if (!finalText) {
    processing = false;
    updateTray();
    pill?.hide();
    return;
  }
  pill?.hide();
  clipboard.writeText(finalText);

  const pasteAccess = getCurrentPasteAccess();
  if (!pasteAccess.canPaste) {
    processing = false;
    updateTray();
    logError("Automatisches Einfügen ist nicht freigegeben; Text wurde kopiert");
    if (Notification.isSupported()) {
      new Notification({
        title: "Text wurde kopiert",
        body: "Für automatisches Einfügen Klartext einmal neu unter Bedienungshilfen freigeben.",
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
    execFile(
      "osascript",
      ["-e", 'tell application "System Events" to keystroke "v" using command down'],
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

function openKeyWindow() {
  if (keyWin) {
    keyWin.focus();
    return;
  }
  keyWin = new BrowserWindow({
    width: 540,
    height: 390,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Klartext – Beste Qualität",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  keyWin.loadFile("keywin.html");
  keyWin.on("closed", () => (keyWin = null));
}

ipcMain.on("save-api-key", (_e, key) => {
  if (_e.sender !== keyWin?.webContents || typeof key !== "string" || key.length > 4096) return;
  const trimmed = key.trim();
  if (trimmed && safeStorage.isEncryptionAvailable()) {
    settings.openaiKeyEnc = safeStorage.encryptString(trimmed).toString("base64");
    cachedOpenAIKey = trimmed;
    openAIKeyCacheReady = true;
  } else {
    settings.openaiKeyEnc = null;
    cachedOpenAIKey = null;
    openAIKeyCacheReady = false;
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
    lang: settings.lang, mode: settings.mode, model: settings.model,
    context: settings.context, theme: settings.theme || "system",
    voiceActivation: settings.voiceActivation, hasKey: Boolean(settings.openaiKeyEnc),
    login: SMOKE_TEST ? { supported: false, enabled: false, detail: "In der isolierten Vorschau deaktiviert." } : loginState, wakeModelsAvailable, wakeStatus, microphone,
    pasteDetail: IS_MAC ? (paste.canPaste ? "Bedienungshilfen sind freigegeben." : "Bedienungshilfen bitte in macOS freigeben.") : "Einfügen per Tastatursimulation. Einzelne Apps können es einschränken.",
    platform: process.platform, shortcut: HOTKEY_LABEL, version: app.getVersion(),
    busy: recording || processing || starting, preview: SMOKE_TEST,
  };
}
function syncSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("settings-changed", settingsSnapshot());
}
function openSettingsWindow() {
  if (!settings) return;
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show(); settingsWin.focus(); return;
  }
  settingsWin = new BrowserWindow({
    width: 850, height: 700, minWidth: 690, minHeight: 590,
    title: "Klartext · Einstellungen", backgroundColor: nativeTheme.shouldUseDarkColors ? "#151b27" : "#fbfcfe",
    show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "settings-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWin.webContents.on("will-navigate", event => event.preventDefault());
  settingsWin.once("ready-to-show", () => settingsWin?.show());
  settingsWin.on("focus", syncSettingsWindow);
  settingsWin.on("closed", () => { settingsWin = null; if (SETTINGS_PREVIEW && !isQuitting) quitApp(); });
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
}
function requireSettingsSender(event) {
  if (!settingsWin || event.sender !== settingsWin.webContents || event.senderFrame !== settingsWin.webContents.mainFrame) throw new Error("Ungültiges Einstellungsfenster.");
}
ipcMain.handle("settings-read", event => {
  requireSettingsSender(event);
  const snapshot = settingsSnapshot();
  if (SETTINGS_SMOKE) setTimeout(() => { console.log("SETTINGS_SMOKE_OK: settings renderer connected, isolated profile, no microphone or login registration"); quitApp(); }, 300);
  return snapshot;
});
ipcMain.handle("settings-update", async (event, input) => {
  requireSettingsSender(event);
  const patch = validateSettingsPatch(input);
  if ((recording || processing || starting) && Object.keys(patch).some(key => key !== "theme")) throw new Error("Bitte warte, bis das Diktat abgeschlossen ist.");
  if (SMOKE_TEST && (Object.hasOwn(patch, "launchAtLogin") || Object.hasOwn(patch, "voiceActivation"))) throw new Error("In der isolierten Vorschau nicht verfügbar.");
  if (patch.voiceActivation && !wakeModelsAvailable) throw new Error("Bitte zuerst den persönlichen Startbefehl einrichten.");
  const next = { ...settings, ...patch };
  fs.writeFileSync(settingsPath(), JSON.stringify(next));
  const previous = settings;
  settings = next;
  if (Object.hasOwn(patch, "theme")) nativeTheme.themeSource = settings.theme;
  if (Object.hasOwn(patch, "launchAtLogin")) loginState = configureLogin(app, settings, process.platform, process.execPath, true);
  if (previous.mode !== settings.mode || previous.model !== settings.model) prepareSelectedMode();
  if (previous.voiceActivation !== settings.voiceActivation) await refreshWakeActivation();
  updateTray();
  return settingsSnapshot();
});
ipcMain.handle("settings-action", async (event, action) => {
  requireSettingsSender(event);
  if (["key", "voice-setup"].includes(action) && (recording || processing || starting)) throw new Error("Bitte warte, bis das Diktat abgeschlossen ist.");
  if (SMOKE_TEST && !["refresh", "key"].includes(action)) throw new Error("Systemaktionen sind in der isolierten Vorschau deaktiviert.");
  switch (action) {
    case "key": openKeyWindow(); break;
    case "voice-setup": openWakeSetupWindow(); break;
    case "microphone":
      await shell.openExternal(IS_MAC ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone" : IS_WIN ? "ms-settings:privacy-microphone" : "https://klartext-ai.vercel.app"); break;
    case "accessibility": if (IS_MAC) await shell.openExternal(ACCESSIBILITY_SETTINGS_URL); break;
    case "logs": shell.showItemInFolder(logPath); break;
    case "refresh": break;
    default: throw new Error("Unbekannte Aktion.");
  }
  return settingsSnapshot();
});
nativeTheme.on("updated", syncSettingsWindow);

/* ---------- Persönlicher Startbefehl und Hintergrundlistener ---------- */
let wakeSetupWin = null;

const wakeModelDir = () => path.join(app.getPath("userData"), "wake-models");

function openWakeSetupWindow() {
  if (wakeSetupWin) {
    wakeSetupWin.focus();
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
    title: "Klartext – Sprachaktivierung",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  wakeSetupWin.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "microphone");
  });
  wakeSetupWin.loadFile("wakekey.html");
  wakeSetupWin.on("closed", () => {
    wakeSetupWin = null;
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
    },
  });
  wakeWin.setIgnoreMouseEvents(true);
  wakeWin.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "microphone");
  });
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
        wakeStatus = { state: "error", detail: "Mikrofonzugriff für Klartext erlauben" };
        updateTray();
        return;
      }
    }
  }
  wakeStatus = { state: "preparing", detail: "Hey Klartext wird vorbereitet …" };
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
  pendingWakeConfig = { enabled: true, keywords, wasmBase64 };
  createWakeWindow();
  if (wakeReady) wakeWin.webContents.send("wake-configure", pendingWakeConfig);
}

ipcMain.handle("save-wake-models", async (event, models) => {
  if (event.sender !== wakeSetupWin?.webContents) return { ok: false, error: "Ungültiges Fenster" };
  try {
    await saveEnrolledWakeModels({ fsPromises: fs.promises, modelDir: wakeModelDir(), models });
    wakeModelsAvailable = true;
    settings.voiceActivation = true;
    saveSettings(settings);
    await refreshWakeActivation();
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
  if (event.sender !== pill?.webContents || !recording) return;
  logError("Aufnahmeende durch bestätigte Stille");
  stopRecording("silence");
});

ipcMain.on("pill-error", (_e, message) => {
  if (_e.sender !== pill?.webContents) return;
  logError("Aufnahmefehler", message);
  pill?.hide();
  recording = false;
  processing = false;
  setWakeRecordingState(false);
  globalShortcut.unregister("Escape");
  updateTray();
  if (Notification.isSupported()) {
    new Notification({
      title: "Klartext konnte nicht aufnehmen",
      body: String(message || "Bitte prüfe Mikrofon und Audioeinstellungen.").slice(0, 240),
    }).show();
  }
});

function prepareSelectedMode() {
  if (SMOKE_TEST || !pillReady || recording || processing) return;
  preparation = settings.mode === "local" ? "Lokales Modell wird vorbereitet …" : "Qualitätsmodus bereit";
  pill.webContents.send("prepare", { mode: settings.mode, model: settings.model });
  updateTray();
}

ipcMain.on("renderer-ready", (event) => {
  if (event.sender !== pill?.webContents) return;
  pillReady = true;
  if (SMOKE_TEST) {
    if (SETTINGS_PREVIEW || SETTINGS_SMOKE) { openSettingsWindow(); return; }
    console.log("SMOKE_OK: renderer ready, no microphone or login registration");
    quitApp();
    return;
  }
  prepareSelectedMode();
});

ipcMain.on("prepared", (event, result) => {
  if (event.sender !== pill?.webContents || result.mode !== settings.mode || result.model !== settings.model) return;
  preparation = result.ok
    ? settings.mode === "local" ? "Lokales Modell bereit" : "Qualitätsmodus bereit"
    : "Lokales Modell: Vorbereitung fehlgeschlagen, erneuter Versuch beim Diktat";
  updateTray();
});

/* ---------- Tray (Menüleiste) ---------- */
function updateTray() {
  syncSettingsWindow();
  if (!tray) return;
  const pasteAccess = getCurrentPasteAccess();
  if (IS_MAC) tray.setTitle(recording ? " ●" : processing ? " ···" : "");
  const langItems = [
    ["Deutsch", "de"],
    ["English", "en"],
    ["Automatisch erkennen", ""],
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
    ["Genau (empfohlen, ~250 MB)", "genau"],
    ["Schnell (~80 MB)", "schnell"],
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
    ["Beste Qualität (OpenAI)", "quality"],
    ["Lokal und offline", "local"],
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
      { label: "Einstellungen …", accelerator: "CommandOrControl+,", click: openSettingsWindow },
      { type: "separator" },
      {
        label: processing ? "Text wird verarbeitet …" : recording ? "Aufnahme beenden" : "Diktieren",
        enabled: pillReady && !processing && !starting,
        accelerator: HOTKEY,
        click: toggleRecording,
      },
      { type: "separator" },
      { label: preparation, enabled: false },
      { label: "Sprache", submenu: langItems, enabled: !recording && !processing },
      { label: "Transkription", submenu: modeItems, enabled: !recording && !processing },
      ...(settings.mode === "local" ? [{ label: "Lokales Modell", submenu: modelItems, enabled: !recording && !processing }] : []),
      { type: "separator" },
      {
        label: settings.openaiKeyEnc
          ? "Beste Qualität: bereit ✓"
          : "Beste Qualität: API-Key fehlt",
        enabled: false,
      },
      { label: "OpenAI API-Key eintragen …", enabled: !recording && !processing, click: openKeyWindow },
      ...(settings.openaiKeyEnc
        ? [
            {
              label: "API-Key entfernen",
              enabled: !recording && !processing,
              click: () => {
                settings.openaiKeyEnc = null;
                cachedOpenAIKey = null;
                openAIKeyCacheReady = false;
                saveSettings(settings);
                updateTray();
              },
            },
          ]
        : []),
      { type: "separator" },
      {
        label: "Sprachaktivierung: „Hey Klartext“",
        type: "checkbox",
        checked: Boolean(settings.voiceActivation && wakeModelsAvailable),
        enabled: !recording && !processing,
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
          ? wakeStatus.detail
          : wakeModelsAvailable ? "Sprachaktivierung ist ausgeschaltet" : "Persönlicher Startbefehl fehlt",
        enabled: false,
      },
      {
        label: `Ende: 9 Sekunden Stille oder ${HOTKEY_LABEL}`,
        enabled: false,
      },
      {
        label: wakeModelsAvailable ? "Startbefehl neu einlernen …" : "Startbefehl einrichten …",
        enabled: !recording && !processing,
        click: openWakeSetupWindow,
      },
      ...(wakeModelsAvailable
        ? [
            {
              label: "Persönliche Sprachmodelle entfernen",
              enabled: !recording && !processing,
              click: async () => {
                try {
                  await removeEnrolledWakeModels({ fsPromises: fs.promises, modelDir: wakeModelDir() });
                  wakeModelsAvailable = false;
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
        label: "Bei der Anmeldung starten",
        type: "checkbox",
        checked: loginState.enabled,
        enabled: loginState.supported,
        click: (item) => {
          settings.launchAtLogin = item.checked;
          loginState = configureLogin(app, settings, process.platform, process.execPath, true);
          saveSettings(settings);
          updateTray();
        },
      },
      { label: loginState.detail, enabled: false },
      ...(IS_MAC ? [{ label: "Anmeldeobjekte in macOS öffnen", click: () => shell.openExternal("x-apple.systempreferences:com.apple.LoginItems-Settings.extension") }] : []),
      {
        label: "Diagnoseprotokoll anzeigen",
        click: () => {
          logError("Diagnoseprotokoll geöffnet");
          shell.showItemInFolder(logPath);
        },
      },
      { type: "separator" },
      { label: "Klartext Web-App öffnen", click: () => shell.openExternal(WEB_URL) },
      ...(IS_MAC
        ? [
            {
              label: pasteAccess.canPaste
                ? "Automatisches Einfügen: bereit ✓"
                : "Automatisches Einfügen: Freigabe erneuern",
              enabled: false,
            },
            {
              label: "Bedienungshilfen in macOS öffnen",
              click: () => shell.openExternal(ACCESSIBILITY_SETTINGS_URL),
            },
          ]
        : []),
      { type: "separator" },
      { label: "Klartext beenden", click: quitApp },
    ])
  );
  tray.setToolTip(`Klartext – ${HOTKEY_LABEL} zum Diktieren`);
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
  if (!IS_MAC) tray.setTitle("Klartext"); // no-op auf Windows, Fallback auf Linux
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
  nativeTheme.themeSource = ["system", "light", "dark"].includes(settings.theme) ? settings.theme : "system";
  logError("Klartext-App gestartet", `Version ${app.getVersion()}`);
  if (!SMOKE_TEST) {
    loginState = configureLogin(app, settings, process.platform, process.execPath);
    saveSettings(settings);
  }
  if (process.platform === "darwin") app.dock?.hide();

  createPill();
  createTray();

  const ok = SMOKE_TEST || globalShortcut.register(HOTKEY, toggleRecording);
  if (!ok) {
    preparation = `Shortcut ${HOTKEY_LABEL} ist bereits belegt`;
    logError(`Globaler Shortcut ${HOTKEY} konnte nicht registriert werden`);
    updateTray();
    if (Notification.isSupported()) {
      new Notification({
        title: "Klartext-Shortcut ist bereits belegt",
        body: `${HOTKEY_LABEL} wird von einer anderen App verwendet. Diktieren bleibt über das Klartext-Menü möglich.`,
      }).show();
    }
  }

  if (SMOKE_TEST) {
    if (!SETTINGS_PREVIEW) setTimeout(() => { logError("SMOKE_TIMEOUT"); quitApp(); }, 15_000).unref();
    return;
  }
  try {
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
app.on("will-quit", () => globalShortcut.unregisterAll());
