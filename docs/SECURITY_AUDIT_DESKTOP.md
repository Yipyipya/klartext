# K29 Sicherheitsprüfung: Electron und Desktop

Stand: 21. September 2026

Hinweis nach der Prüfung: Die anschließende Behebung und der aktuelle Reststatus
stehen in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md). Dieser Bericht bewahrt den
ursprünglichen Befundstand vor den Änderungen.

## Ergebnis

Die Desktop-App hat bereits eine gute Sicherheitsbasis. Die sensiblen Einstellungen,
das Onboarding und der Arbeitsbereich laufen mit Context Isolation, ohne Node
Integration und im Renderer-Sandboxmodus. Ihre privilegierten IPC-Endpunkte prüfen
zusätzlich das konkrete Fenster und den Main Frame. Zugangsdaten werden getrennt von
den Einstellungen gespeichert, mit `safeStorage` verschlüsselt und nicht an die
Renderer zurückgegeben. Netzwerkziele, Redirects, Dateiarten und Audiogrößen werden
an mehreren Grenzen geprüft.

Vor einer öffentlichen Freigabe bleiben trotzdem zwei klare Release-Blocker und
mehrere Härtungspunkte. Am dringlichsten sind die von `npm audit` gemeldeten
Produktionsabhängigkeiten und die fehlende authentische Signierung. Danach sollten
alle audioberechtigten Renderer gegen Navigation und fremde Origins verriegelt,
sämtliche Renderer mit einer CSP versehen und die Electron-Fuses gehärtet werden.

Gefundene Punkte:

- 2 hoch
- 4 mittel
- 3 niedrig
- keine kritischen Befunde

In dieser Prüfung wurde kein Produktcode geändert, keine Abhängigkeit installiert
und nichts committed, gepusht oder veröffentlicht.

## Umfang und Methode

Geprüft wurden:

- BrowserWindow- und WebContentsView-Konfiguration
- Preloads, Context Bridge und alle Main-Prozess-IPC-Handler
- Mikrofon- und sonstige Electron-Berechtigungen
- Navigation, neue Fenster und externe URLs
- API-Schlüssel, Logs und Secret-Leaks
- Einstellungsimport und -export
- Audioimport, Aufnahmefragmente und lokale Speichergrenzen
- Löschen, Wiederherstellung und Aufbewahrung
- Cloud-, kompatible und lokale Provider-Endpunkte
- Paketinhalt, macOS-Info.plist, Signatur und Electron-Fuses
- Produktionsabhängigkeiten

Ausgeführt wurden unter anderem:

- gezielte statische Suche in `desktop/`, `shared/`, `lib/`, Tests und Builddateien
- `npm audit --omit=dev` für die Desktop-Produktionsabhängigkeiten
- `electron-fuses read` gegen das vorhandene Alpha-App-Paket
- `codesign -dv --verbose=4` und `plutil -p` gegen das vorhandene Alpha-App-Paket
- ASAR-Inventar und Musterprüfung auf eingebettete Schlüssel
- 45 gezielte Sicherheits- und Speichertests, alle 45 bestanden

Das Offline-Audit allein meldete keine bekannten Schwachstellen, weil seine lokale
Advisory-Datenbasis unvollständig war. Maßgeblich für D-01 ist deshalb der anschließend
mit Registry-Daten ausgeführte Produktionsaudit.

## Priorisierte Befunde

### D-01 Hoch: Verwundbare Produktionsabhängigkeiten sind im Desktop-Paket enthalten

Beleg:

- `@huggingface/transformers` ist als Produktionsabhängigkeit auf `4.2.0` fixiert:
  `desktop/package.json:113-115`.
- Das Lockfile zieht darüber `onnxruntime-node` und `sharp` ein:
  `desktop/package-lock.json:792-803`.
- `onnxruntime-node@1.24.3` zieht `adm-zip` ein:
  `desktop/package-lock.json:3773-3788`.
- Die betroffenen Versionen sind `adm-zip@0.5.18` und `sharp@0.34.5`:
  `desktop/package-lock.json:1630-1637` und
  `desktop/package-lock.json:4306-4347`.
- Das untersuchte `app.asar` enthält `onnxruntime-node`, `adm-zip` und `sharp`
  tatsächlich. Es handelt sich daher nicht nur um Lockfile-Metadaten.

