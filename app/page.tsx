"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
import UploadPanel, { type UploadResult } from "@/components/UploadPanel";
import HistoryPanel from "@/components/HistoryPanel";
import DownloadPanel from "@/components/DownloadPanel";
import { useDictation } from "@/hooks/useDictation";
import { cleanTranscript } from "@/lib/cleanup";
import { processQualityDictation, type QualityDictationJob } from "@/lib/process-dictation";
import {
  DEFAULT_SETTINGS,
  LANGUAGES,
  addHistory,
  clearHistory,
  countWords,
  loadHistory,
  loadSettings,
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

  const d = useDictation(settings.lang, settings.transcriptionMode === "quality");

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
    setSettings(loadSettings());
    setHistory(loadHistory());
    setDark(document.documentElement.dataset.theme === "dark");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);

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
        showToast("Kopiert. Wechsle jetzt die App und füge ein.");
        return true;
      } catch {
        showToast("Kopieren nicht möglich. Bitte markiere den Text manuell.");
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
  const startDictation = useCallback(() => {
    if (listeningRef.current || processingRef.current) return;
    if (!d.supported) {
      showToast("Live-Diktat wird von diesem Browser nicht unterstützt");
      return;
    }
    const s = settingsRef.current;
    if (s.transcriptionMode === "quality" && !s.openaiApiKey.trim()) {
      setNotice({ kind: "error", message: "Für den Qualitätsmodus fehlt dein API-Key. Bitte ergänze ihn in den Einstellungen." });
      setSettingsSection("transkription");
      setShowSettings(true);
      return;
    }
    pendingJob.current = null;
    setNotice(null);
    setShowRaw(false);
    setTab("diktat");
    sessionStartWords.current = countWords(finalRef.current);
    sessionPrefix.current = finalRef.current.trim();
    sessionStartAt.current = Date.now();
    sessionSettings.current = { ...s, dictionary: [...s.dictionary] };
    void d.start();
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
      setNotice({ kind: "success", message: job.settings.cleanup === "aus"
        ? "Mit GPT Transcribe verarbeitet · ohne KI-Feinschliff."
        : "Mit GPT Transcribe verarbeitet · KI-Feinschliff abgeschlossen." });
      if (job.settings.autoCopy) void copy(text);
    } catch (error) {
      setNotice({ kind: "error", message: `${error instanceof Error ? error.message : "KI-Verarbeitung fehlgeschlagen."} Die Aufnahme bleibt für einen erneuten Versuch in diesem Tab erhalten. Nicht automatisch kopiert oder gespeichert.` });
    }
  }, [d, copy]);

  const retryDictation = useCallback(async () => {
    const job = pendingJob.current;
    if (!job || processingRef.current || listeningRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    job.settings = { ...job.settings, openaiApiKey: settingsRef.current.openaiApiKey };
    try { await runQualityJob(job); }
    finally { processingRef.current = false; setProcessing(false); }
  }, [runQualityJob]);

  const finishDictation = useCallback(async () => {
    if (!listeningRef.current || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setProcessingLabel("Aufnahme abschließen …");
    const duration = (Date.now() - sessionStartAt.current) / 1000;
    try {
      const audio = await d.stop();
      const s = sessionSettings.current;
      if (s.transcriptionMode === "quality") {
        if (!audio?.size) throw new Error("Keine nutzbare Audioaufnahme vorhanden. Bitte erneut aufnehmen.");
        await runQualityJob({ audio, settings: s, prefix: sessionPrefix.current, duration });
        return;
      }
      // Kurz warten, bis späte finale Ergebnisse der Erkennung eingetroffen sind
      await new Promise((resolve) => setTimeout(resolve, 350));
      const raw = finalRef.current;
      const dictatedRaw = raw.slice(sessionPrefix.current.length).trim();
      const originalRaw = [sessionPrefix.current, dictatedRaw].filter(Boolean).join(" ");
      const cleaned = cleanTranscript(originalRaw, s);
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
      if (s.autoCopy) copy(final);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Aufnahme fehlgeschlagen. Bitte erneut versuchen." });
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
      setSeconds(0);
      return;
    }
    const iv = setInterval(
      () => setSeconds(Math.floor((Date.now() - sessionStartAt.current) / 1000)),
      500
    );
    return () => clearInterval(iv);
  }, [d.listening]);

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
      showToast("Transkription fertig ✓");
    },
    [showToast]
  );

  const words = countWords(d.finalText);
  const langLabel =
    LANGUAGES.find((l) => l.code === settings.lang)?.label ?? settings.lang;

  const hasDocument = Boolean(d.finalText) || composing;
  const needsKey = settings.transcriptionMode === "quality" && !settings.openaiApiKey.trim();
  const captureControl = processing ? (
    <div className="processing-pill" role="status"><span className="spinner" /><span>{processingLabel}</span></div>
  ) : d.listening ? (
    <div className="recording-controls">
      <span className="recording-label">Aufnahme</span>
      <Waveform stream={d.stream} className="capture-wave" />
      <span className="capture-time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
      <button onClick={finishDictation} className="stop-button" aria-label="Aufnahme beenden"><StopIcon /></button>
    </div>
  ) : (
    <button onClick={startDictation} className="capture-button"><LogoBars /><span>{needsKey ? "Diktat einrichten" : hasDocument ? "Weiter diktieren" : "Diktieren"}</span></button>
  );

  return (
    <div className="app-shell min-h-dvh">
      <aside className="desktop-sidebar kt-glass">
        <div className="brand-lockup">
          <span className="brand-mark"><LogoBars /></span>
          <div>
            <div className="brand-name">Klartext</div>
            <div className="brand-caption">Deine Stimme. Dein Text.</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Hauptnavigation">
          {([
            ["diktat", "Diktat"],
            ["dateien", "Dateien"],
            ["verlauf", "Verlauf"],
            ["desktop", "Desktop-App"],
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
            {settings.transcriptionMode === "quality" ? "Beste Qualität" : "Lokal"}
          </div>
          <p>
            {settings.transcriptionMode === "quality"
              ? settings.openaiApiKey
                ? "API-Key hinterlegt. Die Verbindung wird beim Diktat geprüft."
                : "API-Key ergänzen, um den Qualitätsmodus zu aktivieren."
              : "Diktat per Browser-Erkennung. Dateien werden lokal mit Whisper verarbeitet."}
          </p>
        </div>
        <div className="sidebar-actions">
          <button onClick={toggleTheme} aria-label="Design wechseln" className="icon-btn">
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={() => setShowSettings(true)} className="settings-button">
            <GearIcon /> Einstellungen
          </button>
        </div>
      </aside>

      <section className="app-workspace">
        <div className="workspace-topbar"><span>{({diktat:"Sprachraum",dateien:"Audio importieren",verlauf:"Deine Aufnahmen",desktop:"Überall diktieren"})[tab]}</span>{tab === "diktat" ? <span>Auf diesem Gerät <span className="small-signal" /></span> : captureControl}</div>
        <header className="mobile-header">
          <div className="brand-lockup compact">
            <span className="brand-mark"><LogoBars /></span>
            <span className="brand-name">Klartext</span>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} aria-label="Design wechseln" className="icon-btn">
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => setShowSettings(true)} aria-label="Einstellungen" className="icon-btn">
              <GearIcon />
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Hauptnavigation">
          {([
            ["diktat", "Diktat"],
            ["dateien", "Dateien"],
            ["verlauf", "Verlauf"],
            ["desktop", "Desktop"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} data-active={tab === key}>
              <NavIcon tab={key} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {tab !== "diktat" && <div className="mobile-capture">{captureControl}</div>}

        <dialog ref={settingsDialog} className="settings-window" onCancel={() => setShowSettings(false)} onClose={() => setShowSettings(false)} aria-label="Einstellungen">
          <div className="settings-titlebar"><span className="settings-wordmark"><LogoBars /> Klartext</span><span>Einstellungen</span><button onClick={() => setShowSettings(false)} className="icon-btn" aria-label="Einstellungen schließen"><CloseIcon /></button></div>
          <div className="settings-layout">
            <nav className="settings-navigation" aria-label="Einstellungsbereiche">
              {[["transkription","Transkription"],["sprache","Sprache & Verhalten"],["kontext","Kontext"],["woerterbuch","Wörterbuch"]].map(([id,label]) => <button key={id} aria-current={settingsSection === id ? "page" : undefined} onClick={() => setSettingsSection(id)}>{label}</button>)}
              <p>Einstellungen werden auf diesem Gerät gespeichert.</p>
            </nav>
            <div className="settings-body"><h2>{({transkription:"Aus Stimme wird Text.",sprache:"So arbeitest du.",kontext:"Deine Themen.",woerterbuch:"Deine eigenen Worte."} as Record<string, string>)[settingsSection]}</h2><SettingsCard settings={settings} setSettings={setSettings} section={settingsSection} /></div>
          </div>
        </dialog>

        <main className="workspace-content">
        {tab === "diktat" && (
          <div className={`dictation-workspace ${hasDocument ? "has-document" : ""}`}>
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">{hasDocument ? "Dein Text" : "Neues Diktat"}</p>
                <h1>{hasDocument ? "Zum Weiterdenken." : "Dein Gedanke beginnt hier."}</h1>
                {!hasDocument && <p>Sprich ihn aus. Der fertige Text folgt nach der Aufnahme.</p>}
              </div>
              <button className="mode-badge" onClick={() => setShowSettings(true)}>
                <span className="status-orb" />
                <span>
                  <small>{needsKey ? "Beste Qualität" : "Modus"}</small>
                  {needsKey ? "API-Key fehlt" : settings.transcriptionMode === "quality" ? "Beste Qualität" : "Lokal"}
                </span>
                <ChevronIcon />
              </button>
            </div>

            {!d.supported && (
              <div className="kt-hair rounded-xl bg-lav/40 p-4 text-sm text-lav-ink">
                {settings.transcriptionMode === "local" ? (
                  <>Dein Browser unterstützt hier kein lokales Live-Diktat. Nutze Chrome, Edge oder Safari, wechsle zu <b>Beste Qualität</b> oder transkribiere eine Aufnahme im Tab <b>Dateien</b>.</>
                ) : (
                  <>Dieser Browser kann keine Mikrofonaufnahme starten. Prüfe die Browser-Berechtigungen oder transkribiere eine Aufnahme im Tab <b>Dateien</b>.</>
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
                      {pendingJob.current.raw === undefined ? "Aufnahme erneut verarbeiten" : "KI-Feinschliff wiederholen"}
                    </button>
                    <button onClick={() => setShowSettings(true)} disabled={processing} className="btn btn-ghost min-h-11 px-4 text-sm">Einstellungen</button>
                    <p className="w-full text-xs text-mut">Die Aufnahme bleibt bis zum nächsten Diktat oder Neuladen nur in diesem Tab erhalten. Erneute API-Versuche können Kosten verursachen.</p>
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
                <div className="capture-stage" role="status"><div className="processing-orbit"><span /></div><h2>Aus Sprache wird Text.</h2><p>{processingLabel}</p></div>
              ) : d.listening ? (
                <div className="listening-stage">
                  <div className="capture-stage"><div className="listening-aperture"><Waveform stream={d.stream} bars={13} className="live-wave" /></div><h2>Du hast das Wort.</h2><p>{settings.transcriptionMode === "quality" ? "Klartext hört zu. Dein Text erscheint nach dem Stoppen." : "Die Browser-Erkennung hört zu."}</p></div>
                  {settings.transcriptionMode === "local" && <p className="live-transcript">{d.finalText} <span>{d.interim}</span><span className="live-caret" /></p>}
                </div>
              ) : hasDocument ? (
                <textarea ref={editor} value={d.finalText} aria-label="Diktierter Text" onChange={(e) => d.setFinalText(e.target.value)} placeholder="Deine Worte …" className="transcript-editor" />
              ) : (
                <div className="capture-stage idle-stage"><button className="resonance-aperture" onClick={startDictation} aria-label="Diktat starten"><LogoBars /></button><p className="ready-label">{needsKey ? "Einmal einrichten. Dann lossprechen." : "Bereit, wenn du es bist."}</p><button className="write-instead" onClick={() => setComposing(true)}>Oder direkt schreiben <span aria-hidden="true">↗</span></button></div>
              )}

              <div className="editor-meta">
                <span className="chip bg-teal/12 text-teal">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                  {langLabel}
                </span>
                <span className="text-xs font-medium text-mut">{words} Wörter</span>
                {lastRaw && lastRaw !== d.finalText && !d.listening && (
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs font-semibold text-mut underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {showRaw ? "Original ausblenden" : "Original anzeigen"}
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
                    Leeren
                  </button>
                  <button
                    onClick={() => copy(d.finalText)}
                    disabled={!d.finalText || processing || d.listening}
                    className="btn btn-secondary px-5 py-2 text-xs"
                  >
                    <CopyIcon />
                    Kopieren
                  </button>
                </div>
              </div>

              {showRaw && lastRaw && (
                <div className="pop mt-3 rounded-2xl bg-surface-2 p-4 text-sm text-mut kt-hair">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mut">
                    Original (ohne Klartext-Aufräumen)
                  </p>
                  <p className="whitespace-pre-wrap">{lastRaw}</p>
                </div>
              )}
            </div>

            <div className="capture-footer">{captureControl}<p><Kbd>Leertaste</Kbd> halten zum Diktieren<br /><span><Kbd>⌘/Strg</Kbd> + <Kbd>⇧</Kbd> + <Kbd>Leer</Kbd> für Start / Stopp</span></p></div>
          </div>
        )}

          <div className="space-y-5" hidden={tab !== "dateien"}>
            <div className="workspace-heading rise rise-1">
              <div>
              <p className="eyebrow">Audio importieren</p>
              <h1>
                Aufnahmen transkribieren
              </h1>
              <p>
                Sprachmemos, Meetings oder Sprachnachrichten in sauberen Text verwandeln.
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
              <p className="eyebrow">Auf diesem Gerät</p>
              <h1>
                Dein Verlauf
              </h1>
              <p>
                Finde, kopiere und verwalte deine letzten Diktate.
              </p>
              </div>
            </div>
            <HistoryPanel
              entries={history}
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
              <p className="eyebrow">Überall diktieren</p>
              <h1>
                Klartext für den Desktop
              </h1>
              <p>
                Diktiere per Shortcut in jede App auf deinem Mac oder Windows-PC.
                Der Text landet direkt an der Cursor-Position.
              </p>
              </div>
            </div>
            <DownloadPanel />
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
          <span>Transkription</span>
          <small>Wähle KI-Qualität oder Erkennung ohne eigenen API-Key</small>
        </div>
        <div className="mode-selector">
          <button
            data-active={settings.transcriptionMode === "quality"}
            onClick={() => setSettings((s) => ({ ...s, transcriptionMode: "quality" }))}
          >
            <span className="mode-icon"><SparkIcon /></span>
            <span><b>Beste Qualität</b><small>GPT Transcribe mit Kontext</small></span>
            <CheckIcon />
          </button>
          <button
            data-active={settings.transcriptionMode === "local"}
            onClick={() => setSettings((s) => ({ ...s, transcriptionMode: "local" }))}
          >
            <span className="mode-icon"><DeviceIcon /></span>
            <span><b>Lokal</b><small>Dateien: Whisper · Diktat: Browser</small></span>
            <CheckIcon />
          </button>
        </div>

        {settings.transcriptionMode === "local" && (
          <p className="text-xs text-mut">Nur Datei-Uploads werden hier lokal mit Whisper verarbeitet. Die Browser-Spracherkennung für Diktate kann einen externen Sprachdienst verwenden.</p>
        )}

        {settings.transcriptionMode === "quality" && (
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
            <p>Wird nur in diesem Browser gespeichert und für die Transkription direkt an OpenAI gesendet.</p>
          </div>
        )}
      </section>

      <section className="settings-section settings-grid" hidden={section !== "sprache"}>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Sprache</span>
          <select value={settings.lang} onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value }))} className="field">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Aufräumen</span>
          <select
            value={settings.cleanup}
            onChange={(e) => setSettings((s) => ({ ...s, cleanup: e.target.value as Settings["cleanup"] }))}
            className="field"
          >
            <option value="aus">Wortgetreu</option>
            <option value="sanft">Natürlich</option>
            <option value="stark">Kompakt</option>
          </select>
        </label>

        {settings.transcriptionMode === "local" && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Lokales Modell</span>
            <select
              value={settings.whisperModel}
              onChange={(e) => setSettings((s) => ({ ...s, whisperModel: e.target.value as Settings["whisperModel"] }))}
              className="field"
            >
              <option value="genau">Whisper small, genauer</option>
              <option value="schnell">Whisper base, schneller</option>
            </select>
          </label>
        )}

        <label className="toggle-row">
          <span><b>Automatisch kopieren</b><small>Ergebnis direkt in die Zwischenablage legen</small></span>
          <input
            type="checkbox"
            checked={settings.autoCopy}
            onChange={(e) => setSettings((s) => ({ ...s, autoCopy: e.target.checked }))}
          />
        </label>
      </section>

      <section className="settings-section" hidden={section !== "kontext"}>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Dein Kontext</span>
          <textarea
            value={settings.context}
            onChange={(e) => setSettings((s) => ({ ...s, context: e.target.value }))}
            placeholder="Zum Beispiel: Produktentwicklung, Automatisierung, Namen von Kunden oder Projekten"
            className="field min-h-24 resize-y text-sm"
          />
        </label>
        <p className="setting-help">Hilft der Erkennung, ähnlich klingende Fachbegriffe richtig zuzuordnen.</p>
      </section>

      <section className="settings-section" hidden={section !== "woerterbuch"}>
        <p className="mb-1.5 text-sm font-semibold">Persönliches Wörterbuch</p>
        <p className="mb-3 text-xs leading-relaxed text-mut">
          Namen und Fachbegriffe werden dem Qualitätsmodell schon vor der Erkennung als Hinweis mitgegeben.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Erkannter Begriff"
            placeholder="erkannt als …"
            className="field min-w-0 flex-1 text-sm"
          />
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            aria-label="Gewünschter Begriff"
            placeholder="soll heißen …"
            className="field min-w-0 flex-1 text-sm"
          />
          <button
            onClick={addEntry}
            aria-label="Wörterbuch-Eintrag hinzufügen"
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
                  aria-label="Eintrag löschen"
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
