const path = require("path");
const { DEFAULT_WAKE_PHRASE, LEGACY_WAKE_PHRASE, normalizeWakePhrase } = require("./wake-phrase");

const WAKE_MODEL_SPECS = [
  { key: "start", label: DEFAULT_WAKE_PHRASE, fileName: "hey-klartext.rpw" },
];
const LEGACY_WAKE_MODEL_FILES = ["klartext-fertig.rpw"];
const WAKE_PHRASE_METADATA_FILE = "wake-phrase.json";

const MIN_MODEL_BYTES = 128;
const MAX_MODEL_BYTES = 5_000_000;
const MAX_MODEL_BASE64_CHARS = Math.ceil(MAX_MODEL_BYTES / 3) * 4;

function decodeModel(base64) {
  if (typeof base64 !== "string" || base64.length > MAX_MODEL_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("Ungültiges Sprachmodell");
  }
  const data = Buffer.from(base64, "base64");
  if (data.byteLength < MIN_MODEL_BYTES || data.byteLength > MAX_MODEL_BYTES) {
    throw new Error("Ungültige Größe des Sprachmodells");
  }
  return data;
}

async function readUsableModel(fsPromises, filePath) {
  try {
    const data = await fsPromises.readFile(filePath);
    return data.byteLength >= MIN_MODEL_BYTES && data.byteLength <= MAX_MODEL_BYTES ? data : null;
  } catch {
    return null;
  }
}

async function loadEnrolledWakeModels({ fsPromises, modelDir }) {
  let phrase = LEGACY_WAKE_PHRASE;
  try {
    const metadata = JSON.parse(await fsPromises.readFile(path.join(modelDir, WAKE_PHRASE_METADATA_FILE), "utf8"));
    phrase = normalizeWakePhrase(metadata?.schemaVersion === 1 ? metadata.phrase : "") || LEGACY_WAKE_PHRASE;
  } catch {
    // Modelle aus älteren Versionen hatten noch keine separate Phrasenmetadatei.
  }
  const models = [];
  for (const spec of WAKE_MODEL_SPECS) {
    const data = await readUsableModel(fsPromises, path.join(modelDir, spec.fileName));
    if (!data) return null;
    models.push({ key: spec.key, label: phrase, base64: data.toString("base64") });
  }
  return models;
}

async function saveEnrolledWakeModels({ fsPromises, modelDir, models }) {
  const supplied = new Map((Array.isArray(models) ? models : []).map((model) => [model?.key, model]));
  const decoded = WAKE_MODEL_SPECS.map((spec) => {
    const model = supplied.get(spec.key);
    if (!model) throw new Error(`Sprachmodell für „${spec.label}“ fehlt`);
    const label = normalizeWakePhrase(model.label);
    if (!label) throw new Error("Der Startbefehl muss aus zwei bis fünf kurzen Wörtern bestehen");
    return { ...spec, label, data: decodeModel(model.base64) };
  });

  await fsPromises.mkdir(modelDir, { recursive: true });
  for (const model of decoded) {
    const target = path.join(modelDir, model.fileName);
    const pending = `${target}.next`;
    await fsPromises.writeFile(pending, model.data, { mode: 0o600 });
    await fsPromises.rename(pending, target);
  }
  const metadataPath = path.join(modelDir, WAKE_PHRASE_METADATA_FILE);
  const pendingMetadataPath = `${metadataPath}.next`;
  await fsPromises.writeFile(pendingMetadataPath, JSON.stringify({ schemaVersion: 1, phrase: decoded[0].label }), { encoding: "utf8", mode: 0o600 });
  await fsPromises.rename(pendingMetadataPath, metadataPath);
  return decoded.map(({ key, label, data }) => ({ key, label, base64: data.toString("base64") }));
}

async function removeEnrolledWakeModels({ fsPromises, modelDir }) {
  const modelFiles = WAKE_MODEL_SPECS.flatMap((spec) => [spec.fileName, `${spec.fileName}.next`]);
  const fileNames = [...modelFiles, ...LEGACY_WAKE_MODEL_FILES, WAKE_PHRASE_METADATA_FILE, `${WAKE_PHRASE_METADATA_FILE}.next`];
  await Promise.all(fileNames.map(async (fileName) => {
    try {
      await fsPromises.unlink(path.join(modelDir, fileName));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }));
}

module.exports = {
  WAKE_MODEL_SPECS,
  WAKE_PHRASE_METADATA_FILE,
  MIN_MODEL_BYTES,
  MAX_MODEL_BYTES,
  MAX_MODEL_BASE64_CHARS,
  decodeModel,
  readUsableModel,
  loadEnrolledWakeModels,
  saveEnrolledWakeModels,
  removeEnrolledWakeModels,
};
