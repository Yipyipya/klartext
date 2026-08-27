"use client";

import { useEffect, useRef, useState } from "react";
import { cleanTranscript } from "@/lib/cleanup";
import { decodeAudio, transcribeUpload } from "@/lib/audio-upload";
import { refineTranscriptWithOpenAI } from "@/lib/refine-transcript";
import { countWords, LANGUAGES, WHISPER_MODELS, type Settings } from "@/lib/store";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UploadResult {
  text: string;
  raw: string;
  label: string;
  durationSec: number;
}

type Status =
  | "wartet"
  | "liest"
  | "modell"
  | "transkribiert"
  | "feinschliff"
  | "fertig"
  | "fehler";

interface Item {
  id: string;
  name: string;
  status: Status;
  detail?: string;
  text?: string;
  error?: string;
}

const STATUS_LABEL: Record<Status, string> = {
  wartet: "Wartet …",
  liest: "Audio wird gelesen …",
  modell: "Whisper-Modell wird geladen …",
  transkribiert: "Transkribiert …",
  feinschliff: "Text wird geglättet …",
  fertig: "Fertig",
  fehler: "Fehler",
};

export default function UploadPanel({
  settings,
  onDone,
  onCopy,
}: {
  settings: Settings;
  onDone: (r: UploadResult) => void;
  onCopy: (text: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // Whisper braucht die Sprache vorgegeben: transformers.js erkennt sie nicht
  // selbst, sondern fällt ohne Angabe stillschweigend auf Englisch zurück.
  const [lang, setLang] = useState(settings.lang);

  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const busyRef = useRef(false);
  const currentRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const langRef = useRef(lang);
  langRef.current = lang;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Einstellungen kommen erst nach der Hydration aus dem localStorage
  useEffect(() => {
    setLang(settings.lang);
  }, [settings.lang]);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/whisper.worker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current.onmessage = (ev) => {
        const msg = ev.data;
        const id = msg.id ?? currentRef.current;
        if (!id) return;
        if (msg.type === "model") {
          patch(id, { status: "modell", detail: `${msg.progress} %` });
        } else if (msg.type === "status") {
          patch(id, { status: "transkribiert", detail: undefined });
        }
      };
    }
    return workerRef.current;
  }

  function transcribeInWorker(
    id: string,
    pcm: Float32Array,
    language: string | null
  ): Promise<string> {
    const worker = getWorker();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMsg);
        worker.removeEventListener("error", onError);
      };
      const onError = () => {
        cleanup();
        worker.terminate();
        workerRef.current = null;
        reject(new Error("Lokales Whisper wurde beendet. Bitte versuche die Datei erneut."));
      };
      const timeout = setTimeout(onError, 20 * 60 * 1000);
      const onMsg = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.id !== id) return;
        if (msg.type === "result") {
          cleanup();
          resolve(msg.text as string);
        } else if (msg.type === "error") {
          cleanup();
          reject(new Error(msg.message));
        }
      };
      worker.addEventListener("message", onMsg);
      worker.addEventListener("error", onError);
      worker.postMessage(
        {
          id,
          audio: pcm,
          language,
          model: WHISPER_MODELS[settingsRef.current.whisperModel],
        },
        [pcm.buffer as ArrayBuffer]
      );
    });
  }

  async function processNext() {
    if (busyRef.current || !mountedRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    currentRef.current = next.id;
    const controller = new AbortController();
    abortRef.current = controller;
    let partialText = "";
    try {
      patch(next.id, { status: "liest" });
      const s = settingsRef.current;
      const useCloud = s.transcriptionMode === "quality";
      let rawText: string;
      let duration: number;
      if (useCloud) {
        const result = await transcribeUpload(next.file, {
              apiKey: s.openaiApiKey,
              language: langRef.current,
              dictionary: s.dictionary,
              context: s.context,
              signal: controller.signal,
            }, (detail, partial) => {
              partialText = partial;
              patch(next.id, { status: "transkribiert", detail });
            });
        rawText = result.raw;
        duration = result.duration;
      } else {
        const audio = await decodeAudio(next.file, true);
        const pcm = new Float32Array(audio.channels[0].length);
        for (const channel of audio.channels) for (let i = 0; i < pcm.length; i++) pcm[i] += channel[i] / audio.channels.length;
        duration = audio.duration;
        rawText = await transcribeInWorker(next.id, pcm, langRef.current.split("-")[0]);
      }
      let finalText = rawText;
      let warning: string | undefined;
      if (useCloud && s.cleanup !== "aus") {
        patch(next.id, { status: "feinschliff", detail: undefined });
        try {
          finalText = await refineTranscriptWithOpenAI(rawText, s.openaiApiKey, controller.signal);
        } catch (error) {
          warning = "Der KI-Feinschliff war nicht verfügbar. Die vollständige Transkription wurde behalten.";
          console.error("Text-Feinschliff fehlgeschlagen, Transkription wird beibehalten:", error);
        }
      }
      if (!mountedRef.current) return;
      const cleaned = cleanTranscript(finalText, s);
      patch(next.id, { status: "fertig", text: cleaned, detail: undefined, error: warning });
      if (cleaned) {
        onDone({
          text: cleaned,
          raw: rawText,
          label: next.file.name,
          durationSec: Math.round(duration),
        });
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      patch(next.id, {
        status: "fehler",
        detail: undefined,
        text: partialText || undefined,
        error: `${partialText ? "Unvollständig: Nur die bereits abgeschlossenen Abschnitte stehen unten. " : ""}${err instanceof Error ? err.message : "Diese Datei konnte nicht verarbeitet werden."}`,
      });
      console.error(err);
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      currentRef.current = null;
      processNext();
    }
  }

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || /\.(mp3|m4a|wav|ogg|oga|webm|mp4|aac|flac)$/i.test(f.name)
    );
    if (!list.length) return;
    const newItems: Item[] = list.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: "wartet",
    }));
    setItems((prev) => [...newItems, ...prev]);
    queueRef.current.push(...newItems.map((it, i) => ({ id: it.id, file: list[i] })));
    processNext();
  }

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`kt-card !rounded-[32px] p-10 text-center transition-all duration-200 ${
          dragOver
            ? "!border-ember bg-ember-soft scale-[1.01]"
            : ""
        }`}
        style={{ borderStyle: "dashed", borderWidth: "1.5px" }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-ember to-ember-2 text-white shadow-[var(--sh-glow)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17V4" />
            <path d="m6 10 6-6 6 6" />
            <path d="M4 20h16" />
          </svg>
        </div>
        <p className="font-display text-2xl tracking-tight">Sprachaufnahme hierher ziehen</p>
        <p className="mt-1 text-sm text-mut">
          Sprachmemos, Meetings oder Sprachnachrichten als MP3, M4A, WAV, OGG
          oder WebM.
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          className="btn btn-primary mt-5 px-6 py-2.5 text-sm"
        >
          Dateien auswählen
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.oga,.aac,.flac"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <label className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-mut">
          Gesprochene Sprache
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="field !w-auto !py-1.5 text-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-mut">
          Wähle die hauptsächlich gesprochene Sprache. Große Dateien werden im
          Qualitätsmodus automatisch aufgeteilt (bis 100 MB und 30 Minuten).
        </p>
      </div>

      <p className="text-center text-xs text-mut">
        {settings.transcriptionMode === "quality"
          ? "Im Qualitätsmodus wird die Aufnahme zur Transkription an OpenAI gesendet. Dein Verlauf bleibt lokal in diesem Browser."
          : "Im Lokalmodus bleibt die Aufnahme auf deinem Gerät. Beim ersten Mal lädt Klartext einmalig ein Whisper-Modell von etwa 80 bis 250 MB."}
      </p>

      {/* Ergebnisliste */}
      {items.map((it) => (
        <div key={it.id} className="kt-card pop p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-full truncate text-sm font-semibold">{it.name}</p>
            <span
              className={`chip ${
                it.status === "fertig"
                  ? "bg-teal/12 text-teal"
                  : it.status === "fehler"
                    ? "bg-ember-soft text-ember-2"
                    : "bg-lav/50 text-lav-ink"
              }`}
            >
              {STATUS_LABEL[it.status]}
              {it.detail ? ` ${it.detail}` : ""}
            </span>
          </div>
          {it.status !== "fertig" && it.status !== "fehler" && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ember to-ember-2 transition-all duration-300"
                style={{
                  width:
                    it.status === "modell" && it.detail
                      ? it.detail.replace(" %", "%")
                      : it.status === "transkribiert"
                        ? "90%"
                        : "15%",
                }}
              />
            </div>
          )}
          {it.error && <p className="mt-3 text-sm text-ember-2">{it.error}</p>}
          {it.text && (
            <>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {it.text}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-mut">
                <button
                  onClick={() => onCopy(it.text!)}
                  className="btn btn-secondary px-4 py-1.5 text-xs"
                >
                  Kopieren
                </button>
                <span>{countWords(it.text)} Wörter</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
