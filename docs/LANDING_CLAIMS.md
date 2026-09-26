# Website-Aussagen und ihre Nachweise

Stand: 23. September 2026. Quelle der Texte: `components/site/landing-content.ts`
und `components/site/Privacy.tsx`. Die Website darf erst veröffentlicht werden,
wenn jede Zeile mit „vor Launch prüfen“ erfüllt ist. Feature-IDs aus
[FEATURE_STATUS.md](FEATURE_STATUS.md).

| Aussage (gekürzt) | Feature | Stand am 23.09. | Vor Launch prüfen |
| --- | --- | --- | --- |
| Open Source, MIT | F16, F27 | LICENSE vorhanden | Rechteinhaber bestätigt (Checkliste A4), Repository öffentlich unter neuem Namen |
| Kostenlos, ohne Konto, keine Wortlimits | F15 | zutreffend | keine |
| Mac (Apple Silicon), Windows 10/11 x64, Web | F17 | Mac-Paket geprüft, Windows nur gebaut | reale Windows-Abnahme (Block D) |
| Diktat in jeder App, Einfügen am Cursor, sonst Zwischenablage | F03 | Mac real geprüft | Windows real prüfen |
| Längere Aufnahmen mit Pause/Fortsetzen, Dateiimport | F23 | automatisiert, Oberfläche geprüft | 30-Minuten-Aufnahme, 60-Minuten-Datei (Block C4, C6) |
| Laufende lokale Sicherung, Wiederherstellung nach Absturz | F23 | automatisiert | echter Prozessabbruch (Block C5) |
| Rohtext und Ergebnis, Bearbeiten, Suche, TXT/Markdown, löschbar | F24 | automatisiert, Oberfläche geprüft | Export nach echter Aufnahme (C4) |
| Whisper lokal, einmaliger Download von Hugging Face, danach offline | F19 | Offline-Modellstart im Paket geprüft | Offline-Neustart mit Mikrofon (C7) |
| Optionale Überarbeitung mit Ollama lokal | F20 | Adapter und Sicherung real geprüft | Mit einem geeigneten Modell einmal real durchlaufen oder Aussage auf „möglich“ belassen |
| OpenAI, Groq, eigener kompatibler Server | F21 | OpenAI real, Groq nur automatisiert | Groq-Probe (Block B3), sonst Groq von der Website nehmen |
| Audio direkt zum Anbieter, nicht über Nivune | F21 | Architektur, kein Proxy | keine |
| Nie stiller Anbieterwechsel | F18, F21 | automatisiert | keine |
| Keine Telemetrie, Netzwerk nur zu Anbieter, Hugging Face, GitHub | F28 | Quellcode ohne Analyse-SDK | Netzwerkmitschnitt Desktop einmal durchführen (kann ich nach Freigabe übernehmen) |
| Updates nur auf Nachfrage, keine stille Installation | F28 (K28) | automatisiert, Oberfläche geprüft | Test gegen echtes Release (Block F1) |
| Key im Desktop über OS-Verschlüsselung | F04, K17 | automatisiert, Mac real | Windows real |
| Oberfläche DE/EN, weitere Erkennungssprachen | F25, F14 | nutzergeprüft | keine |
| macOS 12 oder neuer | F17 | Mindestversion von Electron 43 | einmal auf dem ältesten verfügbaren Mac bestätigen oder Angabe beibehalten |
| 85 bis 600 MB Modellgröße | F19 | Werte aus dem Modellmanager | keine |
| Einrichtung in vier Schritten zum ersten Text | F26 | nutzergeprüft (Mac) | Windows |
| Installer unsigniert, Warnung beim ersten Start | F28 | zutreffend | nach Signierung `NEXT_PUBLIC_INSTALLERS_SIGNED=1` setzen |
| Datenschutz: keine Cookies, kein Tracking, Hosting bei Vercel | Website | zutreffend für den aktuellen Code | Checkliste A5/A6 |

Die Produktillustration im Kopfbereich ist ausdrücklich als vereinfachte
Darstellung beschriftet. Das echte Produktvideo (K39/K40) wird aus dem geprüften
Kandidaten aufgenommen.
