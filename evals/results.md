# Transkriptionsergebnisse

## 27. August 2026

### Web, Qualitätsmodus, Fachbegriffe

Referenz:

> Wir bauen Klartext mit Next.js und Supabase. Danach testen wir den OpenAI Realtime Flow und automatisieren das Onboarding in Make und n8n.

Ergebnis:

> Wir bauen Klartext mit Next.js und Supabase. Danach testen wir den OpenAI Realtime Flow und automatisieren das Onboarding in Make und n8n.

- Wortfehler: 0
- Auslassungen: 0
- Fachbegriffe: 7 von 7 korrekt
- Zeichensetzung: korrekt
- Browserfehler: keine
- Latenz: noch nicht gemessen

### macOS Desktop, Qualitätsmodus, Namen und Produkte

Referenz:

> Jakob Meyer bespricht morgen mit Theresa König das Klartext-Projekt. Die Notizen gehen anschließend an HubSpot, Pipedrive und das Team von Sigill.

Ergebnis vor Wörterbuch-Anpassung:

> Jakob Meyer bespricht morgen mit Theresa König das Klartext-Projekt. Die Notizen gehen anschließend an HubSpot, Pipedrive und das Team von Sigil.

- Wortfehler: 1 von 21
- Wortgenauigkeit: 95,2 Prozent
- Einziger Fehler: `Sigil` statt `Sigill`
- Shortcut, Aufnahme, Cloud-Transkription und automatisches Einfügen: erfolgreich
- Maßnahme: `Sigill` als fester Erkennungshinweis für Web und Desktop ergänzt
- Erster Wiederholungstest nur mit Modellhinweis: `Sigil` blieb bestehen
- Schlussfolgerung: Ein Modellhinweis allein reicht für diesen Markennamen nicht
- Zweite Maßnahme: deterministische Nachkorrektur `Sigil` zu `Sigill` ergänzt
- Zweiter Wiederholungstest: 21 von 21 Wörtern korrekt, `Sigill` korrekt eingefügt
- Verbleibende Abweichung: Komma statt Punkt zwischen zwei vollständigen Hauptsätzen
- Dritte Maßnahme: vorsichtiger Text-Feinschliff über `gpt-5.4-mini` ergänzt
- Zeichensetzungstest mit Feinschliff: bestanden

Ergebnis mit zweistufiger Pipeline:

> Jakob Meyer bespricht morgen mit Theresa König das Klartext-Projekt. Die Notizen gehen anschließend an HubSpot, Pipedrive und das Team von Sigill.

- Wortfehler: 0 von 21
- Eigennamen und Marken: vollständig korrekt
- Satzgrenze und Interpunktion: korrekt
- Automatisches Einfügen: erfolgreich
# Upload- und Startprüfung, 27. August 2026

- Automatisiert: 16/16 Regressionstests bestanden (`npm test`), darunter
  sechsminütiges Stereo-PCM über dem API-Limit, Sample-Abdeckung ohne Lücken,
  Metadaten-unabhängiger Direktupload, Feinschliff ohne stilles Abschneiden und
  Autostart-Logik für Mac/Windows mit gemockten Betriebssystem-APIs.
- Echter Browser/OpenAI-Test mit synthetischer deutscher Sprache:
  38.257.554-Byte-WAV, 199,26 Sekunden, erfolgreich bis „Fertig“.
  Sechs Kontrollbegriffe sowie Anfang und Ende vorhanden, 394 Wörter ausgegeben.
  Wechsel zu Verlauf und zurück unterbrach den Upload nicht.
- Dieselbe Aufnahme als MP3 direkt hochgeladen und vollständig verarbeitet.
  Dies ist ein Vollständigkeits-/Transporttest, kein Nachweis fehlerfreier Erkennung:
  im MP3-Ergebnis gab es eine zusätzliche Wiederholung von „Wort“.
- Defekte WAV ohne Samples: OpenAI-400-Meldung sichtbar statt generischem Fehler.
- Echter Apple-Lossless-Upload, persönliche Sprachmemo und Windows-Laufzeit bleiben
  als manuelle Tests offen. Autostart-Code geprüft, echte Anmeldung noch nicht.
