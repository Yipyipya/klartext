# Entwicklungsübergabe: Nivune 1.0

Stand: 23. September 2026

## Sofortkontext für die Fortsetzung

- Repository: `/Users/jakobmeyer/Documents/Whispr Flow Klon/klartext`
- Branch: `develop/v1-core`
- Der Worktree ist absichtlich umfangreich und nicht committed. Nichts
  zurücksetzen, bereinigen oder als Fremdänderung verwerfen.
- Der öffentliche Stand bleibt 0.3.0. Nichts wurde veröffentlicht.
- Der geplante Release-Name ist **Nivune**. Die Aussprache ist „Ni-wu-ne“.
- Der Nutzer reserviert Domain und Handles später selbst. Keine Registrierung,
  kein Kauf und keine externe Umbenennung ohne ausdrückliche Freigabe.
- Alte interne Bezeichner wie `klartext.*`, `window.klartext`, alte Profile und
  bestehende „Hey Klartext“-Sprachmodelle sind absichtliche Kompatibilität.
- Maßgeblich sind außerdem `AGENTS.md`, `STATUS.md`,
  `docs/FEATURE_STATUS.md`, `docs/OPEN_SOURCE_PLAN.md`,
  `docs/NAME_CLEARANCE.md` und `docs/SECURITY_AUDIT_NIVUNE.md`.

## Zuletzt abgeschlossener Block (23. September 2026)

Kandidat **1.0.0-beta.1**: Alles ohne Mitwirkung Machbare ist umgesetzt. Die
übrigen Schritte stehen gebündelt in
[RELEASE_1.0_CHECKLIST.md](RELEASE_1.0_CHECKLIST.md).

Neu und geprüft:

- Manuelle Updateprüfung (K28): `shared/release.ts`, `desktop/main.js`
  (`runUpdateCheck`, `openOfficialReleasePage`, Tray), Einstellungen „Allgemein“.
  Tests: `tests/release-updates.test.cjs`.
- Web-Key-Speicherwahl (K17): `lib/store.ts` (`CREDENTIAL_PERSISTENCE_KEY`),
  Schalter unter „Sprache & Verhalten“. Test in `tests/settings-migration.test.cjs`.
- CORS-Hilfe (K18): `BrowserConnectionHelp` in `app/(de)/app/page.tsx`.
- Website (K36 bis K38): `components/site/*`, Route-Gruppen `app/(de)` und
  `app/(en)` mit eigenen Root-Layouts, `app/sitemap.ts`, `app/robots.ts`,
  `public/og-image.png`, `shared/site.ts`. Tests: `tests/site.test.cjs`.
- Arbeitsbereich unter `/app` (K37): Manifest `id: "/"`, `start_url: "/app"`,
  Service Worker `nivune-shell-v2` (`public/sw.js`), Tests in `tests/offline.test.cjs`.
- Version 1.0.0-beta.1 (beide `package.json` und Lockfiles).
- Frische Pakete: `desktop/dist/Nivune-Mac-AppleSilicon.dmg`,
  `desktop/dist/Nivune-Windows.exe`, `desktop/dist-alpha/mac-arm64/Nivune Alpha.app`,
  Prüfsummen und Manifest in `desktop/dist/Nivune-1.0.0-beta.1-*`.

Konfiguration für den Launch (nur Umgebungsvariablen, keine Codeänderung nötig):

- `NEXT_PUBLIC_SITE_URL=https://<finale-domain>` schaltet Indexierung, Canonical,
  hreflang, Sitemap und OG-Metadaten frei.
- `NEXT_PUBLIC_LEGAL_NOTICE_URL` blendet das Impressum ein.
- `NEXT_PUBLIC_INSTALLERS_SIGNED=1` erst nach echter Signierung.
- Repository-Umzug: nur `RELEASE_REPOSITORY` und `WEB_APP_URL` in
  `shared/release.ts` anpassen, danach Tests, Build und Pakete neu.

## Aktuelle Verifikation

Nach der letzten Quelländerung am 23. September 2026:

