const api = window.klartextWorkspace;
const i18n = window.klartextI18n || { setLanguage: () => {}, pick: (de) => de, language: "de" };
const t = (de, en) => i18n.pick(de, en);
const $ = (id) => document.getElementById(id);
let snapshot;
let reportedFirstRender = false;
let stream = null;
let recorder = null;
let fragmentSequence = 0;
let fragmentQueue = Promise.resolve();
let fragmentFailure = null;
let discardFragments = false;
let captureStartedAt = 0;
let pausedAt = 0;
let pausedDuration = 0;
let timer = null;
const historyDrafts = new Map();
let renderedHistorySignature = "";

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateCaptureTime() {
  if (!captureStartedAt) return;
  const end = pausedAt || Date.now();
  $("capture-time").textContent = formatDuration(end - captureStartedAt - pausedDuration);
}

function elapsedCaptureTime() {
  if (!captureStartedAt) return 0;
  return Math.max(0, (pausedAt || Date.now()) - captureStartedAt - pausedDuration);
}

function queueRecordingFragment(event) {
  if (!event.data.size || discardFragments) return;
  const blob = event.data;
  const sequence = fragmentSequence++;
  const durationMs = elapsedCaptureTime();
  fragmentQueue = fragmentQueue.then(async () => {
    if (discardFragments) return;
    await api.appendFragment({
      captureId: snapshot?.captureId,
      sequence,
      bytes: await blob.arrayBuffer(),
      mimeType: recorder?.mimeType || blob.type || "audio/webm",
      durationMs,
    });
  }).catch((error) => {
    fragmentFailure ||= error;
  });
}

