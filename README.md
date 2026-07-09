# Klartext 🎙️

**Sprich. Der Rest ist Text.**

Klartext ist ein kostenloses, privates Diktier-Tool im Browser – inspiriert von
[Wispr Flow](https://wisprflow.ai), aber ohne Konto, ohne Abo und ohne Server.

## Features

- **Live-Diktat** in 17 Sprachen (Web Speech API) – Leertaste halten (Push-to-talk),
  `⌘/Strg+⇧+Leertaste` für Hands-free, `Esc` zum Beenden
- **Klartext-Aufräumen**: Füllwörter („ähm“, „äh“ …), doppelte Wörter und
  Zeichensetzung werden automatisch bereinigt – mit „Original anzeigen“ zum Vergleich
- **Datei-Transkription**: Sprachmemos, Meetings, Sprachnachrichten (MP3, M4A, WAV,
  OGG, WebM) – läuft über ein lokales Whisper-Modell (transformers.js, WebGPU/WASM)
  komplett auf deinem Gerät. Nichts wird hochgeladen.
- **Auto-Kopieren**: Nach dem Diktat liegt der Text in der Zwischenablage –
  App wechseln, einfügen, fertig
- **Persönliches Wörterbuch**: falsch erkannte Namen/Fachbegriffe automatisch ersetzen
- **Verlauf & Statistik**: Wörter gesamt, Ø WPM, Tages-Serie – alles in localStorage
- **PWA**: „Zum Startbildschirm hinzufügen“ macht Klartext zur App auf jedem Gerät
- Light/Dark Mode

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # statischer Produktions-Build
```

## Teilen / Deployen

Die App ist komplett statisch und braucht keine Umgebungsvariablen oder Datenbank.
Einfach auf Vercel (oder Netlify/GitHub Pages) deployen und den Link verschicken:

```bash
npm i -g vercel
vercel --prod
```

**Hinweis:** Live-Diktat braucht Chrome, Edge oder Safari (Web Speech API).
Die Datei-Transkription funktioniert in jedem modernen Browser; beim ersten Mal
wird einmalig ein Whisper-Modell (~80 MB) geladen und dann gecacht.
