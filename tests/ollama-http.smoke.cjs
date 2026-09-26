const http = require("node:http");
const assert = require("node:assert/strict");
const { listOllamaModels, refineWithOllamaProvider } = require("../shared/ollama-provider.ts");

async function main() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({ method: request.method, url: request.url, body });
      response.setHeader("Content-Type", "application/json");
      if (request.method === "GET" && request.url === "/api/tags") {
        response.end(JSON.stringify({ models: [{ model: "klartext-smoke:latest" }] }));
        return;
      }
      if (request.method === "POST" && request.url === "/api/generate") {
        const payload = JSON.parse(body);
        assert.equal(payload.model, "klartext-smoke:latest");
        assert.equal(payload.stream, false);
        response.end(JSON.stringify({ response: "Ein geprüfter lokaler Text.", done: true }));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not found" }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const models = await listOllamaModels({ baseUrl });
    const text = await refineWithOllamaProvider("ein geprüfter lokaler text", {
      baseUrl,
      model: models[0],
    });
    assert.deepEqual(models, ["klartext-smoke:latest"]);
    assert.equal(text, "Ein geprüfter lokaler Text.");
    assert.deepEqual(requests.map(({ method, url }) => `${method} ${url}`), [
      "GET /api/tags",
      "POST /api/generate",
    ]);
    console.log("OLLAMA_HTTP_SMOKE_OK", JSON.stringify({ baseUrl, models, text, requests: requests.length }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
