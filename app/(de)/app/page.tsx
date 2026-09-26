"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
import UploadPanel, { type UploadResult } from "@/components/UploadPanel";
import HistoryPanel from "@/components/HistoryPanel";
import DownloadPanel from "@/components/DownloadPanel";
import { useDictation } from "@/hooks/useDictation";
import { MAX_LIVE_RECORDING_SECONDS } from "@/lib/audio-recorder";
import {
  inspectOfflineReadiness,
  prepareOfflineShell,
  remainingStorageBytes,
  requestPersistentModelStorage,
  type OfflineReadiness,
} from "@/lib/offline";
import { createCloudTranscriptionRequest, processExistingTranscript, processQualityDictation, type QualityDictationJob } from "@/lib/process-dictation";
import {
  inspectLocalModel,
  prepareLocalModel,
  removeLocalModel,
  transcribeLocally,
  type LocalModelProgress,
  type LocalModelStatus,
} from "@/lib/local-transcribe";
import { translate, uiText } from "@/shared/i18n";
import { LOCAL_MODELS } from "@/shared/local-models";
import { listOllamaModels } from "@/shared/ollama-provider";
import { listCompatibleModels, listGroqTranscriptionModels } from "@/shared/provider-models";
import { normalizeCompatibleBaseUrl } from "@/shared/cloud-transcription-providers";
import { compatibleCredentialRef } from "@/shared/credential-refs";
import {
  DEFAULT_SETTINGS,
  LANGUAGES,
  WHISPER_MODELS,
  addHistory,
  clearHistory,
  countWords,
  loadHistory,
  loadSettingsResult,
  removeHistory,
  saveSettings,
  type HistoryEntry,
  type Settings,
} from "@/lib/store";

