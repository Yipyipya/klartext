const path = require("path");
const MAX_LOG_BYTES = 1_000_000;

function firstExistingProfile(fs, preferredPath, legacyPath) {
  if (fs?.existsSync?.(preferredPath)) return preferredPath;
  if (fs?.existsSync?.(legacyPath)) return legacyPath;
  return preferredPath;
}

function configureRuntime(app, platform, env = process.env, smokeTest = false, alphaBuild = false, fs = require("fs")) {
  const development = !app.isPackaged;
  const profileParent = path.dirname(app.getPath("userData"));
  if (smokeTest) {
    app.setPath("userData", path.join(app.getPath("temp"), `nivune-smoke-${process.pid}`));
  } else if (alphaBuild) {
    app.setPath("userData", firstExistingProfile(
      fs,
      path.join(profileParent, "Nivune Alpha"),
      path.join(profileParent, "Klartext Alpha")
    ));
  } else if (development) {
    // Entwicklungs- und installierte App dürfen weder Schlüssel noch den
    // Single-Instance-Lock teilen. Sonst kann ein vergessenes `npm start`
    // unbemerkt den produktiven Shortcut übernehmen.
    app.setPath("userData", firstExistingProfile(
      fs,
      `${app.getPath("userData")}-development`,
      path.join(profileParent, "klartext-desktop-development")
    ));
  } else {
    app.setPath("userData", firstExistingProfile(
      fs,
      app.getPath("userData"),
      path.join(profileParent, "klartext-desktop")
    ));
  }
  const productionShortcut = env.NIVUNE_USE_PRODUCTION_SHORTCUT === "1"
    || env.KLARTEXT_USE_PRODUCTION_SHORTCUT === "1";
  const alternate = (development || smokeTest || alphaBuild) && !productionShortcut;
  const hotkey = platform === "darwin"
    ? alternate ? "Alt+Shift+Space" : "Alt+Space"
    : alternate ? "Control+Alt+Shift+Space" : "Control+Shift+Space";
  const hotkeyLabel = platform === "darwin"
    ? alternate ? "⌥ + ⇧ + Leertaste" : "⌥ + Leertaste"
    : alternate ? "Strg + Alt + Umschalt + Leertaste" : "Strg + Umschalt + Leertaste";
  const hotkeyLabelEnglish = platform === "darwin"
    ? alternate ? "⌥ + ⇧ + Space" : "⌥ + Space"
    : alternate ? "Ctrl + Alt + Shift + Space" : "Ctrl + Shift + Space";
  return { development, alphaBuild, hotkey, hotkeyLabel, hotkeyLabelEnglish };
}

function createFileLogger(fs, logPath) {
  return (message, error) => {
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true, mode: 0o700 });
      const detail = error instanceof Error ? error.stack || error.message : error == null ? "" : String(error);
      const line = `${new Date().toISOString()} ${String(message)}${detail ? `: ${detail}` : ""}\n`;
      const entry = line.slice(0, 16_000);
      try {
        if (fs.statSync?.(logPath).size + Buffer.byteLength(entry, "utf8") > MAX_LOG_BYTES) {
          const rotatedPath = `${logPath}.1`;
          if (fs.existsSync?.(rotatedPath)) fs.unlinkSync(rotatedPath);
          fs.renameSync(logPath, rotatedPath);
        }
      } catch (rotationError) {
        if (rotationError?.code !== "ENOENT") throw rotationError;
      }
      fs.appendFileSync(logPath, entry, { encoding: "utf8", mode: 0o600 });
      try { fs.chmodSync?.(logPath, 0o600); } catch { /* best effort */ }
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

module.exports = { MAX_LOG_BYTES, firstExistingProfile, configureRuntime, createFileLogger, installPipeGuards };
