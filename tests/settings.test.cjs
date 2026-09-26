const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateSettingsPatch } = require("../desktop/settings-contract");
test("Settings IPC schützt Schlüssel und Laufzeitdaten", () => {
  const input = { interfaceLanguage:"en", lang:"en", mode:"local", transcriptionProvider:"groq", groqModel:"whisper-large-v3", compatibleTranscriptionBaseUrl:"https://speech.example/v1/", compatibleTranscriptionModel:"whisper-1", refinementProvider:"openai-compatible", compatibleRefinementBaseUrl:"http://127.0.0.1:8080/v1/", compatibleRefinementModel:"text-model", model:"schnell", theme:"dark", context:"Eigennamen", voiceActivation:false, launchAtLogin:false };
  const expected = { ...input, compatibleTranscriptionBaseUrl:"https://speech.example/v1", compatibleRefinementBaseUrl:"http://127.0.0.1:8080/v1" };
  assert.deepEqual(validateSettingsPatch(input), expected);
  for (const key of ["openaiKeyEnc", "hasKey", "busy", "wakeModelsAvailable", "constructor", "__proto__"]) assert.throws(() => validateSettingsPatch(JSON.parse(`{"${key}":true}`)));
});
test("Settings IPC lehnt ungültige Werte ohne Teilübernahme ab", () => {
  for (const input of [null, [], "dark", {interfaceLanguage:"fr"}, {theme:"sepia"}, {mode:"cloud"}, {transcriptionProvider:"deepgram"}, {launchAtLogin:1}, {voiceActivation:"false"}, {context:"a".repeat(4001)}, {lang:"en",model:"unknown"}, {ollamaBaseUrl:"https://example.com"}, {ollamaBaseUrl:"http://192.168.1.3:11434"}, {ollamaBaseUrl:"http://localhost:11434/api"}, {ollamaModel:"bad\nmodel"}, {groqModel:"bad\nmodel"}, {compatibleRefinementModel:"bad\nmodel"}, {compatibleTranscriptionBaseUrl:"http://speech.example/v1"}, {compatibleRefinementBaseUrl:"http://text.example/v1"}, {compatibleTranscriptionBaseUrl:"https://user:pass@speech.example/v1"}]) assert.throws(() => validateSettingsPatch(input));
  assert.deepEqual(validateSettingsPatch({context:"",lang:"",theme:"system"}), {context:"",lang:"",theme:"system"});
  assert.deepEqual(validateSettingsPatch({refinementProvider:"ollama",ollamaBaseUrl:"http://localhost:11434/",ollamaModel:"qwen3:4b"}), {refinementProvider:"ollama",ollamaBaseUrl:"http://localhost:11434",ollamaModel:"qwen3:4b"});
  assert.deepEqual(validateSettingsPatch({compatibleRefinementBaseUrl:""}), {compatibleRefinementBaseUrl:""});
});
