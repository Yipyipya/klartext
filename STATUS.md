# Nivune Status

Stand: 23. September 2026

Nahtlose Fortsetzung: [Entwicklungsübergabe](docs/DEVELOPMENT_HANDOFF.md).
**Was noch dich braucht:** [Release-Checkliste 1.0](docs/RELEASE_1.0_CHECKLIST.md).

## 26. September 2026: Nivune als Alltags-App installiert

- Commit und Push freigegeben: 5 Commits auf `develop/v1-core`, GitHub-CI
  „Verify builds“ grün. `main` und die Live-Seite sind unverändert.
- Beim ersten echten Start gefunden und behoben (Commit `0789d44`): Electron legt
  den Nivune-Profilordner vor dem Main-Code an, dadurch wurde das Klartext-Profil
  nie übernommen. Außerdem zeigte die App alte, nicht mehr entschlüsselbare
  Klartext-Keys als „gespeichert“. Jetzt zählt ein Profil erst mit
  `settings.json`, und unlesbare Keys gelten als fehlend. 196/196 Tests.
- Installiert: `/Applications/Nivune.app` 1.0.0-beta.1 aus Commit `0789d44`
  (ad hoc signiert). Nutzt das bisherige Profil `klartext-desktop` mit
  Sprachmodell, Whisper-Cache und Verlauf; `settings.json.backup-0.3.0` wurde
  angelegt. Zusätzliche Profilsicherung ohne Caches:
  `~/Library/Application Support/klartext-desktop-backup-2026-09-26`.
- Entfernt (in den Papierkorb, wiederherstellbar): `Klartext.app`,
  `Klartext Alpha.app`, drei `Klartext Alpha 1.0 Candidate*.app`, die Profile
  `Klartext Alpha` und `klartext-desktop-development` sowie das verwaiste
  Anmeldeobjekt „Klartext“.
- Der OpenAI-Key muss in Nivune neu eingegeben werden (Keys der alten App sind an
  deren Schlüsselbund-Eintrag gebunden).
- `Documents` wird inzwischen von einem Sync-Dienst verwaltet. Dabei verschwanden
  `node_modules`, `.next` und `desktop/dist`, und Signaturen scheitern an
  Dateiattributen im Projektordner. Pakete werden deshalb nach
  `~/Library/Caches/nivune-build/dist` gebaut (Prüfsummen und Manifest dort).
  Mac: SHA-256 `cac00a10683a536e3775ef6403c801157be964cbddebb593e90ebab2879fd068`,
  Windows: `d44c5bb58bb11912ede0fc69abb84261dcbc66564560d9ddfe78fdf182a05409`.

## Kurzstand 23. September 2026: Kandidat 1.0.0-beta.1

Alles, was ohne Entscheidungen, Zugänge, echte Geräte oder Beta-Teilnehmende
möglich war, ist umgesetzt und geprüft. **Veröffentlicht: nichts.** Öffentlich
bleibt 0.3.0; der Stand liegt uncommitted auf `develop/v1-core`.

**Neu in dieser Sitzung (implementiert und geprüft):**

- Frisches Nivune-Paket nach dem Zehn-Minuten-/IPC-Fix. Nachweise siehe unten.
- K28 manuelle Updateprüfung in Desktop-Einstellungen und Menü; öffnet nur die
  offizielle Release-Seite, installiert nichts. 8 neue Tests, Oberfläche geprüft.
- K17 Web: API-Keys wahlweise dauerhaft im Browser, Standard bleibt Sitzung.
- K18 Web: CORS-Hilfe mit Origin, `OLLAMA_ORIGINS` und Desktop-Alternative.
- K36 bis K38: Website DE/EN unter `/` und `/en`, Datenschutzseite, OG-Bild,
  Sitemap/Canonical nur mit finaler Domain (bis dahin noindex). Web-App unter
  `/app`, PWA-Identität erhalten, Offline-Hülle v2.
- Version 1.0.0-beta.1 in beiden Paketen und Lockfiles.
- Zentrale Release-Ziele in `shared/release.ts` (Repository-Umzug = eine Stelle).
- Dokumente: [Checkliste](docs/RELEASE_1.0_CHECKLIST.md),
  [Kostenplan](docs/COST_PLAN.md), [Beta-Plan](docs/BETA_PLAN.md),
  [Wartung](docs/MAINTENANCE.md), [Website-Nachweise](docs/LANDING_CLAIMS.md),
  [Release-Notizen](docs/RELEASE_1.0.0-beta.1.md), [CHANGELOG](CHANGELOG.md).

**Verifikation (23.09., nach der letzten Codeänderung):**

```text
npm test                              194/194 bestanden
npm run typecheck                     bestanden
npm run build (Next.js 16.3.5)        bestanden, 10 Routen statisch
npm run desktop:bundle                bestanden
npm audit Root/Desktop, prod/voll     0 Befunde
Web-Produktionsserver                 Website DE/EN, /app, Datenschutz, noindex,
                                      Offline-Hülle bei beendetem Server
Nivune.app und Nivune Alpha.app       je 4 Renderer-Smokes, Offline-Start
                                      whisper-small (webgpu, local_files_only,
                                      network=offline), codesign --strict (ad hoc),
                                      ATS, Fuses, ASAR 48 Einträge ohne
                                      node_modules, 5 Lizenzdateien
Nivune-Mac-AppleSilicon.dmg           hdiutil verify gültig, 125.660.344 Byte
                                      SHA-256 d3b9b2951e205444c4a38d453879e6e0
                                      f36c6d3372257bc3bd0c467e4accec4c
Nivune-Windows.exe (Cross-Build)      104.083.558 Byte, Fuses, ASAR, Lizenzen
                                      SHA-256 e1b91fe3a7007bf73f976a4aa8ae5441
                                      2bdf92ebe8f8a99db384d5646e2f3475
```

Prüfsummen und Manifest: `desktop/dist/Nivune-1.0.0-beta.1-SHA256SUMS.txt`,
`desktop/dist/Nivune-1.0.0-beta.1-build-manifest.json` (`sourceDirty: true`, da
noch nicht committed; nach dem Commit neu bauen).

**Nicht geprüft:** echte Mikrofon-Abnahme dieses Kandidaten, Windows auf echter
Hardware, Groq mit echter Anfrage, Signierung/Notarisierung, Live-Deployment.

## Produktziel

Nächste Ausbaustufe: kostenloses Open-Source-Diktier- und Transkriptionswerkzeug
für Web, macOS und Windows, mit lokaler Verarbeitung und freier Anbieterwahl.
Qualität vor Live-Geschwindigkeit, kein verpflichtendes Abo oder Realtime-Upgrade.
Der bestehende öffentliche Stand ist weiterhin 0.3.0; die neue Ausbaustufe ist geplant.

Der unveröffentlichte Sicherheitsnachlauf ist auf dem Stand vom 21. September
2026 abgeschlossen. Next.js 16.3.5 und Transformers 4.3.0 sind samt beiden
Lockfiles integriert. 167 Tests, TypeScript, Web-Produktionsbuild,
Desktop-Bundles, frischer Alpha-Paketbuild, vier Paket-Smokes und ein netzloser
Start von `whisper-small` aus dem vorhandenen Produktionscache sind grün. Das
transitive `baseline-browser-mapping` steht inzwischen auf 2.11.25. Die sechs
Desktop-Buildbefunde sind durch kompatible transitive Updates geschlossen,
`@electron/fuses` steht auf 2.1.3 und der Web-Dateiimport besitzt feste Queue-
und Bytegrenzen. Root und Desktop melden in Produktions- und Vollaudit jeweils
0 Befunde. Details stehen in
[Sicherheitsprüfung nach den Paketupdates](docs/SECURITY_AUDIT_POST_UPGRADE.md).
Der [Self-Hosting-Weg](docs/SELF_HOSTING.md) ist für den lokalen
Next.js-Produktionsserver, lokales Whisper, Ollama und getrennte kompatible
Audio-/Textserver dokumentiert. Ein lokaler Produktions-Smoke lieferte Seite,
Manifest und die erwarteten Schutzheader erfolgreich aus.

