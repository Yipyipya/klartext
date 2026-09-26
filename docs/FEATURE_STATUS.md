# Nivune: Funktionsstand und Aussagen für den Launch

Stand: 23. September 2026. Öffentlicher Ausgangspunkt: 0.3.0.
Maßgebliche Liste für Landingpage, README, Release-Notizen und Marketing-Video.
Ein Plan oder ein fertiger Codepfad ist noch kein veröffentlichtes Feature.
Die geplante zeitliche Zuordnung steht in [VERSION_ROADMAP.md](VERSION_ROADMAP.md):
1.0 ist das Launchziel, spätere Ausbaustufen sind getrennt beschrieben.

## Statusregeln

- **Veröffentlicht:** Im Release enthalten. Die Spalte Prüfung nennt dessen
  tatsächliche Abnahme; frühere Tests gelten nicht als neuer Praxistest.
- **Teilweise:** Nur einzelne Wege vorhanden oder ein wesentlicher Nachweis fehlt.
- **In Arbeit:** Implementierung begonnen; nicht als verfügbar bewerben.
- **Implementiert, unveröffentlicht:** Codepfad fertig, aber die für eine öffentliche
  Aussage nötige reale Plattform-/Nutzerabnahme oder Veröffentlichung fehlt noch.
- **Automatisiert geprüft:** Tests/Build bestätigen den beschriebenen Codepfad;
  dies ersetzt keine echte Mikrofon-, Offline-, Upgrade- oder Plattformabnahme.
- **Geplant:** Nicht implementiert; ausschließlich als Ausblick kennzeichnen.
- **Geprüft, unveröffentlicht:** Abnahme erfolgt, jedoch noch kein öffentlicher
  Download/Live-Stand. Für das Launch-Video erst nach Veröffentlichung verfügbar.

Pro Feature werden Plattform, Release, Nachweis und zulässige Aussage aktualisiert.
»Verfügbar« darf nur die tatsächlich veröffentlichte Plattform/Variante bezeichnen.
Der öffentliche Stand bleibt unverändert 0.3.0. Auf dem Entwicklungsbranch
`develop/v1-core` sind die M1-Grundlage und M2 technisch implementiert und
geprüft, aber weder als Beta noch als Release veröffentlicht.

Stand 23. September 2026, Kandidat **1.0.0-beta.1** (unveröffentlicht): Web- und
Desktop-Live-Diktate enden nach zehn Minuten, der Desktop prüft Audio-/Text-
Payloads im Main-Prozess. Neu hinzugekommen sind manuelle Updateprüfung (F28),
optionale dauerhafte Web-Key-Speicherung (F33), CORS-Hilfe (F34) sowie Website
DE/EN mit Arbeitsbereich unter `/app` (F31, F35). 194 Tests, TypeScript,
Produktionsbuild, Desktop-Bundles und vier npm-Audits (0 Befunde) sind grün.
Mac-DMG, Alpha-Paket und Windows-Installer wurden aus diesem Stand gebaut; beide
Mac-Pakete bestanden vier Renderer-Smokes, Offline-Modellstart, strikte
Ad-hoc-Signaturprüfung, ATS, Fuses, ASAR- und Lizenzinventar. Was noch deine
Mitwirkung braucht, steht in [RELEASE_1.0_CHECKLIST.md](RELEASE_1.0_CHECKLIST.md).

## Tatsächlicher Stand