Der Produktionsaudit meldet folgende Advisories:

- `adm-zip` GHSA-xcpc-8h2w-3j85, mögliche 4-GB-Allokation durch präpariertes ZIP
- `adm-zip` GHSA-vwc7-r8mq-g2x9, Symlink-basiertes Überschreiben
- `adm-zip` GHSA-7q85-xj36-vmfc, unkontrollierte Speicherallokation
- `sharp` GHSA-f88m-g3jw-g9cj, geerbte libvips-Schwachstelle
- `sharp` GHSA-rgj7-g3m4-5g8c, libheif-Schwachstelle

Einordnung:

Der aktuelle Produktpfad bündelt Transformers für den Browser-Renderer und ruft die
Node-Varianten nicht direkt aus `main.js` auf. Das reduziert die unmittelbare
Erreichbarkeit. Die verwundbaren nativen Pakete werden aber mit der auslieferbaren
App verteilt. Sie vergrößern die Angriffsfläche und dürfen nicht ungeprüft im
Release-Artefakt bleiben.

Empfohlene Korrektur:

1. `@huggingface/transformers` auf die vom Audit genannte korrigierte Version `4.3.0`
   aktualisieren und beide Lockfiles bewusst neu erzeugen.
2. Prüfen, ob `onnxruntime-node`, `sharp` und fremde Plattform-Binaries für die reine
   Renderer-Laufzeit vollständig aus dem Electron-Paket ausgeschlossen werden können.
3. Danach Online-`npm audit --omit=dev`, vollständige Tests, Desktop-Bundles und einen
   echten lokalen Modelltest ausführen.
4. Im finalen ASAR belegen, dass betroffene, nicht benötigte Module nicht mehr
   enthalten sind oder auf korrigierten Versionen liegen.

Abnahmekriterium:

- kein hoher oder kritischer Produktionsbefund im frischen Online-Audit
- ASAR-Inventar entspricht dem tatsächlich benötigten Renderer-Pfad
- lokale Transkription funktioniert mit beiden angebotenen Modellen

### D-02 Hoch, bekannter Release-Gate: Pakete sind nicht authentisch signiert oder notarisiert

Beleg:

- Der macOS-Build verwendet ausdrücklich `afterPack: "adhoc-sign.js"`:
  `desktop/package.json:22-27`.
- Das Skript führt `codesign --deep --force --sign -` aus:
  `desktop/adhoc-sign.js:1-14`.
- `codesign` bestätigt beim vorhandenen Alpha-Paket `Signature=adhoc` und keinen
  `TeamIdentifier`.
- Die Buildanleitung hält fest, dass macOS nicht notarisiert und Windows nicht mit
  einer Herausgebersignatur versehen ist: `docs/BUILDING.md:55-59`.

Auswirkung:

Eine Prüfsumme belegt Dateigleichheit, aber keine Herausgeberidentität. Für einen
öffentlichen Download fehlt damit die verlässliche Herkunftskette. Nutzer müssen
Schutzmechanismen des Betriebssystems umgehen oder sehen einen unbekannten
Herausgeber. Das erhöht das Risiko einer manipulierten Ersatzdatei und ist vor einem
öffentlichen Launch nicht akzeptabel.

Empfohlene Korrektur:

- macOS mit Developer-ID-Zertifikat signieren, Hardened Runtime aktivieren,
  notarisierten Staple-Nachweis prüfen und anschließend `spctl --assess` ausführen
- Windows mit einem vertrauenswürdigen Code-Signing-Zertifikat signieren und die
  Signatur auf einem frischen Zielsystem prüfen
- Signaturstatus, Commit und SHA-256 im Buildmanifest festhalten
- Ad-hoc-Pakete weiterhin eindeutig als interne Testartefakte kennzeichnen

Dieser Punkt ist bereits als K27-Arbeit bekannt, bleibt aber ein Sicherheits-Gate.

### D-03 Mittel: Audioberechtigung ist an WebContents, nicht an die erwartete lokale Seite gebunden

Beleg:

- Der zentrale Permission-Handler prüft nur die WebContents-Identität und den
  Medientyp. Der übergebene Origin wird ignoriert:
  `desktop/media-permissions.js:7-21`.
