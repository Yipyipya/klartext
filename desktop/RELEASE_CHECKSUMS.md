# Release-Prüfsummen

Build: 1. September 2026, Version 0.1.4

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.182.965 Bytes
- SHA-256: `718bc659243371437f84dce67e233f0db69f4878eefe9c37e2304a79c4b74095`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.474.197 Bytes
- SHA-256: `6502da4f8c562c2217ab617c9493e0ec7a4f3b1122832ea199d6407b21e0c9e1`

Beide Pakete enthalten `gpt-transcribe`, den Text-Feinschliff über
`gpt-5.4-mini`, die `Sigill`-Normalisierung und die aktualisierte
Aufnahmeoberfläche, Autostart-Einstellungen und die Hintergrundvorbereitung.
Version 0.1.3 trennt Entwicklungs- und Produktionsprofil samt Shortcut, behandelt
geschlossene Terminalkanäle absturzsicher, aktiviert einen pausierten Audiokanal
explizit und schreibt verständliche Aufnahmefehler in ein lokales Diagnoseprotokoll.
Version 0.1.4 entkoppelt die macOS-Bedienungshilfe von Aufnahme und Transkription.
Eine veraltete Einfüge-Freigabe löst beim Diktat keinen Systemdialog mehr aus;
der fertige Text wird in diesem Fall kopiert und die App zeigt den nötigen Schritt
zur erneuten Freigabe an.
macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Der Paketinhalt beider Plattformen und
der Mac-Smoke-Test sind geprüft. Echter Windows-Laufzeit- und Mikrofontest sowie
die erneute Mac-Sprachaufnahme mit 0.1.4 bleiben manuell zu prüfen.
