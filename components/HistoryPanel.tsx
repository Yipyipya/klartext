"use client";

import { useState } from "react";
import { computeStats, type HistoryEntry } from "@/lib/store";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPanel({
  entries,
  onCopy,
  onDelete,
  onClear,
}: {
  entries: HistoryEntry[];
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
    { label: "Wörter gesamt", value: stats.totalWords.toLocaleString("de-DE") },
    { label: "Ø Tempo", value: stats.avgWpm ? `${stats.avgWpm} WPM` : "–" },
    { label: "Tage-Serie", value: `${stats.streakDays} 🔥` },
    { label: "Aufnahmen", value: String(stats.entries) },
  ];

  return (
    <div className="space-y-5">
      {/* Statistik-Kacheln */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={`kt-card rise rise-${(i % 3) + 1} p-4 text-center`}
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
            placeholder="Verlauf durchsuchen …"
            className="field !rounded-full px-5 py-2.5 text-sm"
          />
          <button
            onClick={() => {
              if (confirm("Gesamten Verlauf löschen?")) onClear();
            }}
            className="btn btn-secondary shrink-0 px-4 py-2.5 text-xs"
          >
            Alles löschen
          </button>
        </div>
      )}

      {entries.length === 0 && (
        <div
          className="kt-card p-10 text-center"
          style={{ borderStyle: "dashed", borderWidth: "1.5px" }}
        >
          <p className="font-display text-2xl tracking-tight">Noch nichts diktiert</p>
          <p className="mt-1 text-sm text-mut">
            Jedes Diktat und jede transkribierte Datei landet automatisch hier –
            nur auf deinem Gerät.
          </p>
        </div>
      )}

      {filtered.map((e) => (
        <div key={e.id} className="kt-card pop p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-mut">
            <span
              className={`chip ${
                e.source === "diktat"
                  ? "bg-lav/50 text-lav-ink"
                  : "bg-teal/12 text-teal"
              }`}
            >
              {e.source === "diktat" ? "Diktat" : "Datei"}
            </span>
            <span>{formatDate(e.ts)}</span>
            <span>· {e.words} Wörter</span>
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
              Kopieren
            </button>
            {e.text.length > 220 && (
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="text-xs font-semibold text-mut transition-colors hover:text-ink"
              >
                {expanded === e.id ? "Weniger" : "Mehr anzeigen"}
              </button>
            )}
            <button
              onClick={() => onDelete(e.id)}
              className="ml-auto text-xs font-semibold text-mut transition-colors hover:text-ember-2"
            >
              Löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
