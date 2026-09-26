# K29 Sicherheitsprüfung und Härtung

Stand: 21. September 2026

## Ergebnis

K29 ist als Quelltext-, Abhängigkeits- und Paketprüfung abgeschlossen. Die
Detailbefunde stehen in
[`SECURITY_AUDIT_FRONTEND.md`](SECURITY_AUDIT_FRONTEND.md) und
[`SECURITY_AUDIT_DESKTOP.md`](SECURITY_AUDIT_DESKTOP.md). Während der ersten
Quelltexthärtung wurden keine Pakete installiert. Der später getrennt geprüfte
Paketnachlauf aktualisierte beide Lockfiles und erzeugte nur lokale Testartefakte;
keine installierte App wurde ersetzt und nichts wurde veröffentlicht.

Der geprüfte Entwicklungsstand schließt die direkt im Quelltext behebbaren hohen
und mittleren Grenzen weitgehend. Systemdiktat und Arbeitsbereich-Aufnahme sind
nach der Härtung real auf dem Mac bestanden. Vor einem öffentlichen Release
bleiben echte Signierung, Windows sowie die reale Onboarding- und
Sprachaktivierungsabnahme zwingend offen. Die bekannten Abhängigkeitsbefunde,
der neunte Electron-Fuse und die Web-Uploadgrenzen sind inzwischen geschlossen.

## Umgesetzte Härtung

- Das Electron-ASAR enthält nur noch die gebündelte Laufzeit und keine ungenutzten
  `node_modules`. Der neue Testbuild enthält 47 ASAR-Einträge und keinen
  `node_modules`-Pfad.
- Alle Electron-Fenster setzen Context Isolation, deaktivieren Node Integration,
  verwenden die Renderer-Sandbox und sperren Navigation sowie neue Fenster.
- Alle Desktop-HTML-Oberflächen besitzen eine CSP. Das Key-Fenster verwendet kein
  Inline-Skript mehr.
- Mikrofonrechte gelten nur für bekannte Audio-WebContents, lokale `file:`-URLs,
  den Hauptframe und den expliziten Medientyp `audio`. Fremde Origins, Subframes,
  leere oder unbekannte Medientypen und Video werden abgelehnt.
- Electron-Fuses deaktivieren `RunAsNode`, `NODE_OPTIONS` und CLI-Inspect. Cookie-
  Verschlüsselung, eingebettete ASAR-Integritätsprüfung und ausschließliches Laden
  aus ASAR sind aktiv. Der optionale separate Browser-V8-Snapshot bleibt aus, weil
  ein realer Paket-Smoke seine Inkompatibilität mit diesem Build nachgewiesen hat.
- macOS erlaubt keine beliebigen ATS-Verbindungen mehr. Generische Kamera- und
  Bluetooth-Nutzungstexte wurden aus dem Paket entfernt; die benötigte
  Mikrofonbeschreibung bleibt erhalten.
- Web-Antworten setzen CSP, Frame-, MIME-, Referrer- und Permissions-Schutzheader.
  Das Theme-Startskript liegt als lokale Datei vor. Der lokale Produktionsserver
  lieferte die Header auf Startseite und Skript nachweislich aus.
- Browser-API-Keys liegen nur noch in `sessionStorage`. Bereits vorhandene
  `localStorage`-Credentials werden beim Laden in die aktuelle Sitzung übernommen
  und anschließend dauerhaft entfernt.
- LLM-Systemanweisungen enthalten keine Nutzerwerte mehr. Diktat, Kontext und
  Wörterbuch werden als serialisierte, ausdrücklich nicht vertrauenswürdige Daten
  übergeben. Adversarial Marker und Anweisungen sind durch Regressionstests
  abgedeckt.
- Gesamtlöschung des Desktop-Verlaufs entfernt auch Recovery- und `.next`-Kopien.
- Aufnahmefragmente und Wake-Modelle werden vor teuren Binärkopien begrenzt.
  Einstellungen werden über einen festen Dateihandle mit maximal 1.000.001 Bytes
  gelesen.