Die Open-Source-Grundlage ist im Entwicklungsstand jetzt umgesetzt. Nivune
steht unter MIT; ein englisches Haupt-README mit deutscher Variante,
Contribution-/Security-Dateien, Issue-Vorlagen, Adapter-Anleitung,
Rechte-/Drittanbieterinventar und ein verbindliches Namensprüf-Gate liegen vor.
Die vorläufige Namensprüfung ist inzwischen abgeschlossen und sperrt den bisherigen
Arbeitsnamen für den öffentlichen 1.0-Release: Zwei aktive deutsche Wortmarken
`Klartext` in Klasse 9 erfassen ausdrücklich Software; parallel existieren
aktuelle gleichnamige Diktierprodukte mit nahezu demselben Nutzungsversprechen.
Die lokalen Klartext-Kandidaten bleiben technische Testartefakte. Als neuer
Release-Name ist **Nivune** ausgewählt. Der Name entstand aus zufällig erzeugten,
aussprechbaren Silben und enthält weder den Nachnamen des Projektinhabers noch
einen beschreibenden Sprachbegriff. Die Vorprüfung fand keinen exakten Treffer in
DPMAregister (Klassen 9/42) und keine gleichnamige Diktier-/Transkriptionssoftware.
`.app`, GitHub-Organisation und npm-Name erschienen frei; `.com` ist bereits bei
einem Dritten registriert. Quelltext, Paketmetadaten,
Bundle-IDs, Artefaktnamen und sichtbare Produkttexte sind auf Nivune
umgestellt; bestehende Klartext-Profile und eingelernte Sprachmodelle bleiben als
Kompatibilitätspfad nutzbar. Externe Umbenennung von Repository/Webadresse und
eine Domainregistrierung sind noch nicht erfolgt und werden vom Projektinhaber
später separat entschieden.
Der frische Apple-Silicon-Kandidat enthält Projektlizenz, Notice-Index und die
Lizenztexte der direkt gebündelten Laufzeiten. Nach der realen Onboarding-Abnahme
und dem anschließenden Startbefehl-Nachlauf sind 175 Tests, TypeScript,
Webpack-Produktionsbuild, Desktop-Bundles, vier Paket-Smokes, Signatur-, Fuse-,
ASAR- und ATS-Prüfung sind grün. Alle vier npm-Audits melden 0 Befunde. Das reale
`whisper-small` initialisierte erneut mit WebGPU, fester Revision und
`local_files_only` aus der geklonten 783-MB-Produktionscachekopie bei aktivierter
Electron-Netzsperre.

Der installierte Candidate 2 ist vom Nutzer einschließlich lokalem Modelldownload,
Probeaufnahme, persönlichem Sprachmodell und Abschluss abgenommen. Die dabei
gefundenen `[object Object]`-, Keychain- und Abschlussoptionsfehler sind behoben.
Persönliche Startbefehle sind frei wählbar. Der markenunabhängige Vorschlag lautet
auf Deutsch „Diktat starten“ und auf Englisch „Start dictation“. Zwei bis fünf
kurze Wörter werden lokal validiert,
mit dem Sprachmodell gespeichert und in Einstellungen sowie Menü angezeigt.
Bestehende Modelle bleiben ohne Migration als „Hey Klartext“ nutzbar. Isolierte
Onboarding-Tests beenden sich nach erfolgreichem Abschluss selbst, damit keine
alten Testinstanzen mit demselben globalen Shortcut im Hintergrund bleiben.

Der abarbeitbare [Open-Source- und Launchplan](docs/OPEN_SOURCE_PLAN.md) enthält
45 Arbeitspakete, Abhängigkeiten, Nachweise, Nutzerprüfung und die noch benötigten
externen Entscheidungen. Die technische M1-Grundlage ist auf `develop/v1-core`
implementiert; M2 ist mit dem sichtbaren Modellmanager, einem real geprüften
lokalen Browserpfad und optionaler lokaler Ollama-Überarbeitung implementiert.
Die vollständige Release-Abnahme bleibt offen. Spätere Provider- und Agentenfunktionen bleiben
unangetastet.

Die [Feature-Liste für den Launch](docs/FEATURE_STATUS.md) unterscheidet den
tatsächlichen Stand 0.3.0, fehlende Nachweise und geplante Erweiterungen. Sie ist
die Grundlage für Marketingaussagen und priorisiert den nächsten Kandidaten.
Provider-Ausbau erfolgt gestuft; CLI zunächst als begrenzte Developer Preview,
weitere Agentenschnittstellen danach. Die ersten beiden neuen Entwicklungsschritte
sind implementiert und geprüft, aber nicht veröffentlicht.
Die [Versionsfolge](docs/VERSION_ROADMAP.md) ordnet Launch 1.0 und die anschließenden
Ausbaustufen zu; alle neuen Versionsziele sind geplant und noch nicht verfügbar.

## 1.0-Entwicklung: Schritte 1–4 (unveröffentlicht)

**Implementiert auf `develop/v1-core`:** `shared/processing.ts` hält Rohtext,
Transkription, optionale Überarbeitung und Nutzerwörterbuch in einem gemeinsamen
Auftragskern. Web-Diktate, Web-Dateien und Desktop-Ergebnisse verwenden diesen Kern;
Provider-Fähigkeiten beschreiben Ort, Audioformat, Größenlimit, Sprachen, Kontext,
Zeitmarken und Modelllisten. Web und Desktop verwenden zudem denselben
OpenAI-Netzwerkadapter für Transkription und optionale Überarbeitung.
`shared/i18n.ts` stellt typisierte DE/EN-Textschlüssel, Platzhalter sowie gemeinsame
Zahlen- und Datumsformatierung bereit. Oberflächensprache und gesprochene Sprache
werden in Web und Desktop getrennt gespeichert. Damit sind K06–K09 implementiert
und automatisiert geprüft; die vollständige Übersetzung der vorhandenen Oberflächen
bleibt als F25 offen.

Einstellungen verwenden Schema 1 mit getrennten Transkriptions- und
Überarbeitungsprofilen und referenzierten Zugangsdaten. Web-Schlüssel liegen nicht
mehr im Einstellungsobjekt; der Desktop hält auch den OS-verschlüsselten Wert in
einer getrennten Datei. 0.3.0-Daten werden einmalig gesichert und idempotent
migriert. Beschädigte Daten bleiben als Recovery erhalten. Der frühere persönliche
Kontext und die Sigill-Regel bleiben bei bestehenden Profilen erhalten; neue
Profile beginnen ohne persönliche Vorgaben.

Der Web-Lokalmodus nimmt nun echtes Audio auf, dekodiert es zu 16-kHz-Mono-PCM
und verarbeitet es im lokalen Whisper-Worker. Die Browser Speech API wurde aus
dem Diktierpfad entfernt. Desktop bündelt transformers.js, ONNX-WASM und Loader
im App-Paket statt sie zur Laufzeit von jsDelivr zu importieren. Modellgewichte
werden ausschließlich nach einem sichtbaren Nutzerbefehl heruntergeladen und im
Profil gecacht. Web und Desktop haben dafür einen Resonanz-konformen Modellmanager
mit Cachezustand, Größen-/Lizenzangabe, Fortschritt, Abbruch und Löschung. Beide
Whisper-Modelle und die Transformers-Laufzeit sind auf konkrete Versionen
festgeschrieben. Diktate starten ohne vollständig vorbereiteten Cache keinen
stillen Download; vorbereitete Modelle werden mit `local_files_only` geöffnet.

