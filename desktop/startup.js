// Keine Registrierung der Entwicklungsumgebung oder eines Builds im DMG.
function configureLogin(app, settings, platform, executable, force = false) {
  if (!app.isPackaged || !["darwin", "win32"].includes(platform)) return { supported: false, enabled: false, detail: "Autostart: nur in der installierten App" };
  if (platform === "darwin" && (executable.startsWith("/Volumes/") || executable.includes("/AppTranslocation/"))) {
    return { supported: false, enabled: false, detail: "Autostart: zuerst nach Programme verschieben" };
  }
  try {
    // Eine im Betriebssystem deaktivierte Registrierung nicht bei jedem Start
    // wieder aktivieren. Nur Ersteinrichtung, Pfadwechsel oder bewusster Klick.
    if (force || settings.loginConfiguredPath !== executable) {
      app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin !== false });
      settings.loginConfiguredPath = executable;
    }
    const state = app.getLoginItemSettings();
    const enabled = platform === "win32" ? state.openAtLogin && state.executableWillLaunchAtLogin !== false : state.openAtLogin;
    return {
      supported: true,
      enabled,
      detail: state.status === "requires-approval" ? "Autostart: bitte in macOS freigeben"
        : enabled ? "Autostart: aktiv" : "Autostart: aus oder vom System blockiert",
    };
  } catch {
    return { supported: true, enabled: false, detail: "Autostart: bitte in den Systemeinstellungen prüfen" };
  }
}

module.exports = { configureLogin };
