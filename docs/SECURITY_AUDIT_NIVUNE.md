# Konsolidierter Sicherheitsstand: Nivune 1.0

Stand: 23. September 2026

## Ergebnis

Die parallelen Frontend- und Desktop-Prüfungen fanden keine kritische oder hohe
unmittelbar ausnutzbare Quellcode-Schwachstelle. Root und Desktop meldeten in
Produktions- und Vollaudit jeweils null bekannte npm-Schwachstellen. Die
vollständigen Oberflächenberichte liegen in
`SECURITY_AUDIT_FRONTEND_NIVUNE.md` und
`SECURITY_AUDIT_DESKTOP_NIVUNE.md`.

Der wichtigste lokale Restbefund ist geschlossen: Web- und
Desktop-Live-Diktate besitzen nun eine harte Grenze von zehn Minuten; der
Desktop-Main-Prozess validiert Typ und Größe jedes Renderer-Ergebnisses vor der
Verarbeitung. Die neuen Grenzfälle sind Teil des Gesamtsatzes von 180 grünen
Tests. TypeScript, Webpack-Produktionsbuild und alle Desktop-Bundles sind grün.

## Befundstatus

| ID | Priorität | Stand | Restarbeit |
| --- | --- | --- | --- |
| F-01 Downloadvertrauen | Mittel | Teilweise offen | Finale Nivune-Release-URLs, versionierte Artefakte, Manifest und sichtbare Checksummen erst mit dem externen Repository herstellen |
| F-02 unbegrenzte Web-Live-Aufnahme | Niedrig | **Geschlossen** | 600 Sekunden, kontrollierte Finalisierung, Regressionstest |
| NVD-01 authentische Paketsignierung | Hohes Release-Gate | Offen | Developer ID, Notarisierung und Windows-Code-Signing mit echten Credentials |
| NVD-02 unbegrenztes Systemdiktat/IPC | Mittel | **Geschlossen** | 9.600.000 Samples, 19.200.044 Byte WAV-Maximum, Main-Prozess-Validierung und Tests |
| NVD-03 breite Pill-CSP | Mittel | Zurückgestellt | HTTPS-Modellquellen nach finalem Download-/Providerdesign weiter verengen |
| NVD-04 frischer Nivune-Artefaktnachweis | Mittel | **Geschlossen** (23.09.) | DMG, Alpha-Paket und Windows-Installer aus dem aktuellen Stand; Smokes, Offline-Modell, Signatur, ATS, Fuses, ASAR und Lizenzen bestanden |
| Deployment-HSTS | Niedrig | Offen | Am echten Produktionshost prüfen, nicht nur lokal konfigurieren |
| breite Preload-Brücke | Niedrig | Akzeptiert/beobachten | Berechtigungs- und Senderprüfungen sind eng; bei künftigen Features weiter aufteilen |

## Neue Schutzgrenzen

- Web: `MAX_LIVE_RECORDING_SECONDS = 600`.
- Desktop: 16-kHz-Mono, maximal 600 Sekunden beziehungsweise 9.600.000 Samples.
- Desktop-WAV: maximal 19.200.044 Byte inklusive Header.
- Lokales Renderer-Transkript: String, maximal 1.000.000 Zeichen.
- Binärpuffer werden aus `ArrayBuffer` oder einer exakten Typed-Array-Sicht
  normalisiert; leere, falsche oder zu große Daten werden vor Provider- oder
  Whisper-Verarbeitung verworfen.
- Nur der aktive Aufnahme-WebContents darf Stille oder Zeitlimit an den
  Main-Prozess melden.

## Verifikation

```text
npm test                       180/180 bestanden
npm run typecheck              bestanden
npx next build --webpack       bestanden
npm run desktop:bundle         bestanden
node --check (geänderte JS)    bestanden
git diff --check               bestanden
Root npm audit, prod/voll      0 / 0 Befunde
Desktop npm audit, prod/voll   0 / 0 Befunde
```

Das vorhandene Nivune-Alpha-Paket wurde vor dem letzten Schutz-Fix gebaut. Es
belegt bereits Renderer-Smokes, Fuses, ATS, ASAR-Integrität, Lizenzressourcen und
einen realen Offline-Modellstart, ist aber kein bytegenauer Nachweis des aktuellen
Quellstands. Ein frischer Paketbau ist daher der nächste Schritt, nicht eine neue
Quellcode-Härtungsrunde.

## Releaseurteil

Der aktuelle Quellstand ist aus dem Audit heraus für einen neuen internen
Kandidaten freigegeben. Ein öffentlicher 1.0-Binärrelease ist noch nicht
freigegeben, solange authentische Signierung/Notarisierung, Windows-Abnahme,
finale Downloadintegrität und der frische Artefaktnachweis fehlen.

## Nachtrag 23. September 2026: Kandidat 1.0.0-beta.1

Neue Oberflächen wurden auf dieselben Grenzen geprüft:

- **Updateprüfung:** nur auf Nutzerbefehl, feste GitHub-API-Adresse, `redirect:
  "error"`, keine Zugangsdaten, Zeitlimit, strenge Validierung der Antwort. Geöffnet
  wird ausschließlich eine HTTPS-Release-Seite des festgelegten Repositorys; es
  gibt keinen Download- oder Installationspfad.
- **Web-Keys:** dauerhafte Speicherung nur nach bestätigtem Schalter; Standard
  bleibt die Sitzung. Keys gelangen nie in das Einstellungsobjekt.
- **Website:** statische Seiten ohne Cookies, Tracking oder Drittanbieter-
  Skripte; bestehende Schutzheader gelten für alle Pfade. Die ungültige und
  deshalb vom Browser ignorierte CSP-Quelle `http://[::1]:*` wurde entfernt; die
  Wirkung ist unverändert.
- **Service Worker:** cacht nur `/app` und eigene statische Ressourcen.

Verifikation: 194/194 Tests, TypeScript, Produktionsbuild, Desktop-Bundles, vier
npm-Audits mit 0 Befunden, frische Pakete mit allen Paketnachweisen.