Der Web-Produktionsbuild installiert eine eng begrenzte Offline-App-Hülle für
Startseite, Manifest, Icon und eigene versionierte Next-Ressourcen. API-Pfade,
fremde Origins sowie `private`/`no-store`-Antworten werden nicht gecacht. Der
Modellmanager zeigt Hüllenstatus, geschätzten freien Speicher, fehlende
Persistenzgarantie und zu wenig Platz. Desktop prüft gemeinsamen Kern,
Transformers-Bundle und ONNX-WASM-Dateien vor einem lokalen Diktat und meldet
fehlende Paketressourcen sichtbar.
Die genauen Cachegrenzen und der reale Ursprungsserver-Ausfalltest stehen in
[Offline-Betrieb](docs/OFFLINE_OPERATION.md).

Transkription und Textüberarbeitung sind nun unabhängig wählbar. Die
Überarbeitungsstufe kann vollständig aus, nur regelbasiert, über OpenAI oder lokal
über Ollama laufen. Web und Desktop verwenden dafür denselben Ollama-Adapter,
einschließlich lokaler Modellliste, Kontext und Wörterbuch. Ollama-Ziele sind
technisch auf Loopback (`localhost`, `127.0.0.1` oder `::1`) begrenzt; Umleitungen
werden nicht verfolgt. Ein Auftrag mit lokalem Whisper und Ollama enthält weder
eine OpenAI-Stufe noch eine Zugangsdatenreferenz. Wortgetreue Verarbeitung ruft
keinen Refiner auf. Modellantworten durchlaufen eine konservative
Inhaltssicherung: erkennbare Kontextkopien, starke Kürzungen, geänderte
Sprecherrollen oder verlorene Verneinungen werden verworfen und der Rohtext bleibt
erhalten. Einrichtung, Browser-CORS-Grenze und Prüfstand stehen in
[Lokale Textüberarbeitung](docs/LOCAL_REFINEMENT.md).

**Geprüft:** 145 automatisierte Tests einschließlich Kern-, Provider-Adapter-,
Web-/Desktop-Migration,
Secret-Trennung, neutralen Neuprofilen, PCM-Mischung, MediaRecorder ohne
Browser-Fallback, DE/EN-Texten und -Formatierung, Modell-Pins,
Cacheklassifizierung, Download-/Abbruch-/Löschsteuerung, Offline-Cachegrenzen,
Speicherdiagnose, Ollama-Loopback-/Redirect-Grenzen, unabhängiger Providerwahl und Desktop-Ressourcenprüfung sowie
Desktop-Runtime-Paketierung; TypeScript ohne Fehler;
Next.js-Produktionsbuild grün; isolierter Electron-App- und
Einstellungs-Smoke-Test grün.
Ein echter lokaler HTTP-Smoke gegen die Ollama-Endpunkte `/api/tags` und
`/api/generate` war erfolgreich; Modellliste und nicht-streamende Textantwort
liefen über zwei Loopback-Anfragen. Die Web-Einstellungen wurden im
Produktionsbuild visuell und über den Accessibility-Baum geprüft; Anbieterwahl,
Adresse, Modellfeld und der vollständig lokale Datenschutzhinweis waren sichtbar.
Die Desktop-Bundles wurden erzeugt: 59,6 KB gemeinsamer Kern, 511,7 KB
Whisper-Runtime-JavaScript und ca. 22 MB ONNX-WASM zusätzlich zu den erst später
geladenen Modellgewichten.

**K14-Teilstand, implementiert und automatisiert geprüft:** Der gemeinsame
Cloud-Transkriptionskern besitzt getrennte Adapter für OpenAI, Groq, Deepgram und
OpenAI-kompatible eigene Audio-Endpunkte. Providerparameter, Binär-/Multipart-
Transport, Sprachcodes und Größenlimits bleiben getrennt. Entfernte eigene Ziele
erfordern HTTPS; HTTP ist nur auf Loopback zulässig. Alle Cloud-Adapter verweigern
Redirects. 401, 429, Abbruch, leere Antworten und ungültiges JSON sind abgedeckt.
Ein echter lokaler HTTP-Smoke bestätigt Multipart-Datei, Modell, Key-Header und
Antwortparsing. Insgesamt sind nun 145 automatisierte Tests, TypeScript, Web-Build
und Desktop-Shared-Bundle grün. Details stehen in
[Cloud-Transkriptionsadapter](docs/TRANSCRIPTION_PROVIDERS.md).

Groq und eigene OpenAI-kompatible Audioziele sind im unveröffentlichten Web- und
Desktopstand nun bewusst auswählbar. Web-Diktat und Dateiimport behalten dasselbe
festgehaltene Profil; Desktop-Diktate lösen den gewählten Anbieter über getrennte,
OS-verschlüsselte Zugangsdaten auf. OpenAI bleibt der Standard für »Beste
Qualität«. Unvollständige Profile werden vor der Aufnahme gestoppt und Fehler
lösen keinen stillen Wechsel aus. Deepgram bleibt gemäß Versions-Roadmap bis 1.1
ohne UI. Ohne freigegebene Zugangsdaten gab es keine echte Groq-Anfrage;
Desktop-Dateiimport und importierte Profilfreigaben folgen weiter in K18/M4.

**K15-Teilstand, implementiert und automatisiert geprüft:** Ein eigener
OpenAI-kompatibler Textserver kann über einen minimalen nicht-streamenden
`/chat/completions`-Vertrag angesprochen werden. Derselbe konservative Prompt wie
bei Ollama transportiert Sprache, Kontext und Wörterbuch; lange Texte werden ohne
Abschneiden aufgeteilt. HTTPS-/Loopback-Grenze, optionale lokale Keys,
Redirect-Sperre sowie unvollständige/leere Antworten sind geprüft. Ein echter
Loopback-HTTP-Smoke bestätigt Endpunkt, Authorization, Modell, Nachrichten und
Antwortparsing. Details stehen in
[Textüberarbeitungsadapter](docs/TEXT_REFINEMENT_PROVIDERS.md). Web und Desktop
können diesen kompatiblen Textserver inzwischen bewusst mit eigener Adresse,
Modell-ID und optionalem zielgebundenem Key wählen; Fehler behalten den Rohtext.
Die neuen Felder wurden in beiden echten Oberflächen visuell und über den
Accessibility-Baum geprüft. Native Claude- und Gemini-Adapter sowie reale
Fremdserverabnahme bleiben offen; der neue Adapter ist nicht veröffentlicht.

**Interner Alpha-Checkpoint vorbereitet und installiert:** Eine getrennte
`Klartext Alpha` 1.0.0-alpha.1 wurde als Apple-Silicon-App mit eigener Bundle-ID
`app.klartext.desktop.alpha`, eigenem Profil, alternativem Shortcut und ohne
Autostart gebaut. Sie liegt parallel unter `/Applications/Klartext Alpha.app` und
überschreibt weder die stabile Klartext-App noch deren Einstellungen oder
Shortcut. Bundle-Metadaten, strikte Codesign-Prüfung und isolierter Paketstart
sind grün. Der normale Start legte das getrennte Alpha-Profil an und protokollierte
Version 1.0.0-alpha.1; die produktive Einstellungsdatei blieb unverändert. Die
Signatur ist weiterhin nur ad hoc; die App ist weder notarisiert
noch veröffentlicht. Die zusammenhängende Nutzer-/Agent-Abnahme folgt nach
[Alpha-Checkpoint 1](docs/ALPHA_CHECKPOINT_1.md).

