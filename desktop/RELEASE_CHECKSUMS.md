# Release-Prüfsummen

Build: 27. August 2026, Version 0.1.2

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 113 MB
- SHA-256: `7c6e833b30e123d286e50aeeae026be04030e11120634e710cc93750191683bb`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 95 MB
- SHA-256: `84731e4df3dbdcb068cdf6b091627a942789e3e8788fa5f1fa6dbfdf249ed4e8`

Beide Pakete enthalten `gpt-transcribe`, den Text-Feinschliff über
`gpt-5.4-mini`, die `Sigill`-Normalisierung und die aktualisierte
Aufnahmeoberfläche, Autostart-Einstellungen und die Hintergrundvorbereitung.
macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Windows-Laufzeit und Anmeldung auf
beiden Plattformen sind noch manuell zu prüfen.
