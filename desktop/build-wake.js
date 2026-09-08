const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const common = {
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  target: ["chrome130"],
  logLevel: "info",
};

esbuild.buildSync({
  ...common,
  entryPoints: [path.join(__dirname, "wake-renderer.js")],
  outfile: path.join(__dirname, "wake-bundle.js"),
});

esbuild.buildSync({
  ...common,
  entryPoints: [path.join(__dirname, "wakesetup-renderer.js")],
  outfile: path.join(__dirname, "wakesetup-bundle.js"),
});

const copies = [
  ["rustpotter-worklet/dist/rustpotter-worker.min.js", "rustpotter-worker.js"],
  ["rustpotter-worklet/dist/rustpotter-worklet.min.js", "rustpotter-worklet.js"],
  ["rustpotter-worklet/dist/rustpotter_wasm_bg.wasm", "rustpotter-runtime.wasm"],
  ["rustpotter-web/rustpotter_wasm_bg.wasm", "rustpotter-creator.wasm"],
  ["rustpotter-worklet/LICENSE", "rustpotter-LICENSE.txt"],
];

for (const [modulePath, outputName] of copies) {
  fs.copyFileSync(require.resolve(modulePath), path.join(__dirname, outputName));
}