**Erster echter Alpha-Nutzertest bestanden:** Der alternative globale
Shortcut startete das Diktat; nach Eingabe des absichtlich nicht migrierten
OpenAI-Keys und der macOS-Mikrofonfreigabe liefen Aufnahme und Transkription.
Der fertige Text lag korrekt in der Zwischenablage und ließ sich manuell
einfügen. Automatisches Einfügen war beim ersten Lauf noch nicht freigegeben;
das Laufzeitlog belegte den vorgesehenen Berechtigungs-Fallback. Nach separater
Aktivierung von `Klartext Alpha` unter macOS-Bedienungshilfen wurde der Weg
wiederholt und der Text automatisch in die zuvor aktive Ziel-App eingefügt.
Implementiert und real geprüft sind damit globaler Alpha-Shortcut,
Cloud-Diktat, Zwischenablage-Fallback und Cursor-Einfügen auf dem Test-Mac.
Langdiktat, Escape-Abbruch, lokaler Desktoppfad und Windows bleiben offen;
veröffentlicht wurde nichts.

**M4/K19 Desktop-Arbeitsbereich implementiert und geprüft, unveröffentlicht:**
Ein eigenständiges Resonanz-Fenster stellt Diktat, Aufnahmen, Dateien und Verlauf
als vier zugängliche Bereiche bereit. Es zeigt den aktuell gewählten Audio- und
Textüberarbeitungsweg und kann den bewährten systemweiten Diktierweg starten,
ohne die fokuserhaltende Sprachblase umzubauen. Am K19-Checkpoint waren Aufnahme,
Datei und Verlauf noch ausdrücklich als folgende Schritte gekennzeichnet. Der
eigene sandboxed Preload gab nur einen redigierten Status und validierte Aktionen
frei; Schlüssel sowie allgemeiner Datei-, Shell- und Netzwerkzugriff blieben
außerhalb des Renderers. K20 erweitert genau diese enge Brücke, ohne allgemeine
Systemzugriffe zu öffnen.

**Am K19-Checkpoint geprüft:** damaliger automatisierter Gesamtsatz,
JavaScript-Syntax, `git diff --check` und isolierter Workspace-Smoke im Quellstand
und im neu gebauten Apple-Silicon-Alpha-Bundle.
Das echte Electron-Fenster wurde visuell und über den Accessibility-Baum geprüft;
alle vier Bereiche wechselten korrekt und die Resonanz-Gestaltung blieb intakt.
Der neue Build ist nur ad hoc signiert und liegt unter `desktop/dist-alpha`; die
bereits installierte, real getestete Alpha wurde für diesen UI-Teilschritt noch
nicht ersetzt.

**M4/K20 Aufnahme, Dateiimport und serielle Warteschlange implementiert und
automatisiert geprüft, unveröffentlicht:** Der Arbeitsbereich nimmt Mikrofon-Audio
über `MediaRecorder` auf und bietet Pause, Fortsetzen, Abschluss und Verwerfen als
explizite Zustände. Der Main-Prozess besitzt die Aufnahmefreigabe, hält die
Sprachaktivierung während Aufnahme und Verarbeitung gesperrt und verhindert einen
zweiten systemweiten oder sprachaktivierten Aufnahmestart. Die fokuserhaltende
Sprachblase und ihr bestehender Diktierpfad wurden nur um eine getrennte lokale
Transkriptionsanforderung ergänzt, nicht umgebaut.

Der Dateiimport verwendet ausschließlich den nativen Einzelauswahldialog. Pfad,
Audiodaten, vollständiger Verarbeitungskontext und Zugangsdaten bleiben im
Main-Prozess; der Renderer erhält
nur redigierte Auftragsstände und Texte. Endung, Dateisignatur, reguläre Datei und
profilabhängige Größe werden vor dem Einreihen geprüft. Aufnahme- und Datei-Aufträge
halten Anbieter, Modell, Sprache, Kontext, Wörterbuch und Feinschliff beim Start
fest und laufen strikt seriell durch den gemeinsamen Verarbeitungskern. Lokale
Aufträge verwenden die bereits gebündelte Whisper-Laufzeit cache-only; Cloud-
Aufträge wechseln bei Fehlern nicht den Anbieter. Wartende und laufende Aufträge
sind abbrechbar. Rohtext und Ergebnis bleiben im geöffneten Arbeitsbereich sichtbar;
die K21-Persistenz ist inzwischen ergänzt.

**Geprüft:** 145/145 Tests, darunter Aufnahme-Zustandsautomat, Pause/Fortsetzen,
Dateityp, Signatur, Größenlimit, serielle Reihenfolge, Abbruch und redigierte
Renderer-Snapshots; JavaScript-Syntax und `git diff --check`; TypeScript und
Next.js-Produktionsbuild; alle Desktop-Bundles; isolierter Electron-Workspace-
Smoke. Aufnahme- und Datei-Ansicht wurden im echten Electron-Fenster visuell und
über den Accessibility-Baum geprüft. **Noch nicht real geprüft:** echte K20-
Mikrofonaufnahme mit Pause/Fortsetzen, nativer Import mit anschließender lokaler
oder Cloud-Transkription sowie Windows. Die installierte Alpha wurde nicht ersetzt.
**Veröffentlicht:** nichts; K23/K24 sind inzwischen im Entwicklungsstand
nutzergeprüft, der installierte Kandidat und Windows bleiben offen.

**M4/K21 lokaler Verlauf und Datentransfer implementiert und geprüft,
unveröffentlicht:** Fertige und fehlgeschlagene Arbeitsbereich-Aufträge werden mit
Rohtext, nutzbarem Ergebnis, Warnung und redigierten Anbieter-/Modellmetadaten
atomar im lokalen Desktopprofil gespeichert. Audio, Dateipfade, Kontext,
Wörterbuch und Zugangsdaten werden nicht aufbewahrt. Ein beschädigter Verlauf
wird einmalig als Recovery gesichert. Ergebnisse sind bearbeitbar und lokal nach
Text, Dateiname, Anbieter oder Modell durchsuchbar; manuelle Änderungen werden
nicht von späteren Queue-Aktualisierungen überschrieben. Einzelne Einträge und der
gesamte Verlauf können nach Bestätigung gelöscht, Einträge als TXT oder Markdown
exportiert werden. Einstellungsdateien enthalten keine Schlüssel; beim Import
bleiben Cloud-/Fremdziele und die Sprachaktivierung bis zur ausdrücklichen Auswahl
deaktiviert, vorhandene lokale Credentials werden weder exportiert noch verändert.

**Geprüft:** 145/145 Tests einschließlich atomarer Speicherung, Neustartladen,
Recovery, Redaktion, Suche, Bearbeitung, Teilergebnis, TXT/Markdown, Einzel-/
Gesamtlöschung sowie schlüsselfreiem Settings-Export/-Import. JavaScript-Syntax,
TypeScript/Next.js-Produktionsbuild, alle Desktop-Bundles und der isolierte
Electron-Workspace-Smoke sind grün. Die Verlaufsansicht mit Beispielergebnis,
Warnung, Suchleerzustand und Transferaktionen wurde im echten Electron-Fenster
visuell sowie über den Accessibility-Baum geprüft. **Noch nicht real geprüft:**
Persistenz und Export nach einer echten K20-Mikrofon-/Datei-Transkription,
Dateidialoge auf Windows sowie reale K22-Abbruchwiederherstellung. Die installierte Alpha
wurde nicht ersetzt. **Veröffentlicht:** nichts.

**M4/K22 progressive Aufnahme und Wiederherstellung implementiert und geprüft,
unveröffentlicht:** Arbeitsbereich-Aufnahmen werden während der Aufnahme ungefähr
alle fünf Sekunden als geordnete lokale Fragmente mit Größenlimit und SHA-256-
Prüfsumme atomar im Desktopprofil gespeichert. Audio-Arbeitskopien bleiben vom
K21-Textverlauf getrennt. Nach Fenster-/App-Abbruch werden sie beim nächsten Start
sichtbar angeboten, aber nie automatisch verarbeitet. War eine Cloud-Stufe bereits
gestartet, verlangt Klartext wegen möglicher Doppelberechnung eine bewusste
Bestätigung. Ein bereits gesicherter Rohtext überspringt beim Retry die erneute
Transkription und setzt nur die Überarbeitung fort.

