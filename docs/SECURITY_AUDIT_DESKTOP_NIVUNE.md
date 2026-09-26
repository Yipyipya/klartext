# Desktop-Sicherheitsaudit für Nivune 1.0

Stand: 23. September 2026

## Kurzfazit

Der aktuelle Desktop-Quellstand besitzt eine belastbare Sicherheitsbasis. Im
geprüften Code wurde kein kritischer Befund und keine unmittelbar ausnutzbare
Remote-Schwachstelle gefunden. Beide npm-Audits des Desktop-Baums melden null
bekannte Schwachstellen. 81 gezielte Desktop-, IPC-, Berechtigungs-, Credential-,
Datei- und Speichertests bestehen.

Die früher dokumentierten Quelltextbefunde sind im aktuellen Stand überwiegend
geschlossen. Alle Electron-Fenster sind sandboxed, Navigation und neue Fenster
sind gesperrt, Medienrechte sind auf bekannte lokale Audio-Hauptframes begrenzt,
alle Oberflächen besitzen eine CSP, Zugangsdaten verlassen den Main-Prozess nicht
und die lokalen Dateioperationen besitzen sinnvolle Größen- und Pfadgrenzen.

Für einen öffentlichen 1.0-Download bleibt authentische Paketsignierung der klare
hohe Release-Blocker. Zusätzlich sollten vor dem finalen Release die unbegrenzte
PCM-Sammlung des kurzen Systemdiktats und der zu breite Netzwerk-CSP des
Audio-Renderers gehärtet werden. Ein aktuelles Nivune-Paket existiert noch nicht.
Der zuletzt installierte Kandidat trägt noch den alten Namen und belegt deshalb
nicht den finalen Nivune-Artefaktstand.

Gefundener Reststatus:

- kritisch: 0
- hoch: 1 Release-Blocker
- mittel: 3 Härtungs- oder Verifikationspunkte
- niedrig: 2 Härtungspunkte
- bekannte npm-Schwachstellen: 0

Dieses Audit hat keinen Produktcode, keine Paketdatei, kein Lockfile und kein
Buildartefakt verändert. Es wurde nichts committed oder veröffentlicht. Die
einzige neu geschriebene Datei ist dieser Bericht.

## Umfang

Geprüft wurden:

- Electron-Main-Prozess, BrowserWindow und WebContentsView
- Preloads, Context Bridge und privilegierte IPC-Endpunkte
- CSP, Navigation, neue Fenster und externe URL-Aufrufe
- Mikrofon- und Medienberechtigungen
- API-Schlüssel, `safeStorage`, Export und Import von Einstellungen
- Aufnahmefragmente, Audioimport, Verlauf, Recovery und lokale Dateirechte
- Cloud-, kompatible und lokale Providergrenzen
- lokaler Whisper-Download, Cache, Revisions-Pins und Offlinepfad
- Electron-Fuses, ASAR-Dateiauswahl, ATS, Signierung und Paketkonfiguration
- Desktop-Produktions- und Entwicklungsabhängigkeiten

Nicht erneut funktional ausgeführt wurden ein Paketbau, eine echte
Mikrofonaufnahme und eine Whisper-Inferenz. Ein Paketbau hätte die ausdrücklich
ausgenommenen generierten Produktdateien im geteilten Arbeitsbaum verändert. Die
vorhandenen realen Nachweise sind in `docs/DEVELOPMENT_HANDOFF.md` dokumentiert;
der finale Nivune-Kandidat muss sie nach dem Namenswechsel erneut bestehen.

## Ausgeführte nicht-mutierende Verifikation

### Abhängigkeiten

Registry-basierte Prüfungen am 23. September 2026:

| Prüfung | Ergebnis |
| --- | --- |
| `npm audit --omit=dev --json` in `desktop/` | 0 Befunde, 43 Produktionsabhängigkeiten |
| `npm audit --json` in `desktop/` | 0 Befunde, 373 Abhängigkeiten insgesamt |
| `npm ls` für sicherheitsrelevante Pakete | Baum konsistent, kein `ELSPROBLEMS` |

Aufgelöste direkte beziehungsweise sicherheitsrelevante Versionen:

- `electron@43.1.0`
- `electron-builder@26.15.3`
- `@electron/fuses@2.1.3`
- `@huggingface/transformers@4.3.0`
- `onnxruntime-node@1.30.0`
- `adm-zip@0.6.1`
- `sharp@0.35.4`
- `esbuild@0.25.9`

