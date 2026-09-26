const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

esbuild.buildSync({
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  globalName: "NivuneTransformers",
  target: ["chrome130"],
  entryPoints: [path.join(__dirname, "whisper-renderer.js")],
  outfile: path.join(__dirname, "whisper-bundle.js"),
  logLevel: "info",
});

for (const file of [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
]) {
  fs.copyFileSync(
    require.resolve(`onnxruntime-web/${file}`),
    path.join(__dirname, file),
  );
}

