# Nivune: geplante Versionsfolge

Stand: 13. September 2026. Aktuell veröffentlicht: **0.3.0**.
Alle nachfolgenden Versionen sind geplant, keine Verfügbarkeitsversprechen.
Reihenfolge nach Nutzerfeedback anpassbar; keine festen Veröffentlichungstermine.
Der tatsächliche Funktionsstand steht in [FEATURE_STATUS.md](FEATURE_STATUS.md).

| Version | Geplanter zusätzlicher Umfang | Voraussetzung |
| --- | --- | --- |
| 1.0.0-beta.* | Schrittweise die Funktionen von 1.0 zur Abnahme bereitstellen; klar markierte unfertige/ungeprüfte Wege | Bestehende Profile migrierbar, keine kritischen Daten-/Sicherheitsfehler; Testzugänge und Testgeräte |
| **1.0: öffentlicher Launch** | Verlässliches Diktat; echter lokaler Betrieb; eigene Keys und getrennte Modellwahl; OpenAI, Groq und kompatible eigene Endpunkte; lokale optionale Textüberarbeitung über Ollama; Desktop-Mikrofonaufnahmen und Dateiimport; Verlauf/Bearbeitung/Export; DE/EN; einfache Einrichtung; bestätigte OSS-Lizenz und Self-Hosting; geprüfte Distribution; Landingpage und echtes Produktvideo | Reale Mac-/Windows-Abnahme, Offline-Nachweis, Migration, Lizenz und Signierung geklärt, Beta-Nutzenprüfung und finales Release-Paket |
| **1.1: größere KI-Auswahl** | Native Deepgram-, Claude- und Gemini-Anbindungen, soweit nicht schon in 1.0 enthalten; Anbieterprofile bequemer verwalten; Kompatibilitätsmatrix aus echten Prüfungen erweitern | Geeignete Keys und reale Adaptertests; keine unbelegte universelle Modellunterstützung |
| **1.2: für Entwickler und Agenten** | MCP-Adapter, kleines TypeScript-SDK und geprüfte Beispielintegrationen für eigene Agenten/Sprachmemo-Workflows; CLI-Verträge nach Preview-Erkenntnissen stabilisieren | Eigenständig nutzbarer Kern und CLI bewährt; Bedarf mit externen Integratoren bestätigt |
| **1.3: wiederkehrende Audioarbeit** | Lokale Ordnerverarbeitung und Stapelaufträge mit gespeicherten Profilen; optionale Zeitmarken und SRT/VTT-Export bei geeigneten Modellen; größere Aufträge anhand gemessener Gerätegrenzen | Kern-Auftragsverarbeitung stabil, belastbare Zeitmarken; keine erfundenen Segmente |
| **1.4: mehr Geräte und Sprachen** | Zusätzliche Oberflächensprachen und priorisierte weitere Plattformen, etwa Linux-Desktop oder Intel-Mac | Tatsächliche Nachfrage, lauffähige Modelle/Abhängigkeiten und reale Testgeräte; keine pauschale Zusage für alle Systeme |
| **2.0: mögliche Gesprächsfunktionen** | Eigene Agenten mit gesprochenen Antworten, Streaming und Unterbrechungen; gegebenenfalls Systemaudio/Meeting-Funktionen | Separater Produktentscheid nach Nutzungsnachweis; größere Architektur- und Berechtigungsfragen. Noch kein verbindlicher Umfang |

### CLI-Preview beim ersten Launch

Mit 1.0 kann eine kleine CLI als separat gekennzeichnete **Developer Preview 0.1**
erscheinen: Audiodatei hinein, strukturiertes Ergebnis heraus, ohne Electron.
Sie erhält eigene Paketversionen und Stabilitätsangaben. App 1.0 bedeutet nicht,
dass eine Agenten-API bereits stabil oder ein vollständiges Sprachagentensystem
enthalten ist. Eine beworbene Linux-CLI muss eigens getestet sein; sie ist keine
Linux-Desktop-App. Der App-Launch wartet nicht auf den gesamten Umfang von 1.2.

### Pflegeversionen

1.0.1, 1.0.2 usw. enthalten Fehlerbehebungen und Sicherheitskorrekturen.
Kritische Fehler werden vor neuen Funktionen behoben. Migrationen, API-Verträge
und Änderungen der Mindestanforderungen werden in Release-Notizen kenntlich gemacht.
Für CLI/SDK gilt eine gesonderte Versionierung bei inkompatiblen Änderungen.

### Ablauf bis 1.0

1. Feature-Bestand führen, Rechte/Signierzugänge/Testmöglichkeiten vorbereiten.
2. Gemeinsamen Kern, Migration und echte lokale Verarbeitung fertigstellen.
3. Erste zusätzliche Anbieter, freie Konfiguration, Desktop-Arbeitsbereich und DE/EN.
4. Ersteinrichtung, Datenkontrolle und Fehlerwiederherstellung prüfen; kleine CLI erproben.
5. Reale Beta, Mac-/Windows-Abnahme, Lizenz und signierte Downloads abschließen.
6. Landingpage und Video ausschließlich aus belegten Features; finales Paket vorlegen
   und nach Freigabe veröffentlichen. Feature-Liste beim Release aktualisieren.

### Benötigte Mitwirkung

- Früh: Rechteinhaber/Lizenzentscheidung sowie vorhandene Apple-/Windows-Signierung
  klären. Neue kostenpflichtige Konten oder Zertifikate gesondert freigeben.
- Während der Anbieterarbeit: passende Keys sicher bereitstellen und begrenzte
  echte Testnutzung freigeben. Schlüssel nicht in öffentliche Dokumente aufnehmen.
- Vor der Abnahme: Windows-Gerät/Tester und einige externe Beta-Teilnehmer ermöglichen;
  reale Sprachtests können nicht durch simulierte Nutzer ersetzt werden.
- Zum Schluss: das konkrete Release-Paket und eventuelle Social-Posts freigeben.
  Reversible Umsetzung, Tests und die Vorbereitung werden vorher selbstständig erledigt.
