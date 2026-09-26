# Nivune lokal bauen und prüfen

Stand: 23. September 2026

Diese Anleitung beschreibt den unveröffentlichten Entwicklungsstand. Die
Projektlizenz steht in `LICENSE`; diese Anleitung ersetzt keine Signierung und
behauptet keine bit-identischen Builds.
Die beiden Lockfiles legen die JavaScript-Abhängigkeiten fest; Node.js 24 ist in
`.nvmrc` als gemeinsame Build-Laufzeit festgehalten.

## Voraussetzungen

- Node.js 24 und das mitgelieferte npm
- Git
- für das macOS-Paket: Apple-Silicon-Mac mit `codesign`
- für das Windows-Paket: Windows x64

Native Pakete werden auf ihrem Zielsystem gebaut. Ein auf macOS erzeugtes
Windows-Paket ist kein Ersatz für den echten Windows-Build und -Funktionstest.

## Frisches Checkout prüfen

Im Repository:

```bash
npm ci
npm --prefix desktop ci
npm run verify
```

`npm run verify` führt den automatisierten Testsatz, TypeScript, den
Next.js-Produktionsbuild und alle Desktop-Bundles aus. Die Tests verwenden keine
kostenpflichtigen Anbieterzugänge. Echte Mikrofon-, Provider- und Plattformtests
bleiben getrennte Abnahmeschritte.

## Native Testpakete

macOS auf Apple Silicon:

```bash
npm --prefix desktop run dist
node scripts/create-build-manifest.cjs \
  --output desktop/dist/build-manifest.json \
  desktop/dist/Nivune-Mac-AppleSilicon.dmg
```

Windows x64:

```powershell
npm --prefix desktop run dist:win
node scripts/create-build-manifest.cjs `
  --output desktop/dist/build-manifest.json `
  desktop/dist/Nivune-Windows.exe
```

Das Manifest enthält Quellcommit, Dirty-Status, Node-/Plattformangabe, einen zum
Manifest relativen Artefaktpfad, Dateigröße und SHA-256. Das macOS-Paket ist
derzeit nur ad hoc signiert und nicht notarisiert;
das Windows-Paket besitzt noch keine Herausgebersignatur. Diese Dateien sind
Testkandidaten, keine freigegebenen Downloads.

## Geprüfter Kandidat 1.0.0-beta.1

Am 23. September 2026 auf einem Apple-Silicon-Mac gebaut (Quellstand noch nicht
committed, daher `sourceDirty: true`). Prüfsummen und Manifest liegen in
`desktop/dist/Nivune-1.0.0-beta.1-SHA256SUMS.txt` und
`desktop/dist/Nivune-1.0.0-beta.1-build-manifest.json`. Das Windows-Paket ist ein
Cross-Build vom Mac und ersetzt keinen Build und Test auf Windows.

Wichtig beim Prüfen von Paketinhalten: `asar extract-file` schreibt in das
aktuelle Verzeichnis. Nur in einem leeren temporären Ordner ausführen.

## Synchronisierte Ordner

Liegt das Repository in einem von iCloud Drive oder OneDrive verwalteten Ordner,
setzt der Sync-Dienst Dateiattribute, an denen `codesign` scheitert
(„resource fork, Finder information, or similar detritus not allowed“). Dann das
Ausgabeverzeichnis außerhalb bauen, zum Beispiel:

```bash
npx --prefix desktop electron-builder --projectDir desktop --mac dmg \
  --config.directories.output="$HOME/Library/Caches/nivune-build/dist"
```

## CI

`.github/workflows/verify-builds.yml` führt bei Pull Requests und Änderungen auf
`develop/v1-core` die gemeinsame Verifikation aus. Native Pakete werden nur bei
einem bewusst manuell gestarteten Lauf mit aktivierter Option
`build_native_packages` erzeugt. Die CI lädt sie ausschließlich als interne
Workflow-Artefakte mit Build-Manifest hoch; sie erstellt kein Release und
veröffentlicht nichts.

## Noch offen für K26

- Workflow erstmals auf GitHub ausführen und beide Zielsystemprotokolle prüfen
- native Pakete auf frischen Zielsystemen testen
- finalen Release-Commit und seine Prüfsummen im Freigabepaket festhalten
- Signierung/Notarisierung aus K27 getrennt nachweisen
- erst nach einem gesonderten deterministischen Nachweis von reproduzierbaren oder
  bit-identischen Builds sprechen
