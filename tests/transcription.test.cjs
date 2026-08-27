const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cleanTranscript, applyDictionary } = require("../lib/cleanup.ts");
const { DEFAULT_SETTINGS } = require("../lib/store.ts");
const { MAX_AUDIO_BYTES, transcribeWithOpenAI } = require("../lib/cloud-transcribe.ts");
const { canUploadDirectly, splitAudio, encodeWav, transcribeUpload } = require("../lib/audio-upload.ts");
const { refineTranscriptWithOpenAI } = require("../lib/refine-transcript.ts");

const options = { apiKey: "test-only", language: "de-DE", dictionary: [], context: "Test" };

test("Wörterbuch ist grenzensicher und Sigill bleibt bei Wiederholung stabil", () => {
  const input = "Sigil, Sigill, sigil, Sigill-Projekt, Sigillum.";
  const expected = "Sigill, Sigill, Sigill, Sigill-Projekt, Sigillum.";
  assert.equal(cleanTranscript(input, DEFAULT_SETTINGS), expected);
  assert.equal(cleanTranscript(expected, DEFAULT_SETTINGS), expected);
  assert.equal(applyDictionary("Änne, Änneliese", [{ from: "Änne", to: "$& Anna" }]), "$& Anna, Änneliese");
});

test("Absätze bleiben bei der Bereinigung erhalten", () => {
  assert.equal(cleanTranscript("Erster Absatz.\n\nZweiter Absatz.", DEFAULT_SETTINGS), "Erster Absatz.\n\nZweiter Absatz.");
});

test("Direkte Uploads werden nach Format und API-Limit gewählt", () => {
  for (const name of ["a.mp3", "a.M4A", "a.wav", "a.webm", "a.mp4"]) assert.equal(canUploadDirectly(new File(["audio"], name)), true);
  assert.equal(canUploadDirectly(new File(["audio"], "a.flac")), false);
  assert.equal(canUploadDirectly({ name: "a.wav", size: MAX_AUDIO_BYTES + 1 }), false);
});

test("6 Minuten Stereo-WAV: alle Samples genau einmal, jeder Abschnitt unter 24 MB", () => {
  const rate = 48000;
  const frames = rate * 6 * 60;
  const channels = [new Float32Array(frames), new Float32Array(frames)];
  channels[0][0] = 0.5;
  channels[1][frames - 1] = -0.5;
  const ranges = splitAudio(channels, rate);
  assert.ok(ranges.length >= 3);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges.at(-1).end, frames);
  let total = 0;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (i) assert.equal(range.start, ranges[i - 1].end);
    const wav = encodeWav(channels, rate, range);
    assert.ok(wav.byteLength <= MAX_AUDIO_BYTES);
    const view = new DataView(wav);
    assert.equal(view.getUint16(22, true), 2);
    assert.equal(view.getUint32(24, true), rate);
    assert.equal(view.getUint32(40, true), (range.end - range.start) * 4);
    total += range.end - range.start;
  }
  assert.equal(total, frames);
});

test("Chunk-Grenze bevorzugt eine Sprechpause", () => {
  const pcm = new Float32Array(2000).fill(0.5);
  pcm.fill(0, 940, 980);
  const ranges = splitAudio([pcm], 100, 2044);
  assert.ok(ranges[0].end >= 940 && ranges[0].end <= 980);
});

test("M4A-Direktupload benötigt keinen Browser-Decoder", async () => {
  const file = new File(["ALAC"], "memo.m4a");
  let sent;
  const result = await transcribeUpload(file, options, () => {}, {
    decode: async () => { throw new Error("Decoder darf hier nicht laufen"); },
    duration: async () => 0,
    transcribe: async (audio) => { sent = audio; return "Vollständiger Text."; },
  });
  assert.equal(sent, file);
  assert.equal(result.raw, "Vollständiger Text.");
});

test("Fehlender Key wechselt nicht still auf ein anderes Modell", async () => {
  await assert.rejects(transcribeUpload(new File(["audio"], "a.mp3"), { ...options, apiKey: "" }, () => {}), /API-Key/);
});

test("Große Datei wird in Reihenfolge transkribiert; Teilfehler wird nicht als fertig ausgegeben", async () => {
  const fakeLargeFile = { name: "large.wav", size: MAX_AUDIO_BYTES + 1 };
  const audio = { channels: [new Float32Array(13 * 60 * 16000)], sampleRate: 16000, duration: 780 };
  let calls = 0;
  let partial = "";
  const dependencies = {
    decode: async () => audio,
    duration: async () => 780,
    transcribe: async (blob, opts) => {
      assert.ok(blob.size <= MAX_AUDIO_BYTES);
      assert.equal(opts.fileName, `abschnitt-${++calls}.wav`);
      if (calls === 2) throw new Error("Test-Netzwerkfehler");
      return "Abschnitt eins.";
    },
  };
  await assert.rejects(transcribeUpload(fakeLargeFile, options, (_detail, text) => { partial = text; }, dependencies), /Netzwerkfehler/);
  assert.equal(calls, 2);
  assert.equal(partial, "Abschnitt eins.");
});

test("Transkription nutzt unverändert gpt-transcribe, richtigen Dateinamen und Key-Hinweis", async (t) => {
  let form;
  t.mock.method(globalThis, "fetch", async (_url, init) => { form = init.body; return Response.json({ text: "Text" }); });
  assert.equal(await transcribeWithOpenAI(new Blob(["audio"], { type: "audio/mp4" }), options), "Text");
  assert.equal(form.get("model"), "gpt-transcribe");
  assert.equal(form.get("file").name, "dictation.m4a");
  assert.deepEqual(form.getAll("languages[]"), ["de", "en"]);
  assert.ok(form.getAll("keywords[]").includes("Sigill"));
});

test("Unvollständige KI-Ausgabe wird verworfen", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "incomplete", output_text: "Nur der Anfang" }));
  await assert.rejects(refineTranscriptWithOpenAI("Ein vollständiger langer Text.", "test"), /INCOMPLETE/);
});

test("Langer Feinschliff verarbeitet alle Textteile ohne Abschneiden", async (t) => {
  const input = ("Das ist ein vollständiger Satz. ").repeat(1200).trim();
  const received = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.model, "gpt-5.4-mini");
    assert.equal(body.store, false);
    assert.ok(body.input.length <= 12000);
    received.push(body.input);
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: body.input }] }] });
  });
  const result = await refineTranscriptWithOpenAI(input, "test");
  assert.ok(received.length > 1);
  assert.equal(result.replace(/\s+/g, " "), input);
});
