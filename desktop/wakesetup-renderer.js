import rustpotterInit, { WakewordRefCreator } from "rustpotter-web";

const phraseRules = window.NivuneWakePhrase;
const query = new URLSearchParams(window.location.search);
const interfaceLanguage = query.get("lang") === "en" ? "en" : "de";
const initialPhrase = phraseRules.normalizeWakePhrase(query.get("phrase")) || phraseRules.defaultWakePhrase(interfaceLanguage);
const PHRASES = [
  { key: "start", label: initialPhrase },
];
const SAMPLE_COUNT = 5;
const RECORD_MS = 2_800;
const t = (german, english) => interfaceLanguage === "en" ? english : german;
window.klartextI18n?.setLanguage(interfaceLanguage);

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let processorNode = null;
let silentGain = null;
let chunks = [];
let phaseIndex = 0;
let recording = false;
let wasmReady = false;
const samplesByPhrase = new Map(PHRASES.map((phrase) => [phrase.key, []]));

const phraseInput = document.getElementById("wake-phrase");
const phraseHint = document.getElementById("phrase-hint");
const instructionEl = document.getElementById("instruction");
const progressEl = document.getElementById("progress");
const recordButton = document.getElementById("record");
const retryButton = document.getElementById("retry");
const statusEl = document.getElementById("status");

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function render() {
  const phrase = PHRASES[phaseIndex];
  const count = samplesByPhrase.get(phrase.key).length;
  const normalizedPhrase = phraseRules.normalizeWakePhrase(phraseInput.value);
  if (normalizedPhrase) phrase.label = normalizedPhrase;
  phraseInput.disabled = recording || count > 0;
  phraseHint.textContent = normalizedPhrase
    ? t("Zwei bis fünf kurze Wörter funktionieren am zuverlässigsten. „Diktat starten“ ist nur ein Vorschlag.", "Two to five short words work most reliably. “Start dictation” is only a suggestion.")
    : t("Bitte gib zwei bis fünf Wörter ohne Sonderzeichen ein.", "Enter two to five words without special characters.");
  phraseHint.classList.toggle("error", !normalizedPhrase);
  instructionEl.textContent = t("Sprich den Startbefehl fünfmal natürlich ein. Jede Aufnahme wird nur lokal verarbeitet.", "Say the start phrase naturally five times. Each recording is processed only on this device.");
  progressEl.innerHTML = Array.from({ length: SAMPLE_COUNT }, (_, index) =>
    `<span class="dot ${index < count ? "done" : ""}">${index < count ? "✓" : index + 1}</span>`
  ).join("");
  recordButton.textContent = recording
    ? t("Jetzt sprechen …", "Speak now …")
    : count >= SAMPLE_COUNT
      ? t("Wird erstellt …", "Creating …")
      : t(`Aufnahme ${count + 1} starten`, `Start recording ${count + 1}`);
  recordButton.disabled = recording || count >= SAMPLE_COUNT || !wasmReady || !normalizedPhrase;
  retryButton.disabled = recording || count === 0;
}

function concatChunks(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Float32Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function trimToSpeech(input, sampleRate) {
  const frameSize = Math.max(1, Math.floor(sampleRate * 0.02));
  const levels = [];
  for (let offset = 0; offset < input.length; offset += frameSize) {
    let energy = 0;
    const end = Math.min(input.length, offset + frameSize);
    for (let index = offset; index < end; index += 1) energy += input[index] * input[index];
    levels.push(Math.sqrt(energy / Math.max(1, end - offset)));
  }
  const noise = percentile(levels, 0.25);
  const threshold = Math.max(0.007, noise * 2.6);
  let first = levels.findIndex((level) => level >= threshold);
  let last = levels.length - 1;
  while (last >= 0 && levels[last] < threshold) last -= 1;
  if (first < 0 || last < first) throw new Error(t("Keine deutliche Stimme erkannt. Bitte etwas näher am Mikrofon sprechen.", "No clear voice detected. Please move a little closer to the microphone."));
  first = Math.max(0, first - 5);
  last = Math.min(levels.length - 1, last + 10);
  const trimmed = input.slice(first * frameSize, Math.min(input.length, (last + 1) * frameSize));
  const seconds = trimmed.length / sampleRate;
  if (seconds < 0.45) throw new Error(t("Die Aufnahme war zu kurz. Bitte den ganzen Befehl sprechen.", "The recording was too short. Please say the full phrase."));
  if (seconds > 2.5) throw new Error(t("Die Aufnahme war zu lang. Bitte nur den angezeigten Befehl sprechen.", "The recording was too long. Please say only the phrase shown."));
  return trimmed;
}

function encodeWavFloat32(input, sampleRate) {
  const buffer = new ArrayBuffer(44 + input.length * 4);
  const view = new DataView(buffer);
  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + input.length * 4, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 32, true);
  writeAscii(36, "data");
  view.setUint32(40, input.length * 4, true);
  for (let index = 0; index < input.length; index += 1) view.setFloat32(44 + index * 4, input[index], true);
  return buffer;
}

