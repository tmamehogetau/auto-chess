import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const require = createRequire(import.meta.url);

const E2E_TEST_SHARDS = {
  a: [
    "tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts",
    "tests/e2e/full-game/sub-unit-system.e2e.spec.ts",
    "tests/e2e/shared-board-bridge/bridge.cleanup.e2e.spec.ts",
    "tests/e2e/shared-board-bridge/bridge.lifecycle.e2e.spec.ts",
    "tests/e2e/shared-board-bridge/t4-minimal-e2e.spec.ts",
  ],
  b: [
    "tests/e2e/full-game/boss-raid-core-loop.e2e.spec.ts",
    "tests/e2e/full-game/p1-features-integration.e2e.spec.ts",
    "tests/e2e/full-game/player-elimination.e2e.spec.ts",
    "tests/e2e/full-game/phase-hp-progress.e2e.spec.ts",
    "tests/e2e/full-game/roster-switch.e2e.spec.ts",
    "tests/e2e/full-game/unit-operations.e2e.spec.ts",
    "tests/e2e/shared-board-bridge/bridge.ui-integration.e2e.spec.ts",
  ],
  c: [
    "tests/e2e/full-game/full-round-completion.e2e.spec.ts",
  ],
};

function normalizeRelativePath(filePath, repoRoot = DEFAULT_REPO_ROOT) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function resolveE2eTestRoot(repoRoot = DEFAULT_REPO_ROOT) {
  return path.join(repoRoot, "tests", "e2e");
}

async function collectE2eTests(currentDir, repoRoot = DEFAULT_REPO_ROOT) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const collected = [];

  for (const entry of entries) {
    const nextPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...await collectE2eTests(nextPath, repoRoot));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".spec.ts")) {
      continue;
    }

    collected.push(normalizeRelativePath(nextPath, repoRoot));
  }

  return collected.sort();
}

function validateShard(allTests, shardName) {
  const configured = E2E_TEST_SHARDS[shardName];
  if (!configured) {
    throw new Error(`unknown e2e shard: ${shardName}`);
  }

  const normalized = configured.map((filePath) => filePath.split(path.sep).join("/"));
  const uniqueShard = new Set(normalized);

  if (uniqueShard.size !== normalized.length) {
    throw new Error(`e2e shard ${shardName} contains duplicate entries`);
  }

  const invalidPrefix = normalized.find((filePath) => !filePath.startsWith("tests/e2e/"));
  if (invalidPrefix) {
    throw new Error(`e2e shard ${shardName} must stay under tests/e2e: ${invalidPrefix}`);
  }

  const missingEntry = normalized.find((filePath) => !allTests.includes(filePath));
  if (missingEntry) {
    throw new Error(`e2e shard ${shardName} does not match an existing test: ${missingEntry}`);
  }

  return [...uniqueShard].sort();
}

function getVitestEntrypoint(repoRoot = DEFAULT_REPO_ROOT) {
  try {
    const vitestPackageJson = require.resolve("vitest/package.json", {
      paths: [repoRoot, SCRIPT_DIR],
    });
    return path.join(path.dirname(vitestPackageJson), "vitest.mjs");
  } catch {
    return path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
  }
}

export async function listAllE2eTests(repoRoot = DEFAULT_REPO_ROOT) {
  return collectE2eTests(resolveE2eTestRoot(repoRoot), repoRoot);
}

export async function getE2eTestsForShard(shardName, repoRoot = DEFAULT_REPO_ROOT) {
  const allTests = await listAllE2eTests(repoRoot);
  return validateShard(allTests, shardName);
}

export async function auditE2eTestManifest(repoRoot = DEFAULT_REPO_ROOT) {
  const allTests = await listAllE2eTests(repoRoot);
  const shardA = await getE2eTestsForShard("a", repoRoot);
  const shardB = await getE2eTestsForShard("b", repoRoot);
  const shardC = await getE2eTestsForShard("c", repoRoot);
  const combined = new Set([...shardA, ...shardB, ...shardC]);

  if (combined.size !== allTests.length) {
    throw new Error("e2e test manifest does not cover every suite exactly once");
  }

  return {
    allCount: allTests.length,
    shardACount: shardA.length,
    shardBCount: shardB.length,
    shardCCount: shardC.length,
  };
}

export async function runE2eTests(shardName, vitestArgs = [], repoRoot = DEFAULT_REPO_ROOT) {
  const testFiles = await getE2eTestsForShard(shardName, repoRoot);
  const vitestEntrypoint = getVitestEntrypoint(repoRoot);
  const child = spawn(
    process.execPath,
    [vitestEntrypoint, "run", ...testFiles, ...vitestArgs],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode ?? 1;
  }

  return exitCode ?? 1;
}

function parseCliArgs(argv) {
  const audit = argv.includes("--audit");
  const runArg = argv.find((arg) => arg.startsWith("--run="));
  const listArg = argv.find((arg) => arg.startsWith("--list="));
  const passthroughStart = argv.indexOf("--");
  const vitestArgs = passthroughStart >= 0 ? argv.slice(passthroughStart + 1) : [];

  return {
    audit,
    listShard: listArg ? listArg.slice("--list=".length) : null,
    runShard: runArg ? runArg.slice("--run=".length) : null,
    vitestArgs,
  };
}

async function main() {
  const { audit, listShard, runShard, vitestArgs } = parseCliArgs(process.argv.slice(2));

  if (audit) {
    const summary = await auditE2eTestManifest();
    console.log(
      `e2e-test-manifest ok: ${summary.allCount} total`
      + ` (${summary.shardACount} shard-a / ${summary.shardBCount} shard-b / ${summary.shardCCount} shard-c)`,
    );
    return;
  }

  if (listShard) {
    console.log(JSON.stringify(await getE2eTestsForShard(listShard)));
    return;
  }

  if (runShard) {
    const exitCode = await runE2eTests(runShard, vitestArgs);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
    return;
  }

  throw new Error("expected --audit, --list=<a|b|c>, or --run=<a|b|c>");
}

if (process.argv[1] === SCRIPT_FILE) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
