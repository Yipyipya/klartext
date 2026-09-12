const api = window.klartextSettings;
const $ = (id) => document.getElementById(id);
let snapshot;
let saving = false;
let contextDirty = false;
function feedback(text, error = false) {
  $("feedback").textContent = text;
  $("feedback").classList.toggle("error", error);
}
function render(s) {
  snapshot = s;
  for (const key of ["lang", "model", "theme"]) $(key).value = s[key];
  $("launchAtLogin").checked = s.login.enabled;
  $("launchAtLogin").disabled = !s.login.supported || s.preview;
  $("voiceActivation").checked = s.voiceActivation;
  $("voiceActivation").disabled = !s.wakeModelsAvailable || s.busy || s.preview;
  for (const el of document.querySelectorAll("[data-mode], #lang, #model, #save-context, [data-action=key], [data-action=voice-setup]")) el.disabled = s.busy || saving;
  if (!contextDirty) $("context").value = s.context;
  $("context").readOnly = s.busy;
  $("shortcut").textContent = s.shortcut;
  $("version").textContent = `Klartext ${s.version}${s.preview ? " · Isolierte Vorschau" : ""}`;
  $("login-detail").textContent = s.login.detail;
  $("key-status").textContent = s.hasKey ? "Verschlüsselt auf diesem Gerät gespeichert." : "Noch kein API-Key hinterlegt.";
  $("wake-detail").textContent = s.wakeStatus.detail;
  $("wake-model").textContent = s.wakeModelsAvailable ? "Dein Startbefehl ist eingerichtet." : "Lerne deinen Startbefehl zuerst ein.";
  $("microphone").textContent = s.microphone;
  $("paste-status").textContent = s.pasteDetail;
  $("accessibility-button").hidden = s.platform !== "darwin";
  $("model-row").hidden = s.mode !== "local";
  $("key-row").hidden = s.mode !== "quality";
  document.querySelectorAll("[data-mode]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.mode === s.mode)));
}
async function update(patch) {
  if (saving) return;
  saving = true;
  try {
    const result = await api.update(patch);
    if (Object.hasOwn(patch, "context")) contextDirty = false;
    render(result);
    feedback("Gespeichert.");
  } catch (error) {
    if (snapshot) render(snapshot);
    feedback(error.message || "Speichern nicht möglich.", true);
  } finally { saving = false; if (snapshot) render(snapshot); }
}
document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-page]").forEach(el => el.setAttribute("aria-current", el === button ? "page" : "false"));
  document.querySelectorAll("[data-panel]").forEach(el => el.hidden = el.dataset.panel !== button.dataset.page);
  feedback("");
}));
document.querySelectorAll("[data-setting]").forEach(el => el.addEventListener("change", () => update({[el.dataset.setting]: el.type === "checkbox" ? el.checked : el.value})));
document.querySelectorAll("[data-mode]").forEach(el => el.addEventListener("click", () => update({mode:el.dataset.mode})));
$("context").addEventListener("input", () => { contextDirty = true; });
$("save-context").addEventListener("click", () => update({context:$("context").value}));
document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", async () => {
  try { render(await api.action(el.dataset.action)); } catch(error) { feedback(error.message || "Aktion fehlgeschlagen.", true); }
}));
if (api) {
  api.onChanged(render);
  api.read().then(render).catch(error => feedback(error.message, true));
} else {
  feedback("Diese Einstellungen werden in der Klartext Desktop-App geöffnet.", true);
  document.querySelectorAll("input,select,textarea,button:not([data-page])").forEach(el => el.disabled = true);
}
