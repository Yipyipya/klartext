# Nivune selbst betreiben

Stand: 21. September 2026

Nivune benötigt für die Web-App keine Datenbank, kein Nivune-Konto und keinen
Nivune-API-Server. Der Next.js-Server liefert Oberfläche, Service Worker und
Sicherheitsheader aus. Transkription und optionale Textüberarbeitung laufen danach
entweder im Browser, direkt gegen einen bewusst gewählten Anbieter oder gegen
einen eigenen kompatiblen Dienst.

## Schnellstart auf einem Rechner

Voraussetzungen sind Git und die in `.nvmrc` festgelegte Node.js-Version 24.

```bash
git clone https://github.com/Yipyipya/klartext.git
cd klartext
npm ci
npm run build
npm start -- --hostname 127.0.0.1 --port 3000
```

Danach ist die Website unter `http://127.0.0.1:3000` und der Arbeitsbereich unter
`http://127.0.0.1:3000/app` erreichbar. Ohne `NEXT_PUBLIC_SITE_URL` bleiben alle
Seiten noindex. Für einen Dienst im
Netz oder Internet muss ein Reverse Proxy HTTPS bereitstellen und die vom
Next.js-Server gesetzten Sicherheitsheader unverändert weitergeben. Ein reiner
Export statischer Dateien ist nicht der dokumentierte 1.0-Weg, weil die Header aus
`next.config.ts` zum Sicherheitsmodell gehören.

Vor einem eigenen Deployment sollte derselbe Checkout geprüft werden:

```bash
npm ci
npm --prefix desktop ci
npm test
npm run typecheck
npm run build
npm run desktop:bundle
```

In eingeschränkten Build-Sandboxes, in denen Turbopack keinen lokalen Hilfsprozess
starten darf, ist `npm run build -- --webpack` der dokumentierte gleichwertige
Produktionsbuild. Diese Einschränkung betrifft nicht die ausgelieferte App.

## Datenfluss je Betriebsart

| Betriebsart | Audio | Text | Externe Verbindung |
| --- | --- | --- | --- |
| Lokales Whisper, lokale Regeln | bleibt im Browser | bleibt im Browser | nur der bewusste erste Modelldownload von Hugging Face |
| Lokales Whisper, Ollama | bleibt im Browser | geht an Ollama auf Loopback | Modelldownloads für Whisper und Ollama, danach lokal nutzbar |
| OpenAI oder Groq | geht direkt vom Browser zum gewählten Anbieter | bleibt lokal oder geht an den getrennt gewählten Refiner | Anbieter-API |
| Eigener kompatibler Audioserver | geht direkt an die konfigurierte Basisadresse | bleibt lokal oder geht an den getrennt gewählten Refiner | eigener Server |
| Eigener kompatibler Textserver | gemäß gewählter Transkription | Rohtext, Kontext und Wörterbuch gehen an den eigenen Server | eigener Server |

Nivune vermittelt diese Anfragen nicht über eine eigene Cloud. Web-Zugangsdaten
bleiben in der aktuellen Browsersitzung und werden nicht in persistente
Einstellungen exportiert. Verlauf, Wörterbuch und Einstellungen liegen lokal im
jeweiligen Browserprofil. Wer Browserdaten löscht oder die Origin ändert, muss sie
vorher bewusst exportieren.

## Lokales Whisper

Der Modellmanager lädt ein festgeschriebenes Whisper-Modell erst nach einem
sichtbaren Nutzerbefehl. Nach vollständigem Download startet der Diktierpfad mit
`local_files_only`; fehlende Dateien lösen keinen stillen Netzwerk-Fallback aus.
Service Worker und Modellcache gehören zur exakten Origin. Ein Wechsel zwischen
`localhost`, `127.0.0.1`, anderer Portnummer, Domain oder Protokoll erzeugt daher
einen getrennten Browserspeicher.