Speicherort und Lebenszyklus sind in der Aufnahmeansicht sichtbar. Nach Erfolg
wird Audio standardmäßig gelöscht. Eine ausdrückliche Aufbewahrungseinstellung
behält erfolgreiche Aufnahmefragmente, kennzeichnet sie im Verlauf und bietet eine
separate Audiolöschung; das Abschalten der Einstellung entfernt bisher behaltenes
Audio. Verzeichnis- und Dateirechte werden unter POSIX auf 0700/0600 gesetzt.

**Geprüft:** 145/145 Tests, darunter eine simulierte 30-Minuten-Folge mit 360
Fragmenten, geordnete/idempotente Speicherung, Neustartladen, Prüfsummenfehler,
kostenbewusster Retry, Rohtext-Wiederverwendung, Standardlöschung und ausdrückliche
Aufbewahrung. JavaScript-Syntax, `git diff --check`, TypeScript/Next.js-Build, alle
Desktop-Bundles und der isolierte Electron-Workspace-Smoke sind grün. Recovery-
Karte, Kostenwarnung, Speicherregel und Audio-Kennzeichnung wurden im echten
Electron-Renderer visuell sowie über Accessibility geprüft. **Noch nicht real
geprüft:** echte 30-Minuten-Mikrofonaufnahme, Prozessabbruch/Neustart mit realem
Audio, realer Cloud-Retry und Windows. Die installierte Alpha wurde nicht ersetzt.
**Veröffentlicht:** nichts; K23/K24 sind inzwischen im Entwicklungsstand
nutzergeprüft, der installierte Kandidat und Windows bleiben offen.

**M4/K23 Ersteinrichtung bis zum ersten Text implementiert und geprüft,
unveröffentlicht:** Ein neues Desktopprofil öffnet einen vierstufigen, sandboxed
Einrichtungsdialog. Sprache, lokaler Whisper-Weg, OpenAI, Groq oder ein eigener
kompatibler Server werden ausdrücklich gewählt. Die notwendige Modell-/Key-
Einrichtung bleibt im Main-Prozess; der Renderer erhält keine Schlüssel. Für die
erste Probe wird keine zusätzliche Cloud-Überarbeitung aktiviert.

Der Mikrofonzugriff wird erst beim Start der echten Probeaufnahme angefragt. Der
fertige Probentext erscheint im Dialog und wird in die Zwischenablage kopiert, aber
nicht im Einrichtungsstand gespeichert. Bei fehlender Einfügefreigabe erklärt der
Abschluss die Zwischenablage-Lösung und verlinkt auf macOS gezielt zu den
Bedienungshilfen. Autostart und Sprachaktivierung werden vor Abschluss nicht
aktiviert; Sprachaktivierung kann erst nach einem persönlichen Startbefehl gewählt
werden.

**Geprüft:** 145/145 Tests, atomarer/recoveryfähiger Einrichtungsstand, Probe als
Abschlussbedingung, Paketdateien, JavaScript-Syntax, TypeScript/Next.js-Build, alle
Desktop-Bundles sowie isolierte Electron-Smokes für App, Einstellungen,
Arbeitsbereich und Ersteinrichtung. Alle vier Schritte wurden im echten Electron-
Renderer visuell und über Accessibility geprüft. Die reale Nutzerprobe im isolierten
Mac-Entwicklungsprofil ist abgeschlossen: responsive Fenstergröße, ruhiger und
monotoner Modelldownload, sichtbarer Probentext mit bewusstem Weiter-Schritt sowie
Probeaufnahme in Fenster- und Vollbildansicht wurden bestätigt. Die Probe verwendet
absichtlich keine separate schwebende Sprachblase; eine animierte Anzeige in der
Probekarte übernimmt dort die Rückmeldung. Ihr Audio-Renderer gehört zum
Einrichtungsfenster, sodass kein Fokus- oder macOS-Space-Wechsel mehr entsteht. Die
normale Diktierblase bleibt außerhalb der Einrichtung unverändert. Windows, ein
installierter Kandidat und die separate K20–K22-Belastungsabnahme bleiben offen.
Die installierte Alpha wurde nicht ersetzt. **Veröffentlicht:** nichts; K24 ist
inzwischen im Entwicklungsstand nutzergeprüft, der installierte Kandidat und
Windows bleiben offen.

**M4/K24 vollständiger DE/EN-Durchzug implementiert, entwicklungs- und
nutzergeprüft, unveröffentlicht:** Web und Desktop speichern die
Oberflächensprache unabhängig von der gesprochenen Sprache. Web-Diktat,
Dateiimport, Verlauf, Desktop-Download und sämtliche Einstellungsbereiche wechseln
vollständig zwischen Deutsch und Englisch. Desktop-Ersteinrichtung, Einstellungen,
Arbeitsbereich, Menüleiste, Aufnahmeblase, Key-Fenster, Sprachaktivierung,
Systemdialoge, Benachrichtigungen und dynamische Fehler-/Fortschrittstexte verwenden
dieselbe Auswahl. Gespeicherte Diktate, Dateinamen und andere Nutzerinhalte werden
absichtlich nicht übersetzt.

**Geprüft:** 146/146 Tests, TypeScript, Next.js-Produktionsbuild, alle Desktop-
Bundles, JavaScript-Syntax und `git diff --check` grün. Die englische Web-App wurde
in allen vier Hauptbereichen und sämtlichen Einstellungsabschnitten visuell sowie
über Accessibility geprüft. Englische Desktop-Ersteinrichtung, Einstellungen,
Arbeitsbereich und Sprachaktivierung wurden im echten Electron-Renderer geprüft.
Der Nutzer hat den DE/EN-Durchzug im Entwicklungsstand abgenommen. Ein
installierter Kandidat und Windows bleiben offen. Die installierte Alpha wurde
nicht ersetzt.

**Nachträglich gefundene Systemdiktat-Regression behoben und real bestätigt:**
Nach der K24-Abnahme meldete der Nutzer, dass Arbeitsbereich-Aufnahmen
funktionieren, die Sprechblase über »Systemweit diktieren« und globalen Shortcut
aber sofort abbricht. Das Laufzeitlog belegte eine abgelehnte Mikrofonanfrage der
Sprechblasen-WebContents. Ursache waren mehrere fensterspezifische
`setPermissionRequestHandler` auf derselben Electron-Session: Das zuletzt
geöffnete Arbeitsbereichsfenster ersetzte den früheren Handler und lehnte danach
die Sprechblase ab. Ein zentraler Session-Handler gibt nun ausschließlich den
bekannten Klartext-Audiorenderern Mikrofonzugriff und lehnt fremde Renderer sowie
Video ab. 151/151 Tests, JavaScript-Syntax, TypeScript und alle Desktop-Bundles
sind grün. Nach Neustart des aktuellen Entwicklungsstands bestätigte der Nutzer,
dass Systemdiktat und globaler Shortcut wieder funktionieren.

**M5/K26 lokal vorbereitet, unveröffentlicht:** Eine gemeinsame
Verifikationskette führt Tests, TypeScript, Web-Produktionsbuild und alle Desktop-
Bundles aus. Der CI-Entwurf trennt verpflichtende Prüfungen von bewusst manuell
gestarteten nativen Paketjobs. Ein portables Buildmanifest bindet Artefakte an
Commit, Dirty-Status, Plattform, Größe und SHA-256. Die Build-Anleitung nennt
Zielsysteme und Grenzen ausdrücklich.

**Geprüft:** 151/151 Tests und die vollständige lokale Verifikationskette sind
grün. Ein temporäres Apple-Silicon-DMG mit 195.802.921 Byte wurde erzeugt;
`hdiutil verify`, strikte ad-hoc-Codesign-Prüfung, erwarteter ASAR-Inhalt und
isolierter Paketstart sind grün. SHA-256:
`541ac29f99d64e10777538e96624f515b75c393dccd325094c607306c89e7b9f`.
Das Paket wurde weder installiert noch veröffentlicht. Erster externer CI-Lauf,
Windows-Paket, Developer-ID-Signierung und Notarisierung bleiben offen.

