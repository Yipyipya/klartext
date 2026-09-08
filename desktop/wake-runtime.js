const path = require("path");

const WAKE_MODEL_SPECS = [
  { key: "start", label: "Hey Klartext", fileName: "hey-klartext.rpw" },
  { key: "stop", label: "Klartext fertig", fileName: "klartext-fertig.rpw" },
];

const MIN_MODEL_BYTES = 128;
const MAX_MODEL_BYTES = 5_000_000;

function decodeModel(base64) {
  if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
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
  const models = [];
  for (const spec of WAKE_MODEL_SPECS) {
    const data = await readUsableModel(fsPromises, path.join(modelDir, spec.fileName));
    if (!data) return null;
    models.push({ key: spec.key, label: spec.label, base64: data.toString("base64") });
  }
  return models;
}

async function saveEnrolledWakeModels({ fsPromises, modelDir, models }) {
  const supplied = new Map((Array.isArray(models) ? models : []).map((model) => [model?.key, model]));
  const decoded = WAKE_MODEL_SPECS.map((spec) => {
    const model = supplied.get(spec.key);
    if (!model) throw new Error(`Sprachmodell für „${spec.label}“ fehlt`);
    return { ...spec, data: decodeModel(model.base64) };
  });

  await fsPromises.mkdir(modelDir, { recursive: true });
  for (const model of decoded) {
    await fsPromises.writeFile(path.join(modelDir, model.fileName), model.data, { mode: 0o600 });
  }
  return decoded.map(({ key, label, data }) => ({ key, label, base64: data.toString("base64") }));
}

async function removeEnrolledWakeModels({ fsPromises, modelDir }) {
  await Promise.all(WAKE_MODEL_SPECS.map(async (spec) => {
    try {
      await fsPromises.unlink(path.join(modelDir, spec.fileName));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }));
}

module.exports = {
  WAKE_MODEL_SPECS,
  MIN_MODEL_BYTES,
  MAX_MODEL_BYTES,
  decodeModel,
  readUsableModel,
  loadEnrolledWakeModels,
  saveEnrolledWakeModels,
  removeEnrolledWakeModels,
};