- Leere Medientyplisten und der Typ `unknown` werden akzeptiert:
  `desktop/media-permissions.js:11-13`.
- Die vertrauenswürdige Liste umfasst Pill, Onboarding-Audio, Arbeitsbereich,
  Wake-Setup und Wake-Listener: `desktop/main.js:415-425`.
- Das Onboarding-Audio blockiert Navigation und neue Fenster korrekt:
  `desktop/main.js:149-168`.
- Pill, Wake-Setup und Wake-Listener erhalten dagegen keinen
  `setWindowOpenHandler` und keinen `will-navigate`-Blocker:
  `desktop/main.js:390-426`, `desktop/main.js:2042-2052` und
  `desktop/main.js:2070-2091`.

Auswirkung:

Sollte einer dieser Renderer durch einen zukünftigen Link, eine kompromittierte
Abhängigkeit oder eine andere Renderer-Lücke auf fremden Inhalt navigieren, bleibt
derselbe WebContents in der Vertrauensliste. Fremder Inhalt könnte dann
Mikrofonzugriff erhalten. Aktuell wurde kein direkter Navigationspfad aus Nutzerdaten
gefunden. Der Befund ist deshalb mittel und kein nachgewiesener Remote-Exploit.

Empfohlene Korrektur:

- Navigation und neue Fenster ausnahmslos für alle lokalen Fenster und Views sperren
- im Permission-Handler zusätzlich die erwartete lokale URL und den Main Frame prüfen
- nur explizit `audio` erlauben, nicht leere oder unbekannte Medientypen
- die Vertrauensliste auf Renderer reduzieren, die wirklich `getUserMedia` brauchen
- Tests ergänzen, die einen navigierten vertrauenswürdigen WebContents, fremde Origins,
  Subframes, `unknown`, leere Typen und Video ablehnen

### D-04 Mittel: CSP und explizite Renderer-Härtung sind uneinheitlich

Beleg:

- Einstellungen und Onboarding besitzen eine restriktive CSP:
  `desktop/settings.html:1` und `desktop/onboarding.html:4-8`.
- Wake-Setup besitzt ebenfalls eine funktionale, auf WASM und lokale Blobs begrenzte
  CSP: `desktop/wakekey.html:3-6`.
- `workspace.html`, `wake.html`, `pill.html` und `keywin.html` besitzen keine CSP.
- `keywin.html` nimmt API-Schlüssel entgegen und enthält Inline-JavaScript:
  `desktop/keywin.html:7-47`.
- `pill.html` verarbeitet dauerhaft Mikrofon- und Modelldaten und enthält sowohl
  Inline-CSS als auch ein großes Inline-Modulskript: `desktop/pill.html:3-35`.
- Settings, Onboarding und Workspace setzen `contextIsolation: true`,
  `nodeIntegration: false` und `sandbox: true` explizit:
  `desktop/main.js:958-965`, `desktop/main.js:1176-1193` und
  `desktop/main.js:1653-1670`.
- Pill, Key-Fenster, Wake-Setup und Wake-Listener verlassen sich für Teile dieser
  Werte auf Electron-Defaults: `desktop/main.js:390-409`,
  `desktop/main.js:861-869`, `desktop/main.js:2042-2050` und
  `desktop/main.js:2070-2089`.

Auswirkung:

Eine CSP verhindert keine bereits vorhandene privilegierte JavaScript-Lücke, senkt
aber die Ausnutzbarkeit von Markup-Injektionen und versehentlich geladenem Fremdcode.
Das Key-Fenster und die audioberechtigten Renderer sind besonders schützenswert.
Electron-Defaults können sich zudem über Versionswechsel anders verhalten als eine
explizite Sicherheitsentscheidung.

Empfohlene Korrektur:

- Inline-Skript und Inline-CSS in lokale Dateien auslagern
- jede HTML-Datei mit einer minimalen CSP versehen
- für den Modell-Renderer `connect-src` nur auf die tatsächlich benötigten
  Hugging-Face-Endpunkte begrenzen, `worker-src`, `media-src` und
  `wasm-unsafe-eval` nur dort zulassen, wo sie funktional nötig sind
- für jedes Fenster explizit `contextIsolation: true`, `nodeIntegration: false` und
  `sandbox: true` setzen
