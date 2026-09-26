const api = window.klartextOnboarding;
const i18n = window.klartextI18n || { setLanguage: () => {}, pick: (de) => de, language: "de" };
const $ = (id) => document.getElementById(id);
let snapshot;
let reportedFirstRender = false;
let finishChoicesInitialized = false;
let visibleStep = null;

function feedback(message, error = false) {
  $("onboarding-feedback").textContent = message || "";
  $("onboarding-feedback").classList.toggle("error", error);
}

function modelStatus(state) {
  if (!state) return i18n.pick("Status wird geprüft …", "Checking status …");
  if (state.state === "ready") return i18n.pick("Offline bereit.", "Ready offline.");
  if (state.state === "downloading") return i18n.pick(`Download läuft … ${Math.round(state.progress || 0)} %`, `Downloading … ${Math.round(state.progress || 0)}%`);
  if (state.state === "partial") return i18n.pick("Download ist unvollständig.", "Download is incomplete.");
  if (state.state === "missing") return i18n.pick("Noch nicht geladen.", "Not downloaded yet.");
  return i18n.pick("Status konnte nicht geprüft werden.", "Status could not be checked.");
}

function showStep(step) {
  const changed = visibleStep !== step;
  document.querySelectorAll("[data-step]").forEach((panel) => { panel.hidden = panel.dataset.step !== step; });
  const number = { language: 1, provider: 2, sample: 3, finish: 4 }[step] || 1;
  document.querySelectorAll("[data-go-step]").forEach((button) => {
    const target = Number(button.dataset.goStep);
    button.setAttribute("aria-current", target === number ? "step" : "false");
    button.disabled = target > Math.max(number, snapshot?.step || 1);
  });
  if (changed) document.querySelector(".onboarding-shell").scrollTop = 0;
  visibleStep = step;
}