- Das lokale Diagnoseprotokoll ist auf ungefähr 1 MB plus eine Rotation begrenzt
  und wird mit Benutzerrechten `0600` geschrieben. Browser-Providerfehler werden
  nicht mehr zusätzlich in die Produktionskonsole geschrieben.

## Verifikation

- `npm run verify`: 162 Tests, TypeScript, Next.js-Produktionsbuild und alle
  Desktop-Bundles grün.
- Reale Mac-Abnahme nach der Härtung: Systemdiktat aus Arbeitsbereich und per
  Shortcut sowie Arbeitsbereich-Aufnahme transkribieren lokal; Zwischenablage
  und automatisches Einfügen funktionieren. Das vorhandene WebGPU-Modell wurde
  zusätzlich direkt und netzwerkfrei aus dem Cache initialisiert.
- Temporärer Apple-Silicon-App-Build: strikte Codesign-Prüfung grün, ASAR-
  Integrität im `Info.plist` vorhanden, keine ausgelieferten Node-Module.
- Paket-Smokes grün: Haupt-Renderer, Einstellungen, vier Arbeitsbereiche und
  Ersteinrichtung. Alle Smokes nutzen isolierte Profile und weder Mikrofon noch
  Autostart.
- Ausgelesene Fuses: Node-Einstiege und Inspect aus, Cookie-Verschlüsselung sowie
  ASAR-Integrität an, ausschließliches Laden aus ASAR an.
- ATS: `NSAllowsArbitraryLoads = false`; nur lokale Netzwerkziele bleiben für
  ausdrücklich konfigurierte lokale Dienste zulässig.

## Abgeschlossener Nachlauf

- `next` steht auf 16.3.5, `@huggingface/transformers` auf 4.3.0 und
  `baseline-browser-mapping` auf 2.11.25. Die sechs Desktop-Werkzeugbefunde
  wurden mit kompatiblen transitiven Lockfile-Updates geschlossen. Alle vier
  Audits melden 0 Befunde. Details stehen in
  [`SECURITY_AUDIT_POST_UPGRADE.md`](SECURITY_AUDIT_POST_UPGRADE.md).
- `@electron/fuses` 2.1.3 setzt alle neun Electron-43-Fuses ausdrücklich.
  `WasmTrapHandlers` ist aktiv und `strictlyRequireAllFuses` verhindert künftig
  unbemerkte neue Fuse-Defaults.
- Der Web-Dateiimport begrenzt aktive und wartende Aufträge auf zwölf Dateien,
  300 MB insgesamt und 100 MB pro Datei.

## Offene Release-Gates

1. K27 mit Developer ID, Notarisierung und Windows-Herausgebersignatur abschließen.
   Ad-hoc-Signatur und Prüfsumme belegen keine Herausgeberidentität.
2. Onboarding-Probe und Sprachaktivierung nach der Renderer-Härtung noch real mit
   Mikrofon testen. Systemdiktat und Arbeitsbereich-Aufnahme sind auf dem Mac
   bestanden; Windows bleibt ein eigenes Zielsystem-Gate.
3. Die neuen Web-Header nach einer späteren Veröffentlichung am echten Deployment
   prüfen. Die CSP benötigt wegen Next.js-Hydration und der bestehenden
   Renderer-Laufzeit noch `unsafe-inline`; eine spätere Nonce-/Hash-Härtung bleibt
   sinnvoll.
4. Download-Manifest und versionsfeste Integritätsanzeige als Teil von K28/K27
   fertigstellen.

## Einordnung

K29 selbst ist abgeschlossen, aber kein Release-Gate wird dadurch übersprungen.
Die kritische Next.js-Version und die hohen Transformers-Produktionsbefunde sind
geschlossen. Echte Paketsignierung und die genannten Plattform- und
Laufzeitabnahmen bleiben vor einem öffentlichen Kandidaten blockierend.
