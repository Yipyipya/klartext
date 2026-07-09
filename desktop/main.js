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
  shell,
  nativeImage,
} = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const WEB_URL = "https://klartext-adapt-learn.vercel.app";
const HOTKEY = "Alt+Space"; // ⌥ + Leertaste, in jeder App
const SMOKE_TEST = process.argv.includes("--smoke-test");

const PILL_W = 380;
const PILL_H = 88;

let pill = null;
let tray = null;
let recording = false;

/* ---------- Einstellungen (userData/settings.json) ---------- */
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

function loadSettings() {
  try {
    return { lang: "de", ...JSON.parse(fs.readFileSync(settingsPath(), "utf8")) };
  } catch {
    return { lang: "de" }; // "de" | "en" | "" (= automatisch)
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

/* ---------- Ergebnis: kopieren + an Cursor-Position einfügen ---------- */
ipcMain.on("result", (_e, text) => {
  pill?.hide();
  if (!text || !text.trim()) return;
  clipboard.writeText(text.trim());
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

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: recording ? "Aufnahme beenden" : "Diktieren",
        accelerator: HOTKEY,
        click: toggleRecording,
      },
      { type: "separator" },
      { label: "Sprache", submenu: langItems },
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
