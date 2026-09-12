# Klartext Status

Stand: 12. September 2026

## Produktziel

Persönliches Diktier- und Transkriptionswerkzeug für Jakob und Bekannte auf Web,
macOS und Windows. Qualität vor Live-Geschwindigkeit, kein kostenpflichtiges
Realtime-Upgrade im Standardmodus. Kein Verkaufsstart.

## Aktueller Stand

- Release 0.3.0 veröffentlicht: Mac- und Windows-Installer gebaut, alle Paketdateien
  gegen die Quellen geprüft, Mac-Signatur und isolierter Einstellungs-Smoke-Test
  erfolgreich. 57 Tests und finaler Web-Build grün. Prüfsummen stehen in
  `desktop/RELEASE_CHECKSUMS.md`.
- **Resonanz-Redesign veröffentlicht und auf diesem Mac installiert:**
  Web-Sprachraum mit dreiteiligem Aufnahmezeichen, unterscheidbaren Aufnahme- und
  Verarbeitungszuständen, direkt bearbeitbarem Text und kürzerer Zeilenbreite.
  Neue SVG-Icons für Dateien und Verlauf, helle/dunkle Darstellung, neue App-Icons.
  Einstellungen als nativer Web-Dialog mit Fokusbegrenzung und separaten Bereichen.
- **Neues Desktop-Einstellungsfenster:** Sprache, Modus, Modell, Kontext,
  Autostart, Sprachaktivierung, Berechtigungsstatus und Darstellung über validierte
  IPC-Aufrufe; vorhandene Tray-Einstellungen bleiben verfügbar und synchron.
  Separater Preload gibt keine Schlüsselwerte aus. Aufnahmeblase, Schlüssel- und
  Sprachaktivierungsfenster teilen die Resonanz-Gestaltung. Das Mac-Tray verwendet
  ein zur Systemdarstellung passendes Template-Zeichen.
- Resonanz geprüft: Produktionsbuild und TypeScript grün; 57 Regressionstests
  grün. Web-Ansichten und Dialog bei 1280×720 und 390×844 geprüft, keine horizontalen
  Überläufe in den Hauptansichten. Keine Browser-Konsolenfehler in der Prüfung.
  Natives Mac-Einstellungsfenster hell/dunkel, Kontextspeicherung und erneutes Laden
  sowie Schlüssel-Eingabefenster visuell und funktional geprüft. Sprachblasen-Markup
  hell/dunkel und Aufnahme/Verarbeitung ohne Audioaufnahme gerendert geprüft.
  Mac-App lokal gebündelt, Paketinhalt gegen Quellen und Signatur verifiziert;
  isolierter Einstellungs-Smoke-Test auch im Paket erfolgreich.
- Keine neue Mikrofon-/Cloud-End-to-End-Aufnahme und kein realer Windows-Test für
  das Redesign. Die Mac-App unter `/Applications/Klartext.app` wurde durch den
  geprüften Resonanz-Build ersetzt; Paketvergleich, Signatur und Start des neuen
  Einstellungsfensters bestätigt. Die vorherige App liegt unter
  `desktop/dist/install-backups/20260912-221540/Klartext.app`. Benutzerprofil und
  Sprachmodelle wurden nicht ersetzt. Die lokale Installation hat noch die
  Versionsnummer 0.2.2 bei identischem Resonanz-Funktionsstand; die veröffentlichten
  Installer sind als 0.3.0 gekennzeichnet. Entwicklungs-Vorschau läuft mit separatem Profil; für
  Abnahmen sind `--settings-preview` und `--settings-smoke-test` verfügbar.

- Desktop 0.2.2 unterstützt eine vollständig lokale, persönlich eingelernte
  Sprachaktivierung mit „Hey Klartext“. Das Modell bleibt lokal im Benutzerprofil;
  der Listener verursacht keine API-Kosten. Während eines Diktats wird der
  Wake-Word-Detektor nicht ausgewertet, sodass normale Wörter die Aufnahme
  technisch nicht mehr versehentlich beenden können.
- Diktate enden nach neun Sekunden bestätigter Stille oder sofort über den
  globalen Shortcut. Der akustisch nicht eindeutig trennbare Endbefehl
  „Klartext fertig“ wurde zugunsten zuverlässiger, vollständiger Aufnahmen
  deaktiviert. Ein vorhandenes Startmodell bleibt beim Update verwendbar.