function stopMedia() {
  clearInterval(timer);
  timer = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

function recordingMimeType() {
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function statusLabel(job) {
  if (job.status === "queued") return t(`Wartet · Position ${job.queuePosition}`, `Waiting · position ${job.queuePosition}`);
  if (job.status === "processing") {
    if (job.stage === "refining") return t("Text wird überarbeitet …", "Refining text …");
    if (job.stage === "postprocessing") return t("Text wird fertiggestellt …", "Finalizing text …");
    if (job.progress) return t(`Abschnitt ${job.progress.current} von ${job.progress.total} wird transkribiert …`, `Transcribing section ${job.progress.current} of ${job.progress.total} …`);
    return t("Audio wird transkribiert …", "Transcribing audio …");
  }
  if (job.status === "completed") return job.warning ? t("Fertig · Feinschliff verworfen", "Done · refinement discarded") : t("Fertig", "Done");
  if (job.status === "cancelled") return t("Abgebrochen", "Cancelled");
  return t("Fehlgeschlagen", "Failed");
}

function renderJobs(state) {
  const activeJobs = state.jobs.filter((job) => ["queued", "processing"].includes(job.status)).length;
  $("queue-summary").textContent = activeJobs
    ? t(`${activeJobs} ${activeJobs === 1 ? "Auftrag" : "Aufträge"} in Arbeit`, `${activeJobs} ${activeJobs === 1 ? "job" : "jobs"} in progress`)
    : t("Keine wartenden Aufträge", "No waiting jobs");
  document.querySelectorAll("[data-job-list]").forEach((list) => {
    const jobs = state.jobs.filter((job) => job.source === list.dataset.source);
    list.replaceChildren();
    if (!jobs.length) {
      const empty = document.createElement("p");
      empty.className = "job-empty";
      empty.textContent = list.dataset.source === "recording" ? t("Noch keine Aufnahme verarbeitet.", "No recording processed yet.") : t("Noch keine Datei ausgewählt.", "No file selected yet.");
      list.appendChild(empty);
      return;
    }
    for (const job of jobs) {
      const article = document.createElement("article");
      article.className = "job";
      const heading = document.createElement("div");
      heading.className = "job-heading";
      const text = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = job.source === "recording" ? t("Arbeitsbereich-Aufnahme", "Workspace recording") : job.name;
      const detail = document.createElement("small");
      detail.textContent = statusLabel(job);
      text.append(name, detail);
      heading.appendChild(text);
      if (["queued", "processing"].includes(job.status)) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = t("Abbrechen", "Cancel");
        cancel.addEventListener("click", () => api.action("cancel-job", { id: job.id }).then(render).catch((error) => setFeedback(error.message, true)));
        heading.appendChild(cancel);
      }
      article.appendChild(heading);
      if (job.rawText) article.appendChild(outputBlock(t("Original", "Original"), job.rawText, "original"));
      if (job.text) article.appendChild(outputBlock(t("Ergebnis", "Result"), job.text));
      if (job.error) {
        const error = document.createElement("p");
        error.className = "job-error";
        error.textContent = job.error;
        article.appendChild(error);
      }
      list.appendChild(article);
    }
  });
}

function recoveryStateLabel(entry) {
  if (entry.state === "recording") return t("Nach unterbrochener Aufnahme wiederherstellbar", "Recoverable after interrupted recording");
  if (entry.state === "failed") return t("Verarbeitung fehlgeschlagen", "Processing failed");
  if (entry.state === "transcribed") return t("Transkript vorhanden · Feinschliff offen", "Transcript available · refinement pending");
  if (entry.state === "refining") return t("Feinschliff wurde unterbrochen", "Refinement was interrupted");
  if (entry.state === "transcribing") return t("Transkription wurde unterbrochen", "Transcription was interrupted");
  return t("Bereit zur Wiederherstellung", "Ready for recovery");
}

function renderRecoveries(state) {
  const list = $("recovery-list");
  list.replaceChildren();
  list.hidden = !state.recoveries.length;
  for (const entry of state.recoveries) {
    const article = document.createElement("article");
    article.className = "recovery-card";
    const heading = document.createElement("div");
    heading.className = "recovery-heading";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.name || t("Unterbrochene Aufnahme", "Interrupted recording");
    const detail = document.createElement("small");
    const provider = historyProviderLabel(entry.metadata?.transcriptionProvider);
    detail.textContent = `${recoveryStateLabel(entry)} · ${formatDuration(entry.durationMs)} · ${entry.fragments} ${t("Fragmente", "fragments")} · ${provider}`;
    text.append(title, detail);
    heading.appendChild(text);
    article.appendChild(heading);
    if (entry.retrySafety === "confirmation-required") {
      const warning = document.createElement("p");
      warning.className = "recovery-warning";
      warning.textContent = entry.uncertainStage === "refinement"
        ? t("Der Cloud-Feinschliff könnte bereits berechnet worden sein. Eine Wiederholung startet nur nach deiner Bestätigung; das vorhandene Transkript wird nicht erneut gesendet.", "Cloud refinement may already have been billed. A repeat starts only after your confirmation; the existing transcript is not sent again.")
        : t("Die Cloud-Transkription könnte bereits berechnet worden sein. Eine Wiederholung startet nur nach deiner Bestätigung und kann erneut Kosten verursachen.", "Cloud transcription may already have been billed. A repeat starts only after your confirmation and may incur another charge.");
      article.appendChild(warning);
    } else if (entry.error) {
      const warning = document.createElement("p");
      warning.className = "recovery-warning";
      warning.textContent = entry.error;
      article.appendChild(warning);
    }
    const actions = document.createElement("div");
    actions.className = "history-actions";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = entry.state === "recording" ? t("Aufnahme wiederherstellen", "Recover recording") : t("Erneut verarbeiten", "Process again");
    retry.disabled = state.preview || !entry.canProcess;
    retry.addEventListener("click", async () => {
      const uncertain = entry.retrySafety === "confirmation-required";
      if (uncertain && !window.confirm(t("Dieser Cloud-Schritt könnte bereits berechnet worden sein. Trotzdem bewusst erneut ausführen?", "This cloud step may already have been billed. Run it again anyway?"))) return;
      try {
        const result = await api.action("retry-recovery", { id: entry.id, confirmUncertain: uncertain });
        render(result);
        setFeedback(result.notice || t("Wiederherstellung gestartet.", "Recovery started."));
      } catch (error) {
        setFeedback(error.message || t("Wiederherstellung nicht möglich.", "Recovery is not available."), true);
      }
    });
    const discard = document.createElement("button");
    discard.type = "button";
    discard.className = "danger";
    discard.textContent = t("Arbeitskopie löschen", "Delete working copy");
    discard.disabled = state.preview;
    discard.addEventListener("click", async () => {
      if (!window.confirm(t("Diese lokale Audio-Arbeitskopie unwiderruflich löschen?", "Permanently delete this local audio working copy?"))) return;
      try {
        const result = await api.action("discard-recovery", { id: entry.id });
        render(result);
        setFeedback(result.notice || t("Arbeitskopie gelöscht.", "Working copy deleted."));
      } catch (error) {
        setFeedback(error.message || t("Arbeitskopie konnte nicht gelöscht werden.", "Working copy could not be deleted."), true);
      }
    });
    actions.append(retry, discard);
    article.appendChild(actions);
    list.appendChild(article);
  }
}

function historyProviderLabel(value) {
  return ({ local: t("Lokal", "Local"), openai: "OpenAI", groq: "Groq", "openai-compatible": t("Eigener Server", "Own server"), ollama: "Ollama", deterministic: t("Lokale Regeln", "Local rules"), none: t("Keine", "None") })[value] || value || t("Unbekannt", "Unknown");
}

function renderHistory(state) {
  const locale = state.interfaceLanguage === "en" ? "en" : "de";
  const query = $("history-search").value.trim().toLocaleLowerCase(locale);
  const signature = JSON.stringify([
    query,
    state.preview,
    state.interfaceLanguage,
    ...state.history.map((entry) => [entry.id, entry.updatedAt, entry.status, entry.edited, entry.audioRetained, entry.rawText.length, entry.text.length, entry.warning, entry.error]),
  ]);
  if (signature === renderedHistorySignature) return;
  renderedHistorySignature = signature;
  const entries = state.history.filter((entry) => !query || [
    entry.name,
    entry.rawText,
    entry.text,
    entry.warning,
    entry.error,
    ...Object.values(entry.metadata || {}),
  ].some((value) => String(value || "").toLocaleLowerCase(locale).includes(query)));
  $("history-summary").textContent = query
    ? t(`${entries.length} von ${state.history.length} ${state.history.length === 1 ? "Eintrag" : "Einträgen"}`, `${entries.length} of ${state.history.length} ${state.history.length === 1 ? "entry" : "entries"}`)
    : t(`${state.history.length} ${state.history.length === 1 ? "Eintrag" : "Einträge"}`, `${state.history.length} ${state.history.length === 1 ? "entry" : "entries"}`);
  const list = $("history-list");
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "workspace-empty";
    const title = document.createElement("strong");
    title.textContent = query ? t("Keine passenden Einträge", "No matching entries") : t("Noch keine Einträge", "No entries yet");
    const detail = document.createElement("small");
    detail.textContent = query ? t("Versuche einen anderen Suchbegriff.", "Try a different search term.") : t("Verarbeitete Aufnahmen und Dateien erscheinen automatisch hier — ohne gespeichertes Audio.", "Processed recordings and files appear here automatically — without stored audio.");
    empty.append(title, detail);
    list.appendChild(empty);
  }
  for (const entry of entries) {
    const article = document.createElement("article");
    article.className = "history-card";
    const header = document.createElement("header");
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = entry.source === "recording" ? t("Arbeitsbereich-Aufnahme", "Workspace recording") : entry.name;
    const meta = document.createElement("small");
    const date = new Intl.DateTimeFormat(state.interfaceLanguage === "en" ? "en-US" : "de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt));
    const duration = entry.metadata?.durationMs ? ` · ${formatDuration(entry.metadata.durationMs)}` : "";
    meta.textContent = `${date}${duration} · ${historyProviderLabel(entry.metadata?.transcriptionProvider)}${entry.metadata?.transcriptionModel ? ` / ${entry.metadata.transcriptionModel}` : ""} → ${historyProviderLabel(entry.metadata?.refinementProvider)}${entry.audioRetained ? t(" · Audio lokal gespeichert", " · audio stored locally") : ""}`;
    heading.append(title, meta);
    header.appendChild(heading);
    article.appendChild(header);
    if (entry.rawText) article.appendChild(outputBlock(t("Original", "Original"), entry.rawText, "original"));

    const edit = document.createElement("label");
    edit.className = "history-edit";
    const editLabel = document.createElement("span");
    editLabel.textContent = t("Ergebnis bearbeiten", "Edit result");
    const textarea = document.createElement("textarea");
    textarea.maxLength = 1_000_000;
    textarea.value = historyDrafts.has(entry.id) ? historyDrafts.get(entry.id) : entry.text || entry.rawText;
    textarea.disabled = state.preview;
    textarea.addEventListener("input", () => historyDrafts.set(entry.id, textarea.value));
    edit.append(editLabel, textarea);
    article.appendChild(edit);

    const actions = document.createElement("div");
    actions.className = "history-actions";
    const addAction = (label, handler, className = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = className;
      button.disabled = state.preview;
      button.addEventListener("click", async () => {
        try { await handler(); } catch (error) { setFeedback(error.message || t("Aktion nicht möglich.", "Action is not available."), true); }
      });
      actions.appendChild(button);
    };
    addAction(t("Änderung speichern", "Save change"), async () => {
      const result = await api.action("save-history-text", { id: entry.id, text: textarea.value });
      historyDrafts.delete(entry.id);
      render(result);
      setFeedback(result.notice || t("Gespeichert.", "Saved."));
    });
    addAction(t("TXT exportieren", "Export TXT"), async () => {
      const result = await api.action("export-history", { id: entry.id, format: "txt" });
      render(result);
      if (result.notice) setFeedback(result.notice);
    });
    addAction(t("Markdown exportieren", "Export Markdown"), async () => {
      const result = await api.action("export-history", { id: entry.id, format: "md" });
      render(result);
      if (result.notice) setFeedback(result.notice);
    });
    if (entry.audioRetained) addAction(t("Audio löschen", "Delete audio"), async () => {
      if (!window.confirm(t("Das lokal aufbewahrte Audio löschen? Der Text bleibt erhalten.", "Delete the locally stored audio? The text will remain."))) return;
      const result = await api.action("remove-retained-audio", { id: entry.id });
      render(result);
      setFeedback(result.notice || t("Audio gelöscht.", "Audio deleted."));
    }, "danger");
    addAction(t("Löschen", "Delete"), async () => {
      if (!window.confirm(entry.audioRetained
        ? t("Diesen Verlaufseintrag und das lokal aufbewahrte Audio wirklich löschen?", "Really delete this history entry and its locally stored audio?")
        : t("Diesen lokalen Verlaufseintrag wirklich löschen?", "Really delete this local history entry?"))) return;
      const result = await api.action("delete-history", { id: entry.id });
      historyDrafts.delete(entry.id);
      render(result);
      setFeedback(result.notice || t("Gelöscht.", "Deleted."));
    }, "danger");
    article.appendChild(actions);
    if (entry.warning || entry.error) {
      const warning = document.createElement("p");
      warning.className = "history-warning";
      warning.textContent = entry.warning || entry.error;
      article.appendChild(warning);
    }
    list.appendChild(article);
  }
  $("clear-history").disabled = state.preview || !state.history.length;
}

function outputBlock(label, value, className = "") {
  const block = document.createElement("div");
  block.className = `job-output ${className}`.trim();
  const caption = document.createElement("small");
  caption.textContent = label;
  const content = document.createElement("pre");
  content.textContent = value;
  block.append(caption, content);
  return block;
}

function setFeedback(text, error = false) {
  $("workspace-feedback").textContent = text;
  $("workspace-feedback").classList.toggle("error", error);
}

function render(state) {
  snapshot = state;
  i18n.setLanguage(state.interfaceLanguage);
  $("workspace-version").textContent = `Nivune ${state.version}${state.preview ? t(" · Isolierte Vorschau", " · Isolated preview") : ""}`;
  $("workspace-status").textContent = state.busy ? state.busyLabel : t("Bereit", "Ready");
  $("workspace-shortcut").textContent = state.shortcut;
  $("audio-flow").textContent = state.audioDestination;
  $("refinement-flow").textContent = state.refinementDestination;
  $("start-dictation").disabled = state.busy || state.preview;
  $("start-dictation").textContent = state.busy ? state.busyLabel : t("Systemweit diktieren", "Dictate system-wide");
  const captureState = state.captureState || "idle";
  $("capture-card").dataset.state = captureState;
  $("capture-label").textContent = captureState === "recording" ? t("Aufnahme läuft", "Recording")
    : captureState === "paused" ? t("Aufnahme pausiert", "Recording paused") : t("Bereit für eine Aufnahme", "Ready to record");
  $("capture-detail").textContent = captureState === "recording" ? t("Du kannst pausieren oder die Aufnahme zur Verarbeitung geben.", "You can pause or submit the recording for processing.")
    : captureState === "paused" ? t("Das Mikrofon bleibt reserviert, nimmt aber keine weiteren Daten auf.", "The microphone remains reserved but records no additional data.")
      : t("Die Sprachaktivierung pausiert während Aufnahme und Verarbeitung.", "Voice activation pauses during recording and processing.");
  $("start-recording").hidden = captureState !== "idle";
  $("start-recording").disabled = state.busy || state.preview;
  $("pause-recording").hidden = captureState !== "recording";
  $("resume-recording").hidden = captureState !== "paused";
  $("stop-recording").hidden = captureState === "idle";
  $("cancel-recording").hidden = captureState === "idle";
  $("import-file").disabled = state.globalBusy || captureState !== "idle" || state.preview;
  $("retain-audio").checked = state.audioRetention;
  $("retain-audio").disabled = state.preview;
  $("recording-storage-label").textContent = state.recordingStorageLabel;
  $("show-recording-storage").disabled = state.preview;
  document.querySelector('[data-action="export-settings"]').disabled = state.preview;
  document.querySelector('[data-action="import-settings"]').disabled = state.busy || state.preview;
  renderJobs(state);
  renderRecoveries(state);
  renderHistory(state);
  i18n.setLanguage(state.interfaceLanguage);

  if (!reportedFirstRender) {
    reportedFirstRender = true;
    api.rendered({
      pages: [...document.querySelectorAll("[data-page]")].map((element) => element.dataset.page),
      audioDestination: $("audio-flow").textContent,
      refinementDestination: $("refinement-flow").textContent,
    });
  }
}

document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-page]").forEach((element) => {
    element.setAttribute("aria-current", element === button ? "page" : "false");
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== button.dataset.page;
  });
  document.querySelector(".workspace-content").scrollTop = 0;
  setFeedback("");
}));

