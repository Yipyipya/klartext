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
} = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { Anthropic } = require("@anthropic-ai/sdk");

const WEB_URL = "https://klartext-adapt-learn.vercel.app";
const HOTKEY = "Alt+Space"; // ⌥ + Leertaste, in jeder App
const SMOKE_TEST = process.argv.includes("--smoke-test");

const PILL_W = 520;
const PILL_H = 210; // Platz für die Live-Mitschrift über der Pill

let pill = null;
let tray = null;
let recording = false;

/* ---------- Einstellungen (userData/settings.json) ---------- */
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

const SETTINGS_DEFAULTS = {
  lang: "de", // "de" | "en" | "" (= automatisch)
  model: "genau", // "genau" (whisper-small) | "schnell" (whisper-base)
  apiKeyEnc: null, // Claude-API-Key, verschlüsselt über den macOS-Schlüsselbund
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
function startRecording() {
  if (recording || !pill) return;
  recording = true;
  positionPill();
  pill.showInactive(); // anzeigen ohne Fokus zu übernehmen
  pill.webContents.send("start", settings);
  globalShortcut.register("Escape", cancelRecording);
  updateTray();
}

function stopRecording() {
  if (!recording || !pill) return;
  recording = false;
  pill.webContents.send("stop"); // Renderer transkribiert und meldet "result"
  globalShortcut.unregister("Escape");
  updateTray();
}

function cancelRecording() {
  if (!pill) return;
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

/* ---------- Claude-Feinschliff (optional, eigener API-Key) ---------- */
const POLISH_MODEL = "claude-opus-4-8";
const POLISH_SYSTEM = `Du korrigierst Diktat-Transkripte aus einer Spracherkennung.
- Korrigiere falsch erkannte Wörter anhand des Kontexts (z. B. "umslappt" → "ob's klappt").
- Entferne Füllwörter, Versprecher und unbeabsichtigte Wiederholungen.
- Setze sinnvolle Interpunktion, Groß-/Kleinschreibung und Absätze.
- Ändere weder Inhalt noch Ton noch Sprache. Fasse nichts zusammen, lasse nichts weg.
- Antworte AUSSCHLIESSLICH mit dem korrigierten Text, ohne Kommentar oder Einleitung.`;

function getApiKey() {
  if (!settings?.apiKeyEnc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(settings.apiKeyEnc, "base64"));
  } catch {
    return null;
  }
}

async function polishText(text) {
  const key = getApiKey();
  if (!key) return text;
  try {
    pill?.webContents.send("polish-start");
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: POLISH_MODEL,
      max_tokens: 16000,
      system: POLISH_SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const block = response.content.find((b) => b.type === "text");
    return (block && block.text.trim()) || text;
  } catch (err) {
    console.error("Feinschliff fehlgeschlagen – lokale Version wird genutzt:", err?.message);
    return text;
  }
}

/* ---------- Ergebnis: kopieren + an Cursor-Position einfügen ---------- */
ipcMain.on("result", async (_e, text) => {
  if (!text || !text.trim()) {
    pill?.hide();
    return;
  }
  const finalText = await polishText(text.trim());
  pill?.hide();
  clipboard.writeText(finalText);
  if (process.platform === "darwin") {
    // Braucht Bedienungshilfen-Berechtigung (Systemeinstellungen → Datenschutz)
    execFile("osascript", [
      "-e",
      'tell application "System Events" to keystroke "v" using command down',
    ], (err) => {
      if (err) console.error("Einfügen fehlgeschlagen – Text liegt in der Zwischenablage:", err.message);
    });
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
    title: "Klartext – Claude-Feinschliff",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  keyWin.loadFile("keywin.html");
  keyWin.on("closed", () => (keyWin = null));
}

ipcMain.on("save-api-key", (_e, key) => {
  const trimmed = (key || "").trim();
  if (trimmed && safeStorage.isEncryptionAvailable()) {
    settings.apiKeyEnc = safeStorage.encryptString(trimmed).toString("base64");
  } else {
    settings.apiKeyEnc = null;
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
  updateTray();
});

/* ---------- Tray (Menüleiste) ---------- */
function updateTray() {
  if (!tray) return;
  tray.setTitle(recording ? "🔴" : "🎙️");
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
      updateTray();
    },
  }));

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: recording ? "Aufnahme beenden" : "Diktieren",
        accelerator: HOTKEY,
        click: toggleRecording,
      },
      { type: "separator" },
      { label: "Sprache", submenu: langItems },
      { label: "Genauigkeit", submenu: modelItems },
      { type: "separator" },
      {
        label: getApiKey()
          ? "Claude-Feinschliff: aktiv ✓"
          : "Claude-Feinschliff: aus",
        enabled: false,
      },
      { label: "API-Key eintragen …", click: openKeyWindow },
      ...(settings.apiKeyEnc
        ? [
            {
              label: "API-Key entfernen",
              click: () => {
                settings.apiKeyEnc = null;
                saveSettings(settings);
                updateTray();
              },
            },
          ]
        : []),
      { type: "separator" },
      { label: "Klartext Web-App öffnen", click: () => shell.openExternal(WEB_URL) },
      {
        label: "Berechtigung fürs Einfügen prüfen",
        click: () => {
          // Öffnet ggf. den macOS-Dialog für Bedienungshilfen
          systemPreferences.isTrustedAccessibilityClient(true);
        },
      },
      { type: "separator" },
      { label: "Beenden", role: "quit" },
    ])
  );
  tray.setToolTip(`Klartext – ${HOTKEY.replace("Alt", "⌥").replace("Space", "Leertaste")} zum Diktieren`);
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  updateTray();
}

/* ---------- App-Start ---------- */
app.whenReady().then(async () => {
  settings = loadSettings();
  if (process.platform === "darwin") app.dock?.hide();

  createPill();
  createTray();

  const ok = globalShortcut.register(HOTKEY, toggleRecording);
  if (!ok) console.error(`Globaler Shortcut ${HOTKEY} konnte nicht registriert werden.`);

  if (SMOKE_TEST) {
    console.log("SMOKE_OK");
    app.quit();
    return;
  }

  if (process.platform === "darwin") {
    // Mikrofon-Berechtigung früh anfragen, Bedienungshilfen-Status prüfen (öffnet ggf. Dialog)
    systemPreferences.askForMediaAccess("microphone").catch(() => {});
    systemPreferences.isTrustedAccessibilityClient(true);
  }
});

app.on("window-all-closed", (e) => e.preventDefault()); // Menüleisten-App bleibt aktiv
app.on("will-quit", () => globalShortcut.unregisterAll());
