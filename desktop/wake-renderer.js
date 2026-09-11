import rustpotterInit, {
  Rustpotter,
  RustpotterConfig,
  SampleFormat,
  ScoreMode,
  VADMode,
} from "rustpotter-web-slim";

const commandGate = window.KlartextWakeController.createCommandGate();
let detector = null;
let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let processorNode = null;
let analyserNode = null;
let silentGainNode = null;
let confirmationTimer = null;
let generation = 0;
let noiseFloor = 0.004;
let frameBuffer = new Float32Array(0);
let wasmReadyPromise = null;
let currentlyQuiet = true;
let quietStartedAt = Date.now();
let quietBeforeCurrentSpeechMs = Number.POSITIVE_INFINITY;

function describeError(error) {
  const message = String(error?.message || error || "Unbekannter Wake-Word-Fehler");
  if (/NotAllowed|Permission|denied|Mikrofon/i.test(message)) {
    return "Mikrofonzugriff für Klartext erlauben";
  }
  if (/wakeword|model|Sprachmodell/i.test(message)) {
    return "Sprachmodell bitte neu einlernen";
  }
  return message.slice(0, 180);
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function createDetectorConfig(sampleRate, recording) {
  const sensitivity = window.KlartextWakeController.detectionSensitivity(recording);
  const config = RustpotterConfig.new();
  config.setSampleRate(sampleRate);
  config.setSampleFormat(SampleFormat.f32);
  config.setChannels(1);
  config.setMinScores(sensitivity.minScores);
  config.setThreshold(sensitivity.threshold);
  config.setAveragedThreshold(sensitivity.averagedThreshold);
  config.setScoreRef(0.22);
  config.setBandSize(6);
  config.setEager(false);
  config.setScoreMode(ScoreMode.p50);
  config.setVADMode(VADMode.easy);
  config.setGainNormalizerEnabled(true);
  config.setMinGain(0.25);
  config.setMaxGain(2.5);
  config.setBandPassEnabled(false);
  config.setBandPassLowCutoff(85);
  config.setBandPassHighCutoff(400);
  return config;
}

function updateSensitivity(recording) {
  if (!detector || !audioContext) return;
  const config = createDetectorConfig(audioContext.sampleRate, recording);
  try {
    detector.updateConfig(config);
  } finally {
    config.free();
  }
}

function readDetection(value) {
  const scoreNames = value.getScoreNames().split("||");
  const rawScores = value.getScores();
  const scores = {};
  scoreNames.forEach((name, index) => {
    if (name) scores[name] = rawScores[index];
  });
  return {
    name: value.getName(),
    avgScore: value.getAvgScore(),
    score: value.getScore(),
    counter: value.getCounter(),
    gain: value.getGain(),
    scores,
  };
}

function handleDetection(value) {
  if (!value) return;
  let detection;
  try {
    detection = readDetection(value);
  } finally {
    value.free();
  }
  const action = window.KlartextWakeController.keywordAction(
    detection.name === "start"
      ? window.KlartextWakeController.START_LABEL
      : detection.name === "stop"
        ? window.KlartextWakeController.STOP_LABEL
        : detection.name,
    commandGate.isRecording()
  );
  if (action !== "ignore" && !window.KlartextWakeController.hasRequiredLeadIn(action, quietBeforeCurrentSpeechMs)) {
    window.klartextWake.candidate(action, "rejected", detection);
    return;
  }
  if (action !== "ignore" && commandGate.detect(action, detection)) {
    window.klartextWake.candidate(action, "detected", detection);
  }
}

function processAudio(input) {
  if (!detector) return;
  const combined = new Float32Array(frameBuffer.length + input.length);
  combined.set(frameBuffer);
  combined.set(input, frameBuffer.length);
  const frameSize = detector.getSamplesPerFrame();
  let offset = 0;
  while (offset + frameSize <= combined.length) {
    handleDetection(detector.processF32(combined.subarray(offset, offset + frameSize)));
    offset += frameSize;
  }
  frameBuffer = combined.slice(offset);
}

function observeCommandConfirmation() {
  if (!analyserNode) return;
  const samples = new Float32Array(analyserNode.fftSize);
  analyserNode.getFloatTimeDomainData(samples);
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  const rms = Math.sqrt(energy / samples.length);

  if (rms < 0.03) {
    const weight = rms < noiseFloor ? 0.08 : 0.01;
    noiseFloor = Math.max(0.0015, noiseFloor * (1 - weight) + rms * weight);
  }
  const quietThreshold = Math.min(0.03, Math.max(0.006, noiseFloor * 1.8));
  const quiet = rms < quietThreshold;
  const currentTime = Date.now();
  if (quiet && !currentlyQuiet) {
    currentlyQuiet = true;
    quietStartedAt = currentTime;
  } else if (!quiet && currentlyQuiet) {
    currentlyQuiet = false;
    quietBeforeCurrentSpeechMs = currentTime - quietStartedAt;
  }
  const result = commandGate.observeQuiet(quiet);
  if (!result) return;
  window.klartextWake.candidate(result.action, result.state, result.details);
  if (result.state === "confirmed") {
    window.klartextWake.detected(result.action, result.details);
  }
}

async function stopListening() {
  clearInterval(confirmationTimer);
  confirmationTimer = null;
  commandGate.setRecording(false);
  try { sourceNode?.disconnect(); } catch { /* bereits getrennt */ }
  try { processorNode?.disconnect(); } catch { /* bereits getrennt */ }
  try { analyserNode?.disconnect(); } catch { /* bereits getrennt */ }
  try { silentGainNode?.disconnect(); } catch { /* bereits getrennt */ }
  try { detector?.free(); } catch { /* nicht kritisch */ }
  mediaStream?.getTracks().forEach((track) => track.stop());
  try { await audioContext?.close(); } catch { /* nicht kritisch */ }
  detector = null;
  audioContext = null;
  mediaStream = null;
  sourceNode = null;
  processorNode = null;
  analyserNode = null;
  silentGainNode = null;
  frameBuffer = new Float32Array(0);
}

async function configure(config) {
  const currentGeneration = ++generation;
  await stopListening();
  if (!config?.enabled) {
    window.klartextWake.status("disabled", "Sprachaktivierung ist ausgeschaltet");
    return;
  }

  window.klartextWake.status("preparing", "Persönliche Sprachbefehle werden geladen …");
  try {
    wasmReadyPromise ||= rustpotterInit(decodeBase64(config.wasmBase64));
    await wasmReadyPromise;
    window.klartextWake.status("preparing", "Mikrofon wird verbunden …");

    // Erst den Mikrofon-Stream öffnen. Auf macOS kann AudioContext.resume()
    // bei einem unsichtbaren Hintergrundfenster sonst auf eine Aktivierung
    // warten, obwohl der Mikrofonzugriff bereits erlaubt ist.
    const nextStream = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
      video: false,
    });

    const nextAudioContext = new AudioContext();
    const detectorConfig = createDetectorConfig(nextAudioContext.sampleRate, false);
    const nextDetector = Rustpotter.new(detectorConfig);
    detectorConfig.free();
    for (const keyword of config.keywords || []) {
      nextDetector.addWakeword(keyword.key, decodeBase64(keyword.base64));
    }

    const nextSource = nextAudioContext.createMediaStreamSource(nextStream);
    const nextAnalyser = nextAudioContext.createAnalyser();
    nextAnalyser.fftSize = 1024;
    nextAnalyser.smoothingTimeConstant = 0.2;
    const nextProcessor = nextAudioContext.createScriptProcessor(4096, 1, 1);
    const nextSilentGain = nextAudioContext.createGain();
    nextSilentGain.gain.value = 0;
    nextProcessor.addEventListener("audioprocess", ({ inputBuffer }) => {
      processAudio(new Float32Array(inputBuffer.getChannelData(0)));
    });
    nextSource.connect(nextProcessor);
    nextProcessor.connect(nextSilentGain);
    nextSilentGain.connect(nextAudioContext.destination);
    nextSource.connect(nextAnalyser);
    await nextAudioContext.resume();

    if (currentGeneration !== generation) {
      nextSource.disconnect();
      nextProcessor.disconnect();
      nextSilentGain.disconnect();
      nextStream.getTracks().forEach((track) => track.stop());
      nextDetector.free();
      await nextAudioContext.close();
      return;
    }

    detector = nextDetector;
    audioContext = nextAudioContext;
    mediaStream = nextStream;
    sourceNode = nextSource;
    processorNode = nextProcessor;
    analyserNode = nextAnalyser;
    silentGainNode = nextSilentGain;
    frameBuffer = new Float32Array(0);
    noiseFloor = 0.004;
    currentlyQuiet = true;
    quietStartedAt = Date.now();
    quietBeforeCurrentSpeechMs = Number.POSITIVE_INFINITY;
    confirmationTimer = setInterval(observeCommandConfirmation, 50);
    window.klartextWake.status("ready", "Bereit für „Hey Klartext“");
  } catch (error) {
    if (currentGeneration !== generation) return;
    wasmReadyPromise = null;
    await stopListening();
    window.klartextWake.status("error", describeError(error));
  }
}

window.klartextWake.onConfigure(configure);
window.klartextWake.onRecordingState((active) => {
  commandGate.setRecording(active);
  try {
    updateSensitivity(active);
  } catch (error) {
    window.klartextWake.status("error", describeError(error));
  }
});
window.addEventListener("beforeunload", () => { stopListening(); });
window.klartextWake.ready();