- Navigation und neue Fenster zusätzlich sperren, unabhängig von der CSP

### D-05 Mittel: Electron-Fuses bleiben im vorhandenen Paket auf unsicheren Defaults

Beleg:

`electron-fuses read` meldet für das vorhandene Alpha-Paket:

- `RunAsNode` aktiviert
- `EnableNodeOptionsEnvironmentVariable` aktiviert
- `EnableNodeCliInspectArguments` aktiviert
- `EnableCookieEncryption` deaktiviert
- `EnableEmbeddedAsarIntegrityValidation` deaktiviert
- `OnlyLoadAppFromAsar` deaktiviert
- `GrantFileProtocolExtraPrivileges` aktiviert

Die Buildkonfiguration hat keinen Fuse-Schritt. `afterPack` führt nur die
Ad-hoc-Signierung aus: `desktop/package.json:22-27` und
`desktop/adhoc-sign.js:9-14`.

Auswirkung:

Die Defaults lassen unnötige Node-Startmodi, Umgebungsoptionen und Debugargumente zu.
Außerdem erzwingt der Electron-Prozess die vorhandene ASAR-Integritätsangabe nicht
selbst. Das ist besonders relevant, solange öffentliche Pakete noch nicht authentisch
signiert sind.

Empfohlene Korrektur:

- beim Packen `RunAsNode`, Node-Options und CLI-Inspect deaktivieren
- Embedded-ASAR-Integritätsprüfung und `OnlyLoadAppFromAsar` aktivieren
- Cookie Encryption aktivieren, sofern kein Migrationsproblem entsteht
- `GrantFileProtocolExtraPrivileges` nur nach Funktionsprüfung deaktivieren, da lokale
  Cache-, WASM- und Medienpfade betroffen sein können
- Fuses vor der finalen Codesignatur setzen und den gelesenen Fuse-Status als
  CI-Artefakt sichern

### D-06 Mittel: "Gesamten Verlauf löschen" entfernt eine mögliche Recovery-Kopie nicht

Beleg:

- Bei beschädigtem Verlauf wird der vollständige Rohinhalt in
  `workspace-history.json.recovery` gesichert:
  `desktop/workspace-store.js:58-60` und `desktop/workspace-store.js:72-95`.
- `clear()` leert nur die aktive Eintragsliste und schreibt die Hauptdatei neu:
  `desktop/workspace-store.js:153-158`.
- Die UI-Aktion entfernt zusätzlich fertig aufbewahrtes Audio, aber nicht die
  Recovery-Datei: `desktop/main.js:1746-1749`.
- Die Oberfläche bezeichnet die Aktion als vollständiges Löschen:
  `desktop/workspace-renderer.js:506-513`.

Auswirkung:

Wenn irgendwann eine Recovery-Datei angelegt wurde, kann sie ältere Transkripte auch
nach der ausdrücklichen Gesamtlöschung enthalten. Das verletzt die erwartete
Datenschutzsemantik der Funktion.

Empfohlene Korrektur:

- bei bestätigter Gesamtlöschung auch `workspace-history.json.recovery` und verwaiste
  `.next`-Dateien entfernen
- bei Einzellöschung entweder die Recovery-Datei verwerfen oder deutlich erklären,
  dass sie noch alte Inhalte enthalten kann
- Testfall ergänzen: beschädigten Verlauf laden, Gesamtlöschung ausführen, danach darf
  keine transcriptführende Recovery-Datei mehr existieren

### D-07 Niedrig: Diagnoseprotokoll ist unbegrenzt und kann fremde Fehlerdetails behalten

Beleg:

- Der Logger hängt jede Zeile ohne Rotation oder Gesamtlimit an dieselbe Datei an:
  `desktop/runtime.js:29-38`.
- Wake-Word-Kandidaten und mehrere Laufzeitereignisse werden fortlaufend protokolliert:
  `desktop/main.js:2215-2239`.
- Fehler externer Provider können bis zu 500 Zeichen ihrer Antwort übernehmen:
  `shared/cloud-transcription-providers.ts:70-86`,
  `shared/openai-provider.ts:90-105` und
  `shared/compatible-refinement-provider.ts:26-29`.