**M5/K29 Sicherheitsprüfung abgeschlossen, Härtung unveröffentlicht:** Frontend
und Desktop wurden getrennt auf Abhängigkeiten, Secrets, CSP, Renderer-/IPC-
Grenzen, Navigation, Berechtigungen, Dateiimporte, Logs, Löschung und Paketinhalt
geprüft. Detailberichte und der aktuelle Reststatus stehen unter
`docs/SECURITY_AUDIT.md`.

Direkt behoben sind: kein ungenutzter `node_modules`-Baum mehr im ASAR,
einheitliche Electron-Sandbox-/Navigationsgrenzen und Desktop-CSP, Mikrofonrechte
nur für lokale bekannte Audio-Hauptframes, gehärtete Electron-Fuses mit erzwungener
ASAR-Integrität, restriktiveres macOS-ATS, Web-Schutzheader, Web-Keys nur noch für
die Browsersitzung, Trennung nicht vertrauenswürdiger LLM-Daten von statischen
Systemregeln, vollständige Verlauf-Recovery-Löschung, frühere IPC-Größenprüfung,
begrenzte private Logs und race-armer Einstellungsimport.

Ein temporärer gehärteter Apple-Silicon-App-Build besteht strikte Codesign-Prüfung
und vier isolierte Renderer-Smokes. Danach wurden Systemdiktat aus Arbeitsbereich
und per Shortcut sowie die Arbeitsbereich-Aufnahme real auf dem Mac bestanden.
Ein durch die CSP blockiertes internes ONNX-WebGPU-`blob:`-Modul wurde eng im
Audio-Renderer freigegeben; das vorhandene Modell initialisiert wieder direkt aus
dem Cache. 162 Tests, TypeScript, Web-Build und Desktop-Bundles sind grün. Keine
App wurde installiert oder veröffentlicht. Vor einem Release offen bleiben die
ausdrücklich genehmigungspflichtigen Updates von Next.js 16.2.10 auf mindestens
16.3.5 und Transformers 4.2.0 auf mindestens 4.3.0, die Bewertung des neuen
Electron-43-Fuse, echte Signierung, Onboarding-/Sprachaktivierungsabnahme,
Windows und Web-Upload-Gesamtgrenzen.

**K16-/K17-Teilstand, implementiert und automatisiert geprüft:** Zugangsdaten
werden nun zentral nach Anbieter, Zweck und eigener Zieladresse referenziert und
beim Laden/Schreiben gefiltert. Ein Audio-Key kann dadurch nicht als Text-Key oder
für eine andere Serveradresse aufgelöst werden. Groq-Modelllisten sowie optionale
`/models`-Listen kompatibler Server sind implementiert. Nicht unterstützte Listen
blockieren keine manuelle Modell-ID; 401, Timeout und ungültige Antworten bleiben
Fehler. Die Web-Oberfläche bindet Groq und eigene kompatible Audioziele sichtbar
an Diktat und Dateiimport. Bei einer geänderten Zieladresse wird der sichtbare
Key geleert; gespeichert wird er nur für die exakt passende normalisierte
Zielreferenz. Die Produktionsoberfläche wurde visuell und im Accessibility-Baum
geprüft; Anbieterfelder wechselten korrekt und die Browserkonsole blieb fehlerfrei.
Die Desktop-Speicherbrücke übernimmt dieselben Profile und getrennten,
OS-verschlüsselten Ziel-Keys verlustfrei; ein Adresswechsel entfernt den alten
kompatiblen Key. Die Desktop-Einstellungen wählen OpenAI, Groq oder einen eigenen
kompatiblen Server und der Diktierpfad verarbeitet über genau dieses Profil.
Anbieterfelder, Schlüsselstatus und Datenschutzhinweise wurden im echten
Electron-Fenster visuell und über den Accessibility-Baum geprüft.
Details: [Anbieterzugänge und Modelllisten](docs/PROVIDER_CREDENTIALS.md).
Web-Sitzungsschlüssel und die Freigabe importierter Ziele folgen separat, damit
kein fremdes Ziel ohne bewusste Nutzerentscheidung Audio erhält.

**Real geprüft, lokale Textüberarbeitung:** Ollama 0.34.0 und `qwen3:0.6b`
(rund 522 MB) wurden auf dem Test-Mac installiert. Der temporäre Dienst lief nur
auf `127.0.0.1`, mit deaktivierter Ollama-Cloud, und lud das Modell vollständig
auf Apples Metal-Backend. Die Web-Einstellungen fanden das installierte Modell
direkt über die reale Browser-CORS-Verbindung. Zwei kurze deutsche/englische
Modellläufe erreichten den gemeinsamen Adapter, bestanden aber die
Inhaltssicherung nicht: Das kleine Modell kürzte beziehungsweise veränderte den
Inhalt. Klartext verwarf beide Antworten, zeigte den Feinschliff-Warnzustand und
behielt jeweils die vollständige Transkription. Damit sind Installation,
Browser-Verbindung, Inferenz und sicherer Fallback belegt; `qwen3:0.6b` ist noch
nicht als geeignetes Produktionsmodell qualifiziert.

**Real geprüft, Web-Entwicklungsstand:** Whisper base wurde über den sichtbaren
Modellmanager vollständig geladen und als »Offline bereit« klassifiziert. Eine
synthetische deutsche WAV (3,109 Sekunden, 16 kHz mono) wurde im lokalen Modus
dreimal zu »Dies ist ein lokaler Diktatest für Klartext.« transkribiert. Für den
dritten Lauf wurden Tab und Next.js-Ursprungsserver beendet; ein neuer Tab startete
aus der Service-Worker-Hülle, erkannte das Modell und transkribierte bei weiterhin
nicht erreichbarem Ursprung in rund 15 Sekunden. Es gab keine
Browser-Konsolenfehler. Der erste kalte WebGPU-Pfad hatte zuvor rund 5:53 Minuten
benötigt. Das ist ein belegter Leistungsengpass dieser Testumgebung und noch keine
launchfähige Tempo-Abnahme.

**Noch nicht geprüft:** echte Mikrofontranskription des neuen Webpfads,
browserweite Netztrennung beziehungsweise Netzwerkmitschnitt gegen externe Hosts,
Desktop-Modelldownload/-Inferenz ohne Netz, produktives 0.3.0-Profil-Upgrade,
ein geeignetes Ollama-Modell mit kurzen und langen Diktaten, vollständige
UI-Übersetzung, gepackte Mac-App und realer Windows-Lauf.
Damit sind F18–F20 und F25 noch nicht releasefähig. **Veröffentlicht:** keine dieser Änderungen; Web, Installer und
GitHub-Release bleiben unverändert auf 0.3.0.

## Aktueller Stand

- Release 0.3.0 veröffentlicht: Mac- und Windows-Installer gebaut, alle Paketdateien
  gegen die Quellen geprüft, Mac-Signatur und isolierter Einstellungs-Smoke-Test
  erfolgreich. 57 Tests und finaler Web-Build grün. Prüfsummen stehen in
  `desktop/RELEASE_CHECKSUMS.md`.
- **Resonanz-Redesign veröffentlicht und auf diesem Mac installiert:**
  Web-Sprachraum mit dreiteiligem Aufnahmezeichen, unterscheidbaren Aufnahme- und
  Verarbeitungszuständen, direkt bearbeitbarem Text und kürzerer Zeilenbreite.
  Neue SVG-Icons für Dateien und Verlauf, helle/dunkle Darstellung, neue App-Icons.
  Einstellungen als nativer Web-Dialog mit Fokusbegrenzung und separaten Bereichen.
