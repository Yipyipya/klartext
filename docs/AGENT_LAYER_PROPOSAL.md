# Nivune als Baustein für Entwickler und Agenten

Stand: 13. September 2026. Vorschlag zur Diskussion, noch kein zusätzlich
freigegebener Pflichtumfang des Open-Source-Launchplans.

## Produktthese

Ein gemeinsamer Sprachverarbeitungskern erhält zwei Zugänge: die einfache
Diktier-App für Menschen und einen eigenständig nutzbaren Zugang ohne Oberfläche
für Programme. Ein Agent soll keine Desktop-App herunterladen und anklicken
müssen, um eine Audiodatei zu transkribieren.

Die zweite Zielgruppe sind zunächst Entwickler und Betreiber von Agentensystemen.
Ihre Agenten können den Baustein anschließend innerhalb der eingerichteten Rechte
aufrufen. Automatische Entdeckung, Auswahl oder Nachfrage wird nicht vorausgesetzt.

## Wo zusätzlicher Nutzen entstehen kann

| Anwendung | Konkreter Ablauf | Empfehlung |
| --- | --- | --- |
| Sprachmemos in Workflows | Freigegebene Audiodatei → Nivune → strukturierter Text → bestehender Agent erstellt Aufgaben, Notizen oder Entwürfe | Erster Referenzfall, verwendet die ohnehin geplante Datei-Pipeline |
| Mit dem eigenen Agenten sprechen | Nutzer hält einen Shortcut → Aufnahme → Text geht an ein bewusst verbundenes Agentensystem → Antwort erscheint dort | Zweiter Referenzfall; sichtbarer Aufnahmestatus und klare Zielwahl |
| Sprachfunktion in eigene Software einbauen | Eine Anwendung nutzt den Kern über CLI oder später SDK, ohne Electron oder eigene Provider-Sonderfälle | Zweite Zielgruppe direkt adressieren |
| Audiosammlung auswerten | Verzeichnis mit freigegebenen Dateien → fortsetzbare Aufträge → Text/Metadaten → eigene Suche oder Wissensbasis | Nach dem ersten erfolgreichen Einzelfall |
| Eigenes Vokabular wiederverwenden | Wörterbuch, Sprache und Datenschutzprofil gelten für App und Workflow | Gemeinsamer Nutzen für beide Zielgruppen |

Nicht zum Start: eigener Allzweckagent, Telefonplattform, automatischer Mikrofon-
Dauerzugriff, eigene Cloud zum Weiterverkauf von KI oder vollständiges Echtzeit-
Gesprächssystem mit Sprachausgabe, Unterbrechungen und Echo-Unterdrückung.
Die Verarbeitung von Sprachmemos ist kein Versprechen niedriger Gesprächslatenz.

## Wettbewerb und Abgrenzung

