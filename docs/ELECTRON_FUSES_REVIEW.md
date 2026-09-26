# Electron-43-Fuse-Review

Stand: 21. September 2026

Umsetzungsstatus: Die Empfehlung wurde anschließend vollständig umgesetzt und
mit einem frischen Paketbau verifiziert. Der Bericht bewahrt den Ausgangsbefund.

## Ergebnis

Klartext verwendet aktuell Electron 43.1.0 und `@electron/fuses` 1.8.0. Das
Electron-Binary enthält neun V1-Fuses, die installierte Bibliothek kennt jedoch
nur die Indizes 0 bis 7. Deshalb zeigt ihr CLI den neunten Eintrag als
`undefined is Enabled` an.

Der neunte Fuse heißt `WasmTrapHandlers` und liegt auf Index 8. Er wird ab
`@electron/fuses` 2.1.0 benannt. Empfohlen ist das aktuelle, kompatible Release
`@electron/fuses` 2.1.3, exakt im Desktop-Lockfile festgeschrieben. Version 2.x
setzt Node.js 22.12 oder neuer voraus und ist ausschließlich ESM. Das Projekt
legt Node.js 24 in `.nvmrc` fest und wurde lokal mit Node.js 24.14.1 geprüft, die
Node-Anforderung ist daher erfüllt. Der bestehende CommonJS-Hook muss beim
Update allerdings von `require()` auf dynamischen `import()` umgestellt werden.

Für Klartext sollte `WasmTrapHandlers` explizit auf `true` stehen. Der aktuelle
Electron-43-Binärwert und der Wert im vorhandenen Alpha-Paket sind bereits
`Enabled`; die Änderung schreibt den Ist-Zustand also nur ausdrücklich fest.
Klartext nutzt WebAssembly intensiv für Whisper/ONNX und Rustpotter. Laut
Electron aktiviert der Fuse V8-Signalhandler mit Guard-Regions für
WebAssembly-Speicherzugriffe. `false` verwendet stattdessen explizite
Bounds-Checks und verursacht größere Module, längere Kompilierung und höhere
Laufzeitkosten. Beide Wege prüfen Speichergrenzen. Für die unterstützten Ziele
macOS arm64 und Windows x64 ist der Guard-Region-Weg unterstützt und für diese
WASM-lastige Anwendung die sinnvolle Einstellung.

`strictlyRequireAllFuses` sollte auf `true` gesetzt werden. Damit schlägt ein
Paketbuild fehl, wenn ein künftiges Electron-Binary mehr Fuses enthält als die
installierte Bibliothek kennt oder wenn ein vorhandener Fuse nicht ausdrücklich
konfiguriert wurde. Genau die heute unbemerkte `undefined`-Situation wird damit
zu einem sichtbaren Release-Gate.

## Belege aus dem Repository

- `desktop/package.json` deklariert Electron `^43.1.0`; installiert ist 43.1.0.
- `desktop/package.json` und das Desktop-Lockfile pinnen
  `@electron/fuses` 1.8.0.
- `desktop/adhoc-sign.js` setzt acht Fuses und verwendet
  `require("@electron/fuses")`.
- Die installierte 1.8.0-Definition endet bei
  `GrantFileProtocolExtraPrivileges = 7`.
- Das Auslesen des unveränderten Electron-Binaries ergibt acht benannte Fuses
  plus `undefined is Enabled`.
- Das Auslesen von `desktop/dist-alpha/mac-arm64/Klartext Alpha.app` ergibt die
  acht gehärteten Werte plus `undefined is Enabled`.
- Whisper lädt `ort-wasm-simd-threaded.asyncify.wasm`; Rustpotter liefert zwei
  weitere WASM-Runtimes. `WasmTrapHandlers` ist daher ein real genutzter
  Laufzeitpfad und kein theoretischer Schalter.
- `.nvmrc`, `docs/BUILDING.md` und alle drei CI-Jobs verwenden Node.js 24.

