# Transkriptionsarchitektur

## Qualitätsmodus

Der Qualitätsmodus ist der Standard für den täglichen Gebrauch.

1. Web oder Desktop nehmen das Audiosignal lokal auf.
2. Nach dem Stoppen wird die Aufnahme an OpenAI `gpt-transcribe` gesendet.
3. Sprache, Nutzungskontext und Wörterbuchbegriffe werden als Erkennungshinweise
   mitgegeben.
4. `gpt-5.4-mini` glättet den Text vorsichtig, ohne Inhalt oder Ton zu verändern.
5. Eine deterministische Nachkorrektur schützt bekannte Eigennamen und Marken.
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

In der Web-App liegt der persönliche API-Key im lokalen Browserspeicher. Das ist
für die private Nutzung ohne eigenen Server pragmatisch, aber nicht für ein
öffentlich verkauftes Produkt gedacht. Die Desktop-App verschlüsselt den Key
mit den Sicherheitsfunktionen des Betriebssystems.

## Lokalmodus

Desktop-Diktate und Datei-Uploads nutzen im Lokalmodus Whisper über transformers.js.
Dabei verlässt Audio das Gerät nicht. Beim ersten Einsatz wird das gewählte Modell geladen und anschließend
gecacht. Dieser Modus ist privater, benötigt aber mehr lokalen Speicher und ist
je nach Gerät langsamer und ungenauer. Web-Diktate im bisherigen „Lokal“-Modus
nutzen dagegen die Browser Speech API. Diese kann einen externen Sprachdienst
verwenden und garantiert keine Offline- oder geräteinterne Verarbeitung.

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

Eine Live-Vorschau per Browser Speech API gibt es nur im Browser-Erkennungsmodus.
Der Qualitätsmodus zeigt während der Aufnahme einen Hinweis statt einer Vorschau;
sein Text stammt ausschließlich aus der aufgenommenen Audiodatei. Auf Wunsch des
Nutzers wird kein teureres Realtime-Modell eingebaut
und die Endqualität nicht für schnellere Vorschauen abgesenkt. Eine spätere
Realtime-Erweiterung muss optional bleiben und Kosten/Qualität transparent machen.
Die bestehende Browser-Vorschau kann browserabhängig einen externen Sprachdienst
nutzen; nur lokales Whisper garantiert geräteinterne Erkennung.

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
