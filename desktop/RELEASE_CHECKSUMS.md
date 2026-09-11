# Release-Prüfsummen

Build: 11. September 2026, Version 0.2.1

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.755.852 Bytes
- SHA-256: `3f18702b5e020903e9c326912eb5d78bd5f43edc27cadfcb9049ea1b6855afcc`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.729.458 Bytes
- SHA-256: `40a5fc245967221ef482ccc60fc5c20dc25e2b9079d8c4a94b1a4295a5c12515`

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
Version 0.2.1 bestätigt Befehle kontextabhängig anhand der anschließenden Ruhe,
statt jeden ähnlichen Treffer sofort auszuführen. Der Stille-Autostopp arbeitet
auf dem tatsächlichen Diktat-Audiostream und automatische Enden schneiden keine
Sekunden vom aufgenommenen Audio mehr ab. Im realen Mac-Test blieb der Befehl
mitten im Satz erhalten, während er am Textende zuverlässig stoppte und entfernt
wurde. Der Windows-0.2.1-Laufzeittest bleibt manuell zu prüfen.
macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Der Paketinhalt beider Plattformen und
der Mac-Smoke-Test sind geprüft. Der echte Windows-Laufzeit-, Wake-Word- und
Mikrofontest bleibt manuell zu prüfen.
