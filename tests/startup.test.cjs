const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { configureLogin } = require("../desktop/startup");

function mockApp(state = { openAtLogin: true }) {
  const calls = [];
  let reads = 0;
  return {
    isPackaged: true,
    calls,
    get reads() { return reads; },
    setLoginItemSettings: (value) => calls.push(value),
    getLoginItemSettings: () => { reads += 1; return state; },
  };
}

test("Entwicklungs-App und DMG werden nicht als Autostart registriert", () => {
  const app = mockApp();
  app.isPackaged = false;
  assert.equal(configureLogin(app, {}, "darwin", "/dev/Electron").supported, false);
  app.isPackaged = true;
  assert.equal(configureLogin(app, {}, "darwin", "/Volumes/Nivune/Nivune.app").supported, false);
  assert.equal(app.calls.length, 0);
});

test("Installierte App aktiviert Autostart auf Mac und Windows standardmäßig", () => {
  for (const platform of ["darwin", "win32"]) {
    const app = mockApp();
    const settings = {};
    assert.equal(configureLogin(app, settings, platform, "/installed/Nivune").enabled, true);
    assert.deepEqual(app.calls, [{ openAtLogin: true }]);
    assert.equal(settings.loginConfiguredPath, "/installed/Nivune");
  }
});

test("Normaler Start fragt den potenziell blockierenden Systemstatus nicht ab", () => {
  const app = mockApp({ openAtLogin: false });
  assert.equal(configureLogin(app, { launchAtLogin: true, loginConfiguredPath: "/app" }, "win32", "/app").enabled, true);
  assert.equal(app.calls.length, 0);
  assert.equal(app.reads, 0);
});

test("Expliziter Ausschalter entfernt Autostart", () => {
  const app = mockApp({ openAtLogin: false });
  configureLogin(app, { launchAtLogin: false }, "darwin", "/app", true);
  assert.deepEqual(app.calls, [{ openAtLogin: false }]);
});

test("macOS-Freigabe und Windows-Blockierung werden ehrlich angezeigt", () => {
  assert.match(configureLogin(mockApp({ openAtLogin: false, status: "requires-approval" }), {}, "darwin", "/app", true).detail, /freigeben/);
  assert.equal(configureLogin(mockApp({ openAtLogin: true, executableWillLaunchAtLogin: false }), {}, "win32", "/app", true).enabled, false);
});

test("Tray-Aufbau entschlüsselt den API-Key nicht und blockiert den Listener-Start nicht", () => {
  const source = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const traySection = source.slice(source.indexOf("function updateTray()"), source.indexOf("function createTray()"));
  assert.doesNotMatch(traySection, /getOpenAIKey\(\)|getProviderKey\(/);
  assert.match(traySection, /encryptedCredential\(settings\.transcriptionProvider\)/);
});

test("Web-App setzt Sicherheitsheader und lädt die Theme-Initialisierung als lokale Datei", () => {
  const config = fs.readFileSync(path.join(__dirname, "../next.config.ts"), "utf8");
  for (const header of [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) assert.match(config, new RegExp(header));
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /microphone=\(self\)/);

  const layout = fs.readFileSync(path.join(__dirname, "../components/site/RootDocument.tsx"), "utf8");
  assert.match(layout, /script src="\/theme-init\.js"/);
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML/);
  assert.equal(fs.existsSync(path.join(__dirname, "../public/theme-init.js")), true);
});
