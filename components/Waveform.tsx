"use client";

import { useEffect, useRef } from "react";

/**
 * Zeichnet animierte Frequenz-Balken aus einem Mikrofon-Stream.
 * Farbe kommt über CSS `color` (currentColor) von außen.
 */
export default function Waveform({
  stream,
  bars = 22,
  className,
}: {
  stream: MediaStream | null;
  bars?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !stream) return;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const actx = new AC();
    const src = actx.createMediaStreamSource(stream);
    const analyser = actx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    src.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    let raf = 0;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      analyser.getByteFrequencyData(data);
      ctx.fillStyle = getComputedStyle(canvas).color;

      const gap = 3;
      const bw = Math.max(2, (w - gap * (bars - 1)) / bars);
      for (let i = 0; i < bars; i++) {
        // nur die unteren ~70 % des Spektrums nutzen (Sprache)
        const idx = Math.floor((i / bars) * data.length * 0.7);
        const v = data[idx] / 255;
        const bh = Math.max(3, v * h);
        const x = i * (bw + gap);
        const y = (h - bh) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, bh, bw / 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      actx.close();
    };
  }, [stream, bars]);

  return <canvas ref={ref} className={className} />;
}
