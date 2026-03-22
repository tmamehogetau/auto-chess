import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const require = createRequire(import.meta.url);

const PARALLEL_SAFE_SERVER_TESTS = [
  "tests/server/analytics/gameplay-kpi-report.test.ts",
  "tests/server/analytics/gameplay-kpi.test.ts",
  "tests/server/analytics/rumor-kpi.test.ts",
  "tests/server/board-geometry.test.ts",
  "tests/server/combat/synergy-definitions.test.ts",
  "tests/server/combat/unit-effect-definitions.test.ts",
  "tests/server/combat/unit-effects.test.ts",
  "tests/server/domination-count.test.ts",
  "tests/server/feature-flag-regression.test.ts",
  "tests/server/game-loop-state.test.ts",
  "tests/server/game-room/admin-query-handler.test.ts",
  "tests/server/game-room/correlation-id.test.ts",
  "tests/server/game-room/prep-command-payload.test.ts",
  "tests/server/game-room/ranking-sync.test.ts",
  "tests/server/match-logger.test.ts",
  "tests/server/match-room-controller/damage-calculator.test.ts",
  "tests/server/match-room-controller/matchup-result-helpers.test.ts",
  "tests/server/match-room-controller/phase-timing.test.ts",
  "tests/server/match-room-controller/player-compare.test.ts",
  "tests/server/match-room-controller/prep-economy.test.ts",
  "tests/server/match-room-controller/random-utils.test.ts",
  "tests/server/match-room-utils/damage-calculator.test.ts",
  "tests/server/match-room-utils/player-compare.test.ts",
  "tests/server/match-room-utils/random-utils.test.ts",
  "tests/server/roster/roster-provider.test.ts",
  "tests/server/shared-board-bridge.monitoring-queries.test.ts",
  "tests/server/shared-board-bridge.placement-sync.test.ts",
  "tests/server/shared-board-bridge.reconnect-policy.test.ts",
  "tests/server/touhou-balance.contract.test.ts",
  "tests/server/unit-id-data-integrity.test.ts",
];

function normalizeRelativePath(filePath, repoRoot = DEFAULT_REPO_ROOT) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function resolveServerTestRoot(repoRoot = DEFAULT_REPO_ROOT) {
  return path.join(repoRoot, "tests", "server");
}

async function collectServerTests(currentDir, repoRoot = DEFAULT_REPO_ROOT) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const collected = [];

  for (const entry of entries) {
    const nextPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...await collectServerTests(nextPath, repoRoot));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".test.ts")) {
      continue;
    }

    collected.push(normalizeRelativePath(nextPath, repoRoot));
  }

  return collected.sort();
}

function validateManifest(allTests, parallelSafe) {
  const normalized = parallelSafe.map((filePath) => filePath.split(path.sep).join("/"));
  const uniqueParallelSafe = new Set(normalized);

  if (uniqueParallelSafe.size !== normalized.length) {
    throw new Error("parallel-safe manifest contains duplicate entries");
  }

  const invalidPrefix = normalized.find((filePath) => !filePath.startsWith("tests/server/"));
  if (invalidPrefix) {
    throw new Error(`parallel-safe entry must stay under tests/server: ${invalidPrefix}`);
  }

  const missingEntry = normalized.find((filePath) => !allTests.includes(filePath));
  if (missingEntry) {
    throw new Error(`parallel-safe entry does not match an existing server test: ${missingEntry}`);
  }

  return [...uniqueParallelSafe].sort();
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

export async function auditServerTestManifest(repoRoot = DEFAULT_REPO_ROOT) {
  const allTests = await listAllServerTests(repoRoot);
  const parallelSafe = await getParallelSafeServerTests(repoRoot);
  const serialRequired = await getSerialRequiredServerTests(repoRoot);

  const combined = new Set([...parallelSafe, ...serialRequired]);
  if (combined.size !== allTests.length) {
    throw new Error("server test manifest does not cover every suite exactly once");
  }

  return {
    allCount: allTests.length,
    parallelSafeCount: parallelSafe.length,
    serialRequiredCount: serialRequired.length,
  };
}

export async function listAllServerTests(repoRoot = DEFAULT_REPO_ROOT) {
  return collectServerTests(resolveServerTestRoot(repoRoot), repoRoot);
}

export async function getParallelSafeServerTests(repoRoot = DEFAULT_REPO_ROOT) {
  const allTests = await listAllServerTests(repoRoot);
  return validateManifest(allTests, PARALLEL_SAFE_SERVER_TESTS);
}

export async function getSerialRequiredServerTests(repoRoot = DEFAULT_REPO_ROOT) {
  const allTests = await listAllServerTests(repoRoot);
  const parallelSafe = new Set(await getParallelSafeServerTests(repoRoot));
  return allTests.filter((filePath) => !parallelSafe.has(filePath));
}

export async function getServerTestsForGroup(groupName, repoRoot = DEFAULT_REPO_ROOT) {
  if (groupName === "parallel-safe") {
    return getParallelSafeServerTests(repoRoot);
  }

  if (groupName === "serial-required") {
    return getSerialRequiredServerTests(repoRoot);
  }

  throw new Error(`unknown server test group: ${groupName}`);
}

export async function runServerTests(groupName, vitestArgs = [], repoRoot = DEFAULT_REPO_ROOT) {
  const testFiles = await getServerTestsForGroup(groupName, repoRoot);
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
    listGroup: listArg ? listArg.slice("--list=".length) : null,
    runGroup: runArg ? runArg.slice("--run=".length) : null,
    vitestArgs,
  };
}

async function main() {
  const { audit, listGroup, runGroup, vitestArgs } = parseCliArgs(process.argv.slice(2));

  if (audit) {
    const summary = await auditServerTestManifest();
    console.log(
      `server-test-manifest ok: ${summary.allCount} total (${summary.parallelSafeCount} parallel-safe / ${summary.serialRequiredCount} serial-required)`,
    );
    return;
  }

  if (listGroup) {
    console.log(JSON.stringify(await getServerTestsForGroup(listGroup)));
    return;
  }

  if (runGroup) {
    const exitCode = await runServerTests(runGroup, vitestArgs);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
    return;
  }

  throw new Error("expected --audit, --list=<parallel-safe|serial-required>, or --run=<parallel-safe|serial-required>");
}

if (process.argv[1] === SCRIPT_FILE) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
