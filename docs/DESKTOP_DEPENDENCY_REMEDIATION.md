# Desktop-Abhängigkeiten: Befundketten und Updateplan

Stand: 21. September 2026

Umsetzungsstatus: Die beschriebenen transitiven Updates wurden angewendet.
Produktions- und Vollaudit des Desktop-Baums melden 0 Befunde. Das getrennt
bewertete `@electron/fuses` wurde danach auf 2.1.3 aktualisiert.

## Kurzfazit

Der vollständige Desktop-Audit meldete im vor der Bereinigung geprüften
Lockfile sechs hohe Befundgruppen. Alle betroffenen Pakete waren transitiv und
als Entwicklungsabhängigkeiten markiert. Der Produktionsaudit war bereits
sauber; außerdem werden die Werkzeugpakete durch `!node_modules/**` nicht in das
ASAR aufgenommen.

Für die Behebung ist kein Major-Update von Electron oder electron-builder
erforderlich. Die vorhandenen Abhängigkeitsbereiche akzeptieren bereits
bereinigte Patchversionen. Ein gezielter Lockfile-Nachlauf kann deshalb die sechs
Pakete aktualisieren, während die direkten Versionen `electron` 43.1.0,
`electron-builder` 26.15.3, `esbuild` 0.25.9 und `@electron/fuses` 1.8.0
unverändert bleiben.

Während dieser Read-only-Analyse wurde die entsprechende transitive
Lockfile-Aktualisierung parallel im Arbeitsbaum sichtbar. Der anschließend
erneut gegen die npm-Registry ausgeführte vollständige Desktop-Audit meldet
jetzt 0 Befunde. Die folgenden Tabellen halten Ausgangslage, Ketten und
Risikobewertung fest.

## Audit-Ausgangslage und bereinigte Pins

| Befund | Verwundbarer Lockfile-Pin | Bereinigter Pin | Sichere Untergrenze laut Audit | Laufzeitfläche |
| --- | --- | --- | --- | --- |
| `@xmldom/xmldom` | 0.8.13 | 0.8.15 | 0.8.15 | electron-builder/Plist-Verarbeitung |
| `brace-expansion` | 1.1.16, 2.1.2, 5.0.7 | 1.1.21, 2.1.7, 5.0.12 | 1.1.18, 2.1.4, 5.0.9 | Build-Globs und Paketdateiauswahl |
| `fast-uri` | 3.1.3 | 3.1.8 | 3.1.6 | Ajv-Schemavalidierung im Packager |
| `js-yaml` | 4.3.0 | 4.3.2 | 4.3.2 | electron-builder-Konfiguration |
| `tar` | 7.5.19 | 7.5.22 | 7.5.21 | Packager und Native-Module-Rebuild |
| `undici` | 6.27.0, 7.28.0 | 6.28.1, 7.29.1 | 6.28.0, 7.29.0 | Build- und Electron-Downloads |

Der erste Registry-Audit meldete 6 hohe, 0 kritische, 0 moderate und 0 niedrige
Befundgruppen. Die Schwere bezeichnet dabei die jeweils zusammengefasste
Paketgruppe; zum Beispiel enthält `@xmldom/xmldom` sowohl moderate als auch hohe
Einzeladvisories. Nach den oben aufgeführten Pins meldet derselbe vollständige
Audit 0 Befunde bei 370 ausgewerteten Abhängigkeiten.

## Exakte Abhängigkeitsketten

### `@xmldom/xmldom`

Kanonische Kette:

```text
klartext-desktop
└─ electron-builder@26.15.3
   └─ app-builder-lib@26.15.3
      └─ plist@3.1.0
         └─ @xmldom/xmldom@0.8.13 → 0.8.15
```

`plist@3.1.0` wird außerdem über `@electron/osx-sign@1.3.3` und
`@electron/universal@2.0.3` verwendet. Alle Pfade werden auf dieselbe
`@xmldom/xmldom`-Installation dedupliziert. Die Sicherheitsmeldungen betreffen
XML-Namensinjektion, nicht wohlgeformte Serialisierung sowie quadratische Zeit-
und Speicherverarbeitung bei präpariertem XML.

### `brace-expansion`

Im alten Lockfile existierten sechs verwundbare Installationsorte:

```text
electron-builder
└─ app-builder-lib
   ├─ @electron/asar → minimatch@3 → brace-expansion@1.1.16
   ├─ @electron/asar → glob@7 → minimatch@3 → brace-expansion@1.1.16
   ├─ @electron/universal → minimatch@9 → brace-expansion@2.1.2
   ├─ @electron/universal → dir-compare → minimatch@3 → brace-expansion@1.1.16
   ├─ ejs → jake → filelist → minimatch@5 → brace-expansion@2.1.2
   └─ minimatch@10 → brace-expansion@5.0.7
```

