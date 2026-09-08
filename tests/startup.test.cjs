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
  assert.equal(configureLogin(app, {}, "darwin", "/Volumes/Klartext/Klartext.app").supported, false);
  assert.equal(app.calls.length, 0);
});

test("Installierte App aktiviert Autostart auf Mac und Windows standardmäßig", () => {
  for (const platform of ["darwin", "win32"]) {
    const app = mockApp();
    const settings = {};
    assert.equal(configureLogin(app, settings, platform, "/installed/Klartext").enabled, true);
    assert.deepEqual(app.calls, [{ openAtLogin: true }]);
    assert.equal(settings.loginConfiguredPath, "/installed/Klartext");
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
  assert.doesNotMatch(traySection, /getOpenAIKey\(\)/);
  assert.match(traySection, /settings\.openaiKeyEnc/);
});
