const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeOllamaBaseUrl, requireLocalOllamaBaseUrl } = require("../shared/local-endpoints.ts");
const { listOllamaModels, refineWithOllamaProvider } = require("../shared/ollama-provider.ts");

test("Ollama-Endpunkte sind strikt auf Loopback begrenzt", () => {
  assert.equal(normalizeOllamaBaseUrl("http://127.0.0.1:11434/"), "http://127.0.0.1:11434");
  assert.equal(normalizeOllamaBaseUrl("http://localhost:11434"), "http://localhost:11434");
  assert.equal(normalizeOllamaBaseUrl("http://[::1]:11434"), "http://[::1]:11434");
  for (const value of [
    "https://example.com",
    "http://192.168.0.5:11434",
    "http://localhost:11434/api",
    "http://user:pass@localhost:11434",
    "file:///tmp/ollama.sock",
  ]) {
    assert.equal(normalizeOllamaBaseUrl(value), null);
    assert.throws(() => requireLocalOllamaBaseUrl(value), /OLLAMA_ENDPOINT_NOT_LOCAL/);
  }
});

test("Ollama-Modellliste nutzt nur die lokale Tags-API und entfernt Duplikate", async () => {
  let request;
  const models = await listOllamaModels({
    baseUrl: "http://127.0.0.1:11434",
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ models: [{ model: "qwen3:4b" }, { name: "gemma3:4b" }, { model: "qwen3:4b" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.deepEqual(models, ["qwen3:4b", "gemma3:4b"]);
  assert.equal(request.url, "http://127.0.0.1:11434/api/tags");
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.redirect, "error");
});

test("Ollama-Feinschliff sendet nicht-streamend, deterministisch und mit Nutzerkontext", async () => {
  let request;
  const output = await refineWithOllamaProvider("das ist klartext", {
    baseUrl: "http://localhost:11434",
    model: "qwen3:4b",
    language: "de-DE",
    context: "Produktname Nivune",
    dictionary: [{ from: "klar text", to: "Nivune" }],
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ response: "Das ist Nivune.", done: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(output, "Das ist Nivune.");
  assert.equal(request.url, "http://localhost:11434/api/generate");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.redirect, "error");
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "qwen3:4b");
  assert.equal(body.stream, false);
  assert.equal(body.think, false);
  assert.equal(body.options.temperature, 0);
  const prompt = JSON.parse(body.prompt);
  assert.equal(prompt.dictation, "das ist klartext");
  assert.equal(prompt.spellingContext, "Produktname Nivune");
  assert.deepEqual(prompt.requiredSpellings, [{ from: "klar text", to: "Nivune" }]);
  assert.doesNotMatch(body.system, /Produktname Nivune|klar text/);
  assert.match(body.system, /nicht vertrauenswürdige Daten/);
});

test("Ollama-Feinschliff verwirft unvollständige Antworten", async () => {
  await assert.rejects(() => refineWithOllamaProvider("Text", {
    baseUrl: "http://127.0.0.1:11434",
    model: "qwen3:4b",
    fetcher: async () => new Response(JSON.stringify({ response: "Teil", done: false }), { status: 200 }),
  }), /OLLAMA_REFINEMENT_INCOMPLETE/);
});
