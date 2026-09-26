"use client";

import { useEffect, useRef, useState } from "react";
import {
  admitUploadFiles,
  decodeAudio,
  releaseUploadBudget,
  transcribeUpload,
  type UploadRejection,
} from "@/lib/audio-upload";
import { countWords, LANGUAGES, WHISPER_MODELS, type Settings } from "@/lib/store";
import { createCloudTranscriptionRequest, processExistingTranscript } from "@/lib/process-dictation";
import { inspectLocalModel, transcribeLocalPcm } from "@/lib/local-transcribe";
import { translate, uiText } from "@/shared/i18n";

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

const STATUS_LABEL_DE: Record<Status, string> = {
  wartet: "Wartet …",
  liest: "Audio wird gelesen …",
  modell: "Whisper-Modell wird geladen …",
  transkribiert: "Transkribiert …",
  feinschliff: "Text wird geglättet …",
  fertig: "Fertig",
  fehler: "Fehler",
};

const STATUS_LABEL_EN: Record<Status, string> = {
  wartet: "Waiting …",
  liest: "Reading audio …",
  modell: "Loading Whisper model …",
  transkribiert: "Transcribing …",
  feinschliff: "Refining text …",
  fertig: "Done",
  fehler: "Error",
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

  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const pendingBudgetRef = useRef({ count: 0, bytes: 0 });
  const busyRef = useRef(false);
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
    };
  }, []);

  async function processNext() {
    if (busyRef.current || !mountedRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
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
        const request = createCloudTranscriptionRequest(s, {
          language: langRef.current,
          signal: controller.signal,
        });
        const result = await transcribeUpload(next.file, request, (detail, partial) => {
              partialText = partial;
              patch(next.id, { status: "transkribiert", detail });
            });
        rawText = result.raw;
        duration = result.duration;
      } else {
        const model = WHISPER_MODELS[s.whisperModel];
        const modelStatus = await inspectLocalModel(model);
        if (modelStatus.state !== "ready") {
          throw new Error(translate(s.interfaceLanguage, "error.local.modelNotReady"));
        }
        const audio = await decodeAudio(next.file, true, s.interfaceLanguage);
        const pcm = new Float32Array(audio.channels[0].length);
        for (const channel of audio.channels) for (let i = 0; i < pcm.length; i++) pcm[i] += channel[i] / audio.channels.length;
        duration = audio.duration;
        rawText = await transcribeLocalPcm(pcm, {
          language: langRef.current.split("-")[0],
          model,
          signal: controller.signal,
          interfaceLanguage: s.interfaceLanguage,
        }, (event) => patch(next.id, event.type === "model"
          ? { status: "modell", detail: event.detail }
          : { status: "transkribiert", detail: undefined }));
      }
      const processed = await processExistingTranscript(rawText, { ...s, lang: langRef.current }, (stage) => {
        if (stage === "refining") patch(next.id, { status: "feinschliff", detail: undefined });
      }, controller.signal);
      const finalText = processed.text;
      const warning = processed.warning
        ? uiText(s.interfaceLanguage, "Der KI-Feinschliff war nicht verfügbar. Die vollständige Transkription wurde behalten.", "AI refinement was unavailable. The complete transcription was preserved.")
        : undefined;
      if (!mountedRef.current) return;
      patch(next.id, { status: "fertig", text: finalText, detail: undefined, error: warning });
      if (finalText) {
        onDone({
          text: finalText,
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
        error: `${partialText ? uiText(settingsRef.current.interfaceLanguage, "Unvollständig: Nur die bereits abgeschlossenen Abschnitte stehen unten. ", "Incomplete: Only the sections already completed are shown below. ") : ""}${err instanceof Error ? err.message : uiText(settingsRef.current.interfaceLanguage, "Diese Datei konnte nicht verarbeitet werden.", "This file could not be processed.")}`,
      });
    } finally {
      pendingBudgetRef.current = releaseUploadBudget(pendingBudgetRef.current, next.file);
      busyRef.current = false;
      abortRef.current = null;
      processNext();
    }
  }

  function addFiles(files: FileList | File[]) {
    const admission = admitUploadFiles(Array.from(files), pendingBudgetRef.current);
    if (!admission.decisions.length) return;
    pendingBudgetRef.current = admission.nextBudget;
    const rejectionMessage = (reason: UploadRejection) => {
      switch (reason) {
        case "unsupported-type": return uiText(settingsRef.current.interfaceLanguage, "Dieses Dateiformat wird nicht unterstützt.", "This file type is not supported.");
        case "empty-file": return uiText(settingsRef.current.interfaceLanguage, "Die Audiodatei ist leer.", "The audio file is empty.");
        case "file-too-large": return uiText(settingsRef.current.interfaceLanguage, "Dateien dürfen höchstens 100 MB groß sein.", "Files may be up to 100 MB.");
        case "queue-full": return uiText(settingsRef.current.interfaceLanguage, "Es können höchstens 12 Dateien gleichzeitig warten oder verarbeitet werden.", "Up to 12 files can wait or be processed at once.");
        case "queue-bytes-exceeded": return uiText(settingsRef.current.interfaceLanguage, "Laufende und wartende Dateien dürfen zusammen höchstens 300 MB groß sein. Warte, bis eine Datei fertig ist, und füge diese Datei dann erneut hinzu.", "Active and waiting files may total up to 300 MB. Wait for a file to finish, then add this file again.");
      }
    };
    const admitted = admission.decisions.map((decision) => ({
      file: decision.file,
      item: {
        id: crypto.randomUUID(),
        name: decision.file.name,
        status: decision.accepted ? "wartet" : "fehler",
        error: decision.accepted ? undefined : rejectionMessage(decision.reason),
      } satisfies Item,
      accepted: decision.accepted,
    }));
    const newItems = admitted.map(({ item }) => item);
    setItems((prev) => [...newItems, ...prev]);
    queueRef.current.push(...admitted.filter((entry) => entry.accepted).map(({ item, file }) => ({ id: item.id, file })));
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
        className={`kt-card !rounded-2xl p-10 text-center transition-all duration-200 ${
          dragOver
            ? "!border-ember bg-ember-soft scale-[1.01]"
            : ""
        }`}
        style={{ borderStyle: "dashed", borderWidth: "1.5px" }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ember text-white shadow-[var(--sh-glow)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17V4" />
            <path d="m6 10 6-6 6 6" />
            <path d="M4 20h16" />
          </svg>
        </div>
        <p className="font-display text-2xl tracking-tight">{uiText(settings.interfaceLanguage, "Sprachaufnahme hierher ziehen", "Drop a voice recording here")}</p>
        <p className="mt-1 text-sm text-mut">
          {uiText(settings.interfaceLanguage, "Sprachmemos, Meetings oder Sprachnachrichten als MP3, M4A, WAV, OGG oder WebM.", "Voice memos, meetings, or voice messages as MP3, M4A, WAV, OGG, or WebM.")}
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          className="btn btn-primary mt-5 px-6 py-2.5 text-sm"
        >
          {uiText(settings.interfaceLanguage, "Dateien auswählen", "Choose files")}
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
          {uiText(settings.interfaceLanguage, "Gesprochene Sprache", "Spoken language")}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="field !w-auto !py-1.5 text-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code === "de-DE" && settings.interfaceLanguage === "en" ? "German" : l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-mut">
          {uiText(settings.interfaceLanguage, "Wähle die hauptsächlich gesprochene Sprache. Große Dateien werden im Qualitätsmodus automatisch aufgeteilt (bis 100 MB und 30 Minuten). Maximal 12 Dateien und 300 MB gleichzeitig.", "Choose the language spoken most often. Large files are split automatically in best-quality mode (up to 100 MB and 30 minutes). Up to 12 files and 300 MB at once.")}
        </p>
      </div>

      <p className="text-center text-xs text-mut">
        {settings.transcriptionMode === "quality"
          ? uiText(settings.interfaceLanguage, `Im Qualitätsmodus wird die Aufnahme zur Transkription an ${settings.transcriptionProvider === "groq" ? "Groq" : settings.transcriptionProvider === "openai-compatible" ? "deinen kompatiblen Server" : "OpenAI"} gesendet. Dein Verlauf bleibt lokal in diesem Browser.`, `In best-quality mode, the recording is sent to ${settings.transcriptionProvider === "groq" ? "Groq" : settings.transcriptionProvider === "openai-compatible" ? "your compatible server" : "OpenAI"} for transcription. Your history stays local in this browser.`)
          : uiText(settings.interfaceLanguage, "Im Lokalmodus bleibt die Aufnahme auf deinem Gerät. Beim ersten Mal lädt Nivune einmalig ein Whisper-Modell von etwa 85 bis 600 MB – abhängig von Auswahl und Gerät.", "In local mode, the recording stays on your device. The first time, Nivune downloads a Whisper model of about 85 to 600 MB, depending on your selection and device.")}
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
              {(settings.interfaceLanguage === "en" ? STATUS_LABEL_EN : STATUS_LABEL_DE)[it.status]}
              {it.detail ? ` ${it.detail}` : ""}
            </span>
          </div>
          {it.status !== "fertig" && it.status !== "fehler" && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-ember transition-all duration-300"
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
                  {uiText(settings.interfaceLanguage, "Kopieren", "Copy")}
                </button>
                <span>{countWords(it.text)} {uiText(settings.interfaceLanguage, "Wörter", "words")}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
