const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const schema = require("../shared/settings.ts");
const { DEFAULT_OLLAMA_BASE_URL } = require("../shared/local-endpoints.ts");
const {
  CREDENTIALS_KEY,
  CREDENTIAL_PERSISTENCE_KEY,
  SETTINGS_BACKUP_KEY,
  SETTINGS_KEY,
  SETTINGS_RECOVERY_KEY,
  loadSettingsResult,
  saveSettings,
} = require("../lib/store.ts");
const { createDesktopSettingsStore } = require("../desktop/settings-store");

function withBrowserStorage(t, entries = {}) {
  const localValues = new Map(Object.entries(entries));
  const sessionValues = new Map();
  const storageFor = (values) => ({
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  });
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    sessionStorage: Object.getOwnPropertyDescriptor(globalThis, "sessionStorage"),
  };
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storageFor(localValues), configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: storageFor(sessionValues), configurable: true });
  t.after(() => {
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  return { localValues, sessionValues };
}

test("neue Profile starten ohne persönlichen Kontext oder Markenregel", () => {
  const defaults = schema.createDefaultSettings();
  assert.equal(defaults.schemaVersion, 1);
  assert.equal(defaults.interfaceLanguage, "de");
  assert.equal(defaults.context, "");
  assert.deepEqual(defaults.dictionary, []);
  assert.equal(defaults.transcriptionProfiles["openai-default"].credentialRef, schema.OPENAI_CREDENTIAL_REF);
  assert.equal(defaults.transcriptionProfiles["groq-default"].credentialRef, schema.GROQ_CREDENTIAL_REF);
  assert.equal(defaults.transcriptionProfiles["compatible-default"].baseUrl, "");
  assert.equal(defaults.refinementProfiles["openai-default"].credentialRef, schema.OPENAI_CREDENTIAL_REF);
  assert.deepEqual(defaults.refinementProfiles["ollama-default"], {
    id: "ollama-default",
    provider: "ollama",
    model: "",
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
  });
  assert.deepEqual(defaults.refinementProfiles["compatible-default"], {
    id: "compatible-default",
    provider: "openai-compatible",
    model: "",
    baseUrl: "",
  });
  assert.deepEqual(schema.migrateSettings(defaults).issues, []);
});

test("kompatibles Textprofil bleibt sicher, getrennt und ausdrücklich gewählt", () => {
  const selected = schema.applyRuntimeChoices(schema.createDefaultSettings(), {
    refinementProvider: "openai-compatible",
    compatibleRefinementBaseUrl: "http://localhost:8080/v1/",
    compatibleRefinementModel: "local-text",
  });
  assert.equal(selected.activeRefinementProfileId, "compatible-default");
  assert.deepEqual(selected.refinementProfiles["compatible-default"], {
    id: "compatible-default",
    provider: "openai-compatible",
    model: "local-text",
    baseUrl: "http://localhost:8080/v1",
    credentialRef: schema.compatibleCredentialRef("refinement", "http://localhost:8080/v1"),
  });
  selected.refinementProfiles["compatible-default"].baseUrl = "http://remote.example/v1";
  const migrated = schema.migrateSettings(selected);
  assert.equal(migrated.settings.refinementProfiles["compatible-default"].baseUrl, "");
  assert.ok(migrated.issues.includes("refinementProfiles.compatible-default.baseUrl"));
});

test("optionale Qualitätsprofile werden explizit gewählt und unsichere Ziele bleiben inaktiv", () => {
  const groq = schema.applyRuntimeChoices(schema.createDefaultSettings(), {
    transcriptionMode: "quality",
    transcriptionProvider: "groq",
    groqModel: "whisper-large-v3-turbo",
  });
  assert.equal(groq.activeTranscriptionProfileId, "groq-default");
  assert.equal(groq.transcriptionProfiles["groq-default"].model, "whisper-large-v3-turbo");

  const compatible = schema.applyRuntimeChoices(groq, {
    transcriptionMode: "quality",
    transcriptionProvider: "openai-compatible",
    compatibleTranscriptionBaseUrl: "http://127.0.0.1:9010/v1/",
    compatibleTranscriptionModel: "whisper-local",
  });
  assert.equal(compatible.activeTranscriptionProfileId, "compatible-default");
  assert.equal(compatible.transcriptionProfiles["compatible-default"].baseUrl, "http://127.0.0.1:9010/v1");
  assert.match(compatible.transcriptionProfiles["compatible-default"].credentialRef, /openai-compatible:transcription/);

  compatible.transcriptionProfiles["compatible-default"].baseUrl = "http://remote.example/v1";
  const migrated = schema.migrateSettings(compatible);
  assert.equal(migrated.settings.activeTranscriptionProfileId, "compatible-default");
  assert.equal(migrated.settings.transcriptionProfiles["compatible-default"].baseUrl, "");
  assert.ok(migrated.issues.includes("transcriptionProfiles.compatible-default.baseUrl"));
});

test("Web-Credentials bleiben an Anbieter und kompatiblen Zielserver gebunden", (t) => {
  const { localValues, sessionValues } = withBrowserStorage(t);
  saveSettings({
    ...require("../lib/store.ts").DEFAULT_SETTINGS,
    transcriptionProvider: "openai-compatible",
    compatibleTranscriptionBaseUrl: "https://speech.example/v1",
    compatibleTranscriptionModel: "whisper-1",
    compatibleTranscriptionApiKey: "secret-for-speech",
    compatibleTranscriptionCredentialRef: "provider:openai-compatible:transcription:https%3A%2F%2Fspeech.example%2Fv1",
    groqApiKey: "groq-secret",
    refinementProvider: "openai-compatible",
    compatibleRefinementBaseUrl: "https://text.example/v1",
    compatibleRefinementModel: "text-model",
    compatibleRefinementApiKey: "secret-for-text",
    compatibleRefinementCredentialRef: "provider:openai-compatible:refinement:https%3A%2F%2Ftext.example%2Fv1",
  });
  const credentials = JSON.parse(sessionValues.get(CREDENTIALS_KEY)).credentials;
  assert.equal(credentials[schema.GROQ_CREDENTIAL_REF], "groq-secret");
  assert.equal(credentials["provider:openai-compatible:transcription:https%3A%2F%2Fspeech.example%2Fv1"], "secret-for-speech");
  assert.equal(credentials["provider:openai-compatible:refinement:https%3A%2F%2Ftext.example%2Fv1"], "secret-for-text");
  assert.equal(localValues.has(CREDENTIALS_KEY), false);
  assert.doesNotMatch(localValues.get(SETTINGS_KEY), /secret-for-speech|secret-for-text|groq-secret/);

  const loaded = loadSettingsResult().settings;
  assert.equal(loaded.transcriptionProvider, "openai-compatible");
  assert.equal(loaded.compatibleTranscriptionApiKey, "secret-for-speech");
  assert.equal(loaded.compatibleRefinementApiKey, "secret-for-text");
});

test("bestehende Web-Credentials wechseln aus localStorage in die Browsersitzung", (t) => {
  const persisted = JSON.stringify({
    schemaVersion: 1,
    credentials: { [schema.OPENAI_CREDENTIAL_REF]: "sk-session-only" },
  });
  const { localValues, sessionValues } = withBrowserStorage(t, { [CREDENTIALS_KEY]: persisted });
  const loaded = loadSettingsResult();
  assert.equal(loaded.settings.openaiApiKey, "sk-session-only");
  assert.equal(localValues.has(CREDENTIALS_KEY), false);
  assert.equal(sessionValues.get(CREDENTIALS_KEY), persisted);
});

test("Web-Keys bleiben standardmäßig in der Sitzung und nur nach bewusster Wahl im Gerät", (t) => {
  const { localValues, sessionValues } = withBrowserStorage(t);
  const initial = loadSettingsResult().settings;
  assert.equal(initial.rememberKeysOnDevice, false);
  saveSettings({ ...initial, openaiApiKey: "sk-session" });
  assert.equal(localValues.has(CREDENTIALS_KEY), false);
  assert.equal(localValues.has(CREDENTIAL_PERSISTENCE_KEY), false);
  assert.match(sessionValues.get(CREDENTIALS_KEY), /sk-session/);

  saveSettings({ ...initial, openaiApiKey: "sk-session", rememberKeysOnDevice: true });
  assert.equal(localValues.get(CREDENTIAL_PERSISTENCE_KEY), "device");
  assert.match(localValues.get(CREDENTIALS_KEY), /sk-session/);
  assert.equal(sessionValues.has(CREDENTIALS_KEY), false);

  sessionValues.clear();
  const reopened = loadSettingsResult().settings;
  assert.equal(reopened.rememberKeysOnDevice, true);
  assert.equal(reopened.openaiApiKey, "sk-session");

  saveSettings({ ...reopened, rememberKeysOnDevice: false });
  assert.equal(localValues.has(CREDENTIALS_KEY), false, "Abschalten entfernt die dauerhafte Kopie");
  assert.equal(localValues.has(CREDENTIAL_PERSISTENCE_KEY), false);
  assert.match(sessionValues.get(CREDENTIALS_KEY), /sk-session/);
  assert.doesNotMatch(localValues.get(SETTINGS_KEY), /sk-session/, "Keys gelangen nie ins Einstellungsobjekt");
});

test("Ollama-Auswahl migriert nur mit lokaler Adresse und eigenem Modell", () => {
  const current = schema.createDefaultSettings();
  const selected = schema.applyRuntimeChoices(current, {
    transcriptionMode: "local",
    refinementProvider: "ollama",
    ollamaBaseUrl: "http://localhost:12000/",
    ollamaModel: "qwen3:4b",
  });
  assert.equal(selected.activeTranscriptionProfileId, "local-default");
  assert.equal(selected.activeRefinementProfileId, "ollama-default");
  assert.deepEqual(selected.refinementProfiles["ollama-default"], {
    id: "ollama-default",
    provider: "ollama",
    model: "qwen3:4b",
    baseUrl: "http://localhost:12000",
  });

  selected.refinementProfiles["ollama-default"].baseUrl = "https://example.com";
  const migrated = schema.migrateSettings(selected);
  assert.equal(migrated.settings.activeRefinementProfileId, "ollama-default");
  assert.equal(migrated.settings.refinementProfiles["ollama-default"].baseUrl, DEFAULT_OLLAMA_BASE_URL);
  assert.ok(migrated.issues.includes("refinementProfiles.ollama-default.baseUrl"));
});

test("wortgetreuer Modus deaktiviert eine gleichzeitig gesetzte KI-Überarbeitung", () => {
  const updated = schema.applyRuntimeChoices(schema.createDefaultSettings(), {
    cleanup: "aus",
    refinementProvider: "ollama",
    ollamaModel: "qwen3:4b",
  });
  assert.equal(updated.cleanupLevel, "aus");
  assert.equal(updated.activeRefinementProfileId, "none");
  assert.equal(updated.refinementProfiles["ollama-default"].model, "qwen3:4b");
});

test("Web-Migration sichert 0.3.0, trennt den Key und bewahrt persönliche Werte", (t) => {
  const legacy = {
    lang: "de-DE",
    cleanup: "sanft",
    autoCopy: false,
    dictionary: [{ from: "Klara", to: "Clara" }],
    transcriptionMode: "local",
    openaiApiKey: "sk-existing",
    context: schema.LEGACY_PERSONAL_CONTEXT,
    whisperModel: "schnell",
  };
  const original = JSON.stringify(legacy);
  const { localValues, sessionValues } = withBrowserStorage(t, { [SETTINGS_KEY]: original });
  const loaded = loadSettingsResult();
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.settings.openaiApiKey, "sk-existing");
  assert.equal(loaded.settings.context, schema.LEGACY_PERSONAL_CONTEXT);
  assert.deepEqual(loaded.settings.dictionary, [
    { from: "Klara", to: "Clara" },
    { from: "Sigil", to: "Sigill" },
  ]);
  assert.equal(localValues.get(SETTINGS_BACKUP_KEY), original);
  assert.doesNotMatch(localValues.get(SETTINGS_KEY), /sk-existing|openaiApiKey/);
  assert.equal(localValues.has(CREDENTIALS_KEY), false);
  assert.match(sessionValues.get(CREDENTIALS_KEY), /sk-existing/);
  assert.equal(loadSettingsResult().migrated, false);
});

