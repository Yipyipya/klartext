"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Web Speech API ist nicht in den TS-DOM-Typen enthalten */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;

export interface Dictation {
  supported: boolean;
  listening: boolean;
  finalText: string;
  interim: string;
  error: string | null;
  stream: MediaStream | null;
  startedAt: number | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  setFinalText: (updater: string | ((prev: string) => string)) => void;
}

export function useDictation(lang: string, allowAudioOnly = false): Dictation {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const recRef = useRef<Recognition>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeRef = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const w = window as any;
    const hasBrowserRecognition = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    const canRecordAudio = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    setSupported(hasBrowserRecognition || (allowAudioOnly && canRecordAudio));
  }, [allowAudioOnly]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    activeRef.current = false;
    setListening(false);
    setStartedAt(null);
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {
      /* war bereits gestoppt */
    }
    const recorder = recorderRef.current;
    const audio = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recorder.addEventListener(
        "stop",
        () => {
          const type = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm";
          resolve(new Blob(audioChunksRef.current, { type }));
        },
        { once: true }
      );
      recorder.stop();
    });
    recorderRef.current = null;
    audioChunksRef.current = [];
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
    return audio;
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor && !allowAudioOnly) {
      setSupported(false);
      return;
    }
    setError(null);
    activeRef.current = true;
    setListening(true);
    setStartedAt(Date.now());

    // Eigener Mikrofon-Stream nur für die Waveform-Anzeige
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(s);
      if (typeof MediaRecorder !== "undefined") {
        const preferred = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
        ].find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = new MediaRecorder(s, preferred ? { mimeType: preferred } : undefined);
        audioChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size) audioChunksRef.current.push(event.data);
        };
        recorder.start(250);
        recorderRef.current = recorder;
      }
    } catch {
      if (!Ctor) {
        activeRef.current = false;
        setListening(false);
        setStartedAt(null);
        setError("Kein Mikrofonzugriff. Bitte erlaube das Mikrofon in den Browser-Einstellungen.");
        return;
      }
      // Ohne eigenen Stream keine Waveform. Die Browser-Erkennung fragt selbst nach dem Mikrofon.
    }

    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let interimStr = "";
      let finalAdd = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalAdd += r[0].transcript;
        else interimStr += r[0].transcript;
      }
      if (finalAdd.trim()) {
        setFinalText((prev) =>
          prev ? prev.replace(/\s+$/, "") + " " + finalAdd.trim() : finalAdd.trim()
        );
      }
      setInterim(interimStr);
    };

    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError(
          "Kein Mikrofonzugriff. Bitte erlaube das Mikrofon in den Browser-Einstellungen."
        );
        void stop();
      }
      // "no-speech" u. ä. ignorieren – onend startet neu
    };

    // Chrome beendet die Erkennung nach Stillephasen von selbst → neu starten
    rec.onend = () => {
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          /* Neustart kollidierte – nächstes onend versucht es erneut */
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("Die Spracherkennung konnte nicht gestartet werden.");
      void stop();
    }
  }, [allowAudioOnly, stop]);

  return {
    supported,
    listening,
    finalText,
    interim,
    error,
    stream,
    startedAt,
    start,
    stop,
    setFinalText,
  };
}
