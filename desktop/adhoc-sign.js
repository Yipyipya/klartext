// Ad-hoc-Signatur für den macOS-Build.
// Ohne Signatur lehnt macOS (vor allem Apple Silicon) eine heruntergeladene
// App als „beschädigt" ab. Eine Ad-hoc-Signatur (codesign --sign -) ersetzt
// keine echte Notarisierung, macht aber aus dem harten „beschädigt"-Fehler
// den milderen „Trotzdem öffnen"-Dialog (Systemeinstellungen → Datenschutz).
const { execSync } = require("child_process");
const path = require("path");

exports.default = async function (context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: "inherit" });
  console.log("Ad-hoc-Signatur angewendet:", appPath);
};