| ID | Funktion | Plattform und Stand | Prüfung / Grenze | Zulässige Aussage heute |
| --- | --- | --- | --- | --- |
| F01 | Resonanz-Oberfläche, Hell/Dunkel, Einstellungen | Web/Mac/Windows, veröffentlicht 0.3.0 | Web/Mobil und Mac-Fenster visuell geprüft; Windows nur gebaut/Paketinhalt geprüft | Neue Oberfläche und eigene Desktop-Einstellungen verfügbar |
| F02 | Mikrofon-Diktat | Web/Mac/Windows, veröffentlicht 0.3.0 | Frühere echte Web-/Mac-Aufnahmen dokumentiert; kein neuer 0.3.0-Audio-E2E-Test, Windows-Abnahme offen | Diktierfunktion vorhanden; keine Behauptung fehlerfreier Erkennung |
| F03 | Globaler Shortcut und Einfügen am Cursor | Mac/Windows, veröffentlicht 0.3.0 | Frühere Mac-Prüfungen; **interne Alpha real bestanden:** alternativer globaler Shortcut, Aufnahme, Transkription und Zwischenablage-Fallback funktionierten. Nach separater Bedienungshilfenfreigabe für `Klartext Alpha` wurde der Text automatisch in die zuvor aktive Ziel-App eingefügt. **Unveröffentlichter 1.0-Stand:** Zentraler Mikrofon-Handler, Fokusübergabe und WebGPU-CSP-Freigabe sind implementiert. Systemdiktat aus Arbeitsbereich und per Shortcut, lokale Transkription, Zwischenablage und automatisches Einfügen wurden nach Neustart vom Nutzer real bestätigt; 162 Tests/Builds grün. Windows-Praxistest offen | Systemweites Desktop-Diktat, Einfügen abhängig von getrennten OS-Freigaben |
| F04 | OpenAI mit eigenem Key | Web/Mac/Windows, veröffentlicht 0.3.0 | Anbieter und Modelle fest eingebaut | Eigener OpenAI-Key; mögliche Anbietergebühren |
| F05 | Optionale KI-Textüberarbeitung | Web/Desktop, veröffentlicht 0.3.0 | OpenAI gebunden; kein neuer Realtest mit 0.3.0 | Textüberarbeitung vorhanden, noch keine freie Anbieterwahl |
| F06 | Audiodatei-Import | Web, veröffentlicht 0.3.0 | Frühere WAV-/MP3-Realtests und aktuelle Regressionstests; Größen-/Formatgrenzen dokumentiert | Audiodateien im Browser transkribieren |
| F07 | Bearbeitbarer Text, Original und Verlauf | Web, veröffentlicht 0.3.0 | UI und Logik geprüft; Speicherung im jeweiligen Browser | Ergebnisse im Browser bearbeiten und im lokalen Verlauf wiederfinden |
| F08 | Kontext und persönliches Wörterbuch | Web; Desktop nur teilweise, veröffentlicht 0.3.0 | Desktop-Kontext vorhanden; keine vollständige gemeinsame Wörterbuchverwaltung; persönliche Vorgaben eingebaut | Web-Wörterbuch und Nutzungskontext verfügbar, keine plattformweite Gleichheit behaupten |
| F09 | Lokale Whisper-Transkription | Desktop-Diktat/Web-Dateien, teilweise 0.3.0 | Modelle werden geladen; Offline-Neustart nicht vollständig nachgewiesen, Desktop-CDN-Abhängigkeit | Lokale Verarbeitung auf diesen Wegen vorgesehen; noch kein allgemeines Offline-Versprechen |
| F10 | »Lokalmodus« beim Web-Diktat | Web, teilweise 0.3.0 | Browser Speech API kann externe Erkennung nutzen | Nicht als geräteintern oder offline bewerben |
| F11 | Persönlicher Sprachstart | Desktop mit »Hey Klartext« veröffentlicht 0.3.0; frei wählbare Phrase im 1.0-Entwicklungsstand | Frühere Mac-Realtests für »Hey Klartext«; frei wählbare Phrase automatisiert und im echten Renderer geprüft, akustische Nutzerprobe sowie Windows offen; muss eingerichtet/aktiviert sein | Veröffentlicht: optionaler lokal eingelernter Sprachstart »Hey Klartext«; freie Phrase noch nicht als verfügbar bewerben |
| F12 | Stille-Autostopp | Desktop, veröffentlicht 0.3.0 | Neun Sekunden nach bestätigter Sprache; frühere Mac-Prüfung und Regressionstests | Automatisches Ende nach Sprechpause; kein frei konfigurierter Sprach-Endbefehl |
| F13 | Autostart | Desktop, veröffentlicht 0.3.0 | OS-Abhängigkeiten; echter Anmeldetest noch offen | Autostart einstellbar, abhängig von Systemfreigabe |
| F14 | Auswahl gesprochener Sprache | Web/Desktop, veröffentlicht 0.3.0 | Web mehr Auswahl als Desktop; keine vollständige englische Oberfläche | Unterschiedliche Erkennungssprachen wählbar; keine vollständige App-Lokalisierung behaupten |
| F15 | Kostenlos und ohne Klartext-Konto | Web/Desktop, veröffentlicht 0.3.0 | Cloud-Anbieter können Gebühren verlangen | App kostenlos, eigene API-Nutzung gegebenenfalls kostenpflichtig |
| F16 | Öffentlich zugänglicher Quellcode | GitHub, veröffentlicht | Eigene Projektlizenz fehlt noch | Quellcode einsehbar; noch nicht als fertig lizenzierte Open-Source-Veröffentlichung vermarkten |
| F17 | Installer | Mac Apple Silicon/Windows x64, veröffentlicht 0.3.0 | Größen, SHA-256, Mac-Signatur und Mac-Smoke-Test geprüft; nur ad-hoc Mac, Windows ohne vertrauenswürdiges Zertifikat | Downloads vorhanden; keine Apple-Notarisierung oder warnungsfreie Installation behaupten |