- Das Log kann aus Einstellungen und Tray direkt im Finder beziehungsweise Explorer
  gezeigt werden: `desktop/main.js:1083` und `desktop/main.js:2533-2537`.

Auswirkung:

Ein sehr gesprächiger Wake-Listener oder wiederholte Fehler können die Datei wachsen
lassen. Ein selbst betriebener kompatibler Server kann Text in Fehlerantworten
spiegeln, der dann länger als erwartet lokal im Diagnoseprotokoll verbleibt. Im
geprüften Quelltext wurden keine absichtlichen API-Key- oder Transkript-Logs gefunden.

Empfohlene Korrektur:

- Logrotation mit kleinem Gesamtlimit und kurzer Aufbewahrung einführen
- Provider-Fehler vor dem Loggen auf Statuscode und einen kontrollierten Fehlercode
  reduzieren
- Dateirechte beim Erstellen und Rotieren explizit auf Benutzerzugriff begrenzen
- Wake-Kandidaten im Produktionsbuild drosseln oder nur aggregiert protokollieren

### D-08 Niedrig: Einige IPC-Größenlimits greifen erst nach Deserialisierung oder Kopie

Beleg:

- Aufnahmefragmente werden zuerst mit `Buffer.from` kopiert und erst danach im Store
  auf 16 MB begrenzt: `desktop/main.js:1971-1981` und
  `desktop/workspace-recordings.js:156-169`.
- Wake-Modelle werden erst Base64-dekodiert und danach auf 5 MB geprüft:
  `desktop/wake-runtime.js:8-19`.
- Das IPC ist jeweils an das erwartete Fenster gebunden:
  `desktop/main.js:1971-1973` und `desktop/main.js:2185-2188`.

Auswirkung:

Ein kompromittierter Renderer könnte den Main-Prozess durch sehr große IPC-Payloads
kurzzeitig stark belasten oder beenden. Ohne Renderer-Kompromittierung gibt es keinen
direkten externen Eingabepfad.

Empfohlene Korrektur:

- `byteLength` beziehungsweise Base64-Zeichenlänge vor jeder Konvertierung prüfen
- pro Capture die erwartete nächste Sequenz und das verbleibende Gesamtbudget bereits
  im IPC-Handler prüfen
- negative Tests mit knapp über dem Limit liegenden Payloads ergänzen

### D-09 Niedrig: Einstellungen-Import hat ein lokales TOCTOU-Fenster

Beleg:

- Der Import prüft `stat(filePath)` und liest später erneut über den Pfad:
  `desktop/main.js:1825-1833`.
- Das 1-MB-Limit wird vorab geprüft, nach dem eigentlichen `readFile` aber nur erneut
  gemessen. Eine zwischenzeitlich ausgetauschte sehr große Datei ist dann bereits in
  den Speicher geladen.
- Der Audioimport ist hier stärker und hält während Prüfung und Lesen denselben offenen
  Dateihandle: `desktop/main.js:1925-1960`.

Auswirkung:

Ein lokaler Prozess desselben Benutzers könnte die ausgewählte Datei zwischen Prüfung
und Lesen austauschen und damit eine unnötig große Allokation auslösen. Das ist kein
Privilegiengewinn und setzt lokalen Zugriff voraus.

Empfohlene Korrektur:

- den Einstellungen-Import wie den Audioimport über einen einmal geöffneten Handle
  prüfen und lesen
- höchstens `1_000_001` Bytes einlesen und bei Überschreitung sofort abbrechen

## Bestätigte Schutzmaßnahmen

### Renderer und IPC

- Settings, Onboarding und Workspace sind explizit sandboxed, isoliert und ohne Node
  Integration: `desktop/main.js:958-965`, `desktop/main.js:1176-1193` und
  `desktop/main.js:1653-1670`.
- Diese drei Oberflächen prüfen zusätzlich `senderFrame === mainFrame`:
  `desktop/main.js:975-977`, `desktop/main.js:1211-1215` und
  `desktop/main.js:1687-1691`.
- Preloads geben nur kleine, benannte APIs frei. Es gibt kein generisches `send`,
  `invoke`, `require`, Dateisystem oder Shell-Objekt:
  `desktop/preload.js:1-25`, `desktop/settings-preload.js:1-12`,
  `desktop/onboarding-preload.js:1-12`, `desktop/workspace-preload.js:1-14` und
  `desktop/wake-preload.js:1-10`.