async function beginRecording() {
  const state = await api.action("start-recording");
  render(state);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    fragmentSequence = 0;
    fragmentQueue = Promise.resolve();
    fragmentFailure = null;
    discardFragments = false;
    const mimeType = recordingMimeType();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.addEventListener("dataavailable", queueRecordingFragment);
    recorder.addEventListener("error", async (event) => {
      stopMedia();
      recorder = null;
      await fragmentQueue;
      await api.action("interrupt-recording").then(render).catch(() => {});
      setFeedback(t(`${event.error?.message || "Die Aufnahme wurde unerwartet beendet."} Gespeicherte Fragmente bleiben wiederherstellbar.`, `${event.error?.message || "The recording ended unexpectedly."} Saved fragments remain recoverable.`), true);
    });
    recorder.start(5000);
    captureStartedAt = Date.now();
    pausedAt = 0;
    pausedDuration = 0;
    updateCaptureTime();
    timer = setInterval(updateCaptureTime, 250);
  } catch (error) {
    stopMedia();
    await api.action("cancel-recording").catch(() => {});
    throw error;
  }
}

async function pauseRecording() {
  if (!recorder || recorder.state !== "recording") throw new Error(t("Die Aufnahme läuft nicht.", "The recording is not running."));
  recorder.requestData();
  recorder.pause();
  pausedAt = Date.now();
  render(await api.action("pause-recording"));
}