[whisper.cpp](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server)
enthält bereits einen HTTP-Server für Transkription.
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) ist eine vorhandene
Transkriptionsbibliothek. [LiveKit](https://docs.livekit.io/agents/models/pipelines/)
deckt verschiedene Architekturen für Sprachagenten ab.
Quellen am 13. September 2026 geprüft, keine eigene Vergleichsmessung durchgeführt.

»Whisper über eine API« wäre deshalb ein schwacher eigenständiger Grund für
Nivune. Der zu prüfende Mehrwert ist die vollständige, verlässliche Pipeline:
Audioformate, Anbieter-/Modellwahl, kontrollierter lokaler Betrieb, Kontext,
Rohtext, optionale Überarbeitung, Wiederholung einzelner Stufen und vorhersehbare
Ergebnisse. Diese Arbeit muss Integratoren messbar Zeit sparen.

## Technischer Zuschnitt

1. **Gemeinsamer Kern:** Das bereits geplante M1 trennt Pipeline und Verträge von
   Browser-/Electron-Zugriffen. Der Kern funktioniert ohne Fenster, Tray,
   `localStorage` oder Mikrofonberechtigung. Plattformadapter bleiben getrennt.
2. **CLI zuerst:** Ein versioniertes, separat installierbares Werkzeug verarbeitet
   Dateien und liefert maschinenlesbare Ergebnisse. Kein Electron-Download und
   kein Hintergrunddienst nötig. Große lokale Modelle werden getrennt installiert;
   Downloadgröße, Quelle, Version und Prüfsumme sind erkennbar.
3. **MCP danach:** Ein dünner Adapter auf dieselben Aufträge, zunächst über stdio,
   für Agentenhosts, die MCP unterstützen. Kein zweiter Verarbeitungsweg.
   Ein gewöhnlicher CLI-Aufruf bleibt für Coding-Agenten ebenfalls möglich.
4. **SDK/HTTP nur bei echtem Bedarf:** Ein kleines TypeScript-SDK kann den Kern
   zugänglich machen; ein Python-Wrapper oder ein lokaler HTTP-Dienst folgt einer
   tatsächlichen Integration. Nicht sofort drei unabhängige SDKs pflegen.

Beispiel eines vorgeschlagenen CLI-Vertrags, noch kein verfügbarer Befehl:

```sh
klartext transcribe memo.m4a --profile local --json
```

Ergebnisvertrag: versioniertes Schema mit `job_id`, `status`, `raw_text`, `text`,
erkannter Sprache, optionalen Zeitsegmenten, verwendeten Anbietern/Modellen,
Verarbeitungsort und Warnungen. Fehlende Zeitmarken oder Kosteninformationen werden
als nicht verfügbar gekennzeichnet. Kein erfundener allgemeiner Genauigkeitsscore.
Rohtext ist Standard für Weiterverarbeitung; Feinschliff nur explizit gewählt.

Zusätzliche CLI-Eigenschaften: `--help`, Fähigkeitsabfrage, stabile Exit-Codes,
strukturierte Fehler, getrennte Diagnoseausgabe auf stderr, Abbruch, Timeout,
begrenzte Dateigröße und wiederverwendbare Auftrags-IDs. Bei Stufenwiederholung
keine unbeabsichtigte erneute Audioanfrage. Keys nicht in Kommandozeilenargumenten.

Vorgeschlagene erste MCP-Werkzeuge: Fähigkeiten abfragen, Transkriptionsauftrag
anlegen, Status/Ergebnis abrufen und Auftrag abbrechen. Ein Mikrofonwerkzeug ist
kein Bestandteil des ersten Adapters. Eine spätere Aufnahme-Anbindung benötigt
sichtbare Nutzersteuerung, vorab festgelegte Rechte und eine jederzeitige Stoppaktion.

## Eigenschaften, die sich als Produktmerkmale eignen

- **Dasselbe Profil überall:** Einstellungen aus der App als Profil ohne Secrets
  exportieren; Workflow nutzt kompatible Werte und eigene Zugangsreferenzen.
  Profilimport führt weder Code aus noch aktiviert ungefragt fremde Ziele.
- **Verarbeitung am erlaubten Ort:** Lokales Profil erzwingt lokale Verarbeitung
  beider Stufen. Ein Agent kann diese Vorgabe nicht durch einen normalen
  Modellparameter still aufweichen. Cloud-Kosten nur innerhalb eingerichteter Rechte.
- **Nachvollziehbares Ergebnis:** Original und Überarbeitung getrennt; Quelle,
  Modell und Warnungen begleiten den Text. So kann der nächste Agent angemessen
  mit unvollständigen Ergebnissen umgehen.
- **Fortsetzbare Aufträge:** Abbruch oder Provider-Ausfall vernichtet keinen ganzen
  Dateistapel. Ressourcenlimits verhindern unbegrenzte parallele Modellinstanzen.
- **Installieren und prüfen statt erraten:** Klare Lizenz, offizielle Pakete,
  pinbare Versionen, Schemas, ausführbare Beispiele und ein kurzer Selbsttest.
  Maschinenlesbare Dokumentation ergänzt funktionierende Schnittstellen.

Dateizugriff nur auf die für den Auftrag freigegebenen Dateien/Verzeichnisse.
Fremde Audiotranskripte sind Daten und erteilen keine Berechtigung, Programme
auszuführen, Dateien zu versenden oder Einstellungen zu ändern. Ein lokaler
HTTP-Dienst wäre separat zu authentifizieren; »localhost« ersetzt keine Prüfung.

## Kleine Erprobung vor größerem Ausbau

Vorschlag für drei abgegrenzte Schritte nach dem Kernumbau:

1. Headless-Prototyp für eine lokale Datei und einen konfigurierten Cloud-Anbieter,
   mit Schema, Fehlervertrag und Installationsanleitung. Für diesen Teil Linux x64
   früh prüfen, da viele Agentensysteme ohne Desktop laufen. Das verspricht noch
   keine Linux-Desktop-App oder Unterstützung jeder GPU.
2. Zwei reale Beispielintegrationen: Sprachmemo → Notiz-/Aufgabenentwurf und
   Nutzerdiktat → eigener Agent. Zunächst CLI; MCP als dünne Ergänzung erproben.
   Kein automatisches Senden von Nachrichten als Nebeneffekt der Transkription.
3. Mit drei unabhängigen Integratoren prüfen: Kann jeder ohne Betreuung innerhalb
   von etwa 30 Minuten nach Installation eine eigene Datei verarbeiten? Verwenden
   mindestens zwei den Baustein nach einer Woche weiterhin für einen echten
   Ablauf? Welche Arbeit spart Nivune gegenüber direkter Whisper-/Provider-Nutzung?

Die Zahlen sind vorgeschlagene Erprobungskriterien, keine Marktbenchmarks.
Falls kein Vorteil entsteht, bleibt der Kern intern wiederverwendbar und der
öffentliche Ausbau wartet. Falls Vorteil belegt ist, CLI/MCP als Developer Preview
veröffentlichen und separat versionieren. Der App-Launch hängt nicht vom Abschluss
einer vollständigen Agentenplattform ab.

## Einordnung in den bestehenden Plan

Der [Open-Source-Plan](OPEN_SOURCE_PLAN.md) behält seine 45 Arbeitspakete.
Bei K06 die spätere Nutzbarkeit ohne Oberfläche als Architekturziel berücksichtigen.
K14–K18 liefern die Provider-/Datenflussregeln; K20–K22 die robusten Aufträge.
Diese gemeinsame Grundlage zuerst abschließen. Ein öffentlicher CLI-/MCP-Umfang
wird erst nach Entscheidung für diesen Vorschlag als eigenes Arbeitspaket ergänzt.

Die Diktier-App bleibt der erste und kontinuierlich geprüfte Nutzer dieses Kerns.
Ein API-Refactoring darf weder Fokus/Einfügen noch Aufnahmestart, Genauigkeit oder
Einfachheit der Oberfläche verschlechtern. Die Landingpage kann später zwei klare
Einstiege anbieten: »Nivune nutzen« und »Mit Nivune entwickeln«.