- Alle untersuchten IPC-Handler prüfen mindestens den konkreten Sender. Die
  sicherheitskritischeren Settings-, Onboarding- und Workspace-Handler prüfen auch
  den Main Frame.

### Berechtigungen

- Der zentrale Handler verweigert alle nicht explizit als Media eingestuften
  Berechtigungen und Videozugriff: `desktop/media-permissions.js:7-22`.
- Das verhindert die frühere gegenseitige Überschreibung fensterspezifischer
  Permission-Handler: `desktop/main.js:415-425`.
- Kamera wird im Code nicht angefordert. Das vorhandene Alpha-Info.plist enthält zwar
  generische Kamera- und Bluetooth-Nutzungstexte von Electron, die zentrale
  Permission-Policy verweigert diese Zugriffe.

### Schlüssel und Einstellungen

- API-Schlüssel werden mit `safeStorage` verschlüsselt:
  `desktop/main.js:340-358` und `desktop/main.js:881-899`.
- Schlüssel liegen in einer eigenen Datei und nicht im exportierbaren Settingsprofil:
  `desktop/settings-store.js:1-24` und `desktop/settings-store.js:150-155`.
- Der Settings-Snapshot gibt nur `hasKey`-Boolesche Werte aus, nicht Schlüssel,
  Ciphertext oder Pfade: `desktop/main.js:905-947`.
- Settings-Patches verwenden eine Allowlist, Längenlimits und URL-Normalisierung:
  `desktop/settings-contract.js:1-42`.
- Importierte Netzwerkprofile werden deaktiviert und Sprachaktivierung wird
  ausgeschaltet: `desktop/settings-store.js:158-186`.
- Der Export hat zusätzlich eine defensive Schlüssel-Feldprüfung:
  `desktop/main.js:1805-1815`.
- Die Musterprüfung fand keine eingebetteten privaten Schlüssel oder realistisch
  aussehenden OpenAI-, Groq- oder AWS-Schlüssel im Quellbaum oder untersuchten ASAR.

### Dateien, Audio und lokale Daten

- Dateiimport ist dialoggebunden, prüft reguläre Datei, Endung, Signatur und Größe und
  liest über denselben Handle: `desktop/main.js:1915-1960` und
  `desktop/workspace-jobs.js:3-49`.
- Cloud-Audio ist auf 24 MB, lokale Dateien auf 100 MB begrenzt:
  `desktop/workspace-jobs.js:3-5` und `desktop/workspace-jobs.js:27-40`.
- Aufnahmefragmente sind auf 16 MB pro Fragment, 250 MB gesamt und 10.000 Fragmente
  begrenzt. IDs sind pfadsicher, Fragmente geordnet und mit SHA-256 geprüft:
  `desktop/workspace-recordings.js:4-18` und
  `desktop/workspace-recordings.js:156-203`.
- Aufnahmeordner und Dateien werden mit `0700` beziehungsweise `0600` angelegt:
  `desktop/workspace-recordings.js:84-101` und
  `desktop/workspace-recordings.js:128-178`.
- Erfolgreiches Audio wird standardmäßig entfernt. Dauerhafte Audioaufbewahrung
  braucht eine ausdrückliche Einstellung und lässt sich widerrufen:
  `desktop/workspace-recordings.js:233-250` und
  `desktop/workspace-recordings.js:285-303`.
- Verlaufsdaten übernehmen weder Audio, Schlüssel noch Dateipfade aus Jobs:
  `desktop/workspace-store.js:29-56` und `desktop/workspace-store.js:115-131`.

### Netzwerk und externe Prozesse

- OpenAI, Groq, Deepgram, kompatible Server und Ollama verwenden
  `redirect: "error"`: `shared/openai-provider.ts:83-89`,
  `shared/openai-provider.ts:139-153`,
  `shared/cloud-transcription-providers.ts:90-106`,
  `shared/cloud-transcription-providers.ts:113-134`,
  `shared/cloud-transcription-providers.ts:165-185`,
  `shared/compatible-refinement-provider.ts:31-60` und
  `shared/ollama-provider.ts:32-40,48-75`.
