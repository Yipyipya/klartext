# Textüberarbeitungsadapter

Stand: 16. September 2026

Dieses Dokument beschreibt den unveröffentlichten ersten K15-Teilstand. OpenAI
bleibt der bestehende Qualitätsadapter über die Responses API, Ollama die lokale
Option. Neu hinzugekommen ist ein Adapter für eigene OpenAI-kompatible
Chat-Completions-Endpunkte. Er ist noch nicht in der Oberfläche freigeschaltet;
native Claude- und Gemini-Adapter bleiben offen.

## Kompatibler Vertrag

Die Basisadresse endet vor `/chat/completions`. Der Adapter sendet nur einen
kleinen, weit verbreiteten Vertrag:

- manuelle Modell-ID;
- eine `system`-Nachricht mit den konservativen Nivune-Regeln, Kontext und
  Wörterbuch;
- eine `user`-Nachricht mit klar markiertem Diktat;
- `temperature: 0` und `stream: false`;
- optional `Authorization: Bearer <Key>`.

Die Antwort muss `choices[0].message.content` enthalten. `finish_reason: length`,
leere Inhalte, ungültiges JSON und HTTP-Fehler gelten nicht als fertige
Überarbeitung. Lange Texte werden vollständig in begrenzten Abschnitten
verarbeitet. Anschließend bleibt die semantische Sicherung des gemeinsamen Kerns
zuständig: Eine Modellantwort ersetzt das Transkript nur, wenn sie die
Inhaltsprüfung besteht.

Die Form orientiert sich an der offiziellen
[OpenAI Chat-Completions-Referenz](https://platform.openai.com/docs/api-reference/chat/create).
»OpenAI-kompatibel« bedeutet trotzdem keine universelle Zusage: Ein eigener
Server muss diesen konkreten Vertrag real unterstützen.

## Sicherheitsgrenzen

- Entfernte Server müssen HTTPS verwenden; HTTP ist nur auf Loopback zulässig.
- Zugangsdaten, Query und Fragment sind in der Basisadresse verboten.
- Redirects werden nicht verfolgt, damit ein Key nicht an ein anderes Ziel
  weitergereicht wird.
- Lokale Server dürfen ohne Key laufen.
- Der Adapter speichert keine Zugangsdaten und aktiviert kein importiertes Profil.
  Diese Nutzerentscheidungen folgen mit K16–K18.

## Prüfstand und Grenze

Der aktuelle Gesamtsatz mit 120 automatisierten Tests ist grün. Die K15-Tests decken Requestform,
System-/Nutzernachrichten, Modell, optionalen Key, ungültige und unvollständige
Antworten sowie vollständige Langtextaufteilung ab. Ein echter lokaler
Loopback-HTTP-Smoke bestätigt Endpunkt, Header, JSON-Vertrag und Antwortparsing.
TypeScript, Web-Produktionsbuild und Desktop-Shared-Bundle sind grün. Web und
Desktop bieten den kompatiblen Adapter sichtbar mit eigener Adresse, Modell-ID
und optionalem, zielgebundenem Key an; beide Oberflächen wurden im echten Medium
visuell und über Accessibility geprüft.

Noch offen sind reale kompatible Fremdserver, Browser-CORS, Modellqualität,
Verbindungsprüfung und sichere Profil-/Schlüsselverwaltung sowie die nativen
Claude- und Gemini-Verträge. Veröffentlicht ist weiterhin nur Nivune 0.3.0.
