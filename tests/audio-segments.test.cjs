const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const segments = require("../desktop/audio-segments");
const { needsCloudSegmentation, MAX_CLOUD_AUDIO_BYTES, SerialWorkspaceQueue } = require("../desktop/workspace-jobs");

const RATE = segments.SAMPLE_RATE;

function speechWithPauses(seconds) {
  // Laute Abschnitte mit einer stillen Sekunde alle 20 Sekunden.
  const samples = new Float32Array(seconds * RATE);
  for (let index = 0; index < samples.length; index += 1) {
    const second = Math.floor(index / RATE);
    samples[index] = second % 20 === 19 ? 0 : Math.sin(index / 7) * 0.5;
  }
  return samples;
}

test("lange Aufnahmen werden lückenlos und in Sprechpausen geteilt", () => {
  const samples = speechWithPauses(30 * 60);
  const maxSamples = segments.maxSamplesForBytes(MAX_CLOUD_AUDIO_BYTES - 500_000);
  const ranges = segments.splitRanges(samples, RATE, maxSamples);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges.at(-1).end, samples.length);
  for (let index = 1; index < ranges.length; index += 1) assert.equal(ranges[index].start, ranges[index - 1].end, "keine Lücke, keine Überlappung");
  for (const range of ranges) assert.ok(range.end - range.start <= maxSamples);
  for (const range of ranges.slice(0, -1)) assert.equal(samples[range.end], 0, "Schnitt liegt in der Stille");
  assert.equal(ranges.length, 3, "30 Minuten ergeben drei Cloud-Abschnitte unter 24 MB");
});

test("WAV-Abschnitte sind 16-kHz-Mono und bleiben unter der Anbietergrenze", () => {
  const samples = speechWithPauses(60);
  const wav = Buffer.from(segments.encodeWavMono(samples, RATE, { start: 0, end: samples.length }));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.length, 44 + samples.length * 2);
  const maxBytes = MAX_CLOUD_AUDIO_BYTES - 500_000;
  assert.ok(44 + segments.maxSamplesForBytes(maxBytes) * 2 <= maxBytes);
});

test("Mono-Mischung und Grenzfälle", () => {
  const mono = segments.mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
  assert.deepEqual(Array.from(mono), [0.5, 0.5]);
  assert.throws(() => segments.splitRanges(new Float32Array(0), RATE, RATE * 10), /AUDIO_DECODE_EMPTY/);
  assert.throws(() => segments.splitRanges(new Float32Array(RATE), RATE, 10), /LIMIT_INVALID/);
  assert.equal(segments.MAX_SEGMENTED_SECONDS, 7200);
});

test("Kontext des vorigen Abschnitts wird begrenzt und als Kontext markiert", () => {
  const context = segments.continuationContext("Projekt Nivune", "x".repeat(2000) + " Ende");
  assert.match(context, /^Projekt Nivune Vorheriger Abschnitt \(nur Kontext, nicht wiederholen\): x+ Ende$/);
  assert.ok(context.length <= 500, "passt in die 500-Zeichen-Grenze der Anbieter");
  const longBase = segments.continuationContext("k".repeat(4000), "letzte Worte");
  assert.ok(longBase.length <= 500);
  assert.match(longBase, /letzte Worte$/, "der Übergang bleibt auch bei langem Kontext erhalten");
  assert.equal(segments.continuationContext("Basis", ""), "Basis");
});

test("nur Cloud-Aufträge über der Anbietergrenze werden geteilt", () => {
  assert.equal(needsCloudSegmentation(MAX_CLOUD_AUDIO_BYTES, { transcription: { provider: "openai" } }), false);
  assert.equal(needsCloudSegmentation(MAX_CLOUD_AUDIO_BYTES + 1, { transcription: { provider: "groq" } }), true);
  assert.equal(needsCloudSegmentation(500_000_000, { transcription: { provider: "local" } }), false);
});

test("Fortschritt erscheint nur während der Verarbeitung im öffentlichen Auftrag", async () => {
  let release;
  const queue = new SerialWorkspaceQueue((job, _signal, update) => new Promise((resolve) => {
    job.progress = { current: 2, total: 5 };
    update("transcribing");
    release = () => resolve({ rawText: "a", text: "a" });
  }));
  queue.enqueue({ id: "job-1", source: "file", name: "meeting.mp4", size: 1 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(queue.snapshot()[0].progress, { current: 2, total: 5 });
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(queue.snapshot()[0].progress, null);
});

test("Desktop verdrahtet Abschnitte für Cloud und lokal sowie verzögertes Einlesen", () => {
  const main = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  const pill = fs.readFileSync(path.join(__dirname, "../desktop/pill.html"), "utf8");
  const preload = fs.readFileSync(path.join(__dirname, "../desktop/preload.js"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../desktop/package.json"), "utf8"));
  assert.match(main, /needsCloudSegmentation\(job\.bytes\.byteLength, plan\)/);
  assert.match(main, /event\.sender !== pill\?\.webContents\) return;\s*const handler = workspaceSegmentRequests/);
  assert.match(main, /filePath,\s*fileMtimeMs: stat\.mtimeMs/);
  assert.match(main, /stat\.size !== job\.size \|\| stat\.mtimeMs !== job\.fileMtimeMs/);
  assert.match(pill, /<script src="audio-segments\.js"><\/script>/);
  assert.match(pill, /LOCAL_SEGMENT_SECONDS \* SAMPLE_RATE/);
  assert.match(preload, /workspace-audio-segment/);
  assert.ok(packageJson.build.files.includes("audio-segments.js"));
});
