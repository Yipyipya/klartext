# K29 Frontend Security Audit

Stand: 2026-09-21  
Umfang: Next.js-Web-App, browserseitige Provider-Aufrufe, Offline-Cache, Dateiimport, LLM-Promptaufbau und Electron-Renderer-Härtung.  
Vorgehen: statische Quelltextprüfung, Secret-Pattern-Suche, Prüfung des aktuellen Deployments und `npm audit` für Web und Desktop. Es wurden keine Produktdateien, Abhängigkeiten oder Releases verändert.

Hinweis nach der Prüfung: Die anschließende Behebung und der aktuelle Reststatus
stehen in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md). Dieser Bericht bewahrt den
ursprünglichen Befundstand vor den Änderungen.

## Kurzfazit

Vor einem öffentlichen Launch bestehen zwei unmittelbare Abhängigkeitsblocker und mehrere Härtungslücken. Der kritischste konkrete Befund ist Next.js 16.2.10 mit zwei von `npm audit` als kritisch eingestuften Advisories. Zusätzlich ist `@huggingface/transformers` 4.2.0 über native Transitivabhängigkeiten hoch eingestuft. Die Web-App speichert Provider-Schlüssel dauerhaft im Klartext in `localStorage`; gleichzeitig fehlt eine Content Security Policy. Diese Kombination vergrößert die Auswirkung jeder künftigen XSS- oder Lieferkettenlücke erheblich.

Priorität für die Behebung:

1. Next.js und Transformers auf geprüfte, nicht betroffene Versionen aktualisieren.
2. Web-CSP und weitere Response-Header einführen.
3. Browser-Schlüssel standardmäßig nur sitzungsgebunden halten oder die dauerhafte Speicherung ausdrücklich und sicherheitsbewusst gestalten.
4. LLM-Eingaben strikt als untrusted data von Systemanweisungen trennen.
5. Electron-Renderer einheitlich mit CSP, Navigation-Sperren und expliziten `webPreferences` härten.

## Befunde

### F-01: Kritische bekannte Schwachstellen in Next.js 16.2.10

**Schweregrad:** Kritisch  
**Status:** Offen, Launch-Blocker

**Evidenz**

- Die Web-App pinnt `next` auf 16.2.10: `package.json:17`.
- Der Lockfile bestätigt 16.2.10: `package-lock.json:1734-1736`.
- `npm audit --omit=dev --json` meldet `next` als kritisch und nennt 16.3.5 als verfügbare Korrekturversion.
- Gemeldete kritische Advisories sind `GHSA-p293-qw3h-jr36` und `GHSA-2xp9-vwfh-vxw4`. Weitere hohe und mittlere Next.js-Advisories betreffen Middleware/Proxy, Server Actions, Rewrites, Cache-Verhalten und Image Optimization.
- Die Anwendung nutzt derzeit keine eigene Middleware, keine Server Actions und keinen Custom Server. Das senkt die Erreichbarkeit einzelner Advisories, beseitigt aber weder die kritische Paketbewertung noch die erreichbaren Framework-Endpunkte zuverlässig.

**Risiko**

Eine verwundbare Framework-Version läuft im öffentlich erreichbaren Web-Frontend. Mindestens ein Advisory betrifft unauthentifizierte Remote-Code-Ausführung. Der konkrete Exploitpfad hängt von Hosting-Plattform und genutzten Frameworkpfaden ab, darf vor einem Launch aber nicht nur durch vermutete Nichterreichbarkeit abgefedert werden.

**Vorgeschlagene Behebung**

- `next` mindestens auf die von `npm audit` vorgeschlagene Version 16.3.5 oder eine neuere kompatible, geprüfte Patchversion anheben.
- Danach Lockfile neu erzeugen und `npm audit --omit=dev`, Tests, TypeScript-Prüfung und Produktionsbuild ausführen.
- Nach dem Upgrade die tatsächlich ausgelieferten Routen testen, besonders `/_next/image`, RSC-Navigation und Requests mit Request-Body.

