// Only these editable values may cross the settings window's IPC boundary.
function validateSettingsPatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Ungültige Einstellungen.");
  const result = {};
  for (const [key, value] of Object.entries(patch)) {
    const choices = { interfaceLanguage: ["de", "en"], lang: ["de", "en", ""], mode: ["quality", "local"], transcriptionProvider: ["openai", "groq", "openai-compatible"], model: ["genau", "schnell"], cleanup: ["aus", "sanft", "stark"], refinementProvider: ["none", "deterministic", "openai", "openai-compatible", "ollama"], theme: ["system", "light", "dark"] };
    if (Object.hasOwn(choices, key)) {
      if (!choices[key].includes(value)) throw new Error(`Ungültiger Wert für ${key}.`);
    } else if (["launchAtLogin", "voiceActivation"].includes(key)) {
      if (typeof value !== "boolean") throw new Error(`Ungültiger Wert für ${key}.`);
    } else if (key === "context") {
      if (typeof value !== "string" || value.length > 4000) throw new Error("Der Kontext darf höchstens 4.000 Zeichen enthalten.");
    } else if (["ollamaModel", "groqModel", "compatibleTranscriptionModel", "compatibleRefinementModel"].includes(key)) {
      if (typeof value !== "string" || value.length > 200 || /[\r\n]/.test(value)) throw new Error("Ungültige Modell-ID.");
    } else if (key === "ollamaBaseUrl") {
      if (typeof value !== "string" || value.length > 200) throw new Error("Ungültige Ollama-Adresse.");
      let url;
      try { url = new URL(value.trim()); } catch { throw new Error("Ungültige Ollama-Adresse."); }
      if (!["http:", "https:"].includes(url.protocol)
        || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase())
        || url.username || url.password || url.search || url.hash
        || !["", "/"].includes(url.pathname)) throw new Error("Ollama muss über eine lokale Loopback-Adresse erreichbar sein.");
      result[key] = url.origin;
      continue;
    } else if (["compatibleTranscriptionBaseUrl", "compatibleRefinementBaseUrl"].includes(key)) {
      if (typeof value !== "string" || value.length > 500) throw new Error("Ungültige Server-Adresse.");
      if (!value.trim()) { result[key] = ""; continue; }
      let url;
      try { url = new URL(value.trim()); } catch { throw new Error("Ungültige Server-Adresse."); }
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase());
      if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
        || url.username || url.password || url.search || url.hash) throw new Error("Entfernte Server benötigen HTTPS; HTTP ist nur lokal erlaubt.");
      url.pathname = url.pathname.replace(/\/+$/, "");
      result[key] = url.toString().replace(/\/$/, "");
      continue;
    } else {
      throw new Error("Diese Einstellung kann hier nicht geändert werden.");
    }
    result[key] = value;
  }
  return result;
}
module.exports = { validateSettingsPatch };
