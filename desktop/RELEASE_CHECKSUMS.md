# Release-Prüfsummen

Build: 12. September 2026, Version 0.3.0 (Resonanz)

## macOS Apple Silicon

- Datei: `dist/Klartext-Mac-AppleSilicon.dmg`
- Größe: 118.755.176 Bytes
- SHA-256: `a17d9a1bf2350e3f4dad511ffb18104e006431c74fe48a19d1947c9f202c2178`

## Windows x64

- Datei: `dist/Klartext-Windows.exe`
- Größe: 99.734.238 Bytes
- SHA-256: `61552d12ffae97e2ca809a4c0fa768513206e83f7908aa7cfd60350c3399e6c8`

Beide Installer wurden erfolgreich gebaut. Alle 27 konfigurierten Paketdateien
und Version 0.3.0 wurden in beiden gebündelten Apps gegen die Quellen geprüft.
Die Mac-Signaturprüfung und der isolierte Einstellungs-Smoke-Test sind erfolgreich.
57 Regressionstests und der Web-Produktionsbuild inklusive TypeScript sind grün.

macOS ist ad-hoc signiert, nicht Apple-notarisiert. Windows besitzt kein
vertrauenswürdiges Herausgeberzertifikat. Der echte Windows-Laufzeittest und
eine neue Mikrofon-/Cloud-End-to-End-Aufnahme für das Redesign bleiben offen.
