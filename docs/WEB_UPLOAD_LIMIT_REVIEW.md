# Review: Queue- und Gesamtbytegrenzen im Web-Dateiimport

Stand: 21. September 2026

Umsetzungsstatus: Die empfohlenen Grenzen und Regressionstests wurden
anschließend implementiert. Der Bericht bewahrt die Analyse des Ausgangsstands.

## Ergebnis

Der Befund F-07 ist bestaetigt. Der Web-Dateiimport verarbeitet zwar immer nur
eine Datei gleichzeitig, nimmt aber beliebig viele Dateien und beliebig viele
Bytes in die wartende Queue auf. Die vorhandenen Einzeldatei- und
Dauergrenzen greifen erst waehrend der spaeteren Audioverarbeitung. Damit kann
eine Mehrfachauswahl den Tab lange beschaeftigen und im Qualitaetsmodus viele
kostenpflichtige Provideranfragen ohne vorgelagerte Gesamtgrenze ausloesen.

Die kleinste konsistente Behebung ist:

- hoechstens **12 aktive oder wartende Dateien** (wie im Desktop);
- hoechstens **300.000.000 Bytes** aktive oder wartende Dateien zusammen;
- hoechstens **100.000.000 Bytes je Web-Importdatei** bereits vor dem Enqueue;
- abgelehnte Dateien als bestehende `fehler`-Karten anzeigen, angenommene
  Dateien unveraendert seriell verarbeiten;
- Count und Bytes in jedem `finally` wieder freigeben, also auch bei
  Providerfehler, Abbruch oder Decodefehler.

300 MB sind bewusst eine runde Browsergrenze: Sie lassen weiterhin zwoelf
direkt providerfaehige Dateien am bestehenden 24-MB-Limit zu (maximal 288 MB),
verhindern aber vier bis zwoelf gleichzeitig referenzierte 100-MB-Dateien. Die
Grenzen zaehlen nur laufende und wartende Dateien. Bereits fertige oder
fehlgeschlagene Ergebnis-Karten duerfen keine Kapazitaet belegen.

## Nachverfolgter Pfad

1. Dateiauswahl und Drag-and-drop landen beide in `addFiles` in
   `components/UploadPanel.tsx:174-187`.
2. Dort werden Dateien nur anhand MIME-Praefix oder Endung gefiltert. Die
   verbleibenden `File`-Objekte werden vollstaendig in React-State und
   `queueRef` uebernommen. Es gibt keine Anzahl- oder Summengrenze.
3. `processNext` in `components/UploadPanel.tsx:98-171` entnimmt genau eine
   Datei. `busyRef` serialisiert die Verarbeitung; die Queue selbst ist aber
   unbeschraenkt.
4. Im Qualitaetsmodus baut `createCloudTranscriptionRequest` das ausgewaehlte
   Providerprofil. `transcribeUpload` sendet eine unter dem Providerlimit
   liegende MP3/MP4/M4A/WAV/WebM-Datei direkt oder dekodiert und teilt sie in
   WAV-Abschnitte.
5. Im Lokalmodus ruft das Panel `decodeAudio(..., true)` auf, mischt alle
   Kanaele in einen neuen Mono-`Float32Array` und reicht diesen an lokales
   Whisper weiter. Fuer die Spitzenbelegung existieren dabei gleichzeitig
   komprimierter `File`, `ArrayBuffer`, dekodierte Kanaele und Mono-Kopie.
6. Beim Unmount wird nur der aktuelle `AbortController` abgebrochen
   (`components/UploadPanel.tsx:90-95`). Wartende Referenzen werden erst mit
   dem Komponentenobjekt freigegeben; waehrend die Ansicht lebt, existiert
   keine manuelle Queuebereinigung.

Es gibt keinen separaten Upload-Hook. Queue, Status, Abbruch und Verarbeitung
liegen vollstaendig in `UploadPanel`.

## Bestehende Grenzen und ihre genaue Wirkung

### Einzelne Provideranfrage

- OpenAI: `24.000.000` Bytes in `shared/openai-provider.ts`.
- Groq: `24.000.000` Bytes in
  `shared/cloud-transcription-providers.ts`.
- OpenAI-kompatibel: standardmaessig `24.000.000` Bytes in derselben Datei.
- `canUploadDirectly` erlaubt den Direktpfad nur bis zum jeweiligen Limit und
  nur fuer MP3, MP4, MPEG/MPGA, M4A, WAV und WebM
  (`lib/audio-upload.ts:18-20`). OGG/OGA/AAC/FLAC aus der UI gehen deshalb
  immer ueber den Decode-/Chunkpfad.

### Browser-Decode und Aufteilung

- `decodeAudio` lehnt erst beim Verarbeitungsbeginn Dateien ueber
  `100.000.000` Bytes ab (`lib/audio-upload.ts:46-49`).
- Es lehnt im Decodepfad Metadaten- oder dekodierte Dauer ueber `1.800`
  Sekunden ab (`lib/audio-upload.ts:49-55`).
