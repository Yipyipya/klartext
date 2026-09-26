# Transkriptionsarchitektur

## Qualitätsmodus

Der Qualitätsmodus ist der Standard für den täglichen Gebrauch.

1. Web oder Desktop nehmen das Audiosignal lokal auf.
2. Nach dem Stoppen wird die Aufnahme an OpenAI `gpt-transcribe` gesendet.
3. Sprache, Nutzungskontext und Wörterbuchbegriffe werden als Erkennungshinweise
   mitgegeben.
4. `gpt-5.4-mini` glättet den Text vorsichtig, ohne Inhalt oder Ton zu verändern.
5. Eine deterministische Nachkorrektur wendet ausschließlich das Wörterbuch des
   jeweiligen Nutzers an. Neue Profile enthalten keine persönlichen Markenregeln.
6. Im Web bleiben Ergebnis, Original und Verlauf lokal im Browser. Desktop fügt
   den Text an der Cursorposition ein und hält ihn in der Zwischenablage.

Wenn der Text-Feinschliff ausfällt, bleibt die ursprüngliche Transkription erhalten.
Im Web wird dies dauerhaft als Warnung angezeigt, nicht automatisch kopiert und
noch nicht im Verlauf gespeichert. Ein erneuter Feinschliff nutzt den vorhandenen
Rohtext, ohne die Audioanfrage zu wiederholen. Die zusätzliche Stufe läuft nicht
im wortgetreuen Modus.

Im Web startet der Qualitätsmodus ausschließlich MediaRecorder, ohne parallele
Browser-Spracherkennung. Bevorzugt wird MP4/AAC, danach WebM/Opus und schließlich
das Standardformat des Browsers. Konstruktor- und Startfehler probieren das nächste
Format. Ohne Timeslice wird eine vollständige Aufnahme beim Stoppen abgegeben.
Auch automatisch beendete Recorder behalten ihre finalen Daten; auf noch ausstehende
Stop-Ereignisse wird höchstens zehn Sekunden gewartet. Leere Aufnahmen oder Fehler
sind kein Erfolg. Es gibt keinen stillen Rückfall auf Browser-Text.

Schlägt die Audioanfrage fehl, bleibt die Aufnahme nur im Arbeitsspeicher dieses
Tabs für einen erneuten Versuch. Neuladen, Schließen oder ein neues Diktat verwirft
sie. Ein geänderter API-Key wird beim Retry berücksichtigt. Erneute API-Anfragen
können weitere Kosten verursachen. Modus, Sprache, Kontext und Wörterbuch werden
für jede Aufnahme beim Start festgehalten. Erst ein vollständiges Ergebnis wird
als Erfolg markiert, im Verlauf gespeichert und gegebenenfalls automatisch kopiert.

In der Web-App liegt der persönliche API-Key weiterhin im lokalen Browserspeicher,
seit dem unveröffentlichten 1.0-Entwicklungsstand aber getrennt vom versionierten
Einstellungsprofil. Das ist eine Browser-Sicherheitsgrenze und kein OS-Schlüsselspeicher.
Die Desktop-App verschlüsselt den Key mit den Sicherheitsfunktionen des
Betriebssystems und hält auch den verschlüsselten Wert in einer getrennten
Zugangsdaten-Datei. Alte 0.3.0-Profile werden vor der Migration gesichert.

## Lokalmodus

Desktop-Diktate, Web-Diktate und Datei-Uploads nutzen im unveröffentlichten
1.0-Entwicklungsstand Whisper über transformers.js. Das Web-Diktat nimmt zuerst
eine vollständige Audiodatei auf, dekodiert sie zu 16-kHz-Mono-PCM und sendet sie
an denselben lokalen Worker wie der Dateiweg. Die Browser Speech API wird nicht
mehr verwendet. Beim ersten Einsatz wird das gewählte Modell geladen und im
Browserprofil gecacht. Audio wird für die Inferenz nicht an einen Sprachanbieter
gesendet; der Modelldownload benötigt zunächst eine Netzverbindung.

Die Desktop-App lädt transformers.js und die ONNX-WASM-Laufzeit nicht mehr von
einem CDN, sondern bündelt JavaScript, WASM und dessen Loader im App-Paket. Die
Modellgewichte werden weiterhin beim ersten Einsatz geladen und im App-Profil
gecacht. Ein echter Offline-Neustart nach dem Download ist noch nicht abgenommen;
deshalb ist der Entwicklungsstand noch kein veröffentlichtes Offline-Versprechen.

## Datei-Uploads

