# Beta, Nutzenprüfung und Vergleich (K01, K02, K05, K31 bis K33)

Stand: 23. September 2026. Alles hier ist Plan und Hypothese; es gibt noch keine
Beta-Ergebnisse. Keine simulierten Nutzerberichte.

## 1. Hypothese (K05)

Menschen, die täglich Nachrichten, E-Mails und Notizen am Computer schreiben und
zwischen Deutsch und Englisch wechseln, sparen mit Nivune Zeit, wenn der Text
ohne Nacharbeit nutzbar ist und sie Kosten und Datenweg selbst wählen können.

**Noch nicht belegt:** dass diese Gruppe Nivune gegenüber ihrer bisherigen Lösung
bevorzugt.

**Bekannte Reibungspunkte, priorisiert nach Vermutung:**

1. Installationswarnungen ohne Signatur (bis K27 erledigt ist).
2. Modelldownload von 85 bis 600 MB vor dem ersten lokalen Text.
3. API-Key-Beschaffung für Cloud-Anbieter.
4. macOS-Bedienungshilfen-Freigabe für automatisches Einfügen.
5. Lokale Geschwindigkeit auf älteren Geräten.

## 2. Messverfahren

| Messung | Wie | Ziel (vorläufig) |
| --- | --- | --- |
| Einstieg | Zeit von Installationsstart bis zum ersten eingefügten Diktat, ohne Hilfe. Modelldownload und Key-Beschaffung getrennt erfassen. | 9 von 12 schaffen es selbst, Bedienzeit höchstens 5 Minuten |
| Wiederkehr | Selbstauskunft am Ende der Woche: an wie vielen Tagen genutzt | 8 von 12 an mindestens 3 Tagen |
| Wechselgrund | Offene Frage: Für welche wiederkehrende Aufgabe ist Nivune besser als bisher? | 6 von 12 nennen eine konkrete Aufgabe |
| Nacharbeit | Pro Teilnehmer 3 Referenzaufgaben (siehe 4.), Anzahl Korrekturen und Zeit bis zum fertigen Text, mit bisheriger Methode verglichen | Messwert festhalten, kein Pauschalversprechen |
| Zuverlässigkeit | Jeder Fehler mit Wiederherstellungsweg? Jeder Text- oder Audioverlust ist ein P0-Befund. | Kein stiller Verlust |

Kein Tracking in der App. Alle Daten kommen aus freiwilligem Feedback.

## 3. Interviewleitfaden (K02), 20 Minuten vor der Beta

1. Wofür schreibst du am Computer die meisten Texte? Wie viele pro Tag?
2. Wie entstehen sie heute (Tippen, Diktierfunktion des Systems, andere App)?
3. Was nervt dich daran konkret? Letztes Beispiel?
4. Nutzt du schon eine Diktier- oder Transkriptionslösung? Was kostet sie dich?
5. Wie wichtig ist dir, dass Audio dein Gerät nicht verlässt? (1 bis 5)
6. Hast du schon einmal einen API-Key angelegt? Für welchen Dienst?
7. In welchen Sprachen schreibst du? Wechselst du innerhalb eines Textes?
8. Was müsste ein neues Werkzeug können, damit du wechselst?

Nicht fragen, ob die Person Nivune „gut fände“. Nach Verhalten fragen.

## 4. Beta-Aufgaben (sieben Tage)

**Tag 1:** Installieren und die Einrichtung bis zum ersten Text durchlaufen.
Notieren, wo es hakte.

**Referenzaufgaben (einmal mit Nivune, einmal wie bisher):**

1. Eine Antwort-E-Mail mit etwa 80 Wörtern, die einen Termin und eine Zahl enthält.
2. Eine Chat-Nachricht mit einem Eigennamen und einer Verneinung.
3. Eine Notiz von etwa 2 Minuten Sprechzeit aus dem Kopf.

**Tag 2 bis 7:** Normal nutzen. Am Ende ein kurzer Fragebogen (5 Minuten).

## 5. Einladungstext (Vorlage zum Anpassen)

> Hi [Name], ich baue gerade Nivune, ein kostenloses Open-Source-Diktierwerkzeug
> für Mac, Windows und Browser. Du sprichst, der Text landet dort, wo dein Cursor
> steht. Lokal auf deinem Gerät oder mit einem eigenen KI-Anbieter.
> Hättest du Lust, es eine Woche zu testen? Aufwand: 20 Minuten Gespräch vorab,
> Installation, danach normal nutzen und am Ende 5 Minuten Fragebogen. Deine
> Texte sehe ich nicht, es gibt kein Tracking.

## 6. Abschlussfragebogen

1. An wie vielen Tagen hast du Nivune genutzt? (0 bis 7)
2. Wofür am häufigsten?
3. Welche Aufgabe erledigst du jetzt lieber mit Nivune als vorher? (oder: keine)
4. Was hat dich am meisten gestört?
5. Gab es Momente, in denen Text oder Aufnahme verloren ging? Wie?
6. Lokal oder Cloud genutzt? Warum?
7. Würdest du es weiter nutzen? Warum (nicht)?

## 7. Kompakter Vergleich (K01)

Vergleich mit [Handy](https://github.com/cjpais/Handy) und
[OpenWhispr](https://github.com/OpenWhispr/openwhispr) auf demselben Mac:

- dieselben drei Referenzaufgaben, gleiche Sprecherin oder gleicher Sprecher,
  gleiche Umgebung, gleiche Modellgröße soweit möglich;
- gemessen: Zeit bis zum eingefügten Text, Anzahl Korrekturen, Einrichtungszeit,
  Offline-Fähigkeit, Datenweg;
- Ergebnis als Tabelle mit Datum, Versionen und Gerät. Keine Werte der
  Wettbewerber aus deren Marketing übernehmen. Unterschiede nüchtern festhalten.

## 8. Testkorpus (K31)

Mindestens 20 deutsche und 20 englische Aufnahmen: Sprachwechsel, Eigennamen,
Zahlen, Verneinungen, Selbstkorrekturen, Stille, Hintergrundgeräusche. Nur eigene
Stimme oder schriftliche Einwilligung der Sprechenden. Aufnahmen gehören nicht in
das öffentliche Repository.

## 9. Entscheidung nach der Beta

- Ziele erreicht: Launch-Paket vorbereiten.
- Einstieg verfehlt: die drei häufigsten Hürden beheben (K34), kleine zweite Beta.
- Wiederkehr verfehlt: Positionierung prüfen, keine größere Kampagne.
