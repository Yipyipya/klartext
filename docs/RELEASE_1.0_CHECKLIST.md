# Nivune 1.0: Was noch dich braucht

Stand: 23. September 2026. Kandidat: **1.0.0-beta.1** (unveröffentlicht, Branch
`develop/v1-core`, nicht committed).

Alles, was ohne dich machbar war, ist umgesetzt und geprüft (siehe
[STATUS.md](../STATUS.md)). Diese Liste bündelt die übrigen Schritte. Sie sind so
sortiert, dass du sie in wenigen Sitzungen nacheinander abarbeiten kannst. Bei
jedem Punkt steht, was ich danach selbst erledige.

## Block A: Entscheidungen (ca. 30 Minuten, am Schreibtisch)

| # | Entscheidung | Warum | Danach erledige ich |
| --- | --- | --- | --- |
| A1 | **Commit und Push freigeben.** Der gesamte 1.0-Stand liegt nur lokal und uncommitted auf `develop/v1-core`. | Schutz vor Datenverlust; Voraussetzung für CI, Review und Release. | Thematisch getrennte Commits, Push des Branches, erster CI-Lauf (K26) inklusive manuellem Windows-Paketjob. |
| A2 | **Domain und Handles.** Empfehlung: `nivune.app` registrieren, GitHub-Organisation `nivune` anlegen. `.com` ist vergeben. | Name, Links, Downloads und Update-Prüfung hängen daran. | Repository-Umzug vorbereiten, `shared/release.ts` (eine Stelle) und Vercel-Domain umstellen, `NEXT_PUBLIC_SITE_URL` setzen, Weiterleitungen testen. |
| A3 | **Repository umbenennen oder neu anlegen?** Empfehlung: bestehendes `Yipyipya/klartext` in die neue Organisation übertragen und in `nivune` umbenennen. GitHub leitet alte Links weiter; bisherige Releases bleiben erhalten. | Alte 0.3.0-Downloadlinks funktionieren weiter. | Übertragung prüfen, Vercel-Git-Verbindung neu bestätigen. |
| A4 | **Rechteinhaber bestätigen.** `LICENSE` nennt „The Nivune Authors“. Bestätige, dass du alle Rechte am Code hältst und ihn unter MIT veröffentlichen willst, und wie du im Copyright genannt werden möchtest. | Rechtliche Grundlage der Open-Source-Veröffentlichung (K03). | `LICENSE`, README und Hinweise anpassen. |
| A5 | **Impressum-Angaben.** Name und ladungsfähige Anschrift (oder ein Dienst für eine Impressumsadresse). | Pflichtangabe für die öffentliche Website in Deutschland. | Impressum-Seite DE/EN, `NEXT_PUBLIC_LEGAL_NOTICE_URL` setzen, Datenschutzseite ergänzen. |
| A6 | **Datenschutzseite freigeben.** Entwurf unter `/datenschutz` und `/en/privacy`. Ich bin keine Rechtsberatung; bei Unsicherheit einmal prüfen lassen. | Öffentliche Aussage über Datenflüsse. | Anpassungen einarbeiten. |
| A7 | **Signierweg wählen** (Kosten siehe [Kostenplan](COST_PLAN.md)). Empfehlung: Apple Developer Program (99 USD/Jahr) und für Windows zuerst ein Antrag bei der kostenlosen SignPath Foundation, sonst ein Certum-Open-Source-Zertifikat. | Ohne Signatur zeigen macOS und Windows Warnungen (K27). | Signierung in Build und CI einbauen, Notarisierung und Stapling automatisieren, frisch geladene Installer prüfen. |
| A8 | **Social-Video-Budget.** Empfehlung: 0 EUR, echte Bildschirmaufnahmen des Kandidaten plus deine Stimme. | K39/K40. | Skript DE/EN, Schnittliste, Untertitel, Export nach Freigabe. |

## Block B: Konten und Zugänge (du selbst, ich gebe keine Zugangsdaten ein)

1. **Apple:** Beim Developer Program anmelden (Identitätsprüfung dauert teils
   mehrere Tage). Danach in Xcode oder im Developer-Portal ein
   „Developer ID Application“-Zertifikat erstellen und im Schlüsselbund dieses
   Macs ablegen. Für die Notarisierung ein App-spezifisches Passwort erzeugen und
   mit `xcrun notarytool store-credentials nivune-notary` im Schlüsselbund
   speichern. Mir nur den Profilnamen `nivune-notary` nennen, nie das Passwort.
