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
} = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { configureLogin } = require("./startup");

const WEB_URL = "https://klartext-adapt-learn.vercel.app";
const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";
// macOS: ⌥+Leertaste. Windows/Linux: Strg+Umschalt+Leertaste
// (Alt+Space öffnet unter Windows das System-Fenstermenü, daher anders).
const HOTKEY = IS_MAC ? "Alt+Space" : "Control+Shift+Space";
const HOTKEY_LABEL = IS_MAC ? "⌥ + Leertaste" : "Strg + Umschalt + Leertaste";
const SMOKE_TEST = process.argv.includes("--smoke-test");

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

// Nur eine Instanz zulassen. Ohne das startet jeder Aufruf eine neue Kopie
// (mehrfach im Task-Manager, „(2)“/„(3)“, jeweils eigener RAM-Verbrauch).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
app.on("second-instance", () => {
  // Zweiter Start: vorhandene Instanz zeigt ihr Menü, statt sich zu verdoppeln.
  if (tray) tray.popUpContextMenu();
});

/* ---------- Einstellungen (userData/settings.json) ---------- */
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

const SETTINGS_DEFAULTS = {
  lang: "de", // "de" | "en" | "" (= automatisch)
  mode: "quality", // "quality" (gpt-transcribe) | "local" (Whisper)
  model: "genau", // "genau" (whisper-small) | "schnell" (whisper-base)
  launchAtLogin: true,
  openaiKeyEnc: null, // verschlüsselt über Schlüsselbund / Credential Vault
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
async function startRecording() {
  if (recording || starting || processing || !pill || !pillReady) return;
  if (settings.mode === "quality" && !getOpenAIKey()) {
    openKeyWindow();
    return;
  }
  starting = true;
  updateTray();
  try {
    // Erst auf ausdrücklichen Aufnahme-Start Berechtigungen anfragen, nie beim Login.
    if (IS_MAC) {
      const allowed = await systemPreferences.askForMediaAccess("microphone");
      if (!allowed) return;
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  } catch (error) {
    console.error("Mikrofonberechtigung konnte nicht geprüft werden:", error?.message);
    return;
  } finally {
    starting = false;
    updateTray();
  }
  recording = true;
  positionPill();
  pill.showInactive(); // anzeigen ohne Fokus zu übernehmen
  pill.webContents.send("start", {
    lang: settings.lang,
    mode: settings.mode,
    model: settings.model,
    hasOpenAIKey: Boolean(getOpenAIKey()),
  });
  globalShortcut.register("Escape", cancelRecording);
  updateTray();
}

function stopRecording() {
  if (!recording || !pill) return;
  recording = false;
  processing = true;
  pill.webContents.send("stop"); // Renderer transkribiert und meldet "result"
  globalShortcut.unregister("Escape");
  updateTray();
}

function cancelRecording() {
  if (!pill || processing) return;
  recording = false;
  pill.webContents.send("cancel");
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
  try {
    return safeStorage.decryptString(Buffer.from(settings.openaiKeyEnc, "base64"));
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
        console.error("Text-Feinschliff fehlgeschlagen, Transkription wird beibehalten:", refinementError?.message);
      }
    } catch (err) {
      console.error("Cloud-Transkription fehlgeschlagen:", err?.message);
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

  if (!finalText) {
    processing = false;
    updateTray();
    pill?.hide();
    return;
  }
  pill?.hide();
  clipboard.writeText(finalText);
  const onErr = (err) => {
    processing = false;
    updateTray();
    if (err) {
      console.error(
        "Einfügen fehlgeschlagen, der Text liegt in der Zwischenablage:",
        err.message
      );
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
    width: 480,
    height: 300,
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
  const trimmed = (key || "").trim();
  if (trimmed && safeStorage.isEncryptionAvailable()) {
    settings.openaiKeyEnc = safeStorage.encryptString(trimmed).toString("base64");
  } else {
    settings.openaiKeyEnc = null;
  }
  saveSettings(settings);
  keyWin?.close();
  updateTray();
});

ipcMain.on("close-key-window", () => keyWin?.close());

ipcMain.on("pill-error", (_e, message) => {
  console.error("Pill-Fehler:", message);
  pill?.hide();
  recording = false;
  processing = false;
  globalShortcut.unregister("Escape");
  updateTray();
});

function prepareSelectedMode() {
  if (!pillReady || recording || processing) return;
  preparation = settings.mode === "local" ? "Lokales Modell wird vorbereitet …" : "Qualitätsmodus bereit";
  pill.webContents.send("prepare", { mode: settings.mode, model: settings.model });
  updateTray();
}

ipcMain.on("renderer-ready", (event) => {
  if (event.sender !== pill?.webContents) return;
  pillReady = true;
  if (SMOKE_TEST) {
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
  if (!tray) return;
  if (IS_MAC) tray.setTitle(recording ? " 🔴" : " 🎙️");
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
        label: getOpenAIKey()
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
                saveSettings(settings);
                updateTray();
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
      { type: "separator" },
      { label: "Klartext Web-App öffnen", click: () => shell.openExternal(WEB_URL) },
      ...(IS_MAC
        ? [
            {
              label: "Berechtigung fürs Einfügen prüfen",
              click: () => {
                // Öffnet ggf. den macOS-Dialog für Bedienungshilfen
                systemPreferences.isTrustedAccessibilityClient(true);
              },
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
  // macOS zeigt einen Emoji-Titel; Windows/Linux brauchen ein echtes Icon
  let img = nativeImage.createEmpty();
  if (!IS_MAC) {
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
    keyWin?.destroy();
  } catch {
    /* egal */
  }
  try {
    tray?.destroy();
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
  if (!SMOKE_TEST) {
    loginState = configureLogin(app, settings, process.platform, process.execPath);
    saveSettings(settings);
  }
  if (process.platform === "darwin") app.dock?.hide();

  createPill();
  createTray();

  const ok = globalShortcut.register(HOTKEY, toggleRecording);
  if (!ok) console.error(`Globaler Shortcut ${HOTKEY} konnte nicht registriert werden.`);

  if (SMOKE_TEST) {
    setTimeout(() => { console.error("SMOKE_TIMEOUT"); quitApp(); }, 15_000).unref();
    return;
  }
});

app.on("window-all-closed", (e) => {
  // Menüleisten-/Tray-App bleibt im Hintergrund aktiv, außer beim echten Beenden.
  if (!isQuitting) e.preventDefault();
});
app.on("will-quit", () => globalShortcut.unregisterAll());
