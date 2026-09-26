"use client";

import { useState } from "react";
import { computeStats, type HistoryEntry } from "@/lib/store";
import { localeFor, uiText, type InterfaceLanguage } from "@/shared/i18n";

function formatDate(ts: number, interfaceLanguage: InterfaceLanguage): string {
  return new Date(ts).toLocaleString(localeFor(interfaceLanguage), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPanel({
  entries,
  interfaceLanguage,
  onCopy,
  onDelete,
  onClear,
}: {
  entries: HistoryEntry[];
  interfaceLanguage: InterfaceLanguage;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const stats = computeStats(entries);

  const filtered = query.trim()
    ? entries.filter((e) =>
        (e.text + " " + (e.label ?? "")).toLowerCase().includes(query.toLowerCase())
      )
    : entries;

  const tiles = [
    { label: uiText(interfaceLanguage, "Wörter gesamt", "Total words"), value: stats.totalWords.toLocaleString(localeFor(interfaceLanguage)) },
    { label: uiText(interfaceLanguage, "Ø Tempo", "Avg. pace"), value: stats.avgWpm ? `${stats.avgWpm} WPM` : "—" },
    { label: uiText(interfaceLanguage, "Tage-Serie", "Day streak"), value: String(stats.streakDays) },
    { label: uiText(interfaceLanguage, "Aufnahmen", "Recordings"), value: String(stats.entries) },
  ];

  return (
    <div className="space-y-5">
      {/* Statistik-Kacheln */}
      <div className="history-stats">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="history-stat"
          >
            <p className="font-display text-[2rem] leading-none tracking-tight">
              {t.value}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-mut">{t.label}</p>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <div className="flex items-center gap-2.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={uiText(interfaceLanguage, "Verlauf durchsuchen …", "Search history …")}
            aria-label={uiText(interfaceLanguage, "Verlauf durchsuchen", "Search history")}
            className="field px-4 py-2.5 text-sm"
          />
          <button
            onClick={() => {
              if (confirm(uiText(interfaceLanguage, "Gesamten Verlauf löschen?", "Delete all history?"))) onClear();
            }}
            className="btn btn-secondary shrink-0 px-4 py-2.5 text-xs"
          >
            {uiText(interfaceLanguage, "Alles löschen", "Delete all")}
          </button>
        </div>
      )}

      {entries.length === 0 && (
        <div
          className="kt-card p-10 text-center"
          style={{ borderStyle: "dashed", borderWidth: "1.5px" }}
        >
          <p className="font-display text-2xl tracking-tight">{uiText(interfaceLanguage, "Noch nichts diktiert", "Nothing dictated yet")}</p>
          <p className="mt-1 text-sm text-mut">
            {uiText(interfaceLanguage, "Jedes Diktat und jede transkribierte Datei landet automatisch hier. Der Verlauf wird nur in diesem Browser gespeichert.", "Every dictation and transcribed file appears here automatically. History is stored only in this browser.")}
          </p>
        </div>
      )}

      {entries.length > 0 && filtered.length === 0 && <p role="status" className="py-10 text-sm text-mut">{uiText(interfaceLanguage, `Keine Aufnahmen für „${query}“ gefunden.`, `No recordings found for “${query}”.`)}</p>}

      {filtered.map((e) => (
        <div key={e.id} className="history-entry">
          <div className="flex flex-wrap items-center gap-2 text-xs text-mut">
            <span
              className={`chip ${
                e.source === "diktat"
                  ? "bg-lav/50 text-lav-ink"
                  : "bg-teal/12 text-teal"
              }`}
            >
              {e.source === "diktat" ? uiText(interfaceLanguage, "Diktat", "Dictation") : uiText(interfaceLanguage, "Datei", "File")}
            </span>
            <span>{formatDate(e.ts, interfaceLanguage)}</span>
            <span>· {e.words} {uiText(interfaceLanguage, "Wörter", "words")}</span>
            {e.label && <span className="truncate">· {e.label}</span>}
          </div>
          <p
            className={`mt-3 whitespace-pre-wrap text-[15px] leading-relaxed ${
              expanded === e.id ? "" : "line-clamp-3"
            }`}
          >
            {e.text}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => onCopy(e.text)}
              className="btn btn-secondary px-4 py-1.5 text-xs"
            >
              {uiText(interfaceLanguage, "Kopieren", "Copy")}
            </button>
            {e.text.length > 220 && (
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="text-xs font-semibold text-mut transition-colors hover:text-ink"
              >
                {expanded === e.id ? uiText(interfaceLanguage, "Weniger", "Show less") : uiText(interfaceLanguage, "Mehr anzeigen", "Show more")}
              </button>
            )}
            <button
              onClick={() => onDelete(e.id)}
              className="ml-auto text-xs font-semibold text-mut transition-colors hover:text-ember-2"
            >
              {uiText(interfaceLanguage, "Löschen", "Delete")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