Der `glob@7`-Pfad wird zusätzlich von den Windows-Paketierwerkzeugen über
`electron-winstaller → temp → rimraf` mitbenutzt. Die Advisories betreffen
unbegrenzte Expansion und unbegrenzte Zwischenarrays, die einen
Speicher-DoS auslösen können.

### `fast-uri`

```text
klartext-desktop
└─ electron-builder@26.15.3
   └─ app-builder-lib@26.15.3
      └─ ajv@8.20.0
         └─ fast-uri@3.1.3 → 3.1.8
```

Die Advisories betreffen mehrdeutige Hostauswertung, IDN-/Prozentdekodierung
und IPv6-Normalisierung. In diesem Baum wird `fast-uri` durch Ajv bei der
Schemavalidierung des Buildwerkzeugs verwendet, nicht durch Klartexts
Netzwerkcode.

### `js-yaml`

```text
klartext-desktop
└─ electron-builder@26.15.3
   ├─ app-builder-lib@26.15.3 ─┐
   ├─ builder-util@26.15.3 ────┼─ js-yaml@4.3.0 → 4.3.2
   └─ dmg-builder@26.15.3 ─────┘
```

Die betroffenen Pfade werden im Lockfile dedupliziert. Die Advisories betreffen
quadratischen CPU-Verbrauch bei `!!omap` sowie leeren YAML-Merge-Quellen.

### `tar`

```text
klartext-desktop
└─ electron-builder@26.15.3
   └─ app-builder-lib@26.15.3
      ├─ tar@7.5.19 → 7.5.22
      └─ @electron/rebuild@4.2.0
         └─ node-gyp@12.4.0
            └─ tar@7.5.19 → 7.5.22 (dedupliziert)
```

Das Advisory betrifft unkontrollierte Rekursion bei präparierten langen
Archivpfaden in Verbindung mit Member-Selektion.

### `undici`

Es gibt zwei voneinander getrennte Major-Linien:

```text
klartext-desktop
├─ electron@43.1.0
│  └─ @electron/get@5.0.0
│     └─ undici@7.28.0 → 7.29.1 (optional)
└─ electron-builder@26.15.3
   └─ app-builder-lib@26.15.3
      └─ @electron/rebuild@4.2.0
         └─ node-gyp@12.4.0
            └─ undici@6.27.0 → 6.28.1
```

Die Advisories betreffen unter anderem Response-Desynchronisierung,
Cache-Control-Auswertung, Cookie-Attribute und CRLF-Injektion. Beide Instanzen
gehören zum Download-/Buildpfad und nicht zum ausgelieferten Renderer oder
Main-Prozess.

## Direkte Dev-Pakete und sinnvolle Updateentscheidung

| Direktes Paket | Zusammenhang mit den sechs Befunden | Bewertung |
| --- | --- | --- |
| `electron-builder` 26.15.3 | Ursprung aller Ketten außer `undici@7`; 26.15.3 ist zugleich die aktuell verfügbare stabile Version. Seine transitiven Ranges erlauben alle sicheren Pins. | Kein direkter Versionssprung möglich oder nötig. Lockfile gezielt innerhalb der bestehenden Ranges aktualisieren. |
| `electron` 43.1.0 | Ursprung von `@electron/get → undici@7`. Der deklarierte Bereich `^43.1.0` würde derzeit auch 43.7.3 zulassen. | Ein Update auf 43.7.3 würde den Pfad ebenfalls erneuern, zieht aber die gesamte Electron-Laufzeit mit. Für diesen Auditbefund genügt das gezielte transitive `undici`-Update bei Electron 43.1.0. |
| `@electron/fuses` 1.8.0 | Keine der sechs Ketten läuft über dieses Paket. | Separat behandeln; ein Upgrade behebt keinen dieser sechs Befunde und benötigt eine eigene Fuse-API-/Paketprüfung. |
| `esbuild` 0.25.9 | Keine der sechs Ketten läuft über dieses Paket. | Nicht als Audit-Reparatur mitziehen. |

`npm outdated` meldete für die direkten Pakete außerdem Electron 43.7.3 als
innerhalb des deklarierten Bereichs verfügbare Version, Electron 44.4.3 als
aktuelles Major, `@electron/fuses` 2.1.3 und esbuild 0.25.12 beziehungsweise
0.28.2. Keines dieser direkten Updates ist Voraussetzung, um die sechs
Auditgruppen zu schließen. Besonders Electron 44 und esbuild 0.28 wären
unnötige Major-Wechsel und sollten nicht mit der Sicherheitsbereinigung
gekoppelt werden.