Unterstützte Dateien bis 24 MB gehen unverändert an OpenAI. Ein Browser-Decoder
ist dafür nicht erforderlich. Die Dauer wird nur bestmöglich aus Metadaten gelesen.
Große oder nicht direkt unterstützte Dateien werden lokal in PCM dekodiert und
in WAV-Abschnitte unter 24 MB zerlegt. Die Cloud-Vorbereitung behält die Kanäle
bei und arbeitet mit 48 kHz. Schnitte bevorzugen leise 200-ms-Fenster; keine
Samples werden doppelt gesendet oder ausgelassen. Vorheriger Text dient als Kontext.
Die Browser-Aufteilung ist auf 100 MB und 30 Minuten begrenzt, um den RAM-Bedarf
einzugrenzen. Größere Aufnahmen lassen sich als MP3 unter 24 MB direkt hochladen.

Langer Feinschliff erfolgt in Textabschnitten. Unvollständige KI-Ausgaben werden
verworfen und das Original bleibt erhalten. Bei einem Fehler in einem Audioabschnitt
wird nur ein ausdrücklich als unvollständig markiertes Teilergebnis angezeigt,
nicht als fertiger Verlaufseintrag gespeichert. Erneutes Hochladen startet den
Auftrag neu und kann die bereits verarbeiteten Abschnitte erneut kosten.

## Echtzeitstufe zurückgestellt

Die Web-App zeigt während der Aufnahme in beiden Modi nur den echten Mikrofonpegel;
der Text entsteht nach dem Stoppen aus der vollständigen Aufnahme. Dadurch gibt es
keine parallele Browser-Spracherkennung und keinen versteckten externen Vorschauweg.
Die Desktop-App kann im Lokalmodus weiter eine lokale Whisper-Vorschau anzeigen.
Ein optionales Realtime-Modell bleibt späterem Umfang vorbehalten; die Endqualität
wird nicht für schnellere Vorschauen abgesenkt.

## Gemeinsamer Kern und Einstellungen (unveröffentlicht)

`shared/processing.ts` definiert den auftragsbezogenen Verarbeitungsplan,
Transkriptions-, Überarbeitungs- und Nachkorrekturstufen sowie den Erhalt des
Rohtexts. Web-Diktate, Web-Dateien und Desktop-Ergebnisse laufen bereits durch
diesen Kern. `shared/openai-provider.ts` stellt zusätzlich den gemeinsam genutzten
OpenAI-Netzwerkadapter für Transkription und Überarbeitung bereit; Web und Desktop
halten dafür nur noch plattformspezifische Aufrufhüllen.
`shared/provider-contracts.ts` macht Verarbeitungsort, Formate, Größenlimit,
Sprach-, Kontext-, Zeitmarken- und Modelllistenfähigkeiten explizit.

`shared/settings.ts` definiert Schema 1 mit getrennten Transkriptions- und
Überarbeitungsprofilen sowie referenzierten Zugangsdaten. Web und Desktop sichern
alte Daten, migrieren idempotent und ersetzen beschädigte Felder durch validierte
Werte. Bestehende Nutzer behalten den früher fest eingebauten Sigill-Eintrag als
eigenen Wörterbucheintrag; neue Profile erhalten weder diesen Eintrag noch den
früher persönlichen Standardkontext.

`shared/i18n.ts` ist die gemeinsame, typisierte Grundlage für deutsche und
englische Laufzeittexte. Sie formatiert Platzhalter, Zahlen und Datum/Uhrzeit
sprachabhängig. `interfaceLanguage` und `spokenLanguage` sind unabhängige Felder;
eine Änderung der Oberfläche darf daher die Erkennungssprache nicht verändern.
Die vollständige Überführung aller bestehenden Web- und Desktop-Texte in diesen
Katalog ist ein eigener, noch offener Oberflächenschritt.

## Desktop-Start

Die installierte App registriert sich standardmäßig als Anmeldeobjekt. Das lässt
sich im Tray deaktivieren. Änderungen in den Systemeinstellungen werden bei
späteren Starts respektiert. Entwicklung, Smoke-Tests und Start direkt aus einem
DMG registrieren keinen Autostart. Der Renderer wird im Hintergrund vorbereitet,
im Lokalmodus außerdem das Modell geladen. Es gibt dabei weder Mikrofonaufnahme
noch kostenpflichtige API-Anfrage. Mikrofonfreigaben werden beim ersten Diktat
angefragt. Ohne Apple-Notarisierung kann die Autostart-Registrierung scheitern;
das Tray zeigt den vom System gemeldeten Status. Ein echter Anmeldungstest bleibt
auf beiden Plattformen notwendig.

## Zugriff

Die bestehende Vercel-Adresse bleibt per Link erreichbar. noindex/nofollow-Metadaten
bitten Suchmaschinen, die Seite nicht zu indexieren. robots.txt erlaubt den Abruf,
damit Suchmaschinen diese Metadaten sehen können. Kein Login/Zugriffsschutz.
