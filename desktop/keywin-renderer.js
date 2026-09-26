const input = document.getElementById("key");
let provider = "openai";

window.klartext.onApiKeyConfig((config) => {
  provider = config.provider;
  const english = config.interfaceLanguage === "en";
  document.documentElement.lang = english ? "en" : "de";
  document.title = english ? "Nivune – Best quality" : "Nivune – Beste Qualität";
  document.querySelector(".eyebrow").textContent = english ? "Best quality" : "Beste Qualität";
  document.getElementById("title").textContent = english ? `Connect ${config.label}` : `${config.label} verbinden`;
  document.getElementById("description").textContent = config.optional
    ? english
      ? "The API key is optional for this server. If you enter one, it is encrypted by the operating system and used only for this exact server address."
      : "Der API-Key ist für diesen Server optional. Falls du einen einträgst, wird er vom Betriebssystem verschlüsselt und nur für genau diese Serveradresse verwendet."
    : english
      ? `The API key is encrypted by the operating system and used exclusively for ${config.label}.`
      : `Der API-Key wird vom Betriebssystem verschlüsselt und ausschließlich für ${config.label} verwendet.`;
  input.placeholder = provider === "groq" ? "gsk_…" : provider === "openai" ? "sk-proj-…" : english ? "Optional server key" : "Optionaler Server-Key";
  document.getElementById("remove").textContent = english ? "Remove key" : "Key entfernen";
  document.getElementById("cancel").textContent = english ? "Cancel" : "Abbrechen";
  document.getElementById("save").textContent = english ? "Save" : "Speichern";
});

document.getElementById("save").addEventListener("click", () => {
  if (input.value.trim()) window.klartext.saveApiKey(provider, input.value);
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && input.value.trim()) window.klartext.saveApiKey(provider, input.value);
});
document.getElementById("remove").addEventListener("click", () => window.klartext.saveApiKey(provider, ""));
document.getElementById("cancel").addEventListener("click", () => window.klartext.closeKeyWindow());
