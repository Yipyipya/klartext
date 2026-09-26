const assert = require("node:assert/strict");
const test = require("node:test");

const {
  configureMediaPermissions,
  isTrustedAudioPermission,
} = require("../desktop/media-permissions");

test("only known Nivune renderers receive microphone access", () => {
  const pill = { name: "pill", getURL: () => "file:///app/pill.html" };
  const workspace = { name: "workspace", getURL: () => "file:///app/workspace.html" };
  const unknown = { name: "unknown", getURL: () => "file:///app/unknown.html" };
  const trusted = () => [pill, workspace, null];

  assert.equal(isTrustedAudioPermission(pill, "media", "file://", { mediaTypes: ["audio"] }, trusted), true);
  assert.equal(isTrustedAudioPermission(workspace, "media", "file:///app/workspace.html", { mediaType: "audio" }, trusted), true);
  assert.equal(isTrustedAudioPermission(unknown, "media", "file://", { mediaTypes: ["audio"] }, trusted), false);
  assert.equal(isTrustedAudioPermission(pill, "notifications", "file://", {}, trusted), false);
  assert.equal(isTrustedAudioPermission(pill, "media", "file://", { mediaTypes: ["video"] }, trusted), false);
  assert.equal(isTrustedAudioPermission(pill, "media", "file://", { mediaTypes: ["audio", "video"] }, trusted), false);
  assert.equal(isTrustedAudioPermission(pill, "media", "file://", { mediaTypes: ["unknown"] }, trusted), false);
  assert.equal(isTrustedAudioPermission(pill, "media", "file://", {}, trusted), false);
  assert.equal(isTrustedAudioPermission(pill, "media", "https://evil.example", { mediaTypes: ["audio"] }, trusted), false);
  assert.equal(isTrustedAudioPermission({ ...pill, getURL: () => "https://evil.example" }, "media", "file://", { mediaTypes: ["audio"] }, () => [{ ...pill, getURL: () => "https://evil.example" }]), false);
  assert.equal(isTrustedAudioPermission(pill, "media", "file://", { mediaTypes: ["audio"], isMainFrame: false }, trusted), false);
});

test("one shared session handler keeps pill and workspace permissions active", () => {
  const pill = { name: "pill", getURL: () => "file:///app/pill.html" };
  const workspace = { name: "workspace", getURL: () => "file:///app/workspace.html" };
  let checkHandler;
  let requestHandler;
  const session = {
    setPermissionCheckHandler(handler) { checkHandler = handler; },
    setPermissionRequestHandler(handler) { requestHandler = handler; },
  };

  configureMediaPermissions(session, () => [pill, workspace]);

  assert.equal(checkHandler(pill, "media", "file://", { mediaType: "audio" }), true);
  assert.equal(checkHandler(workspace, "media", "file://", { mediaType: "audio" }), true);
  let granted = null;
  requestHandler(pill, "media", (value) => { granted = value; }, { mediaTypes: ["audio"], requestingUrl: "file:///app/pill.html" });
  assert.equal(granted, true);
  requestHandler({ name: "settings", getURL: () => "file:///app/settings.html" }, "media", (value) => { granted = value; }, { mediaTypes: ["audio"], requestingUrl: "file:///app/settings.html" });
  assert.equal(granted, false);
});