`onnxruntime-node`, `adm-zip` und `sharp` erscheinen im installierten
Transformers-Abhängigkeitsbaum, werden aber wegen `!node_modules/**` nicht in das
Desktop-ASAR aufgenommen. Die App verwendet stattdessen das gebündelte
Browser-/WASM-Laufzeitartefakt. Das ist in `desktop/package.json:60-108` festgelegt
und durch den letzten Kandidaten mit einem 47-Einträge-ASAR ohne `node_modules`
belegt.

### Gezielte Tests

Ausgeführt wurde:

```text
node --require ./tests/register.cjs --test \
  tests/desktop-runtime.test.cjs \
  tests/media-permissions.test.cjs \
  tests/provider-credentials.test.cjs \
  tests/settings.test.cjs \
  tests/settings-migration.test.cjs \
  tests/workspace-jobs.test.cjs \
  tests/workspace-recordings.test.cjs \
  tests/workspace-store.test.cjs \
  tests/local-models.test.cjs
```

Ergebnis: 81 Tests, 81 bestanden, 0 fehlgeschlagen.

Ein vorangegangener direkter `node --test`-Aufruf ohne den projektspezifischen
`tests/register.cjs`-Loader scheiterte bei zwei TypeScript-Imports. Das war eine
falsche Testinvokation und kein Produktfehler. Derselbe Testsatz besteht mit dem
in `package.json` festgelegten Loader vollständig.

### Vorhandener installierter Kandidat

Als historischer Paketnachweis wurde der zuletzt installierte Kandidat
`/Applications/Klartext Alpha 1.0 Candidate 3.app` nur gelesen. Er wurde am
22. September 2026 um 19:22 Uhr geschrieben und meldet Version
`1.0.0-alpha.1` sowie Bundle-ID `app.klartext.desktop.alpha`.

Nachweise:

- `codesign --verify --deep --strict` besteht.
- Die Signatur ist ausdrücklich `adhoc`, ohne `TeamIdentifier`.
- `spctl --assess` akzeptiert das Paket nicht als regulär vertrauenswürdigen
  Distributionsbuild.
- `NSAllowsArbitraryLoads` ist `false`.
- Die Mikrofonbeschreibung ist vorhanden; generische Kamera- und
  Bluetooth-Beschreibungen fehlen.
- Das ASAR enthält 47 bekannte Laufzeitdateien und keinen `node_modules`-Pfad.
- Ausgelesene Fuses: `RunAsNode`, `NODE_OPTIONS` und CLI-Inspect aus;
  ASAR-Integritätsprüfung und `OnlyLoadAppFromAsar` an; `WasmTrapHandlers` an;
  `GrantFileProtocolExtraPrivileges` an. Cookie-Verschlüsselung ist im internen
  Alpha erwartungsgemäß aus.

Dieser Kandidat ist kein Nachweis für den aktuellen Nivune-Stand. Seit seinem Bau
wurden Name, Bundle-ID, Paketmetadaten und weitere Quelldateien geändert.

### Lokaler Modellpfad

Die aktuelle Runtime-Migration wählt ein bestehendes altes Profil weiter, falls
der neue Nivune-Profilpfad noch nicht existiert. Auf diesem Rechner ist deshalb
der tatsächlich relevante Produktionspfad weiterhin:

```text
/Users/jakobmeyer/Library/Application Support/klartext-desktop
```

Der Modellcache liegt unter:

```text
/Users/jakobmeyer/Library/Application Support/klartext-desktop/Service Worker/CacheStorage
```

Read-only geprüft:

- Gesamtprofil: 875 MB
- CacheStorage: 783 MB
- mehrere große Modellobjekte bis rund 353 MB sind vorhanden
- persönliche Wake-Modelle liegen mit Dateirechten `0600` vor
- ein separates produktives Nivune-Profil existiert noch nicht

Der Code legt neue Downloads auf zwei feste Modell-IDs und unveränderliche
40-stellige Git-Revisionen fest: `shared/local-models.ts:18-37`. Ein Download
beginnt nur nach sichtbarer Nutzeraktion; bereits vorbereitete Modelle werden mit
`local_files_only` geladen: `desktop/pill.html:89-168` und
`desktop/pill.html:183-210`.

## Bereits geschlossen oder im aktuellen Stand sicher umgesetzt

### Renderer und Fenster

Status: geschlossen.

