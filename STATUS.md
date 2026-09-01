# Klartext Status

Stand: 1. September 2026

## Produktziel

Persönliches Diktier- und Transkriptionswerkzeug für Jakob und Bekannte auf Web,
macOS und Windows. Qualität vor Live-Geschwindigkeit, kein kostenpflichtiges
Realtime-Upgrade im Standardmodus. Kein Verkaufsstart.

## Aktueller Stand

- Desktop 0.1.3 behebt den nachgewiesenen Mac-Konflikt zwischen einer seit dem
  27. August laufenden Entwicklungsinstanz und `/Applications/Klartext.app`.
  Entwicklung nutzt nun ein getrenntes Profil und einen abweichenden Shortcut.
  `EPIPE` an einem geschlossenen Terminal wird behandelt statt den Main-Prozess
  zu beenden. Aufnahme- und API-Fehler landen zusätzlich im lokalen Protokoll.
- Der Audiokanal wird nach der Mikrofonfreigabe explizit aktiviert. Fehler aus
  AudioContext und Mikrofon werden vollständig abgefangen, sichtbar gemeldet und
  setzen den App-Zustand zurück. Das schließt einen gemeinsamen Mac-/Windows-
  Fehlerpfad; die genaue Ursache des Windows-Vorfalls ist ohne damaliges Protokoll
  nicht nachgewiesen.
- Safari-/Web-Fix: Qualitätsaufnahme ohne parallele Browser-Spracherkennung,
  MP4/AAC-Präferenz mit Format-Fallback und vollständigem Abschluss. Keine stille
  Ausgabe von Browser-Text bei Aufnahme- oder API-Fehlern. Dauerhafter Ergebnisstatus,
  Retry mit derselben Aufnahme bzw. nur dem vorhandenen Rohtext beim Feinschliff.
  Qualitätsmodelle unverändert. Die später ergänzten Desktop-Korrekturen sind in
  Version 0.1.3 zusammengefasst.
- Die Web-App hat ein neues, hochwertiges Workspace-Interface mit responsiver
  Navigation, Einstellungs-Drawer und hellem sowie dunklem Design.
- Der Qualitätsmodus nutzt `gpt-transcribe` und gibt Kontext, Sprache und
  persönliche Fachbegriffe bereits bei der Erkennung mit.
- Ein vorsichtiger Feinschliff über `gpt-5.4-mini` korrigiert Interpunktion,
  Füllwörter und klare Selbstkorrekturen, ohne den Inhalt umzuschreiben.
- Lokales Whisper bleibt für Desktop und Datei-Uploads erhalten. Web-Diktate im
  bisherigen „Lokal“-Modus verwenden die Browser Speech API, nicht lokales Whisper.
- Datei-Uploads nutzen je nach gewähltem Modus OpenAI oder lokales Whisper.
- Direkte Cloud-Uploads ohne verpflichtenden Browser-Decoder. Große Dateien
  werden an leisen Stellen in Abschnitte unter 24 MB geteilt. Browser-Aufteilung:
  bis 100 MB und 30 Minuten. Kein stiller Wechsel zu lokalem Whisper.
- Uploads überleben den Bereichswechsel; Teilfehler werden klar markiert.
  Originale bleiben erhalten, unvollständige Feinschliff-Ausgaben werden verworfen.
- Sigill-Korrektur ist wortgrenzensicher und stabil bei wiederholter Anwendung.
- Desktop 0.1.3: Autostart bei Anmeldung, abschaltbar. Vorbereitung im Hintergrund,
  ohne Mikrofonaufnahme/API-Kosten. Nur im Lokalmodus wird Whisper vorab geladen.
  Ein systemseitig deaktivierter Autostart wird nicht automatisch reaktiviert.
- Die Desktop-App nutzt denselben Qualitätsmodus, speichert den API-Key über den
  OS-geschützten Verschlüsselungsdienst in ihrer lokalen Einstellungsdatei und fügt Ergebnisse
  an der aktuellen Cursor-Position ein.
- Der Web-Produktionsbuild und der Electron-Smoketest sind grün.
- Reale Tests auf dem Mac: Web 22 von 22 Wörtern korrekt, Desktop nach
  Eigennamen- und Zeichensetzungsoptimierung 21 von 21 Wörtern korrekt.
- Aktuelle Installationsdateien wurden für macOS Apple Silicon und Windows x64
  unter den stabilen Downloadnamen gebaut und inhaltlich geprüft.
- Website enthält noindex/nofollow. Weiterhin per Link erreichbar, kein Login.

