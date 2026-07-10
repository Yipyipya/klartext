"use client";

import { useEffect, useState } from "react";

/* Stabile Links: „latest" zeigt immer auf die neueste Veröffentlichung,
   sodass sich die URLs bei einem neuen Build nicht ändern. */
const REPO = "https://github.com/Yipyipya/klartext";
const REL = `${REPO}/releases/latest/download`;

type OS = "mac" | "win";

type Platform = {
  os: OS;
  name: string;
  arch: string;
  size: string;
  file: string;
  href: string;
  Icon: () => React.JSX.Element;
  advantage: string;
  install: string[];
  shortcut: string;
};

const PLATFORMS: Platform[] = [
  {
    os: "mac",
    name: "macOS",
    arch: "Apple Silicon (M1 und neuer)",
    size: "115 MB",
    file: "Klartext-Mac-AppleSilicon.dmg",
    href: `${REL}/Klartext-Mac-AppleSilicon.dmg`,
    Icon: AppleIcon,
    advantage:
      "Sitzt oben in der Menüleiste und diktiert in jede App, in E-Mails, Slack, Notizen oder den Browser.",
    install: [
      "Die geladene .dmg-Datei per Doppelklick öffnen.",
      "Klartext in den Ordner „Programme“ ziehen.",
      "Beim ersten Start rechtsklicken und „Öffnen“ wählen, da die App nicht signiert ist.",
      "Im Dialog Mikrofon und Bedienungshilfen erlauben, damit der Text an der Cursor-Position landet.",
    ],
    shortcut: "⌥ + Leertaste",
  },
  {
    os: "win",
    name: "Windows",
    arch: "64 Bit (Windows 10 und 11)",
    size: "95 MB",
    file: "Klartext-Windows.exe",
    href: `${REL}/Klartext-Windows.exe`,
    Icon: WindowsIcon,
    advantage:
      "Läuft im Infobereich neben der Uhr und fügt den Text direkt dort ein, wo dein Cursor gerade steht.",
    install: [
      "Die geladene .exe-Datei per Doppelklick starten.",
      "Falls Windows warnt, auf „Weitere Informationen“ und dann „Trotzdem ausführen“ klicken, da die App nicht signiert ist.",
      "Dem Einrichtungsassistenten folgen, Klartext legt eine Verknüpfung im Startmenü an.",
      "Beim ersten Start den Mikrofon-Zugriff erlauben.",
    ],
    shortcut: "Strg + Umschalt + Leertaste",
  },
];

export default function DownloadPanel() {
  const [you, setYou] = useState<OS | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Mac/i.test(ua)) setYou("mac");
    else if (/Win/i.test(ua)) setYou("win");
  }, []);

  // Das eigene System nach vorne sortieren
  const ordered = [...PLATFORMS].sort((a) =>
    you && a.os === you ? -1 : 0
  );

  return (
    <div className="space-y-5">
      {/* Warum die Desktop-App */}
      <div className="kt-card rise rise-1 p-6 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-ember to-ember-2 text-white shadow-[var(--sh-glow)]">
            <BoltIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight tracking-tight">
              Diktieren in jeder App, ganz ohne Tab-Wechsel
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-mut">
              Die Web-App diktiert und du kopierst den Text selbst. Die
              Desktop-App geht einen Schritt weiter. Du drückst überall auf dem
              Rechner deinen Shortcut, sprichst, und der fertige Text erscheint
              sofort an der Stelle, an der dein Cursor steht. In der E-Mail, im
              Chat, im Dokument. Sie bleibt dezent in der Ecke und wartet auf
              dich.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Systemweit", "Funktioniert in jedem Programm, nicht nur im Browser."],
            ["Ein Tastendruck", "Shortcut drücken, sprechen, fertig eingefügt."],
            ["Privat", "Die Spracherkennung läuft lokal auf deinem Gerät."],
          ].map(([t, d]) => (
            <div key={t} className="kt-hair rounded-2xl bg-surface-2 p-4">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-1 text-xs leading-relaxed text-mut">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plattform-Karten */}
      <div className="grid gap-5 sm:grid-cols-2">
        {ordered.map((p, i) => (
          <div
            key={p.os}
            className={`kt-card rise rise-${(i % 2) + 2} flex flex-col p-6`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-surface">
                <p.Icon />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl leading-none tracking-tight">
                    {p.name}
                  </h3>
                  {you === p.os && (
                    <span className="chip bg-teal/12 text-teal">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                      dein System
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-mut">{p.arch}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {p.advantage}
            </p>

            <a
              href={p.href}
              className="btn btn-primary mt-5 w-full justify-center py-3 text-sm"
            >
              <DownloadIcon />
              Herunterladen
              <span className="font-normal text-white/70">· {p.size}</span>
            </a>

            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-mut">
                Installation
              </p>
              <ol className="space-y-2">
                {p.install.map((step, n) => (
                  <li key={n} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-ink-soft kt-hair">
                      {n + 1}
                    </span>
                    <span className="text-ink-soft">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-ember-soft px-4 py-3">
              <span className="text-xs font-semibold text-ink">
                Diktieren mit
              </span>
              <kbd className="rounded-md bg-surface px-2 py-1 font-mono text-[11px] text-ink-soft shadow-[var(--sh-sm)] kt-hair">
                {p.shortcut}
              </kbd>
            </div>
          </div>
        ))}
      </div>

      {/* Hinweis zur Signatur */}
      <div className="kt-hair rounded-3xl bg-lav/40 p-5 text-sm leading-relaxed text-lav-ink">
        <p className="font-semibold">Ein kurzer Hinweis zur Sicherheit</p>
        <p className="mt-1">
          Beide Apps sind noch nicht mit einem kostenpflichtigen Zertifikat
          signiert. Darum warnen macOS und Windows beim ersten Start. Das ist
          normal für kleine, selbst gebaute Apps. Du öffnest sie einmal wie oben
          beschrieben, danach starten sie ganz normal. Der Quellcode liegt
          offen auf{" "}
          <a
            href={REPO}
            className="font-semibold underline underline-offset-2 hover:text-ink"
          >
            GitHub
          </a>
          , sodass jeder nachsehen kann, was die App tut.
        </p>
        <p className="mt-2">
          Sollte macOS trotzdem melden, die App sei „beschädigt", einmal
          Terminal öffnen und diesen Befehl ausführen, danach startet sie
          normal:
        </p>
        <code className="mt-2 block overflow-x-auto rounded-xl bg-ink/85 px-3 py-2 font-mono text-xs text-surface">
          xattr -cr /Applications/Klartext.app
        </code>
      </div>
    </div>
  );
}

/* ---------- Icons ---------- */

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1-.02 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4 0-.1-2.1-.8-2.1-3.2zM14.3 6.3c.6-.7 1-1.7.9-2.7-.8.03-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.06 1.8-.5 2.5-1.2z" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5.5 10.5 4.5v7H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z" />
    </svg>
  );
}
