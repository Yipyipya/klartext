const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEEPGRAM_TRANSCRIPTION_CAPABILITIES,
  GROQ_TRANSCRIPTION_CAPABILITIES,
  COMPATIBLE_TRANSCRIPTION_CAPABILITIES,
} = require("../shared/provider-contracts.ts");
const {
  DEEPGRAM_TRANSCRIPTION_URL,
  GROQ_TRANSCRIPTION_URL,
  normalizeCompatibleAudioBaseUrl,
  transcribeWithCloudProvider,
  transcribeWithCompatibleProvider,
  transcribeWithDeepgramProvider,
  transcribeWithGroqProvider,
} = require("../shared/cloud-transcription-providers.ts");

const base = {
  apiKey: "test-secret",
  model: "model-test",
  language: "de-DE",
  dictionary: [{ from: "klar text", to: "Nivune" }],
  context: "Produktnotiz",
};
const audio = new Blob(["audio"], { type: "audio/wav" });

test("Provider-Verträge bilden Grenzen von Groq, Deepgram und kompatiblen Servern ab", () => {
  assert.equal(GROQ_TRANSCRIPTION_CAPABILITIES.maxAudioBytes, 24_000_000);
  assert.equal(GROQ_TRANSCRIPTION_CAPABILITIES.supportsTimestamps, true);
  assert.equal(DEEPGRAM_TRANSCRIPTION_CAPABILITIES.maxAudioBytes, 2_000_000_000);
  assert.equal(DEEPGRAM_TRANSCRIPTION_CAPABILITIES.supportsContext, false);
  assert.equal(COMPATIBLE_TRANSCRIPTION_CAPABILITIES.maxAudioBytes, null);
});

test("Groq erhält nur dokumentierte Audiofelder und folgt keinen Redirects", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    seen = { url, init };
    return Response.json({ text: "Groq Text" });
  });
  assert.equal(await transcribeWithGroqProvider(audio, { ...base, provider: "groq", model: "whisper-large-v3" }), "Groq Text");
  assert.equal(seen.url, GROQ_TRANSCRIPTION_URL);
  assert.equal(seen.init.redirect, "error");
  assert.equal(seen.init.headers.Authorization, "Bearer test-secret");
  assert.equal(seen.init.body.get("model"), "whisper-large-v3");
  assert.equal(seen.init.body.get("language"), "de");
  assert.equal(seen.init.body.get("response_format"), "json");
  assert.match(seen.init.body.get("prompt"), /Nivune/);
  assert.equal(seen.init.body.get("file").name, "dictation.wav");
  assert.deepEqual([...seen.init.body.keys()].sort(), ["file", "language", "model", "prompt", "response_format", "temperature"]);
});

test("Deepgram sendet Binärdaten, Datenschutzparameter und Nova-3-Keyterms", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    seen = { url: new URL(url), init };
    return Response.json({ results: { channels: [{ alternatives: [{ transcript: "Deepgram Text" }] }] } });
  });
  assert.equal(await transcribeWithDeepgramProvider(audio, { ...base, provider: "deepgram", model: "nova-3" }), "Deepgram Text");
  assert.equal(`${seen.url.origin}${seen.url.pathname}`, DEEPGRAM_TRANSCRIPTION_URL);
  assert.equal(seen.url.searchParams.get("language"), "de");
  assert.equal(seen.url.searchParams.get("smart_format"), "true");
  assert.equal(seen.url.searchParams.get("mip_opt_out"), "true");
  assert.deepEqual(seen.url.searchParams.getAll("keyterm"), ["Nivune"]);
  assert.equal(seen.init.headers.Authorization, "Token test-secret");
  assert.equal(seen.init.headers["Content-Type"], "audio/wav");
  assert.equal(seen.init.body, audio);
  assert.equal(seen.init.redirect, "error");
});

test("kompatible Basisadressen verlangen HTTPS oder explizites Loopback", () => {
  assert.equal(normalizeCompatibleAudioBaseUrl("https://speech.example/v1/"), "https://speech.example/v1");
  assert.match(normalizeCompatibleAudioBaseUrl("http://127.0.0.1:8080/v1"), /^http:\/\/127\.0\.0\.1:8080\/v1$/);
  assert.equal(normalizeCompatibleAudioBaseUrl("http://speech.example/v1"), null);
  assert.equal(normalizeCompatibleAudioBaseUrl("https://user:secret@speech.example/v1"), null);
  assert.equal(normalizeCompatibleAudioBaseUrl("https://speech.example/v1?target=other"), null);
});

test("kompatibler Adapter erlaubt lokale Server ohne Key, aber keine stillen Redirects", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    seen = { url, init };
    return Response.json({ text: "Eigener Server" });
  });
  assert.equal(await transcribeWithCompatibleProvider(audio, {
    ...base,
    provider: "openai-compatible",
    apiKey: "",
    baseUrl: "http://localhost:8080/v1/",
  }), "Eigener Server");
  assert.equal(seen.url, "http://localhost:8080/v1/audio/transcriptions");
  assert.equal(seen.init.headers.Authorization, undefined);
  assert.equal(seen.init.redirect, "error");
});

test("401, 429, leere und ungültige Antworten werden nicht als Transkript ausgegeben", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response('{"error":{"message":"bad key"}}', { status: 401 }));
  await assert.rejects(transcribeWithGroqProvider(audio, { ...base, provider: "groq" }), /GROQ_TRANSCRIPTION_401: bad key/);
  fetchMock.mock.mockImplementation(async () => new Response("limit", { status: 429 }));
  await assert.rejects(transcribeWithDeepgramProvider(audio, { ...base, provider: "deepgram" }), /DEEPGRAM_TRANSCRIPTION_429/);
  fetchMock.mock.mockImplementation(async () => Response.json({ text: "" }));
  await assert.rejects(transcribeWithCompatibleProvider(audio, {
    ...base, provider: "openai-compatible", baseUrl: "https://speech.example/v1",
  }), /COMPATIBLE_TRANSCRIPTION_EMPTY/);
  fetchMock.mock.mockImplementation(async () => new Response("not-json"));
  await assert.rejects(transcribeWithCompatibleProvider(audio, {
    ...base, provider: "openai-compatible", baseUrl: "https://speech.example/v1",
  }), /COMPATIBLE_TRANSCRIPTION_INVALID_JSON/);
});

test("AbortSignal und Größenlimits stoppen Anfragen vor einer verwertbaren Ausgabe", async (t) => {
  let called = false;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    called = true;
    init.signal.throwIfAborted();
    return Response.json({ text: "zu spät" });
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(transcribeWithGroqProvider(audio, { ...base, provider: "groq", signal: controller.signal }), /abort/i);
  assert.equal(called, true);
  await assert.rejects(transcribeWithCompatibleProvider(audio, {
    ...base,
    provider: "openai-compatible",
    baseUrl: "https://speech.example/v1",
    maxAudioBytes: 1,
  }), /AUDIO_TOO_LARGE/);
});

test("Dispatcher hält Providerparameter getrennt und behält OpenAI als Qualitätsstandard", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization });
    return Response.json({ text: "Text" });
  });
  assert.equal(await transcribeWithCloudProvider(audio, { ...base, provider: "openai", model: "gpt-transcribe" }), "Text");
  assert.equal(await transcribeWithCloudProvider(audio, { ...base, provider: "groq", model: "whisper-large-v3" }), "Text");
  assert.match(calls[0].url, /api\.openai\.com/);
  assert.match(calls[1].url, /api\.groq\.com/);
  assert.equal(calls[0].auth, "Bearer test-secret");
  assert.equal(calls[1].auth, "Bearer test-secret");
});
