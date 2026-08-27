"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioCapture, type AudioCapture } from "../lib/audio-recorder";

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

export function useDictation(lang: string, qualityMode = false): Dictation {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const recRef = useRef<Recognition>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const generationRef = useRef(0);
  const activeRef = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const w = window as any;
    const hasBrowserRecognition = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    const canRecordAudio = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    setSupported(qualityMode ? canRecordAudio : hasBrowserRecognition);
  }, [qualityMode]);

  useEffect(() => () => {
    activeRef.current = false;
    generationRef.current++;
    captureRef.current?.dispose();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try { recRef.current?.abort(); } catch { /* bereits beendet */ }
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    activeRef.current = false;
    generationRef.current++;
    setListening(false);
    setStartedAt(null);
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {
      /* war bereits gestoppt */
    }
    const capture = captureRef.current;
    stopPromiseRef.current = (async () => {
      try {
        return capture ? await capture.stop() : null;
      } finally {
        capture?.dispose();
        captureRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
      }
    })();
    try { return await stopPromiseRef.current; }
    finally { stopPromiseRef.current = null; }
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current || stopPromiseRef.current) return;
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor && !qualityMode) {
      setSupported(false);
      return;
    }
    if (recRef.current) {
      recRef.current.onresult = null;
      recRef.current.onend = null;
      recRef.current.onerror = null;
      try { recRef.current.abort(); } catch { /* bereits beendet */ }
      recRef.current = null;
    }
    setInterim("");
    setError(null);
    activeRef.current = true;
    const generation = ++generationRef.current;
    setListening(true);
    setStartedAt(Date.now());

    // Qualitätsmodus: genau ein Mikrofonpfad, keine parallele SpeechRecognition.
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current || generation !== generationRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(s);
      streamRef.current = s;
      if (qualityMode) captureRef.current = createAudioCapture(s);
    } catch (error) {
      if (generation !== generationRef.current) return;
      if (qualityMode || !Ctor) {
        activeRef.current = false;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
        setListening(false);
        setStartedAt(null);
        setError(error instanceof Error && error.name !== "NotAllowedError"
          ? error.message : "Kein Mikrofonzugriff. Bitte erlaube das Mikrofon in den Website-Einstellungen deines Browsers.");
        return;
      }
      // Ohne eigenen Stream keine Waveform. Die Browser-Erkennung fragt selbst nach dem Mikrofon.
    }

    if (qualityMode || !Ctor) return;

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
        void stop().catch(() => {});
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
      void stop().catch(() => {});
    }
  }, [qualityMode, stop]);

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
