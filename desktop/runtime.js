const path = require("path");

function configureRuntime(app, platform, env = process.env, smokeTest = false) {
  const development = !app.isPackaged;
  if (smokeTest) {
    app.setPath("userData", path.join(app.getPath("temp"), `klartext-smoke-${process.pid}`));
  } else if (development) {
    // Entwicklungs- und installierte App dürfen weder Schlüssel noch den
    // Single-Instance-Lock teilen. Sonst kann ein vergessenes `npm start`
    // unbemerkt den produktiven Shortcut übernehmen.
    app.setPath("userData", `${app.getPath("userData")}-development`);
  }
  const productionShortcut = env.KLARTEXT_USE_PRODUCTION_SHORTCUT === "1";
  const alternate = (development || smokeTest) && !productionShortcut;
  const hotkey = platform === "darwin"
    ? alternate ? "Alt+Shift+Space" : "Alt+Space"
    : alternate ? "Control+Alt+Shift+Space" : "Control+Shift+Space";
  const hotkeyLabel = platform === "darwin"
    ? alternate ? "⌥ + ⇧ + Leertaste" : "⌥ + Leertaste"
    : alternate ? "Strg + Alt + Umschalt + Leertaste" : "Strg + Umschalt + Leertaste";
  return { development, hotkey, hotkeyLabel };
}

function createFileLogger(fs, logPath) {
  return (message, error) => {
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      const detail = error instanceof Error ? error.stack || error.message : error == null ? "" : String(error);
      const line = `${new Date().toISOString()} ${String(message)}${detail ? `: ${detail}` : ""}\n`;
      fs.appendFileSync(logPath, line.slice(0, 16_000), "utf8");
    } catch {
      // Logging darf die eigentliche App niemals zum Absturz bringen.
    }
  };
}

function installPipeGuards(streams, onError = () => {}) {
  for (const stream of streams) {
    stream?.on?.("error", (error) => {
      // Besonders EPIPE tritt auf, wenn eine Entwicklungs-App ihr Terminal
      // überlebt. Das Ereignis muss behandelt werden, sonst beendet Node den
      // gesamten Electron-Main-Prozess.
      onError(error);
    });
  }
}

module.exports = { configureRuntime, createFileLogger, installPipeGuards };
