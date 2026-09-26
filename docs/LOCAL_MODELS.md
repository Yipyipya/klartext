# Lokale Modelle und Laufzeiten

Stand: 14. September 2026

Dieses Dokument beschreibt den unveröffentlichten 1.0-Entwicklungsstand. Ein
Modell gilt erst dann als »offline bereit«, wenn alle für das aktuelle Backend
benötigten Dateien vollständig im Browser- oder App-Profil liegen. Der Download
ist von der anschließenden lokalen Inferenz getrennt.

## Mitgelieferte Laufzeit

| Bestandteil | Version | Lizenz | Verteilung |
| --- | --- | --- | --- |
| `@huggingface/transformers` | 4.3.0 | Apache-2.0 | JavaScript wird für Desktop gebündelt; Web wird mit der App gebaut |
| `onnxruntime-web` | 1.31.0-dev.20260914-8d85527a0 | MIT | Desktop-Loader und -WASM werden im App-Paket mitgeliefert |

Desktop lädt diese beiden Laufzeitbestandteile nicht von einem CDN. Die
Modellgewichte selbst sind wegen ihrer Größe nicht Teil des Installers.

## Auswählbare Whisper-Modelle

| Auswahl | Repository und festgeschriebene Revision | Lizenz | Grobe Downloadgröße |
| --- | --- | --- | --- |
| Genauer | [`onnx-community/whisper-small`](https://huggingface.co/onnx-community/whisper-small) @ `36050c46d777d46dc4b5f43f6d90574fc38f8732` | Apache-2.0 | ca. 260 MB mit WASM/Q8 oder ca. 600 MB mit WebGPU |
| Schneller | [`onnx-community/whisper-base`](https://huggingface.co/onnx-community/whisper-base) @ `1846881b6b3a3024392c1eea3ad983695bc23925` | Apache-2.0 | ca. 85 MB mit WASM/Q8 oder ca. 215 MB mit WebGPU |

Die Größen sind bewusst als Gerätebereiche angegeben. WebGPU und WASM benötigen
unterschiedliche ONNX-Dateien; Browser-Metadaten und Tokenizer kommen hinzu.
Nivune macht daraus keine pauschale Geschwindigkeitszusage.

## Lebenszyklus und Datenschutz

1. Der Modellmanager prüft den Cache, ohne Audio aufzunehmen.
2. Erst ein sichtbarer Nutzerbefehl startet den Download von Hugging Face.
3. Fortschritt und ein unvollständiger Download werden angezeigt; der laufende
   Download kann abgebrochen werden.
4. Nach vollständiger Vorbereitung lädt der Diktierpfad das Modell mit
   `local_files_only`. Ein fehlender Cache führt zu einer sichtbaren Meldung und
   nicht zu einem stillen Netzwerk-Fallback.
5. »Modell löschen« entfernt alle Cachedateien dieses Modells einschließlich
   älterer, noch unter der Revision `main` gespeicherter Entwicklungsstände.

Audio und Transkript werden bei lokaler Inferenz nicht an Hugging Face oder einen
Sprachanbieter übertragen. Der einmalige Modelldownload benötigt Netzwerkzugriff.

## Prüfstand

Automatisiert geprüft sind Versions-Pins, Cacheklassifizierung, Downloadsteuerung,
Abbruch, Löschpfad und die Sperre vor nicht vorbereiteten Diktaten. Im
Web-Entwicklungsstand wurde Whisper base vollständig geladen und als bereit
erkannt. Eine synthetische deutsche WAV (3,109 Sekunden, 16 kHz mono) wurde
dreimal lokal transkribiert. Beim dritten Lauf waren der vorherige Tab und der
Ursprungsserver beendet; ein neuer Tab startete aus App-Hülle und Modellcache.
Alle Läufe ergaben »Dies ist ein lokaler Diktatest für Nivune.« und keine
Konsolenfehler. Der origin-offline Lauf dauerte rund 15 Sekunden; `curl`
bestätigte zeitgleich, dass Port 3000 nicht erreichbar war.

Der verwendete Codex-In-App-Browser meldete WebGPU; der kalte Pfad benötigte für
die kurze Datei dennoch rund 5:53 Minuten. Das ist eine konkrete Leistungsgrenze
dieser Testumgebung. Noch offen sind eine browserweite Netztrennung beziehungsweise
ein Netzwerkmitschnitt gegen externe Hosts, echte Mikrofonaufnahme,
Desktop-Download und -Inferenz sowie die Mac-/Windows-Abnahme. Bis diese Nachweise und eine tragbare
Leistung vorliegen, sind »vollständig offline geprüft« und Tempoaussagen nicht
freigegeben.
