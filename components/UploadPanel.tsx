"use client";

import { useEffect, useRef, useState } from "react";
import { cleanTranscript } from "@/lib/cleanup";
import { polishTranscript } from "@/lib/polish";
import { countWords, WHISPER_MODELS, type Settings } from "@/lib/store";

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
  feinschliff: "Klartext-Feinschliff …",
  fertig: "Fertig",
  fehler: "Fehler",
};

async function decodeAudio(file: File): Promise<{ pcm: Float32Array; duration: number }> {
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  // Whisper erwartet 16 kHz mono – der AudioContext resampled beim Dekodieren
  const ctx = new AC({ sampleRate: 16000 });
  try {
    const audio: AudioBuffer = await ctx.decodeAudioData(buf);
    const { numberOfChannels, length, duration } = audio;
    let pcm: Float32Array;
    if (numberOfChannels === 1) {
      pcm = audio.getChannelData(0);
    } else {
      pcm = new Float32Array(length);
      for (let c = 0; c < numberOfChannels; c++) {
        const d = audio.getChannelData(c);
        for (let i = 0; i < length; i++) pcm[i] += d[i] / numberOfChannels;
      }
    }
    return { pcm, duration };
  } finally {
    ctx.close();
  }
}

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
  const [autoLang, setAutoLang] = useState(true);

  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const busyRef = useRef(false);
  const currentRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const autoLangRef = useRef(autoLang);
  autoLangRef.current = autoLang;
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  useEffect(() => {
    return () => {
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
      const onMsg = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.id !== id) return;
        if (msg.type === "result") {
          worker.removeEventListener("message", onMsg);
          resolve(msg.text as string);
        } else if (msg.type === "error") {
          worker.removeEventListener("message", onMsg);
          reject(new Error(msg.message));
        }
      };
      worker.addEventListener("message", onMsg);
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
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    currentRef.current = next.id;
    try {
      patch(next.id, { status: "liest" });
      const { pcm, duration } = await decodeAudio(next.file);
      patch(next.id, { status: "transkribiert" });
      const lang = autoLangRef.current
        ? null
        : settingsRef.current.lang.split("-")[0];
      const rawText = await transcribeInWorker(next.id, pcm, lang);
      let cleaned = cleanTranscript(rawText, settingsRef.current);
      const s = settingsRef.current;
      if (cleaned && s.polish && s.apiKey.trim()) {
        patch(next.id, { status: "feinschliff", detail: undefined });
        try {
          cleaned = await polishTranscript(cleaned, s.apiKey.trim());
        } catch {
          // Feinschliff fehlgeschlagen – lokale Version behalten
        }
      }
      patch(next.id, { status: "fertig", text: cleaned, detail: undefined });
      if (cleaned) {
        onDone({
          text: cleaned,
          raw: rawText,
          label: next.file.name,
          durationSec: Math.round(duration),
        });
      }
    } catch (err: any) {
      patch(next.id, {
        status: "fehler",
        error:
          "Diese Datei konnte nicht verarbeitet werden. Unterstützt sind gängige Audio-Formate (MP3, M4A, WAV, OGG, WebM).",
      });
      console.error(err);
    } finally {
      busyRef.current = false;
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
          Sprachmemos, Meetings, Sprachnachrichten – MP3, M4A, WAV, OGG, WebM
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
        <label className="mt-5 flex items-center justify-center gap-2 text-xs text-mut">
          <input
            type="checkbox"
            checked={autoLang}
            onChange={(e) => setAutoLang(e.target.checked)}
            className="h-4 w-4 accent-[var(--ember)]"
          />
          Sprache automatisch erkennen
        </label>
      </div>

      <p className="text-center text-xs text-mut">
        Läuft komplett lokal in deinem Browser – die Aufnahme wird nirgendwohin
        hochgeladen. Beim ersten Mal lädt Klartext einmalig ein Whisper-Modell
        (~80–250&nbsp;MB je nach Genauigkeit in den Einstellungen), danach ist es
        gecacht.
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
                      : it.status === "transkribiert" || it.status === "feinschliff"
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
