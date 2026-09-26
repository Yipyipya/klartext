(function exposeWakePhrase(root) {
  const DEFAULT_WAKE_PHRASE = "Diktat starten";
  const DEFAULT_WAKE_PHRASE_ENGLISH = "Start dictation";
  const LEGACY_WAKE_PHRASE = "Hey Klartext";
  const MIN_WORDS = 2;
  const MAX_WORDS = 5;
  const MAX_LENGTH = 40;
  const SAFE_PHRASE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’.-]*(?: [\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’.-]*)+$/u;

  function normalizeWakePhrase(value) {
    if (typeof value !== "string") return "";
    const phrase = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
    const words = phrase ? phrase.split(" ") : [];
    if (phrase.length < 3 || phrase.length > MAX_LENGTH) return "";
    if (words.length < MIN_WORDS || words.length > MAX_WORDS) return "";
    return SAFE_PHRASE.test(phrase) ? phrase : "";
  }

  function defaultWakePhrase(language) {
    return language === "en" ? DEFAULT_WAKE_PHRASE_ENGLISH : DEFAULT_WAKE_PHRASE;
  }

  const api = Object.freeze({
    DEFAULT_WAKE_PHRASE,
    DEFAULT_WAKE_PHRASE_ENGLISH,
    LEGACY_WAKE_PHRASE,
    MIN_WORDS,
    MAX_WORDS,
    MAX_LENGTH,
    normalizeWakePhrase,
    defaultWakePhrase,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.NivuneWakePhrase = api;
})(typeof window !== "undefined" ? window : null);
