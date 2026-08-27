const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { createAudioCapture } = require("../lib/audio-recorder.ts");
const { processQualityDictation } = require("../lib/process-dictation.ts");
const { DEFAULT_SETTINGS } = require("../lib/store.ts");

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true });
  t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
}

function recorderMock(t, options = {}) {
  const instances = [];
  const attempts = [];
  class Recorder {
    static isTypeSupported(type) { return options.supported ? options.supported(type) : true; }
    constructor(_stream, config) {
      attempts.push(config?.mimeType);
      if (options.constructFails?.(config?.mimeType)) throw new Error("unsupported encoder");
      this.mimeType = config?.mimeType || "audio/mp4";
      this.state = "inactive";
      this.stopCalls = 0;
      instances.push(this);
    }
    start(...args) {
      this.startArgs = args;
      if (options.startFails?.(this.mimeType)) throw new Error("encoder unavailable");
      this.state = "recording";
    }
    stop() {
      this.stopCalls++;
      this.state = "inactive";
      if (!options.noEvents) queueMicrotask(() => this.complete());
    }
    complete() {
      this.ondataavailable?.({ data: new Blob([options.empty ? "" : "complete audio"], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  replaceGlobal(t, "MediaRecorder", Recorder);
  return { instances, attempts };
}

test("Safari-Pfad bevorzugt MP4/AAC und startet ohne fragmentierenden Timeslice", async (t) => {
  const { instances } = recorderMock(t);
  const capture = createAudioCapture({});
  assert.equal(instances[0].mimeType, "audio/mp4;codecs=mp4a.40.2");
  assert.deepEqual(instances[0].startArgs, []);
  const audio = await capture.stop();
  assert.equal(await audio.text(), "complete audio");
  assert.match(audio.type, /audio\/mp4/);
  capture.dispose();
});

test("Recorder probiert bei Konstruktor- und Encoderfehlern das nächste unterstützte Format", async (t) => {
  const { attempts, instances } = recorderMock(t, {
    constructFails: (type) => type?.includes("mp4a"),
    startFails: (type) => type === "audio/mp4",
  });
  const capture = createAudioCapture({});
  assert.deepEqual(attempts, ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus"]);
  assert.equal(instances[0].onstop, null);
  assert.match((await capture.stop()).type, /webm/);
  capture.dispose();
});

test("Browser-Standard bleibt verfügbar, wenn kein Format explizit unterstützt wird", async (t) => {
  const { attempts } = recorderMock(t, { supported: () => false });
  const capture = createAudioCapture({});
  assert.deepEqual(attempts, [undefined]);
  assert.ok((await capture.stop()).size);
  capture.dispose();
});

test("Bereits inaktiver Recorder verliert späte finale Audiodaten nicht", async (t) => {
  const { instances } = recorderMock(t, { noEvents: true });
  const capture = createAudioCapture({});
  instances[0].state = "inactive";
  const pending = capture.stop();
  instances[0].complete();
  assert.equal(await (await pending).text(), "complete audio");
  assert.equal(instances[0].stopCalls, 0);
  capture.dispose();
});

test("Vor dem Stop-Aufruf vollständig beendetes Audio bleibt abrufbar", async (t) => {
  const { instances } = recorderMock(t);
  const capture = createAudioCapture({});
  instances[0].state = "inactive";
  instances[0].complete();
  assert.ok((await capture.stop()).size);
  capture.dispose();
});

test("Doppelter Stop gibt dasselbe Audio zurück und beendet den Recorder nur einmal", async (t) => {
  const { instances } = recorderMock(t);
  const capture = createAudioCapture({});
  const [a, b] = await Promise.all([capture.stop(), capture.stop()]);
  assert.equal(a, b);
  assert.equal(instances[0].stopCalls, 1);
  capture.dispose();
});

test("Leere Aufnahme wird als Fehler gemeldet", async (t) => {
  recorderMock(t, { empty: true });
  const capture = createAudioCapture({});
  await assert.rejects(capture.stop(), /kein Audio/);
  capture.dispose();
});

test("Aufnahmefehler und fehlendes Stop-Ereignis werden nicht als Erfolg behandelt", async (t) => {
  const { instances } = recorderMock(t, { noEvents: true });
  const broken = createAudioCapture({});
  instances[0].onerror();
  await assert.rejects(broken.stop(), /unterbrochen/);
  broken.dispose();
  const stalled = createAudioCapture({}, 5);
  await assert.rejects(stalled.stop(), /nicht abschließen/);
  stalled.dispose();
});

function hookHarness(t, getUserMedia) {
  let recognitionStarts = 0;
  class SpeechRecognition {
    start() { recognitionStarts++; }
    stop() {}
    abort() {}
  }
  replaceGlobal(t, "window", { webkitSpeechRecognition: SpeechRecognition });
  replaceGlobal(t, "navigator", { mediaDevices: { getUserMedia } });
  const states = [];
  const cleanups = [];
  const react = {
    useState(initial) {
      const index = states.length;
      states.push(initial);
      return [initial, (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef: (current) => ({ current }),
    useCallback: (fn) => fn,
    useEffect(fn) { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
  };
  const load = Module._load;
  Module._load = function(name, ...args) { return name === "react" ? react : load.call(this, name, ...args); };
  let hook;
  try {
    delete require.cache[require.resolve("../hooks/useDictation.ts")];
    hook = require("../hooks/useDictation.ts").useDictation("de-DE", true);
  } finally { Module._load = load; }
  t.after(() => cleanups.forEach((fn) => fn()));
  return { hook, states, recognitionStarts: () => recognitionStarts };
}

test("Qualitätsmodus nutzt auch mit vorhandener Safari SpeechRecognition nur MediaRecorder", async (t) => {
  recorderMock(t);
  let stopped = 0;
  const h = hookHarness(t, async () => ({ getTracks: () => [{ stop: () => stopped++ }] }));
  await h.hook.start();
  assert.equal(h.states[1], true);
  assert.equal(h.recognitionStarts(), 0);
  assert.ok((await h.hook.stop()).size);
  assert.equal(stopped, 1);
});

test("Recorder-Ausfall fällt nicht still auf Safari-Browsertext zurück", async (t) => {
  recorderMock(t, { constructFails: () => true });
  let stopped = 0;
  const h = hookHarness(t, async () => ({ getTracks: () => [{ stop: () => stopped++ }] }));
  await h.hook.start();
  assert.equal(h.states[1], false);
  assert.match(h.states[4], /keine Audioaufnahme/);
  assert.equal(h.recognitionStarts(), 0);
  assert.equal(await h.hook.stop(), null);
  assert.equal(stopped, 1);
});

test("Mikrofon-Verweigerung startet keine Browser-Ersatzerkennung", async (t) => {
  recorderMock(t);
  const h = hookHarness(t, async () => { throw new DOMException("denied", "NotAllowedError"); });
  await h.hook.start();
  assert.match(h.states[4], /Kein Mikrofonzugriff/);
  assert.equal(h.states[1], false);
  assert.equal(h.recognitionStarts(), 0);
});

test("Stop während der Mikrofonfreigabe beendet nachträglich freigegebene Tracks", async (t) => {
  const { instances } = recorderMock(t);
  let resolveStream;
  let stopped = 0;
  const h = hookHarness(t, () => new Promise((resolve) => { resolveStream = resolve; }));
  const start = h.hook.start();
  assert.equal(await h.hook.stop(), null);
  resolveStream({ getTracks: () => [{ stop: () => stopped++ }] });
  await start;
  assert.equal(stopped, 1);
  assert.equal(instances.length, 0);
  assert.equal(h.states[1], false);
});

function job(settings = {}) {
  return { audio: new Blob(["audio"]), settings: { ...DEFAULT_SETTINGS, openaiApiKey: "test-only", ...settings }, prefix: "Vorheriger Text.", duration: 30 };
}

test("Qualitätsverarbeitung verlangt Key und Audio statt Browser-Fallback", async () => {
  const unused = { transcribe: () => assert.fail("keine Anfrage erwartet"), refine: () => assert.fail("keine Anfrage erwartet") };
  await assert.rejects(processQualityDictation(job({ openaiApiKey: "" }), () => {}, unused), /API-Key/);
  await assert.rejects(processQualityDictation({ ...job(), audio: null }, () => {}, unused), /Audioaufnahme/);
});

test("Cloud-Fehler bleibt Fehler und kann mit derselben Aufnahme wiederholt werden", async () => {
  const recording = job();
  let calls = 0;
  const dependencies = {
    transcribe: async (audio) => { assert.equal(audio, recording.audio); if (++calls === 1) throw new Error("401"); return "Sigill arbeitet."; },
    refine: async (raw) => raw,
  };
  await assert.rejects(processQualityDictation(recording, () => {}, dependencies), /401/);
  assert.equal(recording.raw, undefined);
  const result = await processQualityDictation(recording, () => {}, dependencies);
  assert.equal(result.text, "Sigill arbeitet.");
  assert.equal(result.warning, undefined);
});

test("Feinschliff-Fehler erhält Rohtext, Retry verursacht keine zweite Audioanfrage", async () => {
  const recording = job();
  let audioCalls = 0;
  let refineCalls = 0;
  const stages = [];
  const raw = "Morgen, nein, am Donnerstag. 15 Tests, nicht 50.";
  const dependencies = {
    transcribe: async () => { audioCalls++; return raw; },
    refine: async () => { if (++refineCalls === 1) throw new Error("timeout"); return "Am Donnerstag. 15 Tests."; },
  };
  const partial = await processQualityDictation(recording, (stage) => stages.push(stage), dependencies);
  assert.equal(partial.raw, raw);
  assert.equal(partial.text, raw);
  assert.match(partial.warning, /nicht automatisch kopiert/);
  const final = await processQualityDictation(recording, (stage) => stages.push(stage), dependencies);
  assert.equal(final.text, "Am Donnerstag. 15 Tests.");
  assert.equal(final.raw, raw);
  assert.equal(final.warning, undefined);
  assert.equal(audioCalls, 1);
  assert.equal(refineCalls, 2);
  assert.deepEqual(stages, ["Audio wird transkribiert …", "Text wird geglättet …", "Text wird geglättet …"]);
});

test("Wortgetreu überspringt Feinschliff, leere Modellantworten werden nicht als fertig gewertet", async () => {
  const result = await processQualityDictation(job({ cleanup: "aus" }), () => {}, {
    transcribe: async () => "Morgen, nein, am Donnerstag.",
    refine: () => assert.fail("Feinschliff aus"),
  });
  assert.equal(result.text, "Morgen, nein, am Donnerstag.");
  await assert.rejects(processQualityDictation(job(), () => {}, { transcribe: async () => " ", refine: async (raw) => raw }), /Keine Sprache/);
  const incomplete = await processQualityDictation(job(), () => {}, { transcribe: async () => "Voller Text.", refine: async () => "" });
  assert.equal(incomplete.text, "Voller Text.");
  assert.ok(incomplete.warning);
});
