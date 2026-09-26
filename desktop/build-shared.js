const esbuild = require("esbuild");
const path = require("path");

esbuild.buildSync({
  bundle: true,
  minify: false,
  platform: "node",
  format: "cjs",
  target: ["node22"],
  entryPoints: [path.join(__dirname, "shared-entry.ts")],
  outfile: path.join(__dirname, "shared-core.cjs"),
  logLevel: "info",
});

