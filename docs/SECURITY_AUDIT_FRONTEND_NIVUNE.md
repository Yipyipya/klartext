# Frontend-Sicherheitsaudit: Nivune 1.0

Stand: 23. September 2026  
Scope: Next.js-Weboberfläche, Browserdaten, Provider-Requests, Dateiimport, Offline-Shell und Downloadoberfläche  
Vorgehen: Read-only Review und nicht mutierende Verifikation. Produktcode, Paketdateien und Lockfiles wurden nicht verändert.

## Ergebnis

Im geprüften Frontend gibt es **keinen offenen kritischen oder hohen Befund**. Die früheren Launch-Blocker bei Next.js, Transformers.js, Browser-Credentials, Security-Headern, Promptisolation und Upload-Queue sind im aktuellen Stand behoben und verifiziert.

Für eine öffentliche 1.0 bleiben zwei konkrete Punkte:

1. **Mittel:** Die Weboberfläche verteilt noch nicht signierte Desktop-Builds über veränderliche `latest`-Links und bietet keinen direkt sichtbaren Hash- oder Manifestnachweis. Das ist für eine öffentliche 1.0 ein Release-Gate.
2. **Niedrig:** Live-Aufnahmen besitzen keine maximale Dauer oder Bytegrenze. Ein versehentlich sehr lange laufendes Diktat kann Browser-RAM und Cloudkosten unnötig erhöhen.

Zusätzlich gibt es drei dokumentierte Härtungs- beziehungsweise Betriebsentscheidungen mit niedrigem Risiko: die bewusst lockere CSP für Inline-Next.js-Skripte und beliebige nutzergewählte HTTPS-Provider, HSTS als Deployment-Verantwortung sowie der Netzwerkbedarf von `next/font/google` beim Build.

## Befunde

### F-01: Öffentliche Downloads sind noch nicht als vertrauenswürdige 1.0-Lieferkette ausgelegt

**Schweregrad:** Mittel  
**Status:** Actionable, Release-Gate für öffentliche Desktop-Downloads

**Evidenz**

- `components/DownloadPanel.tsx:8-9` verwendet weiterhin das alte Repository `https://github.com/Yipyipya/klartext` und veränderliche `releases/latest/download`-URLs.
- `components/DownloadPanel.tsx:32-33` und `51-52` verlinken die Artefakte direkt, ohne Version, Commit oder Hash anzuzeigen.
- `components/DownloadPanel.tsx:40` erklärt, dass der macOS-Build nicht notarisiert ist.
- `components/DownloadPanel.tsx:58` fordert Windows-Nutzer zum Ausführen trotz SmartScreen-Warnung auf.
- `components/DownloadPanel.tsx:203-218` bezeichnet den angebotenen Stand noch als Version 0.3.0 für persönliche Tests. Das widerspricht einer öffentlichen 1.0-Oberfläche.
- Ein SHA-256-Manifestgenerator und dazugehörige Tests existieren bereits. Der Test `build manifest binds an artifact to its bytes and SHA-256` war grün. Die Downloadoberfläche verlinkt dieses Manifest aber nicht.

**Risiko**

Nutzer können Herausgeber, exakte Version und Artefaktbytes nicht unabhängig über die Oberfläche verifizieren. Veränderliche `latest`-Links erschweren außerdem die reproduzierbare Zuordnung eines Downloads zu Release, Commit und Prüfsumme. Das Umgehen von Betriebssystemwarnungen ohne danebenliegenden Integritätsnachweis ist für eine öffentliche 1.0 kein sauberer Sicherheitszustand.

**Empfehlung**

- Downloadbereich bis zur echten 1.0-Veröffentlichung nicht als fertige 1.0-Distribution darstellen.
- Veröffentlichte Links an eine konkrete Version binden und Version, Commit sowie SHA-256-Manifest direkt daneben anzeigen.
- macOS langfristig mit Developer ID signieren und notarisierten. Windows langfristig mit vertrauenswürdigem Code-Signing-Zertifikat signieren.
- Falls Signierung für die erste Open-Source-1.0 bewusst aufgeschoben wird, den Status klar als nicht signierter Community-Build kennzeichnen, das Hash-Manifest zwingend veröffentlichen und keine allgemeine Aufforderung zum Umgehen einer Warnung geben.
- Externes Repository und Downloadpfade nach der vom Nutzer bewusst später geplanten Domain- und Handle-Sicherung von `klartext` auf Nivune umstellen.

### F-02: Live-Aufnahmen haben keine maximale Dauer oder Speichergrenze