- Die Dauerpruefung ist **keine allgemeine Importgrenze**: direkt hochladbare
  Cloud-Dateien werden sofort gesendet; ihre Metadaten werden nur parallel
  gelesen und danach als Ergebnisdauer verwendet
  (`lib/audio-upload.ts:141-145`). Eine stark komprimierte Datei unter 24 MB
  kann deshalb laenger als 30 Minuten sein.
- Der Qualitaetsmodus splittet dekodiertes PCM so, dass jeder erzeugte
  WAV-Abschnitt unter dem Providerlimit bleibt
  (`lib/audio-upload.ts:147-160`).

### Queue und UI

- Keine Grenze fuer Anzahl oder Gesamtbytes.
- Kein vorgezogenes Leerdatei- oder 100-MB-Feedback. Leerdateien werden im
  Cloudpfad spaet erkannt; im Lokalpfad enden sie typischerweise als generischer
  Decodefehler.
- Nicht unterstuetzte Dateien werden in `addFiles` still verworfen.
- Die vorhandene Hilfszeile nennt 100 MB und 30 Minuten, erklaert aber nicht,
  dass 30 Minuten nur fuer dekodierte Dateien gelten, und nennt keine
  Queuegrenze (`components/UploadPanel.tsx:251-254`).

Der Desktop ist die passende Produktreferenz: `MAX_QUEUE_JOBS = 12` und
`SerialWorkspaceQueue.enqueue` zaehlen aktive plus wartende Jobs
(`desktop/workspace-jobs.js:3-5` und `112-119`). Dessen 24-MB-Cloudlimit kann
nicht unveraendert fuer das Web uebernommen werden, weil das Web groessere
Dateien bis 100 MB bewusst im Browser aufteilt.

## Kleinste konsistente Implementierung

### 1. Reine Admission-Logik in `lib/audio-upload.ts`

Folgende exportierte Konstanten einfuehren und den bisherigen Literalwert in
`decodeAudio` durch `MAX_WEB_UPLOAD_FILE_BYTES` ersetzen:

```ts
export const MAX_WEB_UPLOAD_FILE_BYTES = 100_000_000;
export const MAX_WEB_UPLOAD_QUEUE_FILES = 12;
export const MAX_WEB_UPLOAD_QUEUE_BYTES = 300_000_000;
```

Eine kleine reine Funktion sollte eine Auswahl gegen den aktuellen
`{ count, bytes }`-Stand pruefen und `{ accepted, rejected, nextBudget }`
zurueckgeben. Ablehnungsgruende sollten stabile Codes statt fertiger Texte
sein:

```ts
type UploadRejection =
  | "unsupported-type"
  | "empty-file"
  | "file-too-large"
  | "queue-full"
  | "queue-bytes-exceeded";
```

Pruefreihenfolge je Datei:

1. unterstuetzter MIME-Typ oder Endung wie heute;
2. `size > 0` und `Number.isSafeInteger(size)`;
3. `size <= MAX_WEB_UPLOAD_FILE_BYTES`;
4. aktuelle Anzahl kleiner als 12;
5. aktuelle Bytes plus Datei hoechstens 300 MB.

Eine abgelehnte Datei darf das Budget nicht verbrauchen. Spaetere kleinere
Dateien derselben Auswahl duerfen noch angenommen werden. Das bewahrt den
bisherigen Teil-Erfolg einer gemischten Mehrfachauswahl.

Die Signaturpruefung des Desktop-Imports ist sinnvoll, aber nicht Teil dieser
minimalen Queue-Behebung. Sie benoetigt eine browsergeeignete Magic-Byte-
Implementierung und Codectests fuer alle beworbenen Container; sie sollte in
einem getrennten Patch erfolgen und darf valide ALAC-/Browser-Sonderfaelle
nicht versehentlich sperren.

### 2. Budget in `components/UploadPanel.tsx` fuehren

Neben `queueRef` genau einen Ref fuer das ausstehende Budget halten, zum
Beispiel `pendingBudgetRef = useRef({ count: 0, bytes: 0 })`.

`addFiles` nutzt die reine Admission-Funktion:

- angenommene Dateien erhalten wie bisher `wartet`, werden dem Budget und
  `queueRef` hinzugefuegt und seriell gestartet;
- abgelehnte Dateien erhalten sofort `status: "fehler"` und einen lokalisierten
  Fehlertext; sie werden nie in `queueRef` gelegt;
- angenommene und abgelehnte Dateien erscheinen gemeinsam in der bestehenden
  Ergebnisliste. Es ist kein neues Modal und kein Toast-System erforderlich.

Im `finally` von `processNext` muss vor dem naechsten `processNext()` exakt die
aktive Datei freigegeben werden:

```ts
pendingBudgetRef.current = {
  count: Math.max(0, pendingBudgetRef.current.count - 1),
  bytes: Math.max(0, pendingBudgetRef.current.bytes - next.file.size),
};
```

Die Freigabe gehoert absichtlich in `finally`, nicht nur in Erfolgs- oder
Fehlerzweige. Damit werden Decodefehler, Providerfehler, Abbruch und fehlender
lokaler Modellstatus identisch behandelt.