```text
npm test                                      194/194 bestanden
npm run typecheck                             bestanden
npm run build                                 bestanden
npm run desktop:bundle                        bestanden
npm audit (Root/Desktop, prod/voll)           0 Befunde
Paket-Smokes (Nivune.app, Nivune Alpha.app)   je 4/4 + Offline-Modellstart
codesign --verify --deep --strict             bestanden (ad hoc)
hdiutil verify (DMG)                          gültig
```

Hinweis: `npx @electron/asar extract-file` schreibt in das aktuelle Verzeichnis.
In dieser Sitzung wurde dadurch `desktop/package.json` einmal überschrieben und
sofort vollständig wiederhergestellt; danach liefen Tests, DMG- und Alpha-Build
erneut grün. Paketinhalte nur in leeren temporären Ordnern extrahieren.

## Nächster sinnvoller Schritt

1. Freigaben aus Block A der Checkliste einholen, vor allem Commit und Push (A1).
2. Nach A1: thematische Commits, Push, erster CI-Lauf mit Windows-Paketjob.
3. Mac-Abnahme (Block C) durch den Nutzer mit `Nivune Alpha.app`.
4. Nach Domain-/Handle-Entscheidung: `shared/release.ts`, Vercel-Domain,
   Umgebungsvariablen, Impressum; dann Beta-Pre-Release.
5. Optional vor 1.0: kleine CLI als Developer Preview (F29), nur falls gewünscht.

## Bekannte offene Release-Gates

- Authentische macOS-Signierung und Notarisierung sind nicht erfolgt.
- Ein Windows-x64-Paket ist gebaut (Cross-Build); die reale Windows-Abnahme fehlt.
- Der aktuelle Downloadpfad verweist noch auf das alte externe Repository und
  darf nicht als finaler Nivune-1.0-Download beworben werden.
- Domain, GitHub-/Social-Handles und externe Umbenennung sind absichtlich offen.
- `.com` ist bereits von einem Dritten registriert; `.app`, GitHub-Organisation
  und npm-Name erschienen bei der Vorprüfung frei, sind aber nicht reserviert.
- Die Namenssuche ist eine dokumentierte Vorprüfung, keine Rechtsberatung und
  keine Markenfreigabe.
- Der Audio-Renderer besitzt noch eine bewusst breite CSP für ausgewählte
  HTTPS-Modellquellen; weitere Verengung ist eine Härtung, kein aktueller
  Funktionsblocker.
- Web-HSTS muss am echten Deployment geprüft werden.
- Keine Schlüssel, privaten Diktate oder Modellcaches in Git aufnehmen.

## Bereits getroffene Produktentscheidungen

- Nivune wird als normales MIT-Open-Source-Projekt vorbereitet, nicht als
  unmittelbar monetarisiertes Produkt.
- Der Produktname und der persönliche Startbefehl sind getrennt. Standardvorschlag
  ist „Diktat starten“ beziehungsweise „Start dictation“; zwei bis fünf kurze
  Wörter sind frei wählbar. Alte „Hey Klartext“-Modelle bleiben kompatibel.
- Keine 1.1-Funktionen vorziehen. Native Deepgram-, Claude-/Gemini-Adapter,
  größere CLI-/MCP-/Agentenschichten und zusätzliche Produktfeatures folgen
  erst nach einem belastbaren 1.0-Kandidaten.
- Qualität, lokale Verarbeitung, Anbieterfreiheit und ehrliche Release-Aussagen
  haben Vorrang vor zusätzlichem Funktionsumfang.

## Nicht tun

- Den schmutzigen Worktree nicht resetten, bereinigen oder pauschal formatieren.
- Keine alten Klartext-Kompatibilitätspfade mechanisch entfernen.
- Kein Release, Commit, Push, Kauf, Domain-/Handle-Reservierung oder Signatur-
  Credential verwenden, solange das nicht ausdrücklich freigegeben ist.
- Nicht behaupten, 1.0 sei fertig veröffentlicht. Lokal ist viel implementiert
  und geprüft; die oben genannten Paket-, Plattform- und externen Gates bleiben.
