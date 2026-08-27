"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
import UploadPanel, { type UploadResult } from "@/components/UploadPanel";
import HistoryPanel from "@/components/HistoryPanel";
import DownloadPanel from "@/components/DownloadPanel";
import { useDictation } from "@/hooks/useDictation";
import { cleanTranscript } from "@/lib/cleanup";
import { transcribeWithOpenAI } from "@/lib/cloud-transcribe";
import { refineTranscriptWithOpenAI } from "@/lib/refine-transcript";
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
  const [dark, setDark] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [lastRaw, setLastRaw] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [processing, setProcessing] = useState(false);
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
    setShowRaw(false);
    setTab("diktat");
    sessionStartWords.current = countWords(finalRef.current);
    sessionPrefix.current = finalRef.current.trim();
    sessionStartAt.current = Date.now();
    void d.start();
  }, [d, showToast]);

  const finishDictation = useCallback(async () => {
    if (!listeningRef.current || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    const duration = (Date.now() - sessionStartAt.current) / 1000;
    try {
      const audio = await d.stop();
      // Kurz warten, bis späte finale Ergebnisse der Erkennung eingetroffen sind
      await new Promise((resolve) => setTimeout(resolve, 350));
      const raw = finalRef.current;
      const s = settingsRef.current;
      let dictatedRaw = raw.slice(sessionPrefix.current.length).trim();
      let usedCloudTranscription = false;

      if (s.transcriptionMode === "quality" && audio && s.openaiApiKey.trim()) {
        showToast("Transkription wird präzisiert …");
        try {
          dictatedRaw = await transcribeWithOpenAI(audio, {
            apiKey: s.openaiApiKey,
            language: s.lang,
            dictionary: s.dictionary,
            context: s.context,
          });
          usedCloudTranscription = true;
        } catch (error) {
          console.error(error);
          showToast("Cloud-Transkription fehlgeschlagen. Browser-Text wurde behalten.");
        }
      } else if (s.transcriptionMode === "quality" && !s.openaiApiKey.trim()) {
        setShowSettings(true);
        showToast("Für beste Qualität fehlt noch dein OpenAI API-Key.");
      }

      const originalRaw = [sessionPrefix.current, dictatedRaw].filter(Boolean).join(" ");
      if (usedCloudTranscription && s.cleanup !== "aus") {
        try {
          dictatedRaw = await refineTranscriptWithOpenAI(dictatedRaw, s.openaiApiKey);
        } catch (error) {
          console.error("Text-Feinschliff fehlgeschlagen, Transkription wird beibehalten:", error);
        }
      }

      const combinedRaw = [sessionPrefix.current, dictatedRaw].filter(Boolean).join(" ");
      const cleaned = cleanTranscript(combinedRaw, s);
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
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [d, copy, showToast]);

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
          el.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent) => {
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

  return (
    <div className="app-shell min-h-dvh">
      <aside className="desktop-sidebar kt-glass">
        <div className="brand-lockup">
          <span className="brand-mark"><LogoBars /></span>
          <div>
            <div className="brand-name">Klartext</div>
            <div className="brand-caption">Voice workspace</div>
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
                ? "Kontextbasierte Erkennung ist bereit."
                : "API-Key ergänzen, um den Qualitätsmodus zu aktivieren."
              : "Whisper läuft vollständig auf diesem Gerät."}
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

        {showSettings && (
          <div className="settings-layer">
            <button
              className="settings-scrim"
              aria-label="Einstellungen schließen"
              onClick={() => setShowSettings(false)}
            />
            <aside className="settings-drawer" role="dialog" aria-modal="true" aria-label="Einstellungen">
              <div className="settings-drawer-head">
                <div>
                  <p className="eyebrow">Persönlich einrichten</p>
                  <h2>Einstellungen</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="icon-btn" aria-label="Einstellungen schließen">
                  <CloseIcon />
                </button>
              </div>
              <SettingsCard settings={settings} setSettings={setSettings} />
            </aside>
          </div>
        )}

        <main className="workspace-content">
        {tab === "diktat" && (
          <div className="space-y-5">
            <div className="workspace-heading rise rise-1">
              <div>
                <p className="eyebrow">Neues Diktat</p>
                <h1>Was möchtest du festhalten?</h1>
                <p>Sprich frei. Klartext macht daraus einen sauberen, direkt nutzbaren Text.</p>
              </div>
              <button className="mode-badge" onClick={() => setShowSettings(true)}>
                <span className="status-orb" />
                <span>
                  <small>Modus</small>
                  {settings.transcriptionMode === "quality" ? "Beste Qualität" : "Lokal"}
                </span>
                <ChevronIcon />
              </button>
            </div>

            {!d.supported && (
              <div className="kt-hair rounded-3xl bg-lav/40 p-4 text-sm text-lav-ink">
                {settings.transcriptionMode === "local" ? (
                  <>Dein Browser unterstützt hier kein lokales Live-Diktat. Nutze Chrome, Edge oder Safari, wechsle zu <b>Beste Qualität</b> oder transkribiere eine Aufnahme im Tab <b>Dateien</b>.</>
                ) : (
                  <>Dieser Browser kann keine Mikrofonaufnahme starten. Prüfe die Browser-Berechtigungen oder transkribiere eine Aufnahme im Tab <b>Dateien</b>.</>
                )}
              </div>
            )}
            {d.error && (
              <div className="kt-hair rounded-3xl bg-ember-soft p-4 text-sm text-ink">
                {d.error}
              </div>
            )}

            {/* Editor-Karte */}
            <div
              className={`editor-card kt-card rise rise-2 p-6 transition-shadow duration-300 sm:p-8 ${
                d.listening ? "kt-elevated" : ""
              }`}
            >
              {d.listening ? (
                <div className="min-h-[38vh] whitespace-pre-wrap text-lg leading-relaxed">
                  {d.finalText}
                  {d.finalText && d.interim ? " " : ""}
                  <span className="text-mut">{d.interim}</span>
                  <span className="live-caret" />
                </div>
              ) : (
                <textarea
                  value={d.finalText}
                  onChange={(e) => d.setFinalText(e.target.value)}
                  placeholder="Halte die Leertaste gedrückt oder tippe unten auf „Diktieren“ und sprich einfach los …"
                  className="min-h-[42vh] w-full resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-mut/60"
                />
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
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
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      d.setFinalText("");
                      setLastRaw(null);
                      setShowRaw(false);
                    }}
                    disabled={!d.finalText}
                    className="btn btn-ghost px-4 py-2 text-xs"
                  >
                    Leeren
                  </button>
                  <button
                    onClick={() => copy(d.finalText)}
                    disabled={!d.finalText}
                    className="btn btn-primary px-5 py-2 text-xs"
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

            <p className="text-center text-xs text-mut">
              <Kbd>Leertaste</Kbd> halten zum Diktieren&nbsp;·&nbsp;
              <Kbd>⌘/Strg</Kbd>+<Kbd>⇧</Kbd>+<Kbd>Leer</Kbd> Start/Stopp
              (Hands-free)&nbsp;·&nbsp;<Kbd>Esc</Kbd> beenden
            </p>
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

      {/* ---------- Schwebende Diktier-Pill ---------- */}
      <div className="dictation-dock pointer-events-none fixed z-30 flex justify-center px-4">
        <div className="pointer-events-auto">
          {processing ? (
            <div className="processing-pill pop" role="status" aria-live="polite">
              <span className="spinner" />
              <span>Transkription wird präzisiert</span>
            </div>
          ) : d.listening ? (
            <div className="rec-halo pop flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-surface">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
              </span>
              <Waveform stream={d.stream} className="h-6 w-28 text-ember" />
              <span className="w-10 text-center font-mono text-sm tabular-nums">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </span>
              <button
                onClick={finishDictation}
                aria-label="Aufnahme beenden"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-ember to-ember-2 text-white transition-transform hover:scale-105 active:scale-95"
              >
                <StopIcon />
              </button>
            </div>
          ) : (
            <button
              onClick={startDictation}
              disabled={processing}
              className="dictation-pill group flex items-center gap-2.5 rounded-full py-2.5 pl-2.5 pr-5 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-ember to-ember-2 text-white shadow-[var(--sh-glow)] transition-transform duration-200 group-hover:scale-105">
                <MicIcon />
              </span>
              <span className="text-sm font-bold text-ink">Diktieren</span>
              <span className="hidden text-xs text-mut sm:inline">
                Leertaste halten
              </span>
            </button>
          )}
        </div>
      </div>

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
}: {
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
      <section className="settings-section">
        <div className="section-label">
          <span>Transkription</span>
          <small>Wähle Qualität oder vollständige Offline-Nutzung</small>
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
            <span><b>Lokal</b><small>Offline mit Whisper</small></span>
            <CheckIcon />
          </button>
        </div>

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

      <section className="settings-section settings-grid">
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

      <section className="settings-section">
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

      <section className="settings-section">
        <p className="mb-1.5 text-sm font-semibold">Persönliches Wörterbuch</p>
        <p className="mb-3 text-xs leading-relaxed text-mut">
          Namen und Fachbegriffe werden dem Qualitätsmodell schon vor der Erkennung als Hinweis mitgegeben.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="erkannt als …"
            className="field min-w-0 flex-1 text-sm"
          />
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
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
    dateien: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 15h8M8 18h5" /></>,
    verlauf: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M3 12H1" /></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[tab]}</svg>;
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
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <rect x="1" y="7" width="2.6" height="6" rx="1.3" />
      <rect x="5.8" y="4" width="2.6" height="12" rx="1.3" />
      <rect x="10.6" y="1" width="2.6" height="18" rx="1.3" />
      <rect x="15.4" y="6" width="2.6" height="8" rx="1.3" />
    </svg>
  );
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
