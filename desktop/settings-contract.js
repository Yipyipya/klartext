// Only these editable values may cross the settings window's IPC boundary.
function validateSettingsPatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Ungültige Einstellungen.");
  const result = {};
  for (const [key, value] of Object.entries(patch)) {
    const choices = { lang: ["de", "en", ""], mode: ["quality", "local"], model: ["genau", "schnell"], theme: ["system", "light", "dark"] };
    if (Object.hasOwn(choices, key)) {
      if (!choices[key].includes(value)) throw new Error(`Ungültiger Wert für ${key}.`);
    } else if (["launchAtLogin", "voiceActivation"].includes(key)) {
      if (typeof value !== "boolean") throw new Error(`Ungültiger Wert für ${key}.`);
    } else if (key === "context") {
      if (typeof value !== "string" || value.length > 4000) throw new Error("Der Kontext darf höchstens 4.000 Zeichen enthalten.");
    } else {
      throw new Error("Diese Einstellung kann hier nicht geändert werden.");
    }
    result[key] = value;
  }
  return result;
}
module.exports = { validateSettingsPatch };