Alle acht lokalen Fenster beziehungsweise Views setzen ausdrücklich
`contextIsolation: true`, `nodeIntegration: false` und `sandbox: true`.
`setWindowOpenHandler` lehnt neue Fenster ab und `will-navigate` verhindert
Navigation. Belege stehen unter anderem in `desktop/main.js:156-167`,
`desktop/main.js:400-440`, `desktop/main.js:887-907`,
`desktop/main.js:992-1007`, `desktop/main.js:1210-1242`,
`desktop/main.js:1688-1719`, `desktop/main.js:2092-2110` und
`desktop/main.js:2128-2154`.

### Medienberechtigungen

Status: geschlossen.

`desktop/media-permissions.js:17-34` erlaubt nur:

- die Berechtigung `media`
- bekannte WebContents aus einer expliziten Liste
- den Main Frame
- lokale `file:`-Origins ohne Host
- mindestens einen angeforderten Medientyp
- ausschließlich `audio`

Fremde Origins, Subframes, Video, unbekannte Typen und leere Typen werden
abgelehnt. Die Session verwendet einen zentralen Handler, damit Fenster sich die
Berechtigungsregeln nicht gegenseitig überschreiben.

### Zugangsdaten

Status: geschlossen.

API-Schlüssel werden im Key-Fenster auf 4.096 Zeichen begrenzt und nur bei
verfügbarer Betriebssystemverschlüsselung gespeichert:
`desktop/main.js:914-931`. Die verschlüsselten Werte liegen getrennt in
`credentials.json` mit Modus `0600`: `desktop/settings-store.js:7-25`.
Snapshots geben nur boolesche Vorhandenseinswerte an Renderer weiter:
`desktop/main.js:938-981`. Einstellungsexporte enthalten keine Credentials und
Importe deaktivieren Netzwerkprofile sowie Sprachaktivierung:
`desktop/settings-store.js:150-186` und `desktop/main.js:1840-1895`.

Ein Repository-Scan fand keine realen OpenAI-, Groq-, AWS- oder privaten
Schlüssel. Gefundene Schlüsselwerte in Tests sind klar als Testdaten markiert.

### Datei- und Eingabegrenzen im Arbeitsbereich

Status: geschlossen.

- Cloud-Audio: maximal 24 MB
- lokales Audio: maximal 100 MB
- Queue: maximal 12 Aufträge
- Aufnahmefragment: maximal 16 MB
- gesamte fragmentierte Arbeitsaufnahme: maximal 250 MB auf Platte, vor der
  Verarbeitung zusätzlich auf das Anbieterlimit begrenzt
- maximal 10.000 Fragmente
- Einstellungsimport: maximal 1 MB über einen bereits geöffneten Dateihandle
- Verlaufstext: maximal 1.000.000 Zeichen
- Wake-Modell: maximal 5 MB, Base64-Format und Mindestgröße geprüft
- lokale Aufnahme-IDs: feste Zeichenklasse, kein Pfadtraversal

Belege: `desktop/workspace-jobs.js:3-49`,
`desktop/workspace-recordings.js:4-18`,
`desktop/workspace-recordings.js:156-183`, `desktop/main.js:1852-1880`,
`desktop/main.js:1961-2007`, `desktop/main.js:2017-2069` und
`desktop/wake-runtime.js:10-22`.

### Lokale Speicherung und Löschung

Status: geschlossen.

Verlauf, Einstellungen, Onboarding und Audiofragmente werden atomar über
`.next`-Dateien geschrieben. Sensible Dateien verwenden `0600`, Audioordner
`0700`. Fragmentnamen und IDs werden aus geprüften Werten erzeugt. Audiofragmente
erhalten SHA-256-Prüfsummen und werden vor Wiederverarbeitung erneut geprüft:
`desktop/workspace-recordings.js:80-115` und
`desktop/workspace-recordings.js:156-203`.

"Gesamten Verlauf löschen" entfernt inzwischen auch Recovery- und ausstehende
`.next`-Dateien: `desktop/workspace-store.js:144-173`. Dauerhaftes Behalten von
Audio ist standardmäßig aus und benötigt eine ausdrückliche Nutzerwahl.

### Netzwerkziele

Status: geschlossen.

