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
  stop: () => void;
  setFinalText: (updater: string | ((prev: string) => string)) => void;
}

export function useDictation(lang: string): Dictation {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const recRef = useRef<Recognition>(null);
  const activeRef = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    setStartedAt(null);
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {
      /* war bereits gestoppt */
    }
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
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
    } catch {
      // Ohne Stream keine Waveform – die Erkennung fragt selbst nach dem Mikro
    }

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
        stop();
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
      stop();
    }
  }, [stop]);

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
