function createDesktopSettingsStore({ fs, settingsPath, schema, log = () => {} }) {
  const credentialsPath = settingsPath.replace(/settings\.json$/, "credentials.json");
  const backupPath = `${settingsPath}.backup-0.3.0`;
  const recoveryPath = `${settingsPath}.recovery`;
  let persisted = schema.createDefaultSettings({ spokenLanguage: "de" });

  function writeJsonAtomic(filePath, value) {
    const pendingPath = `${filePath}.next`;
    fs.writeFileSync(pendingPath, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(pendingPath, filePath);
  }

  function readCredentials() {
    try {
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
      return parsed?.schemaVersion === 1
        ? schema.sanitizeCredentialRecord(parsed.credentials) : {};
    } catch {
      return {};
    }
  }

  function writeCredentials(credentials) {
    writeJsonAtomic(credentialsPath, { schemaVersion: 1, credentials: schema.sanitizeCredentialRecord(credentials) });
  }

  function toRuntime(settings, credentials) {
    const transcription = settings.transcriptionProfiles[settings.activeTranscriptionProfileId]
      || settings.transcriptionProfiles["openai-default"];
    const groq = settings.transcriptionProfiles["groq-default"] || {};
    const compatible = settings.transcriptionProfiles["compatible-default"] || {};
    const compatibleRef = compatible.credentialRef
      || schema.compatibleCredentialRef("transcription", compatible.baseUrl || "");
    const refinement = settings.refinementProfiles[settings.activeRefinementProfileId] || settings.refinementProfiles.none;
    const ollama = settings.refinementProfiles["ollama-default"] || {};
    const compatibleRefinement = settings.refinementProfiles["compatible-default"] || {};
    const compatibleRefinementRef = compatibleRefinement.credentialRef
      || schema.compatibleCredentialRef("refinement", compatibleRefinement.baseUrl || "");
    return {
      interfaceLanguage: settings.interfaceLanguage,
      lang: settings.spokenLanguage,
      mode: transcription?.provider === "local" ? "local" : "quality",
      transcriptionProvider: transcription?.provider === "groq" || transcription?.provider === "openai-compatible"
        ? transcription.provider : "openai",
      groqModel: groq.model || "whisper-large-v3",
      compatibleTranscriptionBaseUrl: compatible.baseUrl || "",
      compatibleTranscriptionModel: compatible.model || "",
      model: schema.localModelChoice(settings),
      cleanup: settings.cleanupLevel,
      launchAtLogin: settings.behavior.launchAtLogin,
      theme: settings.appearance.theme,
      openaiKeyEnc: credentials[schema.OPENAI_CREDENTIAL_REF] || null,
      groqKeyEnc: credentials[schema.GROQ_CREDENTIAL_REF] || null,
      compatibleTranscriptionKeyEnc: compatibleRef ? credentials[compatibleRef] || null : null,
      compatibleTranscriptionCredentialRef: compatibleRef || "",
      voiceActivation: settings.behavior.voiceActivation,
      context: settings.context,
      dictionary: settings.dictionary,
      refinementProvider: refinement?.provider || "none",
      ollamaBaseUrl: ollama.baseUrl || schema.DEFAULT_OLLAMA_BASE_URL,
      ollamaModel: ollama.model || "",
      compatibleRefinementBaseUrl: compatibleRefinement.baseUrl || "",
      compatibleRefinementModel: compatibleRefinement.model || "",
      compatibleRefinementKeyEnc: compatibleRefinementRef ? credentials[compatibleRefinementRef] || null : null,
      compatibleRefinementCredentialRef: compatibleRefinementRef || "",
    };
  }

  function load() {
    let raw = null;
    let parsed;
    let corrupted = false;
    try {
      raw = fs.readFileSync(settingsPath, "utf8");
      parsed = JSON.parse(raw);
    } catch (error) {
      if (raw !== null) {
        corrupted = true;
        try { if (!fs.existsSync(recoveryPath)) fs.writeFileSync(recoveryPath, raw, { encoding: "utf8", mode: 0o600 }); } catch { /* best effort */ }
        log("Beschädigte Einstellungen wurden gesichert", error);
      }
    }

    const migration = schema.migrateSettings(parsed, { spokenLanguage: "de" });
    persisted = migration.settings;
    const credentials = readCredentials();
    let credentialMigrationFailed = false;
    if (migration.legacyCredentials.openaiKeyEnc && !credentials[schema.OPENAI_CREDENTIAL_REF]) {
      credentials[schema.OPENAI_CREDENTIAL_REF] = migration.legacyCredentials.openaiKeyEnc;
      try { writeCredentials(credentials); } catch (error) {
        credentialMigrationFailed = true;
        log("Zugangsdaten konnten nicht migriert werden", error);
      }
    }
    if (raw && migration.migrated && !corrupted) {
      try { if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, raw, { encoding: "utf8", mode: 0o600 }); } catch (error) { log("Einstellungsbackup konnte nicht angelegt werden", error); }
    }
    if (raw && !credentialMigrationFailed && (migration.migrated || migration.issues.length || corrupted)) {
      try { writeJsonAtomic(settingsPath, persisted); } catch (error) { log("Migrierte Einstellungen konnten nicht gespeichert werden", error); }
    }
    return {
      settings: toRuntime(persisted, credentials),
      migrated: migration.migrated,
      warning: credentialMigrationFailed
        ? schema.translate(persisted.interfaceLanguage, "settings.desktopMigration.credentials")
        : corrupted
        ? schema.translate(persisted.interfaceLanguage, "settings.desktopMigration.corrupt")
        : migration.issues.length ? schema.translate(persisted.interfaceLanguage, "settings.desktopMigration.invalid") : null,
    };
  }

  function save(runtime) {
    persisted = schema.applyRuntimeChoices(persisted, runtime);
    const credentials = readCredentials();
    if (runtime.openaiKeyEnc) credentials[schema.OPENAI_CREDENTIAL_REF] = runtime.openaiKeyEnc;
    else delete credentials[schema.OPENAI_CREDENTIAL_REF];
    if (runtime.groqKeyEnc) credentials[schema.GROQ_CREDENTIAL_REF] = runtime.groqKeyEnc;
    else delete credentials[schema.GROQ_CREDENTIAL_REF];
    for (const ref of Object.keys(credentials)) {
      if (ref.startsWith("provider:openai-compatible:transcription:")) delete credentials[ref];
    }
    const compatibleRef = schema.compatibleCredentialRef(
      "transcription",
      runtime.compatibleTranscriptionBaseUrl || "",
    );
    if (compatibleRef && runtime.compatibleTranscriptionKeyEnc
      && runtime.compatibleTranscriptionCredentialRef === compatibleRef) {
      credentials[compatibleRef] = runtime.compatibleTranscriptionKeyEnc;
    }
    for (const ref of Object.keys(credentials)) {
      if (ref.startsWith("provider:openai-compatible:refinement:")) delete credentials[ref];
    }
    const compatibleRefinementRef = schema.compatibleCredentialRef(
      "refinement",
      runtime.compatibleRefinementBaseUrl || "",
    );
    if (compatibleRefinementRef && runtime.compatibleRefinementKeyEnc
      && runtime.compatibleRefinementCredentialRef === compatibleRefinementRef) {
      credentials[compatibleRefinementRef] = runtime.compatibleRefinementKeyEnc;
    }
    writeCredentials(credentials);
    writeJsonAtomic(settingsPath, persisted);
    return toRuntime(persisted, credentials);
  }

  function currentSettings() {
    return persisted;
  }

  function exportSettings() {
    return {
      kind: "nivune-settings",
      version: 1,
      settings: structuredClone(persisted),
    };
  }

  function importSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || !["nivune-settings", "klartext-settings"].includes(value.kind) || value.version !== 1
      || !value.settings || typeof value.settings !== "object" || Array.isArray(value.settings)
      || value.settings.schemaVersion !== 1) {
      throw new Error("SETTINGS_IMPORT_INVALID");
    }
    const migration = schema.migrateSettings(value.settings, { spokenLanguage: "de" });
    const imported = migration.settings;
    let targetsDeactivated = false;
    const transcription = imported.transcriptionProfiles[imported.activeTranscriptionProfileId];
    if (transcription?.provider !== "local") {
      imported.activeTranscriptionProfileId = "local-default";
      targetsDeactivated = true;
    }
    const refinement = imported.refinementProfiles[imported.activeRefinementProfileId];
    if (!["none", "deterministic"].includes(refinement?.provider)) {
      imported.activeRefinementProfileId = "none";
      targetsDeactivated = true;
    }
    // Importing a file must never start background microphone work on this device.
    imported.behavior.voiceActivation = false;
    persisted = imported;
    writeJsonAtomic(settingsPath, persisted);
    return {
      settings: toRuntime(persisted, readCredentials()),
      issues: migration.issues,
      targetsDeactivated,
    };
  }

  return {
    load,
    save,
    currentSettings,
    exportSettings,
    importSettings,
    paths: { settingsPath, credentialsPath, backupPath, recoveryPath },
  };
}

module.exports = { createDesktopSettingsStore };