Kompatible Remote-Ziele benötigen HTTPS. HTTP ist nur für die literalen
Loopback-Hosts `localhost`, `127.0.0.1` und `::1` erlaubt. URL-Credentials,
Querystrings und Fragmente werden verworfen. Anbieteranfragen folgen keinen
Redirects. Ollama ist ausschließlich auf Loopback begrenzt. Belege:
`desktop/settings-contract.js:15-35`,
`shared/cloud-transcription-providers.ts:143-185`,
`shared/local-endpoints.ts:1-20` und `shared/provider-models.ts:36-66`.

### Fuses und Paketinhalt

Status: im Quellstand geschlossen, finaler Artefaktnachweis noch offen.

`desktop/adhoc-sign.js:9-35` setzt alle neun Electron-43-Fuses mit
`strictlyRequireAllFuses: true`. Node- und Debug-Einstiege sind deaktiviert;
ASAR-Integrität und ausschließliches Laden aus ASAR sind aktiviert. Das
Produktionspaket aktiviert Cookie-Verschlüsselung. Nur das klar gekennzeichnete
interne Alpha deaktiviert sie zur Vermeidung wiederholter Keychain-Dialoge bei
wechselnder Ad-hoc-Signatur.

## Offene Befunde

### NVD-01 Hoch: Öffentliche Pakete sind nicht authentisch signiert oder notarisiert

Status: offen und als Release-Gate zurückgestellt.

Beleg:

- `desktop/package.json:23-26` verwendet weiter `adhoc-sign.js`.
- `desktop/adhoc-sign.js:38-53` signiert macOS mit `codesign --sign -`.
- Es gibt keine Developer-ID-, Notarisierungs-, Hardened-Runtime- oder
  Entitlements-Konfiguration.
- Die Windows-Konfiguration enthält keine Herausgebersignatur:
  `desktop/package.json:140-159`.
- `docs/BUILDING.md:56-60` kennzeichnet beide Pakete ausdrücklich nur als
  Testkandidaten.
- Der vorhandene Candidate 3 hat `Signature=adhoc`, keinen `TeamIdentifier` und
  besteht die reguläre Gatekeeper-Bewertung nicht.

Auswirkung:

Prüfsummen und ASAR-Integrität schützen gegen bestimmte lokale Änderungen, belegen
aber keine Herausgeberidentität. Ein öffentlicher Download kann nicht verlässlich
Jakob Meyer beziehungsweise dem offiziellen Projekt zugeordnet werden. macOS- und
Windows-Nutzer erhalten Warnungen oder müssen Schutzmechanismen umgehen.

Erforderlich vor öffentlichem 1.0-Download:

1. macOS mit Developer ID signieren, Hardened Runtime aktivieren und passende
   Entitlements festlegen.
2. Notarisieren, Ticket stapeln und auf einem frischen System mit `spctl` prüfen.
3. Windows x64 mit einem vertrauenswürdigen Code-Signing-Zertifikat signieren und
   die Signatur auf einem frischen Windows-System prüfen.
4. Commit, Artefakt-SHA-256, Signaturidentität und Notarisierungsnachweis im
   Buildmanifest festhalten.

Open-Source-Veröffentlichung des Quellcodes kann unabhängig davon erfolgen. Der
Blocker betrifft als vertrauenswürdig beworbene, öffentliche Binärdownloads.

### NVD-02 Mittel: Systemdiktat besitzt vor dem IPC-Transfer kein hartes Aufnahmebudget

Status: offen, vor 1.0 sinnvoll zu beheben.

Beleg:

- `desktop/pill.html:253-273` sammelt die komplette 16-kHz-PCM-Aufnahme in
  `pcmChunks` im Renderer-RAM.
- Es gibt ein Stilleende, aber keine maximale Dauer, Samplezahl oder Bytegrenze:
  `desktop/pill.html:386-455`.
- Beim Stoppen wird die komplette Aufnahme zusammengefügt, als WAV kodiert und per
  IPC übertragen: `desktop/pill.html:473-515`.
- `ipcMain.on("result")` prüft Sender und Verarbeitungszustand, aber nicht Typ oder
  Größe von `payload.audio` beziehungsweise `payload.text`, bevor die Daten an den
  Verarbeitungskern gehen: `desktop/main.js:747-768`.
- Der Cloud-Adapter lehnt mehr als 24 MB später ab. Zu diesem Zeitpunkt wurden PCM,
  WAV, IPC-Kopie und Blob jedoch bereits angelegt.

Auswirkung:

