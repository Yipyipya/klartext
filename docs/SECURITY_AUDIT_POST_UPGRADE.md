# Sicherheitsprüfung nach den Paketupdates

Stand: 21. September 2026

## Ergebnis

Die freigegebenen Updates auf `next` 16.3.5 und
`@huggingface/transformers` 4.3.0 sind in beiden betroffenen Paketbäumen samt
Lockfiles umgesetzt. Die zuvor gemeldeten kritischen und hohen
Produktionsbefunde aus Next.js und Transformers sind damit geschlossen.

Der anschließend getrennt freigegebene Root-Nachlauf aktualisiert
`baseline-browser-mapping` von 2.10.42 auf 2.11.25. Root-Produktion und
Root-Gesamtbaum melden danach keine bekannte Schwachstelle. Auch der
Desktop-Produktionsbaum meldet keine bekannte Schwachstelle. Die sechs hohen
Befunde im Desktop-Entwicklungs- und Paketierungsbaum wurden anschließend durch
zwölf kompatible transitive Updates im Lockfile geschlossen. `@electron/fuses`
steht nun auf 2.1.3 und kennt alle neun Fuses des verwendeten Electron-Binaries.

Während der realen Offline-Prüfung wurde eine Integrationsänderung in
Transformers 4.3.0 gefunden. Festgeschriebene Modellrevisionen verwenden nun
andere Cache-Schlüssel als die bereits vorhandenen älteren
`resolve/main`-Einträge. Klartext besitzt deshalb jetzt einen eng begrenzten
Cache-Adapter. Er liest vorhandene `main`-Einträge nur als Offline-Fallback für
die konkret festgeschriebene Revision. Neue Downloads bleiben weiterhin auf die
unveränderliche Revision festgelegt.

## Scope

Geprüft wurden:

- Next.js-App, Sicherheitsheader, CSP, Browser-Credentials und Uploadgrenzen
- Desktop-Main-Prozess, IPC-Grenzen, Renderer-Sandbox, Navigation,
  Mikrofonfreigaben, lokale Logs und Prompt-Isolation
- Root- und Desktop-Abhängigkeiten mit Produktions- und Vollaudit
- lokaler Transformers-Cache und netzlose Initialisierung von `whisper-small`
- frischer Apple-Silicon-Alpha-Build, ASAR, Fuses, ATS, Signatur und Renderer-Smokes

Eine Datenbank- oder Edge-Function-Fläche existiert in diesem Repository nicht.

## Abhängigkeitsaudit

| Baum | Ergebnis | Einordnung |
| --- | --- | --- |
| Root, `npm audit --omit=dev` | 0 | `baseline-browser-mapping` transitiv auf 2.11.25 aktualisiert |
| Root, vollständiger Audit | 0 | keine bekannte Schwachstelle |
| Desktop, `npm audit --omit=dev` | 0 | Produktionsbaum sauber |
| Desktop, vollständiger Audit | 0 | zwölf kompatible transitive Build-Updates angewendet |

Die sechs Desktop-Entwicklungsbefunde betrafen `@xmldom/xmldom`,
`brace-expansion`, `fast-uri`, `js-yaml`, `tar` und `undici`. Sie kamen über
Electron- beziehungsweise electron-builder-Werkzeuge. Der angewendete
`npm audit fix` benötigte kein `--force`, änderte keine direkte Laufzeitabhängigkeit
und aktualisierte zwölf transitive Pakete innerhalb kompatibler Bereiche.

## Verifizierte Härtungsgrenzen

