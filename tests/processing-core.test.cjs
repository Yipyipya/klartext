const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runProcessingJob, cleanTranscript, isRefinementSafe } = require("../shared/processing.ts");
const { LOCAL_WHISPER_CAPABILITIES, OLLAMA_REFINEMENT_CAPABILITIES, OPENAI_TRANSCRIPTION_CAPABILITIES } = require("../shared/provider-contracts.ts");
const { createProcessingPlan } = require("../lib/processing-plan.ts");
const { processExistingTranscript } = require("../lib/process-dictation.ts");
const { DEFAULT_SETTINGS } = require("../lib/store.ts");

function plan(refinement = "openai", dictionary = []) {
  return {
    transcription: { id: "openai-default", provider: "openai", model: "gpt-transcribe" },
    refinement: refinement === "none"
      ? { id: "none", provider: "none" }
      : { id: "openai-default", provider: "openai", model: "gpt-5.4-mini" },
    language: "de-DE",
    context: "",
    dictionary,
    cleanupLevel: "sanft",
  };
}

test("gemeinsamer Kern behält Rohtext und fällt bei Überarbeitungsfehler darauf zurück", async () => {
  const stages = [];
  const result = await runProcessingJob({ audio: new Blob(["audio"]), plan: plan() }, {
    transcribe: async () => "morgen um zehn, nicht elf.",
    refine: async () => { throw new Error("timeout"); },
  }, (stage) => stages.push(stage));
  assert.equal(result.rawText, "morgen um zehn, nicht elf.");
  assert.equal(result.text, "Morgen um zehn, nicht elf.");
  assert.equal(result.warning, "refinement_failed");
  assert.deepEqual(stages, ["transcribing", "refining", "postprocessing"]);
});

test("vorhandener Rohtext wiederholt keine Transkription", async () => {
  const result = await runProcessingJob({ rawText: "vollständig.", plan: plan("none") }, {
    transcribe: async () => assert.fail("keine zweite Audioanfrage"),
  });
  assert.equal(result.text, "Vollständig.");
});

test("abgeschaltete Überarbeitung ruft keinen Refiner auf", async () => {
  const stages = [];
  const result = await runProcessingJob({ rawText: "wortgetreu bleibt wortgetreu", plan: {
    ...plan("none"),
    cleanupLevel: "aus",
  } }, {
    transcribe: async () => assert.fail("keine Transkription"),
    refine: async () => assert.fail("keine Überarbeitung"),
  }, (stage) => stages.push(stage));
  assert.equal(result.text, "wortgetreu bleibt wortgetreu");
  assert.deepEqual(stages, ["postprocessing"]);
});

test("persönliche Markenregeln wirken nur als migriertes Nutzerwörterbuch", () => {
  const options = { cleanupLevel: "sanft", language: "de-DE", dictionary: [] };
  assert.equal(cleanTranscript("Sigil bleibt Sigil.", options), "Sigil bleibt Sigil.");
  assert.equal(cleanTranscript("Sigil wird korrigiert.", { ...options, dictionary: [{ from: "Sigil", to: "Sigill" }] }), "Sigill wird korrigiert.");
});

test("semantische Sicherung verwirft Kontextkopien und geänderte Sprecherrollen", () => {
  assert.equal(isRefinementSafe(
    "um please send the launch notes on friday and do not publish them yet",
    "A private launch-planning note.",
    [],
  ), false);
  assert.equal(isRefinementSafe(
    "morgen um elf treffen wir Klara im Büro",
    "Clara trifft uns morgen um elf im Büro.",
    [{ from: "Klara", to: "Clara" }],
  ), false);
  assert.equal(isRefinementSafe(
    "ähm wir treffen Klara morgen um elf im Büro",
    "Wir treffen Clara morgen um elf im Büro.",
    [{ from: "Klara", to: "Clara" }],
  ), true);
});

