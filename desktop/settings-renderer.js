const api = window.klartextSettings;
const i18n = window.klartextI18n || { setLanguage: () => {}, pick: (de) => de };
const $ = (id) => document.getElementById(id);
let snapshot;
let saving = false;
let contextDirty = false;
let reportedFirstRender = false;
function feedback(text, error = false) {
  $("feedback").textContent = text;
  $("feedback").classList.toggle("error", error);
}
function render(s) {
  snapshot = s;
  i18n.setLanguage(s.interfaceLanguage);
  for (const key of ["interfaceLanguage", "lang", "model", "cleanup", "refinementProvider", "theme", "ollamaBaseUrl", "ollamaModel", "transcriptionProvider", "compatibleTranscriptionBaseUrl", "compatibleRefinementBaseUrl", "compatibleRefinementModel"]) $(key).value = s[key] || "";
  $("launchAtLogin").checked = s.login.enabled;
  $("launchAtLogin").disabled = !s.login.supported || s.preview;
  $("voiceActivation").checked = s.voiceActivation;
  $("voiceActivation").disabled = !s.wakeModelsAvailable || s.busy || s.preview;
  for (const el of document.querySelectorAll("[data-mode], [data-setting], #save-context, [data-action=key], [data-action=provider-key], [data-action=provider-test], [data-action=refinement-key], [data-action=refinement-test], [data-action=voice-setup], [data-action=ollama-test]")) el.disabled = s.busy || saving;
  if (!contextDirty) $("context").value = s.context;
  $("context").readOnly = s.busy;
  $("shortcut").textContent = s.shortcut;
  $("version").textContent = `Nivune ${s.version}${s.preview ? i18n.pick(" · Isolierte Vorschau", " · Isolated preview") : ""}`;
  $("login-detail").textContent = s.login.detail;
  $("key-status").textContent = s.hasOpenAIKey ? "Verschlüsselt auf diesem Gerät gespeichert." : "Noch kein API-Key hinterlegt.";
  $("wake-detail").textContent = s.wakeStatus.detail;
  $("wake-model").textContent = s.wakeModelsAvailable
    ? i18n.pick(`Eingerichtet: „${s.wakePhrase}“.`, `Set up: “${s.wakePhrase}”.`)
    : i18n.pick("Lerne deinen Startbefehl zuerst ein.", "Set up your start phrase first.");
  $("microphone").textContent = s.microphone;
  $("paste-status").textContent = s.pasteDetail;
  $("accessibility-button").hidden = s.platform !== "darwin";
  $("model-row").hidden = s.mode !== "local";
  $("model-manager").hidden = s.mode !== "local";
  $("provider-row").hidden = s.mode !== "quality";
  $("provider-box").hidden = s.mode !== "quality" || s.transcriptionProvider === "openai";
  $("compatible-address").hidden = s.transcriptionProvider !== "openai-compatible";
  $("key-row").hidden = !(s.refinementProvider === "openai" || (s.mode === "quality" && s.transcriptionProvider === "openai"));
  $("provider-model").value = s.transcriptionProvider === "groq" ? s.groqModel || "" : s.compatibleTranscriptionModel || "";
  $("provider-key-label").textContent = s.transcriptionProvider === "groq" ? "Groq API-Key" : "Server-Key (optional)";
  const hasProviderKey = s.transcriptionProvider === "groq" ? s.hasGroqKey : s.hasCompatibleTranscriptionKey;
  $("provider-key-status").textContent = hasProviderKey ? "Verschlüsselt auf diesem Gerät gespeichert." : s.transcriptionProvider === "groq" ? "Noch kein API-Key hinterlegt." : "Kein Key hinterlegt; lokale Server dürfen ohne Key arbeiten.";
  const providerState = s.transcriptionProviderStatus || { state: "idle", models: [], supported: true };
  $("provider-status").textContent = providerState.state === "checking" ? "Wird geprüft …"
    : providerState.state === "ready" && !providerState.supported ? "Erreichbar · Modell-ID manuell"
    : providerState.state === "ready" ? i18n.pick(`${providerState.models.length} Modelle gefunden`, `${providerState.models.length} models found`)
    : providerState.state === "error" ? "Nicht erreichbar" : "Nicht geprüft";
  $("provider-models").replaceChildren(...(providerState.models || []).map(model => Object.assign(document.createElement("option"), { value: model })));
  $("provider-test").disabled = s.busy || saving || s.preview || providerState.state === "checking";
  $("provider-privacy").textContent = s.transcriptionProvider === "groq"
    ? "Audio wird direkt an Groq gesendet. Es gibt keinen stillen Wechsel zu OpenAI."
    : "Entfernte Server benötigen HTTPS; HTTP ist nur auf localhost erlaubt. Umleitungen werden nicht verfolgt.";
  $("ollama-box").hidden = s.refinementProvider !== "ollama" || s.cleanup === "aus";
  $("ollama-privacy").textContent = s.mode === "local"
    ? i18n.pick("Transkription und Überarbeitung bleiben auf diesem Gerät.", "Transcription and refinement stay on this device.")
    : i18n.pick(
      `Nur die Überarbeitung ist lokal; die Aufnahme geht weiterhin an ${s.transcriptionProvider === "groq" ? "Groq" : s.transcriptionProvider === "openai-compatible" ? "den kompatiblen Server" : "OpenAI"}.`,
      `Only refinement is local; the recording is still sent to ${s.transcriptionProvider === "groq" ? "Groq" : s.transcriptionProvider === "openai-compatible" ? "the compatible server" : "OpenAI"}.`,
    );
  const ollama = s.ollamaStatus || { state: "idle", models: [] };
  $("ollama-status").textContent = ollama.state === "checking" ? "Wird geprüft …"
    : ollama.state === "ready" ? i18n.pick(`${ollama.models.length} Modelle gefunden`, `${ollama.models.length} models found`)
    : ollama.state === "error" ? "Nicht erreichbar" : "Nicht geprüft";
  $("ollama-test").disabled = s.busy || saving || s.preview || ollama.state === "checking";
  $("ollama-models").replaceChildren(...(ollama.models || []).map(model => Object.assign(document.createElement("option"), { value: model })));
  $("compatible-refinement-box").hidden = s.refinementProvider !== "openai-compatible" || s.cleanup === "aus";
  $("refinement-key-status").textContent = s.hasCompatibleRefinementKey
    ? "Verschlüsselt auf diesem Gerät gespeichert."
    : "Kein Key hinterlegt; lokale Server dürfen ohne Key arbeiten.";
  const refinement = s.refinementProviderStatus || { state: "idle", models: [], supported: true };
  $("refinement-status").textContent = refinement.state === "checking" ? "Wird geprüft …"
    : refinement.state === "ready" && !refinement.supported ? "Erreichbar · Modell-ID manuell"
    : refinement.state === "ready" ? i18n.pick(`${refinement.models.length} Modelle gefunden`, `${refinement.models.length} models found`)
    : refinement.state === "error" ? "Nicht erreichbar" : "Nicht geprüft";
  $("compatible-refinement-models").replaceChildren(...(refinement.models || []).map(model => Object.assign(document.createElement("option"), { value: model })));
  $("refinement-test").disabled = s.busy || saving || s.preview || refinement.state === "checking";
  const localModel = s.localModelStatus || { state: "checking", progress: 0 };
  const localRuntime = s.localRuntimeStatus || { ready: false, missing: [] };
  const modelLabels = { checking: i18n.pick("Status wird geprüft …", "Checking status …"), missing: i18n.pick("Noch nicht geladen.", "Not downloaded yet."), partial: i18n.pick("Download ist unvollständig.", "Download is incomplete."), downloading: i18n.pick(`Download läuft … ${Math.round(localModel.progress || 0)} %`, `Downloading … ${Math.round(localModel.progress || 0)}%`), ready: i18n.pick("Offline bereit.", "Ready offline."), error: i18n.pick("Status konnte nicht geprüft werden.", "Status could not be checked.") };
  $("model-status").textContent = localRuntime.ready
    ? modelLabels[localModel.state] || modelLabels.error
    : i18n.pick(
      `Lokale Laufzeit unvollständig${localRuntime.missing.length ? `: ${localRuntime.missing.join(", ")}` : "."}`,
      `Local runtime incomplete${localRuntime.missing.length ? `: ${localRuntime.missing.join(", ")}` : "."}`,
    );
  $("model-meta").textContent = s.model === "genau" ? "Whisper small · Apache-2.0 · ca. 260–600 MB" : "Whisper base · Apache-2.0 · ca. 85–215 MB";
  $("model-progress").hidden = localModel.state !== "downloading";
  $("model-progress").firstElementChild.style.width = `${Math.max(2, Math.min(100, localModel.progress || 0))}%`;
  $("model-download").hidden = ["downloading", "ready"].includes(localModel.state);
  $("model-download").textContent = "Herunterladen";
  $("model-cancel").hidden = localModel.state !== "downloading";
  $("model-remove").hidden = !["ready", "partial"].includes(localModel.state);
  for (const id of ["model-download", "model-cancel", "model-remove"]) $(id).disabled = s.busy || saving || s.preview || !localRuntime.ready;
  renderUpdate(s);
  document.querySelectorAll("[data-mode]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.mode === s.mode)));
  i18n.setLanguage(s.interfaceLanguage);
  if (!reportedFirstRender) {
    reportedFirstRender = true;
    api.rendered({
      cleanup: $("cleanup").value,
      refinementProvider: $("refinementProvider").value,
      ollamaBaseUrl: $("ollamaBaseUrl").value,
      ollamaModel: $("ollamaModel").value,
      ollamaBoxHidden: $("ollama-box").hidden,
      compatibleRefinementBaseUrl: $("compatibleRefinementBaseUrl").value,
      compatibleRefinementModel: $("compatibleRefinementModel").value,
      compatibleRefinementBoxHidden: $("compatible-refinement-box").hidden,
      transcriptionProvider: $("transcriptionProvider").value,
      providerBoxHidden: $("provider-box").hidden,
    });
  }
}
const UPDATE_ERRORS = {
  UPDATE_NO_RELEASE: ["Es ist noch keine stabile Version veröffentlicht.", "No stable version has been published yet."],
  UPDATE_RATE_LIMITED: ["GitHub begrenzt gerade Anfragen. Bitte später erneut versuchen.", "GitHub is limiting requests right now. Please try again later."],
  UPDATE_TIMEOUT: ["Die Anfrage hat zu lange gedauert.", "The request took too long."],
  UPDATE_NETWORK: ["Keine Verbindung zu GitHub.", "Could not reach GitHub."],
};
function renderUpdate(s) {
  const status = s.updateStatus || { state: "idle" };
  const latest = status.latest;
  const [errorDe, errorEn] = UPDATE_ERRORS[status.error] || ["Die Antwort konnte nicht sicher geprüft werden.", "The response could not be verified safely."];
  $("update-detail").textContent = status.state === "checking" ? i18n.pick("Suche nach Updates …", "Checking for updates …")
    : status.state === "available" ? i18n.pick(`Version ${latest.version} ist verfügbar. Du installierst sie selbst über die offizielle Download-Seite.`, `Version ${latest.version} is available. You install it yourself from the official download page.`)
    : status.state === "current" ? i18n.pick(`Nivune ${s.version} ist aktuell. Neueste stabile Version: ${latest.version}.`, `Nivune ${s.version} is up to date. Latest stable version: ${latest.version}.`)
    : status.state === "error" ? i18n.pick(`Updateprüfung nicht möglich. ${errorDe}`, `Could not check for updates. ${errorEn}`)
    : i18n.pick("Nivune sucht nur auf deinen Befehl nach einer neuen Version. Es wird nichts automatisch installiert.", "Nivune only checks for a new version when you ask. Nothing is installed automatically.");
  $("update-check").disabled = s.preview || status.state === "checking";
  $("update-open").hidden = status.state !== "available";
  const notes = status.state === "available" && latest.notes ? latest.notes.slice(0, 600) : "";
  $("update-notes").hidden = !notes;
  $("update-notes").textContent = notes ? `${i18n.pick("Release-Notizen", "Release notes")}: ${notes}${latest.notes.length > 600 ? " …" : ""}` : "";
}
async function update(patch) {
  if (saving) return;
  saving = true;
  try {
    const result = await api.update(patch);
    if (Object.hasOwn(patch, "context")) contextDirty = false;
    render(result);
    feedback(i18n.pick("Gespeichert.", "Saved."));
  } catch (error) {
    if (snapshot) render(snapshot);
    feedback(error.message || i18n.pick("Speichern nicht möglich.", "Could not save."), true);
  } finally { saving = false; if (snapshot) render(snapshot); }
}
document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-page]").forEach(el => el.setAttribute("aria-current", el === button ? "page" : "false"));
  document.querySelectorAll("[data-panel]").forEach(el => el.hidden = el.dataset.panel !== button.dataset.page);
  feedback("");
}));
document.querySelectorAll("[data-setting]").forEach(el => el.addEventListener("change", () => {
  const value = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.setting === "refinementProvider" && value !== "none" && snapshot.cleanup === "aus") {
    update({ refinementProvider: value, cleanup: "sanft" });
    return;
  }
  update({[el.dataset.setting]: value});
}));
document.querySelectorAll("[data-mode]").forEach(el => el.addEventListener("click", () => update({mode:el.dataset.mode})));
$("provider-model").addEventListener("change", () => update({
  [snapshot.transcriptionProvider === "groq" ? "groqModel" : "compatibleTranscriptionModel"]: $("provider-model").value,
}));
$("context").addEventListener("input", () => { contextDirty = true; });
$("save-context").addEventListener("click", () => update({context:$("context").value}));
document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", async () => {
  if (el.dataset.action === "model-remove" && !confirm(i18n.pick("Das lokale Sprachmodell wirklich von diesem Gerät löschen?", "Really remove the local speech model from this device?"))) return;
  try { render(await api.action(el.dataset.action)); } catch(error) { feedback(error.message || i18n.pick("Aktion fehlgeschlagen.", "Action failed."), true); }
}));
if (api) {
  api.onChanged(render);
  api.read().then(render).catch(error => feedback(error.message, true));
} else {
  feedback(i18n.pick("Diese Einstellungen werden in der Nivune Desktop-App geöffnet.", "These settings open in the Nivune desktop app."), true);
  document.querySelectorAll("input,select,textarea,button:not([data-page])").forEach(el => el.disabled = true);
}