Die App-Hülle kann nach einem erfolgreichen Online-Start aus dem Service Worker
kommen. Ein vollständiger Offline-Nachweis setzt zusätzlich voraus, dass das für
das aktuelle Backend benötigte Modell vollständig im Browsercache liegt. Details
und die real geprüften Grenzen stehen in [OFFLINE_OPERATION.md](OFFLINE_OPERATION.md)
und [LOCAL_MODELS.md](LOCAL_MODELS.md).

## Ollama getrennt betreiben

Ollama ist kein Bestandteil des Nivune-Servers. Es wird separat auf demselben
Gerät installiert, gestartet und mit einem geeigneten Textmodell bestückt.
Nivune akzeptiert für Ollama nur `localhost`, `127.0.0.1` oder `::1` und folgt
keinen Umleitungen. Im Browser muss Ollama die konkrete Nivune-Origin per CORS
zulassen; die Desktop-App spricht Ollama direkt aus dem Main-Prozess an.

Die Einrichtung, die geprüfte API und die Qualitätsgrenzen stehen in
[LOCAL_REFINEMENT.md](LOCAL_REFINEMENT.md). Ein kleines Modell kann technisch
antworten und trotzdem für zuverlässige Textüberarbeitung ungeeignet sein. Die
semantische Sicherung verwirft erkennbare Kürzungen oder Bedeutungsänderungen und
behält dann den Rohtext.

## Eigene kompatible Server

Audio- und Textserver sind getrennte Profile mit getrennten Zugangsdaten.

- Audio: `<Basisadresse>/audio/transcriptions`, Multipart, manuelle Modell-ID.
- Text: `<Basisadresse>/chat/completions`, nicht streamender kleiner
  Chat-Completions-Vertrag, manuelle Modell-ID.
- Optional: `<Basisadresse>/models` für eine Modellliste.
- Entfernte Ziele müssen HTTPS verwenden. Unverschlüsseltes HTTP ist nur auf
  Loopback zulässig.
- URL-Zugangsdaten, Query, Fragment und Redirects werden abgelehnt.
- Der Server muss für Web-Nutzung die Nivune-Origin per CORS erlauben.

Die vollständigen Verträge stehen in
[TRANSCRIPTION_PROVIDERS.md](TRANSCRIPTION_PROVIDERS.md),
[TEXT_REFINEMENT_PROVIDERS.md](TEXT_REFINEMENT_PROVIDERS.md) und
[PROVIDER_CREDENTIALS.md](PROVIDER_CREDENTIALS.md).

## Betrieb und Updates

Ein Update wird aus einem festgelegten Quellcommit gebaut. Vor dem Wechsel sollten
Browserdaten exportiert und der bestehende Stand erreichbar bleiben. Nach
`git checkout <commit>` werden beide `npm ci`-Installationen und die
Verifikationskette erneut ausgeführt. Abhängigkeiten dürfen nicht durch ein
ungeprüftes `npm update` außerhalb des Lockfiles ersetzt werden.

Öffentliche Instanzen brauchen HTTPS, aktuelle Sicherheitsupdates, ein begrenztes
Zugriffsprotokoll ohne Diktattexte oder Keys und eine klare Datenschutzerklärung.
Nivune selbst benötigt keine Server-Secrets. Anbieter-Keys gehören niemals in
Build-Variablen, Quellcode oder Reverse-Proxy-Logs.

## Nachweis und verbleibende Grenzen

Der lokale Produktionsbuild, Schutzheader, Service-Worker-Grenzen,
Loopback-Adapter und ein Web-Offline-Neustart aus App-Hülle und Modellcache wurden
geprüft. Ein lokaler kompatibler Audio- und Textserver sowie Ollama wurden über
echte Loopback-Anfragen geprüft. Noch nicht als allgemeine Zusage freigegeben sind
ein fremder Self-Hosting-Anbieter, jede mögliche kompatible Serverimplementierung,
mobile Offline-Nutzung und die vollständige Browsermatrix.