test("Provider-Verträge machen Ort, Größenlimit und Fähigkeiten explizit", () => {
  assert.equal(LOCAL_WHISPER_CAPABILITIES.processingLocation, "device");
  assert.equal(LOCAL_WHISPER_CAPABILITIES.maxAudioBytes, null);
  assert.equal(LOCAL_WHISPER_CAPABILITIES.supportsTimestamps, false);
  assert.equal(OPENAI_TRANSCRIPTION_CAPABILITIES.processingLocation, "provider");
  assert.equal(OPENAI_TRANSCRIPTION_CAPABILITIES.maxAudioBytes, 24_000_000);
  assert.equal(OPENAI_TRANSCRIPTION_CAPABILITIES.supportsContext, true);
  assert.equal(OLLAMA_REFINEMENT_CAPABILITIES.processingLocation, "device");
  assert.equal(OLLAMA_REFINEMENT_CAPABILITIES.supportsContext, true);
  assert.equal(OLLAMA_REFINEMENT_CAPABILITIES.supportsModelList, true);
});

test("Web-Diktat und Dateiimport erzeugen denselben auftragsfesten Plan", () => {
  const quality = createProcessingPlan({ ...DEFAULT_SETTINGS, dictionary: [{ from: "Klara", to: "Clara" }] });
  assert.equal(quality.transcription.model, "gpt-transcribe");
  assert.equal(quality.refinement.model, "gpt-5.4-mini");
  assert.deepEqual(quality.dictionary, [{ from: "Klara", to: "Clara" }]);
  const local = createProcessingPlan({
    ...DEFAULT_SETTINGS,
    transcriptionMode: "local",
    whisperModel: "schnell",
    refinementProvider: "deterministic",
  });
  assert.equal(local.transcription.model, "onnx-community/whisper-base");
  assert.equal(local.refinement.provider, "deterministic");
});

test("vollständig lokaler Plan enthält keine Cloud-Stufe oder Zugangsdaten", () => {
  const local = createProcessingPlan({
    ...DEFAULT_SETTINGS,
    transcriptionMode: "local",
    refinementProvider: "ollama",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "qwen3:4b",
  });
  assert.deepEqual(local.transcription, {
    id: "local-default",
    provider: "local",
    model: "onnx-community/whisper-small",
  });
  assert.deepEqual(local.refinement, {
    id: "ollama-default",
    provider: "ollama",
    model: "qwen3:4b",
    baseUrl: "http://127.0.0.1:11434",
  });
  assert.doesNotMatch(JSON.stringify(local), /openai|credential/i);
});

test("vorhandene lokale Transkripte laufen mit Ollama durch denselben Kern", async () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    transcriptionMode: "local",
    refinementProvider: "ollama",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "qwen3:4b",
    context: "Nivune Produktnotiz",
  };
  const stages = [];
  let seen;
  const result = await processExistingTranscript("das ist klartext", settings, (stage) => stages.push(stage), undefined, async (raw, profile, runtime) => {
    seen = { raw, profile, runtime };
    return "Das ist Nivune.";
  });
  assert.equal(result.text, "Das ist Nivune.");
  assert.deepEqual(stages, ["refining", "postprocessing"]);
  assert.equal(seen.raw, "das ist klartext");
  assert.equal(seen.profile.provider, "ollama");
  assert.equal(seen.runtime.context, "Nivune Produktnotiz");
});

test("kompatibler Textserver erhält einen zielgebundenen auftragsfesten Plan", async () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    refinementProvider: "openai-compatible",
    compatibleRefinementBaseUrl: "https://text.example/v1",
    compatibleRefinementModel: "text-model",
    compatibleRefinementApiKey: "secret",
    compatibleRefinementCredentialRef: "provider:openai-compatible:refinement:https%3A%2F%2Ftext.example%2Fv1",
  };
  const plan = createProcessingPlan(settings);
  assert.deepEqual(plan.refinement, {
    id: "compatible-default",
    provider: "openai-compatible",
    model: "text-model",
    baseUrl: "https://text.example/v1",
    credentialRef: settings.compatibleRefinementCredentialRef,
  });
  let seen;
  const result = await processExistingTranscript("wir treffen Klara morgen", settings, () => {}, undefined, async (raw, profile, runtime) => {
    seen = { raw, profile, runtime };
    return "Wir treffen Klara morgen.";
  });
  assert.equal(result.text, "Wir treffen Klara morgen.");
  assert.equal(seen.profile.provider, "openai-compatible");
  assert.equal(seen.runtime.compatibleRefinementApiKey, "secret");
});
