const ACCESSIBILITY_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

function getPasteAccess(platform, trusted) {
  if (platform !== "darwin") {
    return { canPaste: true, needsAccessibility: false };
  }
  return {
    canPaste: Boolean(trusted),
    needsAccessibility: !trusted,
  };
}

module.exports = { ACCESSIBILITY_SETTINGS_URL, getPasteAccess };