- **Neues Desktop-Einstellungsfenster:** Sprache, Modus, Modell, Kontext,
  Autostart, Sprachaktivierung, Berechtigungsstatus und Darstellung über validierte
  IPC-Aufrufe; vorhandene Tray-Einstellungen bleiben verfügbar und synchron.
  Separater Preload gibt keine Schlüsselwerte aus. Aufnahmeblase, Schlüssel- und
  Sprachaktivierungsfenster teilen die Resonanz-Gestaltung. Das Mac-Tray verwendet
  ein zur Systemdarstellung passendes Template-Zeichen.
- Resonanz geprüft: Produktionsbuild und TypeScript grün; 57 Regressionstests
  grün. Web-Ansichten und Dialog bei 1280×720 und 390×844 geprüft, keine horizontalen
  Überläufe in den Hauptansichten. Keine Browser-Konsolenfehler in der Prüfung.
  Natives Mac-Einstellungsfenster hell/dunkel, Kontextspeicherung und erneutes Laden
  sowie Schlüssel-Eingabefenster visuell und funktional geprüft. Sprachblasen-Markup
  hell/dunkel und Aufnahme/Verarbeitung ohne Audioaufnahme gerendert geprüft.
  Mac-App lokal gebündelt, Paketinhalt gegen Quellen und Signatur verifiziert;
  isolierter Einstellungs-Smoke-Test auch im Paket erfolgreich.
- Keine neue Mikrofon-/Cloud-End-to-End-Aufnahme und kein realer Windows-Test für
  das Redesign. Die Mac-App unter `/Applications/Klartext.app` wurde durch den
  geprüften Resonanz-Build ersetzt; Paketvergleich, Signatur und Start des neuen
  Einstellungsfensters bestätigt. Die vorherige App liegt unter
  `desktop/dist/install-backups/20260912-221540/Klartext.app`. Benutzerprofil und
  Sprachmodelle wurden nicht ersetzt. Die lokale Installation hat noch die
  Versionsnummer 0.2.2 bei identischem Resonanz-Funktionsstand; die veröffentlichten
  Installer sind als 0.3.0 gekennzeichnet. Entwicklungs-Vorschau läuft mit separatem Profil; für
  Abnahmen sind `--settings-preview` und `--settings-smoke-test` verfügbar.

- Desktop 0.2.2 unterstützt eine vollständig lokale, persönlich eingelernte
  Sprachaktivierung mit „Hey Klartext“. Im unveröffentlichten 1.0-Stand ist der
  Startbefehl frei wählbar; vorgeschlagen werden „Diktat starten“ beziehungsweise
  „Start dictation“. Bestehende Klartext-Modelle bleiben kompatibel. Modell und
  Phrase bleiben lokal im Benutzerprofil;
  der Listener verursacht keine API-Kosten. Während eines Diktats wird der
  Wake-Word-Detektor nicht ausgewertet, sodass normale Wörter die Aufnahme
  technisch nicht mehr versehentlich beenden können.
- Diktate enden nach neun Sekunden bestätigter Stille oder sofort über den
  globalen Shortcut. Der akustisch nicht eindeutig trennbare Endbefehl
  „Klartext fertig“ wurde zugunsten zuverlässiger, vollständiger Aufnahmen
  deaktiviert. Ein vorhandenes Startmodell bleibt beim Update verwendbar.
- Der Stille-Autostopp misst ab 0.2.1 den tatsächlichen Diktat-Audiostream statt
  den Wake-Word-Listener. Nach bestätigter Sprache beendet er bei neun Sekunden
  Stille; ohne erkannte Sprache wartet er 20 Sekunden. Automatische Enden löschen
  kein Audio mehr. Damit werden leise Passagen und die letzten acht Sekunden
  längerer Aufnahmen nicht mehr versehentlich abgeschnitten.
- Das Wake-Word-Fenster arbeitet dauerhaft im Hintergrund, bleibt aber
  nicht fokussierbar. Dadurch behält das zuvor aktive Textfeld seinen Cursor und
  der fertige Text wird automatisch an derselben Position eingefügt. Der
  reservierte Endbefehl wird nur am Textende entfernt.
- Der Sprachstart wartet nicht mehr auf Schlüsselbund- oder bereits erteilte
  Mikrofonfreigaben. In 0.2.0 erschien die Aufnahme im realen Mac-Test 0,26
  Sekunden nach der Erkennung. In 0.2.2 dauerte es inklusive Bestätigung rund
  0,6 Sekunden vom erkannten Startkandidaten bis zur sichtbaren Aufnahme.
- Der Rustpotter-Listener lädt WASM und persönliche Modelle ohne Worker oder
  Dateisystem-Fetch. Das behebt sporadische Hänger beim normalen App-Start.
- Desktop 0.1.4 verhindert, dass eine veraltete macOS-Bedienungshilfe-Freigabe
  Aufnahme und Transkription blockiert. Beim Aufnahme-Start wird nur noch das
  Mikrofon angefragt. Fehlt die Freigabe fürs automatische Einfügen, wird der
  fertige Text zuverlässig in die Zwischenablage kopiert und verständlich gemeldet.
  Das Tray zeigt den Status und öffnet die passende Systemeinstellung explizit.
- Desktop 0.1.3 behebt den nachgewiesenen Mac-Konflikt zwischen einer seit dem
  27. August laufenden Entwicklungsinstanz und `/Applications/Klartext.app`.
  Entwicklung nutzt nun ein getrenntes Profil und einen abweichenden Shortcut.
  `EPIPE` an einem geschlossenen Terminal wird behandelt statt den Main-Prozess
  zu beenden. Aufnahme- und API-Fehler landen zusätzlich im lokalen Protokoll.
- Der Audiokanal wird nach der Mikrofonfreigabe explizit aktiviert. Fehler aus
  AudioContext und Mikrofon werden vollständig abgefangen, sichtbar gemeldet und
  setzen den App-Zustand zurück. Das schließt einen gemeinsamen Mac-/Windows-
  Fehlerpfad; die genaue Ursache des Windows-Vorfalls ist ohne damaliges Protokoll
  nicht nachgewiesen.
- Safari-/Web-Fix: Qualitätsaufnahme ohne parallele Browser-Spracherkennung,
  MP4/AAC-Präferenz mit Format-Fallback und vollständigem Abschluss. Keine stille
  Ausgabe von Browser-Text bei Aufnahme- oder API-Fehlern. Dauerhafter Ergebnisstatus,
  Retry mit derselben Aufnahme bzw. nur dem vorhandenen Rohtext beim Feinschliff.
  Qualitätsmodelle unverändert. Die später ergänzten Desktop-Korrekturen sind in
  Version 0.1.3 zusammengefasst.
- Die Web-App hat ein neues, hochwertiges Workspace-Interface mit responsiver
  Navigation, Einstellungs-Drawer und hellem sowie dunklem Design.
- Der Qualitätsmodus nutzt `gpt-transcribe` und gibt Kontext, Sprache und
  persönliche Fachbegriffe bereits bei der Erkennung mit.
- Ein vorsichtiger Feinschliff über `gpt-5.4-mini` korrigiert Interpunktion,
  Füllwörter und klare Selbstkorrekturen, ohne den Inhalt umzuschreiben.
- Lokales Whisper bleibt für Desktop und Datei-Uploads erhalten. Web-Diktate im
  bisherigen „Lokal“-Modus verwenden die Browser Speech API, nicht lokales Whisper.
- Datei-Uploads nutzen je nach gewähltem Modus OpenAI oder lokales Whisper.
- Direkte Cloud-Uploads ohne verpflichtenden Browser-Decoder. Große Dateien
  werden an leisen Stellen in Abschnitte unter 24 MB geteilt. Browser-Aufteilung:
  bis 100 MB und 30 Minuten. Kein stiller Wechsel zu lokalem Whisper.
