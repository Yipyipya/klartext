#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function usage() {
  return "Usage: node scripts/create-build-manifest.cjs --output <manifest.json> <artifact> [artifact ...]";
}

function gitValue(args, fallback) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function parseArguments(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex < 0 || !argv[outputIndex + 1]) {
    throw new Error(usage());
  }

  const output = argv[outputIndex + 1];
  const artifacts = argv.filter((value, index) => (
    index !== outputIndex && index !== outputIndex + 1
  ));
  if (artifacts.length === 0) {
    throw new Error(usage());
  }

  return { output, artifacts };
}

function main() {
  const { output, artifacts } = parseArguments(process.argv.slice(2));
  const resolvedOutput = path.resolve(output);
  const manifestDirectory = path.dirname(resolvedOutput);
  const records = artifacts.map((artifact) => {
    const resolvedArtifact = path.resolve(artifact);
    const stat = fs.statSync(resolvedArtifact);
    if (!stat.isFile()) {
      throw new Error(`Artifact is not a file: ${artifact}`);
    }
    return {
      path: path.relative(manifestDirectory, resolvedArtifact).split(path.sep).join("/"),
      bytes: stat.size,
      sha256: sha256(resolvedArtifact),
    };
  });

  const gitCommit = process.env.GITHUB_SHA
    || gitValue(["rev-parse", "HEAD"], null);
  const sourceDirty = gitValue(["status", "--porcelain", "--untracked-files=no"], "") !== "";
  const manifest = {
    schemaVersion: 1,
    gitCommit,
    sourceDirty,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    artifacts: records,
  };

  fs.mkdirSync(manifestDirectory, { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${resolvedOutput}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
