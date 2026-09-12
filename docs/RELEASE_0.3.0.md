# Klartext 0.3.0: Resonanz

Klartext bekommt eine gemeinsame Gestaltung für Web, macOS und Windows.
Der neue Sprachraum stellt Diktat und bearbeitbaren Text in den Mittelpunkt.
Dateien und Verlauf erhalten klarere Symbole. Helle und dunkle Ansichten sowie
mobile Layouts sind überarbeitet.

Die Desktop-App hat ein eigenes Einstellungsfenster für Sprache, Transkription,
Sprachaktivierung, Berechtigungen und Darstellung. Aufnahmeblase, Menüleisten-
und App-Symbol sowie die weiteren Fenster passen zur neuen Gestaltung.
Vorhandene Einstellungen, API-Schlüssel und persönliche Sprachmodelle werden
weiterverwendet.

## Geprüft

- 57 automatisierte Tests und Web-Produktionsbuild inklusive TypeScript erfolgreich.
- Web- und Mobilansichten sowie das native Mac-Einstellungsfenster geprüft.
- Mac-App lokal installiert und gestartet.
- Persönliche Sprachaktivierung und die Transkriptionsmodelle bleiben unverändert.

## Bekannte Grenzen

macOS ist ad-hoc signiert und nicht Apple-notarisiert. Windows hat kein
vertrauenswürdiges Herausgeberzertifikat. Der echte Windows-Laufzeittest und
eine neue Mikrofon-/Cloud-End-to-End-Aufnahme für dieses Redesign stehen aus.