Nachweise: [Projektstatus](../STATUS.md), [Release 0.3.0](RELEASE_0.3.0.md),
[Paketprüfsummen](../desktop/RELEASE_CHECKSUMS.md),
[Transkriptionsarchitektur](TRANSCRIPTION_ARCHITECTURE.md) und
[Offline-Betrieb](OFFLINE_OPERATION.md).
Dies ist eine Zusammenführung der dokumentierten Prüfungen, kein neu durchgeführter
vollständiger Funktionstest vom 13. September.

## Nächster Launch-Kandidat und unveröffentlichter Entwicklungsstand

Keine folgende Zeile besitzt eine Release- oder Marketingfreigabe. »Implementiert«
bezeichnet ausschließlich den Entwicklungsbranch. Die genaue nächste
Versionsnummer wird beim Release gesetzt.

| ID | Erweiterung | Priorität für den nächsten Kandidaten | Nachweis vor »verfügbar« |
| --- | --- | --- | --- |
| F18 | Gemeinsamer Kern, sichere Migration, neutrale Voreinstellungen | **Implementiert, unveröffentlicht:** Web-Diktat, Web-Dateien und Desktop-Ergebnisse nutzen den gemeinsamen Kern; Provider-Fähigkeitsverträge, gemeinsame OpenAI-/Ollama-Adapter und Schema 1 für Web/Desktop sind implementiert | **Automatisiert geprüft:** alte Web-/Desktop-Werte, Key und persönliche Wörterbuchregel bleiben erhalten; Backups, beschädigte Profile, getrennte Secrets, Idempotenz, neutrale Neuprofile und sichere Ollama-Werte; gemeinsam genutzte Provideraufrufe sind gegen erneute Desktop-Duplikation abgesichert; insgesamt 145 Tests, TypeScript, Web-Build sowie Electron-Einstellungs-Smoke grün. Reales Upgrade eines produktiven Profils offen |
| F19 | Tatsächlich lokales Diktat und Offline-Neustart | **Implementiert, unveröffentlicht; teilweise real abgenommen:** Web-Diktat nimmt Audio auf und transkribiert es im lokalen Whisper-Worker statt über Browser Speech; Desktop bündelt transformers.js und ONNX-WASM statt CDN-Import. Web/Desktop haben einen sichtbaren Modellmanager; fehlende Modelle lösen keinen stillen Download aus. Web besitzt eine begrenzte Offline-App-Hülle und Speicherdiagnose; Desktop prüft lokale Runtime-Dateien vor dem Start | **Automatisiert geprüft:** MediaRecorder ohne Browser-Fallback, Stereo→Mono-PCM, Worker-Routing, Modell-Pins, Cachezustände, Download/Abbruch/Löschung, sensible Cache-Ausschlüsse, Speicherdiagnose, Runtime-Dateien und Electron-Smokes. **Real geprüft:** drei lokale Web-Transkriptionen einschließlich Offline-Neustart; auf dem Mac lokales `whisper-small` direkt netzwerkfrei aus dem Cache initialisiert und anschließend Systemdiktat sowie Arbeitsbereich-Aufnahme vom Nutzer bestanden. Browserweite Netztrennung mit echtem Mikrofon und Windows bleiben offen |
| F20 | Getrennte Modellwahl für Transkription und Überarbeitung | **Implementiert, unveröffentlicht; Abnahme offen:** Web und Desktop wählen Transkription und Überarbeitung unabhängig. Überarbeitung: aus, lokale Regeln, OpenAI, eigener kompatibler Textserver oder lokales Ollama; Zieladresse, Modell-ID und Zugang sind getrennt. Lokal + Ollama erzeugt keine Cloud-Stufe. Unsichere Modellantworten werden verworfen | **Automatisiert geprüft:** 145 Tests inklusive auftragsfester kompatibler Textprofile, Plan ohne OpenAI-/Credential-Verweis, abgeschaltetem Refiner, Kontext/Wörterbuch, semantischer Sicherung, sicherer Migration, HTTPS/Loopback und keinen Redirects. **Real geprüft:** Ollama 0.34.0, Browser-CORS/Modellliste und zwei Metal-beschleunigte `qwen3:0.6b`-Läufe. Beide Modellantworten waren inhaltlich unsicher und wurden korrekt zugunsten des Rohtexts verworfen. Geeignetes Produktionsmodell, echter kompatibler Textserver, Langtext sowie Mac-/Windows-End-to-End bleiben offen |
| F21 | Weitere Anbieter und eigene kompatible Server | **Teilweise implementiert, unveröffentlicht:** lokales Ollama ist integriert. Web und Desktop können für Qualitätsdiktate OpenAI, Groq oder einen eigenen OpenAI-kompatiblen Audio-Endpunkt ausdrücklich wählen. Web-Diktat und Dateiimport behalten dieses Profil; Desktop-Diktate lösen es über getrennte OS-verschlüsselte Keys auf. Für die Textüberarbeitung ist ein eigener kompatibler Server in Web und Desktop mit separater Adresse, Modell-ID und optionalem Key wählbar. OpenAI bleibt Standard, unvollständige Profile werden vor Aufnahme gestoppt. Deepgram bleibt gemäß Roadmap bis 1.1 ohne UI | **Automatisiert geprüft:** 145 Tests für getrennte Audio-/Textverträge, zielgebundene Web-/Desktop-Credential-Speicherfilter, Profilmigration, Modelllisten, Web-/Desktop-Diktat- und Datei-Routing, kompatibles Refinement-Routing, Authentifizierung, Sprache, Kontext/Wörterbuch, Langtext, Fehler und sichere Basisadressen; echte Loopback-HTTP-Smokes für Audio und Text. **Oberfläche geprüft:** Web- und echtes Electron-Fenster mit Audio- und Textanbieterfeldern visuell und über Accessibility. **Nicht real geprüft:** Groq-/Fremdserver, Browser-CORS und Modellqualität mangels freigegebener Zugänge; neuer Desktop-Dateiimport noch ohne reale End-to-End-Abnahme. Ollama-Lauf belegt, `qwen3:0.6b` qualitativ nicht bestanden |
| F22 | Native Deepgram-, Claude- und Gemini-Adapter | Nach dem ersten vollständigen Kernpfad | Eigene Tests/Zugangsdaten; beim Launch fehlende Adapter ausdrücklich als geplant führen |
| F23 | Desktop-Aufnahmefenster, Pause/Fortsetzen, Dateiimport | **K20/K22 implementiert, unveröffentlicht; Abnahme offen:** Der Resonanz-Arbeitsbereich nimmt genau eine Mikrofonaufnahme mit Pause/Fortsetzen auf, importiert eine nativ ausgewählte Audiodatei nach Typ-/Signatur-/Größenprüfung und verarbeitet Aufnahme- sowie Datei-Aufträge seriell. Aufnahmen werden progressiv in lokalen Fragmenten gesichert. Nach Neustart ist eine bewusste Recovery möglich; unsichere Cloud-Retries brauchen Bestätigung und vorhandener Rohtext verhindert eine zweite Transkription. Audio wird nach Erfolg standardmäßig gelöscht und nur per sichtbarer Einstellung behalten | **Automatisiert geprüft:** 145 Tests einschließlich Zustandsautomat, Pause/Fortsetzen, Dateigrenzen, simulierter 30-Minuten-Fragmentfolge, atomarer Reihenfolge, Prüfsummen, Neustart-Recovery, Retry-Sicherheit, Löschung und Renderer-Redaktion; TypeScript, Web-Build, Desktop-Bundles und isolierter Electron-Smoke grün. **Oberfläche geprüft:** Aufnahme-Recovery, Kostenwarnung, Speicherregel und Audioaufbewahrung im echten Electron-Fenster visuell/Accessibility. Echte 30-Minuten-Aufnahme, Prozessabbruch/Recovery, K20-Datei-E2E und Windows bleiben offen |
| F24 | Desktop-Verlauf, Original, Bearbeiten, TXT/Markdown-Export | **K21/K22 implementiert, unveröffentlicht; reale Abnahme offen:** Workspace-Ergebnisse werden atomar mit Rohtext, Ergebnis, Warnung und redigierten Auftragsmetadaten lokal gespeichert. Bearbeitung, lokale Suche, TXT-/Markdown-Export und einzelne/gesamte Löschung sind verfügbar. Einstellungen lassen sich ohne Keys übertragen. Erfolgreiches Aufnahmeaudio bleibt nur nach ausdrücklicher Aufbewahrung bestehen, wird im Verlauf gekennzeichnet und kann getrennt vom Text gelöscht werden | **Automatisiert geprüft:** Speicherung/Reload/Recovery, Suchtreffer, Teilergebnis, Exporte, Löschung, Key-Ausschluss, deaktivierte Importziele und Audio-Lebenszyklus in insgesamt 145 Tests; Build, Bundles und Electron-Smoke grün. **Oberfläche geprüft:** echter Electron-Renderer mit Beispielverlauf, Warnung, Audio-Kennzeichnung und Löschaktion visuell/Accessibility. Echte Persistenz/Dateiexporte nach K20-E2E und Windows-Dialoge bleiben offen |
| F25 | Vollständig deutsche und englische Oberfläche | **K24 implementiert und im Entwicklungsstand nutzergeprüft, unveröffentlicht:** Oberflächen- und gesprochene Sprache werden in Web/Desktop unabhängig gespeichert. Web-Diktat, Dateiimport, Verlauf, Download und alle Einstellungen sowie Desktop-Ersteinrichtung, Einstellungen, Arbeitsbereich, Menüleiste, Aufnahmeblase, Key-/Sprachfenster, Dialoge, Benachrichtigungen und dynamische Zustände wechseln DE/EN. Nutzerinhalte bleiben unverändert | **Automatisiert/UI/real geprüft:** 146 Tests, TypeScript, Next.js-Produktionsbuild, Desktop-Bundles und Syntax grün; sämtliche englischen Web-Bereiche sowie englische Electron-Ersteinrichtung, Einstellungen, Arbeitsbereich und Sprachaktivierung visuell/Accessibility geprüft. Der Nutzer hat den DE/EN-Durchzug im Entwicklungsstand abgenommen; installierter Kandidat und Windows bleiben offen |
| F26 | Einfacher Einstieg, Datenfluss, Export/Löschung | **K23 Desktop implementiert und im Entwicklungsprofil nutzergeprüft, unveröffentlicht:** Vierstufige Desktop-Ersteinrichtung führt von Sprache und ausdrücklichem lokalem/Cloud-Ziel über Modell oder Key zur echten Probeaufnahme. Probentext und Zwischenablage-Fallback sind sichtbar; Autostart und Sprachaktivierung bleiben bis zur bewussten Auswahl aus. Die Probe läuft ohne separates macOS-Fenster innerhalb der Einrichtung; die normale Diktierblase bleibt erhalten | **Automatisiert/UI/real geprüft:** atomarer schlüsselfreier Einrichtungsstand, beschädigte-State-Recovery, erfolgreiche Probe als Abschlussbedingung, enge IPC, Packaging, 145 Tests, vier Electron-Smokes, visuelle/Accessibility-Prüfung aller Schritte und reale Probe in Fenster- sowie Vollbildansicht ohne Fokus-/Space-Wechsel. Installierter Kandidat, Windows und vollständige Web-Ersteinrichtung bleiben offen |
| F27 | Projektlizenz, Name und Self-Hosting-Dokumentation | **Implementiert, unveröffentlicht:** MIT-Lizenz, Drittanbieter-/Rechteinventar, englisches/deutsches README, Contribution-/Security-Dateien, Vorlagen, Adapter-Anleitung, Namensprüfung und Self-Hosting-Dokumentation liegen vor. `Klartext` ist als 1.0-Name gesperrt; `Nivune` wurde vorgeprüft und im Quellstand, in Paketmetadaten, Bundle-IDs, Artefaktnamen und Produkttexten angewendet | **Automatisiert zu prüfen:** Kompatibilität für alte Klartext-Profile/Sprachmodelle besitzt Regressionstests. Rechteinhaberbestätigung, externe Repository-/Webumbenennung, frischer Nivune-Paketnachweis, frisches Checkout nach Anleitung und Windows-Paketkontrolle bleiben offen |
| F28 | Vertrauenswürdige Signierung/Notarisierung, Updateweg | **Interne Alpha separat installiert; K29-Härtung unveröffentlicht:** eigene Bundle-ID, Profil und alternativer Shortcut. Neuer Testbuild ohne ungenutzte Node-Module, mit ASAR-Integrität, deaktivierten Node-/Debug-Einstiegen, vollständigem Electron-43-Fuse-Satz, engeren Renderer-/Mikrofongrenzen und Web-Schutzheadern | K29-Berichte, vier Audits ohne Befund, frische Lockfile-Installationen, strikte Ad-hoc-Signaturprüfung, Fuse-/ASAR-Inventar und vier isolierte Paket-Smokes grün. Reale Mac-Abnahmen von Systemdiktat, Arbeitsbereich, Onboarding und persönlichem »Hey Klartext«-Modell bestanden. Freie Phrase benötigt noch akustische Nutzerprobe; **Updateweg (K28) implementiert:** Versionsanzeige und Updateprüfung nur auf Befehl in Einstellungen und Menü; es wird ausschließlich die offizielle GitHub-API abgefragt (ohne Redirects und Zugangsdaten) und nur eine offizielle Release-Seite geöffnet, nie etwas installiert; 8 Tests und Oberfläche geprüft. Developer-ID, Notarisierung und Windows-Signatur offen |
| F29 | Headless-Kern und kleine CLI für Agenten/Programme | Begrenzte Developer Preview nach Kernpfad | Datei → strukturiertes Ergebnis ohne Electron; Schema/Fehler dokumentiert; Integrationsbeispiel getestet |
| F30 | MCP, SDKs und weitergehende Agentenanbindungen | Folgeausbau | Noch nicht Teil des zugesagten ersten Kandidaten |
| F31 | Landingpage DE/EN | **Implementiert, unveröffentlicht:** Website unter `/` und `/en` mit Download passend zum System, Datenfluss lokal/Cloud, ehrlichen Kosten, Voraussetzungen, Open-Source-Links, FAQ und Datenschutzseite DE/EN. Ohne `NEXT_PUBLIC_SITE_URL` noindex; mit finaler Adresse Canonical, Sprachalternativen, Sitemap und Open-Graph-Bild | **Geprüft:** Produktionsbuild, hell/dunkel, 1280 px und 390 px ohne horizontalen Überlauf, Sprache/noindex-Metadaten, Konsole ohne neue Fehler, Tests für Sitemap/Robots/Textstruktur. Jede Aussage ist in [LANDING_CLAIMS.md](LANDING_CLAIMS.md) einem Nachweis zugeordnet. Echtes Produktvideo, Impressum, Domain und die dort genannten Abnahmen fehlen |
| F32 | Social-Video DE/EN | Nach Feature-Abnahme | Aufnahmen aus finalem Kandidaten; nur veröffentlichte Merkmale als verfügbar zeigen |
| F33 | Web-API-Keys wahlweise dauerhaft im Browser | **Implementiert, unveröffentlicht:** Standard bleibt Sitzungsspeicher. Ein bestätigter Schalter speichert Keys bewusst im lokalen Browserspeicher, mit Hinweis auf fehlende Verschlüsselung; Abschalten entfernt die dauerhafte Kopie | **Automatisiert geprüft:** Sitzung als Standard, Wechsel in beide Richtungen, Neustart, Keys nie im Einstellungsobjekt. Oberfläche visuell geprüft |
| F34 | Hilfe bei Browser-CORS-Grenzen | **Implementiert, unveröffentlicht:** Bei Verbindungsfehlern zu eigenem Server oder Ollama erklärt die Web-App CORS, nennt die konkrete Origin, `OLLAMA_ORIGINS` und die Desktop-App als Alternative. Kein Proxy | **Geprüft:** Produktionsbuild mit nicht laufendem Ollama; Hilfe erscheint, Darstellung hell/dunkel |
| F35 | Arbeitsbereich unter `/app`, Offline-Hülle v2 | **Implementiert, unveröffentlicht:** Web-App zieht nach `/app`; Manifest behält die Identität `/`, startet unter `/app`; installierte Web-Apps werden weitergeleitet, frühere Nutzer sehen auf `/` einen Hinweis. Service Worker cacht nur `/app` | **Geprüft:** Produktionsserver, Cache-Inhalt, danach Server aus: `/app` und alter Startpfad `/` öffnen den gecachten Arbeitsbereich. Echter Upgrade-Pfad einer installierten PWA auf dem Live-Deployment offen |

