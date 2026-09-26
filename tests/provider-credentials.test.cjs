const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROQ_CREDENTIAL_REF,
  OPENAI_CREDENTIAL_REF,
  compatibleCredentialRef,
  isCredentialRef,
  sanitizeCredentialRecord,
} = require("../shared/credential-refs.ts");
const {
  listCompatibleModels,
  listGroqTranscriptionModels,
} = require("../shared/provider-models.ts");

test("feste und zielgebundene Zugangsdatenreferenzen bleiben getrennt", () => {
  assert.equal(OPENAI_CREDENTIAL_REF, "provider:openai:default");
  assert.equal(GROQ_CREDENTIAL_REF, "provider:groq:default");
  const audio = compatibleCredentialRef("transcription", "https://speech.example/v1/");
  const text = compatibleCredentialRef("refinement", "https://speech.example/v1");
  const other = compatibleCredentialRef("transcription", "https://other.example/v1");
  assert.notEqual(audio, text);
  assert.notEqual(audio, other);
  assert.equal(isCredentialRef(audio), true);
  assert.equal(isCredentialRef(text), true);
  assert.equal(compatibleCredentialRef("transcription", "http://speech.example/v1"), null);
});

test("Credential-Speicher verwirft unbekannte Referenzen und ungültige Werte", () => {
  const compatible = compatibleCredentialRef("transcription", "http://127.0.0.1:8080/v1");
  assert.deepEqual(sanitizeCredentialRecord({
    [OPENAI_CREDENTIAL_REF]: "  openai-key  ",
    [GROQ_CREDENTIAL_REF]: "groq-key",
    [compatible]: "local-key",
    "provider:unknown:default": "must-disappear",
    broken: 123,
    empty: "",
  }), {
    [OPENAI_CREDENTIAL_REF]: "openai-key",
    [GROQ_CREDENTIAL_REF]: "groq-key",
    [compatible]: "local-key",
  });
});

test("Groq-Modellliste filtert Audio-Modelle und sendet nur den Groq-Key", async () => {
  let seen;
  const result = await listGroqTranscriptionModels({
    apiKey: "groq-test",
    fetcher: async (url, init) => {
      seen = { url, init };
      return Response.json({ data: [
        { id: "llama-text" },
        { id: "whisper-large-v3" },
        { id: "whisper-large-v3-turbo" },
        { id: "whisper-large-v3" },
      ] });
    },
  });
  assert.deepEqual(result, { supported: true, models: ["whisper-large-v3", "whisper-large-v3-turbo"] });
  assert.equal(seen.url, "https://api.groq.com/openai/v1/models");
  assert.equal(seen.init.headers.Authorization, "Bearer groq-test");
  assert.equal(seen.init.redirect, "error");
});

test("fehlende kompatible Modellliste blockiert manuelle Modell-ID nicht", async () => {
  const unsupported = await listCompatibleModels("https://speech.example/v1", {
    fetcher: async () => new Response("not implemented", { status: 404 }),
  });
  assert.deepEqual(unsupported, { supported: false, models: [] });
  const supported = await listCompatibleModels("http://localhost:8080/v1", {
    apiKey: "local-key",
    fetcher: async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer local-key");
      return Response.json({ data: [{ id: "model-b" }, { id: "model-a" }] });
    },
  });
  assert.deepEqual(supported, { supported: true, models: ["model-b", "model-a"] });
});

test("401 und ungültiges Modelllisten-JSON bleiben echte Verbindungsfehler", async () => {
  await assert.rejects(listGroqTranscriptionModels({
    apiKey: "bad",
    fetcher: async () => new Response("invalid key", { status: 401 }),
  }), /GROQ_MODELS_401/);
  await assert.rejects(listCompatibleModels("https://speech.example/v1", {
    fetcher: async () => new Response("not-json"),
  }), /INVALID_JSON/);
});