### F-02: Hohe bekannte Schwachstellen im lokalen ML-Abhängigkeitsbaum

**Schweregrad:** Hoch  
**Status:** Offen, Launch-Blocker

**Evidenz**

- Web und Desktop pinnen `@huggingface/transformers` 4.2.0: `package.json:16` und `desktop/package.json:114`.
- Beide Lockfiles bestätigen 4.2.0: `package-lock.json:63-65` und `desktop/package-lock.json:792-794`.
- `npm audit --omit=dev --json` meldet für beide Projekte vier zusammenhängende hohe Einträge: `@huggingface/transformers`, `onnxruntime-node`, `adm-zip` und `sharp`.
- Betroffen sind unter anderem `adm-zip` durch kontrollierbare Speicherallokation beziehungsweise Symlink-Folgen und `sharp` durch geerbte libvips/libheif-Schwachstellen.
- `npm audit` nennt `@huggingface/transformers` 4.3.0 als verfügbare Korrekturversion.
- Der Browserpfad bündelt Transformers für den Renderer (`desktop/build-whisper.js:5-14`). Die native Laufzeiterreichbarkeit aller gemeldeten Transitivpakete wurde in diesem Audit nicht abschließend bewiesen. Sie bleiben jedoch Teil des Installations- und Build-Abhängigkeitsbaums.

**Risiko**

Manipulierte Modell- oder Archivdaten können je nach tatsächlich gebündeltem Pfad Speichererschöpfung, Dateiüberschreibung oder native Parserfehler auslösen. Auch nicht zur Laufzeit erreichbare Pakete bleiben ein Risiko für Build- und Packaging-Systeme.

**Vorgeschlagene Behebung**

- `@huggingface/transformers` in beiden Projekten auf 4.3.0 oder eine neuere kompatible, geprüfte Version aktualisieren.
- Produktionsartefakte anschließend entpacken und verifizieren, ob `onnxruntime-node`, `adm-zip` oder `sharp` überhaupt mit ausgeliefert werden. Nicht benötigte native Pakete aus dem Desktop-Artefakt ausschließen.
- Lokale Modelle mit vorhandenen gepinnten Revisionen erneut testen: `shared/local-models.ts:18-36`.
- Vollständigen Audit erneut ausführen. Der vollständige Desktop-Audit meldete zusätzlich sechs hohe Einträge in Build-Abhängigkeiten, darunter `@xmldom/xmldom`, `brace-expansion`, `fast-uri`, `js-yaml`, `tar` und `undici`. Diese sind nach dem Produktionsbaum separat zu aktualisieren.

### F-03: Provider-Schlüssel werden dauerhaft und unverschlüsselt in Web-Storage gespeichert

**Schweregrad:** Hoch  
**Status:** Offen

**Evidenz**

- `CREDENTIALS_KEY` ist ein normaler `localStorage`-Eintrag: `lib/store.ts:132-136`.
- Provider-Schlüssel werden als JSON im Klartext geschrieben: `lib/store.ts:156-159`.
- OpenAI-, Groq- und kompatible Provider-Schlüssel werden bei jeder Einstellungsänderung in diesen Eintrag übernommen: `lib/store.ts:228-269`.
- Die Eingabefelder sind zwar visuell als Passwortfelder markiert, lösen aber über den automatischen Persistenz-Effekt sofort Speichervorgänge aus: `app/page.tsx:95-101` und beispielhaft `app/page.tsx:943-950`.
- Diktatverlauf mit Roh- und Endtext wird ebenfalls dauerhaft unter demselben Origin gespeichert: `lib/store.ts:275-305`.
- Die Secret-Pattern-Suche fand keine fest eingebauten produktiven Schlüssel und keine versionierten `.env`-, PEM- oder Key-Dateien. Das Problem betrifft Laufzeitgeheimnisse der Nutzer.