async function resumeRecording() {
  if (!recorder || recorder.state !== "paused") throw new Error(t("Die Aufnahme ist nicht pausiert.", "The recording is not paused."));
  recorder.resume();
  pausedDuration += Date.now() - pausedAt;
  pausedAt = 0;
  render(await api.action("resume-recording"));
}

function finishRecorder() {
  return new Promise((resolve, reject) => {
    if (!recorder || recorder.state === "inactive") return reject(new Error(t("Die Aufnahme ist nicht aktiv.", "The recording is not active.")));
    recorder.addEventListener("stop", resolve, { once: true });
    recorder.addEventListener("error", (event) => reject(event.error || new Error(t("Aufnahmefehler", "Recording error"))), { once: true });
    recorder.stop();
  });
}

async function submitRecording() {
  const activeCaptureId = snapshot?.captureId;
  const elapsed = elapsedCaptureTime();
  await finishRecorder();
  stopMedia();
  await fragmentQueue;
  recorder = null;
  if (fragmentFailure) {
    const error = fragmentFailure;
    fragmentFailure = null;
    render(await api.action("interrupt-recording"));
    throw new Error(t(`${error.message || "Ein Fragment konnte nicht gespeichert werden."} Die übrige Arbeitskopie bleibt erhalten.`, `${error.message || "A fragment could not be saved."} The remaining working copy is kept.`));
  }
  render(await api.finishRecording({ captureId: activeCaptureId, durationMs: elapsed }));
}

