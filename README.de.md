# Nivune

**Sprich. Der Rest ist Text.**

[English](README.md)

Nivune ist eine kostenlose, lokal ausgerichtete Diktier- und
Transkriptionsanwendung für Web, macOS und Windows. Sie benötigt kein
Nivune-Konto. Nutzer entscheiden selbst, ob Audio und Text auf dem Gerät, mit
eigenen Zugangsdaten bei einem unterstützten Anbieter oder über einen kompatiblen
selbst betriebenen Endpunkt verarbeitet werden.

## Projektstatus

Der letzte öffentliche Stand ist **0.3.0 unter dem früheren Arbeitsnamen
Klartext**. Der Branch `develop/v1-core` enthält die unveröffentlichte
Nivune-1.0-Arbeit und ist kein stabiler öffentlicher Release. Der
geprüfte Implementierungsstand und die verbleibenden Plattform-Gates stehen in
[`docs/FEATURE_STATUS.md`](docs/FEATURE_STATUS.md).

Der Entwicklungsstand für 1.0 enthält:

- systemweites Desktop-Diktat mit Zwischenablage und Einfügen am Cursor;
- Mikrofonaufnahmen und Import vorhandener Audiodateien;
- lokale Whisper-Transkription nach bewusstem Modelldownload;
- OpenAI, Groq und kompatible Transkriptionsziele mit eigenen Zugangsdaten;
- optionale regelbasierte Bereinigung, OpenAI-kompatible Überarbeitung oder lokales Ollama;
- bearbeitbaren Roh- und Ergebnistext, lokalen Verlauf, TXT-/Markdown-Export und Recovery;
- getrennte Oberflächen- und gesprochene Sprache auf Deutsch und Englisch;
- manuelle Updateprüfung, die nur die offizielle Release-Seite öffnet;
- kein Nivune-Konto, Pflichtabo, versteckter Proxy oder stiller Cloud-Rückfall.

Einige dieser Wege sind noch nicht veröffentlicht oder unter Windows vollständig
abgenommen. Der Entwicklungsstand ist nicht für unersetzbare Aufnahmen gedacht.

## Entwicklung

Node.js 24 ist die unterstützte Build-Laufzeit.

```bash
npm ci
npm --prefix desktop ci
npm run verify
```

Web-Anwendung lokal starten:

```bash
npm run dev
```

Die öffentliche Website liegt unter `/` (Deutsch) und `/en`, die Web-App unter
`/app`.

Electron-Anwendung starten:

```bash
npm --prefix desktop start
```

Die vollständige Build- und Paketanleitung steht in
[`docs/BUILDING.md`](docs/BUILDING.md). Eigenbetrieb und Datenflussgrenzen sind in
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) dokumentiert.

## Lokale Modelle und externe Anbieter

Modellgewichte sind weder Teil des Quellcodes noch des Installers. Nivune lädt
ein gewähltes Modell erst nach einem bewussten Nutzerbefehl und verwendet danach
die festgeschriebene Cache-Revision. Versionen, Lizenzen, Größen und geprüfte
Offline-Grenzen stehen in [`docs/LOCAL_MODELS.md`](docs/LOCAL_MODELS.md).

Externe Anbieter sind optional und können API-Kosten berechnen. Zugangsdaten
werden für das ausgewählte Ziel hinterlegt; Nivune betreibt keinen gemeinsamen
Transkriptionsdienst. Lokale und externe Verarbeitung werden in der App getrennt
angezeigt.

## Mitwirken und Sicherheit

Vor Änderungen bitte [`CONTRIBUTING.md`](CONTRIBUTING.md) lesen. Neue
Anbieteradapter müssen [`docs/ADAPTERS.md`](docs/ADAPTERS.md) einhalten.
Sicherheitsprobleme bitte nach [`SECURITY.md`](SECURITY.md) vertraulich melden;
Schlüssel, private Transkripte, Aufnahmen und Exploitdetails gehören nicht in
öffentliche Issues.

## Lizenz

Der Nivune-Quellcode steht unter der [MIT-Lizenz](LICENSE). Abhängigkeiten,
mitgelieferte Laufzeiten und separat geladene Modelle behalten ihre eigenen
Lizenzen; siehe [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
