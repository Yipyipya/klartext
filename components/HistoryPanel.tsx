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
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[24px] border-2 border-ink bg-surface p-4 text-center"
          >
            <p className="font-display text-3xl">{t.value}</p>
            <p className="mt-1 text-xs font-semibold text-mut">{t.label}</p>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Verlauf durchsuchen …"
            className="w-full rounded-full border-2 border-ink bg-surface px-5 py-2.5 text-sm outline-none placeholder:text-mut focus:border-ember"
          />
          <button
            onClick={() => {
              if (confirm("Gesamten Verlauf löschen?")) onClear();
            }}
            className="shrink-0 rounded-full border-2 border-ink bg-surface px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-ember/15"
          >
            Alles löschen
          </button>
        </div>
      )}

      {entries.length === 0 && (
        <div className="rounded-[32px] border-2 border-dashed border-ink/40 bg-surface p-10 text-center">
          <p className="font-display text-2xl">Noch nichts diktiert</p>
          <p className="mt-1 text-sm text-mut">
            Jedes Diktat und jede transkribierte Datei landet automatisch hier –
            nur auf deinem Gerät.
          </p>
        </div>
      )}

      {filtered.map((e) => (
        <div key={e.id} className="rounded-[24px] border-2 border-ink bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-mut">
            <span
              className={`rounded-full px-3 py-1 font-semibold ${
                e.source === "diktat"
                  ? "bg-lav text-[#1a1a1a]"
                  : "bg-teal text-teal-ink"
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
              className="rounded-full border-2 border-ink bg-surface px-4 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-lav hover:text-[#1a1a1a]"
            >
              Kopieren
            </button>
            {e.text.length > 220 && (
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="text-xs font-semibold text-mut hover:text-ink"
              >
                {expanded === e.id ? "Weniger" : "Mehr anzeigen"}
              </button>
            )}
            <button
              onClick={() => onDelete(e.id)}
              className="ml-auto text-xs font-semibold text-mut hover:text-ember-deep"
            >
              Löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
