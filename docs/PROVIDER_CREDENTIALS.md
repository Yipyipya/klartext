# Anbieterzugänge und Modelllisten

Stand: 17. September 2026

Dieses Dokument beschreibt den unveröffentlichten K16-/K17-Teilstand.
Die zentrale Referenz- und Speichergrenze ist implementiert. Groq und eigene
kompatible Transkriptionsserver können in Web und Desktop bewusst als
Qualitätsprofil gewählt werden. Der Desktop löst die getrennten Keys ausschließlich
aus dem OS-verschlüsselten Speicher auf und verarbeitet Diktate über das sichtbare
Profil; OpenAI bleibt die Voreinstellung.

## Trennung der Zugangsdaten

Einstellungen enthalten nur Referenzen, niemals den Key selbst:

- OpenAI: `provider:openai:default`
- Groq: `provider:groq:default`
- eigene Server: getrennt nach Zweck und normalisierter Zieladresse

Audio- und Textzugang für dieselbe eigene Adresse erhalten unterschiedliche
Referenzen. Eine andere Adresse erhält ebenfalls eine andere Referenz. Damit kann
ein Profilwechsel nicht versehentlich den Key eines anderen Anbieters oder Ziels
verwenden.

Beim Ändern der kompatiblen Zieladresse leert die Web-Oberfläche den sichtbaren
Key. Der Speicher akzeptiert ihn nur, wenn seine Zielreferenz exakt zur aktuell
normalisierten Adresse passt. Alte Zielreferenzen werden beim Speichern entfernt.

Web und Desktop filtern den getrennten Credential-Speicher beim Lesen und
Schreiben. Unbekannte Referenzen, Nicht-Text-Werte, leere oder unplausibel große
Einträge gelangen nicht in die Laufzeit. Der Desktop speichert weiterhin nur den
vom Betriebssystem verschlüsselten Wert in der separaten Credential-Datei.

## Modelllisten

- Groq kann über den dokumentierten `/openai/v1/models`-Endpunkt abgefragt
  werden. Nivune zeigt daraus nur Whisper-Modell-IDs im Transkriptionskontext.
- Eigene kompatible Server können `<Basisadresse>/models` anbieten.
- `404`, `405` oder `501` bedeuten »Modellliste nicht unterstützt«, nicht
  »Zugangsdaten ungültig«. Eine manuelle Modell-ID bleibt zulässig.
- `401`, andere HTTP-Fehler, Timeout oder ungültiges JSON bleiben sichtbare
  Verbindungsfehler.
- Modelllistenaufrufe folgen keinen Redirects und verwenden denselben
  HTTPS-/Loopback-Vertrag wie die eigentliche Verarbeitung.

## Prüfstand und Grenze

120 automatisierte Tests, TypeScript, Web-Produktionsbuild, Desktop-Shared-Bundle
und isolierter Electron-Einstellungs-Smoke sind grün. Geprüft sind getrennte
Referenzen, Adressnormalisierung, Speicherfilterung, Groq-Filterung, optionale
kompatible Listen, explizite Profilwahl in Diktat und Dateiimport sowie
Fehlerzustände sowie getrennte kompatible Audio-/Textprofile. Die
Web-Produktionsoberfläche und das echte Electron-Fenster wurden im
Accessibility-Baum und visuell geprüft; OpenAI-, Groq- und kompatible Audio- und
Textfelder wechselten korrekt.

Noch offen sind Web-Sitzungsschlüssel statt ausschließlichem Browserspeicher,
bewusste Freigabe importierter Ziele, detaillierte
Browser-CORS-Hilfe und echte Anbieterabnahme. OpenAI bleibt die Web-Voreinstellung;
es gibt keinen stillen Rückfall oder Wechsel. Die Live-Version bleibt 0.3.0.
