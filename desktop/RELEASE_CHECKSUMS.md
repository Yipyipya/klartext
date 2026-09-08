# Release-Prüfsummen

Build: 8. September 2026, Version 0.2.0

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.757.780 Bytes
- SHA-256: `0b97b20b3d1e4b34791f7a24bbb77ee333d39868d8e6eb93cc1022244e283d54`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.728.117 Bytes
- SHA-256: `7a94d17b2a615f4e5b2fa3f85c38e1692007607adf70ed8f79f7983391be28ce`

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
Version 0.2.0 ergänzt lokal eingelernte Sprachbefehle für Start und Ende,
automatisches Beenden nach neun Sekunden Stille und fokuserhaltendes Einblenden.
Im realen Mac-Test wurden Start, Ende, Endbefehlsbereinigung und automatisches
Einfügen bestätigt; der Start erfolgte rund 0,26 Sekunden nach der Erkennung.
macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Der Paketinhalt beider Plattformen und
der Mac-Smoke-Test sind geprüft. Der echte Windows-Laufzeit-, Wake-Word- und
Mikrofontest bleibt manuell zu prüfen.
