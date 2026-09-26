const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();

test("source packages declare the project MIT license", () => {
  const rootPackage = require(path.join(root, "package.json"));
  const desktopPackage = require(path.join(root, "desktop", "package.json"));
  const rootLock = require(path.join(root, "package-lock.json"));
  const desktopLock = require(path.join(root, "desktop", "package-lock.json"));

  assert.equal(rootPackage.license, "MIT");
  assert.equal(desktopPackage.license, "MIT");
  assert.equal(rootLock.packages[""].license, "MIT");
  assert.equal(desktopLock.packages[""].license, "MIT");
  assert.match(fs.readFileSync(path.join(root, "LICENSE"), "utf8"), /^MIT License\n/);
});

test("desktop package carries project and direct runtime notices", () => {
  const desktopPackage = require(path.join(root, "desktop", "package.json"));
  const resources = new Map(
    desktopPackage.build.extraResources.map(({ from, to }) => [from, to]),
  );

  const required = new Map([
    ["../LICENSE", "LICENSE.txt"],
    ["../THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md"],
    ["node_modules/@huggingface/transformers/LICENSE", "licenses/transformers-Apache-2.0.txt"],
    ["../third_party/onnxruntime-LICENSE.txt", "licenses/onnxruntime-MIT.txt"],
    ["node_modules/electron/LICENSE", "licenses/electron-MIT.txt"],
    ["node_modules/rustpotter-web/LICENSE", "licenses/rustpotter-web-Apache-2.0.txt"],
    ["node_modules/rustpotter-worklet/LICENSE", "licenses/rustpotter-worklet-Apache-2.0.txt"],
  ]);

  for (const [source, destination] of required) {
    assert.equal(resources.get(source), destination);
    assert.equal(
      fs.existsSync(path.resolve(root, "desktop", source)),
      true,
      `missing notice source: ${source}`,
    );
  }
});

test("open-source release documents and name gate are present", () => {
  for (const file of [
    "README.md",
    "README.de.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    "docs/ADAPTERS.md",
    "docs/NAME_CLEARANCE.md",
    "docs/RIGHTS_INVENTORY.md",
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `missing ${file}`);
  }

  const clearance = fs.readFileSync(path.join(root, "docs", "NAME_CLEARANCE.md"), "utf8");
  assert.match(clearance, /DPMAregister/);
  assert.match(clearance, /TMview/);
  assert.match(clearance, /Decision: keep or rename/);
});
