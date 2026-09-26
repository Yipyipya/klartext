const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  LOCAL_MODELS,
  TRANSFORMERS_JS_VERSION,
  classifyLocalModelCacheFiles,
  isLocalModelCacheUrl,
  revisionAwareModelCache,
} = require("../shared/local-models.ts");

function url(model, file, revision = model.revision) {
  return `https://huggingface.co/${model.id}/resolve/${revision}/${file}`;
}

test("lokale Modelle und Laufzeit sind für reproduzierbare Downloads fest versioniert", () => {
  assert.equal(TRANSFORMERS_JS_VERSION, "4.3.0");
  for (const model of Object.values(LOCAL_MODELS)) {
    assert.match(model.revision, /^[a-f0-9]{40}$/);
    assert.equal(model.license, "Apache-2.0");
    assert.match(model.sourceUrl, /^https:\/\/huggingface\.co\/onnx-community\/whisper-/);
    assert.ok(model.approximateDownloadMb.wasm < model.approximateDownloadMb.webgpu);
  }
});

test("Cacheprüfung unterscheidet fehlende, unvollständige und offline-bereite Modelle", () => {
  const model = LOCAL_MODELS.schnell;
  assert.deepEqual(classifyLocalModelCacheFiles([], model), { state: "missing", files: 0 });
  assert.deepEqual(classifyLocalModelCacheFiles([url(model, "config.json")], model), { state: "partial", files: 1 });
  const complete = [
    "config.json",
    "tokenizer.json",
    "preprocessor_config.json",
    "onnx/encoder_model_quantized.onnx",
    "onnx/decoder_model_merged_quantized.onnx",
  ].map((file) => url(model, file));
  assert.deepEqual(classifyLocalModelCacheFiles(complete, model), { state: "ready", files: 5 });

  const webGpuOnly = [
    "config.json",
    "tokenizer.json",
    "preprocessor_config.json",
    "onnx/encoder_model.onnx",
    "onnx/decoder_model_merged_q4.onnx",
  ].map((file) => url(model, file));
  assert.deepEqual(classifyLocalModelCacheFiles(webGpuOnly, model, "webgpu"), { state: "ready", files: 5 });
  assert.deepEqual(classifyLocalModelCacheFiles(webGpuOnly, model, "wasm"), { state: "partial", files: 5 });

  const mixedBackends = [complete[0], complete[1], complete[2], webGpuOnly[3], complete[4]];
  assert.deepEqual(classifyLocalModelCacheFiles(mixedBackends, model), { state: "partial", files: 5 });
});

test("Modelllöschung erfasst auch ältere main-Cacheeinträge, aber keine fremden Modelle", () => {
  const model = LOCAL_MODELS.genau;
  assert.equal(isLocalModelCacheUrl(url(model, "config.json", "main"), model), true);
  assert.equal(isLocalModelCacheUrl(url(LOCAL_MODELS.schnell, "config.json", "main"), model), false);
});

test("Transformers 4.3 findet ältere main-Cacheeinträge unter der festen Revision", async () => {
  const model = LOCAL_MODELS.genau;
  const legacyUrl = url(model, "config.json", "main");
  const pinnedUrl = url(model, "config.json");
  const stored = new Map([[legacyUrl, new Response("cached-model-config")]]);
  const previousCaches = global.caches;
  global.caches = {
    async open(name) {
      assert.equal(name, "transformers-cache");
      return {
        async match(request) { return stored.get(String(request))?.clone(); },
        async put(request, response) { stored.set(String(request), response.clone()); },
        async delete(request) { return stored.delete(String(request)); },
      };
    },
  };
  try {
    const cache = await revisionAwareModelCache(model);
    const response = await cache.match(pinnedUrl);
    assert.equal(await response.text(), "cached-model-config");
  } finally {
    global.caches = previousCaches;
  }
});

test("Web-Worker erzwingt Modellvorbereitung und unterstützt Fortschritt, Abbruch und Löschung", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../workers/whisper.worker.ts"), "utf8");
  assert.match(worker, /revision:\s*model\.revision/);
  assert.match(worker, /LOCAL_MODEL_NOT_READY/);
  assert.match(worker, /cancel-model/);
  assert.match(worker, /remove-model/);
  assert.match(worker, /progress_total/);
  assert.match(worker, /cache\.delete/);
  assert.match(worker, /return await pipeline\("automatic-speech-recognition", model\.id, \{\s*\.\.\.common,\s*device: "wasm"/);
});