## Breaking- und Regressionsrisiken

### Empfohlener enger Lockfile-Nachlauf

Das Gesamtrisiko ist niedrig, aber nicht null:

- Alle sechs Zielpakete bleiben in derselben Major-Linie und erfüllen bereits
  die von ihren Eltern deklarierten Bereiche.
- `@xmldom/xmldom` validiert und serialisiert problematische XML-Konstrukte
  strenger. Das ist für die normalen von `plist` erzeugten macOS-Metadaten
  erwünscht; DMG- und Signaturerzeugung müssen dennoch neu gebaut werden.
- `brace-expansion` begrenzt pathologische Expansionen. Gewöhnliche feste
  Dateimuster bleiben kompatibel, doch ASAR-Inhalt und Ausschlussmuster müssen
  nach dem Paketieren verglichen werden.
- `fast-uri` normalisiert mehrdeutige URLs strenger. Relevanz besteht nur für
  Build-Schemata; Klartexts normale Paketkonfiguration enthält keine solchen
  Sonderfälle.
- `js-yaml` begrenzt teure YAML-Strukturen. Die Konfiguration liegt hier in
  `package.json`, nicht in komplexen oder nutzergesteuerten YAML-Dokumenten.
- `tar` verändert Fehlerpfade für ungewöhnliche Archivnamen. Mac-Paketierung
  und insbesondere der Windows-/Native-Rebuildpfad sollten neu ausgeführt
  werden.
- `undici` kann sich bei Proxies, Wiederholungen, Cache-Headern und Cookies
  anders verhalten. Deshalb sind ein sauberer Electron-Download und ein
  Native-Rebuild in CI aussagekräftiger als nur ein bereits warmer lokaler
  Cache.

### Breites Update direkter Werkzeuge

Ein pauschales `npm update` würde zusätzlich Electron 43.1.0 auf 43.7.3 und
esbuild 0.25.9 auf 0.25.12 verschieben. Diese Patchupdates sind grundsätzlich
vertretbar, vergrößern aber die Testfläche ohne Not für den konkreten Audit.
Electron bündelt Chromium und Node; selbst ein Major-internes Update verlangt
erneute Mikrofon-, Permission-, Tray-, Shortcut-, WebContentsView-,
Zwischenablage- und Einfügetests. Ein Wechsel auf Electron 44 wäre ein eigener
Migrationsschritt mit höherem Breaking-Risiko und ist für 1.0 nicht durch diese
Befunde begründet.

## Empfohlene Reihenfolge

1. Nur die sechs transitiven Lockfile-Pins innerhalb der bestehenden Bereiche
   aktualisieren; direkte Dev-Paketversionen unverändert lassen.
2. Vollständigen und Produktionsaudit getrennt prüfen. Erwartung: beide 0.
3. Mit sauberer Installation (`npm ci`) sicherstellen, dass der Lockfile-Stand
   reproduzierbar ist, und die aufgelösten Versionen mit `npm ls` bestätigen.
4. Desktop-Bundles sowie Mac-App/DMG neu erstellen. Danach ASAR-Inventar,
   Ausschluss von `node_modules`, Fuses, ATS, ASAR-Integrität und strikte
   Codesign-Prüfung wiederholen.
5. Die vier isolierten Renderer-Smokes und die echte lokale Modellinitialisierung
   erneut ausführen.
6. Wegen `tar`, `brace-expansion` und der Windows-Packagerpfade den Windows-NSIS-
   Build nicht durch einen reinen Mac-Smoke ersetzen.
7. Electron und `@electron/fuses` erst danach als getrennte Änderungen prüfen,
   damit eine mögliche Laufzeitregression eindeutig zugeordnet werden kann.

## Verifikation dieser Analyse

- Vollständiger npm-Registry-Audit vor der transitiven Bereinigung: 6 hoch.
- `npm audit --omit=dev` in der bisherigen Releaseprüfung: 0.
- Vollständiger npm-Registry-Audit mit den jetzt sichtbaren bereinigten Pins:
  0 Befunde.
- `npm ls` bestätigt alle oben dokumentierten Elternketten und Zielversionen.
- Ein isolierter vollständiger Lockfile-Update-Simulationslauf in `/private/tmp`
  endete ebenfalls mit 0 Auditbefunden; er veränderte keine Workspace-Datei.

Der Auditstatus allein ist noch kein Packaging- oder Release-Nachweis. Erst die
oben aufgeführten reproduzierbaren Builds und Plattform-Smokes schließen das
Gate belastbar.