async function ensureMicrophone() {
  if (mediaStream?.active) return;
  audioContext = new AudioContext();
  await audioContext.resume();
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  processorNode = audioContext.createScriptProcessor(2048, 1, 1);
  silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  processorNode.addEventListener("audioprocess", ({ inputBuffer }) => {
    if (recording) chunks.push(new Float32Array(inputBuffer.getChannelData(0)));
  });
  sourceNode.connect(processorNode);
  processorNode.connect(silentGain);
  silentGain.connect(audioContext.destination);
}

async function closeMicrophone() {
  recording = false;
  try { sourceNode?.disconnect(); } catch { /* bereits getrennt */ }
  try { processorNode?.disconnect(); } catch { /* bereits getrennt */ }
  try { silentGain?.disconnect(); } catch { /* bereits getrennt */ }
  mediaStream?.getTracks().forEach((track) => track.stop());
  try { await audioContext?.close(); } catch { /* nicht kritisch */ }
  mediaStream = null;
  audioContext = null;
  sourceNode = null;
  processorNode = null;
  silentGain = null;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function createModel(phrase) {
  const creator = WakewordRefCreator.new(phrase.label);
  try {
    samplesByPhrase.get(phrase.key).forEach((wav, index) => {
      creator.addFile(`${phrase.key}-${index + 1}.wav`, new Uint8Array(wav));
    });
    return creator.saveToBytes();
  } finally {
    creator.free();
  }
}

async function finishSetup() {
  setStatus(t("Persönliche Sprachmodelle werden erstellt …", "Creating personal voice models …"));
  render();
  try {
    const models = PHRASES.map((phrase) => ({
      key: phrase.key,
      label: phrase.label,
      base64: bytesToBase64(createModel(phrase)),
    }));
    await closeMicrophone();
    const result = await window.klartext.saveWakeModels(models);
    if (!result?.ok) throw new Error(result?.error || t("Sprachmodelle konnten nicht gespeichert werden", "Voice models could not be saved"));
    setStatus(t("Fertig. Dein persönlicher Startbefehl ist bereit.", "Done. Your personal start phrase is ready."), "success");
  } catch (error) {
    setStatus(String(error?.message || error), "error");
    render();
  }
}

async function recordSample() {
  if (recording) return;
  const normalizedPhrase = phraseRules.normalizeWakePhrase(phraseInput.value);
  if (!normalizedPhrase) {
    setStatus(t("Bitte wähle zuerst einen gültigen Startbefehl.", "Choose a valid start phrase first."), "error");
    render();
    return;
  }
  PHRASES[phaseIndex].label = normalizedPhrase;
  phraseInput.value = normalizedPhrase;
  recording = true;
  chunks = [];
  render();
  setStatus(t("Sprich den angezeigten Befehl jetzt einmal deutlich aus.", "Now say the displayed phrase clearly once."), "listening");
  try {
    await ensureMicrophone();
    await new Promise((resolve) => setTimeout(resolve, RECORD_MS));
    recording = false;
    const raw = concatChunks(chunks);
    const trimmed = trimToSpeech(raw, audioContext.sampleRate);
    const phrase = PHRASES[phaseIndex];
    samplesByPhrase.get(phrase.key).push(encodeWavFloat32(trimmed, audioContext.sampleRate));
    setStatus(t("Aufnahme erkannt.", "Recording recognized."), "success");
    render();
    if (samplesByPhrase.get(phrase.key).length >= SAMPLE_COUNT) {
      await finishSetup();
    }
  } catch (error) {
    recording = false;
    setStatus(String(error?.message || error), "error");
    render();
  }
}

recordButton.addEventListener("click", recordSample);
phraseInput.value = initialPhrase;
phraseInput.addEventListener("input", render);
retryButton.addEventListener("click", () => {
  const records = samplesByPhrase.get(PHRASES[phaseIndex].key);
  records.pop();
  setStatus(t("Letzte Aufnahme entfernt.", "Last recording removed."));
  render();
});
document.getElementById("cancel").addEventListener("click", () => window.klartext.closeWakeSetup());
window.addEventListener("beforeunload", () => {
  closeMicrophone();
});

(async () => {
  render();
  try {
    await rustpotterInit(new URL("./rustpotter-creator.wasm", window.location.href));
    wasmReady = true;
    setStatus(t("Bereit. Starte mit der ersten Aufnahme.", "Ready. Start with the first recording."));
  } catch (error) {
    setStatus(t(`Lokale Spracherkennung konnte nicht geladen werden: ${error?.message || error}`, `Local voice detection could not be loaded: ${error?.message || error}`), "error");
  }
  render();
})();