2. **Windows-Signierung:** Antrag bei [SignPath Foundation](https://signpath.org/)
   stellen (setzt ein veröffentlichtes Open-Source-Release voraus, daher ggf. erst
   nach der Beta) oder Certum-Open-Source-Zertifikat bestellen.
3. **Groq-Testkey** (optional, aber für die Aussage „Groq geprüft“ nötig): Key in
   der Nivune-Desktop-App selbst eintragen. Kosten einer kurzen Probe liegen im
   Cent-Bereich. Ohne diese Probe führe ich Groq als „implementiert, nicht real
   geprüft“.
4. **Domain** registrieren (A2) und in Vercel als Domain des Projekts `klartext`
   hinzufügen. Den DNS-Eintrag übernehme ich, wenn du mir Zugriff gibst oder die
   Werte selbst einträgst.

## Block C: Test auf deinem Mac (ca. 60 bis 90 Minuten)

Kandidat: `desktop/dist-alpha/mac-arm64/Nivune Alpha.app` (eigene Bundle-ID,
eigenes Profil, Shortcut `⌥ + ⇧ + Leertaste`, kein Autostart). Die installierte
Klartext-App bleibt unberührt. Zum Starten die App nach `/Applications` kopieren;
falls macOS sie blockiert: Rechtsklick → Öffnen.

Bitte je Punkt nur notieren: bestanden / nicht bestanden / Auffälligkeit. Keine
Keys oder privaten Texte in den Bericht.

1. **Ersteinrichtung:** Sprache wählen, lokalen Weg (Whisper small) wählen,
   Modell laden, Probeaufnahme, Abschluss. Danach einmal OpenAI als Weg einrichten.
2. **Systemdiktat:** In Mail, Notizen und einem Browserfeld je ein Diktat.
   Einfügen am Cursor, Abbruch mit Escape, Ende nach Stille.
3. **Langdiktat-Grenze:** Ein Systemdiktat länger als 10 Minuten laufen lassen.
   Erwartung: kontrolliertes Ende bei 10:00, Text vollständig bis dahin.
4. **Arbeitsbereich-Aufnahme:** 30 Minuten mit Pause und Fortsetzen, dann
   transkribieren (lokal). Ergebnis im Verlauf, Export als TXT und Markdown.
5. **Absturz-Wiederherstellung:** Während einer Arbeitsbereich-Aufnahme die App
   per Aktivitätsanzeige sofort beenden. Neu starten: Wiederherstellung anbieten
   und bewusst verarbeiten.
6. **Dateiimport:** Eine echte Sprachmemo (M4A) und eine etwa 60-minütige Datei
   importieren und transkribieren.
7. **Offline:** WLAN aus, App beenden und neu starten, lokales Diktat.
8. **Updateprüfung:** Einstellungen → Allgemein → „Nach Updates suchen“.
   Erwartung vor dem Release: „aktuell“ (0.3.0 ist älter als 1.0.0-beta.1).
9. **Sprachaktivierung:** Einen eigenen Startbefehl einlernen (z. B. „Diktat
   starten“), aktivieren, per Stimme starten.
10. **Autostart:** In der normalen Nivune-Version (nicht Alpha) nach Ab- und
    Anmelden prüfen. Das kann bis zur finalen Version warten.
11. **Web-App:** `/app` im Produktionsbuild oder nach dem Deployment: ein
    Diktat mit OpenAI, ein lokales Diktat, ein Dateiimport. Optional den Schalter
    „API-Keys auf diesem Gerät merken“ ausprobieren.

## Block D: Windows (ca. 60 Minuten, echtes Gerät nötig)

Datei: `desktop/dist/Nivune-Windows.exe` (unsigniert; SmartScreen warnt). Auf dem
Mac gebaut, deshalb ist der Test auf echtem Windows zwingend.

1. Installation, Start, Ersteinrichtung mit lokalem Modell.
2. Systemdiktat per `Strg + Umschalt + Leertaste` in Word oder Outlook, Excel und
   Browser. Einfügen am Cursor.
3. Arbeitsbereich: Aufnahme mit Pause, Dateiimport, Export über die Windows-
   Dateidialoge.
4. Stille-Ende, Sprachaktivierung, Autostart nach Neuanmeldung.
5. Deinstallation und erneute Installation: Verlauf und Einstellungen bleiben.

## Block E: Beta mit echten Menschen (1 bis 2 Wochen)

Leitfaden, Aufgaben und Auswertung stehen in [BETA_PLAN.md](BETA_PLAN.md). Du
lädst 8 bis 12 Personen ein (möglichst halb Mac, halb Windows, DE und EN,
mindestens vier ohne API-Erfahrung). Einladungen verschicke ich nicht selbst;
Textvorlagen liegen im Plan.

## Block F: Launch-Freigaben (je ein kurzes Ja)

1. Beta-Release `v1.0.0-beta.1` als GitHub-Pre-Release (erscheint nicht als
   „latest“, bestehende 0.3.0-Links bleiben stabil).
2. Merge nach `main` und damit Vercel-Deployment von Website und `/app`.
3. Finales `v1.0.0` mit signierten Installern und `SHA256SUMS.txt`.
4. Veröffentlichung des Videos und konkreter Posts.

## Was bereits ohne dich vorbereitet ist

- Frisches, geprüftes Nivune-Paket für den Mac-Test, Windows-Installer,
  Prüfsummen und Build-Manifest (siehe STATUS).
- Update-Hinweis, Web-Key-Speicherwahl, CORS-Hilfe.
- Landingpage DE/EN mit Datenschutzseite; noindex, bis A2 und A5 erledigt sind.
- Release-Notizen, Changelog, Kostenplan, Beta-Plan, Wartungsmodell und die
  Zuordnung aller Website-Aussagen zu Feature-Nachweisen
  ([LANDING_CLAIMS.md](LANDING_CLAIMS.md)).
