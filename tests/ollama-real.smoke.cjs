const assert = require("node:assert/strict");
const { listOllamaModels, refineWithOllamaProvider } = require("../shared/ollama-provider.ts");
const { isRefinementSafe, runProcessingJob } = require("../shared/processing.ts");

async function main() {
  const baseUrl = process.env.KLARTEXT_OLLAMA_URL || "http://127.0.0.1:11434";
  const model = process.env.KLARTEXT_OLLAMA_MODEL || "qwen3:0.6b";
  const models = await listOllamaModels({ baseUrl });
  assert.ok(models.includes(model), `${model} fehlt in der lokalen Modellliste: ${models.join(", ")}`);

  const cases = [
    {
      language: "de",
      input: "ähm morgen um zehn nein um elf treffen wir klara im büro",
      context: "Kurze Terminnotiz. Der Personenname wird Clara geschrieben.",
      dictionary: [{ from: "Klara", to: "Clara" }],
    },
    {
      language: "en",
      input: "um please send the launch notes on friday and do not publish them yet",
      context: "A private launch-planning note.",
      dictionary: [],
    },
  ];

  const results = [];
  for (const item of cases) {
    const startedAt = performance.now();
    const output = await refineWithOllamaProvider(item.input, {
      baseUrl,
      model,
      language: item.language,
      context: item.context,
      dictionary: item.dictionary,
    });
    assert.ok(output.trim());
    assert.doesNotMatch(output, /Regeln:|Kontext des Nutzers|Verbindliche Schreibweisen/);
    const safe = isRefinementSafe(item.input, output, item.dictionary);
    const guarded = await runProcessingJob({
      rawText: item.input,
      plan: {
        transcription: { id: "local-default", provider: "local", model: "test" },
        refinement: { id: "ollama-default", provider: "ollama", model, baseUrl },
        language: item.language,
        context: item.context,
        dictionary: item.dictionary,
        cleanupLevel: "sanft",
      },
    }, {
      transcribe: async () => assert.fail("vorhandener Rohtext darf nicht erneut transkribiert werden"),
      refine: async () => output,
    });
    assert.equal(Boolean(guarded.warning), !safe);
    results.push({
      language: item.language,
      input: item.input,
      output,
      accepted: safe,
      guardedText: guarded.text,
      warning: guarded.warning || null,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
  }
  console.log("OLLAMA_REAL_SMOKE_OK", JSON.stringify({ baseUrl, model, models, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
