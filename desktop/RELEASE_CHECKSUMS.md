# Release-Prüfsummen

Build: 11. September 2026, Version 0.2.2

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.755.331 Bytes
- SHA-256: `7b0c2e9822175f35bfdeec8f6a80a57490656a2f51e6a57bbdae51f2d024107b`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.729.064 Bytes
- SHA-256: `debb7f3954d441d712d69bf882a4de8111a1e0ed0595f87bcae0a40cdc49fcfe`

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
Sekunden vom aufgenommenen Audio mehr ab. Ein weiterer realer Mac-Test zeigte,
dass ähnlich klingende normale Sprache unmittelbar vor einer Pause trotzdem
einen Fehlstopp auslösen konnte; 0.2.1 wurde deshalb durch 0.2.2 ersetzt.
Version 0.2.2 verwendet die persönliche Erkennung nur noch für „Hey Klartext“
und wertet sie während des Diktats gar nicht aus. Das Ende erfolgt zuverlässig
nach neun Sekunden bestätigter Stille oder sofort über den globalen Shortcut.
Im realen Mac-Test lösten mehrere gesprochene Varianten des früheren Endbefehls
keinen Stopp mehr aus; der vollständige Text endete ausschließlich per Stille.
Der Windows-0.2.2-Laufzeittest bleibt manuell zu prüfen.
macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Der Paketinhalt beider Plattformen und
der Mac-Smoke-Test sind geprüft. Der echte Windows-Laufzeit-, Wake-Word- und
Mikrofontest bleibt manuell zu prüfen.
