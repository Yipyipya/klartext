// Electron-Fuses und Ad-hoc-Signatur für interne Builds.
// Ohne Signatur lehnt macOS (vor allem Apple Silicon) eine heruntergeladene
// App als „beschädigt" ab. Eine Ad-hoc-Signatur (codesign --sign -) ersetzt
// keine echte Notarisierung, macht aber aus dem harten „beschädigt"-Fehler
// den milderen „Trotzdem öffnen"-Dialog (Systemeinstellungen → Datenschutz).
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function (context) {
  const { flipFuses, FuseVersion, FuseV1Options } = await import("@electron/fuses");
  const appName = context.packager.appInfo.productFilename;
  const platform = context.electronPlatformName;
  const appPath = platform === "darwin"
    ? path.join(context.appOutDir, `${appName}.app`)
    : path.join(context.appOutDir, platform === "win32" ? `${appName}.exe` : appName);
  const executablePath = platform === "darwin"
    ? path.join(appPath, "Contents", "MacOS", appName)
    : appPath;
  const isInternalAlpha = appName === "Nivune Alpha";

  await flipFuses(executablePath, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    // The disposable, ad-hoc-signed alpha has no cookie-based session state.
    // Avoid a misleading macOS Keychain prompt there; production remains on.
    [FuseV1Options.EnableCookieEncryption]: !isInternalAlpha,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    [FuseV1Options.WasmTrapHandlers]: true,
  });
  console.log("Electron-Fuses gehärtet:", executablePath);

  if (platform !== "darwin") return;
  const infoPlist = path.join(appPath, "Contents", "Info.plist");
  execFileSync("/usr/bin/plutil", ["-replace", "NSAppTransportSecurity.NSAllowsArbitraryLoads", "-bool", "NO", infoPlist]);
  for (const unusedUsageDescription of [
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
    "NSCameraUsageDescription",
  ]) {
    try {
      execFileSync("/usr/bin/plutil", ["-remove", unusedUsageDescription, infoPlist]);
    } catch {
      // Electron-Versionen liefern nicht immer alle generischen Beschreibungen mit.
    }
  }
  execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath], { stdio: "inherit" });
  console.log("Ad-hoc-Signatur angewendet:", appPath);
};
