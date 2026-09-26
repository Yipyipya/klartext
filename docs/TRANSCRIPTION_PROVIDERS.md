# Cloud-Transkriptionsadapter

Stand: 17. September 2026

Dieses Dokument beschreibt den unveröffentlichten ersten K14-Teilstand. OpenAI
bleibt das voreingestellte Profil für »Beste Qualität«. Groq und eigene
OpenAI-kompatible Audio-Endpunkte können im unveröffentlichten Web- und
Desktopstand bewusst gewählt werden. Deepgram bleibt entsprechend der
Versions-Roadmap bis 1.1 ohne
Oberflächenfreigabe. Unvollständige Profile werden vor Aufnahme und Import
gestoppt; es gibt keinen stillen Anbieterwechsel.

## Implementierte Verträge

| Anbieter | Endpunkt und Transport | Modellvorgabe | Grenze im Adapter |
| --- | --- | --- | --- |
| OpenAI | Multipart an `/v1/audio/transcriptions` | `gpt-transcribe` bleibt Qualitätsstandard | 24 MB konservatives App-Limit |
| Groq | Multipart an `/openai/v1/audio/transcriptions` | manuelle Modell-ID, vorgesehen `whisper-large-v3` | 24 MB, damit auch der dokumentierte Free-Tier-Pfad sicher bleibt |
| Deepgram | Audiodaten als Request-Body an `/v1/listen` | manuelle Modell-ID, vorgesehen `nova-3` | dokumentiertes Maximum 2 GB; App-Dateipfad erhält zusätzliche eigene Speichergrenzen |
| OpenAI-kompatibel | Multipart an `<Basisadresse>/audio/transcriptions` | zwingende manuelle Modell-ID | standardmäßig 24 MB, später pro Profil änderbar |

Groq erhält die dokumentierten Felder `file`, `model`, `language`, `prompt`,
`response_format` und `temperature`. Deepgram erhält Modell, Sprache,
`smart_format=true` und aus Datenschutzgründen `mip_opt_out=true`. Beim
Nova-3-Pfad werden Einträge des Nutzerwörterbuchs als wiederholte `keyterm`-Werte
gesendet; freier persönlicher Kontext wird nicht als angeblich unterstützte
Deepgram-Fähigkeit ausgegeben.

Quellen: [Groq Speech to Text](https://console.groq.com/docs/speech-to-text),
[Groq OpenAI-Kompatibilität](https://console.groq.com/docs/openai),
[Deepgram Pre-Recorded Audio](https://developers.deepgram.com/docs/pre-recorded-audio)
und [Deepgram API-Referenz](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded).

## Sicherheitsgrenzen

- Alle Anbieteranfragen verwenden `redirect: error`. Ein Authorization-Header
  wird daher nicht an ein Umleitungsziel weitergegeben.
- Eigene entfernte Server müssen HTTPS verwenden. Unverschlüsseltes HTTP ist nur
  für `localhost`, `127.0.0.1` oder `::1` zulässig.
- Zugangsdaten, Query und Fragment sind in einer kompatiblen Basisadresse nicht
  erlaubt. Ein lokaler kompatibler Server darf ohne API-Key arbeiten.
- Leere Audiodaten, fehlende Modelle, Anbietergrößenlimits, ungültiges JSON und
  leere Transkripte werden als Fehler behandelt; es gibt keinen stillen Wechsel
  zu einem anderen Anbieter.
- Schlüsselspeicherung, Profilaktivierung, Modelllisten und sichtbare
  Verbindungsprüfung sind für Groq und kompatible Web-/Desktop-Transkription angebunden.
  Der Adapterkern selbst speichert weiterhin keine Zugangsdaten.

## Prüfstand und Grenze

Der aktuelle Gesamtsatz mit 120 automatisierten Tests ist grün. Die K14-Tests prüfen die exakten
Groq-/Deepgram-Felder, Header, Dateinamen, Sprachabbildung, Datenschutzparameter,
Nova-3-Keyterms, Größenlimits, Abbruch, 401, 429, ungültiges JSON, leere Antworten,
Basisadressen und Redirect-Sperre. Ein echter lokaler HTTP-Smoke bestätigt für
einen kompatiblen Server Multipart-Datei, Modell, Authorization-Header und
Antwortparsing. Zusätzlich prüfen Profil-, Diktat- und Dateiimporttests die
explizite Groq-/Serverwahl. TypeScript, Web-Produktionsbuild und
Desktop-Shared-Bundle sind grün; Web und Electron-Einstellungen wurden visuell
und über den Accessibility-Baum abgenommen, der Webstand ohne Konsolenfehler.

Ohne bereitgestellte Groq-/Deepgram-Zugänge wurden keine kostenpflichtigen
Anbieteranfragen ausgeführt. Browser-CORS, echte kurze Aufnahmen, 401/429 gegen den
jeweiligen Dienst und die tatsächliche Modellqualität bleiben deshalb offen.
Implementiert und automatisiert geprüft ist der Adapterkern; als nutzbar
veröffentlicht ist weiterhin nur der bisherige Stand 0.3.0.
