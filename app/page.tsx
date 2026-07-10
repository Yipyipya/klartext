"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
import UploadPanel, { type UploadResult } from "@/components/UploadPanel";
import HistoryPanel from "@/components/HistoryPanel";
import DownloadPanel from "@/components/DownloadPanel";
import { useDictation } from "@/hooks/useDictation";
import { cleanTranscript } from "@/lib/cleanup";
import { polishTranscript } from "@/lib/polish";
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

  const d = useDictation(settings.lang);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef("");
  finalRef.current = d.finalText;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionStartWords = useRef(0);
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
    if (listeningRef.current) return;
    if (!d.supported) {
      showToast("Live-Diktat wird von diesem Browser nicht unterstützt");
      return;
    }
    setShowRaw(false);
    setTab("diktat");
    sessionStartWords.current = countWords(finalRef.current);
    sessionStartAt.current = Date.now();
    d.start();
  }, [d, showToast]);

  const finishDictation = useCallback(() => {
    if (!listeningRef.current) return;
    const duration = (Date.now() - sessionStartAt.current) / 1000;
    d.stop();
    // Kurz warten, bis späte finale Ergebnisse der Erkennung eingetroffen sind
    setTimeout(async () => {
      const raw = finalRef.current;
      const s = settingsRef.current;
      const cleaned = cleanTranscript(raw, s);
      const sessionWords = Math.max(
        0,
        countWords(cleaned) - sessionStartWords.current
      );
      if (!cleaned || sessionWords === 0) return;
      d.setFinalText(cleaned);
      setLastRaw(raw);

      // Optionaler kontextbasierter Feinschliff über die Claude-API
      let final = cleaned;
      if (s.polish && s.apiKey.trim()) {
        showToast("Klartext-Feinschliff läuft …");
        try {
          final = await polishTranscript(cleaned, s.apiKey.trim());
          d.setFinalText(final);
        } catch {
          showToast("Feinschliff fehlgeschlagen. Es wird die lokale Version genutzt.");
        }
      }

      setHistory(
        addHistory({
          id: crypto.randomUUID(),
          ts: Date.now(),
          source: "diktat",
          text: final,
          raw,
          words: Math.max(1, countWords(final) - sessionStartWords.current),
          durationSec: Math.round(duration),
        })
      );
      if (s.autoCopy) copy(final);
    }, 350);
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
    <div className="flex min-h-screen flex-col">
      {/* ---------- Header ---------- */}
      <header className="kt-glass sticky top-0 z-20 border-b border-line">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-b from-ember to-ember-2 text-white shadow-[var(--sh-glow)]">
              <LogoBars />
            </span>
            <span className="hidden font-display text-[1.65rem] leading-none tracking-tight sm:inline">
              Klartext
            </span>
          </div>

          <nav className="seg ml-auto">
            {(
              [
                ["diktat", "Diktat"],
                ["dateien", "Dateien"],
                ["verlauf", "Verlauf"],
                ["desktop", "Desktop"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                data-active={tab === key}
                className="seg-item sm:px-3.5 sm:text-sm"
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={toggleTheme}
            aria-label="Design wechseln"
            className="icon-btn shrink-0"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Einstellungen"
            data-active={showSettings}
            className="icon-btn shrink-0"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* ---------- Einstellungen ---------- */}
      {showSettings && (
        <div className="pop mx-auto w-full max-w-3xl px-4 pt-4">
          <SettingsCard settings={settings} setSettings={setSettings} />
        </div>
      )}

      {/* ---------- Inhalt ---------- */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44 pt-6">
        {tab === "diktat" && (
          <div className="space-y-5">
            <div className="rise rise-1 text-center">
              <span className="chip mx-auto mb-4 border border-line bg-surface/70 text-ink-soft shadow-[var(--sh-sm)]">
                <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                Privat · direkt im Browser
              </span>
              <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-[3.4rem]">
                Sprich.{" "}
                <span className="bg-gradient-to-r from-ember to-ember-2 bg-clip-text text-transparent">
                  Der Rest ist Text.
                </span>
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-mut">
                Diktiere hier, kopiere mit einem Klick und füge den Text in
                jeder App ein. Das ist rund 4× schneller als Tippen.
              </p>
            </div>

            {!d.supported && (
              <div className="kt-hair rounded-3xl bg-lav/40 p-4 text-sm text-lav-ink">
                Dein Browser unterstützt kein Live-Diktat, zum Beispiel Firefox.
                Nutze Chrome, Edge oder Safari. Alternativ kannst du Aufnahmen
                im Tab <b>Dateien</b> transkribieren, das funktioniert überall.
              </div>
            )}
            {d.error && (
              <div className="kt-hair rounded-3xl bg-ember-soft p-4 text-sm text-ink">
                {d.error}
              </div>
            )}

            {/* Editor-Karte */}
            <div
              className={`kt-card rise rise-2 p-6 transition-shadow duration-300 sm:p-7 ${
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
                  className="min-h-[38vh] w-full resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-mut/60"
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

        {tab === "dateien" && (
          <div className="space-y-5">
            <div className="rise rise-1 text-center">
              <h1 className="font-display text-[2.3rem] leading-tight tracking-tight sm:text-[2.8rem]">
                Aufnahmen transkribieren
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mut">
                Sprachmemos, Meetings oder Sprachnachrichten. Alles bleibt
                privat und direkt auf deinem Gerät.
              </p>
            </div>
            <div className="rise rise-2">
              <UploadPanel settings={settings} onDone={onUploadDone} onCopy={copy} />
            </div>
          </div>
        )}

        {tab === "verlauf" && (
          <div className="space-y-5">
            <div className="rise rise-1 text-center">
              <h1 className="font-display text-[2.3rem] leading-tight tracking-tight sm:text-[2.8rem]">
                Dein Verlauf
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mut">
                Alles bleibt lokal auf diesem Gerät gespeichert.
              </p>
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
            <div className="rise rise-1 text-center">
              <h1 className="font-display text-[2.3rem] leading-tight tracking-tight sm:text-[2.8rem]">
                Klartext für den Desktop
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mut">
                Diktiere per Shortcut in jede App auf deinem Mac oder Windows-PC.
                Der Text landet direkt an der Cursor-Position.
              </p>
            </div>
            <DownloadPanel />
          </div>
        )}
      </main>

      {/* ---------- Schwebende Diktier-Pill ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex justify-center px-4">
        <div className="pointer-events-auto">
          {d.listening ? (
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
              className="kt-glass group flex items-center gap-2.5 rounded-full border border-line py-2.5 pl-2.5 pr-5 shadow-[var(--sh-lg)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
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

      {/* ---------- Footer ---------- */}
      <footer className="pb-32 pt-6">
        <div className="mx-auto max-w-3xl px-4 text-center text-xs leading-relaxed text-mut">
          <p>
            Klartext läuft direkt in deinem Browser. Es gibt keine Konten und
            keine Kosten. Teile einfach den Link mit Freunden.
          </p>
          <p className="mt-1">
            Du kannst Klartext auch als App installieren. Wähle dazu im
            Browser-Menü „Zum Startbildschirm hinzufügen“ oder „App
            installieren“.
          </p>
        </div>
      </footer>
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
    <div className="kt-card grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">Sprache</span>
        <select
          value={settings.lang}
          onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value }))}
          className="field"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">Klartext-Aufräumen</span>
        <select
          value={settings.cleanup}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              cleanup: e.target.value as Settings["cleanup"],
            }))
          }
          className="field"
        >
          <option value="aus">Aus: Rohtranskript behalten</option>
          <option value="sanft">Sanft: Füllwörter und Interpunktion</option>
          <option value="stark">Stark: auch Wiederholungen und Satzenden</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">
          Genauigkeit (Datei-Transkription)
        </span>
        <select
          value={settings.whisperModel}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              whisperModel: e.target.value as Settings["whisperModel"],
            }))
          }
          className="field"
        >
          <option value="genau">Genau: Whisper small (~250 MB)</option>
          <option value="schnell">Schnell: Whisper base (~80 MB)</option>
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-2.5 self-end pb-2.5 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.autoCopy}
          onChange={(e) =>
            setSettings((s) => ({ ...s, autoCopy: e.target.checked }))
          }
          className="h-4 w-4 accent-[var(--ember)]"
        />
        Nach dem Diktat automatisch kopieren
      </label>

      <div className="kt-hair rounded-2xl bg-surface-2 p-4 sm:col-span-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={settings.polish}
            onChange={(e) =>
              setSettings((s) => ({ ...s, polish: e.target.checked }))
            }
            className="h-4 w-4 accent-[var(--ember)]"
          />
          KI-Feinschliff mit Claude
          <span className="chip bg-lav/50 text-lav-ink">eigener API-Key</span>
        </label>
        <p className="mb-3 mt-1.5 text-xs leading-relaxed text-mut">
          Korrigiert falsch erkannte Wörter anhand des Kontexts, wie beim
          Original. Dein Key bleibt nur in diesem Browser gespeichert und wird
          ausschließlich direkt an die Claude-API gesendet (console.anthropic.com).
        </p>
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
          placeholder="sk-ant-…"
          autoComplete="off"
          className="field text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-semibold">Persönliches Wörterbuch</p>
        <p className="mb-3 text-xs leading-relaxed text-mut">
          Namen und Fachbegriffe, die die Erkennung falsch schreibt. Klartext
          ersetzt sie automatisch, zum Beispiel „wisper flow“ zu „Wispr Flow“.
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
      </div>
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
