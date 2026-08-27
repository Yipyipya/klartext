# Klartext 0.1.2

- Modernisiertes Web-Interface mit hellem/dunklem Design und besser lesbaren Leisten.
- Qualitätsmodus mit Kontext, Fachbegriffen und vorsichtigem Text-Feinschliff.
- Zuverlässigere Datei-Uploads, Aufteilung großer Audiodateien und sichtbare Fehler.
- Autostart bei der Anmeldung und Hintergrundvorbereitung, ohne aktive Aufnahme.
- Kein teureres Realtime-Modell. Die bisherigen Qualitätsmodelle bleiben Standard.

## Installation und Teststatus

Mac: DMG öffnen, Klartext nach Programme ziehen und die vorhandene App ersetzen.
Windows: Installer ausführen. Danach den persönlichen OpenAI API-Key in Klartext
eintragen, falls er noch nicht in dieser Installation gespeichert ist.

Mac ist ad-hoc signiert, nicht Apple-notarisiert. Windows hat kein vertrauenswürdiges
Herausgeberzertifikat. Entsprechende Systemwarnungen sind möglich. Prüfsummen stehen
in desktop/RELEASE_CHECKSUMS.md. Nur aus diesem Repository herunterladen.

Autostart lässt sich im Tray deaktivieren. Falls macOS ihn blockiert, Klartext unter
Allgemein → Anmeldeobjekte hinzufügen. Kein automatischer Mikrofonstart.

Automatische Tests, Mac-Smoke-Test und Browser-Upload einer 38-MB-Datei sind bestanden.
Windows-Laufzeit und echte Anmeldung auf beiden Plattformen sind noch manuell zu prüfen.