- Kompatible entfernte Server verlangen HTTPS. HTTP ist nur für Loopback zulässig;
  URL-Zugangsdaten, Query und Fragment werden abgelehnt:
  `shared/cloud-transcription-providers.ts:143-163`.
- Ollama ist strikt auf `localhost`, `127.0.0.1` oder `::1` begrenzt:
  `shared/local-endpoints.ts:1-20`.
- CORS ist im Node-basierten Main-Prozess keine Schutzgrenze. Die tatsächlichen
  Grenzen sind hier URL-Normalisierung, explizite Anbieterwahl, Credential-Bindung
  und Redirect-Verbot. Diese Grenzen sind vorhanden.
- Alle `shell.openExternal`-Ziele sind feste Konstanten oder feste System-URLs. Es
  wird keine Renderer- oder Nutzereingabe an die Shell übergeben:
  `desktop/main.js:1080-1083`, `desktop/main.js:1327-1329` und
  `desktop/main.js:2531-2552`.
- `execFile` verwendet ausschließlich feste Programme und feste Argumente für das
  Einfügen per Tastatur: `desktop/main.js:811-837`.
- Lokale Whisper-Modelle sind auf konkrete Repository-Revisionen fixiert:
  `shared/local-models.ts:18-36`. Ein zusätzlicher Hash pro Modelldatei wäre trotzdem
  eine sinnvolle Supply-Chain-Härtung.

## Paketbeobachtungen

Das vorhandene Alpha-Paket ist ein internes Testartefakt vom 17. September 2026. Es
enthält keinen zugehörigen Buildmanifest-Nachweis im Verzeichnis, ist nur ad hoc
signiert und wurde vor mehreren aktuellen Desktop-Dateien gebaut. Es darf daher nicht
als aktueller Release-Kandidat behandelt werden.

Das `Info.plist` dieses Pakets enthält außerdem
`NSAppTransportSecurity.NSAllowsArbitraryLoads = true`. Die Anwendung selbst
erzwingt sichere Provider-URLs, aber diese breite Plattformausnahme schwächt die
zweite Schutzschicht. Für den Release sollte sie entfernt oder auf die tatsächlich
erforderliche lokale Ausnahme begrenzt werden. Das neu gebaute Paket ist anschließend
erneut mit `plutil` zu prüfen.

Das ASAR enthält vollständige Node-Abhängigkeiten samt Quelltext, nativen Libraries
für mehrere Plattformen sowie Module, die der Renderer-Bundlepfad offenbar nicht
benötigt. Neben D-01 ist dies ein Grund, die `files`- und Dependency-Auswahl für
Electron zu minimieren und den finalen Paketinhalt automatisiert zu inventarisieren.

## Empfohlene Reihenfolge

1. D-01 beheben und den finalen Produktionsaudit plus ASAR-Inventar verifizieren.
2. D-03 und D-04 gemeinsam umsetzen, weil Navigation, Origin-Prüfung, CSP und
   explizite WebPreferences dieselbe Renderer-Vertrauensgrenze betreffen.
3. D-05 in den Paketprozess aufnehmen und auf macOS sowie Windows testen.
4. D-06 beheben und mit einem echten Recovery-Löschtest absichern.
5. D-07 bis D-09 als kurze Härtungspunkte erledigen.
6. D-02 im bekannten Signierungs- und Notarisierungsschritt K27 vollständig
   nachweisen.

## Verifikation nach den Korrekturen

- vollständiges `npm run verify`
- frischer Online-`npm audit --omit=dev` in Root und Desktop
- automatisierte Fensterprüfung für CSP, Navigation, Window Open und WebPreferences
- Permission-Tests mit fremdem Origin, navigiertem WebContents, Subframe, Video und
  unbekanntem Medientyp
- Electron-Fuses aus dem finalen Paket auslesen und archivieren
- ASAR-Inventar auf unnötige native Pakete und Secret-Muster prüfen
- macOS-Signatur, Hardened Runtime, Notarisierung, Stapling und Gatekeeper prüfen
- Windows-Herausgebersignatur auf einem frischen System prüfen
- Gesamtlöschung mit vorher erzeugter Recovery-Datei testen
- realer Mikrofontest für Pill, Arbeitsbereich, Onboarding und Wake-Word nach der
  Renderer-Härtung