function render(state) {
  snapshot = state;
  i18n.setLanguage(state.interfaceLanguage);
  $("onboarding-version").textContent = `Nivune ${state.version}${state.preview ? i18n.pick(" · Isolierte Vorschau", " · Isolated preview") : ""}`;
  document.querySelectorAll("[data-interface-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.interfaceLanguage === state.interfaceLanguage)));
  document.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === state.language)));
  document.querySelectorAll("[data-provider]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.provider === state.provider)));
  $("local-setup").hidden = state.provider !== "local";
  $("cloud-setup").hidden = state.provider === "local";
  $("compatible-setup").hidden = state.provider !== "openai-compatible";
  $("onboarding-local-model").value = state.localModel;
  $("onboarding-model-status").textContent = state.localRuntimeReady ? modelStatus(state.localModelStatus) : i18n.pick("Die lokale Laufzeit fehlt im App-Paket.", "The local runtime is missing from the app package.");
  const downloading = state.localModelStatus?.state === "downloading";
  $("onboarding-model-progress").hidden = !downloading;
  $("onboarding-model-progress").firstElementChild.style.width = `${Math.max(2, Math.min(100, state.localModelStatus?.progress || 0))}%`;
  $("onboarding-model-download").hidden = downloading || state.localModelStatus?.state === "ready";
  $("onboarding-model-cancel").hidden = !downloading;
  $("cloud-setup-title").textContent = state.provider === "groq" ? i18n.pick("Groq-Zugang", "Groq access") : state.provider === "openai-compatible" ? i18n.pick("Eigener Server", "Your own server") : i18n.pick("OpenAI-Zugang", "OpenAI access");
  $("cloud-key-status").textContent = state.hasProviderKey ? i18n.pick("Key ist verschlüsselt auf diesem Gerät gespeichert.", "The key is stored encrypted on this device.") : state.provider === "openai-compatible" ? i18n.pick("Ein Key ist optional; Server-Adresse und Modell sind erforderlich.", "A key is optional; server address and model are required.") : i18n.pick("Für die Probe fehlt noch dein eigener API-Key.", "Your API key is still required for the test.");
  $("onboarding-compatible-url").value = state.compatibleBaseUrl;
  $("onboarding-compatible-model").value = state.compatibleModel;
  $("onboarding-key").textContent = state.hasProviderKey ? i18n.pick("Key ändern", "Change key") : state.provider === "openai-compatible" ? i18n.pick("Optionalen Key verwalten", "Manage optional key") : i18n.pick("API-Key hinterlegen", "Add API key");
  $("cloud-privacy").textContent = state.provider === "groq" ? i18n.pick("Die Probeaufnahme wird direkt an Groq gesendet.", "The test recording is sent directly to Groq.") : state.provider === "openai-compatible" ? i18n.pick("Entfernte Server benötigen HTTPS; HTTP ist nur auf localhost erlaubt.", "Remote servers require HTTPS; HTTP is allowed only on localhost.") : i18n.pick("Die Probeaufnahme wird direkt an OpenAI gesendet.", "The test recording is sent directly to OpenAI.");
  const setupIssue = typeof state.setupIssue === "string" && state.setupIssue.trim()
    ? state.setupIssue
    : i18n.pick("Einrichtung noch nicht vollständig.", "Setup is not complete yet.");
  $("setup-status").textContent = state.setupReady ? i18n.pick("Bereit für die Probeaufnahme.", "Ready for the test recording.") : setupIssue;
  $("setup-status").classList.toggle("ready", state.setupReady);
  $("provider-next").disabled = !state.setupReady || state.preview;
  $("sample-intro").childNodes[0].nodeValue = i18n.pick("Erst jetzt fragt Nivune nach dem Mikrofon. Beende die Aufnahme mit ", "Nivune asks for microphone access only now. Stop the recording with ");
  $("sample-intro").childNodes[$("sample-intro").childNodes.length - 1].nodeValue = i18n.pick(" oder warte nach dem Satz auf die Stille-Erkennung.", " or wait for silence detection after your sentence.");
  $("sample-shortcut").textContent = state.shortcut;
  const sampleState = state.sample?.state || "idle";
  $("sample-card").dataset.state = sampleState;
  $("sample-card").setAttribute("aria-busy", String(sampleState === "recording" || sampleState === "processing"));
  $("sample-state").textContent = sampleState === "recording" ? i18n.pick("Probeaufnahme läuft", "Test recording in progress")
    : sampleState === "processing" ? i18n.pick("Probe wird verarbeitet …", "Processing test …")
      : sampleState === "completed" ? i18n.pick("Dein erster Text ist fertig", "Your first text is ready") : sampleState === "error" ? i18n.pick("Probe nicht abgeschlossen", "Test not completed") : i18n.pick("Bereit für die Probe", "Ready for the test");
  $("sample-detail").textContent = sampleState === "recording" ? i18n.pick(`Sprich jetzt und beende mit ${state.shortcut}.`, `Speak now and stop with ${state.shortcut}.`)
    : sampleState === "processing" ? i18n.pick("Das fest gewählte Profil verarbeitet deine Aufnahme.", "The selected profile is processing your recording.")
      : sampleState === "completed" ? i18n.pick("Der Text liegt zusätzlich bereits in deiner Zwischenablage.", "The text is also already on your clipboard.")
        : sampleState === "error" ? state.sample.error || i18n.pick("Versuche es noch einmal.", "Please try again.") : i18n.pick("Zum Beispiel: „Das ist meine erste Nivune-Aufnahme.“", "For example: “This is my first Nivune recording.”");
  $("start-sample").disabled = state.preview || state.busy || !state.setupReady;
  $("start-sample").textContent = sampleState === "completed" ? i18n.pick("Probe erneut aufnehmen", "Record another test") : i18n.pick("Probeaufnahme starten", "Start test recording");
  $("sample-result").hidden = sampleState !== "completed";
  $("copy-sample").hidden = sampleState !== "completed";
  $("sample-text").value = state.sample?.text || "";
  $("sample-next").disabled = !state.sampleCompleted || sampleState !== "completed" || state.preview;
  $("paste-detail").textContent = state.pasteDetail;
  $("onboarding-accessibility").hidden = state.platform !== "darwin" || state.pasteReady;
  $("finish-voice").disabled = !state.wakeModelsAvailable || state.preview;
  $("finish-login").disabled = state.preview || !state.login?.supported;
  $("finish-voice").closest(".finish-choice").dataset.disabled = String($("finish-voice").disabled);
  $("finish-login").closest(".finish-choice").dataset.disabled = String($("finish-login").disabled);
  $("finish-login-detail").textContent = state.login?.supported
    ? i18n.pick("Nivune steht danach direkt über den globalen Shortcut bereit.", "Nivune will then be ready through the global shortcut.")
    : state.login?.detail || i18n.pick("Autostart ist in dieser App-Ausführung nicht verfügbar.", "Launch at login is not available in this app build.");
  $("finish-voice-detail").textContent = state.wakeModelsAvailable ? i18n.pick("Dein persönlicher Startbefehl ist eingerichtet.", "Your personal start phrase is set up.") : i18n.pick("Bleibt aus, bis du einen persönlichen Startbefehl eingerichtet hast.", "Stays off until you set up a personal start phrase.");
  $("finish-voice-setup").hidden = state.wakeModelsAvailable;
  $("finish-onboarding").disabled = state.preview || !state.sampleCompleted || state.busy;
  if (!finishChoicesInitialized) {
    $("finish-login").checked = false;
    $("finish-voice").checked = false;
    finishChoicesInitialized = true;
  }
  showStep(({ 1: "language", 2: "provider", 3: "sample", 4: "finish" })[state.step] || "language");
  i18n.setLanguage(state.interfaceLanguage);
  if (!reportedFirstRender) {
    reportedFirstRender = true;
    api.rendered({
      steps: [...document.querySelectorAll(".onboarding-step")].map((panel) => panel.dataset.step).join(","),
      provider: state.provider,
      clipboardExplained: Boolean($("clipboard-explanation")),
    });
  }
}