Eine sehr lange durchgehende Aufnahme kann Speicher unnötig wachsen lassen und
endet anschließend nur mit einer Fehlermeldung. Bei einem kompromittierten
sandboxed Audio-Renderer fehlt Main außerdem eine frühe Größenvalidierung an der
IPC-Vertrauensgrenze. Das ist primär ein lokales Verfügbarkeitsproblem, kein
nachgewiesener Remote-Angriff.

Empfohlene Korrektur:

- Renderer-seitig ein festes Sample- und Bytebudget sowie eine sichtbare maximale
  Dauer einführen.
- Main-seitig vor `runProcessingJob` nur `ArrayBuffer` oder TypedArray akzeptieren
  und das zum gewählten Anbieter passende Limit prüfen.
- lokalen Text am IPC-Eingang auf `MAX_TEXT_LENGTH` begrenzen.
- Grenztests für exakt erlaubte Größe, ein Byte darüber und kompromittierte
  Payload-Typen ergänzen.
- Lange Aufnahmen weiterhin über den bereits fragmentiert und diskbasiert
  arbeitenden Arbeitsbereich führen.

### NVD-03 Mittel: Audio-Renderer darf zu beliebigen HTTPS-Zielen verbinden

Status: offen, Defense-in-Depth-Härtung.

Beleg:

- `desktop/pill.html:5` setzt `connect-src 'self' https:` und erlaubt damit jedes
  HTTPS-Ziel.
- Dieselbe Seite verarbeitet Mikrofon-Audio, lädt Modelle und besitzt die
  umfangreichste IPC-Brücke.
- `script-src` und `style-src` benötigen dort derzeit `unsafe-inline`, weil die
  komplette Rendererlogik und styles inline stehen: `desktop/pill.html:7-20` und
  `desktop/pill.html:36-537`.
- Navigation ist gesperrt und alle aktuell sichtbaren Transkripte werden über
  `textContent` eingesetzt. In der Prüfung wurde kein konkreter XSS-Einstieg
  gefunden.

Auswirkung:

Es existiert aktuell kein nachgewiesener Exploit. Falls später eine
Markup-/Skript-Injektion in diesen Renderer gelangt, schränkt die CSP weder das
Ausführen eines Inline-Payloads noch dessen HTTPS-Ziel ausreichend ein. Wegen der
Mikrofonrolle des Renderers ist die Auswirkung höher als bei einer rein statischen
Oberfläche.

Empfohlene Korrektur:

- Inline-Skript und Inline-Styles in lokale Dateien auslagern.
- `unsafe-inline` entfernen.
- Modellnetzwerk auf die tatsächlich von Hugging Face verwendeten Hosts begrenzen
  oder Downloads über einen Main-Prozess-Broker mit fester Modellliste führen.
- Der Broker sollte Redirect-Ziele, kumulierte Bytes und optional Dateidigests
  prüfen.
- Danach Download, WebGPU, WASM, Abbruch, Offline-Neustart und Modelllöschung real
  regressionsprüfen.

### NVD-04 Mittel: Für den aktuellen Nivune-Stand fehlt ein frischer Artefaktnachweis

Status: offenes Release-Verifikationsgate, keine Quellcode-Schwachstelle.

Beleg:

- Unter `desktop/dist-alpha` und `/Applications` liegt nur ein Paket mit altem
  Klartext-Namen.
- Candidate 3 verwendet `app.klartext.desktop.alpha` und alte Produktstrings.
- Der aktuelle Quellstand verwendet `app.nivune.desktop`, `Nivune` und geänderte
  Laufzeitdateien: `desktop/package.json:21-26`.
- Die Arbeitskopie ist absichtlich umfangreich und uncommitted. Ein altes ASAR
  kann daher den aktuellen Stand nicht bytegenau repräsentieren.

Erforderlicher Nachweis vor 1.0:

1. Aus einem festgelegten Commit und beiden Lockfiles frisch installieren.
2. Nivune für macOS arm64 und Windows x64 auf dem jeweiligen Zielsystem bauen.
3. ASAR-Inventar, Lizenzressourcen, Bundle-ID, Versionsnummer, ATS und Fuses lesen.
4. Strikte Codesign-Prüfung, Notarisierung beziehungsweise Windows-Signatur prüfen.
5. Haupt-, Settings-, Workspace- und Onboarding-Smoke aus isolierten Profilen
   ausführen.
6. Mikrofon, Shortcut, Zwischenablage, automatisches Einfügen, Wake-Word und beide
   lokalen Modelle real prüfen.
