# Nivune 1.0.0-beta.1 (Entwurf, unveröffentlicht)

Erste Beta unter dem neuen Namen Nivune (früher Klartext). Diese Version ist
für Testerinnen und Tester gedacht und klar als Beta gekennzeichnet.

## Neu gegenüber 0.3.0

**Deine Wahl, wohin Audio geht**
- Echter lokaler Modus in Desktop und Browser: Whisper läuft auf deinem Gerät,
  nach einem einmaligen, sichtbaren Modelldownload auch ohne Internet.
- Transkription und Textüberarbeitung getrennt wählbar: OpenAI, Groq oder ein
  eigener OpenAI-kompatibler Server für Audio; keine Überarbeitung, lokale Regeln,
  OpenAI, ein kompatibler Textserver oder Ollama auf deinem Gerät für Text.
- Kein stiller Wechsel zu einem anderen Anbieter. Unsichere KI-Überarbeitungen
  werden verworfen, der Rohtext bleibt erhalten.

**Desktop-Arbeitsbereich**
- Längere Aufnahmen mit Pause und Fortsetzen, laufende lokale Sicherung und
  Wiederherstellung nach einem Absturz.
- Audiodateien importieren, serielle Warteschlange.
- Verlauf mit Rohtext und Ergebnis, Bearbeiten, Suche, Export als TXT und
  Markdown, einzeln oder komplett löschbar.
- Einstellungen ohne Schlüssel exportieren und importieren.

**Einstieg und Sprache**
- Geführte Ersteinrichtung in vier Schritten bis zum ersten Text.
- Oberfläche vollständig auf Deutsch und Englisch, unabhängig von der
  gesprochenen Sprache.
- Frei wählbarer persönlicher Startbefehl für die Sprachaktivierung.

**Vertrauen und Sicherheit**
- Open Source unter MIT, mit Drittanbieterhinweisen im Installer.
- Updateprüfung nur auf Knopfdruck; Nivune öffnet die offizielle Release-Seite
  und installiert nichts selbst.
- Gehärtete Electron-App (Sandbox, ASAR-Integrität, Fuses, enge IPC-Grenzen),
  Live-Diktate enden kontrolliert nach zehn Minuten.
- Web: API-Keys standardmäßig nur für die Browsersitzung, optional bewusst im
  Browser gespeichert.

**Web**
- Neue Website unter `/` und `/en`; die Web-App liegt jetzt unter `/app`.
  Bestehende Einstellungen und Verläufe bleiben im selben Browser erhalten,
  installierte Web-Apps öffnen weiterhin den Arbeitsbereich.

## Bekannte Grenzen dieser Beta

- Installer sind nicht signiert beziehungsweise notarisiert; macOS und Windows
  zeigen beim ersten Start Warnungen.
- Windows ist gebaut, aber noch nicht auf echter Hardware abgenommen.
- Groq ist implementiert, aber noch nicht mit einer echten Anfrage geprüft.
- Lokale Transkription im Browser ist deutlich langsamer als in der Desktop-App.
- Nur Apple Silicon; keine Intel-Macs, kein Linux-Desktop.

## Upgrade von 0.3.0

Einstellungen und Keys werden beim ersten Start gesichert und migriert. Bestehende
„Hey Klartext“-Sprachmodelle bleiben nutzbar. In der Web-App bleiben API-Keys aus
Sicherheitsgründen zunächst nur für die Sitzung gespeichert.