async function action(name, payload) {
  try {
    const previousStep = visibleStep;
    const result = await api.action(name, payload);
    render(result);
    if (name === "set-interface-language" && previousStep) showStep(previousStep);
    if (result.notice) feedback(result.notice);
  } catch (error) {
    feedback(error.message || i18n.pick("Aktion nicht möglich.", "Action is not available."), true);
  }
}

document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => action("set-language", { language: button.dataset.language })));
document.querySelectorAll("[data-interface-language]").forEach((button) => button.addEventListener("click", () => action("set-interface-language", { language: button.dataset.interfaceLanguage })));
document.querySelectorAll("[data-provider]").forEach((button) => button.addEventListener("click", () => action("select-provider", { provider: button.dataset.provider })));
const stepName = (number) => ({ 1: "language", 2: "provider", 3: "sample", 4: "finish" })[number] || "language";
document.querySelectorAll("[data-go-step]").forEach((button) => button.addEventListener("click", () => showStep(stepName(Number(button.dataset.goStep)))));
document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => showStep(stepName(Number(button.dataset.back)))));
document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => showStep(stepName(Number(button.dataset.next)))));
$("onboarding-local-model").addEventListener("change", (event) => action("set-local-model", { model: event.target.value }));
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
  const name = button.dataset.action;
  if (name === "save-compatible") return action(name, { baseUrl: $("onboarding-compatible-url").value, model: $("onboarding-compatible-model").value });
  if (name === "finish") return action(name, { launchAtLogin: $("finish-login").checked, voiceActivation: $("finish-voice").checked });
  return action(name);
}));

if (api) {
  api.onChanged(render);
  api.read().then(render).catch((error) => feedback(error.message, true));
} else {
  feedback(i18n.pick("Die Ersteinrichtung wird in Nivune Desktop geöffnet.", "First-time setup opens in Nivune Desktop."), true);
  document.querySelectorAll("button,input,select").forEach((element) => { element.disabled = true; });
}