- Der Stille-Autostopp misst ab 0.2.1 den tatsächlichen Diktat-Audiostream statt
  den Wake-Word-Listener. Nach bestätigter Sprache beendet er bei neun Sekunden
  Stille; ohne erkannte Sprache wartet er 20 Sekunden. Automatische Enden löschen
  kein Audio mehr. Damit werden leise Passagen und die letzten acht Sekunden
  längerer Aufnahmen nicht mehr versehentlich abgeschnitten.
- Das Wake-Word-Fenster arbeitet dauerhaft im Hintergrund, bleibt aber
  nicht fokussierbar. Dadurch behält das zuvor aktive Textfeld seinen Cursor und
  der fertige Text wird automatisch an derselben Position eingefügt. Der
  reservierte Endbefehl wird nur am Textende entfernt.
- Der Sprachstart wartet nicht mehr auf Schlüsselbund- oder bereits erteilte
  Mikrofonfreigaben. In 0.2.0 erschien die Aufnahme im realen Mac-Test 0,26
  Sekunden nach der Erkennung. In 0.2.2 dauerte es inklusive Bestätigung rund
  0,6 Sekunden vom erkannten Startkandidaten bis zur sichtbaren Aufnahme.
- Der Rustpotter-Listener lädt WASM und persönliche Modelle ohne Worker oder
  Dateisystem-Fetch. Das behebt sporadische Hänger beim normalen App-Start.
- Desktop 0.1.4 verhindert, dass eine veraltete macOS-Bedienungshilfe-Freigabe
  Aufnahme und Transkription blockiert. Beim Aufnahme-Start wird nur noch das
  Mikrofon angefragt. Fehlt die Freigabe fürs automatische Einfügen, wird der
  fertige Text zuverlässig in die Zwischenablage kopiert und verständlich gemeldet.
  Das Tray zeigt den Status und öffnet die passende Systemeinstellung explizit.
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
- Desktop ab 0.1.3: Autostart bei Anmeldung, abschaltbar. Vorbereitung im Hintergrund,
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

## Frühere Funktionsprüfungen (bis 0.2.2)

- 55 automatisierte Regressionstests grün, darunter getrennte Entwicklungsprofile
  und Shortcuts, EPIPE-Behandlung, fehlertolerantes Dateilogging, Aktivierung und
  Fehler eines pausierten AudioContext, die nicht blockierende macOS-
  Bedienungshilfenlogik sowie Recorder-Ausfall ohne stillen
  Browser-Fallback, späte Stop-Daten, leeres Audio, Timeout, Mikrofonverweigerung,
  Retry ohne zusätzliche Audioanfrage beim Feinschliff sowie sechsminütiges Stereo-PCM,
  vollständige Chunk-Abdeckung, Upload-Routing, Teilfehler, Feinschliff-Grenzen,
  Wörterbuch und plattformübergreifende Autostart-Logik (OS-API gemockt),
  Wake-Word-Zustände, unterschiedliche Start-/Stop-Empfindlichkeit, sichere
  Modellablage, ausschließlich im Ruhezustand aktive Starterkennung,
  Endbefehlsbereinigung und Stille-Autostopp auf dem tatsächlichen Aufnahmestream.
- Web-Produktionsbuild und TypeScript-Prüfung grün.
- Web-UI im lokalen Produktionsbuild geprüft: fehlender Key blockiert den Start,
  öffnet Einstellungen und bleibt anschließend als dauerhafter Hinweis sichtbar.
  Screenshot im Desktoplayout, keine Browser-Konsolenfehler. Kein echter Safari-
  End-to-End-Sprachtest. Ein kurz gestarteter lokaler Mikrofontest wurde durch
  Schließen des Tabs ohne Transkriptionsanfrage abgebrochen.
- Electron-Smoke-Test des gepackten Mac-Programms bis zum geladenen Renderer grün,
  mit isoliertem temporären Profil und ohne Aufnahme, API oder Autostart.
- Mac 0.2.2 real verifiziert: Der lokale Listener wird beim normalen Start bereit,
  „Hey Klartext“ startet, die Sprachblase erhält den Textfeldfokus und das
  automatische Einfügen funktioniert. Mehrere gesprochene Varianten von
  „Klartext fertig“ lösten keinen Stopp aus; ausschließlich der aufnahmeseitige
  Stillemonitor beendete den vollständigen Text nach ungefähr neun Sekunden Ruhe.
  Mikrofon- und Bedienungshilfenfreigabe wurden erneuert.
