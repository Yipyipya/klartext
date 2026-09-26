const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  LATEST_RELEASE_API_URL,
  RELEASE_REPOSITORY,
  checkForUpdate,
  compareVersions,
  isOfficialReleaseUrl,
  parseLatestRelease,
} = require("../shared/release.ts");

const releaseUrl = (tag) => `https://github.com/${RELEASE_REPOSITORY}/releases/tag/${tag}`;
const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("Versionsvergleich folgt SemVer inklusive Vorabversionen", () => {
  assert.equal(compareVersions("1.0.0", "0.3.0"), 1);
  assert.equal(compareVersions("v1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.0-beta.2"), 1);
  assert.equal(compareVersions("1.0.0-beta.10", "1.0.0-beta.2"), 1);
  assert.equal(compareVersions("1.0.0-alpha.1", "1.0.0-beta.1"), -1);
  assert.equal(compareVersions("1.0.1", "1.0.0+build.5"), 1);
  assert.equal(compareVersions("1.0", "1.0.0"), null);
  assert.equal(compareVersions("latest", "1.0.0"), null);
});

test("nur Release-Seiten des festgelegten Repositorys gelten als offiziell", () => {
  assert.equal(isOfficialReleaseUrl(releaseUrl("v1.0.0")), true);
  assert.equal(isOfficialReleaseUrl(`http://github.com/${RELEASE_REPOSITORY}/releases/tag/v1.0.0`), false);
  assert.equal(isOfficialReleaseUrl("https://github.com/someone/else/releases/tag/v1.0.0"), false);
  assert.equal(isOfficialReleaseUrl(`https://github.com.evil.example/${RELEASE_REPOSITORY}/releases/tag/v1.0.0`), false);
  assert.equal(isOfficialReleaseUrl(`https://user:pw@github.com/${RELEASE_REPOSITORY}/releases/tag/v1.0.0`), false);
  assert.equal(isOfficialReleaseUrl("javascript:alert(1)"), false);
});

test("Release-Antwort wird streng geprüft und Notizen begrenzt", () => {
  const parsed = parseLatestRelease({
    tag_name: "v1.0.0",
    html_url: releaseUrl("v1.0.0"),
    body: "Neu\r\n".repeat(2000),
    published_at: "2026-10-01T10:00:00Z",
  });
  assert.equal(parsed.version, "1.0.0");
  assert.equal(parsed.notes.length, 4000);
  assert.doesNotMatch(parsed.notes, /\r/);
  assert.equal(parsed.publishedAt, "2026-10-01T10:00:00Z");
  assert.throws(() => parseLatestRelease({ tag_name: "v1.0.0", html_url: "https://evil.example/" }), /RELEASE_UNTRUSTED_URL/);
  assert.throws(() => parseLatestRelease({ tag_name: "nightly", html_url: releaseUrl("nightly") }), /RELEASE_INVALID_VERSION/);
  assert.throws(() => parseLatestRelease({ tag_name: "v1.1.0-rc.1", html_url: releaseUrl("v1.1.0-rc.1"), prerelease: true }), /RELEASE_NOT_STABLE/);
  assert.throws(() => parseLatestRelease(null), /RELEASE_INVALID_RESPONSE/);
});

test("Updateprüfung fragt nur die feste API ohne Redirects und Zugangsdaten ab", async () => {
  const calls = [];
  const result = await checkForUpdate({
    currentVersion: "1.0.0-beta.1",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { tag_name: "v1.0.0", html_url: releaseUrl("v1.0.0"), body: "Stabil" });
    },
  });
  assert.equal(result.state, "available");
  assert.equal(result.latest.version, "1.0.0");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, LATEST_RELEASE_API_URL);
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(Object.keys(calls[0].init.headers).some((name) => /authorization/i.test(name)), false);
});

test("ältere oder gleiche Veröffentlichung meldet aktuellen Stand", async () => {
  const fetch = async () => jsonResponse(200, { tag_name: "v0.3.0", html_url: releaseUrl("v0.3.0") });
  assert.equal((await checkForUpdate({ currentVersion: "1.0.0-beta.1", fetch })).state, "current");
  const same = async () => jsonResponse(200, { tag_name: "v1.0.0", html_url: releaseUrl("v1.0.0") });
  assert.equal((await checkForUpdate({ currentVersion: "1.0.0", fetch: same })).state, "current");
});

test("Fehlerfälle führen nie zu einem Download, sondern zu einem Fehlercode", async () => {
  const status = async (code) => (await checkForUpdate({ currentVersion: "1.0.0", fetch: async () => jsonResponse(code, {}) })).error;
  assert.equal(await status(404), "UPDATE_NO_RELEASE");
  assert.equal(await status(403), "UPDATE_RATE_LIMITED");
  assert.equal(await status(429), "UPDATE_RATE_LIMITED");
  assert.equal(await status(500), "UPDATE_HTTP_500");
  const network = await checkForUpdate({ currentVersion: "1.0.0", fetch: async () => { throw new TypeError("fetch failed"); } });
  assert.deepEqual(network, { state: "error", currentVersion: "1.0.0", error: "UPDATE_NETWORK" });
  const untrusted = await checkForUpdate({ currentVersion: "1.0.0", fetch: async () => jsonResponse(200, { tag_name: "v9.0.0", html_url: "https://evil.example/download" }) });
  assert.equal(untrusted.error, "RELEASE_UNTRUSTED_URL");
  const invalidJson = await checkForUpdate({ currentVersion: "1.0.0", fetch: async () => new Response("<html>", { status: 200 }) });
  assert.equal(invalidJson.error, "UPDATE_NETWORK");
});

test("Updateprüfung bricht nach Zeitlimit ab", async () => {
  const result = await checkForUpdate({
    currentVersion: "1.0.0",
    timeoutMs: 20,
    fetch: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });
  assert.equal(result.error, "UPDATE_TIMEOUT");
});

test("Desktop prüft Updates nur auf Befehl und öffnet nur offizielle Release-Seiten", () => {
  const main = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(main, /case "update-check": await runUpdateCheck\(\); break;/);
  assert.match(main, /sharedCore\.isOfficialReleaseUrl\(updateStatus\.latest\.url\)/);
  assert.equal((main.match(/runUpdateCheck\(/g) || []).length, 3, "nur Definition, Einstellungsaktion und Tray-Befehl");
  assert.doesNotMatch(main, /autoUpdater|electron-updater/);
});
