const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatDateTime,
  formatNumber,
  normalizeInterfaceLanguage,
  translate,
} = require("../shared/i18n.ts");
const { applyRuntimeChoices, createDefaultSettings } = require("../shared/settings.ts");

test("gemeinsame Textschlüssel liefern Deutsch und Englisch mit sicheren Platzhaltern", () => {
  assert.equal(translate("de", "error.openai.failure", { status: 503 }), "OpenAI konnte die Datei nicht verarbeiten (503).");
  assert.equal(translate("en", "error.openai.failure", { status: 503 }), "OpenAI could not process the file (503).");
  assert.match(translate("en", "error.openai.failure"), /\{status\}/);
  assert.equal(normalizeInterfaceLanguage("en"), "en");
  assert.equal(normalizeInterfaceLanguage("fr"), "de");
});

test("gemeinsame Formatierung folgt der Oberflächensprache", () => {
  assert.equal(formatNumber("de", 1234), "1.234");
  assert.equal(formatNumber("en", 1234), "1,234");
  const instant = new Date("2026-09-13T10:15:00Z");
  assert.match(formatDateTime("de", instant), /^\d{2}\.\d{2}\.\d{2},/);
  assert.match(formatDateTime("en", instant), /^\d{2}\/\d{2}\/\d{2},/);
});

test("Oberflächensprache und gesprochene Sprache bleiben unabhängig", () => {
  const settings = applyRuntimeChoices(createDefaultSettings(), {
    interfaceLanguage: "en",
    lang: "fr-FR",
  });
  assert.equal(settings.interfaceLanguage, "en");
  assert.equal(settings.spokenLanguage, "fr-FR");
});
