export type InterfaceLanguage = "de" | "en";

const DE_MESSAGES = {
  "processing.captureFinalizing": "Aufnahme abschließen …",
  "processing.localPreparing": "Audio wird für die lokale Verarbeitung vorbereitet …",
  "processing.localModelLoading": "Lokales Modell wird geladen … {progress} %",
  "processing.localTranscribing": "Audio wird auf diesem Gerät transkribiert …",
  "processing.cloudTranscribing": "Audio wird transkribiert …",
  "processing.refining": "Text wird vorsichtig überarbeitet …",
  "settings.migration.credentials": "Die Zugangsdaten konnten noch nicht sicher migriert werden. Das bisherige Profil wurde nicht überschrieben.",
  "settings.migration.corrupt": "Gespeicherte Einstellungen waren beschädigt. Nivune verwendet sichere Standardwerte und hat den Originalwert zur Wiederherstellung behalten.",
  "settings.migration.invalid": "Einige ungültige Einstellungswerte wurden durch sichere Standardwerte ersetzt.",
  "settings.desktopMigration.credentials": "Zugangsdaten konnten noch nicht sicher migriert werden; das bisherige Profil blieb unverändert.",
  "settings.desktopMigration.corrupt": "Gespeicherte Einstellungen waren beschädigt; sichere Standardwerte wurden geladen.",
  "settings.desktopMigration.invalid": "Ungültige Einstellungswerte wurden sicher ersetzt.",
  "error.openai.apiKeyMissing": "Bitte trage deinen OpenAI API-Key in den Einstellungen ein.",
  "error.openai.audioEmpty": "Die Audiodatei ist leer.",
  "error.openai.audioTooLarge": "Die Aufnahme ist zu groß für eine einzelne Anfrage. Bitte nutze den Datei-Upload zum Aufteilen.",
  "error.openai.invalidKey": "Bitte prüfe deinen OpenAI API-Key.",
  "error.openai.rateLimit": "OpenAI-Limit erreicht. Bitte prüfe Guthaben und Nutzungslimit oder versuche es später erneut.",
  "error.openai.fileTooLarge": "Die Datei überschreitet das Upload-Limit.",
  "error.openai.failure": "OpenAI konnte die Datei nicht verarbeiten ({status}).",
  "error.local.audioInvalid": "Ungültige lokale Audiodaten.",
  "error.local.audioEmpty": "Keine nutzbare Audioaufnahme vorhanden. Bitte erneut aufnehmen.",
  "error.local.noSpeech": "Keine Sprache erkannt. Bitte Mikrofon prüfen und erneut aufnehmen.",
  "error.local.workerStopped": "Lokales Whisper wurde beendet. Bitte versuche die Aufnahme erneut.",
  "error.local.modelNotReady": "Das lokale Sprachmodell ist noch nicht bereit. Lade es zuerst in den Einstellungen herunter.",
  "error.local.storageUnavailable": "Der Browser kann den lokalen Modellspeicher nicht öffnen. Prüfe Speicher- und Datenschutz-Einstellungen.",
  "error.local.timeout": "Die lokale Transkription hat das Zeitlimit überschritten.",
  "error.local.aborted": "Lokale Transkription abgebrochen.",
} as const;

export type MessageKey = keyof typeof DE_MESSAGES;

const EN_MESSAGES: Record<MessageKey, string> = {
  "processing.captureFinalizing": "Finishing recording …",
  "processing.localPreparing": "Preparing audio for local processing …",
  "processing.localModelLoading": "Loading local model … {progress}%",
  "processing.localTranscribing": "Transcribing audio on this device …",
  "processing.cloudTranscribing": "Transcribing audio …",
  "processing.refining": "Carefully refining text …",
  "settings.migration.credentials": "Your credentials could not yet be migrated securely. The previous profile was not overwritten.",
  "settings.migration.corrupt": "Saved settings were corrupted. Nivune is using safe defaults and kept the original value for recovery.",
  "settings.migration.invalid": "Some invalid settings were replaced with safe defaults.",
  "settings.desktopMigration.credentials": "Credentials could not yet be migrated securely; the previous profile was left unchanged.",
  "settings.desktopMigration.corrupt": "Saved settings were corrupted; safe defaults were loaded.",
  "settings.desktopMigration.invalid": "Invalid settings were replaced safely.",
  "error.openai.apiKeyMissing": "Add your OpenAI API key in Settings.",
  "error.openai.audioEmpty": "The audio file is empty.",
  "error.openai.audioTooLarge": "The recording is too large for a single request. Use file upload to split it.",
  "error.openai.invalidKey": "Check your OpenAI API key.",
  "error.openai.rateLimit": "The OpenAI limit was reached. Check your balance and usage limit or try again later.",
  "error.openai.fileTooLarge": "The file exceeds the upload limit.",
  "error.openai.failure": "OpenAI could not process the file ({status}).",
  "error.local.audioInvalid": "The local audio data is invalid.",
  "error.local.audioEmpty": "No usable audio was recorded. Please try again.",
  "error.local.noSpeech": "No speech was detected. Check your microphone and try again.",
  "error.local.workerStopped": "Local Whisper stopped unexpectedly. Try the recording again.",
  "error.local.modelNotReady": "The local speech model is not ready yet. Download it in Settings first.",
  "error.local.storageUnavailable": "The browser cannot open local model storage. Check its storage and privacy settings.",
  "error.local.timeout": "Local transcription timed out.",
  "error.local.aborted": "Local transcription was cancelled.",
};

const MESSAGES: Record<InterfaceLanguage, Record<MessageKey, string>> = {
  de: DE_MESSAGES,
  en: EN_MESSAGES,
};

export function normalizeInterfaceLanguage(value: unknown): InterfaceLanguage {
  return value === "en" ? "en" : "de";
}

export function localeFor(language: InterfaceLanguage): "de-DE" | "en-US" {
  return language === "en" ? "en-US" : "de-DE";
}

export function translate(
  language: InterfaceLanguage,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return MESSAGES[language][key].replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (placeholder, name) => (
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  ));
}

export function createTranslator(language: InterfaceLanguage) {
  return (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values);
}

export function uiText(language: InterfaceLanguage, german: string, english: string): string {
  return language === "en" ? english : german;
}

export function formatNumber(language: InterfaceLanguage, value: number): string {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}

export function formatDateTime(language: InterfaceLanguage, value: number | Date): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