- Synthetische WAV: 199,26 Sekunden, 38.257.554 Bytes. Echter OpenAI-Upload im
  Browser erfolgreich, 394 Wörter, alle sechs Kontrollbegriffe, Anfang/Ende
  vorhanden. Bereichswechsel während der Verarbeitung erfolgreich.
- Defekte WAV ohne Audiosamples: verständlicher OpenAI-400-Fehler angezeigt.
- MP3-Direktupload derselben Aufnahme (2.392.129 Bytes) erfolgreich, 395 Wörter,
  sechs Kontrollbegriffe jeweils einmal. Eine zusätzliche Wortwiederholung zeigt,
  dass dies kein Nachweis fehlerfreier Erkennung ist.
- Mac- und Windows-Installer 0.2.2 gebaut. Paketinhalt beider Plattformen enthält
  Runtime-, Audio-, Logging-, Bedienungshilfen- und Sprachaktivierungs-Code sowie
  ausschließlich das Startmodell, den aufnahmeseitigen Stillemonitor und die
  unveränderten Qualitätsmodelle.
  Mac-Signaturprüfung grün. Prüfsummen in desktop/RELEASE_CHECKSUMS.md.
- Das gepackte Mac-Programm 0.2.2 startet im isolierten Smoke-Test bis zum
  geladenen Renderer ohne Mikrofon-, Bedienungshilfen- oder Autostart-Abfrage.
- Die lokale Installation wurde auf 0.2.2 aktualisiert und gegen den gebauten
  Paketinhalt geprüft. Genau eine Produktionsinstanz läuft; Qualitätsmodus,
  gespeicherter API-Key und Autostart-Einstellung sind erhalten.
- Windows 0.2.0 wurde real geprüft: Diktat, Fokus, automatisches Einfügen und
  Excel funktionierten. Der Bericht wies überlappende Wahr-/Fehlalarm-Scores,
  unzuverlässige Endbefehle und verfrühte Stille-Stopps nach. 0.2.1 behebt die
  zugehörigen Audioabschneidepfad. 0.2.2 entfernt zusätzlich den nicht sicher
  trennbaren Sprach-Endbefehl; der echte Windows-Laufzeittest bleibt erforderlich.

## Noch manuell prüfen

1. Auf dem Mac einmal ab- und wieder anmelden und den Autostart sowie die
   Sprachaktivierung nach der Anmeldung bestätigen.
2. Windows 0.2.2 installieren, das vorhandene Startmodell verwenden und Mikrofon,
   Diktat, Excel-Einfügen, Stille-Autostopp und Autostart real prüfen. Der
   plattformübergreifende Build und die gemockten Tests ersetzen diese Abnahme nicht.
3. Eine echte längere Sprachmemo (M4A/MP3) sowie optional weitere WAVs testen.

## Bereitstellung

Resonanz 0.3.0 ist seit 12. September 2026 veröffentlicht.
Bestehendes Projekt: Yipyipya/klartext, Vercel-Produktionszweig main.
Adresse: https://klartext-ai.vercel.app
Release-Quellstand: cdc5e65f13d8b7bcc2d9aca3fe0e85e038855ff1.
Vercel-Produktion erfolgreich (Deployment 6414036632); öffentliche Adresse mit
Resonanz im Browser visuell geprüft und HTTP-Antwort bestätigt.

GitHub-Release: https://github.com/Yipyipya/klartext/releases/tag/v0.3.0
Mac-Apple-Silicon-DMG, Windows-x64-Installer und SHA256SUMS.txt veröffentlicht.
GitHub-Dateigrößen und SHA-256 stimmen für alle drei Dateien mit lokalen Werten
überein. Beide stabilen `releases/latest/download`-Links führen auf v0.3.0 und
liefern HTTP 200 mit der erwarteten Größe. Das Mac-DMG hat zusätzlich eine
bestätigte Integritätsprüfung. Die bisherigen Versionen bleiben auf GitHub.

Der echte Windows-0.3.0-Laufzeittest, eine neue Mikrofon-/Cloud-End-to-End-Aufnahme
für das Redesign sowie der Test nach einer echten Systemanmeldung bleiben offen.