## Empfohlene Änderungen

### 1. Paket und Lockfile

In `desktop/package.json`:

```json
"@electron/fuses": "2.1.3"
```

Danach das Desktop-Lockfile mit der festgelegten Node-24-Laufzeit aktualisieren.
Ein exakter Pin passt zur bestehenden Abhängigkeitspolitik des Desktop-Pakets.

### 2. ESM-kompatibler After-Pack-Hook

Die statische CommonJS-Zeile am Anfang von `desktop/adhoc-sign.js` entfernen:

```js
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
```

Stattdessen am Anfang der bereits asynchronen Hook-Funktion laden:

```js
exports.default = async function (context) {
  const { flipFuses, FuseVersion, FuseV1Options } = await import("@electron/fuses");
  // bestehender Hook
};
```

Das ist die kleinste Änderung. Eine Umstellung des ganzen Hooks auf `.mjs` ist
nicht erforderlich und würde zusätzlich den Hook-Pfad in der
electron-builder-Konfiguration verändern.

### 3. Alle neun Fuses explizit machen

Die bestehende Konfiguration beibehalten und um diese beiden Zeilen ergänzen:

```js
strictlyRequireAllFuses: true,
[FuseV1Options.WasmTrapHandlers]: true,
```

Der Zielzustand lautet damit:

| Fuse | Wert | Begründung |
| --- | --- | --- |
| `RunAsNode` | `false` | Kein `ELECTRON_RUN_AS_NODE`-Einstieg |
| `EnableCookieEncryption` | Produktion `true`, internes Alpha `false` | Cookie-Werte im Release über OS-Schlüssel schützen; im cookie-freien, ad-hoc-signierten Testpaket wiederholte macOS-Keychain-Dialoge vermeiden |
| `EnableNodeOptionsEnvironmentVariable` | `false` | Keine Node-Optionen oder fremden CA-Injektionen |
| `EnableNodeCliInspectArguments` | `false` | Kein Produktionsinspektor über CLI oder Signal |
| `EnableEmbeddedAsarIntegrityValidation` | `true` | Gepacktes ASAR validieren |
| `OnlyLoadAppFromAsar` | `true` | Keine unvalidierten Fallback-App-Pfade |
| `LoadBrowserProcessSpecificV8Snapshot` | `false` | Kein eigener Browser-Snapshot vorhanden |
| `GrantFileProtocolExtraPrivileges` | `true` | Vorläufig nötig, da Renderer weiterhin über `loadFile()` und `file://` laufen |
| `WasmTrapHandlers` | `true` | Unterstützter und performanter Speichergrenzenschutz für Whisper und Rustpotter |

`GrantFileProtocolExtraPrivileges = true` bleibt der schwächste Wert der
Konfiguration. Er gehört nicht zum vorliegenden neunten-Fuse-Problem. Electron
empfiehlt, ihn bei Anwendungen ohne `file://` zu deaktivieren. Klartext lädt
seine Renderer derzeit aber ausdrücklich mit `BrowserWindow.loadFile()` und
verwendet lokale WASM- und Worker-Ressourcen. Eine Deaktivierung sollte deshalb
erst zusammen mit einer Migration auf ein eng begrenztes eigenes Protokoll und
vollständigen Renderer-Smokes erfolgen, nicht beiläufig in diesem Paketupdate.

Der Alpha-Sonderfall für `EnableCookieEncryption` wurde nach der ersten realen
Onboarding-Abnahme ergänzt. Electron dokumentiert, dass Cookie-Verschlüsselung
auf macOS denselben Keychain-Zugriff wie `safeStorage` verwendet und ohne stabile
Signatur wiederholt nachfragen kann. Die Ausnahme gilt ausschließlich für
`productName = "Klartext Alpha"`; der spätere Developer-ID-signierte
Produktionsbuild behält den Fuse auf `true`.

### 4. Regressionstests

