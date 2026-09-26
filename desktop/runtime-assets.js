const REQUIRED_LOCAL_RUNTIME_FILES = Object.freeze([
  "shared-core.cjs",
  "whisper-bundle.js",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
]);

function inspectLocalRuntimeAssets(fs, basePath) {
  const missing = REQUIRED_LOCAL_RUNTIME_FILES.filter((file) => !fs.existsSync(require("path").join(basePath, file)));
  return { ready: missing.length === 0, missing };
}

module.exports = { REQUIRED_LOCAL_RUNTIME_FILES, inspectLocalRuntimeAssets };
