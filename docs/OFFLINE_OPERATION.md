# Offline-Betrieb

Stand: 14. September 2026

Dieses Dokument beschreibt den unveröffentlichten 1.0-Entwicklungsstand. Es
trennt die installierte App-Hülle, lokale Modellgewichte und einen vollständigen
Netztrennungsnachweis voneinander.

## Web

`public/sw.js` installiert den versionierten Cache `nivune-shell-v2`. Darin
liegen ausschließlich der Arbeitsbereich `/app`, Manifest, Icon und die aus der
gebauten Arbeitsbereichsseite ermittelten `/_next/static/`-Ressourcen.
Laufzeit-Fetches werden nur für dieselben Pfade und nur bei GET-Anfragen ergänzt.
Die öffentliche Website unter `/`, `/en` und den Rechtsseiten wird nicht gecacht.
Ältere Installationen mit dem früheren Startpfad `/` erhalten ohne Netz den
gecachten Arbeitsbereich; mit Netz lädt `/` die Website, die installierte
Web-Apps direkt nach `/app` weiterleitet. Beim Aktivieren löscht der Worker den
alten Cache `nivune-shell-v1`.

**Geprüft am 23. September 2026:** Produktionsbuild über `next start`, Cache
`nivune-shell-v2` mit `/app` und statischen Ressourcen; danach Server beendet.
`/app` und der alte Startpfad `/` öffneten beide den Arbeitsbereich aus dem Cache.

Nicht gecacht werden fremde Origins, `/api/*`, der Service Worker selbst sowie
Antworten mit `Cache-Control: private` oder `no-store`. OpenAI- und andere
Provider-Antworten liegen außerhalb der Service-Worker-Scope und werden nicht
als App-Hülle gespeichert. Der Modellcache von Transformers.js bleibt davon
getrennt.

Die Einstellungen zeigen:

- Zustand der Offline-App-Hülle,
- geschätzten freien Browserspeicher,
- eine Warnung, falls der Platz für das gewählte Backend/Modell voraussichtlich
  nicht reicht,
- fehlende Persistenzgarantie des Browsers und einen verlorenen/unvollständigen
  Modellcache.

Ein Modelldownload versucht auf ausdrücklichen Nutzerbefehl persistenten
Browserspeicher anzufragen. Eine Ablehnung wird nicht als Garantiefehler
verschwiegen: Der Cache wird weiterhin geprüft und kann bei Speicherdruck vom
Browser entfernt werden.

## Desktop

Vor dem lokalen Diktat prüft der Main-Prozess, ob gemeinsamer Kern,
Transformers-Bundle und beide ONNX-WASM-Dateien im App-Paket vorhanden sind.
Fehlende Dateien ergeben einen sichtbaren Runtime-Fehler und blockieren Download
und Diktat, statt später in einem unspezifischen Workerfehler zu enden.

Modellgewichte bleiben im Chromium-Profil der Desktop-App. Nach vollständigem
Download werden sie mit `local_files_only` geöffnet. Ein fehlender oder für das
aktuelle Backend unvollständiger Cache wird im Modellmanager angezeigt.

## Nachweis und Grenze

Im lokalen Produktionsbuild wurde die Offline-Hülle als bereit angezeigt. Danach
wurden der einzige Browser-Tab und der Next.js-Ursprungsserver beendet. Ein neuer
Tab auf derselben Adresse startete dennoch vollständig, erkannte Whisper base als
bereit und transkribierte die synthetische 3,109-Sekunden-WAV in rund 15 Sekunden
zu »Dies ist ein lokaler Diktatest für Nivune.«. Ein separater `curl`-Aufruf
erhielt währenddessen unmittelbar `connection refused`; Browser-Konsolenfehler
traten nicht auf.

Damit sind App-Hülle, Ursprungsserver-Ausfall und lokaler Cachepfad real geprüft.
Das ist noch kein vollständiger Netztrennungsnachweis: Das Gerät hatte weiterhin
allgemeinen Internetzugang, und es liegt noch kein Netzwerkmitschnitt gegen alle
externen Hosts vor. Desktop-Modellstart ohne Netz, echte Mikrofonaufnahme und
Windows bleiben ebenfalls offen.

## Lokale Textüberarbeitung

Ein vollständig lokaler Auftrag kombiniert lokales Whisper mit ausgeschalteter,
regelbasierter oder lokaler Ollama-Überarbeitung. Der gemeinsame Auftragsplan
enthält in dieser Kombination keine OpenAI-Stufe und keine Referenz auf
Cloud-Zugangsdaten. Ollama wird ausschließlich über eine Loopback-Adresse
angesprochen; HTTP-Umleitungen werden nicht verfolgt.

Die Ollama-Integration selbst benötigt keinen externen Laufzeitimport. Ollama und
das gewählte Textmodell müssen separat auf dem Gerät vorbereitet sein. Im Web
muss Ollama zusätzlich den Origin der Nivune-Installation zulassen; diese
Browser-CORS-Anforderung ist keine Cloud-Verbindung. Details und der aktuelle
Prüfstand stehen in [Lokale Textüberarbeitung](LOCAL_REFINEMENT.md).

Auf dem Test-Mac wurde der Web-Zugriff auf Ollama 0.34.0 und das lokal installierte
`qwen3:0.6b` real bestätigt. Der temporäre Dienst war an `127.0.0.1` gebunden,
Ollama Cloud war explizit deaktiviert und die Inferenz lief über Apple Metal. Das
belegt den lokalen Transport, ersetzt aber keinen vollständigen Netzwerkmitschnitt.
Das kleine Modell bestand den Inhaltstest nicht; Nivune verwarf seine Antworten
zugunsten des Rohtexts.
