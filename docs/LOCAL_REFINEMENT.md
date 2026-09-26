# Lokale Textüberarbeitung

Stand: 14. September 2026

Dieses Dokument beschreibt den unveröffentlichten K13-Entwicklungsstand. Die
lokale Textüberarbeitung ist implementiert und mit einem echten Ollama-Modell auf
dem Test-Mac technisch geprüft, aber noch nicht mit einem geeigneten Modell auf
Mac und Windows abgenommen und nicht veröffentlicht.

## Verarbeitungswege

Transkription und Textüberarbeitung werden unabhängig gewählt:

| Textüberarbeitung | Datenweg nach der Transkription |
| --- | --- |
| Keine KI-Überarbeitung | Kein Refiner-Aufruf; nur die gewählte lokale Bereinigung und das Wörterbuch |
| Nur lokale Regeln | Kein Modell-/Netzwerkaufruf; eingebauter deterministischer Kern |
| OpenAI | Text geht mit dem eigenen OpenAI-Key an das festgelegte Textmodell |
| Ollama auf diesem Gerät | Text, Kontext und Wörterbuch gehen direkt an die lokale Ollama-API |

»Vollständig lokal« gilt nur für lokales Whisper zusammen mit »keine
KI-Überarbeitung«, »nur lokale Regeln« oder Ollama. Qualitäts-Transkription über
OpenAI bleibt auch dann ein gemischter Weg, wenn die anschließende Überarbeitung
lokal läuft. Die Oberfläche weist diesen Unterschied aus.

## Ollama-Vertrag

Nivune verwendet Ollamas lokale API direkt:

- `GET /api/tags` lädt die installierten Modellnamen.
- `POST /api/generate` überarbeitet den Text mit `stream: false`, deaktiviertem
  Thinking und Temperatur 0.
- Standardadresse ist `http://127.0.0.1:11434`.
- Zulässig sind nur `localhost`, `127.0.0.1` und `::1` über HTTP oder HTTPS,
  ohne Zugangsdaten, Pfad, Query oder Fragment. In der Web-App erlaubt die CSP
  nur `localhost` und `127.0.0.1`; `::1` funktioniert dort nicht (Browser
  akzeptieren diese Angabe in `connect-src` nicht) und bleibt der Desktop-App
  vorbehalten.
- Umleitungen werden als Fehler behandelt. Ein lokaler Dienst kann Nivune daher
  nicht unbemerkt zu einem entfernten Ziel weiterleiten.
- Ein fehlendes Modell, Timeout, HTTP-Fehler oder unvollständiges Ergebnis ersetzt
  den Rohtext nicht. Der gemeinsame Kern behält die Transkription und meldet den
  fehlgeschlagenen Feinschliff.
- Eine konservative Inhaltssicherung verwirft außerdem erkennbare Kontextkopien,
  starke Kürzungen, geänderte Sprecherrollen und verlorene Verneinungen. Sie ist
  ein Schutznetz und kein Beweis, dass jede verbleibende Modellantwort korrekt ist.

Ollamas offizielle Dokumentation beschreibt die lokale Basisadresse, die
[`generate`-API](https://docs.ollama.com/api/generate), die
[`tags`-API](https://docs.ollama.com/api/tags) und dass lokal standardmäßig keine
Authentifizierung erforderlich ist
([Authentifizierung](https://docs.ollama.com/api/authentication)).

## Einrichtung

1. Ollama und ein geeignetes lokales Textmodell außerhalb von Nivune
   installieren. Nivune lädt oder kauft kein Ollama-Modell automatisch.
2. In Nivune unter **Transkription → Textüberarbeitung** »Ollama auf diesem
   Gerät« wählen.
3. Lokale Adresse prüfen, **Verbindung prüfen** ausführen und ein gefundenes
   Modell wählen oder dessen genaue ID eintragen.
4. Für einen vollständig lokalen Datenweg zusätzlich **Auf diesem Gerät** als
   Transkription wählen und das Whisper-Modell einmalig vorbereiten.

Desktop spricht Ollama aus dem Main-Prozess an und unterliegt nicht dem
Browser-CORS-Modell. Im Web muss Ollama den Origin der Nivune-Seite akzeptieren.
Ollama dokumentiert dies über `OLLAMA_ORIGINS` in der
[FAQ](https://docs.ollama.com/faq). Nivune verwendet dafür keinen öffentlichen
Proxy und weicht bei einem Browserfehler nicht still auf einen Cloud-Anbieter aus.

## Prüfstand und offene Abnahme

Automatisiert geprüft sind:

- unabhängige Transkriptions-/Überarbeitungspläne;
- vollständig ausgeschalteter Refiner;
- ein lokaler Plan ohne OpenAI- oder Credential-Verweis;
- Loopback-Validierung, sichere Migration und abgewiesene Redirects;
- Modellliste, Anfrageparameter, Kontext, Wörterbuch, Fehler und Rohtext-Fallback;
- dieselbe Kernroute für lokale Web- und Desktop-Ergebnisse.

Ein echter HTTP-Smoke startete einen lokalen Testdienst auf `127.0.0.1`, lud über
`/api/tags` genau ein Modell und erhielt über `/api/generate` eine vollständige,
nicht-streamende Antwort. Zusätzlich wurden Ollama 0.34.0 und `qwen3:0.6b`
(rund 522 MB) auf dem Test-Mac installiert. Der nur an `127.0.0.1` gebundene
Testdienst lief mit `OLLAMA_NO_CLOUD=1`; das Modell wurde auf dem Apple-M1-
Metal-Backend geladen. Der Web-Produktionsbuild fand es über die reale
Browser-CORS-Verbindung. Zwei kurze deutsche/englische Inferenzläufe erreichten
den gemeinsamen Adapter, veränderten beziehungsweise kürzten aber den Inhalt. Die
neue Sicherung verwarf beide Antworten und erhielt jeweils die Transkription mit
einer Feinschliff-Warnung. Der Adapter ist damit real belegt, das kleine Modell
aber nicht für Nivune qualifiziert.

Der Produktionsbuild, TypeScript, der aktuelle Gesamtsatz mit 120 automatisierten
Tests und der isolierte
Electron-Einstellungs-Smoke sind grün. Vor einer öffentlichen Qualitätsaussage
fehlen ein geeignetes lokales Modell, kurze und lange deutsche/englische Diktate,
Fehler-/Abbruchmessungen, ein Netzwerkmitschnitt sowie reale gepackte Mac- und
Windows-Läufe. Veröffentlicht ist weiterhin nur Nivune 0.3.0 ohne diese
Erweiterung.

`qwen3:0.6b` bleibt auf dem Testgerät für Experimente installiert. Wegen des
negativen Inhaltstests ist es weder Nivune-Standard noch Empfehlung für die
Textüberarbeitung. Ein größeres Modell benötigt mehr Speicher und Arbeitsspeicher
und muss vor einer Empfehlung denselben Sicherheits- und Langtexttest bestehen.
