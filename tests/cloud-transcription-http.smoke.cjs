const http = require("node:http");
const assert = require("node:assert/strict");
require("./register.cjs");
const { transcribeWithCompatibleProvider } = require("../shared/cloud-transcription-providers.ts");

async function main() {
  let requestCount = 0;
  const server = http.createServer((request, response) => {
    requestCount++;
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/v1/audio/transcriptions");
      assert.equal(request.headers.authorization, "Bearer local-test-key");
      const body = Buffer.concat(chunks).toString("utf8");
      assert.match(body, /filename="probe\.wav"/);
      if (/name="model"\r\n\r\nredirect/.test(body)) {
        response.writeHead(307, { Location: `http://127.0.0.1:${server.address().port}/capture` });
        response.end();
        return;
      }
      if (/name="model"\r\n\r\nslow/.test(body)) {
        setTimeout(() => {
          if (response.destroyed) return;
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ text: "Zu spät." }));
        }, 80);
        return;
      }
      assert.match(body, /name="model"\r\n\r\nlocal-whisper/);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ text: "Lokaler kompatibler Test." }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const text = await transcribeWithCompatibleProvider(new Blob(["RIFFaudio"], { type: "audio/wav" }), {
      provider: "openai-compatible",
      apiKey: "local-test-key",
      model: "local-whisper",
      language: "de-DE",
      dictionary: [],
      fileName: "probe.wav",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
    });
    assert.equal(text, "Lokaler kompatibler Test.");
    await assert.rejects(transcribeWithCompatibleProvider(new Blob(["RIFFaudio"], { type: "audio/wav" }), {
      provider: "openai-compatible",
      apiKey: "local-test-key",
      model: "redirect",
      language: "de-DE",
      dictionary: [],
      fileName: "probe.wav",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
    }), /redirect|fetch failed/i);
    await assert.rejects(transcribeWithCompatibleProvider(new Blob(["RIFFaudio"], { type: "audio/wav" }), {
      provider: "openai-compatible",
      apiKey: "local-test-key",
      model: "slow",
      language: "de-DE",
      dictionary: [],
      fileName: "probe.wav",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      timeoutMs: 10,
    }), /timeout|aborted/i);
    assert.equal(requestCount, 3);
    console.log("COMPATIBLE_AUDIO_HTTP_OK: multipart, auth, model, response, redirect block and timeout verified");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
