# Release-Prüfsummen

Build: 1. September 2026, Version 0.1.3

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.182.840 Bytes
- SHA-256: `984dddfee8caf57c4443bbd67a4b7157fad1c64709d6dbcf9004c131fe0eb90c`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.473.809 Bytes
- SHA-256: `fcf711d1a837969bf99e2e9b8b50b6413aa92ca920775f66aeb86ac769c6fc7e`

Beide Pakete enthalten `gpt-transcribe`, den Text-Feinschliff über
`gpt-5.4-mini`, die `Sigill`-Normalisierung und die aktualisierte
Aufnahmeoberfläche, Autostart-Einstellungen und die Hintergrundvorbereitung.
Version 0.1.3 trennt Entwicklungs- und Produktionsprofil samt Shortcut, behandelt
geschlossene Terminalkanäle absturzsicher, aktiviert einen pausierten Audiokanal
explizit und schreibt verständliche Aufnahmefehler in ein lokales Diagnoseprotokoll.
macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Der Paketinhalt beider Plattformen und
der Mac-Smoke-Test sind geprüft. Echter Windows-Laufzeit- und Mikrofontest sowie
die erneute Mac-Sprachaufnahme mit 0.1.3 bleiben manuell zu prüfen.
