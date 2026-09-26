const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("build manifest binds an artifact to its bytes and SHA-256", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "klartext-manifest-"));
  const artifact = path.join(temporaryDirectory, "artifact.bin");
  const output = path.join(temporaryDirectory, "manifest.json");
  const content = Buffer.from("klartext-build-artifact\n", "utf8");
  fs.writeFileSync(artifact, content);

  const result = spawnSync(process.execPath, [
    path.join(process.cwd(), "scripts", "create-build-manifest.cjs"),
    "--output",
    output,
    artifact,
  ], { cwd: process.cwd(), encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.nodeVersion, process.version);
  assert.equal(manifest.artifacts.length, 1);
  assert.equal(manifest.artifacts[0].path, "artifact.bin");
  assert.equal(manifest.artifacts[0].bytes, content.length);
  assert.equal(
    manifest.artifacts[0].sha256,
    crypto.createHash("sha256").update(content).digest("hex"),
  );
});

test("build manifest rejects a missing artifact list", () => {
  const result = spawnSync(process.execPath, [
    path.join(process.cwd(), "scripts", "create-build-manifest.cjs"),
    "--output",
    path.join(os.tmpdir(), "unused-klartext-manifest.json"),
  ], { cwd: process.cwd(), encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
});