type Tab = "diktat" | "dateien" | "verlauf" | "desktop";

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("diktat");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [composing, setComposing] = useState(false);
  const [settingsSection, setSettingsSection] = useState("transkription");
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [dark, setDark] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [lastRaw, setLastRaw] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Aufnahme abschließen …");
  const [notice, setNotice] = useState<{ kind: "error" | "warning" | "success"; message: string } | null>(null);
  const pendingJob = useRef<QualityDictationJob | null>(null);
  const processingRef = useRef(false);
  const startPreflightRef = useRef(false);
  const autoStopRequestedRef = useRef(false);

  const d = useDictation(settings.lang, settings.interfaceLanguage);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef("");
  finalRef.current = d.finalText;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionStartWords = useRef(0);
  const sessionPrefix = useRef("");
  const sessionStartAt = useRef(0);
  const sessionSettings = useRef(settings);
  const spaceHold = useRef(false);
  const listeningRef = useRef(false);
  listeningRef.current = d.listening;

  /* ---------- Hydration & Persistenz ---------- */
  useEffect(() => {
    const loaded = loadSettingsResult();
    setSettings(loaded.settings);
    if (loaded.warning) setNotice({ kind: "warning", message: loaded.warning });
    setHistory(loadHistory());
    setDark(document.documentElement.dataset.theme === "dark");
    setHydrated(true);
  }, []);

  useEffect(() => {
    void prepareOfflineShell();
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    document.documentElement.lang = settings.interfaceLanguage;
    document.title = uiText(settings.interfaceLanguage, "Nivune – Deine Stimme. Dein Text.", "Nivune – Your voice. Your text.");
    if (!processingRef.current) setProcessingLabel(translate(settings.interfaceLanguage, "processing.captureFinalizing"));
  }, [settings.interfaceLanguage]);

  useEffect(() => {
    if (showSettings) settingsDialog.current?.showModal();
    else settingsDialog.current?.close();
  }, [showSettings]);

  useEffect(() => { if (composing) editor.current?.focus(); }, [composing]);

  /* ---------- Helfer ---------- */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(uiText(settingsRef.current.interfaceLanguage, "Kopiert. Wechsle jetzt die App und füge ein.", "Copied. Switch to the other app and paste."));
        return true;
      } catch {
        showToast(uiText(settingsRef.current.interfaceLanguage, "Kopieren nicht möglich. Bitte markiere den Text manuell.", "Could not copy. Please select the text manually."));
        return false;
      }
    },
    [showToast]
  );

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("klartext.theme", next ? "dark" : "light");
    } catch {
      /* privat-Modus o. ä. */
    }
  };

  /* ---------- Diktat: Start / Stopp ---------- */
  const startDictation = useCallback(async () => {
    if (listeningRef.current || processingRef.current || startPreflightRef.current) return;
    startPreflightRef.current = true;
    try {
    if (!d.supported) {
      showToast(uiText(settingsRef.current.interfaceLanguage, "Live-Diktat wird von diesem Browser nicht unterstützt", "Live dictation is not supported by this browser"));
      return;
    }
    const s = settingsRef.current;
    if (s.cleanup !== "aus" && s.refinementProvider === "openai" && !s.openaiApiKey.trim()) {
      setNotice({ kind: "error", message: uiText(s.interfaceLanguage, "Für die gewählte OpenAI-Verarbeitung fehlt dein API-Key. Bitte ergänze ihn in den Einstellungen.", "Your API key is missing for the selected OpenAI processing step. Add it in Settings.") });
      setSettingsSection("transkription");
      setShowSettings(true);
      return;
    }
    if (s.cleanup !== "aus" && s.refinementProvider === "openai-compatible"
      && (!normalizeCompatibleBaseUrl(s.compatibleRefinementBaseUrl) || !s.compatibleRefinementModel.trim())) {
      setNotice({ kind: "error", message: uiText(s.interfaceLanguage, "Für die gewählte Textüberarbeitung fehlen eine sichere Server-Adresse oder Modell-ID.", "The selected text refinement is missing a secure server address or model ID.") });
      setSettingsSection("transkription");
      setShowSettings(true);
      return;
    }
    if (s.transcriptionMode === "quality") {
      try {
        createCloudTranscriptionRequest(s);
      } catch (error) {
        setNotice({ kind: "error", message: error instanceof Error ? error.message : uiText(s.interfaceLanguage, "Der Qualitätsanbieter ist noch nicht vollständig eingerichtet.", "The quality provider is not fully configured yet.") });
        setSettingsSection("transkription");
        setShowSettings(true);
        return;
      }
    }
    if (s.transcriptionMode === "local") {
      let modelStatus;
      try {
        modelStatus = await inspectLocalModel(WHISPER_MODELS[s.whisperModel]);
      } catch {
        setNotice({ kind: "error", message: translate(s.interfaceLanguage, "error.local.storageUnavailable") });
        setSettingsSection("transkription");
        setShowSettings(true);
        return;
      }
      if (modelStatus.state !== "ready") {
        setNotice({ kind: "warning", message: translate(s.interfaceLanguage, "error.local.modelNotReady") });
        setSettingsSection("transkription");
        setShowSettings(true);
        return;
      }
    }
    pendingJob.current = null;
    setNotice(null);
    setShowRaw(false);
    setTab("diktat");
    sessionStartWords.current = countWords(finalRef.current);
    sessionPrefix.current = finalRef.current.trim();
    sessionStartAt.current = Date.now();
    autoStopRequestedRef.current = false;
    sessionSettings.current = { ...s, dictionary: [...s.dictionary] };
    void d.start();
    } finally {
      startPreflightRef.current = false;
    }
  }, [d, showToast]);

  const runQualityJob = useCallback(async (job: QualityDictationJob) => {
    pendingJob.current = job;
    try {
      const result = await processQualityDictation(job, setProcessingLabel);
      const text = [job.prefix, result.text].filter(Boolean).join(" ");
      const raw = [job.prefix, result.raw].filter(Boolean).join(" ");
      d.setFinalText(text);
      setLastRaw(raw);
      if (result.warning) {
        setNotice({ kind: "warning", message: result.warning });
        return;
      }
      pendingJob.current = null;
      setHistory(addHistory({
        id: crypto.randomUUID(), ts: Date.now(), source: "diktat", text, raw,
        words: countWords(result.text), durationSec: Math.round(job.duration),
      }));
      const refinement = job.settings.cleanup === "aus" ? "none" : job.settings.refinementProvider;
      const transcriptionLabel = job.settings.transcriptionProvider === "groq"
        ? "Groq" : job.settings.transcriptionProvider === "openai-compatible"
          ? uiText(job.settings.interfaceLanguage, "kompatiblem Server", "compatible server") : "GPT Transcribe";
      setNotice({ kind: "success", message: refinement === "openai"
        ? uiText(job.settings.interfaceLanguage, `Mit ${transcriptionLabel} verarbeitet · OpenAI-Feinschliff abgeschlossen.`, `Processed with ${transcriptionLabel} · OpenAI refinement complete.`)
        : refinement === "ollama"
          ? uiText(job.settings.interfaceLanguage, `Mit ${transcriptionLabel} verarbeitet · lokal über Ollama überarbeitet.`, `Processed with ${transcriptionLabel} · refined locally with Ollama.`)
          : refinement === "openai-compatible"
            ? uiText(job.settings.interfaceLanguage, `Mit ${transcriptionLabel} verarbeitet · über den kompatiblen Textserver überarbeitet.`, `Processed with ${transcriptionLabel} · refined by the compatible text server.`)
          : uiText(job.settings.interfaceLanguage, `Mit ${transcriptionLabel} verarbeitet · ohne KI-Feinschliff.`, `Processed with ${transcriptionLabel} · without AI refinement.`) });
      if (job.settings.autoCopy) void copy(text);
    } catch (error) {
      setNotice({ kind: "error", message: `${error instanceof Error ? error.message : uiText(job.settings.interfaceLanguage, "KI-Verarbeitung fehlgeschlagen.", "AI processing failed.")} ${uiText(job.settings.interfaceLanguage, "Die Aufnahme bleibt für einen erneuten Versuch in diesem Tab erhalten. Nicht automatisch kopiert oder gespeichert.", "The recording remains in this tab for another attempt. It was not copied or saved automatically.")}` });
    }
  }, [d, copy]);

  const retryDictation = useCallback(async () => {
    const job = pendingJob.current;
    if (!job || processingRef.current || listeningRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    job.settings = {
      ...job.settings,
      openaiApiKey: settingsRef.current.openaiApiKey,
      groqApiKey: settingsRef.current.groqApiKey,
      groqModel: settingsRef.current.groqModel,
      compatibleTranscriptionBaseUrl: settingsRef.current.compatibleTranscriptionBaseUrl,
      compatibleTranscriptionModel: settingsRef.current.compatibleTranscriptionModel,
      compatibleTranscriptionApiKey: settingsRef.current.compatibleTranscriptionApiKey,
      compatibleTranscriptionCredentialRef: settingsRef.current.compatibleTranscriptionCredentialRef,
      transcriptionProvider: settingsRef.current.transcriptionProvider,
      refinementProvider: settingsRef.current.refinementProvider,
      ollamaBaseUrl: settingsRef.current.ollamaBaseUrl,
      ollamaModel: settingsRef.current.ollamaModel,
      compatibleRefinementBaseUrl: settingsRef.current.compatibleRefinementBaseUrl,
      compatibleRefinementModel: settingsRef.current.compatibleRefinementModel,
      compatibleRefinementApiKey: settingsRef.current.compatibleRefinementApiKey,
      compatibleRefinementCredentialRef: settingsRef.current.compatibleRefinementCredentialRef,
    };
    try { await runQualityJob(job); }
    finally { processingRef.current = false; setProcessing(false); }
  }, [runQualityJob]);

  const finishDictation = useCallback(async () => {
    if (!listeningRef.current || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setProcessingLabel(translate(settingsRef.current.interfaceLanguage, "processing.captureFinalizing"));
    const duration = (Date.now() - sessionStartAt.current) / 1000;
    try {
      const audio = await d.stop();
      const s = sessionSettings.current;
      if (s.transcriptionMode === "quality") {
        if (!audio?.size) throw new Error(translate(s.interfaceLanguage, "error.local.audioEmpty"));
        await runQualityJob({ audio, settings: s, prefix: sessionPrefix.current, duration });
        return;
      }
      if (!audio?.size) throw new Error(translate(s.interfaceLanguage, "error.local.audioEmpty"));
      const dictatedRaw = await transcribeLocally(audio, {
        interfaceLanguage: s.interfaceLanguage,
        language: s.lang.split("-")[0] || null,
        model: s.whisperModel === "genau"
          ? "onnx-community/whisper-small"
          : "onnx-community/whisper-base",
      }, (event) => setProcessingLabel(event.detail));
      const originalRaw = [sessionPrefix.current, dictatedRaw].filter(Boolean).join(" ");
      const processed = await processExistingTranscript(originalRaw, s, (stage) => {
        if (stage === "refining") setProcessingLabel(translate(s.interfaceLanguage, "processing.refining"));
      });
      const cleaned = processed.text;
      const sessionWords = Math.max(
        0,
        countWords(cleaned) - sessionStartWords.current
      );
      if (!cleaned || sessionWords === 0) return;
      d.setFinalText(cleaned);
      setLastRaw(originalRaw);

      const final = cleaned;

      setHistory(
        addHistory({
          id: crypto.randomUUID(),
          ts: Date.now(),
          source: "diktat",
          text: final,
          raw: originalRaw,
          words: Math.max(1, countWords(final) - sessionStartWords.current),
          durationSec: Math.round(duration),
        })
      );
      setNotice({
        kind: processed.warning ? "warning" : "success",
        message: processed.warning
          ? uiText(s.interfaceLanguage, "Die lokale Transkription ist erhalten; die gewählte Textüberarbeitung war nicht verfügbar.", "The local transcription was preserved; the selected text refinement was unavailable.")
          : s.refinementProvider === "ollama"
            ? uiText(s.interfaceLanguage, "Mit Whisper transkribiert und lokal über Ollama überarbeitet.", "Transcribed with Whisper and refined locally with Ollama.")
            : s.refinementProvider === "openai-compatible"
              ? uiText(s.interfaceLanguage, "Mit Whisper transkribiert und über den kompatiblen Textserver überarbeitet.", "Transcribed with Whisper and refined by the compatible text server.")
            : uiText(s.interfaceLanguage, "Auf diesem Gerät mit Whisper transkribiert.", "Transcribed with Whisper on this device."),
      });
      if (s.autoCopy) copy(final);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : uiText(settingsRef.current.interfaceLanguage, "Aufnahme fehlgeschlagen. Bitte erneut versuchen.", "Recording failed. Please try again.") });
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [d, copy, runQualityJob]);

  const toggleDictation = useCallback(() => {
    if (listeningRef.current) finishDictation();
    else startDictation();
  }, [finishDictation, startDictation]);

  /* ---------- Aufnahme-Timer ---------- */
  useEffect(() => {
    if (!d.listening) {
      autoStopRequestedRef.current = false;
      setSeconds(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - sessionStartAt.current) / 1000);
      setSeconds(Math.min(elapsed, MAX_LIVE_RECORDING_SECONDS));
      if (elapsed >= MAX_LIVE_RECORDING_SECONDS && !autoStopRequestedRef.current) {
        autoStopRequestedRef.current = true;
        void finishDictation();
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [d.listening, finishDictation]);

  /* ---------- Tastatur: Leertaste halten (Push-to-talk), ⌘⇧Leer, Esc ---------- */
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "TEXTAREA" ||
          el.tagName === "INPUT" ||
          el.tagName === "SELECT" ||
          el.tagName === "BUTTON" ||
          el.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent) => {
      if (settingsDialog.current?.open) return;
      if (e.code === "Space" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        toggleDictation();
        return;
      }
      if (e.key === "Escape" && listeningRef.current) {
        e.preventDefault();
        finishDictation();
        return;
      }
      if (e.code === "Space" && !isTyping()) {
        e.preventDefault();
        if (!e.repeat && !listeningRef.current) {
          spaceHold.current = true;
          startDictation();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceHold.current) {
        spaceHold.current = false;
        if (listeningRef.current) finishDictation();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [toggleDictation, startDictation, finishDictation]);

  /* ---------- Datei-Transkription fertig ---------- */
  const onUploadDone = useCallback(
    (r: UploadResult) => {
      setHistory(
        addHistory({
          id: crypto.randomUUID(),
          ts: Date.now(),
          source: "datei",
          text: r.text,
          raw: r.raw,
          label: r.label,
          words: countWords(r.text),
          durationSec: r.durationSec,
        })
      );
      showToast(uiText(settingsRef.current.interfaceLanguage, "Transkription fertig ✓", "Transcription complete ✓"));
    },
    [showToast]
  );

  const words = countWords(d.finalText);
  const langLabel = settings.lang === "de-DE" && settings.interfaceLanguage === "en"
    ? "German"
    : LANGUAGES.find((l) => l.code === settings.lang)?.label ?? settings.lang;

  const hasDocument = Boolean(d.finalText) || composing;
  const qualityNeedsSetup = settings.transcriptionMode === "quality" && (
    settings.transcriptionProvider === "openai" ? !settings.openaiApiKey.trim()
      : settings.transcriptionProvider === "groq" ? !settings.groqApiKey.trim() || !settings.groqModel.trim()
        : !normalizeCompatibleBaseUrl(settings.compatibleTranscriptionBaseUrl) || !settings.compatibleTranscriptionModel.trim()
  );
  const needsKey = qualityNeedsSetup
    || (settings.cleanup !== "aus" && settings.refinementProvider === "openai" && !settings.openaiApiKey.trim())
    || (settings.cleanup !== "aus" && settings.refinementProvider === "openai-compatible"
      && (!normalizeCompatibleBaseUrl(settings.compatibleRefinementBaseUrl) || !settings.compatibleRefinementModel.trim()));
  const captureControl = processing ? (
    <div className="processing-pill" role="status"><span className="spinner" /><span>{processingLabel}</span></div>
  ) : d.listening ? (
    <div className="recording-controls">
      <span className="recording-label">{uiText(settings.interfaceLanguage, "Aufnahme", "Recording")}</span>
      <Waveform stream={d.stream} className="capture-wave" />
      <span className="capture-time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
      <button onClick={finishDictation} className="stop-button" aria-label={uiText(settings.interfaceLanguage, "Aufnahme beenden", "Stop recording")}><StopIcon /></button>
    </div>
  ) : (
    <button onClick={startDictation} className="capture-button"><LogoBars /><span>{needsKey ? uiText(settings.interfaceLanguage, "Diktat einrichten", "Set up dictation") : hasDocument ? uiText(settings.interfaceLanguage, "Weiter diktieren", "Continue dictating") : uiText(settings.interfaceLanguage, "Diktieren", "Dictate")}</span></button>
  );

  return (
    <div className="app-shell min-h-dvh">
      <aside className="desktop-sidebar kt-glass">
        <div className="brand-lockup">
          <span className="brand-mark"><LogoBars /></span>
          <div>
            <div className="brand-name">Nivune</div>
            <div className="brand-caption">{uiText(settings.interfaceLanguage, "Deine Stimme. Dein Text.", "Your voice. Your text.")}</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={uiText(settings.interfaceLanguage, "Hauptnavigation", "Main navigation")}>
          {([
            ["diktat", uiText(settings.interfaceLanguage, "Diktat", "Dictation")],
            ["dateien", uiText(settings.interfaceLanguage, "Dateien", "Files")],
            ["verlauf", uiText(settings.interfaceLanguage, "Verlauf", "History")],
            ["desktop", uiText(settings.interfaceLanguage, "Desktop-App", "Desktop app")],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} data-active={tab === key}>
              <NavIcon tab={key} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="quality-card">
          <div className="quality-card-head">
            <span className="status-orb" />
            {settings.transcriptionMode === "quality" ? uiText(settings.interfaceLanguage, "Beste Qualität", "Best quality") : uiText(settings.interfaceLanguage, "Lokal", "Local")}
          </div>
          <p>
            {settings.transcriptionMode === "quality"
              ? qualityNeedsSetup
                ? uiText(settings.interfaceLanguage, "Anbieter vollständig einrichten, um den Qualitätsmodus zu aktivieren.", "Finish setting up the provider to enable best quality.")
                : uiText(settings.interfaceLanguage, `${settings.transcriptionProvider === "groq" ? "Groq" : settings.transcriptionProvider === "openai-compatible" ? "Kompatibler Server" : "OpenAI"} ist ausgewählt. Die Verbindung wird erst bei Nutzung geprüft.`, `${settings.transcriptionProvider === "groq" ? "Groq" : settings.transcriptionProvider === "openai-compatible" ? "Compatible server" : "OpenAI"} is selected. The connection is checked only when used.`)
              : uiText(settings.interfaceLanguage, "Diktate und Dateien werden auf diesem Gerät mit Whisper verarbeitet.", "Dictations and files are processed with Whisper on this device.")}
          </p>
        </div>
        <div className="sidebar-actions">
          <button onClick={toggleTheme} aria-label={uiText(settings.interfaceLanguage, "Design wechseln", "Change appearance")} className="icon-btn">
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={() => setShowSettings(true)} className="settings-button">
            <GearIcon /> {uiText(settings.interfaceLanguage, "Einstellungen", "Settings")}
          </button>
        </div>
      </aside>

      <section className="app-workspace">
        <div className="workspace-topbar"><span>{({diktat:uiText(settings.interfaceLanguage,"Sprachraum","Voice space"),dateien:uiText(settings.interfaceLanguage,"Audio importieren","Import audio"),verlauf:uiText(settings.interfaceLanguage,"Deine Aufnahmen","Your recordings"),desktop:uiText(settings.interfaceLanguage,"Überall diktieren","Dictate anywhere")})[tab]}</span>{tab === "diktat" ? <span>{uiText(settings.interfaceLanguage, "Auf diesem Gerät", "On this device")} <span className="small-signal" /></span> : captureControl}</div>
        <header className="mobile-header">
          <div className="brand-lockup compact">
            <span className="brand-mark"><LogoBars /></span>
            <span className="brand-name">Nivune</span>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} aria-label={uiText(settings.interfaceLanguage, "Design wechseln", "Change appearance")} className="icon-btn">
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => setShowSettings(true)} aria-label={uiText(settings.interfaceLanguage, "Einstellungen", "Settings")} className="icon-btn">
              <GearIcon />
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label={uiText(settings.interfaceLanguage, "Hauptnavigation", "Main navigation")}>
          {([
            ["diktat", uiText(settings.interfaceLanguage, "Diktat", "Dictation")],
            ["dateien", uiText(settings.interfaceLanguage, "Dateien", "Files")],
            ["verlauf", uiText(settings.interfaceLanguage, "Verlauf", "History")],
            ["desktop", "Desktop"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} data-active={tab === key}>
              <NavIcon tab={key} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {tab !== "diktat" && <div className="mobile-capture">{captureControl}</div>}

        <dialog ref={settingsDialog} className="settings-window" onCancel={() => setShowSettings(false)} onClose={() => setShowSettings(false)} aria-label={uiText(settings.interfaceLanguage, "Einstellungen", "Settings")}>
          <div className="settings-titlebar"><span className="settings-wordmark"><LogoBars /> Nivune</span><span>{uiText(settings.interfaceLanguage, "Einstellungen", "Settings")}</span><button onClick={() => setShowSettings(false)} className="icon-btn" aria-label={uiText(settings.interfaceLanguage, "Einstellungen schließen", "Close settings")}><CloseIcon /></button></div>
          <div className="settings-layout">
            <nav className="settings-navigation" aria-label={uiText(settings.interfaceLanguage, "Einstellungsbereiche", "Settings sections")}>
              {[["transkription",uiText(settings.interfaceLanguage,"Transkription","Transcription")],["sprache",uiText(settings.interfaceLanguage,"Sprache & Verhalten","Language & behavior")],["kontext",uiText(settings.interfaceLanguage,"Kontext","Context")],["woerterbuch",uiText(settings.interfaceLanguage,"Wörterbuch","Dictionary")]].map(([id,label]) => <button key={id} aria-current={settingsSection === id ? "page" : undefined} onClick={() => setSettingsSection(id)}>{label}</button>)}
              <p>{settings.rememberKeysOnDevice
                ? uiText(settings.interfaceLanguage, "Einstellungen und API-Keys bleiben in diesem Browser gespeichert. Ändern unter Sprache & Verhalten.", "Settings and API keys stay stored in this browser. Change this under Language & behavior.")
                : uiText(settings.interfaceLanguage, "Einstellungen bleiben auf diesem Gerät. API-Keys gelten nur für die aktuelle Browsersitzung.", "Settings stay on this device. API keys last only for the current browser session.")}</p>
            </nav>
            <div className="settings-body"><h2>{({transkription:uiText(settings.interfaceLanguage,"Aus Stimme wird Text.","Turn voice into text."),sprache:uiText(settings.interfaceLanguage,"So arbeitest du.","Your workflow."),kontext:uiText(settings.interfaceLanguage,"Deine Themen.","Your topics."),woerterbuch:uiText(settings.interfaceLanguage,"Deine eigenen Worte.","Your own words.")} as Record<string, string>)[settingsSection]}</h2><SettingsCard settings={settings} setSettings={setSettings} section={settingsSection} /></div>
          </div>
        </dialog>

        <main className="workspace-content">
        {tab === "diktat" && (
          <div className={`dictation-workspace ${hasDocument ? "has-document" : ""}`}>
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">{hasDocument ? uiText(settings.interfaceLanguage, "Dein Text", "Your text") : uiText(settings.interfaceLanguage, "Neues Diktat", "New dictation")}</p>
                <h1>{hasDocument ? uiText(settings.interfaceLanguage, "Zum Weiterdenken.", "Ready to build on.") : uiText(settings.interfaceLanguage, "Dein Gedanke beginnt hier.", "Your thought starts here.")}</h1>
                {!hasDocument && <p>{uiText(settings.interfaceLanguage, "Sprich ihn aus. Der fertige Text folgt nach der Aufnahme.", "Say it out loud. Your finished text appears after recording.")}</p>}
              </div>
              <button className="mode-badge" onClick={() => setShowSettings(true)}>
                <span className="status-orb" />
                <span>
                  <small>{needsKey ? uiText(settings.interfaceLanguage, "Beste Qualität", "Best quality") : uiText(settings.interfaceLanguage, "Modus", "Mode")}</small>
                  {needsKey ? uiText(settings.interfaceLanguage, "Einrichtung fehlt", "Setup required") : settings.transcriptionMode === "quality" ? uiText(settings.interfaceLanguage, "Beste Qualität", "Best quality") : uiText(settings.interfaceLanguage, "Lokal", "Local")}
                </span>
                <ChevronIcon />
              </button>
            </div>

            {!d.supported && (
              <div className="kt-hair rounded-xl bg-lav/40 p-4 text-sm text-lav-ink">
                {settings.transcriptionMode === "local" ? (
                  <>{uiText(settings.interfaceLanguage, "Dein Browser unterstützt hier kein lokales Live-Diktat. Nutze Chrome, Edge oder Safari, wechsle zu", "Your browser does not support local live dictation here. Use Chrome, Edge, or Safari, switch to")} <b>{uiText(settings.interfaceLanguage, "Beste Qualität", "Best quality")}</b> {uiText(settings.interfaceLanguage, "oder transkribiere eine Aufnahme im Tab", "or transcribe a recording from the")} <b>{uiText(settings.interfaceLanguage, "Dateien", "Files")}</b>{uiText(settings.interfaceLanguage, ".", " tab.")}</>
                ) : (
                  <>{uiText(settings.interfaceLanguage, "Dieser Browser kann keine Mikrofonaufnahme starten. Prüfe die Browser-Berechtigungen oder transkribiere eine Aufnahme im Tab", "This browser cannot start a microphone recording. Check browser permissions or transcribe a recording from the")} <b>{uiText(settings.interfaceLanguage, "Dateien", "Files")}</b>{uiText(settings.interfaceLanguage, ".", " tab.")}</>
                )}
              </div>
            )}
            {d.error && (
              <div role="alert" className="kt-hair rounded-xl bg-ember-soft p-4 text-sm text-ink">
                {d.error}
              </div>
            )}
            {notice && (
              <div role={notice.kind === "success" ? "status" : "alert"}
                className={`kt-hair rounded-xl p-4 text-sm text-ink ${notice.kind === "success" ? "bg-teal/12" : "bg-ember-soft"}`}>
                <p>{notice.message}</p>
                {pendingJob.current && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={retryDictation} disabled={processing || d.listening} className="btn btn-primary min-h-11 px-4 text-sm">
                      {pendingJob.current.raw === undefined ? uiText(settings.interfaceLanguage, "Aufnahme erneut verarbeiten", "Process recording again") : uiText(settings.interfaceLanguage, "KI-Feinschliff wiederholen", "Retry AI refinement")}
                    </button>
                    <button onClick={() => setShowSettings(true)} disabled={processing} className="btn btn-ghost min-h-11 px-4 text-sm">{uiText(settings.interfaceLanguage, "Einstellungen", "Settings")}</button>
                    <p className="w-full text-xs text-mut">{uiText(settings.interfaceLanguage, "Die Aufnahme bleibt bis zum nächsten Diktat oder Neuladen nur in diesem Tab erhalten. Erneute API-Versuche können Kosten verursachen.", "The recording remains only in this tab until the next dictation or reload. Retrying API requests may incur costs.")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Editor-Karte */}
            <div
              className={`editor-card kt-card rise rise-2 p-6 transition-shadow duration-300 sm:p-8 ${
                d.listening ? "kt-elevated" : ""
              }`}
            >
              {processing ? (
                <div className="capture-stage" role="status"><div className="processing-orbit"><span /></div><h2>{uiText(settings.interfaceLanguage, "Aus Sprache wird Text.", "Turn voice into text.")}</h2><p>{processingLabel}</p></div>
              ) : d.listening ? (
                <div className="listening-stage">
                  <div className="capture-stage"><div className="listening-aperture"><Waveform stream={d.stream} bars={13} className="live-wave" /></div><h2>{uiText(settings.interfaceLanguage, "Du hast das Wort.", "You have the floor.")}</h2><p>{uiText(settings.interfaceLanguage, "Nivune hört zu. Dein Text erscheint nach dem Stoppen.", "Nivune is listening. Your text appears after you stop.")}</p></div>
                </div>
              ) : hasDocument ? (
                <textarea ref={editor} value={d.finalText} aria-label={uiText(settings.interfaceLanguage, "Diktierter Text", "Dictated text")} onChange={(e) => d.setFinalText(e.target.value)} placeholder={uiText(settings.interfaceLanguage, "Deine Worte …", "Your words …")} className="transcript-editor" />
              ) : (
                <div className="capture-stage idle-stage"><button className="resonance-aperture" onClick={startDictation} aria-label={uiText(settings.interfaceLanguage, "Diktat starten", "Start dictation")}><LogoBars /></button><p className="ready-label">{needsKey ? uiText(settings.interfaceLanguage, "Einmal einrichten. Dann lossprechen.", "Set it up once, then start speaking.") : uiText(settings.interfaceLanguage, "Bereit, wenn du es bist.", "Ready when you are.")}</p><button className="write-instead" onClick={() => setComposing(true)}>{uiText(settings.interfaceLanguage, "Oder direkt schreiben", "Or type directly")} <span aria-hidden="true">↗</span></button></div>
              )}

              <div className="editor-meta">
                <span className="chip bg-teal/12 text-teal">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                  {langLabel}
                </span>
                <span className="text-xs font-medium text-mut">{words} {uiText(settings.interfaceLanguage, "Wörter", "words")}</span>
                {lastRaw && lastRaw !== d.finalText && !d.listening && (
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs font-semibold text-mut underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {showRaw ? uiText(settings.interfaceLanguage, "Original ausblenden", "Hide original") : uiText(settings.interfaceLanguage, "Original anzeigen", "Show original")}
                  </button>
                )}
                <div className="editor-actions" hidden={!hasDocument}>
                  <button
                    onClick={() => {
                      d.setFinalText("");
                      setComposing(false);
                      setLastRaw(null);
                      setShowRaw(false);
                      pendingJob.current = null;
                      setNotice(null);
                    }}
                    disabled={!d.finalText || processing || d.listening}
                    className="btn btn-ghost px-4 py-2 text-xs"
                  >
                    {uiText(settings.interfaceLanguage, "Leeren", "Clear")}
                  </button>
                  <button
                    onClick={() => copy(d.finalText)}
                    disabled={!d.finalText || processing || d.listening}
                    className="btn btn-secondary px-5 py-2 text-xs"
                  >
                    <CopyIcon />
                    {uiText(settings.interfaceLanguage, "Kopieren", "Copy")}
                  </button>
                </div>
              </div>

              {showRaw && lastRaw && (
                <div className="pop mt-3 rounded-2xl bg-surface-2 p-4 text-sm text-mut kt-hair">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mut">
                    {uiText(settings.interfaceLanguage, "Original (ohne Nivune-Aufräumen)", "Original (without Nivune cleanup)")}
                  </p>
                  <p className="whitespace-pre-wrap">{lastRaw}</p>
                </div>
              )}
            </div>

            <div className="capture-footer">{captureControl}{settings.interfaceLanguage === "en" ? <p>Hold <Kbd>Space</Kbd> to dictate<br /><span><Kbd>⌘/Ctrl</Kbd> + <Kbd>⇧</Kbd> + <Kbd>Space</Kbd> to start / stop</span></p> : <p><Kbd>Leertaste</Kbd> halten zum Diktieren<br /><span><Kbd>⌘/Strg</Kbd> + <Kbd>⇧</Kbd> + <Kbd>Leer</Kbd> für Start / Stopp</span></p>}</div>
          </div>
        )}

          <div className="space-y-5" hidden={tab !== "dateien"}>
            <div className="workspace-heading rise rise-1">
              <div>
              <p className="eyebrow">{uiText(settings.interfaceLanguage, "Audio importieren", "Import audio")}</p>
              <h1>
                {uiText(settings.interfaceLanguage, "Aufnahmen transkribieren", "Transcribe recordings")}
              </h1>
              <p>
                {uiText(settings.interfaceLanguage, "Sprachmemos, Meetings oder Sprachnachrichten in sauberen Text verwandeln.", "Turn voice memos, meetings, or voice messages into clean text.")}
              </p>
              </div>
            </div>
            <div className="rise rise-2">
              <UploadPanel settings={settings} onDone={onUploadDone} onCopy={copy} />
            </div>
          </div>
        {tab === "verlauf" && (
          <div className="space-y-5">
            <div className="workspace-heading rise rise-1">
              <div>
              <p className="eyebrow">{uiText(settings.interfaceLanguage, "Auf diesem Gerät", "On this device")}</p>
              <h1>
                {uiText(settings.interfaceLanguage, "Dein Verlauf", "Your history")}
              </h1>
              <p>
                {uiText(settings.interfaceLanguage, "Finde, kopiere und verwalte deine letzten Diktate.", "Find, copy, and manage your recent dictations.")}
              </p>
              </div>
            </div>
            <HistoryPanel
              entries={history}
              interfaceLanguage={settings.interfaceLanguage}
              onCopy={copy}
              onDelete={(id) => setHistory(removeHistory(id))}
              onClear={() => setHistory(clearHistory())}
            />
          </div>
        )}

        {tab === "desktop" && (
          <div className="space-y-5">
            <div className="workspace-heading rise rise-1">
              <div>
              <p className="eyebrow">{uiText(settings.interfaceLanguage, "Überall diktieren", "Dictate anywhere")}</p>
              <h1>
                {uiText(settings.interfaceLanguage, "Nivune für den Desktop", "Nivune for desktop")}
              </h1>
              <p>
                {uiText(settings.interfaceLanguage, "Diktiere per Shortcut in jede App auf deinem Mac oder Windows-PC. Der Text landet direkt an der Cursor-Position.", "Dictate into any app on your Mac or Windows PC with a shortcut. The text appears directly at the cursor position.")}
              </p>
              </div>
            </div>
            <DownloadPanel interfaceLanguage={settings.interfaceLanguage} />
          </div>
        )}
      </main>


      {/* ---------- Toast ---------- */}
      {toast && (
        <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4">
          <div className="pop rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-surface shadow-[var(--sh-lg)]">
            {toast}
          </div>
        </div>
      )}

      </section>
    </div>
  );
}

/* ================= Einstellungen ================= */

function SettingsCard({
  settings,
  setSettings,
  section,
}: {
  section: string;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modelStatus, setModelStatus] = useState<LocalModelStatus | null>(null);
  const [modelProgress, setModelProgress] = useState<LocalModelProgress | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [offlineReadiness, setOfflineReadiness] = useState<OfflineReadiness | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [providerStatus, setProviderStatus] = useState<"idle" | "checking" | "ready" | "manual" | "error">("idle");
  const [refinementModels, setRefinementModels] = useState<string[]>([]);
  const [refinementStatus, setRefinementStatus] = useState<"idle" | "checking" | "ready" | "manual" | "error">("idle");
  const modelAbort = useRef<AbortController | null>(null);
  const selectedModel = LOCAL_MODELS[settings.whisperModel];
  const [localBackend, setLocalBackend] = useState<"webgpu" | "wasm">("wasm");
  const text = (german: string, english: string) => uiText(settings.interfaceLanguage, german, english);

  useEffect(() => {
    setLocalBackend((navigator as Navigator & { gpu?: unknown }).gpu ? "webgpu" : "wasm");
  }, []);

  useEffect(() => {
    let active = true;
    if (settings.transcriptionMode !== "local") return;
    void inspectLocalModel(selectedModel.id)
      .then((status) => { if (active) setModelStatus(status); })
      .catch(() => { if (active) setModelStatus({ model: selectedModel.id, state: "partial", files: 0 }); });
    void prepareOfflineShell().then((status) => { if (active) setOfflineReadiness(status); });
    return () => { active = false; };
  }, [settings.transcriptionMode, selectedModel.id]);

  useEffect(() => () => modelAbort.current?.abort(), []);

  const downloadModel = async () => {
    if (modelBusy) return;
    if (modelStatus?.state === "ready") {
      setModelBusy(true);
      try { setModelStatus(await inspectLocalModel(selectedModel.id)); }
      finally { setModelBusy(false); }
      return;
    }
    const controller = new AbortController();
    modelAbort.current = controller;
    setModelBusy(true);
    setModelProgress({ progress: 0, loaded: 0, total: 0 });
    try {
      await requestPersistentModelStorage();
      const status = await prepareLocalModel(selectedModel.id, setModelProgress, controller.signal);
      setModelStatus(status);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && (error as Error)?.name !== "AbortError") {
        setModelStatus({ model: selectedModel.id, state: "partial", files: 0 });
      }
    } finally {
      if (modelAbort.current === controller) modelAbort.current = null;
      setModelBusy(false);
      setModelProgress(null);
      setOfflineReadiness(await inspectOfflineReadiness());
    }
  };

  const deleteModel = async () => {
    if (modelBusy || !confirm(text(`${selectedModel.label} wirklich von diesem Gerät löschen?`, `Really remove ${selectedModel.label} from this device?`))) return;
    setModelBusy(true);
    try { setModelStatus(await removeLocalModel(selectedModel.id)); }
    finally {
      setModelBusy(false);
      setOfflineReadiness(await inspectOfflineReadiness());
    }
  };

  const checkOllama = async () => {
    if (ollamaStatus === "checking") return;
    setOllamaStatus("checking");
    try {
      const models = await listOllamaModels({ baseUrl: settings.ollamaBaseUrl });
      setOllamaModels(models);
      setOllamaStatus("ready");
      if (!settings.ollamaModel && models[0]) {
        setSettings((current) => ({ ...current, ollamaModel: models[0] }));
      }
    } catch {
      setOllamaModels([]);
      setOllamaStatus("error");
    }
  };

  const checkTranscriptionProvider = async () => {
    if (providerStatus === "checking") return;
    setProviderStatus("checking");
    setProviderModels([]);
    try {
      const result = settings.transcriptionProvider === "groq"
        ? await listGroqTranscriptionModels({ apiKey: settings.groqApiKey })
        : await listCompatibleModels(settings.compatibleTranscriptionBaseUrl, {
            apiKey: settings.compatibleTranscriptionApiKey,
          });
      setProviderModels(result.models);
      setProviderStatus(result.supported ? "ready" : "manual");
      if (settings.transcriptionProvider === "groq" && result.models.length && !result.models.includes(settings.groqModel)) {
        setSettings((current) => ({ ...current, groqModel: result.models[0] }));
      }
    } catch {
      setProviderStatus("error");
    }
  };

  const checkCompatibleRefinement = async () => {
    if (refinementStatus === "checking") return;
    setRefinementStatus("checking");
    setRefinementModels([]);
    try {
      const result = await listCompatibleModels(settings.compatibleRefinementBaseUrl, {
        apiKey: settings.compatibleRefinementApiKey,
      });
      setRefinementModels(result.models);
      setRefinementStatus(result.supported ? "ready" : "manual");
    } catch {
      setRefinementStatus("error");
    }
  };

  const remainingBytes = offlineReadiness ? remainingStorageBytes(offlineReadiness) : null;
  const expectedBytes = selectedModel.approximateDownloadMb[localBackend] * 1024 * 1024;
  const storageTooSmall = remainingBytes !== null && remainingBytes < expectedBytes * 1.15;
  const shellLabel = ({
    ready: text("App-Hülle offline bereit", "App shell ready offline"),
    installing: text("Offline-App-Hülle wird vorbereitet", "Preparing offline app shell"),
    development: text("Offline-App-Hülle nur im Produktionsbuild", "Offline app shell available only in production builds"),
    unsupported: text("Offline-App-Hülle nicht unterstützt", "Offline app shell not supported"),
    error: text("Offline-App-Hülle nicht verfügbar", "Offline app shell unavailable"),
  } as const)[offlineReadiness?.shell || "installing"];

  const addEntry = () => {
    if (!from.trim() || !to.trim()) return;
    setSettings((s) => ({
      ...s,
      dictionary: [...s.dictionary, { from: from.trim(), to: to.trim() }],
    }));
    setFrom("");
    setTo("");
  };

  return (
    <div className="settings-sections">
      <section className="settings-section" hidden={section !== "transkription"}>
        <div className="section-label">
          <span>{text("Transkription", "Transcription")}</span>
          <small>{text("Wähle KI-Qualität oder Erkennung ohne eigenen API-Key", "Choose AI quality or recognition without your own API key")}</small>
        </div>
        <div className="mode-selector">
          <button
            data-active={settings.transcriptionMode === "quality"}
            onClick={() => setSettings((s) => ({ ...s, transcriptionMode: "quality" }))}
          >
            <span className="mode-icon"><SparkIcon /></span>
            <span><b>{text("Beste Qualität", "Best quality")}</b><small>{text("Ausgewählter Cloud-Anbieter mit Kontext", "Selected cloud provider with context")}</small></span>
            <CheckIcon />
          </button>
          <button
            data-active={settings.transcriptionMode === "local"}
            onClick={() => setSettings((s) => ({ ...s, transcriptionMode: "local" }))}
          >
            <span className="mode-icon"><DeviceIcon /></span>
            <span><b>{text("Lokal", "Local")}</b><small>{text("Diktate und Dateien mit Whisper", "Dictations and files with Whisper")}</small></span>
            <CheckIcon />
          </button>
        </div>

        {settings.transcriptionMode === "quality" && (
          <div className="credential-box pop space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">{text("Transkriptionsanbieter", "Transcription provider")}</span>
              <select
                className="field"
                value={settings.transcriptionProvider}
                onChange={(event) => {
                  setSettings((current) => ({
                    ...current,
                    transcriptionProvider: event.target.value as Settings["transcriptionProvider"],
                  }));
                  setProviderModels([]);
                  setProviderStatus("idle");
                }}
              >
                <option value="openai">OpenAI · {text("empfohlen", "recommended")}</option>
                <option value="groq">Groq</option>
                <option value="openai-compatible">{text("Eigener kompatibler Server", "Your compatible server")}</option>
              </select>
            </label>
            <p>{text("OpenAI bleibt die Voreinstellung. Ein anderer Anbieter wird nur nach deiner ausdrücklichen Auswahl verwendet; es gibt keinen stillen Wechsel bei Fehlern.", "OpenAI remains the default. Another provider is used only after your explicit selection; errors never trigger a silent switch.")}</p>

            {settings.transcriptionProvider === "groq" && (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold">Groq API-Key</span>
                  <input className="field" type="password" autoComplete="off" value={settings.groqApiKey} onChange={(event) => {
                    setSettings((current) => ({ ...current, groqApiKey: event.target.value }));
                    setProviderStatus("idle");
                  }} placeholder="gsk_…" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold">{text("Groq-Modell", "Groq model")}</span>
                  <input className="field" list="groq-transcription-models" value={settings.groqModel} onChange={(event) => setSettings((current) => ({ ...current, groqModel: event.target.value }))} placeholder="whisper-large-v3" />
                  <datalist id="groq-transcription-models">{providerModels.map((model) => <option key={model} value={model} />)}</datalist>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="btn btn-secondary px-4 py-2 text-xs" onClick={() => void checkTranscriptionProvider()} disabled={providerStatus === "checking"}>
                    {providerStatus === "checking" ? text("Verbindung wird geprüft …", "Checking connection …") : text("Verbindung prüfen", "Test connection")}
                  </button>
                  <span className="text-xs text-mut">{providerStatus === "ready" ? text(`${providerModels.length} Whisper-Modelle gefunden`, `${providerModels.length} Whisper models found`) : providerStatus === "error" ? text("Nicht erreichbar oder Zugang abgelehnt.", "Unavailable or access denied.") : text("Der Test lädt nur die Modellliste und sendet kein Audio.", "The test loads only the model list and sends no audio.")}</span>
                </div>
                <p>{text("Aufnahmen werden direkt an Groq gesendet. Dort können eigene Nutzungsbedingungen und Kosten gelten.", "Recordings are sent directly to Groq. Its own terms and charges may apply.")}</p>
              </div>
            )}

            {settings.transcriptionProvider === "openai-compatible" && (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold">{text("Server-Adresse", "Server address")}</span>
                  <input className="field" inputMode="url" value={settings.compatibleTranscriptionBaseUrl} onChange={(event) => {
                    const baseUrl = event.target.value;
                    setSettings((current) => {
                      const oldRef = compatibleCredentialRef("transcription", current.compatibleTranscriptionBaseUrl) || "";
                      const newRef = compatibleCredentialRef("transcription", baseUrl) || "";
                      return {
                        ...current,
                        compatibleTranscriptionBaseUrl: baseUrl,
                        compatibleTranscriptionApiKey: oldRef === newRef ? current.compatibleTranscriptionApiKey : "",
                        compatibleTranscriptionCredentialRef: newRef,
                      };
                    });
                    setProviderStatus("idle");
                  }} placeholder="https://server.example/v1" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold">{text("Modell-ID", "Model ID")}</span>
                  <input className="field" list="compatible-transcription-models" value={settings.compatibleTranscriptionModel} onChange={(event) => setSettings((current) => ({ ...current, compatibleTranscriptionModel: event.target.value }))} placeholder="whisper-1" />
                  <datalist id="compatible-transcription-models">{providerModels.map((model) => <option key={model} value={model} />)}</datalist>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold">{text("API-Key (optional)", "API key (optional)")}</span>
                  <input className="field" type="password" autoComplete="off" value={settings.compatibleTranscriptionApiKey} onChange={(event) => {
                    setSettings((current) => ({
                      ...current,
                      compatibleTranscriptionApiKey: event.target.value,
                      compatibleTranscriptionCredentialRef: compatibleCredentialRef("transcription", current.compatibleTranscriptionBaseUrl) || "",
                    }));
                    setProviderStatus("idle");
                  }} placeholder={text("Nur falls der Server einen Key verlangt", "Only if the server requires a key")} />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="btn btn-secondary px-4 py-2 text-xs" onClick={() => void checkTranscriptionProvider()} disabled={providerStatus === "checking"}>
                    {providerStatus === "checking" ? text("Verbindung wird geprüft …", "Checking connection …") : text("Verbindung prüfen", "Test connection")}
                  </button>
                  <span className="text-xs text-mut">{providerStatus === "ready" ? text(`${providerModels.length} Modelle gefunden`, `${providerModels.length} models found`) : providerStatus === "manual" ? text("Server erreichbar; Modell-ID bitte manuell eintragen.", "Server reachable; enter the model ID manually.") : providerStatus === "error" ? text("Nicht erreichbar, unsichere Adresse oder Zugang abgelehnt.", "Unavailable, insecure address, or access denied.") : text("Erlaubt sind HTTPS sowie HTTP auf localhost.", "HTTPS and HTTP on localhost are allowed.")}</span>
                </div>
                {providerStatus === "error" && <BrowserConnectionHelp kind="server" language={settings.interfaceLanguage} />}
                <p>{text("Audio geht an diesen Server. Nivune folgt keinen Weiterleitungen und akzeptiert für entfernte Server ausschließlich HTTPS.", "Audio is sent to this server. Nivune does not follow redirects and accepts only HTTPS for remote servers.")}</p>
              </div>
            )}
          </div>
        )}

        {settings.transcriptionMode === "local" && (
          <div className="credential-box pop space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{text("Lokales Sprachmodell", "Local speech model")}</p>
                <p>{selectedModel.label} · Apache-2.0 · {text("ungefähr", "about")} {selectedModel.approximateDownloadMb.wasm}–{selectedModel.approximateDownloadMb.webgpu} MB {text("je nach Gerät", "depending on the device")}</p>
                <p>{localBackend === "webgpu" ? text("WebGPU verfügbar", "WebGPU available") : text("WASM-Fallback", "WASM fallback")}; {text("bei nicht unterstützter GPU wird automatisch WASM verwendet. Die erste Ausführung kann je nach Browser und Gerät deutlich länger dauern.", "WASM is used automatically when the GPU is unsupported. The first run may take considerably longer depending on the browser and device.")}</p>
                <p>{shellLabel}{remainingBytes === null ? "" : text(` · ungefähr ${Math.floor(remainingBytes / 1024 / 1024).toLocaleString("de-DE")} MB Browserspeicher frei`, ` · about ${Math.floor(remainingBytes / 1024 / 1024).toLocaleString("en-US")} MB browser storage free`)}</p>
              </div>
              <span className={`chip ${modelStatus?.state === "ready" ? "bg-teal/12 text-teal" : "bg-surface-2 text-mut"}`}>
                {modelBusy ? text("Wird geladen", "Loading") : modelStatus?.state === "ready" ? text("Offline bereit", "Ready offline") : modelStatus?.state === "partial" ? text("Unvollständig", "Incomplete") : text("Nicht geladen", "Not downloaded")}
              </span>
            </div>
            {modelProgress && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full bg-ember transition-[width]" style={{ width: `${Math.max(2, modelProgress.progress)}%` }} /></div>
                <p className="mt-1">{Math.round(modelProgress.progress)}% · {text("Download kann je nach Verbindung mehrere Minuten dauern.", "The download may take several minutes depending on your connection.")}</p>
              </div>
            )}
            {storageTooSmall && (
              <p className="notice warning">{text("Der geschätzte freie Browserspeicher reicht für dieses Modell möglicherweise nicht. Wähle Whisper base oder gib Speicher frei.", "Estimated free browser storage may not be enough for this model. Choose Whisper base or free up storage.")}</p>
            )}
            {offlineReadiness?.persistent === false && modelStatus?.state === "ready" && (
              <p>{text("Der Browser kann den Modellcache bei Speicherdruck entfernen. Nivune erkennt den Verlust vor dem nächsten Diktat.", "The browser may remove the model cache under storage pressure. Nivune detects this before your next dictation.")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {modelBusy ? (
                <button type="button" className="btn btn-secondary px-4 py-2 text-xs" onClick={() => modelAbort.current?.abort()}>{text("Abbrechen", "Cancel")}</button>
              ) : (
                <button type="button" className="btn btn-primary px-4 py-2 text-xs" onClick={() => void downloadModel()}>{modelStatus?.state === "ready" ? text("Cache prüfen", "Check cache") : text("Modell herunterladen", "Download model")}</button>
              )}
              {modelStatus?.state !== "missing" && !modelBusy && (
                <button type="button" className="btn btn-ghost px-4 py-2 text-xs" onClick={() => void deleteModel()}>{text("Modell löschen", "Remove model")}</button>
              )}
              <a href={selectedModel.sourceUrl} target="_blank" rel="noreferrer" className="btn btn-ghost px-4 py-2 text-xs">{text("Modellkarte", "Model card")}</a>
            </div>
            <p>{text("Audio bleibt bei der Transkription auf diesem Gerät. Nur der einmalige Modelldownload kommt von Hugging Face.", "Audio stays on this device during transcription. Only the one-time model download comes from Hugging Face.")}</p>
          </div>
        )}

        {((settings.transcriptionMode === "quality" && settings.transcriptionProvider === "openai") || settings.refinementProvider === "openai") && (
          <div className="credential-box pop">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">OpenAI API-Key</span>
              <input
                type="password"
                value={settings.openaiApiKey}
                onChange={(e) => setSettings((s) => ({ ...s, openaiApiKey: e.target.value }))}
                placeholder="sk-proj-…"
                autoComplete="off"
                className="field text-sm"
              />
            </label>
            <p>{settings.rememberKeysOnDevice
              ? text("Bleibt in diesem Browser gespeichert und wird ausschließlich für die gewählten OpenAI-Stufen verwendet.", "Stays stored in this browser and is used exclusively for the selected OpenAI steps.")
              : text("Bleibt nur bis zum Schließen dieser Browsersitzung erhalten und wird ausschließlich für die gewählten OpenAI-Stufen verwendet.", "Kept only until this browser session is closed and used exclusively for the selected OpenAI steps.")}</p>
          </div>
        )}

        <div className="credential-box pop space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">{text("Textüberarbeitung", "Text refinement")}</span>
            <select
              value={settings.cleanup === "aus" ? "none" : settings.refinementProvider}
              onChange={(event) => {
                const provider = event.target.value as Settings["refinementProvider"];
                setSettings((current) => ({
                  ...current,
                  refinementProvider: provider,
                  cleanup: provider === "none" ? current.cleanup : current.cleanup === "aus" ? "sanft" : current.cleanup,
                }));
              }}
              className="field"
            >
              <option value="none">{text("Keine KI-Überarbeitung", "No AI refinement")}</option>
              <option value="deterministic">{text("Nur lokale Regeln", "Local rules only")}</option>
              <option value="openai">OpenAI</option>
              <option value="openai-compatible">{text("Eigener kompatibler Server", "Your compatible server")}</option>
              <option value="ollama">{text("Ollama auf diesem Gerät", "Ollama on this device")}</option>
            </select>
          </label>
          {settings.refinementProvider === "ollama" && settings.cleanup !== "aus" && (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">{text("Lokale Ollama-Adresse", "Local Ollama address")}</span>
                <input className="field" value={settings.ollamaBaseUrl} onChange={(event) => {
                  setSettings((current) => ({ ...current, ollamaBaseUrl: event.target.value }));
                  setOllamaStatus("idle");
                }} placeholder="http://127.0.0.1:11434" inputMode="url" />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">{text("Ollama-Modell", "Ollama model")}</span>
                <input className="field" list="ollama-models" value={settings.ollamaModel} onChange={(event) => setSettings((current) => ({ ...current, ollamaModel: event.target.value }))} placeholder={text("Installiertes Textmodell", "Installed text model")} />
                <datalist id="ollama-models">{ollamaModels.map((model) => <option key={model} value={model} />)}</datalist>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-secondary px-4 py-2 text-xs" onClick={() => void checkOllama()} disabled={ollamaStatus === "checking"}>
                  {ollamaStatus === "checking" ? text("Verbindung wird geprüft …", "Checking connection …") : text("Verbindung prüfen", "Test connection")}
                </button>
                <span className="text-xs text-mut">{ollamaStatus === "ready" ? text(`${ollamaModels.length} lokale Modelle gefunden`, `${ollamaModels.length} local models found`) : ollamaStatus === "error" ? text("Nicht erreichbar. Ollama starten und Browser-Origin erlauben.", "Unavailable. Start Ollama and allow the browser origin.") : text("Nur localhost oder 127.0.0.1 sind zulässig.", "Only localhost or 127.0.0.1 is allowed.")}</span>
              </div>
              {ollamaStatus === "error" && <BrowserConnectionHelp kind="ollama" language={settings.interfaceLanguage} />}
              <p>{settings.transcriptionMode === "local" ? text("Transkription und Überarbeitung bleiben auf diesem Gerät.", "Transcription and refinement stay on this device.") : text(`Nur die Überarbeitung ist lokal; die Aufnahme geht weiterhin zur Transkription an ${settings.transcriptionProvider === "groq" ? "Groq" : settings.transcriptionProvider === "openai-compatible" ? "deinen kompatiblen Server" : "OpenAI"}.`, `Only refinement is local; the recording is still sent to ${settings.transcriptionProvider === "groq" ? "Groq" : settings.transcriptionProvider === "openai-compatible" ? "your compatible server" : "OpenAI"} for transcription.`)}</p>
              <p>{text("Sehr kleine Modelle können Inhalte verfälschen. Nivune verwirft erkennbare Kürzungen, geänderte Sprecherrollen und verlorene Verneinungen; der vollständige Rohtext bleibt dann erhalten.", "Very small models can distort content. Nivune rejects detectable omissions, changed speaker roles, and lost negations; the complete raw text is then preserved.")}</p>
            </div>
          )}
          {settings.refinementProvider === "openai-compatible" && settings.cleanup !== "aus" && (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">{text("Textserver-Adresse", "Text server address")}</span>
                <input className="field" inputMode="url" value={settings.compatibleRefinementBaseUrl} onChange={(event) => {
                  const baseUrl = event.target.value;
                  setSettings((current) => {
                    const oldRef = compatibleCredentialRef("refinement", current.compatibleRefinementBaseUrl) || "";
                    const newRef = compatibleCredentialRef("refinement", baseUrl) || "";
                    return {
                      ...current,
                      compatibleRefinementBaseUrl: baseUrl,
                      compatibleRefinementApiKey: oldRef === newRef ? current.compatibleRefinementApiKey : "",
                      compatibleRefinementCredentialRef: newRef,
                    };
                  });
                  setRefinementStatus("idle");
                }} placeholder="https://server.example/v1" />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">{text("Textmodell-ID", "Text model ID")}</span>
                <input className="field" list="compatible-refinement-models" value={settings.compatibleRefinementModel} onChange={(event) => setSettings((current) => ({ ...current, compatibleRefinementModel: event.target.value }))} placeholder="dein-textmodell" />
                <datalist id="compatible-refinement-models">{refinementModels.map((model) => <option key={model} value={model} />)}</datalist>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">{text("Textserver-Key (optional)", "Text server key (optional)")}</span>
                <input className="field" type="password" autoComplete="off" value={settings.compatibleRefinementApiKey} onChange={(event) => {
                  setSettings((current) => ({
                    ...current,
                    compatibleRefinementApiKey: event.target.value,
                    compatibleRefinementCredentialRef: compatibleCredentialRef("refinement", current.compatibleRefinementBaseUrl) || "",
                  }));
                  setRefinementStatus("idle");
                }} placeholder={text("Nur falls der Server einen Key verlangt", "Only if the server requires a key")} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-secondary px-4 py-2 text-xs" onClick={() => void checkCompatibleRefinement()} disabled={refinementStatus === "checking"}>
                  {refinementStatus === "checking" ? text("Verbindung wird geprüft …", "Checking connection …") : text("Verbindung prüfen", "Test connection")}
                </button>
                <span className="text-xs text-mut">{refinementStatus === "ready" ? text(`${refinementModels.length} Modelle gefunden`, `${refinementModels.length} models found`) : refinementStatus === "manual" ? text("Server erreichbar; Modell-ID bitte manuell eintragen.", "Server reachable; enter the model ID manually.") : refinementStatus === "error" ? text("Nicht erreichbar, unsichere Adresse oder Zugang abgelehnt.", "Unavailable, insecure address, or access denied.") : text("Erlaubt sind HTTPS sowie HTTP auf localhost.", "HTTPS and HTTP on localhost are allowed.")}</span>
              </div>
              {refinementStatus === "error" && <BrowserConnectionHelp kind="server" language={settings.interfaceLanguage} />}
              <p>{text("Nur der transkribierte Text, dein Kontext und Wörterbucheinträge gehen an diesen Server. Nivune folgt keinen Weiterleitungen.", "Only transcribed text, your context, and dictionary entries are sent to this server. Nivune does not follow redirects.")}</p>
            </div>
          )}
          {(settings.refinementProvider === "none" || settings.cleanup === "aus") && <p>{text("Keine KI-Stufe wird nach der Transkription aufgerufen.", "No AI step runs after transcription.")}</p>}
          {settings.refinementProvider === "deterministic" && settings.cleanup !== "aus" && <p>{text("Nur die eingebauten lokalen Regeln und dein Wörterbuch werden angewendet.", "Only built-in local rules and your dictionary are applied.")}</p>}
        </div>
      </section>

      <section className="settings-section settings-grid" hidden={section !== "sprache"}>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">{text("Oberflächensprache", "Interface language")}</span>
          <select value={settings.interfaceLanguage} onChange={(e) => setSettings((s) => ({ ...s, interfaceLanguage: e.target.value === "en" ? "en" : "de" }))} className="field">
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">{text("Gesprochene Sprache", "Spoken language")}</span>
          <select value={settings.lang} onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value }))} className="field">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.code === "de-DE" && settings.interfaceLanguage === "en" ? "German" : l.label}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">{text("Aufräumen", "Cleanup")}</span>
          <select
            value={settings.cleanup}
            onChange={(e) => {
              const cleanup = e.target.value as Settings["cleanup"];
              setSettings((s) => ({ ...s, cleanup, refinementProvider: cleanup === "aus" ? "none" : s.refinementProvider }));
            }}
            className="field"
          >
            <option value="aus">{text("Wortgetreu", "Verbatim")}</option>
            <option value="sanft">{text("Natürlich", "Natural")}</option>
            <option value="stark">{text("Kompakt", "Concise")}</option>
          </select>
        </label>

        {settings.transcriptionMode === "local" && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">{text("Lokales Modell", "Local model")}</span>
            <select
              value={settings.whisperModel}
              onChange={(e) => setSettings((s) => ({ ...s, whisperModel: e.target.value as Settings["whisperModel"] }))}
              className="field"
            >
              <option value="genau">Whisper small, {text("genauer", "more accurate")}</option>
              <option value="schnell">Whisper base, {text("schneller", "faster")}</option>
            </select>
          </label>
        )}

        <label className="toggle-row">
          <span><b>{text("Automatisch kopieren", "Copy automatically")}</b><small>{text("Ergebnis direkt in die Zwischenablage legen", "Place the result directly on the clipboard")}</small></span>
          <input
            type="checkbox"
            checked={settings.autoCopy}
            onChange={(e) => setSettings((s) => ({ ...s, autoCopy: e.target.checked }))}
          />
        </label>

        <label className="toggle-row">
          <span>
            <b>{text("API-Keys auf diesem Gerät merken", "Remember API keys on this device")}</b>
            <small>{settings.rememberKeysOnDevice
              ? text("Keys liegen unverschlüsselt im Speicher dieser Website im Browser. Browsererweiterungen und alle mit Zugriff auf dieses Browserprofil können sie lesen. Nur auf eigenen Geräten verwenden.", "Keys are stored unencrypted in this website's browser storage. Browser extensions and anyone with access to this browser profile can read them. Use only on your own devices.")
              : text("Aus: Keys gelten nur bis zum Schließen dieser Browsersitzung. Die Desktop-App speichert Keys dagegen verschlüsselt über das Betriebssystem.", "Off: keys last only until this browser session ends. The desktop app instead stores keys encrypted by the operating system.")}</small>
          </span>
          <input
            type="checkbox"
            checked={settings.rememberKeysOnDevice}
            onChange={(e) => {
              const remember = e.target.checked;
              if (remember && !confirm(text("API-Keys unverschlüsselt in diesem Browser speichern? Jede Erweiterung und jede Person mit Zugriff auf dieses Browserprofil kann sie dann lesen.", "Store API keys unencrypted in this browser? Any extension and anyone with access to this browser profile can then read them."))) return;
              setSettings((s) => ({ ...s, rememberKeysOnDevice: remember }));
            }}
          />
        </label>
      </section>

      <section className="settings-section" hidden={section !== "kontext"}>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">{text("Dein Kontext", "Your context")}</span>
          <textarea
            value={settings.context}
            onChange={(e) => setSettings((s) => ({ ...s, context: e.target.value }))}
            placeholder={text("Zum Beispiel: Produktentwicklung, Automatisierung, Namen von Kunden oder Projekten", "For example: product development, automation, customer or project names")}
            className="field min-h-24 resize-y text-sm"
          />
        </label>
        <p className="setting-help">{text("Hilft der Erkennung, ähnlich klingende Fachbegriffe richtig zuzuordnen.", "Helps recognition distinguish similar-sounding technical terms.")}</p>
      </section>

      <section className="settings-section" hidden={section !== "woerterbuch"}>
        <p className="mb-1.5 text-sm font-semibold">{text("Persönliches Wörterbuch", "Personal dictionary")}</p>
        <p className="mb-3 text-xs leading-relaxed text-mut">
          {text("Namen und Fachbegriffe werden dem Qualitätsmodell schon vor der Erkennung als Hinweis mitgegeben.", "Names and technical terms are provided to the quality model as hints before recognition.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label={text("Erkannter Begriff", "Recognized term")}
            placeholder={text("erkannt als …", "recognized as …")}
            className="field min-w-0 flex-1 text-sm"
          />
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            aria-label={text("Gewünschter Begriff", "Desired term")}
            placeholder={text("soll heißen …", "should be …")}
            className="field min-w-0 flex-1 text-sm"
          />
          <button
            onClick={addEntry}
            aria-label={text("Wörterbuch-Eintrag hinzufügen", "Add dictionary entry")}
            className="btn btn-primary px-4 text-lg leading-none"
          >
            +
          </button>
        </div>
        {settings.dictionary.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {settings.dictionary.map((en, i) => (
              <span
                key={`${en.from}-${i}`}
                className="chip kt-hair bg-surface-2 text-xs"
              >
                <span className="text-mut">{en.from}</span> → <b>{en.to}</b>
                <button
                  aria-label={text("Eintrag löschen", "Delete entry")}
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      dictionary: s.dictionary.filter((_, j) => j !== i),
                    }))
                  }
                  className="ml-0.5 text-mut transition-colors hover:text-ember-2"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ================= Icons & Kleinkram ================= */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-soft shadow-[var(--sh-sm)] kt-hair">
      {children}
    </kbd>
  );
}

function NavIcon({ tab }: { tab: Tab }) {
  const paths: Record<Tab, React.ReactNode> = {
    diktat: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></>,
    dateien: <><path d="M13.5 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9.5Z" /><path d="M13.5 3.5v4a2 2 0 0 0 2 2h4M8.5 14v2M12 12v6M15.5 14v2" /></>,
    verlauf: <><path d="M4.7 7.5a8.5 8.5 0 1 1-.9 7.7M3.5 3.5v5h5" /><path d="M12 7.5V12l3 2" /></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[tab]}</svg>;
}

function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;
}

function SparkIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" /><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></svg>;
}

function DeviceIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 17h6" /></svg>;
}

function CheckIcon() {
  return <svg className="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>;
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function LogoBars() {
  return <svg aria-hidden="true" width="24" height="28" viewBox="0 0 24 28" fill="currentColor"><rect x="3" y="8" width="3" height="15" rx="1.5" /><rect x="10.5" y="2" width="3" height="24" rx="1.5" /><rect x="18" y="6" width="3" height="14" rx="1.5" /></svg>;
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 19v3" />
    </svg>
  );
}

/**
 * Browser dürfen nur Server ansprechen, die diese Website ausdrücklich zulassen
 * (CORS). Nivune betreibt dafür bewusst keinen Proxy; die Hilfe nennt die
 * konkrete Origin und die Alternativen.
 */
function BrowserConnectionHelp({ kind, language }: { kind: "server" | "ollama"; language: Settings["interfaceLanguage"] }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const text = (german: string, english: string) => uiText(language, german, english);
  return (
    <details className="connection-help">
      <summary>{text("Warum ist der Server im Browser nicht erreichbar?", "Why can't the browser reach the server?")}</summary>
      <p>{text(
        "Browser erlauben einer Website nur Anfragen an Server, die diese Website ausdrücklich zulassen (CORS). Nivune leitet deine Daten bewusst nicht über einen eigenen Vermittlungsserver um.",
        "Browsers only let a website contact servers that explicitly allow that website (CORS). Nivune deliberately does not route your data through an intermediary server of its own.",
      )}</p>
      <ul>
        <li>{text("Diese Website als erlaubte Origin eintragen: ", "Allow this website as an origin: ")}<code>{origin || "…"}</code></li>
        {kind === "ollama" ? (
          <li>{text("Bei Ollama: Ollama mit ", "For Ollama: start Ollama with ")}<code>{`OLLAMA_ORIGINS=${origin || "…"}`}</code>{text(" starten und die Adresse http://127.0.0.1:11434 verwenden.", " and use the address http://127.0.0.1:11434.")}</li>
        ) : (
          <li>{text("Beim eigenen Server: Den Header Access-Control-Allow-Origin für diese Origin setzen und Authorization sowie Content-Type als erlaubte Header freigeben.", "For your own server: set the Access-Control-Allow-Origin header for this origin and allow Authorization and Content-Type as request headers.")}</li>
        )}
        <li>{text("Oder die Desktop-App verwenden. Sie unterliegt dieser Browser-Grenze nicht.", "Or use the desktop app, which is not subject to this browser restriction.")}</li>
      </ul>
    </details>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
