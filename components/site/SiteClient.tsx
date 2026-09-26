"use client";

import { useEffect, useState } from "react";

type DetectedOs = "mac" | "win" | null;

function detectOs(): DetectedOs {
  const platform = `${navigator.userAgent} ${(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || ""}`;
  if (/iPhone|iPad|Android/i.test(platform)) return null;
  if (/Mac/i.test(platform)) return "mac";
  if (/Win/i.test(platform)) return "win";
  return null;
}

/** Hauptaktion passend zum erkannten System; ohne Erkennung führt sie zur Auswahl. */
export function DownloadCta({
  macHref,
  windowsHref,
  labels,
}: {
  macHref: string;
  windowsHref: string;
  labels: { mac: string; windows: string; choose: string };
}) {
  const [os, setOs] = useState<DetectedOs>(null);
  useEffect(() => setOs(detectOs()), []);
  const href = os === "mac" ? macHref : os === "win" ? windowsHref : "#download";
  const label = os === "mac" ? labels.mac : os === "win" ? labels.windows : labels.choose;
  return (
    <a className="site-button site-button-primary" href={href}>
      <DownloadIcon />
      {label}
    </a>
  );
}

/**
 * Bisherige Web-App-Nutzer: installierte PWAs mit altem Startpfad öffnen direkt
 * den Arbeitsbereich; Browser mit vorhandenem Verlauf erhalten einen Hinweis.
 */
export function ReturningVisitor({ message, action }: { message: string; action: string }) {
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      window.location.replace("/app");
      return;
    }
    try {
      setReturning(Boolean(localStorage.getItem("klartext.settings") || localStorage.getItem("klartext.history")));
    } catch {
      setReturning(false);
    }
  }, []);
  if (!returning) return null;
  return (
    <div className="site-returning" role="status">
      <span>{message}</span>
      <a href="/app">{action}</a>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  );
}
