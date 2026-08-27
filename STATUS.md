# Klartext Status

Stand: 27. August 2026

## Produktziel

Persönliches Diktier- und Transkriptionswerkzeug für Jakob und Bekannte auf Web,
macOS und Windows. Qualität vor Live-Geschwindigkeit, kein kostenpflichtiges
Realtime-Upgrade im Standardmodus. Kein Verkaufsstart.

## Aktueller Stand

- Safari-/Web-Fix: Qualitätsaufnahme ohne parallele Browser-Spracherkennung,
  MP4/AAC-Präferenz mit Format-Fallback und vollständigem Abschluss. Keine stille
  Ausgabe von Browser-Text bei Aufnahme- oder API-Fehlern. Dauerhafter Ergebnisstatus,
  Retry mit derselben Aufnahme bzw. nur dem vorhandenen Rohtext beim Feinschliff.
  Qualitätsmodelle unverändert; Desktop-Pakete für diesen Fix nicht verändert.
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
- Desktop 0.1.2: Autostart bei Anmeldung, abschaltbar. Vorbereitung im Hintergrund,
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

- 32 automatisierte Regressionstests grün, darunter Recorder-Ausfall ohne stillen
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
- Electron-Smoke-Test bis zum geladenen Renderer grün, ohne Aufnahme/Autostart.
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
- Mac- und Windows-Installer 0.1.2 gebaut; enthalten die unveränderten
  Qualitätsmodelle und neue Autostart-Logik. Prüfsummen in desktop/RELEASE_CHECKSUMS.md.

## Noch manuell prüfen

1. Safari nach dem Website-Update neu laden und den 30-Sekunden-Text aus
   evals/test-script.de.md erneut im Qualitätsmodus diktieren. Auf die ausdrückliche
   Abschlussmeldung warten. Bisheriger Safari-Nutzertest deutlich schlechter als
   Desktop; genaue Fehlerursache dieser Sitzung mangels Ereignisprotokoll nicht
   belegt. Der stille Fallback wurde im Code und mit gemocktem Recorder nachgewiesen.
   Automatisierte Tests ersetzen die echte Safari-/Mikrofonabnahme nicht.
2. Eine echte längere Sprachmemo (M4A/MP3) sowie optional weitere WAVs testen.
3. Mac 0.1.2 in Programme installieren. Autostart-Status und echte Anmeldung
   prüfen. Ohne Apple-Notarisierung kann macOS die Registrierung blockieren;
   dann einmalig in Anmeldeobjekte hinzufügen.
4. Windows 0.1.2 auf einem echten PC installieren: Diktat, Einfügen, Mikrofon,
   Anmeldung und Abschalten des Autostarts testen. Der Build allein ersetzt das nicht.

## Bereitstellung

Bestehendes Projekt: Yipyipya/klartext, Vercel-Produktionszweig main.
Adresse: https://klartext-adapt-learn.vercel.app
Safari-Fix e855ded209f78086d1b85121f428930251fbfd51 auf main übernommen.
Vercel-Produktion erfolgreich (Deployment 6119223758); normale Adresse im Browser
mit neuem Diktat-Editor geprüft. Der echte Safari-Sprachtest bleibt offen.
noindex und Downloadlinks wurden beim vorherigen Release bestätigt.
GitHub-Release v0.1.2 mit beiden unveränderten Installern bereitgestellt;
hochgeladene SHA-256-Prüfsummen stimmen mit den lokalen Dateien überein.
