# Nivune: Arbeitsplan bis zum öffentlichen Open-Source-Launch

Stand: 22. September 2026. Ausgangspunkt: veröffentlichte Version 0.3.0.
Status: Planung abgeschlossen; M1, M2 sowie K19–K25 auf dem Entwicklungsbranch
implementiert, Abnahme und weitere Meilensteine teilweise offen.
Dieses Dokument ist die maßgebliche Arbeitsliste. Erledigt bedeutet umgesetzt und
mit dem angegebenen Nachweis geprüft, nicht nur programmiert.

**Priorisierung vom 13. September:** Für den nächsten Launch-Kandidaten ist die
[Feature-Liste](FEATURE_STATUS.md) maßgeblich für Umfang und verfügbare Aussagen.
Dieser große Plan bleibt das vollständige Zielbild. Zusätzliche native Anbieter
und weitergehende Agentenschnittstellen dürfen später folgen; der erste Kandidat
priorisiert die alltägliche App, echten lokalen Betrieb und Englisch. Eine kleine
CLI kann separat als Developer Preview hinzukommen.

Ergänzung vom 13. September: [Vorschlag für Entwickler und Agenten](AGENT_LAYER_PROPOSAL.md).
Die zweite Zielgruppe wird zunächst mit einem unabhängig nutzbaren Kern und einer
begrenzten CLI erprobt. Die größere MCP-/SDK-Erweiterung bleibt ein Vorschlag.

## 1. Ziel und Produktentscheidung

Nivune soll gesprochene Gedanken zuverlässig in verwendbaren Text verwandeln:
beim Diktieren in anderen Apps, bei längeren eigenen Aufnahmen und beim Import
vorhandener Audiodateien. Die App ist kostenlos, ohne Nivune-Konto nutzbar,
offen weiterentwickelbar und unabhängig von einem einzelnen KI-Anbieter.

Das geplante öffentliche Versprechen lautet:

> Deine Stimme. Deine Modelle. Dein Text.
> Kostenloses Diktieren und Transkribieren, lokal oder mit deinem eigenen KI-Anbieter.

Die Software verlangt kein Abo und setzt keine künstlichen Wortkontingente.
Cloud-Anbieter können Gebühren und Nutzungslimits haben. Lokale Verarbeitung
benötigt passende Hardware und anfangs einen Modelldownload. Diese Unterschiede
stehen im Produkt an der Entscheidung, nicht versteckt im Kleingedruckten.

**Erste Zielgruppe als zu prüfende Hypothese:** Menschen, die täglich Nachrichten,
E-Mails, Notizen oder Arbeitsanweisungen am Computer schreiben, zwischen Deutsch
und Englisch wechseln und Kontrolle über Kosten und Daten wünschen. Ein Teil
kennt API-Keys bereits; für den anderen Teil muss der lokale Einstieg ohne Key
verständlich sein. Noch kein Nachweis, dass diese Gruppe Nivune bevorzugt.

**Hauptmaßstab:** Wie viel Zeit und Nacharbeit braucht ein Mensch bis zu einem
brauchbaren Text? Modellanzahl, GitHub-Sterne und Animationen sind keine Ersatzmaße.

### Wettbewerb und Chance