- Der lokale Produktionsserver liefert CSP, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` und eine begrenzte
  `Permissions-Policy` auf Startseite und lokalem Theme-Skript aus.
- Browser-Zugangsdaten bleiben sitzungsgebunden. Persistente Einstellungen
  enthalten keine Provider-Schlüssel.
- Nutzereingaben liegen in LLM-Anfragen als serialisierte, nicht vertrauenswürdige
  Daten vor. Die bestehenden adversarial Regressionstests bleiben grün.
- Bekannte Audio-Renderer erhalten Mikrofonzugriff nur für Audio, Hauptframe und
  lokale App-URLs. Navigation und neue Fenster sind gesperrt.
- Das frische ASAR enthält 47 Einträge und keinen `node_modules`-Pfad. Gebündelt
  sind die benötigten Transformers- und ONNX-Web-Runtime-Dateien.
- `RunAsNode`, `NODE_OPTIONS` und CLI-Inspect sind deaktiviert. Cookie-
  Verschlüsselung ist im Produktionspaket aktiv. Nur der wegwerfbare,
  ad-hoc-signierte interne Alpha-Build schaltet sie aus, weil er keine Cookies
  verwendet und macOS bei wechselnden ad-hoc Signaturen sonst irreführende
  Keychain-Dialoge zeigt. Eingebettete ASAR-Integritätsprüfung und ausschließliches
  Laden aus ASAR sind in beiden Paketen aktiv. `WasmTrapHandlers` ist ausdrücklich aktiviert;
  `strictlyRequireAllFuses` stoppt künftige Paketbauten bei unbekannten Fuses.
- Der Web-Dateiimport nimmt höchstens zwölf aktive oder wartende Dateien und
  insgesamt 300 MB an. Einzeldateien werden bereits vor dem Enqueue auf 100 MB,
  Leerdateien und unterstützte Formate geprüft.
- `NSAllowsArbitraryLoads` ist aus. Unsicheres HTTP bleibt ausschließlich für
  `localhost` und `127.0.0.1` erlaubt.
- Die strikte macOS-Codesign-Prüfung ist grün. Die Signatur ist weiterhin nur ad
  hoc und belegt keine Herausgeberidentität.

## Lokaler Modellpfad

Das real genutzte Produktionsprofil liegt unter:

`~/Library/Application Support/klartext-desktop`

Der Transformers-Browsercache liegt darin unter:

`Service Worker/CacheStorage`

Der Cache war bei der Prüfung 783 MB groß. `whisper-small` und `whisper-base`
sind mit Konfiguration, Tokenizer, Vorverarbeitung sowie WebGPU-Encoder und
-Decoder vorhanden. Beide Modelle werden durch die aktuelle Klassifizierung als
WebGPU-bereit erkannt. Die WASM-Klassifizierung bleibt erwartungsgemäß teilweise,
weil die separaten Q8-Gewichte nicht geladen wurden.

Ein isolierter Lauf des frisch gepackten Transformers-4.3.0-Bundles mit
aktivierter Netzsperre initialisierte `onnx-community/whisper-small` erfolgreich
über WebGPU aus einer geklonten Kopie dieses Caches. Die feste Revision
`36050c46d777d46dc4b5f43f6d90574fc38f8732` und `local_files_only` waren aktiv.
Mikrofon und Transkription wurden dabei nicht gestartet.

## Vollständige Verifikation

- 167/167 automatisierte Tests grün
- TypeScript ohne Fehler
- Next.js-16.3.5-Produktionsbuild mit Webpack grün
- alle Desktop-Bundles grün
- frischer Apple-Silicon-Alpha-Build grün
- vier isolierte Paket-Smokes grün: Haupt-Renderer, Einstellungen,
  Arbeitsbereich und Ersteinrichtung
- netzlose Initialisierung von `whisper-small` aus dem vorhandenen Cache grün
- strikte Codesign-Prüfung, ASAR-Inventar, Fuses, ATS und ASAR-Integrität grün
- frische `npm ci`-Installationen aus beiden Lockfiles grün
- Root- und Desktop-Produktion sowie beide Gesamtbäume im Audit bei 0
- `git diff --check` grün

Der standardmäßige Turbopack-Build konnte in der Codex-Ausführungsumgebung nicht
vollendet werden, weil sein interner PostCSS-Prozess keinen lokalen Port binden
darf. Derselbe Produktionsstand kompiliert mit dem dokumentierten
`next build --webpack` vollständig. Der Fehler ist als Umgebungsgrenze
dokumentiert und nicht als bestandener Turbopack-Nachweis gewertet.

## Verbleibende Punkte

1. CSP später ohne `unsafe-inline` ausliefern und die Header am echten Deployment
   erneut prüfen.
2. Developer-ID-Signierung, Notarisierung, Windows-Paket und echte
   Onboarding-/Sprachaktivierungsabnahme getrennt durchführen.
