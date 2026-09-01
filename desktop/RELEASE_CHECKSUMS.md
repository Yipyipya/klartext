# Release-Prüfsummen

Build: 1. September 2026, Version 0.1.3

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.182.682 Bytes
- SHA-256: `fb05fa83ea966c83702c7b7d68a5ebb22935024b2a69b802e403f7af49b9ddaf`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.473.739 Bytes
- SHA-256: `f5936d51da352d7c63a0df7a0467792a7d973a5203a12b5660de74405d48fa08`

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
