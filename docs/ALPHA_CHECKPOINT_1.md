# Interner Alpha-Checkpoint 1

Stand: 17. September 2026. Dieser Checkpoint ist **unveröffentlicht** und ändert
die öffentliche Version 0.3.0 nicht. Ziel ist eine frühe, zusammenhängende Abnahme
der wichtigsten bestehenden Diktierwege, bevor M4 weitere Oberfläche hinzufügt.

## Eintrittsstand

- gemeinsamer Verarbeitungskern und sichere Schema-1-Migration;
- Web- und Desktop-Diktat mit OpenAI sowie lokalem Whisper;
- bewusste Audioanbieterwahl OpenAI, Groq oder kompatibler Server;
- Textüberarbeitung aus, lokale Regeln, OpenAI, Ollama oder kompatibler Server;
- zielgebundene Zugangsdaten, im Desktop OS-verschlüsselt;
- 120 automatisierte Tests, TypeScript, Web-Produktionsbuild, Desktop-Shared-Bundle
  und isolierter Electron-Einstellungs-Smoke grün;
- Web- und Electron-Einstellungen visuell/Accessibility geprüft.

## Nutzerabnahme auf dem Test-Mac

1. Bestehende installierte 0.3.0 einmal normal starten und ein kurzes Diktat als
   Referenz durchführen. Keine persönlichen Keys oder Profildateien teilen.
2. Interne Alpha installieren beziehungsweise starten. Prüfen, dass Shortcut,
   Sprache, Kontext, Bereinigung und vorhandener OpenAI-Key erhalten sind.
3. Drei echte Desktop-Diktate in einer normalen Ziel-App: kurzer Satz, Eigennamen
   aus dem Wörterbuch, ungefähr zwei Minuten Fließtext. Einfügen am ursprünglichen
   Cursor und Abbruch mit Escape mitprüfen.
4. Ein Web-Diktat und einen Web-Dateiimport im OpenAI-Pfad durchführen. Rohtext,
   Ergebnis, Verlauf und Wiederholung nach absichtlich fehlgeschlagenem
   Feinschliff prüfen.
5. Lokales Web- und Desktop-Diktat nach vorbereitetem Modell durchführen. Danach
   App/Tab neu starten und denselben Weg ohne neuen Modelldownload wiederholen.
6. Einstellungen zwischen OpenAI, lokal und nur dann einem weiteren Anbieter
   wechseln, wenn dafür ein eigener freigegebener Testzugang vorhanden ist.

Der Nutzer notiert je Fall: bestanden/fehlgeschlagen, App, ungefährer Audioumfang,
sichtbare Fehlermeldung und ob Rohtext/Audio erhalten blieben. Keys, vollständige
private Diktate und Zugangsdaten gehören nicht in den Bericht.

## Agent-E2E

- frisches Profil und echtes Upgrade einer Kopie des produktiven 0.3.0-Profils;
- OpenAI-Webdiktat, Web-Dateiimport und Desktopdiktat mit derselben Test-WAV;
- lokales Whisper in Web/Desktop, Neustart aus vorbereitetem Cache und Prüfung
  fehlender Modellteile ohne stillen Download;
- lokaler kompatibler Audio- und Text-Loopbackserver inklusive optionalem Key,
  Zieladresswechsel, Redirect-Sperre und Rohtext-Fallback;
- Fehlerfälle 401, 429, Timeout, Abbruch, leere Antwort und ungültiges JSON ohne
  stillen Anbieterwechsel;
- globaler Shortcut, Stille-Ende, Escape-Abbruch und Einfügen am Cursor;
- Web-Konsole, Electron-Logs, Netzwerkziele und gespeicherte Profile auf Secrets,
  Fremdhosts und Datenverlust prüfen.

## Bestehenskriterium

Checkpoint bestanden, wenn alle OpenAI- und Lokal-Pflichtwege auf dem Test-Mac
funktionieren, kein P0/P1-Fehler offen ist, ein Feinschliff-Fehler den Rohtext nie
verliert und Upgrade/Neustart keinen Einstellungs- oder Keyverlust zeigen. Reale
Groq-/Fremdserverabnahme darf als klar benannte externe Lücke offen bleiben und
gilt dann nicht als geprüft. Windows bleibt ein eigener Pflichtcheckpoint vor 1.0.

**Implementiert:** Eintrittscode auf `develop/v1-core`.
**Geprüft:** automatisierte, Build-, Loopback- und Oberflächennachweise wie oben.
**Veröffentlicht:** nichts aus diesem Checkpoint.

## Laufende Nutzerabnahme

Am 17. September 2026 wurde der Qualitätsweg der installierten Alpha real in
einer normalen Ziel-App geprüft. Nach bewusster Eingabe des getrennten
OpenAI-Keys und der macOS-Mikrofonfreigabe funktionierten Aufnahme,
Cloud-Transkription und Ablage des fertigen Texts in der Zwischenablage. Beim
ersten Lauf war automatisches Einfügen noch nicht freigegeben; das Alpha-Log
bestätigte den erwarteten Berechtigungszustand und manuelles Einfügen
funktionierte. Nach der separaten Freigabe von `Klartext Alpha` unter macOS →
Datenschutz & Sicherheit → Bedienungshilfen wurde derselbe Weg wiederholt und
der Text automatisch in die zuvor aktive Ziel-App eingefügt. Der zentrale
Mac-Qualitätsdiktatpfad dieses Checkpoints ist damit **bestanden**.

**Implementiert:** Zwischenablage-Fallback und sichtbarer Berechtigungsstatus.
**Geprüft:** echter globaler Alpha-Shortcut, Aufnahme, OpenAI-Transkription,
Zwischenablage-Fallback bei fehlender Freigabe und automatisches Einfügen nach
Bedienungshilfenfreigabe auf dem Test-Mac.
**Nicht geprüft:** die übrigen Fälle der vollständigen Checkpoint-Liste,
insbesondere Langdiktat, Escape-Abbruch, lokaler Desktoppfad und Windows.
**Veröffentlicht:** unverändert nichts aus diesem Checkpoint.

## Installierter Kandidat

`Klartext Alpha` 1.0.0-alpha.1 ist auf dem Test-Mac separat unter
`/Applications/Klartext Alpha.app` installiert. Die App verwendet die Bundle-ID
`app.klartext.desktop.alpha`, das eigene Profil `Klartext Alpha`, den Shortcut
`⌥ + ⇧ + Leertaste` und keinen Autostart. Metadaten, ad-hoc-Signatur und isolierter
Paketstart sind geprüft. Sie ist ein interner Testkandidat, nicht notarisiert und
nicht veröffentlicht; vorhandene Keys der stabilen App werden bewusst nicht
übernommen. Ein normaler Start hat das separate Alpha-Profil und dessen Log
angelegt; die produktive Einstellungsdatei blieb zeitlich unverändert.