**Risiko**

Jedes Skript, das später im selben Origin ausgeführt wird, kann alle Provider-Schlüssel und den lokalen Diktatverlauf auslesen. Dazu zählen erfolgreiche XSS-Angriffe, kompromittierte Client-Abhängigkeiten und bösartige Browser-Erweiterungen mit Seitenzugriff. Ein Schlüssel kann dann außerhalb von Klartext auf Kosten des Nutzers verwendet werden.

**Vorgeschlagene Behebung**

- Web-Schlüssel standardmäßig nur im Arbeitsspeicher beziehungsweise höchstens in `sessionStorage` halten.
- Eine dauerhafte Speicherung nur als ausdrückliche Opt-in-Option anbieten und das Risiko klar erklären. Browserseitige Verschlüsselung ohne externes Geheimnis schützt nicht wirksam gegen XSS.
- Für eine langfristige öffentliche Web-Version einen Backend-Proxy mit serverseitigem Secret oder kurzlebige, eng begrenzte Tokens erwägen. Dabei müssen Authentifizierung, Rate Limits und Missbrauchsschutz Teil des Designs sein.
- Eine sichtbare Aktion zum Entfernen aller lokalen Schlüssel und privaten Verlaufsdaten bereitstellen.
- F-04 zuerst oder gleichzeitig beheben, damit die Angriffsfläche für Script-Injection reduziert wird.

### F-04: Keine Web-CSP und unvollständige Security-Header

**Schweregrad:** Mittel  
**Status:** Offen

**Evidenz**

- `next.config.ts:3-5` enthält keine `headers()`-Konfiguration.
- `app/layout.tsx:30-44` injiziert ein Inline-Skript über `dangerouslySetInnerHTML`, ohne Nonce oder Hash. Eine strikte CSP würde diesen Pfad daher zunächst blockieren.
- Der read-only Abruf von `https://klartext-ai.vercel.app/` am 2026-09-21 lieferte HSTS, aber keine `Content-Security-Policy`, kein `X-Content-Type-Options`, keine `Referrer-Policy`, keine `Permissions-Policy` und keinen `frame-ancestors`-Schutz. Das Deployment kann älter als der uncommittete Worktree sein, bestätigt aber den derzeit öffentlich sichtbaren Zustand.
- Der Root-Response setzt außerdem `Access-Control-Allow-Origin: *`. Für die statische öffentliche Seite ist das nicht direkt vertraulichkeitskritisch, sollte aber nicht pauschal auf spätere private Antworten oder API-Routen übertragen werden.

**Risiko**

Ohne CSP wird eine künftige Script-Injection nicht auf vertrauenswürdige Quellen begrenzt. Das ist wegen der in F-03 gespeicherten Provider-Schlüssel besonders relevant. Fehlender Frame-Schutz ermöglicht Clickjacking. Fehlende MIME-, Referrer- und Permissions-Policies verzichten auf zusätzliche Browserbarrieren.

**Vorgeschlagene Behebung**