test("beschädigte Web-Einstellungen bleiben als Recovery erhalten", (t) => {
  const { localValues } = withBrowserStorage(t, { [SETTINGS_KEY]: "{kaputt" });
  const loaded = loadSettingsResult();
  assert.match(loaded.warning, /beschädigt/);
  assert.equal(localValues.get(SETTINGS_RECOVERY_KEY), "{kaputt");
  assert.equal(JSON.parse(localValues.get(SETTINGS_KEY)).schemaVersion, 1);
});

test("fehlgeschlagene Key-Migration überschreibt das alte Web-Profil nicht", (t) => {
  const original = JSON.stringify({ transcriptionMode: "quality", openaiApiKey: "sk-keep-me" });
  const values = new Map([[SETTINGS_KEY, original]]);
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => {
      if (key === CREDENTIALS_KEY) throw new Error("quota");
      values.set(key, String(value));
    },
  };
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const sessionDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else delete globalThis.window;
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor); else delete globalThis.localStorage;
    if (sessionDescriptor) Object.defineProperty(globalThis, "sessionStorage", sessionDescriptor); else delete globalThis.sessionStorage;
  });
  const loaded = loadSettingsResult();
  assert.equal(loaded.settings.openaiApiKey, "sk-keep-me");
  assert.match(loaded.warning, /nicht sicher migriert/);
  assert.equal(values.get(SETTINGS_KEY), original);
});

