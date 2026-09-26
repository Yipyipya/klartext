const http = require("node:http");
const assert = require("node:assert/strict");
require("./register.cjs");
const { refineWithCompatibleProvider } = require("../shared/compatible-refinement-provider.ts");

async function main() {
  let calls = 0;
  const server = http.createServer((request, response) => {
    calls++;
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/v1/chat/completions");
      assert.equal(request.headers.authorization, "Bearer local-text-key");
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      assert.equal(body.model, "local-text-model");
      assert.equal(body.stream, false);
      assert.deepEqual(body.messages.map((message) => message.role), ["system", "user"]);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: "Wir treffen Clara morgen um elf." } }],
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const text = await refineWithCompatibleProvider("wir treffen Klara morgen um elf", {
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "local-text-key",
      model: "local-text-model",
      language: "de-DE",
      dictionary: [{ from: "Klara", to: "Clara" }],
    });
    assert.equal(text, "Wir treffen Clara morgen um elf.");
    assert.equal(calls, 1);
    console.log("COMPATIBLE_TEXT_HTTP_OK: endpoint, auth, model, messages and response verified");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
