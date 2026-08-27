const { test } = require("node:test");
const assert = require("node:assert/strict");
const { configureLogin } = require("../desktop/startup");

function mockApp(state = { openAtLogin: true }) {
  const calls = [];
  return { isPackaged: true, calls, setLoginItemSettings: (value) => calls.push(value), getLoginItemSettings: () => state };
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

test("Systemseitig deaktivierter Autostart wird beim nächsten Start respektiert", () => {
  const app = mockApp({ openAtLogin: false });
  assert.equal(configureLogin(app, { launchAtLogin: true, loginConfiguredPath: "/app" }, "win32", "/app").enabled, false);
  assert.equal(app.calls.length, 0);
});

test("Expliziter Ausschalter entfernt Autostart", () => {
  const app = mockApp({ openAtLogin: false });
  configureLogin(app, { launchAtLogin: false }, "darwin", "/app", true);
  assert.deepEqual(app.calls, [{ openAtLogin: false }]);
});

test("macOS-Freigabe und Windows-Blockierung werden ehrlich angezeigt", () => {
  assert.match(configureLogin(mockApp({ openAtLogin: false, status: "requires-approval" }), {}, "darwin", "/app").detail, /freigeben/);
  assert.equal(configureLogin(mockApp({ openAtLogin: true, executableWillLaunchAtLogin: false }), {}, "win32", "/app").enabled, false);
});