`tests/desktop-runtime.test.cjs` sollte zusätzlich prüfen, dass der Hook

```text
strictlyRequireAllFuses: true
[FuseV1Options.WasmTrapHandlers]: true
```

enthält. Der vorhandene Paket-Smoke muss danach einen frisch gebauten Kandidaten
mit dem neuen CLI auslesen und neun benannte Werte liefern. `undefined` darf in
der Ausgabe nicht mehr vorkommen.

## Verifikationsplan nach der Änderung

1. `npm --prefix desktop ci` unter Node.js 24 aus einem aktualisierten Lockfile.
2. `npm run verify` im Repository ausführen.
3. Einen frischen Apple-Silicon-Alpha-Kandidaten bauen.
4. Mit `@electron/fuses` 2.1.3 alle neun Werte aus dem Paket auslesen und die
   Tabelle oben gegenprüfen.
5. ASAR-Integrität und strikte Codesign-Prüfung erneut ausführen.
6. Whisper-Inferenz und Rustpotter-Sprachaktivierung real starten. Das ist der
   Funktionsnachweis für `WasmTrapHandlers = true`.
7. Den Windows-x64-Kandidaten auf Windows bauen, Fuses auslesen und Whisper sowie
   Rustpotter dort ebenfalls starten.
8. Einen negativen Buildtest ergänzen oder einmal dokumentiert ausführen, bei dem
   ein Fuse-Eintrag fehlt. `strictlyRequireAllFuses` muss den Build dann stoppen.

## Risiken und Einordnung

- **Hoch, falls nur das Paket aktualisiert wird:** 2.x ist ESM-only. Der heutige
  `require()`-Aufruf würde beim Paketieren scheitern. Paket- und Hook-Änderung
  müssen gemeinsam landen.
- **Mittel, falls der Build außerhalb der festgelegten Toolchain läuft:**
  `@electron/fuses` 2.1.3 benötigt Node.js mindestens 22.12. Die dokumentierte
  Node-24-Toolchain erfüllt dies; abweichende lokale Builder nicht zwingend.
- **Niedrig für das Aktivieren von `WasmTrapHandlers`:** Der Wert ist in Electron
  43 und im aktuellen Alpha bereits aktiv. Die explizite Konfiguration ändert
  den Laufzeitmodus nicht.
- **Erwünschtes Fail-closed-Verhalten:** Ein späteres Electron-Upgrade kann den
  Build absichtlich stoppen, wenn ein neuer Fuse hinzukommt. Das ist zusätzlicher
  Wartungsaufwand, verhindert aber stillschweigende Sicherheitsdefaults.
- **Bestehendes Restrisiko:** `GrantFileProtocolExtraPrivileges = true` bleibt
  wegen der aktuellen `file://`-Architektur bestehen. Dies sollte als eigene
  Härtungsmigration geplant werden.

## Quellen

- [Electron Fuses: aktuelle Optionen und Semantik](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [`@electron/fuses` 2.1.3, ESM und Node-Anforderung](https://raw.githubusercontent.com/electron/fuses/v2.1.3/package.json)
- [`FuseV1Options` 2.1.3 mit `WasmTrapHandlers = 8`](https://raw.githubusercontent.com/electron/fuses/v2.1.3/src/config.ts)
- [`strictlyRequireAllFuses`-Validierung in 2.1.3](https://raw.githubusercontent.com/electron/fuses/v2.1.3/src/index.ts)
- [`@electron/fuses` Releases](https://github.com/electron/fuses/releases)

## Entscheidung

Freigabeempfehlung: `@electron/fuses` exakt auf 2.1.3 aktualisieren, den
CommonJS-Hook per dynamischem `import()` ESM-kompatibel machen,
`WasmTrapHandlers: true` und `strictlyRequireAllFuses: true` gemeinsam setzen.
Danach Paketbuild und beide WASM-Pfade prüfen. An der produktiven Konfiguration
wurde in diesem Review noch nichts geändert.
