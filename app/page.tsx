"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
import UploadPanel, { type UploadResult } from "@/components/UploadPanel";
import HistoryPanel from "@/components/HistoryPanel";
import { useDictation } from "@/hooks/useDictation";
import { cleanTranscript } from "@/lib/cleanup";
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

type Tab = "diktat" | "dateien" | "verlauf";

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
        showToast("Kopiert ✓ – wechsle die App und füge ein");
        return true;
      } catch {
        showToast("Kopieren nicht möglich – bitte manuell markieren");
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
    setTimeout(() => {
      const raw = finalRef.current;
      const cleaned = cleanTranscript(raw, settingsRef.current);
      const sessionWords = Math.max(
        0,
        countWords(cleaned) - sessionStartWords.current
      );
      if (!cleaned || sessionWords === 0) return;
      d.setFinalText(cleaned);
      setLastRaw(raw);
      setHistory(
        addHistory({
          id: crypto.randomUUID(),
          ts: Date.now(),
          source: "diktat",
          text: cleaned,
          raw,
          words: sessionWords,
          durationSec: Math.round(duration),
        })
      );
      if (settingsRef.current.autoCopy) copy(cleaned);
    }, 350);
  }, [d, copy]);

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
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink bg-ember text-[#1a1a1a]">
              <LogoBars />
            </span>
            <span className="hidden font-display text-2xl tracking-tight sm:inline">
              Klartext
            </span>
          </div>

          <nav className="ml-auto flex items-center gap-1 rounded-full border-2 border-ink bg-surface p-1">
            {(
              [
                ["diktat", "Diktat"],
                ["dateien", "Dateien"],
                ["verlauf", "Verlauf"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:px-3.5 sm:text-sm ${
                  tab === key ? "bg-ink text-bg" : "text-ink hover:bg-line/60"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={toggleTheme}
            aria-label="Design wechseln"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink transition-colors hover:bg-lav hover:text-[#1a1a1a]"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Einstellungen"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-colors ${
              showSettings
                ? "bg-ink text-bg"
                : "bg-surface text-ink hover:bg-lav hover:text-[#1a1a1a]"
            }`}
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* ---------- Einstellungen ---------- */}
      {showSettings && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <SettingsCard settings={settings} setSettings={setSettings} />
        </div>
      )}

      {/* ---------- Inhalt ---------- */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44 pt-6">
        {tab === "diktat" && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="font-display text-4xl sm:text-5xl">
                Sprich. Der Rest ist Text.
              </h1>
              <p className="mt-2 text-sm text-mut">
                Diktiere hier, kopiere mit einem Klick – und füge den Text in
                jeder App ein. Etwa 4× schneller als Tippen.
              </p>
            </div>

            {!d.supported && (
              <div className="rounded-[24px] border-2 border-ink bg-lav p-4 text-sm text-[#1a1a1a]">
                Dein Browser unterstützt kein Live-Diktat (z.&nbsp;B. Firefox).
                Nutze Chrome, Edge oder Safari – oder transkribiere Aufnahmen im
                Tab <b>Dateien</b>, das funktioniert überall.
              </div>
            )}
            {d.error && (
              <div className="rounded-[24px] border-2 border-ink bg-ember/15 p-4 text-sm">
                {d.error}
              </div>
            )}

            {/* Editor-Karte */}
            <div className="rounded-[32px] border-2 border-ink bg-surface p-6 shadow-[5px_5px_0_var(--ink)]">
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
                  placeholder="Halte die Leertaste gedrückt oder tippe unten auf „Diktieren“ – und sprich einfach los …"
                  className="min-h-[38vh] w-full resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-mut/70"
                />
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <span className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-teal-ink">
                  {langLabel}
                </span>
                <span className="text-xs text-mut">{words} Wörter</span>
                {lastRaw && lastRaw !== d.finalText && !d.listening && (
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs font-semibold text-mut underline-offset-2 hover:text-ink hover:underline"
                  >
                    {showRaw ? "Original ausblenden" : "Original anzeigen"}
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => {
                      d.setFinalText("");
                      setLastRaw(null);
                      setShowRaw(false);
                    }}
                    disabled={!d.finalText}
                    className="rounded-full px-4 py-2 text-xs font-bold text-mut transition-colors hover:text-ink disabled:opacity-40"
                  >
                    Leeren
                  </button>
                  <button
                    onClick={() => copy(d.finalText)}
                    disabled={!d.finalText}
                    className="rounded-full border-2 border-ink bg-lav px-5 py-2 text-xs font-bold text-[#1a1a1a] shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:shadow-none"
                  >
                    Kopieren
                  </button>
                </div>
              </div>

              {showRaw && lastRaw && (
                <div className="mt-3 rounded-2xl bg-line/40 p-4 text-sm text-mut">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider">
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
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="font-display text-4xl">Aufnahmen transkribieren</h1>
              <p className="mt-2 text-sm text-mut">
                Sprachmemos, Meetings oder Sprachnachrichten – privat, direkt
                auf deinem Gerät.
              </p>
            </div>
            <UploadPanel settings={settings} onDone={onUploadDone} onCopy={copy} />
          </div>
        )}

        {tab === "verlauf" && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="font-display text-4xl">Dein Verlauf</h1>
              <p className="mt-2 text-sm text-mut">
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
      </main>

      {/* ---------- Schwebende Diktier-Pill ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
        <div className="pointer-events-auto">
          {d.listening ? (
            <div className="rec-pulse flex items-center gap-3 rounded-full border-2 border-ink bg-ink px-4 py-2.5 text-bg">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember" />
              <Waveform stream={d.stream} className="h-6 w-28 text-ember" />
              <span className="w-10 text-center font-mono text-sm tabular-nums">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </span>
              <button
                onClick={finishDictation}
                aria-label="Aufnahme beenden"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ember text-[#1a1a1a] transition-transform hover:scale-105"
              >
                <StopIcon />
              </button>
            </div>
          ) : (
            <button
              onClick={startDictation}
              className="flex items-center gap-2.5 rounded-full border-2 border-ink bg-surface py-2.5 pl-3 pr-5 shadow-[4px_4px_0_var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ember text-[#1a1a1a]">
                <MicIcon />
              </span>
              <span className="text-sm font-bold">Diktieren</span>
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
          <div className="rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-semibold text-bg">
            {toast}
          </div>
        </div>
      )}

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line pb-28 pt-5">
        <div className="mx-auto max-w-3xl px-4 text-center text-xs text-mut">
          <p>
            Klartext läuft komplett in deinem Browser – keine Konten, keine
            Server, keine Kosten. Teile einfach den Link mit Freunden. 💜
          </p>
          <p className="mt-1">
            Tipp: Über das Browser-Menü „Zum Startbildschirm hinzufügen“ /
            „App installieren“ wird Klartext zur App auf jedem Gerät.
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
    <div className="grid gap-5 rounded-[24px] border-2 border-ink bg-surface p-5 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Sprache</span>
        <select
          value={settings.lang}
          onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value }))}
          className="w-full rounded-xl border-2 border-ink bg-surface px-3 py-2 outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Klartext-Aufräumen</span>
        <select
          value={settings.cleanup}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              cleanup: e.target.value as Settings["cleanup"],
            }))
          }
          className="w-full rounded-xl border-2 border-ink bg-surface px-3 py-2 outline-none"
        >
          <option value="aus">Aus – Rohtranskript behalten</option>
          <option value="sanft">Sanft – Füllwörter & Interpunktion</option>
          <option value="stark">Stark – auch Wiederholungen & Satzenden</option>
        </select>
      </label>

      <label className="flex items-center gap-2.5 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.autoCopy}
          onChange={(e) =>
            setSettings((s) => ({ ...s, autoCopy: e.target.checked }))
          }
          className="h-4 w-4 accent-[var(--teal)]"
        />
        Nach dem Diktat automatisch kopieren
      </label>

      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-bold">Persönliches Wörterbuch</p>
        <p className="mb-3 text-xs text-mut">
          Namen und Fachbegriffe, die die Erkennung falsch schreibt – Klartext
          ersetzt sie automatisch (z.&nbsp;B. „wisper flow“ → „Wispr Flow“).
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="erkannt als …"
            className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-surface px-3 py-2 text-sm outline-none"
          />
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            placeholder="soll heißen …"
            className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-surface px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={addEntry}
            aria-label="Wörterbuch-Eintrag hinzufügen"
            className="rounded-xl border-2 border-ink bg-lav px-4 py-2 text-sm font-bold text-[#1a1a1a]"
          >
            +
          </button>
        </div>
        {settings.dictionary.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {settings.dictionary.map((en, i) => (
              <span
                key={`${en.from}-${i}`}
                className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-bg px-3 py-1 text-xs"
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
                  className="ml-1 text-mut hover:text-ember-deep"
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
    <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
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