[Handy](https://github.com/cjpais/Handy) bietet bereits kostenloses Offline-Diktat.
[OpenWhispr](https://github.com/OpenWhispr/openwhispr) beschreibt lokale und
Cloud-Modelle mit eigenen Schlüsseln sowie weitere Arbeitsabläufe.
[Wispr Flow](https://wisprflow.ai/pricing) hat ebenfalls einen kostenlosen Plan.
Diese Angaben stammen aus den jeweiligen Projektseiten, abgerufen am
12. September 2026. Es wurde kein vergleichender Praxistest durchgeführt.

Daraus folgt: »gratis«, »Open Source« und »freie Modellwahl« sind für sich genommen
kein Alleinstellungsmerkmal. Unsere zu prüfende Chance ist ein ruhiges, einfaches
Werkzeug mit geringer Nacharbeit, transparentem Datenfluss und guter DE/EN-Nutzung.
Wir behaupten keine Überlegenheit, bevor gleiche Aufgaben praktisch verglichen wurden.

## 2. Gesicherter Ausgangspunkt und Lücken

| Bereich | Vorhanden | Für den Launch offen |
| --- | --- | --- |
| Web | Diktat, Audio-Import, Verlauf, Resonanz-UI | Anbieterprofile, echtes lokales Diktat, vollständige Übersetzung, robustere Job-Speicherung |
| Desktop | Systemweites Diktat, Tray, Sprachblase, Einstellungen, lokale Sprachaktivierung | Aufnahme-/Datei-Arbeitsbereich, Verlauf, Export, Anbieterprofile |
| KI | OpenAI-Aufrufe und zwei lokale Whisper-Auswahlen | Modelle/Endpunkte fest verdrahtet, Textüberarbeitung ebenfalls an OpenAI gebunden |
| Offline | Lokale Whisper-Verarbeitung vorhanden | Web-Diktat verwendet Browser Speech API; Desktop lädt die Laufzeit aus einem CDN. Kaltstart ohne Netz noch nicht abgesichert |
| Einstellungen | Browser-Speicherung, OS-verschlüsselte Desktop-Keys | Versionierte Migration, getrennte Zugangsdaten je Anbieter, Export ohne Secrets |
| Allgemeine Nutzung | Persönlicher Kontext und Wörterbuch | Fest eingebaute persönliche Korrekturen, z. B. Sigil → Sigill, dürfen fremde Texte nicht verändern |
| Qualität | 57 Tests, Web-Build, native Mac-Prüfungen | Aktuelle Windows-Abnahme, neue echte Aufnahmen, Wiederherstellung und Anbieterfehler |
| Verteilung | Vercel und GitHub-Releases | Eigene Projektlizenz, vollständige Drittanbieterhinweise, vertrauenswürdige Signaturen, Release-Automatisierung |
| Öffentlichkeit | Live-Web-App, bisher noindex | Landingpage, Einstiegshilfe, Datenschutzbeschreibung, Beta-Nachweise, Social-Video |

Quellbezug: `lib/store.ts`, `lib/cloud-transcribe.ts`, `lib/refine-transcript.ts`,
`lib/process-dictation.ts`, `lib/cleanup.ts`, `hooks/useDictation.ts`,
`components/UploadPanel.tsx`, `desktop/main.js`, `desktop/pill.html`,
`desktop/settings-contract.js`, `docs/TRANSCRIPTION_ARCHITECTURE.md`.

## 3. Umfang der ersten vollständigen Version

**Muss enthalten sein:** macOS Apple Silicon, Windows x64 und Web; Oberfläche auf
Deutsch und Englisch; systemweites Desktop-Diktat; eigene Mikrofonaufnahmen mit
Pause/Fortsetzen; Audio-Dateiimport; bearbeitbarer Text, Original, Verlauf und
TXT/Markdown-Export; echter lokaler Modus; getrennte Modellwahl für Sprache und
optionale Textüberarbeitung; freie kompatible Endpunkte; dokumentiertes Self-Hosting;
Open-Source-Lizenz; nachvollziehbare Datenkontrolle; geprüfte Downloads; Landingpage
und ein fertiges Social-Video.

**Später, nach Bedarf:** Linux, Intel-Mac, native Mobil-Apps, automatische
Meeting-Erkennung, Systemaudio/Loopback, Sprechertrennung, Cloud-Sync, Teamkonten,
Agenten, Übersetzungs-Workflows und zusätzliche native Anbieteradapter.
Die hier geplante Aufnahmefunktion umfasst Mikrofon und Dateiimport. Sie verspricht
noch keine vollständige Erfassung beider Seiten eines Online-Meetings.

TXT/Markdown sind verbindlich. SRT/VTT folgen nur mit verlässlichen Zeitmarken;
Text ohne Zeitinformationen wird nicht mit erfundenen Zeitmarken exportiert.

### Geplante Anbieterabdeckung

| Aufgabe | Zur ersten vollständigen Version | Verhalten |
| --- | --- | --- |
| Lokale Transkription | Gebündelte Whisper-Laufzeit, getestete kleine und größere Modelle | Keine API-Keys; Downloadgröße, Speicherbedarf und Geräteeignung sichtbar |
| Cloud-Transkription | OpenAI, Groq, Deepgram | Jeweils eigener Adapter, freies geeignetes Modell, eigene Zugangsdaten |
| Eigener Transkriptionsserver | OpenAI-kompatibler Audio-Endpunkt | Eigene Basisadresse, Modell-ID und optionaler Key; Fähigkeiten werden geprüft |
| Textüberarbeitung | Aus; deterministische Korrektur; OpenAI; Anthropic/Claude; Google/Gemini; OpenAI-kompatible Chat-Endpunkte; lokales Ollama | Unabhängig von der Transkription auswählbar; direkte Provider-Keys statt Pflichtumweg über einen Vermittler |
| Weitere Modelle/Anbieter | Adapter-Schnittstelle und dokumentierte Erweiterung | Keine erfundene universelle Kompatibilität |

Modelllisten werden abgerufen, wo die API das unterstützt. Eine manuelle Modell-ID
bleibt möglich. Ungeeignete Modelle erhalten einen verständlichen Fehler, keinen
stillen Wechsel auf einen anderen Anbieter. Ein Chat-Modell wird nicht als
Audio-Modell angeboten, nur weil beide beim selben Anbieter liegen.

Groq dokumentiert einen [OpenAI-kompatiblen Audio-Endpunkt](https://console.groq.com/docs/speech-to-text).
Deepgram hat eine [eigene API für aufgezeichnetes Audio](https://developers.deepgram.com/docs/pre-recorded-audio).
Ollama bietet eine [lokale API](https://docs.ollama.com/api/introduction).
Diese Schnittstellen sind Ausgangspunkte; konkrete Modelle und Parameter werden
bei der Implementierung erneut anhand der offiziellen Dokumentation geprüft.

Für native Textadapter dienen die [Claude Messages API](https://platform.claude.com/docs/en/api/http/messages/create)
und [Geminis Text-API](https://ai.google.dev/gemini-api/docs/text-generation)
als Referenz. Browser-Unterstützung und sichere direkte Key-Nutzung werden je
Anbieter geprüft; die Desktop-Unterstützung ist von Browser-CORS unabhängig.

## 4. Produkt- und Architekturregeln

1. **Einfacher Start, freie Details.** Erste Wahl: »Auf diesem Gerät« oder
   »Eigener Anbieter«. Unser bisheriges Setup bleibt ein änderbares Empfehlungsprofil.
   Modell-IDs, Endpunkte und Spezialparameter stehen in erweiterten Einstellungen.
2. **Datenfluss vor der Aufnahme sichtbar.** Etwa »Audio: auf diesem Gerät;
   Textüberarbeitung: aus« oder die jeweiligen Anbieternamen. Ein gemischter
   lokaler/Cloud-Workflow wird nicht als vollständig lokal bezeichnet.
3. **Keine versteckten Cloud-Rückfälle.** Im Offline-Modus bleiben beide Stufen
   lokal oder die Überarbeitung aus. Modellfehler erfordern eine bewusste neue Wahl.
4. **Ein gemeinsamer fachlicher Kern.** Audioauftrag, Transkription, Überarbeitung,
   Nachkorrektur, Fähigkeiten und Fehlertypen werden von Web und Desktop geteilt.
   Mikrofon, Dateisystem, Browser-Speicher, OS-Schlüsselspeicher und IPC bleiben
   plattformspezifische Adapter. Kein Komplettumbau des bewährten Audioverhaltens.
5. **Ein Auftrag behält seine Konfiguration.** Beim Start werden Anbieter, Modell,
   Sprache und Kontext festgehalten. Ein Wechsel in Einstellungen verändert keine
   laufende Aufnahme. Fehlgeschlagene Stufen sind gezielt wiederholbar.
6. **Inhalt bleibt unter Kontrolle.** Rohtext erhalten; keine erfundenen Ergänzungen.
   Textüberarbeitung darf Namen, Zahlen, Verneinungen und Absicht nicht still ändern.
   Schlüssel und Transkriptionsinhalte gehören nicht in Diagnoseprotokolle.
7. **Keine Nivune-Cloud für Audiodaten.** Anfragen gehen vom Gerät zum gewählten
   Anbieter. Für Browser-CORS oder lokale Server bauen wir keinen versteckten
   öffentlichen Proxy. Nicht unterstützte Browserwege werden ehrlich erklärt;
   Desktop oder selbst gehostete Einrichtung bleiben alternative Wege.
8. **Lokales Eigentum.** Verlauf abschaltbar, Daten exportierbar/löschbar. Keine
   standardmäßige Telemetrie. Freiwilliges Beta-Feedback ohne Mitsenden von Texten.
9. **Resonanz bleibt.** Drei Sprachbalken, ruhige Textflächen und präzise Zustände
   aus `docs/DESIGN_SYSTEM.md` werden weitergeführt. Neue Freiheit erzeugt keine
   überfüllte Hauptansicht. Tastatur, Screenreader und reduzierte Bewegung gehören dazu.

Vorgesehene neue Module: `shared/` für Verträge und Pipeline, `locales/de.json`
und `locales/en.json`, plattformspezifische Provider-/Speicheradapter sowie ein
separater Desktop-Arbeitsbereich. Die genaue Modulaufteilung wird in M1 festgehalten;
eine neue UI-Technologie ist kein Selbstzweck.

## 5. Abzuarbeitende Meilensteine

Abhängigkeiten: **M0 → M1 → M2 → M3 → M4 → M6 → M7 → M8.**
M5 wird organisatorisch ab M0 vorbereitet und technisch nach M3/M4 abgeschlossen.
M6 kann erste Teilprüfungen früher beginnen. Marketingtexte können früher entstehen;
fertige Produktaufnahmen werden erst aus dem geprüften Kandidaten erstellt.

### M0: Nutzen, Messverfahren und externe Voraussetzungen

- [ ] **K01** Einen kompakten Vergleich von Nivune, Handy und OpenWhispr planen:
  dieselben Diktate, Geräte und Bewertungskriterien; Unterschiede dokumentieren.
  Keine Wettbewerberdaten oder Marketingzahlen als eigene Messergebnisse ausgeben.
- [ ] **K02** Interviewleitfaden und Beta-Aufgaben für 5–8 erste Gespräche erstellen:
  bisherige Lösung, häufige Aufgabe, konkreter Frust, lokale Nutzung/API-Erfahrung,
  gewünschter Wechselgrund. Jakob vermittelt Teilnehmer oder gibt Einladungen frei.
- [ ] **K03** Rechte an Quellcode, Abhängigkeiten, Modellgewichten, Assets und Namen
  inventarisieren. MIT als Empfehlung mit Alternativen und Folgen vorlegen;
  Rechteinhaber und endgültige Lizenz vor deren Veröffentlichung bestätigen.
  **Teilstand 22. September:** MIT ist als Projektlizenz entschieden und im
  Quellstand umgesetzt. `docs/RIGHTS_INVENTORY.md` trennt Projektmaterial,
  generierte Bundles, mitgelieferte Laufzeiten, separat geladene Modelle und
  Anbieterbezeichnungen. Nicht verwendete Starter-Assets wurden entfernt.
  Die dokumentierte DPMAregister-/EUIPO- sowie Produkt-/Store-/Domain-Recherche
  in `docs/NAME_CLEARANCE.md` ist am 22. September abgeschlossen. Ergebnis:
  Der frühere Arbeitsname **Klartext** ist wegen zweier aktiver identischer
  deutscher Wortmarken in Klasse 9 und aktueller gleichnamiger Diktierprodukte
  für 1.0 gesperrt. **Nivune** ist als zufällig erzeugter, aussprechbarer Ersatz
  ausgewählt: die exakte Wortsuche in DPMAregister (Klassen 9/42) sowie aktuelle
  Produkt-/Store-/Repository-Recherche fanden keinen gleichnamigen
  Softwarekonflikt. `.app`, GitHub-Organisation und npm-Name erschienen frei;
  `.com` ist bereits bei einem Dritten registriert. Die technische Umstellung ist im
  Entwicklungsstand umgesetzt; externe Repository-/Webumbenennung und die
  Rechteinhaberbestätigung bleiben offen.
- [ ] **K04** Vorhandene Apple-/Windows-Signiermöglichkeiten, reale Testgeräte und
  verfügbare Anbieter-Testzugänge feststellen. Kostenplan für Zertifikate, Domain,
  optionale Videoerzeugung und API-Prüfungen erstellen; keine Käufe auslösen.
- [ ] **K05** Erste Nutzungshypothese, Ausgangsmessungen und priorisierte
  Friktionspunkte in `docs/PRODUCT_VALIDATION.md` festhalten.

**Abnahme:** Hypothesen sind als solche markiert; Testprotokoll und fehlende externe
Voraussetzungen sind konkret. Falls noch keine Teilnehmer verfügbar sind, dürfen
M1–M5 weitergehen. Nachfrage bleibt dann ausdrücklich unbestätigt.

### M1: Gemeinsamer Kern, Migration und Sprachgrundlage

- [x] **K06** Pipeline und Provider-Verträge aus Web/Desktop extrahieren. Fähigkeiten
  für Formate, Größen, Sprache, Zeitmarken, Modelllisten und Kontext abbilden.
  Änderungen am bestehenden Verhalten zunächst durch die vorhandenen Tests absichern.
- [x] **K07** Versionierte Einstellungen mit getrennten Transkriptions- und
  Überarbeitungsprofilen sowie referenzierten Zugangsdaten einführen.
  0.3.0-Daten sichern und idempotent migrieren; beschädigte Daten verständlich behandeln.
- [x] **K08** Persönliche Standardwerte und erzwungene Marken-Nachkorrekturen aus
  neuen Profilen entfernen. Bestehende persönliche Regeln als benutzereigene
  Wörterbucheinträge erhalten. Kein stiller Datenverlust beim Update.
- [x] **K09** Gemeinsame DE/EN-Textschlüssel und Formatierung einführen, damit alle
  folgenden Features direkt in beiden Sprachen entstehen. Oberflächensprache und
  gesprochene Sprache bleiben unabhängig.

**Abnahme:** Bestehende Diktate verhalten sich wie zuvor; Migration mit leerem,
altem und beschädigtem Profil geprüft; keine Schlüssel in UI-Snapshots, Exporten
oder Logs. Neue Nutzer erhalten keine persönlichen Wörterbuchregeln von Jakob.

### M2: Verlässliche lokale Nutzung

- [x] **K10** Inferenzcode, Worker und WASM mitliefern; Desktop-CDN-Import entfernen.
  Modelle in einem sichtbaren Modellmanager laden, validieren, abbrechen und löschen.
  Laufzeit-/Modellversionen und Lizenzen dokumentieren.
- [x] **K11** Browser-Diktate ebenfalls aufnehmen und lokal transkribieren.
  Browser Speech API nicht mehr als lokalen Modus verwenden. WebGPU/WASM-Fähigkeiten
  prüfen; bei unzureichender Leistung Grenzen offen anzeigen.
- [x] **K12** Offline-Neustart und Ressourcenverfügbarkeit absichern: Desktop nach
  Modelldownload ohne Netz starten; Web nach vorbereiteter Installation neu laden.
  App-Hülle und erforderliche Ressourcen cachen, sensible API-Antworten nicht cachen.
  Cache-Verlust und Speicherknappheit im Browser erkennbar machen.
- [x] **K13** Lokale Textüberarbeitung über Ollama und vollständig abgeschaltete
  Überarbeitung anbieten. Bei »vollständig lokal« keine Cloud-Stufe zulassen.

**Abnahme:** Neu gestartete App verarbeitet die Testaufnahme ohne Netzwerk nach
einmaliger Vorbereitung. Ein Netzwerkmitschnitt bestätigt keine Audio-/Textübertragung
und keine erforderlichen externen Laufzeitimporte. Download/Update und vollständiger
Offline-Betrieb sind klar getrennt. Gerätewerte statt pauschaler Tempo-Versprechen.

### M3: Freie Anbieter- und Modellwahl

- [ ] **K14** OpenAI-, Groq- und Deepgram-Transkriptionsadapter sowie kompatible
  eigene Audio-Endpunkte implementieren. Parameter, Dateiformate und Grenzen je
  Anbieter beachten; lokale Testserver für Fehlerfälle verwenden.
  **Teilstand 17. September:** Adapterkern implementiert; aktueller Gesamtsatz mit
  145 Tests und echter
  kompatibler Loopback-HTTP-Smoke grün. Reale Groq-/Deepgram-Anfrage und
  Freischaltung nach K16–K18 fehlen, daher noch nicht erledigt.
- [ ] **K15** OpenAI- und OpenAI-kompatible Textadapter sowie native Claude- und
  Gemini-Textadapter hinzufügen. Basisadresse, Modell und Zugangsdaten unabhängig
  konfigurieren; Ollama aus M2 integrieren. Zuerst OpenAI/kompatibel fertigstellen,
  danach die zwei nativen Adapter mit jeweils eigenem Vertrags- und Realtest.
  **Teilstand 17. September:** OpenAI, Ollama und der kompatible
  Chat-Completions-Adapter besitzen gemeinsame konservative Promptbausteine;
  Vertrags-/Langtexttests und echter kompatibler Loopback-Smoke sind grün. Web
  und Desktop bieten den Adapter mit getrennter Adresse, Modell-ID und optionalem,
  zielgebundenem Key an. Native Claude-/Gemini-Adapter und reale Modellabnahme fehlen.
- [ ] **K16** Verbindungen prüfen, Modelllisten laden und manuelle Modell-IDs
  unterstützen. Kostenpflichtige Probeaufnahmen vorher als solche kennzeichnen;
  fehlende Modelllisten bedeuten nicht automatisch ungültige Zugangsdaten.
  **Teilstand 17. September:** Groq- und optionale kompatible Modelllisten sowie
  manuelle Fallback-Semantik implementiert und automatisiert geprüft. Die
  unveröffentlichte Web-Oberfläche lädt Listen auf ausdrücklichen Befehl und
  bindet die Auswahl an Diktat und Dateiimport. Reale Anbieterprüfung fehlt.
- [ ] **K17** Geheimnisse je Anbieter und Zieladresse isolieren. Keine Weitergabe
  von Authorization-Headern an fremde Redirect-Ziele; kein Nivune-Fallback, wenn
  Desktop-OS-Verschlüsselung fehlt. Web standardmäßig Sitzungsschlüssel, bewusstes
  Speichern optional mit ehrlicher Erklärung der Browser-Sicherheitsgrenze.
  **Teilstand 17. September:** zentrale Referenzen und Speicherfilter trennen
  OpenAI, Groq und kompatible Audio-/Textziele; Redirect-Sperren sind geprüft.
  Der Web-Key eines kompatiblen Audioziels wird bei Adresswechsel geleert und
  nur für die exakt passende Zielreferenz gespeichert. Sitzungs-/Dauerspeicherwahl
  fehlen. Desktop-Profile sind inzwischen sichtbar angebunden, werden getrennt
  OS-verschlüsselt gespeichert und vom Diktierpfad ausgewertet.
- [ ] **K18** Nicht unterstützte Browser-CORS-/Localhost-Verbindungen erklären.
  Eigene Server nur über bewusst konfigurierte Ziele ansprechen. HTTPS für entfernte
  Server; lokale Verbindungen gesondert behandeln. Importierte Profile aktivieren
  keine fremden Server oder Schlüsselübertragung ohne sichtbare Nutzerentscheidung.
  **Teilstand 17. September:** Web aktiviert Groq/eigene Ziele ausschließlich
  durch sichtbare Auswahl, zeigt Audioziel, HTTPS-/Loopback-Grenze und
  Verbindungsstatus und fällt bei Fehlern nicht auf OpenAI zurück. Importfreigabe,
  detaillierte CORS-Hilfe und reale Fremdserverprüfung bleiben offen.

**Abnahme:** Jeder beworbene Provider hat mindestens eine echte kurze, freigegebene
End-to-End-Aufnahme bestanden. 401, 429, Timeout, Abbruch, leeres Ergebnis und
Teilfehler sind geprüft. Der Offline-Modus bleibt offline. Fehlender Testzugang
blockiert die Aussage »geprüft«, nicht die unabhängige Adapterarbeit.

### M4: Desktop-Arbeitsbereich, Einstieg und vollständiges Englisch

- [x] **K19** Desktop-Fenster für Diktat, Aufnahmen, Dateien und Verlauf erstellen.
  Die fokuserhaltende Sprachblase bleibt unabhängig; Desktop-Netzwerkzugriff und
  Dateizugriff laufen über eng begrenzte IPC-Schnittstellen.
  **Umgesetzt 17. September:** eigenständiger Resonanz-Arbeitsbereich mit vier
  zugänglichen Bereichen, sichtbarem Audio-/Text-Datenfluss und Einstieg in den
  bestehenden systemweiten Diktierweg. Der Renderer erhält nur einen redigierten
  Status und zwei validierte Aktionen; weder Schlüssel noch allgemeiner Datei-,
  Shell- oder Netzwerkzugriff werden exponiert. Am K19-Checkpoint waren K20/K21-
  Funktionen sichtbar als noch nicht verfügbar gekennzeichnet.
- [x] **K20** Mikrofonaufnahme mit Pause/Fortsetzen, Dateiimport und Warteschlange
  integrieren. Eine Aufnahme gleichzeitig; hörende Sprachaktivierung darf weder
  eine zweite Aufnahme starten noch gespeicherte Audiodateien als Befehl behandeln.
  Anfangs zuverlässige serielle Verarbeitung statt unkontrollierter Parallelität.
  **Umgesetzt 17. September:** Arbeitsbereich-Aufnahme mit explizitem Start/Pause/
  Fortsetzen/Abschluss/Verwerfen, nativer Einzelauswahldialog, Typ-/Signatur-/
  Größenprüfung im Main-Prozess und strikt serielle, abbrechbare Auftragsqueue.
  Profil und Wörterbuch werden bei Aufnahme- beziehungsweise Importstart festgehalten;
  lokale und Cloud-Aufträge laufen ohne Providerwechsel durch den gemeinsamen Kern.
  Sprachaktivierung und globaler Start bleiben während der K20-Audioarbeit gesperrt;
  importiertes Audio erreicht den Wake-Word-Prozess nie. Renderer-Snapshots enthalten
  weder Pfade, Audio, vollständige Verarbeitungskontexte/Ziele noch Keys; K21 ergänzt
  nur redigierte Anbieter-/Modellmetadaten. Der aktuelle Gesamtsatz mit 145 Tests,
  Produktionsbuild, Desktop-Bundles,
  Electron-Smoke und visuelle/Accessibility-Prüfung sind grün. Reale Mikrofon-/
  Datei-E2E-Abnahme auf Mac und Windows bleibt Teil der M4-Releaseabnahme.
  **Veröffentlicht:** nichts; öffentliche Web-App und Downloads bleiben 0.3.0.
- [x] **K21** Rohtext, bearbeitbares Ergebnis, lokale Suche, TXT/Markdown-Export,
  einzelne/gesamte Löschung und Export/Import von Einstellungen ohne Keys umsetzen.
  Teilresultate und fehlgeschlagener Feinschliff bleiben sichtbar nutzbar.
  **Umgesetzt 17. September:** atomarer lokaler Workspace-Verlauf mit Rohtext,
  Ergebnis, Warnung und redigierten Anbieter-/Modellmetadaten; keine Audio-, Pfad-,
  Kontext-, Wörterbuch- oder Key-Aufbewahrung. Beschädigte Dateien werden als
  Recovery gesichert. Bearbeitung, lokale Suche, TXT-/Markdown-Export sowie
  einzelne und gesamte Löschung sind verdrahtet. Settings-Export/-Import bleibt
  schlüsselfrei; importierte Netzwerkprofile und Sprachaktivierung werden nicht
  still aktiviert. 145 Tests, Produktionsbuild, Desktop-Bundles, Electron-Smoke
  sowie visuelle/Accessibility-Prüfung sind grün. Reale K20→K21-Persistenz und
  Windows-Dialoge bleiben offen; K22-Wiederherstellung ist automatisiert und im
  Renderer geprüft, aber noch nicht mit echter Mikrofonaufnahme abgenommen.
  **Veröffentlicht:** nichts; die installierte Alpha wurde nicht ersetzt.
- [x] **K22** Längere Aufnahmen in fortlaufenden lokalen Fragmenten sichern;
  Wiederherstellung nach App-Abbruch testen. Speicherort und Aufbewahrung sichtbar
  machen; standardmäßig Arbeitskopien nach erfolgreichem Abschluss entfernen,
  dauerhafte Audioaufbewahrung nur nach gewählter Einstellung. Wiederholungen
  dürfen nicht unbeabsichtigt alle schon bezahlten Abschnitte neu senden.
  **Umgesetzt 18. September:** `MediaRecorder` übergibt während der Aufnahme etwa
  alle fünf Sekunden ein Fragment an den Main-Prozess. Manifest, Fragmente,
  Reihenfolge, Größe und SHA-256-Prüfsummen werden atomar im privaten
  `workspace-recordings`-Bereich des Desktopprofils gehalten. Neustarts lösen
  keine Verarbeitung automatisch aus. Unterbrochene Cloud-Transkription oder
  -Überarbeitung erfordert wegen möglicher Kosten eine ausdrückliche Bestätigung;
  ein bereits gesicherter Rohtext überspringt beim Retry die Transkription.
  Erfolgreiches Audio wird standardmäßig entfernt. Nur die sichtbare
  Aufbewahrungseinstellung behält es und verknüpft den Löschweg mit dem Verlauf.
  145 Tests einschließlich simulierter 30-Minuten-Fragmentfolge, Neustart,
  Prüfsummen, Retry-Sicherheit und Löschung sowie Build, Bundles, Electron-Smoke
  und visuelle/Accessibility-Prüfung sind grün. Echte 30-Minuten-Aufnahme,
  Prozessabbruch, Cloud-Retry und Windows bleiben offen.
  **Veröffentlicht:** nichts; die installierte Alpha wurde nicht ersetzt.
- [x] **K23** Ersteinrichtung auf den ersten nutzbaren Text ausrichten:
  Sprache → lokal/eigener Anbieter → nötige Einrichtung → kurze Probeaufnahme.
  Autostart und Sprachaktivierung bewusst wählbar; Mikrofonzugriff zum passenden
  Zeitpunkt; bei fehlender Einfügefreigabe eine klare Zwischenablage-Lösung.
  **Umgesetzt 18. September:** eigenes sandboxed Einrichtungsfenster mit vier
  Schritten für Sprache, lokalen/OpenAI-/Groq-/kompatiblen Transkriptionsweg,
  nötigen Modell-/Key-Schritt, echte Probeaufnahme und Abschlussoptionen. Die
  Probe nutzt lokale Regeln statt einer zusätzlichen Cloud-Überarbeitung, fragt
  erst beim Start nach dem Mikrofon, zeigt den ersten Text im Fenster und kopiert
  ihn, ohne ihn im Einrichtungsstand zu persistieren. Autostart und
  Sprachaktivierung werden vor Abschluss nicht automatisch aktiviert;
  Sprachaktivierung setzt einen eingerichteten persönlichen Startbefehl voraus.
  145 Tests, Produktionsbuild, Desktop-Bundles, vier Electron-Smokes sowie
  visuelle/Accessibility-Prüfung aller Schritte sind grün. Reale Probeaufnahme
  und Abschlussauswahl im installierten Kandidaten stehen als Nutzerabnahme aus.
  **Veröffentlicht:** nichts; die installierte Alpha wurde nicht ersetzt.
- [x] **K24** DE/EN vollständig durchziehen: Web, Desktop, Tray, Fehlermeldungen,
  Hilfe, Downloadanleitung, Datums-/Zahlenformate, sprachneutrale Prompts und
  `lang`-Attribute. Englisch und gemischte DE/EN-Diktate real prüfen.
  **Umgesetzt und abgenommen 19. September:** Oberflächen- und gesprochene Sprache
  sind in Web und Desktop getrennt. Alle produktseitigen Web-/Desktop-Texte,
  Systemdialoge und dynamischen Zustände wechseln DE/EN, ohne Nutzerinhalte zu
  verändern. 146 Tests, TypeScript, Produktionsbuild, Desktop-Bundles, Syntax,
  visuelle/Accessibility-Prüfung und die Nutzerabnahme im Entwicklungsstand sind
  grün. Installierter Kandidat und Windows bleiben offen.

**Abnahme:** Diktat, eine längere eigene Aufnahme und Dateiimport funktionieren
auf Mac und Windows; Rohtext geht bei Fehlern nicht verloren. App-Abbruch,
Mikrofonwechsel, Ruhezustand und volle/gesperrte Speicherziele sind geprüft.
Erste Belastungsfälle: 30-Minuten-Aufnahme und 60-Minuten-Datei auf Desktop;
Grenzen werden anhand tatsächlichen RAM-/CPU-Verbrauchs gesetzt. Web-Grenzen
dürfen niedriger sein und werden vor dem Auftrag erklärt.

### M5: Open Source, Sicherheit und vertrauenswürdige Distribution

- [x] **K25** Nach Lizenzentscheidung LICENSE, Drittanbieterhinweise und
  Modelllizenzen ergänzen. README auf Englisch mit deutscher Variante,
  CONTRIBUTING, SECURITY, Bug-/Feature-Vorlagen und Adapter-Anleitung erstellen.
  **Abgeschlossen 22. September:** MIT-Lizenz, englisches Haupt-README und
  deutsche Variante, Beitrags- und Sicherheitsrichtlinie, Bug-/Feature-Vorlagen,
  Adapter-Anleitung, Rechteinventar und Drittanbieterhinweise liegen vor.
  Root- und Desktopmanifest sowie beide Lockfiles deklarieren MIT. Der frische
  Apple-Silicon-Kandidat enthält Projektlizenz, Notice-Index und die vollständigen
  Lizenztexte für Transformers.js, ONNX Runtime Web, Electron und beide
  rustpotter-Komponenten als Ressourcen. Drei neue Regressionstests sichern die
  Quellen und Paketkonfiguration. 170/170 Tests, TypeScript, Webpack-Build,
  Desktop-Bundles, vier Paket-Smokes, strikte Codesign-Prüfung, neun Fuses und
  ASAR-Inventar sind grün. Die Windows-Paketkontrolle bleibt Teil der echten
  Windows-Abnahme, nicht dieses lokalen macOS-Nachweises.
- [ ] **K26** Reproduzierbare Build-Anleitung und CI für Tests, Web-Build sowie
  native Mac-/Windows-Pakete einrichten. Abhängigkeiten/Modelle pinnen;
  veröffentlichte Dateien mit Quellcommit und Prüfsummen verbinden.
  Bit-identische Builds nur behaupten, wenn separat nachgewiesen.
  **Begonnen 20. September:** Node 24 ist als gemeinsame Laufzeit festgehalten;
  eine lokale Verifikationskette verbindet Tests, TypeScript, Web-Build und alle
  Desktop-Bundles. Ein CI-Entwurf prüft diesen Pfad bei Pull Requests und kann
  macOS-/Windows-Testpakete nur nach manuellem Start erzeugen. Ein getestetes
  Manifest bindet Artefakte an Commit, Dirty-Status, Plattform, Größe und SHA-256;
  `docs/BUILDING.md` beschreibt frisches Checkout und Grenzen. 151 Tests,
  TypeScript, Web-Produktionsbuild und Desktop-Bundles sind lokal grün. Ein
  temporäres Apple-Silicon-DMG wurde erzeugt; DMG-Integrität, strikte ad-hoc-
  Signatur, erwarteter Paketinhalt und isolierter Paketstart sind grün. Das
  portable Manifest nennt 195.802.921 Byte und SHA-256
  `541ac29f99d64e10777538e96624f515b75c393dccd325094c607306c89e7b9f`.
  CI und Windows-Zielsystemjob wurden noch nicht extern ausgeführt; eine
  Developer-ID-/Notarisierungsprüfung gehört weiterhin zu K27.
- [ ] **K27** Signierung vorbereiten und mit verfügbaren Identitäten ausführen:
  Mac Developer ID, Hardened Runtime, korrekte Entitlements, Notarisierung und
  Stapling; Windows passende Codesignatur mit Zeitstempel. Auf frisch geladenen
  Installern prüfen, nicht nur auf dem Entwicklungsgerät.
- [x] **K28** Einen Update-Hinweis mit klarer Versionsanzeige, Release-Notizen
  und offiziellem Download integrieren; keine stillen Installationen.
  Profilbackup und Rückweg bei Migration absichern. Vollautomatische Updates
  sind nachrangig gegenüber einer zuverlässigen manuellen Aktualisierung.
- [x] **K29** Gezielt prüfen: Electron-Sandbox/IPC, fremde Navigation, CSP,
  Secrets/Logs, Datei-/Profilimporte, Abhängigkeiten, Speicherlöschung und
  ausschließlich erklärte Netzwerkanfragen. Befunde nach Auswirkung priorisieren.
  **Abgeschlossen 21. September:** getrennte Frontend-/Desktop-Berichte und
  konsolidierter Reststatus unter `docs/SECURITY_AUDIT.md`. Renderer, Navigation,
  Mikrofon-Origin, CSP/Headers, Web-Sitzungskeys, LLM-Datentrennung, Recovery-
  Löschung, Größenprüfungen, Logrotation, Einstellungsimport, Paketinhalt, ATS und
  Electron-Fuses wurden gehärtet. Ein temporärer Mac-App-Build besteht Signatur-,
  Inhalts-, Fuse- und vier Renderer-Smokes. Systemdiktat und Arbeitsbereich-
  Aufnahme wurden danach real auf dem Mac bestanden; der nötige enge WebGPU-
  `blob:`-Pfad im Audio-Renderer ist durch einen Regressionstest gedeckt. Die
  Next.js 16.3.5, Transformers 4.3.0, alle vier Abhängigkeitsaudits, der
  vollständige Electron-43-Fuse-Satz und feste Web-Uploadgrenzen sind inzwischen
  grün. Echte Signierung, Onboarding/Sprachaktivierung und Windows bleiben
  Release-Gates.
- [x] **K30** Datenfluss und Self-Hosting dokumentieren. Eigenbetrieb von Web-App,
  Modellserver und optionalem Ollama getrennt erklären. Direkt nutzbarer Weg
  ohne Nivune-Infrastruktur nach initialem Download nachweisen.
  **Abgeschlossen 21. September:** `docs/SELF_HOSTING.md` beschreibt den lokalen
  Next.js-Produktionsbetrieb, HTTPS-/Headergrenzen, Browserdaten, lokales Whisper,
  Ollama und getrennte kompatible Audio-/Textserver. Der Nachweis stützt sich auf
  den geprüften Produktionsserver, Offline-Neustart, lokale Modellinitialisierung
  und echte Loopback-Smokes. Fremde Hostinganbieter und die vollständige
  Browsermatrix bleiben ausdrücklich außerhalb dieses Nachweises.

**Abnahme:** Ein frisches Checkout lässt sich anhand der Dokumentation bauen.
Neuinstallation und Upgrade von 0.3.0 erhalten Nutzerdaten. Keine offenen Fehler,
die Secrets offenlegen, Audio verlieren oder ungefragt übertragen.
Signierung ist kein Ersatz für den Funktionstest.

Apple beschreibt [Developer ID und Notarisierung](https://developer.apple.com/developer-id/).
Microsoft erklärt, dass auch gültig signierte neue Dateien zunächst
[SmartScreen-Warnungen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
haben können. Verfügbarkeit und Kosten einer geeigneten Windows-Signierung sind
vor Bestellung anhand des tatsächlichen Herausgebers zu klären.
Die [MIT-Lizenz](https://opensource.org/license/mit) ist für den 1.0-Quellstand
entschieden und im Repository hinterlegt. Öffentlich eingeräumt werden die Rechte
erst mit der Veröffentlichung dieses Stands.

### M6: Geschlossene Beta und messbarer Nutzen

- [ ] **K31** Ein freigegebenes Audiokorpus erstellen: mindestens 20 deutsche und
  20 englische Beispiele, zusätzlich Sprachwechsel, Eigennamen, Zahlen,
  Verneinungen, Selbstkorrekturen, Stille und Hintergrundgeräusche.
  Einwilligung und Verwendungsrechte für echte Stimmen dokumentieren.
- [ ] **K32** Genauigkeit und Arbeitsaufwand messen: Wortfehlerrate für Rohtext,
  Bedeutungsänderungen nach Überarbeitung, nötige Korrekturen, Zeit bis zum
  verwendbaren Text; außerdem Verarbeitungsdauer, RAM und Downloadbedarf je Gerät.
  Referenzgeräte und getestete Modelle im Ergebnis nennen.
- [ ] **K33** 12 Beta-Teilnehmer für sieben Tage einplanen, möglichst je sechs auf
  Mac und Windows, DE und EN vertreten, mindestens vier ohne API-Vorerfahrung.
  Durchführung hängt von realen Teilnehmern ab; keine simulierten Nutzerberichte.
- [ ] **K34** Die drei wichtigsten tatsächlichen Hürden beheben und betroffene
  Aufgaben erneut testen. Neue Features nur aufnehmen, wenn sie die Hürden lösen.
  Negative Ergebnisse dürfen die Positionierung oder den Launchumfang verändern.

**Vorläufige Zielwerte, keine Marktbenchmarks oder Erfolgsgarantie:**

| Messung | Ziel und Vorgehen |
| --- | --- |
| Einstieg | Mindestens 9 von 12 schaffen ohne persönliche Hilfe ihr erstes eingefügtes Diktat; Bedienzeit höchstens 5 Minuten. Modell-Download und externe Key-Beschaffung getrennt messen und trotzdem als Abbruchursache zählen |
| Wiederkehrender Nutzen | Mindestens 8 von 12 berichten Nutzung an mindestens drei Tagen innerhalb der Testwoche; freiwilliges Feedback, kein Tracking-Zwang |
| Wechselgrund | Mindestens 6 von 12 nennen eine konkrete wiederkehrende Aufgabe, für die sie Nivune ihrer bisherigen Lösung vorziehen |
| Korrekturaufwand | Gleiche Aufgaben mit bisheriger Methode vergleichen; gemessenen Vorteil oder Nachteil festhalten, keine pauschale »x-mal schneller«-Behauptung |
| Zuverlässigkeit | Kein stiller Audio-/Textverlust und keine unbeabsichtigte Übertragung im Abnahmekorpus; jeder Fehler zeigt einen nachvollziehbaren Wiederherstellungsweg |

Kleine Stichprobe: Diese Werte sind eine Entscheidungsstütze, kein statistischer
Nachweis breiter Nachfrage. Bei verfehltem Einstieg oder fehlender Wiederkehr
folgt eine gezielte Verbesserung und erneute kleine Beta, keine große Kampagne.

### M7: Landingpage und fertiges Social-Media-Video

- [ ] **K35** Designbrief aus Beta-Erkenntnissen erstellen. Resonanz beibehalten;
  zwei unterscheidbare Einstiege skizzieren: konkreter Schreibmoment und sichtbare
  Wahl des Verarbeitungsorts. Einen anhand Verständnis und Nutzen auswählen.
  Keine vollständige neue Markenrunde ohne nachgewiesenen Anlass.
- [ ] **K36** Landingpage DE/EN: reale Produktdemo, Download passend zum System,
  kurzer Einstieg, lokaler/Cloud-Datenfluss, ehrliche Kosten, Voraussetzungen,
  GitHub, Dokumentation und FAQ. Keine erfundenen Nutzerstimmen oder Leistungswerte.
- [ ] **K37** Bestehende Origin erhalten: Landingpage unter `/`, Arbeitsbereich
  unter `/app`; locale-spezifische Marketingseiten bei Bedarf unter `/de` und `/en`.
  LocalStorage-Daten bleiben dadurch erreichbar. Vorhandene PWA-Starts, Deep Links,
  Lesezeichen und Desktop-Web-Link migrieren/testen. Eine neue Domain ist optional
  und braucht einen expliziten Datenexport-/Importweg statt stiller Umleitung.
- [ ] **K38** Marketingseiten gezielt indexierbar machen, Arbeitsbereich weiterhin
  noindex. Sitemap, Canonicals, Sprachalternativen, echte Open-Graph-Vorschau,
  Datenschutzbeschreibung, Kontakt und erforderliche Anbieterangaben ergänzen.
- [ ] **K39** Ein Hauptvideo von ungefähr 30–45 Sekunden in 9:16 produzieren,
  deutsch und englisch, plus einen kurzen Schnitt von ungefähr 15 Sekunden.
  Sequenz: konkrete Schreibaufgabe → echtes Diktat → verwendbarer Text →
  lokale/eigene KI-Wahl → kostenlose App und Downloadadresse.
- [ ] **K40** Aus dem geprüften Release-Kandidaten aufnehmen; keine Keys,
  privaten Inhalte oder fremden Aufnahmen zeigen. Tatsächliche Wartezeit nicht
  durch irreführende Schnitte als Echtzeit ausgeben. Untertitel, Ton,
  mobile Lesbarkeit, Nutzungsrechte und Export prüfen. Video-Dateien liefern;
  konkrete Posts und Veröffentlichungskanäle erst nach Freigabe bedienen.

**Abnahme:** Mindestens fünf unbeteiligte Personen verstehen nach kurzer Ansicht
Nutzen, lokale/Cloud-Wahl und eventuelle API-Kosten. Website auf Mobil/Desktop,
Tastatur und Screenreader prüfen. Frische unabhängige Designkritik nach dem
Creative-Design-Director-Skill, höchstens zwei gezielte Korrekturschleifen.
Film- und formatspezifische Skills erst für die tatsächliche Produktion laden;
kostenpflichtige Generierung nur innerhalb eines freigegebenen Budgets.

### M8: Öffentlicher Launch und anschließender Betrieb

- [ ] **K41** Release-Kandidaten einfrieren; verbleibende Fehler und unterstützte
  Systeme offen dokumentieren. Freigabepaket mit Website-Vorschau, Installern,
  Testnachweisen, Lizenz, Kosten und fertigem Video erstellen.
- [ ] **K42** Nach konkreter Launch-Freigabe: GitHub-Release mit beiden Installern,
  Quellenbezug, Signaturen und Prüfsummen; Website über die bestehende
  GitHub-/Vercel-Verbindung veröffentlichen. Stabile Downloads und Produktionsseite
  bis zum tatsächlich erreichbaren Asset prüfen; getesteten Rückweg bereithalten.
- [ ] **K43** Freigegebene Kommunikation veröffentlichen: GitHub-README/Release,
  Social-Video und passende Community-Beiträge nach jeweiligen Regeln.
  Nivune als eigenes Projekt vorstellen, keine fingierten Empfehlungen.
- [ ] **K44** Nach 7 und 30 Tagen tatsächliche Probleme, freiwilliges Feedback und
  aggregierte Downloads auswerten. Automatische Nachkontrollen nur einrichten,
  wenn beauftragt. Downloadzahlen sind kein Beleg für aktive Nutzer.
- [x] **K45** Wartungsmodell dokumentieren: Sicherheitskontakt, Release-Rhythmus,
  Verantwortlichkeit für Anbieteränderungen, Übersetzungen und Fehlertriage.
  Freiwillige Unterstützung/Spenden optional, ohne die Kernfunktionen zu sperren.

**Abnahme:** Alle untenstehenden Launch-Kriterien erfüllt, Live-Seite und beide
Downloads geprüft, bekannte Grenzen sichtbar, erste Supportwege funktionieren.

## 6. Verbindliche Launch-Kriterien

- [ ] Alle sechs Nutzerwünsche umgesetzt: KI-Freiheit, Desktop-Aufnahmen/Import,
  Englisch, geklärte Lizenz/Signierung, Landingpage und fertiges Social-Video.
- [ ] Eigene Open-Source-Lizenz entschieden und veröffentlicht; Drittanbieterrechte
  berücksichtigt. Keine unbestätigten Datenschutz- oder Leistungsversprechen.
- [ ] Echte lokale Nutzung nach Neustart ohne Netz auf den beworbenen Wegen belegt.
- [ ] Jede als unterstützt beworbene Anbieter-/Plattformkombination tatsächlich
  geprüft; Ausnahmen in einer verständlichen Kompatibilitätsmatrix.
- [ ] Mac und Windows: Neuinstallation, Upgrade, Diktat, Aufnahme, Import,
  Dateiexport, Fokus/Einfügen, Fehlerwiederholung und echte Systemanmeldung geprüft.
- [ ] Web: Chrome/Edge auf Windows sowie Chrome/Safari auf Mac; Firefox soweit
  beworben. iOS-Safari/Android-Chrome für die beworbenen Web-Funktionen prüfen;
  eingeschränkte lokale Fähigkeiten nicht verschweigen.
- [ ] Keine offenen kritischen Fehler: Schlüsselabfluss, ungefragte Aufnahme,
  unbemerkte Cloud-Nutzung, Datenverlust, falsche Erfolgsmeldung oder nicht
  funktionierendes Update. Geringfügige Einschränkungen dürfen dokumentiert bleiben.
- [ ] DE/EN, Tastatur, Fokus, Kontrast, 200-%-Zoom und mobile Ansichten geprüft.
- [ ] Downloads signiert/notarisiert, soweit plattformspezifisch vorgesehen;
  nach Download auf einem frischen System geprüft. Falls Zertifizierung fehlt,
  ist eine ausdrücklich gekennzeichnete Beta möglich, kein stilles Abhaken.
- [ ] Nutzenprüfung mit realen Menschen dokumentiert. Bei schwachen Ergebnissen
  kleinere Beta fortsetzen und Gründe beheben, Reichweite nicht künstlich skalieren.
- [ ] Finale API-Testkosten, Zertifikate, mögliche Domain und Videoausgaben sind
  bekannt; keine unbemerkten laufenden Kosten für Jakob.

## 7. Externe Entscheidungen und Arbeitsweise

| Thema | Eigenständig vorbereiten | Benötigte Mitwirkung |
| --- | --- | --- |
| Lizenz und Name | MIT, Rechteinventar, Notice-Paketierung, Klartext-Ausschluss und Nivune-Vorprüfung/Quellumstellung umgesetzt | Rechteinhaberschaft bestätigen; Repository/Webadresse extern umbenennen, bevor 1.0-Links veröffentlicht werden |
| Signierung | Verfahren, CI und Installer | Vorhandene Herausgeberidentität; gegebenenfalls Anmeldung, Identitätsprüfung und bezahlte Zertifikate |
| Anbieterprüfungen | Adapter, lokale Testserver, kurze Probedateien | Geeignete Keys sicher bereitstellen und begrenzte echte API-Nutzung freigeben |
| Windows | Build, Tests und genaue Abnahmeschritte | Echtes Windows-Gerät oder erreichbarer Tester; Mac-Cross-Build genügt nicht |
| Nachfrage | Interviewleitfaden, Aufgaben, Feedbackauswertung | Reale Teilnehmer; Einladungen/Nachrichten nur mit entsprechender Freigabe |
| Video und Öffentlichkeit | Fertige Dateien, Texte und Live-Vorschau | Budget für optionale Fremdleistungen und Freigabe konkreter Posts/Launch |

Fehlende externe Voraussetzungen halten nur abhängige Arbeit auf. Keine erneute
Rückfrage zu bereits festgelegten reversiblen Entscheidungen. Vor einer nötigen
Freigabe wird das konkrete Ergebnis fertig vorbereitet. Die Freigabe des bisherigen
0.3.0-Releases ersetzt keine noch offene Lizenzentscheidung oder neue Ausgaben.

Für jedes Arbeitspaket werden hier oder in einem verlinkten Nachweis vier Angaben
festgehalten: Änderung, Prüfung, Ergebnis, verbleibende Grenze. Keine automatischen
Tests für reine Text-/Layoutkosmetik; sinnvolle Tests für Migration, Datenverlust,
Netzwerkgrenzen, Providerverhalten und Audiozustände. Visuelle Änderungen im echten
Medium prüfen. Keine unaufgeforderten Commits auf den Produktionszweig während
der Entwicklung; die bestehende Live-Version bleibt bis zum Release stabil.

**Nächster Arbeitsblock:** einen aktuellen installierbaren Kandidaten vorbereiten
und anschließend K23/K24 sowie die reale K20–K22-Mikrofon-/Datei-/Recovery-
Abnahme auf macOS durchführen. Parallel beginnt der unabhängig vorbereitbare
M5-Block mit Build- und Distributionsnachweisen. Reale Groq-Abnahme
wartet auf ausdrücklich bereitgestellte Testzugänge; Deepgram bleibt gemäß
Versions-Roadmap bis 1.1 ohne Produktfreigabe. Der Plan definiert keine künstliche
Terminzusage: Zertifizierung und echte Nutzer-/Windows-Tests bestimmen einen Teil
der Kalenderzeit.

## 7a. Stand 23. September: Kandidat 1.0.0-beta.1

Alle ohne Mitwirkung möglichen Arbeitspakete sind umgesetzt. Offene Punkte, die
Entscheidungen, Zugänge, Geräte oder Menschen brauchen, sind in
[RELEASE_1.0_CHECKLIST.md](RELEASE_1.0_CHECKLIST.md) gebündelt.

| Paket | Neu umgesetzt | Geprüft | Offen |
| --- | --- | --- | --- |
| K01, K02, K05 | Vergleichsprotokoll, Interviewleitfaden, Beta-Aufgaben, Fragebogen, Hypothese und Reibungspunkte in [BETA_PLAN.md](BETA_PLAN.md) | Dokument | Teilnehmende, Durchführung |
| K04 | [COST_PLAN.md](COST_PLAN.md) mit recherchierten Signier-, Domain- und Testkosten | Quellen vom 23.09. | Auswahl und Käufe durch Jakob, Testgeräte |
| K17 | Web: Sitzung als Standard, bewusste dauerhafte Speicherung mit ehrlichem Hinweis | 1 neuer Test, Oberfläche | nichts Technisches |
| K18 | CORS-Hilfe mit konkreter Origin, `OLLAMA_ORIGINS` und Desktop-Alternative | Produktionsbuild | reale Fremdserverprüfung |
| K26 | Frische Pakete aus dem aktuellen Stand, Manifest und Prüfsummen | siehe STATUS | erster externer CI-Lauf nach Push |
| K28 | Manuelle Updateprüfung in Einstellungen und Menü, keine stille Installation | 8 Tests, Oberfläche | Test gegen echtes Release |
| K36 | Website DE/EN mit Downloads, Datenfluss, Kosten, Voraussetzungen, FAQ, Datenschutz | Produktionsbuild, hell/dunkel, mobil | echte Produktdemo, Impressum |
| K37 | Website unter `/`, Arbeitsbereich unter `/app`, PWA-Identität erhalten, Offline-Hülle v2 | Offline-Test mit beendetem Server | Upgrade einer installierten PWA auf dem Live-Deployment |
| K38 | noindex bis zur finalen Adresse; dann Canonical, hreflang, Sitemap, OG-Bild | 4 neue Tests | Domain, Impressum, Kontakt |
| K45 | [MAINTENANCE.md](MAINTENANCE.md) | Dokument | nichts |

## 8. Fortschritt

| Meilenstein | Status | Nachweis |
| --- | --- | --- |
| Plan | Erledigt | Codebestand und offizielle Referenzen geprüft; dieses Dokument |
| M0 Nutzen und Voraussetzungen | Offen | Noch keine Nutzerstudie durchgeführt |
| M1 Kern und Migration | Implementiert, Freigabeprüfung offen | K06–K09 implementiert und im aktuellen Satz mit 146 Tests, TypeScript, Web-Build sowie isoliertem Electron-Einstellungs-Smoke geprüft; die vollständige UI-Übersetzung ist inzwischen im Entwicklungsstand abgenommen, das reale 0.3.0-Profil-Upgrade bleibt offen |
| M2 Lokalmodus | Implementiert, Abnahme offen | K10–K13 implementiert; aktueller Gesamtsatz mit 145 Tests, TypeScript, Web-Build und Electron-Einstellungs-Smoke grün. Whisper-base-Download und drei lokale Web-Transkriptionen real geprüft; der dritte Lauf startete bei abgeschaltetem Ursprungsserver aus App-Hülle/Modellcache. Ollama 0.34.0, reale Browser-Modellliste und zwei Metal-beschleunigte `qwen3:0.6b`-Inferenzen wurden geprüft; beide unsicheren Antworten wurden korrekt verworfen. Vollständiger Netzwerkmitschnitt, echte Mikrofon-, geeignetes Ollama-Modell sowie gepackte Desktop- und Windows-Tests bleiben offen |
| M3 Anbieterfreiheit | Teilweise implementiert | K14-/K15-Adapterkern und K16-/K17-Grundlage implementiert; Groq und eigene kompatible Audio- sowie Textziele sind im unveröffentlichten Web- und Desktopprofil bewusst wählbar. Ziel-Keys bleiben getrennt und im Desktop OS-verschlüsselt. 145 Tests, Builds, echte lokale HTTP-Smokes sowie visuelle Web-/Electron-Prüfung grün. Reale Anbieterabnahme, Web-Sitzungskeys und restliches K18 bleiben offen |
| M4 Desktop und Englisch | K19–K24 implementiert, Plattformabnahme offen | Arbeitsbereich, Aufnahme/Import, lokaler Verlauf, progressive Audiofragmente, vierstufige Ersteinrichtung und vollständiger DE/EN-Durchzug implementiert. K23/K24 wurden im Entwicklungsstand vom Nutzer abgenommen. Eine danach entdeckte Mikrofonfreigabe-Regression der Sprechblase ist zentral behoben, mit 151 Tests/Builds geprüft und vom Nutzer real bestätigt; installierter Kandidat, K20–K22-End-to-End-/Belastungsabnahme und Windows bleiben offen |
| M5 Lizenz und Verteilung | K25 und K29 abgeschlossen, K26 vorbereitet; externe Entscheidungen offen | MIT, Rechte-/Drittanbieterinventar, englisches/deutsches README, Contribution-/Security-Dateien, Vorlagen und Adapter-Anleitung liegen vor. Klartext ist als Release-Name ausgeschlossen; Nivune ist vorgeprüft und technisch angewendet. Der letzte Klartext-Mac-Kandidat enthält die Lizenztexte; ASAR-Integrität, Fuses, Signatur-, Inhalts- und vier Renderer-Smokes sind grün. Signieridentitäten, frischer Nivune-Kandidat, externe Repository-/Webumbenennung, Rechteinhaberbestätigung, erster externer CI-Lauf und Windows bleiben offen |
| M6 Beta | Offen | Teilnehmer und reale Messwerte fehlen |
| M7 Landingpage und Video | Landingpage implementiert, Video offen | Website DE/EN, `/app`-Umzug und SEO-Grundlage geprüft; Produktdemo und Video entstehen aus dem abgenommenen Kandidaten |
| M8 Launch | Offen | Erst nach Erfüllung der Kriterien |