test("Desktop-Migration schreibt Einstellungen atomar und verschlüsselte Keys getrennt", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-settings-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const settingsPath = path.join(directory, "settings.json");
  const legacy = {
    lang: "en",
    mode: "quality",
    model: "schnell",
    launchAtLogin: false,
    theme: "dark",
    openaiKeyEnc: "encrypted-existing-key",
    voiceActivation: true,
    context: "Eigene Namen",
  };
  fs.writeFileSync(settingsPath, JSON.stringify(legacy));
  const store = createDesktopSettingsStore({ fs, settingsPath, schema });
  const loaded = store.load();
  assert.equal(loaded.settings.openaiKeyEnc, "encrypted-existing-key");
  assert.equal(loaded.settings.context, "Eigene Namen");
  assert.deepEqual(loaded.settings.dictionary, [{ from: "Sigil", to: "Sigill" }]);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${settingsPath}.backup-0.3.0`, "utf8")), legacy);
  const persisted = fs.readFileSync(settingsPath, "utf8");
  assert.doesNotMatch(persisted, /encrypted-existing-key|openaiKeyEnc/);
  assert.match(fs.readFileSync(path.join(directory, "credentials.json"), "utf8"), /encrypted-existing-key/);
  assert.equal(JSON.parse(persisted).schemaVersion, 1);
  assert.equal(fs.existsSync(`${settingsPath}.next`), false);

  const updated = store.save({ ...loaded.settings, interfaceLanguage: "en", lang: "de" });
  assert.equal(updated.interfaceLanguage, "en");
  assert.equal(updated.lang, "de");
  const savedSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  assert.equal(savedSettings.interfaceLanguage, "en");
  assert.equal(savedSettings.spokenLanguage, "de");
});

test("Desktop-Speicherbrücke erhält optionale Qualitätsprofile und zielgebundene verschlüsselte Keys", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-provider-settings-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const settingsPath = path.join(directory, "settings.json");
  const store = createDesktopSettingsStore({ fs, settingsPath, schema });
  const initial = store.load().settings;
  const compatibleRef = schema.compatibleCredentialRef("transcription", "https://speech.example/v1");
  const compatibleRefinementRef = schema.compatibleCredentialRef("refinement", "https://text.example/v1");
  const saved = store.save({
    ...initial,
    mode: "quality",
    transcriptionProvider: "openai-compatible",
    groqModel: "whisper-large-v3-turbo",
    groqKeyEnc: "encrypted-groq",
    compatibleTranscriptionBaseUrl: "https://speech.example/v1",
    compatibleTranscriptionModel: "whisper-1",
    compatibleTranscriptionKeyEnc: "encrypted-compatible",
    compatibleTranscriptionCredentialRef: compatibleRef,
    refinementProvider: "openai-compatible",
    compatibleRefinementBaseUrl: "https://text.example/v1",
    compatibleRefinementModel: "text-model",
    compatibleRefinementKeyEnc: "encrypted-compatible-text",
    compatibleRefinementCredentialRef: compatibleRefinementRef,
  });
  assert.equal(saved.transcriptionProvider, "openai-compatible");
  assert.equal(saved.compatibleTranscriptionModel, "whisper-1");
  assert.equal(saved.compatibleTranscriptionKeyEnc, "encrypted-compatible");
  assert.equal(saved.compatibleRefinementKeyEnc, "encrypted-compatible-text");
  assert.equal(store.currentSettings().activeTranscriptionProfileId, "compatible-default");
  const persistedSettings = fs.readFileSync(settingsPath, "utf8");
  const persistedCredentials = JSON.parse(fs.readFileSync(path.join(directory, "credentials.json"), "utf8")).credentials;
  assert.doesNotMatch(persistedSettings, /encrypted-groq|encrypted-compatible/);
  assert.equal(persistedCredentials[schema.GROQ_CREDENTIAL_REF], "encrypted-groq");
  assert.equal(persistedCredentials[compatibleRef], "encrypted-compatible");
  assert.equal(persistedCredentials[compatibleRefinementRef], "encrypted-compatible-text");

  const moved = store.save({ ...saved, compatibleTranscriptionBaseUrl: "https://other.example/v1" });
  assert.equal(moved.compatibleTranscriptionKeyEnc, null);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(directory, "credentials.json"), "utf8")).credentials)
    .some((ref) => ref.startsWith("provider:openai-compatible:transcription:")), false);
  const movedText = store.save({ ...moved, compatibleRefinementBaseUrl: "https://other-text.example/v1" });
  assert.equal(movedText.compatibleRefinementKeyEnc, null);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(directory, "credentials.json"), "utf8")).credentials)
    .some((ref) => ref.startsWith("provider:openai-compatible:refinement:")), false);
});

test("Desktop-Einstellungsexport enthält keine Schlüssel und Import aktiviert keine Netzwerkziele", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-settings-transfer-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const settingsPath = path.join(directory, "settings.json");
  const store = createDesktopSettingsStore({ fs, settingsPath, schema });
  const initial = store.load().settings;
  const compatibleRef = schema.compatibleCredentialRef("transcription", "https://speech.example/v1");
  const refinementRef = schema.compatibleCredentialRef("refinement", "https://text.example/v1");
  store.save({
    ...initial,
    mode: "quality",
    transcriptionProvider: "openai-compatible",
    compatibleTranscriptionBaseUrl: "https://speech.example/v1",
    compatibleTranscriptionModel: "whisper-1",
    compatibleTranscriptionKeyEnc: "encrypted-speech-key",
    compatibleTranscriptionCredentialRef: compatibleRef,
    cleanup: "sanft",
    refinementProvider: "openai-compatible",
    compatibleRefinementBaseUrl: "https://text.example/v1",
    compatibleRefinementModel: "text-model",
    compatibleRefinementKeyEnc: "encrypted-text-key",
    compatibleRefinementCredentialRef: refinementRef,
    voiceActivation: true,
  });
  const credentialsBefore = fs.readFileSync(path.join(directory, "credentials.json"), "utf8");
  const exported = store.exportSettings();
  const serialized = JSON.stringify(exported);
  assert.doesNotMatch(serialized, /encrypted-speech-key|encrypted-text-key|KeyEnc|ApiKey/);
  assert.equal(exported.kind, "nivune-settings");

  const imported = store.importSettings(exported);
  assert.equal(imported.targetsDeactivated, true);
  assert.equal(imported.settings.mode, "local");
  assert.equal(imported.settings.refinementProvider, "none");
  assert.equal(imported.settings.voiceActivation, false);
  assert.equal(store.currentSettings().transcriptionProfiles["compatible-default"].baseUrl, "https://speech.example/v1");
  assert.equal(store.currentSettings().refinementProfiles["compatible-default"].baseUrl, "https://text.example/v1");
  assert.equal(fs.readFileSync(path.join(directory, "credentials.json"), "utf8"), credentialsBefore);
  assert.doesNotThrow(() => store.importSettings({ ...exported, kind: "klartext-settings" }));
  assert.throws(() => store.importSettings({ schemaVersion: 1 }), /SETTINGS_IMPORT_INVALID/);
});
