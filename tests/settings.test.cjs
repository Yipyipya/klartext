const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateSettingsPatch } = require("../desktop/settings-contract");
test("Settings IPC schützt Schlüssel und Laufzeitdaten", () => {
  const input = { lang:"en", mode:"local", model:"schnell", theme:"dark", context:"Eigennamen", voiceActivation:false, launchAtLogin:false };
  assert.deepEqual(validateSettingsPatch(input), input);
  for (const key of ["openaiKeyEnc", "hasKey", "busy", "wakeModelsAvailable", "constructor", "__proto__"]) assert.throws(() => validateSettingsPatch(JSON.parse(`{"${key}":true}`)));
});
test("Settings IPC lehnt ungültige Werte ohne Teilübernahme ab", () => {
  for (const input of [null, [], "dark", {theme:"sepia"}, {mode:"cloud"}, {launchAtLogin:1}, {voiceActivation:"false"}, {context:"a".repeat(4001)}, {lang:"en",model:"unknown"}]) assert.throws(() => validateSettingsPatch(input));
  assert.deepEqual(validateSettingsPatch({context:"",lang:"",theme:"system"}), {context:"",lang:"",theme:"system"});
});
