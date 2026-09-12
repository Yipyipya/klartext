# Klartext — Designexploration

Stand: 12. September 2026. Archiv der Richtungsentwürfe. Resonanz wurde gewählt und anschließend in Web und Desktop umgesetzt; aktuelle Regeln und Prüfung in `../docs/DESIGN_SYSTEM.md` und `../STATUS.md`.

## Auftrag und Rahmen

Ein eigenständiges, hochwertiges Interface für die vorhandene Web-App und die Electron-Apps. Hauptaufgabe: einen Gedanken aufnehmen und als brauchbaren Text weiterverwenden. Kleine Desktop-Oberflächen sollen den Arbeitsfluss erhalten; Einstellungen bekommen zusätzlich ein eigenes Fenster. Projektname Klartext bleibt vorläufig erhalten. Zielgruppe gemäß STATUS.md: Jakob und Bekannte, persönliche Nutzung, kein Verkaufsstart.

Gesetzt: bestehende Transkriptionsmodi, Qualitätsaufnahme ohne Live-Textversprechen, Sprachen, Verlauf, Dateiimport, persönliche Sprachaktivierung und systemweites Einfügen. Technik: Next/React im Web, Electron mit separaten HTML-Renderern auf Desktop. Keine neuen Leistungs- oder Datenschutzbehauptungen. Web-Browser-Erkennung und lokales Whisper müssen sprachlich auseinandergehalten werden.

## Exploration

Sechs Ausgangsideen wurden nach Passung und Tragfähigkeit über mehrere Oberflächen gefiltert:

- **Resonanz / Sprachinstrument:** Präzision und eine Aufnahmeöffnung als gemeinsames Signal. Zur Ausarbeitung gewählt.
- **Satz / Schreibraum:** Inhalt und typografischer Rhythmus führen. Zur Ausarbeitung gewählt.
- **Regie / Tonstudio:** Aufnahmezustände und direkte Steuerung führen. Zur Ausarbeitung gewählt.
- **Partitur:** Zeit und Wortgruppen auf parallelen Spuren; verworfen, da das Produkt keinen zeitbasierten Audioeditor anbietet.
- **Dialog:** Chatblasen als Grundstruktur; verworfen, da Transkription kein Gespräch mit einem Assistenten ist.
- **Atem:** Organische Formen und langsame Bewegung; verworfen, weil eine dekorative Daueranimation Status und Verarbeitungszeit verschleiern könnte.

## Drei Richtungen

### Resonanz — Empfehlung

Visuelle These: Ein präzises Instrument nimmt Gedanken auf und tritt hinter das fertige Wort zurück.

Herkunft: Mikrofonöffnung, Aufnahmesignal, Schreibcursor. Vertikale Navigation, offener Arbeitsraum, zurückhaltende Einstellungen. Kühle weiße und silbrige Flächen; Signalblau für aktive Aufnahme und Auswahl; dunkle Tinte für Inhalt. Systemnahe Sans für Bedienelemente und Text. Die Aufnahmeöffnung ist das einzige große Formelement. Auf Desktop reduziert sie sich zum kompakten Sprachzeichen.

Passung: verbindet große Web-Oberfläche und kleine Desktop-Signale ohne dauernde visuelle Lautstärke. Risiko: Kreis und Balken sind allein noch keine unverwechselbare Identität. Die Weiterentwicklung muss die Transformation von Stimme zu Text als Verhalten präzisieren, statt zusätzliche Dekoration hinzuzufügen.

### Satz

Visuelle These: Gesprochene Sprache erhält die Ruhe und Lesbarkeit einer guten Textseite.

Herkunft: Manuskript, Korrekturzeichen, Satzspiegel. Horizontale Navigation, breiter Schreibraum, Serifenschrift für den Inhaltsbereich und sachliche Sans für Bedienelemente. Helles Papier, dunkle Schrift, ziegelrote Schreibmarke. Signaturelement: vertikaler Cursor als Anfang und Fokus des Textes.

Passung: stärkste Konzentration auf das Ergebnis. Risiko: literarische Wirkung könnte dem gewünschten hochmodernen Charakter widersprechen. Papier und Serif sind nur über den konkreten Schreibraum begründbar, nicht als allgemeines Premiumsignal.

### Regie

Visuelle These: Aufnahme und Verarbeitung lassen sich so eindeutig lesen wie ein Instrument im Studio.

