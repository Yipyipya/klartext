# Kostenplan für Nivune 1.0 (K04)

Stand: 23. September 2026. Nichts davon ist gekauft oder beantragt. Preise sind
Recherchestand dieses Tages und können abweichen; maßgeblich ist der Preis beim
Abschluss.

## Einmalig und laufend

| Posten | Option | Kosten | Bewertung |
| --- | --- | --- | --- |
| macOS-Signierung und Notarisierung | Apple Developer Program (Einzelperson) | 99 USD pro Jahr, Anzeige in lokaler Währung ([Apple](https://developer.apple.com/programs/enroll/)) | **Empfohlen.** Einziger Weg zu einer Mac-App ohne Gatekeeper-Warnung. |
| Windows-Signierung | SignPath Foundation für Open-Source-Projekte | 0 EUR ([SignPath](https://signpath.org/terms.html)) | **Erste Wahl.** Setzt ein bereits veröffentlichtes OSS-Release, aktive Pflege und ausschließlich Open-Source-Komponenten voraus. Als Herausgeber erscheint „SignPath Foundation“. |
| Windows-Signierung | Certum Open Source Code Signing (nur Einzelpersonen) | etwa 69 EUR im ersten Jahr mit Karte und Leser, danach etwa 29 EUR pro Jahr; Cloud-Variante günstiger ([Certum](https://shop.certum.eu/code-signing.html)) | **Rückfalloption.** Herausgeber ist dein Name. |
| Windows-Signierung | Azure Artifact Signing | ab 9,99 USD pro Monat ([Microsoft](https://azure.microsoft.com/en-us/pricing/details/artifact-signing/)) | **Derzeit nicht nutzbar:** öffentliche Zertifikate für Einzelpersonen nur in den USA und Kanada. |
| Domain | `nivune.app` | etwa 15 bis 25 EUR pro Jahr, je nach Registrar | Empfohlen, da `.com` vergeben ist. |
| Hosting Web-App | Vercel (bestehendes Projekt) | 0 EUR im bisherigen Umfang | Statische Seiten, keine Serverfunktionen für Nutzerdaten. |
| Quellcode, CI, Releases | GitHub (öffentliches Repository) | 0 EUR | Öffentliche Repositories haben kostenlose Actions-Minuten. |
| Anbieter-Tests | OpenAI, Groq | wenige Cent bis etwa 2 EUR für alle Abnahmeproben | Nur kurze, freigegebene Proben. |
| Social-Video | Eigene Bildschirmaufnahmen und Stimme | 0 EUR | Empfohlen. KI-Generierung nur mit separatem Budget. |

## Summe

| Szenario | Erstes Jahr | Folgejahre |
| --- | --- | --- |
| Empfohlen (Apple + SignPath + Domain) | etwa 110 bis 120 EUR | etwa 110 bis 120 EUR |
| Mit Certum statt SignPath | etwa 180 bis 190 EUR | etwa 140 bis 150 EUR |
| Minimal (ohne Signierung, als klar gekennzeichnete Beta) | etwa 15 bis 25 EUR für die Domain | wie erstes Jahr |

Es entstehen keine laufenden Kosten pro Nutzer: Nivune betreibt keine Server für
Audio oder Text. Nutzer zahlen Cloud-Anbieter direkt.

## Hinweise

- Auch korrekt signierte neue Windows-Dateien können anfangs SmartScreen-
  Warnungen auslösen, bis sie Reputation aufgebaut haben.
- Ohne Apple-Mitgliedschaft bleibt die macOS-Installation mit einer Warnung
  verbunden. Das ist für eine gekennzeichnete Beta vertretbar, für 1.0 nicht.
- Zugangsdaten zu Apple, Zertifikaten und Registrar bleiben bei dir. Im Build
  werden nur Profilnamen aus dem Schlüsselbund beziehungsweise Umgebungsvariablen
  referenziert.
