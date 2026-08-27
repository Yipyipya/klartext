# Klartext 🎙️

**Sprich. Der Rest ist Text.**

Klartext ist ein persönliches Diktier- und Transkriptions-Tool für Web, macOS
und Windows. Es ist von Wispr Flow inspiriert, braucht kein Konto und bietet
zwei Transkriptionsmodi: beste Qualität über OpenAI oder vollständig lokal.

## Features

- **Live-Diktat** in 17 Sprachen – Leertaste halten (Push-to-talk),
  `⌘/Strg+⇧+Leertaste` für Hands-free, `Esc` zum Beenden
- **Klartext-Aufräumen**: Füllwörter („ähm“, „äh“ …), doppelte Wörter und
  Zeichensetzung werden automatisch bereinigt – mit „Original anzeigen“ zum Vergleich
- **Qualitätsmodus**: Aufnahmen und unterstützte Audiodateien werden mit
  `gpt-transcribe` verarbeitet. Kontext und Wörterbuch verbessern Namen,
  Fachbegriffe und gemischtes Deutsch/Englisch.
- **Lokalmodus**: Datei-Transkription über Whisper mit transformers.js und
  WebGPU/WASM. Die Audiodatei bleibt dabei auf dem Gerät.
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
npm test        # Regressionstests ohne kostenpflichtige API-Aufrufe
```

## Teilen / Deployen

Die App ist statisch und braucht keine Datenbank. Im Qualitätsmodus hinterlegt
der Nutzer seinen eigenen OpenAI-API-Key direkt in den Einstellungen. Er wird
nur im lokalen Browserspeicher dieses Geräts gespeichert.
Die bestehende Website ist https://klartext-adapt-learn.vercel.app und wird über
das GitHub-Projekt `Yipyipya/klartext` auf Vercel aktualisiert. `noindex` bittet
Suchmaschinen, sie nicht zu indexieren. Dies ist kein Zugriffsschutz: Jeder mit
dem Link kann die Seite öffnen. API-Key und Verlauf sind pro Browser/Adresse
gespeichert, Daten von localhost werden nicht automatisch übertragen.

**Hinweis:** Die Live-Vorschau braucht Chrome, Edge oder Safari. Im Lokalmodus
wird beim ersten Einsatz einmalig ein Whisper-Modell geladen und danach im
Browser-Cache vorgehalten.

## Desktop-App (macOS-Menüleiste) 🖥️

Im Ordner [`desktop/`](desktop/) liegt das Desktop-Upgrade: eine Menüleisten-App,
die systemweites Diktat kann – wie das Original:

- **⌥ + Leertaste** (in *jeder* App): Aufnahme-Pill erscheint unten mittig,
  sprechen, nochmal ⌥+Leer → Text wird transkribiert, aufgeräumt und **direkt
  an der Cursor-Position eingefügt** (`Esc` bricht ab)
- Qualitätsmodus mit `gpt-transcribe` und lokal verschlüsseltem OpenAI-Key
- Optionaler Lokalmodus über Whisper, der beim ersten Start ein Modell lädt
- Sprache, Transkriptionsmodus und lokales Modell über das Menü umstellbar
- Autostart bei der Anmeldung (abschaltbar im Tray), Vorbereitung ohne Mikrofonaufnahme
- Im Qualitätsmodus keine kostenpflichtige Vorab-Anfrage; lokales Whisper lädt nur
  vor, wenn der Lokalmodus ausgewählt ist

```bash
cd desktop
npm install
npm start          # App starten (Menüleiste: 🎙️)
npm run dist       # .dmg bauen (dist/) – zum Weitergeben an Freunde
```

Beim ersten Diktat fragt macOS nach **Mikrofon** und **Bedienungshilfen**
(Systemeinstellungen → Datenschutz & Sicherheit → Bedienungshilfen) – letzteres
braucht die App, um den Text automatisch einzufügen. Ohne die Berechtigung
landet der Text trotzdem in der Zwischenablage (⌘V zum Einfügen).

Die App ist nur ad-hoc signiert, nicht Apple-notarisiert. Daher kann macOS den
Autostart blockieren. In diesem Fall Klartext nach Programme verschieben und unter
Systemeinstellungen → Allgemein → Anmeldeobjekte hinzufügen. Der Tray-Status zeigt,
was das Betriebssystem zurückmeldet. Windows wird auf einem echten PC geprüft.