7. Buildmanifest und SHA-256 aus dem finalen Artefakt erzeugen.

### NVD-05 Niedrig: Legacy-Cache kann den Revisions-Pin für bestehende Profile umgehen

Status: bewusst kompatibel, Integritätshärtung empfohlen.

Beleg:

- Neue Downloads verwenden feste Revisionen:
  `shared/local-models.ts:18-37`.
- `revisionAwareModelCache` beantwortet eine Anfrage an die feste Revision aber
  ersatzweise mit einem vorhandenen Cacheeintrag unter `resolve/main`:
  `shared/local-models.ts:63-88`.
- Die Readiness-Prüfung bewertet Dateinamen und benötigte Dateipaare, nicht
  Dateigrößen oder Digests: `shared/local-models.ts:91-110`.
- Der aktuell genutzte 783-MB-Cache stammt aus dem alten Klartext-Profil und wird
  vom Nivune-Migrationspfad absichtlich weiterverwendet:
  `desktop/runtime.js:21-35`.

Auswirkung:

Neue Installationen bleiben auf unveränderliche Revisionen festgelegt. Bei
bestehenden Profilen kann jedoch ein früher unter `main` heruntergeladener Stand
als Antwort für die heutige feste Revision dienen. Das erhält Offlinefähigkeit,
ist aber kein bytegenauer Nachweis, dass Alt- und Zielrevision identisch sind.

Empfohlene Korrektur:

- erwartete Modellartefakte mit Dateigröße und SHA-256 in einem versionierten
  Manifest festhalten,
- alte `main`-Einträge nur bei passendem Digest übernehmen,
- nicht passende Altstände als `partial` markieren und nach Bestätigung neu laden,
- Cache-Status und Downloadfortschritt um ein kumuliertes Größenbudget ergänzen.

### NVD-06 Niedrig: Die gemeinsame Preload-Brücke ist breiter als einzelne Fenster benötigen

Status: offen, Defense-in-Depth.

Beleg:

- `desktop/preload.js:3-25` exponiert Aufnahme-, Modell-, Credential- und
  Wake-Setup-Funktionen gemeinsam.
- Diese Preload-Datei wird von Pill, Onboarding-Audio, Key-Fenster und
  Wake-Setup-Fenster verwendet.
- Die Main-Handler prüfen die konkrete WebContents-Identität, zum Beispiel
  `desktop/main.js:914-934`, `desktop/main.js:2249-2272` und
  `desktop/main.js:2356-2429`. Dadurch ist die zusätzliche Brücke derzeit nicht
  direkt privilegienwirksam.
- Einige Event-Handler prüfen nur `event.sender`, während Settings, Onboarding und
  Workspace zusätzlich `event.senderFrame === mainFrame` verlangen.

Auswirkung:

Der Main-Prozess verhindert aktuell eine Nutzung aus dem falschen Fenster. Kleine,
fensterspezifische Preloads würden die Rendereroberfläche trotzdem klarer
minimieren und zukünftige Fehlkonfigurationen weniger folgenschwer machen.

Empfohlene Korrektur:

- getrennte Preloads für Pill, API-Key und Wake-Setup verwenden,
- für privilegierte IPC-Ereignisse einheitlich Sender und Main Frame prüfen,
- Payload-Schemata an jeder Main-Grenze zentral validieren.

## Release-Empfehlung

Der Desktop-Quellstand ist für die weitere 1.0-Finalisierung geeignet. Er sollte
noch nicht als vertrauenswürdig signierter öffentlicher Binärdownload bezeichnet
werden.

Sinnvolle Reihenfolge:

1. NVD-02 schließen, weil es eine echte Laufzeit- und IPC-Grenze betrifft.
2. NVD-03 soweit ohne Modellregression möglich schließen.
3. Finalen Nivune-Kandidaten bauen und NVD-04 vollständig abnehmen.
4. NVD-01 mit echten Signaturidentitäten und Notarisierung schließen.
5. NVD-05 und NVD-06 spätestens im ersten Härtungsnachlauf bearbeiten, sofern sie
   nicht mehr risikolos in 1.0 passen.

Wenn zunächst nur der MIT-lizenzierte Quellcode veröffentlicht wird und keine
offiziellen Binärdownloads angeboten werden, kann NVD-01 getrennt nachgezogen
werden. Sobald DMG oder Windows-Installer als offizieller Download erscheinen,
ist NVD-01 ein hartes Release-Gate.