Herkunft: Pegelanzeige und Transportsteuerung. Schmale Werkzeugleiste, breite Aufnahmefläche, dunkle Stahlflächen, helle Schrift, warmes Signallicht. UI-Sans und Monospace ausschließlich für Zeit und Messwerte. Signaturelement: klare Pegelzone.

Passung: stärkste Sichtbarkeit von Zuständen, besonders auf Desktop. Risiko: technische Anmutung und zu kleine Icon-Navigation. In der Umsetzung wären klare Labels und ausreichende Ziele nötig.

## Interaktive Vorschau

`directions.html` ist ohne Abhängigkeiten lokal ausführbar. Die drei Richtungen, vier Aufnahmezustände und ein Einstellungsdialog lassen sich erkunden. Alles ist ausdrücklich simuliert. Die Vorschau startet kein Mikrofon, ruft keine APIs auf und speichert keine Einstellungen. Navigation und Einstellungsrubriken illustrieren die Struktur; sie sind noch keine fertigen Produktfunktionen.

Lokaler Start aus dem Projekt: `python3 -m http.server 4318 --bind 127.0.0.1 --directory design`

## Umsetzung nach Richtungswahl

1. Designbrief und Token-Rollen verbindlich ausarbeiten; helle und dunkle Ausprägung derselben Richtung.
2. Web-Diktat mit leerem, aufnehmendem, verarbeitendem, fertigem und fehlgeschlagenem Zustand. Originalvergleich, Wiederholung und Kopieren erhalten.
3. Dateiimport und Verlauf in dasselbe System übertragen; keine Änderungen an der Transkriptionsarchitektur.
4. Eigenständiges Electron-Einstellungsfenster mit geprüfter IPC-Anbindung: Sprache, Modus, Schlüsselstatus, Sprachaktivierung, Autostart und Berechtigungen. Bestehende Einstellungsquellen wiederverwenden.
5. Aufnahmeblase, Schlüssel- und Sprachaktivierungsfenster vereinheitlichen. Fokus des ursprünglichen Textfelds beim Diktieren bewahren.
6. Visuelle Prüfung auf Desktop, schmalen Ansichten, in beiden Themes und mit reduzierter Bewegung. Regressionstests, Build, Electron-Smoke-Test. Native Windows-Abnahme gesondert kennzeichnen.

## Auswahlpunkt

Der ausdrücklich aktivierte Creative Design Director Skill verlangt bei einer großen Richtungsentscheidung eine Nutzerwahl vor der tiefen Umsetzung. Die Vorschau macht diese Entscheidung konkret. Die Nutzerwahl erfolgte: Resonanz, mit verfeinerten Dateien- und Verlauf-Icons. Die Integration ist inzwischen umgesetzt.

## Visuelle Prüfung und offene Verfeinerung

- Alle drei Richtungen in Browseransichten geprüft, einschließlich Aufnahme und Beispielergebnis.
- Mobile Breite 390 px: kein horizontaler Seitenüberlauf in allen drei Richtungen. Einstellungsdialog auch in schmaler Ansicht sichtbar.
- Dialog öffnen, Escape, Tab-Fokus und Schalterzustand geprüft. JavaScript-Syntax geprüft.
- Unabhängige Designkritik empfiehlt Resonanz. Bereits umgesetzt: sichtbarer Ergebnistext statt Aufnahmeinstrument; expliziter Verarbeitungsstatus in Satz; deaktivierte Hauptaktion während simulierten Verarbeitens.
- Für die nächste Phase offen: Ergebnis benötigt eine kompaktere Kopfzeile sowie echte Kopier-/Bearbeitungsaktionen. Aufnahme und Verarbeitung müssen auch formal deutlich verschieden sein. Signatur im Einstellungsfenster vertiefen; Beschriftung und Zielgrößen der kleinen Bedienelemente vergrößern.
- Anti-KI-Audit: dekorative seitliche Striche an der Aufnahmeöffnung entfernt. Keine erfundenen Kennzahlen oder Belege; Beispieltext gekennzeichnet. Die Richtungen sind bewusst noch keine behauptete Studio-Endqualität. Insbesondere Resonanz muss über sein Verhalten eigenständiger werden, da Kreis und Balken als isolierte Form bekannte Audiocodes sind.
- Keine Produktionsdateien geändert, keine native Desktop-Abnahme und kein Deployment erfolgt.