## Regel für neue Releases und Marketing

1. Nach jeder Umsetzung die Feature-Zeile und Nachweise aktualisieren. Neue
   Funktionen erhalten eine ID; existierende IDs bleiben stabil.
2. Vor dem Release die öffentlich verfügbaren und die nur lokal fertigen Varianten
   unterscheiden. Beispielsweise eine CLI-Preview getrennt von Desktop-Stabilität.
3. Nach Veröffentlichung Release/Datum und öffentlichen Link eintragen.
4. Vor dem Videoschnitt jede gezeigte Funktion einer ID zuordnen; Geschwindigkeit,
   Datenschutz und Sprachen nur im belegten Umfang beschreiben.
5. Roadmap-Inhalte in einem getrennten Ausblick zeigen. Keine Demo einer unfertigen
   Funktion als Beweis aktueller Verfügbarkeit verwenden.
6. Frühere Videos/Release-Notizen behalten ihren Versionsbezug. Änderungen nicht
   rückwirkend als schon damals verfügbar darstellen.

## Begrenzung des ersten Launchs

Der [große Open-Source-Plan](OPEN_SOURCE_PLAN.md) bleibt das vollständige Zielbild.
Für den nächsten Kandidaten gilt die obige Priorität: zunächst verlässliche App,
lokaler Betrieb, mehrere nutzbare KI-Wege, Desktop-Aufnahmen und Englisch.
CLI nur als klar abgegrenzte Developer Preview; zusätzliche native Provider dürfen
nachfolgen. Video erst nach dieser Bestandsaufnahme des fertigen Kandidaten.
Lizenz, Sicherheit und echte Plattformabnahme werden durch diese Begrenzung nicht
übersprungen. Unverfügbare Zertifizierung wird als konkrete Grenze gemeldet.