### 3. Fehlertexte und sichtbare Grenzen

Die vorhandene `Item.error`-Darstellung reicht aus. Empfohlene Texte:

| Code | Deutsch | Englisch |
| --- | --- | --- |
| `unsupported-type` | Dieses Dateiformat wird nicht unterstuetzt. | This file type is not supported. |
| `empty-file` | Die Audiodatei ist leer. | The audio file is empty. |
| `file-too-large` | Dateien duerfen hoechstens 100 MB gross sein. | Files may be up to 100 MB. |
| `queue-full` | Es koennen hoechstens 12 Dateien gleichzeitig warten oder verarbeitet werden. | Up to 12 files can wait or be processed at once. |
| `queue-bytes-exceeded` | Laufende und wartende Dateien duerfen zusammen hoechstens 300 MB gross sein. Warte, bis eine Datei fertig ist, und fuege diese Datei dann erneut hinzu. | Active and waiting files may total up to 300 MB. Wait for a file to finish, then add this file again. |

Die bestehende Hilfszeile unter der Sprachauswahl sollte nur ergaenzt werden:
„Maximal 12 Dateien und 300 MB gleichzeitig.“ Im Qualitaetsmodus sollte der
bereits vorhandene Providerhinweis zusaetzlich knapp sagen, dass je nach
Anbieter Kosten entstehen koennen. Bestehende Karten, Reihenfolge,
Drag-and-drop, Dateiauswahl und serielle Verarbeitung bleiben unveraendert.

## Erforderliche Tests

Die reine Admission-Funktion passt in `tests/transcription.test.cjs`; eine neue
React-Testinfrastruktur ist fuer diesen Patch nicht erforderlich.

1. **Anzahlgrenze exakt:** 12 kleine gueltige Dateien werden angenommen; die
   13. erhaelt `queue-full`.
2. **Aktiven Job mitzaehlen:** Bei Startbudget `{ count: 1, bytes: n }` passen
   nur elf weitere Dateien in die Queue.
3. **Bytegrenze exakt:** Eine Auswahl bis exakt 300.000.000 Bytes wird
   angenommen; ein weiteres Byte fuehrt zu `queue-bytes-exceeded`.
4. **Einzeldateigrenze:** 100.000.000 Bytes sind zulaessig,
   100.000.001 Bytes ergeben `file-too-large` und verbrauchen weder Count noch
   Bytes.
5. **Leere und ungueltige Datei:** `size === 0` ergibt `empty-file`, falsche
   Endung/MIME ergibt `unsupported-type`; eine danach folgende gueltige Datei
   wird weiterhin angenommen.
6. **Kapazitaet wird frei:** Nach Freigabe eines angenommenen Jobs kann eine
   zuvor wegen Count- oder Bytegrenze abgelehnte Datei angenommen werden. Falls
   die Budgetfreigabe als reine Hilfsfunktion implementiert wird, diesen
   Grenzfall direkt testen.
7. **Bestehende Verarbeitung:** Die vorhandenen Tests fuer Direktupload,
   Chunkgroesse, Reihenfolge und Teilfehler bleiben gruen. Zusaetzlich sollte
   `decodeAudio` weiterhin bei mehr als 100 MB ablehnen, jetzt ueber dieselbe
   exportierte Konstante.
8. **Manueller UI-Smoke:** 13 kleine Dateien per Picker und per Drag-and-drop;
   zwoelf gehen auf `Wartet`, die 13. zeigt den lokalen Fehler. Nach Abschluss
   einer Datei kann sie erneut hinzugefuegt werden. Dasselbe mit drei
   100-MB-Dateien plus einer weiteren Datei fuer die 300-MB-Grenze in DE und EN.

Danach wie fuer den Release-Gate-Pfad mindestens `npm test`, `npm run
typecheck`, den dokumentierten Webpack-Produktionsbuild und `git diff --check`
ausfuehren.

## Bewusst verbleibende Punkte

- Eine Bytegrenze ist keine verlaessliche Kosten- oder Dauergrenze. Direkt
  hochladbare, stark komprimierte Cloud-Dateien koennen weiterhin laenger als
  30 Minuten sein. Eine harte allgemeine Dauergrenze waere ein eigener
  Produktentscheid, weil Metadaten im Browser fehlschlagen koennen und der
  Direktpfad gerade deshalb ALAC/M4A ohne Decoder unterstuetzt.
- Die Queue stoppt heute nach Authentifizierungs- oder Rate-Limit-Fehlern nicht
  automatisch. Die neue 12er-Grenze begrenzt den Schaden, ersetzt aber keine
  spaetere Fehlerklassifizierung mit „Queue anhalten/fortsetzen“.
- Magic-Byte-Pruefung, Worker-Decoding und eine manuelle Abbrechen-/Entfernen-
  Funktion sind weitere Haertungen, aber fuer die geforderte Queue- und
  Gesamtbytegrenze nicht notwendig.