**Schweregrad:** Niedrig  
**Status:** Actionable, vor oder kurz nach 1.0 sinnvoll

**Evidenz**

- `lib/audio-recorder.ts:20` sammelt alle Recorder-Chunks bis zum Ende der Aufnahme.
- `lib/audio-recorder.ts:40` startet den `MediaRecorder` ohne Timeslice und ohne automatische Stoppbedingung.
- `hooks/useDictation.ts:69-100` startet die Aufnahme, besitzt aber keinen Dauer-, Byte- oder Quota-Wächter.
- `app/page.tsx:350-356` aktualisiert nur die sichtbare Laufzeit. Es gibt keinen automatischen Stopp.
- Erst nach dem Stoppen prüft der Cloudpfad das Provider-Bytelimit. Der lokale Pfad muss die vollständige Aufnahme zunächst als Blob erhalten und dekodieren.

**Risiko**

Ein vergessener oder versehentlich weiterlaufender Mitschnitt kann den Speicher des Browser-Tabs belasten. Im Qualitätsmodus kann eine lange, stark komprimierte Aufnahme außerdem unnötig hohe Providerkosten verursachen. Ein externer Angreifer kann dies ohne Nutzeraktion nicht direkt auslösen, deshalb bleibt der Schweregrad niedrig.

**Empfehlung**

- Eine gut sichtbare maximale Dauer definieren, beispielsweise 30 oder 60 Minuten, mit Vorwarnung und kontrolliertem Auto-Stopp.
- Optional regelmäßig Recorder-Daten anfordern und die kumulierte Größe begrenzen, ohne Safari-kompatible Container zu beschädigen.
- Die Grenzen pro lokalem und Cloudmodus dokumentieren und mit Recorder-Regressionstests absichern.

### F-03: Die CSP ist wirksam, aber bewusst breit

**Schweregrad:** Niedrig  
**Status:** Deferred, dokumentierte Produktentscheidung

**Evidenz**

- `next.config.ts:3-16` setzt eine durchsetzende CSP.
- `script-src` enthält `'unsafe-inline'`, weil der statisch erzeugte Next.js-Response Inline-RSC-Bootstrapskripte enthält.
- `script-src` enthält `wasm-unsafe-eval`, das für die lokale ONNX-/WASM-Laufzeit benötigt wird.
- `connect-src` erlaubt jedes HTTPS-Ziel, damit Nutzer einen eigenen kompatiblen Provider konfigurieren und Modelle von Hugging Face laden können.
- Der lokale Produktionsabruf bestätigte den vollständigen CSP-Header auf `/` und `/sw.js`.
- In den geprüften Produktquellen gibt es kein `dangerouslySetInnerHTML`, `innerHTML`, `eval` oder `new Function`. Nutzertexte und Providerfehler werden von React als Text gerendert.

**Risiko**

Die CSP ist eine zusätzliche Barriere, aber kein vollständiger Schutz gegen eine künftig eingeführte Script-Injection. `'unsafe-inline'` schwächt Script-Schutz, und ein kompromittiertes Script könnte wegen `https:` Daten an ein beliebiges HTTPS-Ziel senden. Das ist besonders relevant, solange BYOK-Schlüssel während der Sitzung in `sessionStorage` liegen.

**Empfehlung**

- Für die statische Offline-Web-App vorerst als akzeptierte Einschränkung dokumentieren.
- Bei späterer öffentlicher SaaS-Variante Nonce- oder Hash-basierte Next.js-Auslieferung evaluieren.
- Falls freie kompatible Providerziele später entfallen, `connect-src` auf feste Hosts reduzieren.
- Keine neuen HTML-Injection-Sinks einführen. Dieser Punkt sollte Teil künftiger Security-Reviews bleiben.

### F-04: HSTS wird nicht vom Next.js-Projekt gesetzt

**Schweregrad:** Niedrig  
**Status:** Deployment-Gate, nicht lokal entscheidbar

**Evidenz**

- `next.config.ts:18-24` setzt CSP, MIME-Schutz, Frame-Schutz, Referrer-Policy und Permissions-Policy, aber kein `Strict-Transport-Security`.
- Der lokale HTTP-Produktionsserver lieferte erwartungsgemäß keinen HSTS-Header.
- Das Projekt unterstützt ausdrücklich lokale und selbst gehostete Nutzung. `includeSubDomains` oder `preload` wäre deshalb ohne Kenntnis der späteren Domainstruktur nicht sicher pauschal festzulegen.

**Risiko**