- Uploads überleben den Bereichswechsel; Teilfehler werden klar markiert.
  Originale bleiben erhalten, unvollständige Feinschliff-Ausgaben werden verworfen.
- Sigill-Korrektur ist wortgrenzensicher und stabil bei wiederholter Anwendung.
- Desktop ab 0.1.3: Autostart bei Anmeldung, abschaltbar. Vorbereitung im Hintergrund,
  ohne Mikrofonaufnahme/API-Kosten. Nur im Lokalmodus wird Whisper vorab geladen.
  Ein systemseitig deaktivierter Autostart wird nicht automatisch reaktiviert.
- Die Desktop-App nutzt denselben Qualitätsmodus, speichert den API-Key über den
  OS-geschützten Verschlüsselungsdienst in ihrer lokalen Einstellungsdatei und fügt Ergebnisse
  an der aktuellen Cursor-Position ein.
- Der Web-Produktionsbuild und der Electron-Smoketest sind grün.
- Reale Tests auf dem Mac: Web 22 von 22 Wörtern korrekt, Desktop nach
  Eigennamen- und Zeichensetzungsoptimierung 21 von 21 Wörtern korrekt.
- Aktuelle Installationsdateien wurden für macOS Apple Silicon und Windows x64
  unter den stabilen Downloadnamen gebaut und inhaltlich geprüft.
- Website enthält noindex/nofollow. Weiterhin per Link erreichbar, kein Login.

## Frühere Funktionsprüfungen (bis 0.2.2)

- 55 automatisierte Regressionstests grün, darunter getrennte Entwicklungsprofile
  und Shortcuts, EPIPE-Behandlung, fehlertolerantes Dateilogging, Aktivierung und
  Fehler eines pausierten AudioContext, die nicht blockierende macOS-
  Bedienungshilfenlogik sowie Recorder-Ausfall ohne stillen
  Browser-Fallback, späte Stop-Daten, leeres Audio, Timeout, Mikrofonverweigerung,
  Retry ohne zusätzliche Audioanfrage beim Feinschliff sowie sechsminütiges Stereo-PCM,
  vollständige Chunk-Abdeckung, Upload-Routing, Teilfehler, Feinschliff-Grenzen,
  Wörterbuch und plattformübergreifende Autostart-Logik (OS-API gemockt),
  Wake-Word-Zustände, unterschiedliche Start-/Stop-Empfindlichkeit, sichere
  Modellablage, ausschließlich im Ruhezustand aktive Starterkennung,
  Endbefehlsbereinigung und Stille-Autostopp auf dem tatsächlichen Aufnahmestream.
- Web-Produktionsbuild und TypeScript-Prüfung grün.
- Web-UI im lokalen Produktionsbuild geprüft: fehlender Key blockiert den Start,
  öffnet Einstellungen und bleibt anschließend als dauerhafter Hinweis sichtbar.
  Screenshot im Desktoplayout, keine Browser-Konsolenfehler. Kein echter Safari-
  End-to-End-Sprachtest. Ein kurz gestarteter lokaler Mikrofontest wurde durch
  Schließen des Tabs ohne Transkriptionsanfrage abgebrochen.
- Electron-Smoke-Test des gepackten Mac-Programms bis zum geladenen Renderer grün,
  mit isoliertem temporären Profil und ohne Aufnahme, API oder Autostart.
- Mac 0.2.2 real verifiziert: Der lokale Listener wird beim normalen Start bereit,
  „Hey Klartext“ startet, die Sprachblase erhält den Textfeldfokus und das
  automatische Einfügen funktioniert. Mehrere gesprochene Varianten von
  „Klartext fertig“ lösten keinen Stopp aus; ausschließlich der aufnahmeseitige
  Stillemonitor beendete den vollständigen Text nach ungefähr neun Sekunden Ruhe.
  Mikrofon- und Bedienungshilfenfreigabe wurden erneuert.
- Synthetische WAV: 199,26 Sekunden, 38.257.554 Bytes. Echter OpenAI-Upload im
  Browser erfolgreich, 394 Wörter, alle sechs Kontrollbegriffe, Anfang/Ende
  vorhanden. Bereichswechsel während der Verarbeitung erfolgreich.
- Defekte WAV ohne Audiosamples: verständlicher OpenAI-400-Fehler angezeigt.
- MP3-Direktupload derselben Aufnahme (2.392.129 Bytes) erfolgreich, 395 Wörter,
  sechs Kontrollbegriffe jeweils einmal. Eine zusätzliche Wortwiederholung zeigt,
  dass dies kein Nachweis fehlerfreier Erkennung ist.
- Mac- und Windows-Installer 0.2.2 gebaut. Paketinhalt beider Plattformen enthält
  Runtime-, Audio-, Logging-, Bedienungshilfen- und Sprachaktivierungs-Code sowie
  ausschließlich das Startmodell, den aufnahmeseitigen Stillemonitor und die
  unveränderten Qualitätsmodelle.
  Mac-Signaturprüfung grün. Prüfsummen in desktop/RELEASE_CHECKSUMS.md.
- Das gepackte Mac-Programm 0.2.2 startet im isolierten Smoke-Test bis zum
  geladenen Renderer ohne Mikrofon-, Bedienungshilfen- oder Autostart-Abfrage.
- Die lokale Installation wurde auf 0.2.2 aktualisiert und gegen den gebauten
  Paketinhalt geprüft. Genau eine Produktionsinstanz läuft; Qualitätsmodus,
  gespeicherter API-Key und Autostart-Einstellung sind erhalten.
- Windows 0.2.0 wurde real geprüft: Diktat, Fokus, automatisches Einfügen und
  Excel funktionierten. Der Bericht wies überlappende Wahr-/Fehlalarm-Scores,
  unzuverlässige Endbefehle und verfrühte Stille-Stopps nach. 0.2.1 behebt die
  zugehörigen Audioabschneidepfad. 0.2.2 entfernt zusätzlich den nicht sicher
  trennbaren Sprach-Endbefehl; der echte Windows-Laufzeittest bleibt erforderlich.

## Noch manuell prüfen

1. Auf dem Mac einmal ab- und wieder anmelden und den Autostart sowie die
   Sprachaktivierung nach der Anmeldung bestätigen.
2. Windows 0.2.2 installieren, das vorhandene Startmodell verwenden und Mikrofon,
   Diktat, Excel-Einfügen, Stille-Autostopp und Autostart real prüfen. Der
   plattformübergreifende Build und die gemockten Tests ersetzen diese Abnahme nicht.
3. Eine echte längere Sprachmemo (M4A/MP3) sowie optional weitere WAVs testen.

## Bereitstellung

Resonanz 0.3.0 ist seit 12. September 2026 veröffentlicht.
Bestehendes Projekt: Yipyipya/klartext, Vercel-Produktionszweig main.
Adresse: https://klartext-ai.vercel.app
Release-Quellstand: cdc5e65f13d8b7bcc2d9aca3fe0e85e038855ff1.
Vercel-Produktion erfolgreich (Deployment 6414036632); öffentliche Adresse mit
Resonanz im Browser visuell geprüft und HTTP-Antwort bestätigt.

GitHub-Release: https://github.com/Yipyipya/klartext/releases/tag/v0.3.0
Mac-Apple-Silicon-DMG, Windows-x64-Installer und SHA256SUMS.txt veröffentlicht.
GitHub-Dateigrößen und SHA-256 stimmen für alle drei Dateien mit lokalen Werten
überein. Beide stabilen `releases/latest/download`-Links führen auf v0.3.0 und
liefern HTTP 200 mit der erwarteten Größe. Das Mac-DMG hat zusätzlich eine
bestätigte Integritätsprüfung. Die bisherigen Versionen bleiben auf GitHub.

Der echte Windows-0.3.0-Laufzeittest, eine neue Mikrofon-/Cloud-End-to-End-Aufnahme
für das Redesign sowie der Test nach einer echten Systemanmeldung bleiben offen.
