import rustpotterInit, { WakewordRefCreator } from "rustpotter-web";

const PHRASES = [
  { key: "start", label: "Hey Klartext" },
];
const SAMPLE_COUNT = 5;
const RECORD_MS = 2_800;

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

const phraseEl = document.getElementById("phrase");
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
  phraseEl.textContent = `„${phrase.label}“`;
  instructionEl.textContent = "Sprich den Startbefehl fünfmal natürlich ein. Jede Aufnahme wird nur lokal verarbeitet.";
  progressEl.innerHTML = Array.from({ length: SAMPLE_COUNT }, (_, index) =>
    `<span class="dot ${index < count ? "done" : ""}">${index < count ? "✓" : index + 1}</span>`
  ).join("");
  recordButton.textContent = recording
    ? "Jetzt sprechen …"
    : count >= SAMPLE_COUNT
      ? "Wird erstellt …"
      : `Aufnahme ${count + 1} starten`;
  recordButton.disabled = recording || count >= SAMPLE_COUNT || !wasmReady;
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
  if (first < 0 || last < first) throw new Error("Keine deutliche Stimme erkannt. Bitte etwas näher am Mikrofon sprechen.");
  first = Math.max(0, first - 5);
  last = Math.min(levels.length - 1, last + 10);
  const trimmed = input.slice(first * frameSize, Math.min(input.length, (last + 1) * frameSize));
  const seconds = trimmed.length / sampleRate;
  if (seconds < 0.45) throw new Error("Die Aufnahme war zu kurz. Bitte den ganzen Befehl sprechen.");
  if (seconds > 2.5) throw new Error("Die Aufnahme war zu lang. Bitte nur den angezeigten Befehl sprechen.");
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
  setStatus("Persönliche Sprachmodelle werden erstellt …");
  render();
  try {
    const models = PHRASES.map((phrase) => ({
      key: phrase.key,
      base64: bytesToBase64(createModel(phrase)),
    }));
    await closeMicrophone();
    const result = await window.klartext.saveWakeModels(models);
    if (!result?.ok) throw new Error(result?.error || "Sprachmodelle konnten nicht gespeichert werden");
    setStatus("Fertig. Sprachaktivierung ist jetzt eingeschaltet.", "success");
  } catch (error) {
    setStatus(String(error?.message || error), "error");
    render();
  }
}

async function recordSample() {
  if (recording) return;
  recording = true;
  chunks = [];
  render();
  setStatus("Sprich den angezeigten Befehl jetzt einmal deutlich aus.", "listening");
  try {
    await ensureMicrophone();
    await new Promise((resolve) => setTimeout(resolve, RECORD_MS));
    recording = false;
    const raw = concatChunks(chunks);
    const trimmed = trimToSpeech(raw, audioContext.sampleRate);
    const phrase = PHRASES[phaseIndex];
    samplesByPhrase.get(phrase.key).push(encodeWavFloat32(trimmed, audioContext.sampleRate));
    setStatus("Aufnahme erkannt.", "success");
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
retryButton.addEventListener("click", () => {
  const records = samplesByPhrase.get(PHRASES[phaseIndex].key);
  records.pop();
  setStatus("Letzte Aufnahme entfernt.");
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
    setStatus("Bereit. Starte mit der ersten Aufnahme.");
  } catch (error) {
    setStatus(`Lokale Spracherkennung konnte nicht geladen werden: ${error?.message || error}`, "error");
  }
  render();
})();