## Verifiziert in diesem Stand

- 39 automatisierte Regressionstests grün, darunter getrennte Entwicklungsprofile
  und Shortcuts, EPIPE-Behandlung, fehlertolerantes Dateilogging, Aktivierung und
  Fehler eines pausierten AudioContext sowie Recorder-Ausfall ohne stillen
  Browser-Fallback, späte Stop-Daten, leeres Audio, Timeout, Mikrofonverweigerung,
  Retry ohne zusätzliche Audioanfrage beim Feinschliff sowie sechsminütiges Stereo-PCM,
  vollständige Chunk-Abdeckung, Upload-Routing, Teilfehler, Feinschliff-Grenzen,
  Wörterbuch und plattformübergreifende Autostart-Logik (OS-API gemockt).
- Web-Produktionsbuild und TypeScript-Prüfung grün.
- Web-UI im lokalen Produktionsbuild geprüft: fehlender Key blockiert den Start,
  öffnet Einstellungen und bleibt anschließend als dauerhafter Hinweis sichtbar.
  Screenshot im Desktoplayout, keine Browser-Konsolenfehler. Kein echter Safari-
  End-to-End-Sprachtest. Ein kurz gestarteter lokaler Mikrofontest wurde durch
  Schließen des Tabs ohne Transkriptionsanfrage abgebrochen.
- Electron-Smoke-Test des gepackten Mac-Programms bis zum geladenen Renderer grün,
  mit isoliertem temporären Profil und ohne Aufnahme, API oder Autostart.
- Zusätzlicher Startversuch des Mac-Pakets wartete auf eine Schlüsselbundfreigabe
  für die neu signierte App und wurde beendet. Paket-Signaturprüfung ist grün;
  tatsächlicher Erststart mit Freigabe bleibt ein manueller Abnahmepunkt.
- Synthetische WAV: 199,26 Sekunden, 38.257.554 Bytes. Echter OpenAI-Upload im
  Browser erfolgreich, 394 Wörter, alle sechs Kontrollbegriffe, Anfang/Ende
  vorhanden. Bereichswechsel während der Verarbeitung erfolgreich.
- Defekte WAV ohne Audiosamples: verständlicher OpenAI-400-Fehler angezeigt.
- MP3-Direktupload derselben Aufnahme (2.392.129 Bytes) erfolgreich, 395 Wörter,
  sechs Kontrollbegriffe jeweils einmal. Eine zusätzliche Wortwiederholung zeigt,
  dass dies kein Nachweis fehlerfreier Erkennung ist.
- Mac- und Windows-Installer 0.1.3 gebaut. Paketinhalt beider Plattformen enthält
  Runtime-, Audio- und Logging-Fix sowie die unveränderten Qualitätsmodelle.
  Mac-Signaturprüfung grün. Prüfsummen in desktop/RELEASE_CHECKSUMS.md.
- Die lokale Installation auf diesem Mac wurde auf 0.1.3 aktualisiert. Genau eine
  Produktionsinstanz läuft; Qualitätsmodus, gespeicherter Key und Autostart-
  Einstellung wurden erkannt. Echter Sprachtest mit 0.1.3 noch offen.

## Noch manuell prüfen

1. Mac 0.1.3 mit dem kurzen Diktattest prüfen. Danach eine Anmeldung neu starten
   und den Autostart bestätigen. Ohne Apple-Notarisierung kann macOS die
   Registrierung blockieren.
2. Windows 0.1.3 installieren und Mikrofon, Diktat, Excel-Einfügen und Autostart
   erneut prüfen. Bei einem Fehler über das Tray „Diagnoseprotokoll anzeigen“
   öffnen. Der Build und die gemockten Tests ersetzen diese Abnahme nicht.
3. Eine echte längere Sprachmemo (M4A/MP3) sowie optional weitere WAVs testen.

## Bereitstellung

Bestehendes Projekt: Yipyipya/klartext, Vercel-Produktionszweig main.
Adresse: https://klartext-ai.vercel.app
Safari-Fix e855ded209f78086d1b85121f428930251fbfd51 auf main übernommen.
Vercel-Produktion erfolgreich (Deployment 6119223758); normale Adresse im Browser
mit neuem Diktat-Editor geprüft. Der echte Safari-Sprachtest bleibt offen.
noindex und Downloadlinks wurden beim vorherigen Release bestätigt.
GitHub-Release v0.1.2 ist der bisher veröffentlichte Desktop-Stand. Release 0.1.3
ist lokal gebaut und geprüft, die Veröffentlichung steht noch aus.