Wenn die spätere öffentliche Domain HSTS weder an der Hostingkante noch in Next.js setzt, fehlt der Schutz gegen einen initialen HTTP-Downgradeversuch. Das betrifft nur die spätere HTTPS-Veröffentlichung, nicht lokale Entwicklung.

**Empfehlung**

- Nach Wahl der öffentlichen Domain den HTTPS-Redirect und `Strict-Transport-Security` am tatsächlichen Deployment prüfen.
- `includeSubDomains` und `preload` erst aktivieren, wenn alle betroffenen Subdomains dauerhaft HTTPS unterstützen.

### F-05: Der Webbuild lädt Figtree während des Builds von Google

**Schweregrad:** Niedrig  
**Status:** Deferred, Reproduzierbarkeit und Build-Verfügbarkeit

**Evidenz**

- `app/layout.tsx:2` und `6-9` verwenden `next/font/google` für Figtree.
- Ein Produktionsbuild ohne Netzwerk scheiterte ausschließlich am Abruf von `fonts.googleapis.com`.
- Derselbe Build mit Netzwerkzugriff war erfolgreich und schrieb die Schrift als eigenes WOFF2-Asset nach `.next/static/media`.
- Zur Laufzeit lädt die erzeugte Seite die Schrift von `self`; die CSP erlaubt keine Google-Fontquelle.

**Risiko**

Es entsteht keine Laufzeitverfolgung durch Google Fonts. Der Releasebuild ist aber nicht vollständig offline reproduzierbar und hängt beim Build von einem externen Dienst ab.

**Empfehlung**

- Für vollständig reproduzierbare Releasebuilds die lizenzierte Fontdatei im Repository oder in einem kontrollierten Build-Asset-Store pinnen und mit `next/font/local` laden.
- Lizenz- und Notice-Pflichten der gewählten Fontdatei im Rechteinventar beibehalten.

## Bereits behoben und verifiziert

### Abhängigkeiten

- `next` ist auf 16.3.5 gepinnt.
- `@huggingface/transformers` ist auf 4.3.0 gepinnt.
- `npm audit --omit=dev --json`: 0 bekannte Schwachstellen, 57 Produktions-, 43 Entwicklungs-, 58 optionale und insgesamt 134 Abhängigkeiten im Audit-Metadatensatz.
- `npm audit --json`: ebenfalls 0 bekannte Schwachstellen.
- Keine kritischen, hohen, mittleren, niedrigen oder informativen npm-Advisories zum Prüfzeitpunkt.

### Security-Header

Der lokale Next.js-Produktionsserver lieferte auf `/` und `/sw.js`:

- `Content-Security-Policy` mit `default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'` und den dokumentierten Laufzeitausnahmen.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy: camera=(), geolocation=(), payment=(), usb=(), microphone=(self)`.
- Kein `X-Powered-By`-Header, passend zu `poweredByHeader: false`.

### Secrets und Browserdaten

- Keine produktiven API-Schlüssel, privaten Schlüsseldateien oder eingecheckten `.env`-Dateien gefunden.
- Gefundene Schlüsselähnlichkeiten sind ausschließlich Testwerte wie `sk-session-only`, `local-test-key`, `local-text-key` sowie UI-Platzhalterpräfixe wie `sk-proj-` und `gsk_`.
- Der Produktionsbuild enthält keine Source Maps.
- `lib/store.ts:143-178` migriert alte Schlüssel aus `localStorage` in `sessionStorage` und entfernt den dauerhaften Altwert.
- `lib/store.ts:250-279` bindet kompatible Schlüssel an normalisierte Zieladressen und entfernt sie bei einem Zielwechsel.
- Browserseitige BYOK-Schlüssel bleiben für JavaScript im gleichen Origin lesbar. Das ist eine bekannte Grenze eines reinen Clientprodukts, wird durch die aktuelle Sitzungsspeicherung aber deutlich reduziert.

### Providerziele und Redirects

- Entfernte kompatible Ziele müssen HTTPS verwenden. HTTP ist ausschließlich für `localhost`, `127.0.0.1` und `::1` erlaubt.
- URL-Credentials, Querystrings und Fragmente werden verworfen.
- Ollama ist strikt auf Loopback begrenzt.
- OpenAI-, Groq-, kompatible Transkriptions-, kompatible Text- und Ollama-Requests verwenden `redirect: "error"`.
- Schlüssel kompatibler Provider werden aus dem normalisierten Ziel abgeleitet und nicht still an eine geänderte Adresse übernommen.
- Externe Modellkarten öffnen mit `target="_blank"` und `rel="noreferrer"`.
- Es gibt keine ankommenden URL-Parameter, offenen Redirects oder clientseitige Routenziele aus unbereinigter Nutzereingabe.

### Eingabe- und Ressourcenlimits

- `lib/audio-upload.ts:18-20` begrenzt eine Datei auf 100 MB, aktive plus wartende Dateien auf 12 und das gemeinsame Budget auf 300 MB.
- Leere und nicht unterstützte Dateien werden vor dem Enqueue abgelehnt.
- Die Queue arbeitet seriell und gibt ihr Budget in jedem Abschlussfall wieder frei.
- Der Browser-Decodepfad begrenzt dekodierte Abschnitte auf 30 Minuten.
- Einzelne Cloudrequests werden auf das jeweilige Providerlimit begrenzt, aktuell 24 MB für OpenAI, Groq und den Standard eines kompatiblen Servers.
- Request-Timeouts und Abort-Signale sind vorhanden.

### Prompt- und Ausgabesicherheit

- Statische Produktregeln bleiben in der Systemrolle.
- Diktat, Kontext und Wörterbuch werden als JSON-Nutzdaten serialisiert.
- Der Prompt weist ausdrücklich an, Nutzerdaten nie als Anweisungen zu behandeln.
- Ergebnisvalidierung schützt unter anderem vor Kürzungen, Kontextkopien, geänderten Sprecherrollen und verlorenen Verneinungen.
- React rendert Nutzer- und Providertexte escaped. Es wurde kein eigener HTML-Sink gefunden.

### Service Worker und lokale Modelle

- `public/sw.js` verarbeitet nur GET-Requests und nur ausgewählte Same-Origin-Shellpfade.
- `/api/`, fremde Origins und `sw.js` selbst werden nicht gecacht.
- `private`- und `no-store`-Responses werden nicht gespeichert.
- Lokale Whisper-Modelle sind an konkrete Hugging-Face-Revisionen gebunden.
- Der Transkriptionspfad verlangt für die Offline-Ausführung einen als vollständig klassifizierten Cache und setzt `local_files_only`.

### Produktionslogs

- In `app`, `components`, `hooks`, `lib`, `shared`, `workers` und `public` existiert kein produktiver `console.log`, `console.debug`, `console.info`, `console.warn` oder `console.error`.
- Die gebauten Chunks enthalten erwartete Console-Aufrufe aus Next.js-, React- und ML-Laufzeitcode. Es wurden keine eigenen produktiven Logaufrufe oder Schlüsselwerte im Bundle gefunden.

## Verifikation

Ausgeführt am 23. September 2026:

| Prüfung | Ergebnis |
| --- | --- |
| `npm audit --omit=dev --json` | Grün, 0 Schwachstellen |
| `npm audit --json` | Grün, 0 Schwachstellen |
| `npm test` | Grün, 176 von 176 Tests |
| `npm run build -- --webpack` | Grün, TypeScript und statische Generierung erfolgreich |
| Lokaler `next start` auf `127.0.0.1:3107` | Grün |
| Headerabruf für `/` und `/sw.js` | Grün, konfigurierte Header tatsächlich vorhanden |
| Secretsuche in Quellen und Clientchunks | Grün, nur dokumentierte Testwerte und Eingabeplatzhalter |
| Suche nach produktiven `console.*`-Aufrufen | Grün, keine im eigenen Quellpfad |
| Suche nach `.map` in `.next/static` | Grün, keine Produktions-Source-Maps |

Hinweis zum Build: Der standardmäßige Turbopack-Build konnte in der isolierten Prüfungsumgebung keinen internen Port für PostCSS öffnen. Der Next.js-Webpack-Produktionsbuild lief in derselben Umgebung vollständig durch. Das ist kein nachgewiesener Produktfehler, sollte aber im normalen Release-CI mit dem standardmäßig verwendeten Buildbefehl erneut bestätigt werden.

## Release-Priorität

1. Downloadoberfläche und Artefakt-Lieferkette auf den echten 1.0-Stand bringen.
2. Am öffentlichen Deployment HTTPS-Redirect, HSTS und dieselben Security-Header erneut per `curl` prüfen.
3. Eine Maximaldauer für Web-Liveaufnahmen ergänzen oder ausdrücklich als 1.0-Nacharbeit terminieren.
4. CSP-Verengung und lokal gepinnte Fontdatei als spätere Härtung behandeln, solange keine neuen HTML-Sinks oder festen Providerannahmen hinzukommen.
