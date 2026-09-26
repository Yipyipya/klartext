const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  OFFLINE_SHELL_CACHE,
  inspectOfflineReadiness,
  remainingStorageBytes,
} = require("../lib/offline.ts");

test("Offline-App-Hülle cached nur öffentliche eigene Laufzeitressourcen", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");
  assert.equal(OFFLINE_SHELL_CACHE, "nivune-shell-v2");
  assert.match(worker, /const SHELL_CACHE = "nivune-shell-v2"/);
  assert.match(worker, /const APP_PATH = "\/app"/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.match(worker, /no-store\|private/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.doesNotMatch(worker, /openai|api\.groq|anthropic|gemini/i);
});

test("Speicherdiagnose rechnet Restplatz defensiv", async () => {
  assert.equal(remainingStorageBytes({ quotaBytes: 1000, usageBytes: 350 }), 650);
  assert.equal(remainingStorageBytes({ quotaBytes: 100, usageBytes: 120 }), 0);
  assert.equal(remainingStorageBytes({ quotaBytes: null, usageBytes: 0 }), null);
  assert.deepEqual(await inspectOfflineReadiness(), {
    shell: "unsupported",
    cacheAvailable: false,
    persistent: null,
    usageBytes: null,
    quotaBytes: null,
  });
});

test("Offline-Hülle cached nur den Arbeitsbereich und lässt die Website online", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");
  const context = { self: { location: { origin: "https://nivune.test" }, addEventListener: () => {} } };
  const vm = require("node:vm");
  vm.runInNewContext(`${worker}\nthis.isShellPath = isShellPath; this.isLegacyStart = isLegacyStart;`, context);
  const url = (pathname) => new URL(pathname, "https://nivune.test");
  assert.equal(context.isShellPath(url("/app")), true);
  assert.equal(context.isShellPath(url("/_next/static/chunk.js")), true);
  assert.equal(context.isShellPath(url("/")), false, "die Website wird nicht als App-Hülle gecacht");
  assert.equal(context.isShellPath(url("/en")), false);
  assert.equal(context.isShellPath(url("/datenschutz")), false);
  assert.equal(context.isLegacyStart(url("/")), true);
  assert.match(worker, /isLegacyStart\(url\)\) \{[\s\S]*?fetch\(request\)\.catch/);
});
