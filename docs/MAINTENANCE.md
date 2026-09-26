# Wartungsmodell (K45)

Stand: 23. September 2026. Gilt ab der ersten öffentlichen 1.0-Version.

## Verantwortung

Nivune wird von einer Person gepflegt. Beiträge sind willkommen, es gibt aber
keine zugesagten Reaktionszeiten. Das steht so auch in `SECURITY.md`.

## Sicherheit

- Meldungen ausschließlich über den in `SECURITY.md` beschriebenen privaten Weg.
- Angestrebt, aber nicht zugesagt: Eingangsbestätigung innerhalb von 7 Tagen,
  Bewertung innerhalb von 14 Tagen. `SECURITY.md` verspricht bewusst keine festen Fristen.
- Kritische Befunde (Schlüsselabfluss, ungefragte Aufnahme, unbemerkte Cloud-
  Nutzung, Datenverlust) haben Vorrang vor allen Funktionen und bekommen eine
  Pflegeversion 1.0.x.
- Abhängigkeiten: `npm audit` für Root und Desktop vor jedem Release, dazu eine
  monatliche Durchsicht. Electron-Sicherheitsupdates werden zeitnah übernommen.

## Release-Rhythmus

- Pflegeversionen (1.0.1, 1.0.2 ...) bei Bedarf, ohne festen Termin.
- Funktionsversionen gemäß [VERSION_ROADMAP.md](VERSION_ROADMAP.md), nach Bedarf.
- Jede Version: Tests, Build, Paket-Smokes, Prüfsummen, Release-Notizen,
  aktualisierte [Feature-Liste](FEATURE_STATUS.md).
- Updates werden nie still installiert. Die App zeigt neue Versionen nur auf
  Nachfrage an und öffnet die offizielle Release-Seite.

## Anbieteränderungen

OpenAI, Groq und Ollama ändern Modelle und Schnittstellen. Reaktion:

- Modell-IDs sind in der App frei eintragbar; eine Umbenennung bricht Nivune
  daher nicht, sondern erfordert höchstens eine neue Voreinstellung.
- Schnittstellenänderungen werden als Fehler gemeldet und mit einer
  Pflegeversion behoben. Es gibt nie einen stillen Wechsel zu einem anderen
  Anbieter.

## Übersetzungen

Deutsch und Englisch sind gepflegt. Weitere Oberflächensprachen folgen erst mit
einer Person, die sie dauerhaft pflegen möchte (Roadmap 1.4).

## Fehlertriage

| Stufe | Beispiel | Vorgehen |
| --- | --- | --- |
| P0 | Text- oder Audioverlust, Key-Abfluss, ungefragte Übertragung | sofort, Pflegeversion |
| P1 | Diktat auf einer unterstützten Plattform unbenutzbar | nächste Pflegeversion |
| P2 | Einzelne Funktion eingeschränkt, Umgehung vorhanden | nächste Funktionsversion |
| P3 | Kosmetik, Wünsche | bei Gelegenheit |

## Unterstützung

Freiwillige Unterstützung (zum Beispiel GitHub Sponsors) ist möglich, aber
optional. Keine Kernfunktion wird dafür gesperrt.