- Das Theme-Initialisierungsskript in eine CSP-kompatible Form überführen, bevorzugt mit Nonce oder als externe statische Datei.
- Mindestens folgende Header über Next.js setzen und im echten Deployment per `curl -I` verifizieren:
  - `Content-Security-Policy` mit `default-src 'self'`, restriktivem `script-src`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, kontrolliertem `connect-src`, `worker-src` und den tatsächlich benötigten Modellquellen.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: no-referrer` oder mindestens `strict-origin-when-cross-origin`.
  - `Permissions-Policy` mit nur den benötigten Berechtigungen, insbesondere einer bewussten Mikrofonrichtlinie.
- `connect-src` muss OpenAI, Groq, Hugging Face und absichtlich konfigurierbare kompatible Ziele berücksichtigen. Da CSP keine beliebigen benutzerdefinierten HTTPS-Ziele fein abbilden kann, ist dies eine Produktentscheidung, die vor dem Setzen der Richtlinie geklärt werden muss.

### F-05: Electron-Renderer sind nicht einheitlich gehärtet

**Schweregrad:** Mittel  
**Status:** Offen

**Evidenz**

- Einstellungen und Onboarding besitzen eine enge CSP: `desktop/settings.html:1` und `desktop/onboarding.html:5`.
- Aufnahmeblase, Key-Fenster, Arbeitsbereich und unsichtbarer Wake-Renderer besitzen keine CSP: `desktop/pill.html:1-5`, `desktop/keywin.html:1-6`, `desktop/workspace.html:1-7` und `desktop/wake.html:1-6`.
- `pill`, `keyWin`, `wakeSetupWin`, `wakeWin` und das Onboarding-Audio-View setzen nicht alle sicherheitsrelevanten `webPreferences` explizit: `desktop/main.js:149-158`, `desktop/main.js:390-409`, `desktop/main.js:861-869`, `desktop/main.js:2042-2050` und `desktop/main.js:2070-2089`.
- Settings, Onboarding und Workspace blockieren neue Fenster und Navigation: `desktop/main.js:964-965`, `desktop/main.js:1192-1193` und `desktop/main.js:1669-1670`. Dieselbe Sperre fehlt bei mehreren anderen Renderern.
- Positiv: Die gehärteten Fenster verwenden `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true`. IPC-Handler prüfen bei sensiblen Fenstern Absender und Hauptframe, zum Beispiel `desktop/main.js:975-980` und `desktop/main.js:1687-1690`.

**Risiko**

Aktuelle Electron-Defaults sind relativ sicher, können sich aber durch Versionswechsel oder spätere Einzeloptionen ändern. Ein Renderer ohne CSP und Navigationssperre besitzt bei einer künftigen HTML-Injection oder unerwarteten Navigation eine größere Angriffsfläche gegen die über Preload exponierte IPC-API.

**Vorgeschlagene Behebung**

- Für jedes Fenster explizit `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true` setzen, sofern die Audio- oder WASM-Laufzeit dies nach Test bestätigt.
- Für jedes WebContents `setWindowOpenHandler(() => ({ action: "deny" }))` und einen `will-navigate`-Blocker setzen.
- Jede HTML-Datei mit einer minimalen CSP versehen. Inline-Skripte und Inline-Styles in externe Dateien verschieben oder eng gehashte Ausnahmen verwenden. Kein pauschales `unsafe-eval` einführen; `wasm-unsafe-eval` nur dort erlauben, wo die WASM-Laufzeit es nachweislich benötigt.
- IPC weiterhin pro Sender, Hauptframe, Payload-Länge und Zustandsübergang prüfen.

### F-06: LLM-Promptisolation ist uneinheitlich und durch benutzerkontrollierte Systeminhalte geschwächt

**Schweregrad:** Mittel  
**Status:** Offen

**Evidenz**

- Kontext und Wörterbucheinträge werden direkt in den Systemprompt eingebettet: `shared/refinement-prompt.ts:30-44`.
- Diktattext wird bei Ollama und kompatiblen Providern zwar markiert, kann die XML-ähnliche Begrenzung aber mit einem eigenen `</dictation>` beziehungsweise `</diktat>` schließen: `shared/refinement-prompt.ts:47-50`.
- Der OpenAI-Refinementpfad sendet den Rohtext direkt als `input` und nutzt immer die deutsche Konstante `REFINEMENT_INSTRUCTIONS`: `shared/openai-provider.ts:126-150`. Sprache, Kontext und Wörterbuch werden auf diesem Pfad nicht übergeben: `lib/refine-transcript.ts:34-40`.
- Tests prüfen das Vorhandensein der Marker, aber keine adversarial inputs oder schließenden Marker: `tests/ollama-provider.test.cjs:66` und `tests/compatible-refinement.test.cjs:39`.

**Risiko**

Gesprochener oder importierter Text kann Anweisungen enthalten, die das Modell als neue Aufgabe interpretiert. Noch kritischer ist benutzerkontrollierter Kontext im Systemprompt, weil dieser auf derselben Prioritätsstufe wie die vertrauenswürdigen Produktregeln steht. Das kann Inhalt verfälschen, vertraulichen Kontext in die Ausgabe ziehen oder zu unerwünschten Antworten statt einer wortgetreuen Überarbeitung führen. Die vorhandene Nachvalidierung senkt das Risiko sichtbarer Kürzungen, deckt aber nicht alle semantischen Manipulationen ab.

**Vorgeschlagene Behebung**

- Nur statische Produktregeln in der Systemrolle belassen.
- Diktat, Kontext und Wörterbuch als klar typisierte, serialisierte Daten in einer User-Nachricht übergeben, zum Beispiel als JSON-Objekt mit festen Feldern. Keine benutzerkontrollierten Werte an Systemanweisungen anhängen.
- Den OpenAI-Pfad auf denselben sprachabhängigen Builder umstellen und `buildRefinementInput` konsistent verwenden.
- Eingaben nicht nur mit frei schließbaren XML-Markern abgrenzen. Wenn Marker beibehalten werden, enthaltene Marker escapen und zusätzlich ausdrücklich anweisen, alle Feldinhalte als Daten und nie als Instruktionen zu behandeln.
- Regressionstests für `ignore previous instructions`, eingebettete schließende Tags, Rollenwechsel, Ausgabe des Kontextes und Wörterbuchwerte mit Prompttext ergänzen.

### F-07: Web-Dateiimport hat keine Queue- oder Gesamtkostenbegrenzung

**Schweregrad:** Niedrig  
**Status:** Offen

**Evidenz**

- `addFiles` akzeptiert eine unbegrenzte Anzahl ausgewählter Dateien und legt alle Referenzen in State und Queue: `components/UploadPanel.tsx:175-187`.
- Die Vorauswahl prüft nur MIME-Präfix oder Dateiendung: `components/UploadPanel.tsx:175-178`.
- Einzelne direkte Cloud-Uploads sind auf das Providerlimit begrenzt: `lib/audio-upload.ts:18-20` und `lib/audio-upload.ts:136-145`.
- Browser-Dekodierung ist auf 100 MB und 30 Minuten begrenzt, wobei die Dauer erst vor beziehungsweise nach dem vollständigen Dekodieren geprüft wird: `lib/audio-upload.ts:46-61`.
- Positiv: Der Desktop-Arbeitsbereich begrenzt Größe und Queue, prüft Magic Bytes und erlaubt höchstens zwölf aktive Jobs: `desktop/workspace-jobs.js:3-16`, `desktop/workspace-jobs.js:31-40` und `desktop/workspace-jobs.js:112-115`.

**Risiko**

Eine große Mehrfachauswahl kann den Tab lange binden, sehr viele kostenpflichtige Provideranfragen auslösen oder durch komprimierte Audiodaten hohen Arbeitsspeicherverbrauch verursachen. Der Angriff erfordert normalerweise eine aktive Dateiauswahl oder Drag-and-drop durch den Nutzer und ist deshalb niedrig eingestuft.

**Vorgeschlagene Behebung**

- Eine feste maximale Queue-Länge, eine aggregierte Byte-Grenze und eine sichtbare Kostenwarnung für Cloud-Verarbeitung einführen.
- Vor dem Enqueue pro Datei Größe und unterstützte Signatur prüfen, analog zum Desktop-Arbeitsbereich.
- Dekodierung in einen Worker verlagern oder große lokale Dateien vor dem vollständigen `arrayBuffer()` ablehnen.
- Fehler klar pro Datei ausgeben und keine weiteren kostenpflichtigen Jobs nach einem Authentifizierungs- oder Rate-Limit-Fehler automatisch starten.

### F-08: Provider-Fehler werden in der Produktionskonsole protokolliert

**Schweregrad:** Niedrig  
**Status:** Offen

**Evidenz**

- Der einzige produktive `console.*`-Aufruf im Web-Quellpfad ist `console.error(err)` in `components/UploadPanel.tsx:159-167`.
- Providerfehler können bis zu 500 Zeichen des Response-Bodys in die Exception übernehmen, zum Beispiel `shared/compatible-refinement-provider.ts:26-28`, `shared/cloud-transcription-providers.ts:70-85` und `shared/provider-models.ts:31-33`.

**Risiko**

Ein Provider oder kompatibler Server kann sensitive Diagnoseinformationen in einem Fehlerbody zurückgeben. Diese Daten erscheinen dann zusätzlich zur UI in den Developer Tools und können bei später ergänzter Client-Telemetrie unbeabsichtigt weitergeleitet werden.

**Vorgeschlagene Behebung**

- Produktionslogs auf stabile Fehlercodes und Status beschränken.
- Response-Details nur in einer bewusst aktivierten lokalen Diagnoseansicht anzeigen, vor Speicherung redigieren und niemals Authorization-Header, Keys, Audio oder vollständige Transkripte loggen.

### F-09: Downloadoberfläche verteilt nicht signierte Builds ohne direkt prüfbaren Integritätsnachweis

**Schweregrad:** Mittel  
**Status:** Bekannte Alpha-Einschränkung, vor öffentlichem Launch offen

**Evidenz**

- Downloads verweisen auf veränderliche `releases/latest/download`-URLs: `components/DownloadPanel.tsx:8-10` und `components/DownloadPanel.tsx:26-64`.
- Die Anleitung fordert Nutzer auf, macOS- beziehungsweise Windows-Warnungen trotz fehlender Notarisierung oder Signatur zu übergehen: `components/DownloadPanel.tsx:38-41` und `components/DownloadPanel.tsx:57-60`.
- Ein SHA-256-Manifestgenerator existiert bereits: `scripts/create-build-manifest.cjs:24-27` und `scripts/create-build-manifest.cjs:47-74`. Die Downloadoberfläche zeigt oder verlinkt diesen Integritätsnachweis derzeit nicht.

**Risiko**

Nutzer können Herausgeber und Artefaktversion nicht über das Betriebssystem verifizieren und werden zugleich an das Umgehen der Schutzwarnung gewöhnt. Ein kompromittierter Release oder ein versehentlich falsch hochgeladenes Artefakt ist über die Oberfläche nicht eindeutig an Version, Commit und Hash gebunden.

**Vorgeschlagene Behebung**

- Öffentliche Builds signieren, macOS notarisierten und Windows mit einem vertrauenswürdigen Code-Signing-Zertifikat ausliefern.
- Downloadlinks versionsfest statt nur über `latest` anzeigen.
- Pro Artefakt SHA-256, Version, Commit und Manifestlink direkt neben dem Download zeigen und den Prüfweg kurz erklären.
- Die Aufforderung zum Umgehen von Betriebssystemwarnungen nach Einführung signierter Builds entfernen.

## Positiv geprüfte Kontrollen

- Keine fest eingebauten produktiven API-Schlüssel, privaten Schlüsseldateien oder versionierten `.env`-Dateien in den geprüften Quellpfaden gefunden.
- Remote HTTP wird für kompatible Provider abgelehnt; nur HTTPS und lokales Loopback-HTTP sind zulässig. URL-Credentials, Query und Fragment werden verworfen: `shared/cloud-transcription-providers.ts:143-160`.
- Provider-Requests folgen keinen Redirects: unter anderem `shared/openai-provider.ts:83-89`, `shared/cloud-transcription-providers.ts:100-106`, `shared/compatible-refinement-provider.ts:46-59` und `shared/provider-models.ts:36-44`.
- Der Ollama-Pfad akzeptiert nur Loopback-Adressen: `shared/local-endpoints.ts:3-20`.
- Externe Web-Links sind konstant. Der in neuem Tab geöffnete Modelllink nutzt `rel="noreferrer"`: `app/page.tsx:1048` und `shared/local-models.ts:18-36`.
- Der Service Worker verarbeitet nur GET, nur Same-Origin-Shellressourcen, keine `/api/`-Pfade und speichert keine `private`- oder `no-store`-Responses: `public/sw.js:5-20` und `public/sw.js:64-85`.
- Der aktuelle öffentliche Stand lieferte am 2026-09-21 für `/sw.js` noch 404. Das ist kein Befund gegen den uncommitteten Code, bedeutet aber, dass dessen Offline- und Cacheverhalten erst nach einer späteren Veröffentlichung am echten Deployment verifiziert werden kann.
- Desktop-Zugangsdaten werden mit Electron `safeStorage` verschlüsselt und die Credentials-Datei atomar mit Modus `0600` geschrieben: `desktop/main.js:12`, `desktop/main.js:353`, `desktop/main.js:889-890` und `desktop/settings-store.js:7-25`.
- Desktop-Snapshots geben keine API-Schlüssel oder verschlüsselten Schlüssel an Settings-Renderer weiter: `desktop/main.js:905-947`.
- Desktop-Dateiimporte haben deutlich engere Grenzen als der Browserpfad, inklusive Dateisignaturprüfung, Größenlimit und Queue-Limit: `desktop/workspace-jobs.js:3-40` und `desktop/workspace-jobs.js:112-115`.

## Audit-Ergebnisse der Abhängigkeiten

| Projekt | Audit | Ergebnis |
| --- | --- | --- |
| Web | `npm audit --omit=dev --json` | 8 Einträge: 1 kritisch, 6 hoch, 1 mittel |
| Web | `npm audit --json` | gleiches Ergebnis |
| Desktop | `npm audit --omit=dev --json` | 4 hohe Einträge |
| Desktop | `npm audit --json` | 10 hohe Einträge, davon 6 zusätzlich im Entwicklungs- und Packagingbaum |

Die Audit-Ausgaben wurden am 2026-09-21 gegen den npm-Advisory-Dienst erzeugt. Da Advisories zeitabhängig sind, müssen sie unmittelbar vor jedem Release erneut ausgeführt werden.

## Empfohlene Verifikation nach Fixes

1. `npm audit --omit=dev` in Root und `desktop/` ergibt keine kritischen oder hohen produktiven Befunde.
2. Test, TypeScript-Prüfung, Next.js-Produktionsbuild und Desktop-Bundles bleiben grün.
3. `curl -I` gegen Root, `sw.js`, Manifest und einen statischen Chunk bestätigt die geplanten Header im echten Deployment.
4. Ein CSP-Report-only-Lauf zeigt keine unbeabsichtigten Blockierungen. Danach CSP erzwingen.
5. Browser-Neustart und Origin-Inspektion bestätigen, dass Schlüssel ohne ausdrückliches Opt-in nicht dauerhaft gespeichert werden.
6. Adversarial Prompttests bestätigen, dass Diktat, Kontext und Wörterbuch keine Instruktionspriorität erhalten und der Kontext nie ausgegeben wird.
7. Electron-Smokes bestätigen für jedes Fenster CSP, blockierte Navigation, blockierte neue Fenster, Sandbox und funktionierende Audio-/WASM-Pfade.
8. Dateiimporttests decken Queuegrenze, aggregierte Größe, falsche Signatur, Dekodierfehler, Abbruch und Providerfehler ab.
9. Release-Download wird anhand Signatur, Version, Commit und SHA-256 gegen das veröffentlichte Manifest geprüft.