async function cancelRecording() {
  discardFragments = true;
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
  await fragmentQueue;
  fragmentFailure = null;
  stopMedia();
  captureStartedAt = 0;
  $("capture-time").textContent = "0:00";
  render(await api.action("cancel-recording"));
}

document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
  try {
    const action = button.dataset.action;
    if (action === "start-recording") return await beginRecording();
    if (action === "pause-recording") return await pauseRecording();
    if (action === "resume-recording") return await resumeRecording();
    if (action === "stop-recording") return await submitRecording();
    if (action === "cancel-recording") return await cancelRecording();
    const result = await api.action(action);
    if (result) {
      render(result);
      if (result.notice) setFeedback(result.notice);
    }
  } catch (error) {
    setFeedback(error.message || t("Aktion nicht möglich.", "Action is not available."), true);
  }
}));

$("history-search").addEventListener("input", () => {
  if (snapshot) renderHistory(snapshot);
});

$("clear-history").addEventListener("click", async () => {
  if (!window.confirm(t("Den gesamten lokalen Verlauf und darin aufbewahrtes Audio unwiderruflich löschen?", "Permanently delete all local history and any audio stored in it?"))) return;
  try {
    const result = await api.action("clear-history");
    historyDrafts.clear();
    render(result);
    setFeedback(result.notice || t("Verlauf gelöscht.", "History deleted."));
  } catch (error) {
    setFeedback(error.message || t("Verlauf konnte nicht gelöscht werden.", "History could not be deleted."), true);
  }
});

$("retain-audio").addEventListener("change", async (event) => {
  try {
    const result = await api.action("set-audio-retention", { enabled: event.target.checked });
    render(result);
    setFeedback(result.notice || t("Aufbewahrung aktualisiert.", "Retention setting updated."));
  } catch (error) {
    event.target.checked = snapshot?.audioRetention === true;
    setFeedback(error.message || t("Aufbewahrung konnte nicht geändert werden.", "Retention setting could not be changed."), true);
  }
});

if (api) {
  api.onChanged(render);
  api.read().then(render).catch((error) => setFeedback(error.message, true));
} else {
  setFeedback(t("Dieser Arbeitsbereich wird in Nivune Desktop geöffnet.", "This workspace opens in Nivune Desktop."), true);
  document.querySelectorAll("button:not([data-page])").forEach((button) => { button.disabled = true; });
}
