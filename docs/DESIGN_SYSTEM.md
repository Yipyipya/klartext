# Klartext — Resonanz

Gewählt am 12. September 2026. Leitidee: Ein präzises Sprachinstrument nimmt einen Gedanken auf und tritt hinter den fertigen Text zurück.

## Gemeinsame Identität

- Kühle helle Flächen, dunkle blaue Tinte, Signalblau für Handlungen und Auswahl.
- Dunkle Ausprägung mit abgestuften blauen Grauwerten und helleren Signalfarben.
- Drei unterschiedlich lange Sprachbalken als gemeinsames Zeichen in App, Aufnahmeöffnung, Desktop-Blase, Einstellungen und App-Icon.
- Web: vorhandene Figtree, Desktop: Systemschrift. Großzügige, offene Textflächen; Radien und Linien dienen der Gruppierung.
- Dateien: eigens gezeichnetes Audiodokument. Verlauf: rücklaufende Uhr. Einheitlicher SVG-Konturstrich, optisch abgestimmte 20-px-Navigationsicons.

## Aufgaben und Zustände

Die Web-Aufnahmeöffnung gehört zum leeren Zustand. Beim Aufnehmen zeigt ein tatsächlicher Mikrofonpegel Aktivität, beim Verarbeiten eine deutlich andere Kreisform. Der fertige Text wird direkt bearbeitbar; die große Einführung weicht einer kompakten Kopfzeile. Die Zeilenbreite ist auf 75 ch begrenzt.

Ein fehlender API-Key wird am Modus und an der Hauptaktion als Einrichtungsbedarf gezeigt. Der Aufnahmestart öffnet die Transkriptionseinstellungen. Es wird kein Transkript vor Abschluss der Qualitätsaufnahme versprochen.

Auf der Diktatseite sitzt die Steuerung unter dem Editor. In den anderen Bereichen liegt sie oben, damit keine Datei- oder Datenschutzhinweise überdeckt werden. Der Verlauf nutzt offene Zeilen und reale Kennzahlen statt wiederholter Karten. Upload-Funktion, Verlauf, Originalvergleich und Wiederholungslogik bleiben erhalten.

## Einstellungen

Web: nativer modaler Dialog mit Fokusbegrenzung, Escape und vier Bereichen: Transkription, Sprache/Verhalten, Kontext, Wörterbuch. Werte bleiben im vorhandenen Browserspeicher.

Desktop: eigenes resizables Fenster mit Allgemein, Transkription, Sprachaktivierung, Berechtigungen, Darstellung. Bestehendes Tray bleibt verfügbar. Das Fenster nutzt dieselben Einstellungswerte wie das Tray, einen eigenen eingeschränkten Preload und validierte IPC-Aufrufe. Schlüsselwerte werden nicht an dieses Fenster ausgeliefert. Die vorhandene separate Schlüssel-Eingabe bleibt erhalten.

Hell/Dunkel/System gelten auf Desktop gemeinsam für die Fenster und Sprachblase; Web speichert seine Darstellung unabhängig. Schlüssel-Eingabe und Sprachaktivierung verwenden dasselbe Desktop-Stylesheet.

## Bewegung und Zugänglichkeit

Animationen zeigen Aufnahme/Verarbeitung. Keine permanente dekorative Animation. Reduzierte Bewegung wird respektiert. Zustände haben Textlabels. Sichtbarer Tastaturfokus, native Auswahlfelder, beschriftete Formularfelder. Kleine Fenstervarianten können intern scrollen.

Die Desktop-Sprachblase bleibt nicht fokussierbar, damit das ursprüngliche Textfeld seinen Cursor behält. Keine Änderung an der Audio-, Transkriptions- oder Einfügearchitektur.

## Prüfung

Die visuelle Abnahme umfasst Browseransichten, 390-px-Mobilansichten und das native Mac-Einstellungsfenster in beiden Erscheinungsbildern. Unabhängige Designkritik bestätigte die Icons; deren Hinweise zu Bereitschaft, Textbreite und überdeckender Steuerung wurden eingearbeitet. Build, Regressionstests und isolierte Electron-Tests ergänzen die visuelle Prüfung. Ein realer Windows-Laufzeittest bleibt separat notwendig.
