"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioCapture, type AudioCapture } from "../lib/audio-recorder";
import { uiText, type InterfaceLanguage } from "../shared/i18n";

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

export function useDictation(_lang: string, interfaceLanguage: InterfaceLanguage = "de"): Dictation {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const captureRef = useRef<AudioCapture | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const generationRef = useRef(0);
  const activeRef = useRef(false);
  useEffect(() => {
    const canRecordAudio = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    setSupported(canRecordAudio);
  }, []);

  useEffect(() => () => {
    activeRef.current = false;
    generationRef.current++;
    captureRef.current?.dispose();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    activeRef.current = false;
    generationRef.current++;
    setListening(false);
    setStartedAt(null);
    setInterim("");
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
      captureRef.current = createAudioCapture(s, 10_000, interfaceLanguage);
    } catch (error) {
      if (generation !== generationRef.current) return;
      activeRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setListening(false);
      setStartedAt(null);
      setError(error instanceof Error && error.name !== "NotAllowedError"
        ? error.message : uiText(interfaceLanguage, "Kein Mikrofonzugriff. Bitte erlaube das Mikrofon in den Website-Einstellungen deines Browsers.", "No microphone access. Please allow the microphone in your browser's site settings."));
      return;
    }
  }, [interfaceLanguage]);

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
