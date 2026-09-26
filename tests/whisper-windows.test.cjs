const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { speechWindows, transcribeInWindows, WHISPER_WINDOW_SECONDS } = require("../shared/whisper-windows.ts");

const RATE = 16000;
function speech(seconds) {
  const samples = new Float32Array(seconds * RATE);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.floor(index / RATE) % 4 === 3 ? 0 : Math.sin(index / 5) * 0.4;
  }
  return samples;
}

test("Whisper-Fenster bleiben unter 30 Sekunden, lückenlos und schneiden in Pausen", () => {
  const samples = speech(10 * 60);
  const windows = speechWindows(samples, RATE);
  assert.equal(windows[0].start, 0);
  assert.equal(windows.at(-1).end, samples.length);
  for (let index = 1; index < windows.length; index += 1) assert.equal(windows[index].start, windows[index - 1].end);
  for (const window of windows) assert.ok(window.end - window.start <= WHISPER_WINDOW_SECONDS * RATE);
  for (const window of windows.slice(0, -1)) assert.equal(samples[window.end], 0, "Schnitt liegt in der Stille");
  assert.deepEqual(speechWindows(new Float32Array(0), RATE), []);
});

test("jedes Fenster wird einzeln und ohne eingebaute Fensterung transkribiert", async () => {
  const samples = speech(3 * 60);
  const calls = [];
  const text = await transcribeInWindows(async (audio, options) => {
    calls.push({ seconds: audio.length / RATE, options });
    return { text: ` Teil ${calls.length} ` };
  }, samples, RATE, { language: "de" });
  assert.ok(calls.length >= 7);
  for (const call of calls) {
    assert.ok(call.seconds <= 30);
    assert.equal(call.options.chunk_length_s, undefined);
    assert.equal(call.options.stride_length_s, undefined);
    assert.equal(call.options.language, "de");
  }
  assert.equal(text, calls.map((_, index) => `Teil ${index + 1}`).join(" "), "kein Text geht beim Zusammensetzen verloren");
});

test("Abbruch zwischen Fenstern und Fortschritt", async () => {
  let calls = 0;
  const progress = [];
  await transcribeInWindows(async () => { calls += 1; return { text: "x" }; }, speech(120), RATE, {}, {
    shouldStop: () => calls >= 2,
    onWindow: (current, total) => progress.push(`${current}/${total}`),
  });
  assert.equal(calls, 2);
  assert.match(progress[0], /^1\/\d+$/);
});

test("keine Stelle nutzt mehr die verlustbehaftete eingebaute Fensterung", () => {
  for (const file of ["desktop/pill.html", "workers/whisper.worker.ts"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /chunk_length_s|stride_length_s/, file);
    assert.match(source, /transcribeInWindows\(/, file);
  }
});
