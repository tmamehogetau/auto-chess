import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";

export const DEFAULT_VERIFY_CI_STAGES = [
  { name: "typecheck", command: NPM_COMMAND, args: ["run", "--silent", "typecheck"], parallelGroup: "preflight" },
  { name: "client", command: NPM_COMMAND, args: ["run", "--silent", "test:client:ci"], parallelGroup: "preflight" },
  { name: "server-audit", command: NPM_COMMAND, args: ["run", "--silent", "test:server:audit"], parallelGroup: "preflight" },
  {
    name: "server-parallel",
    command: NPM_COMMAND,
    args: ["run", "--silent", "test:server:parallel-safe"],
  },
  {
    name: "server-serial",
    command: NPM_COMMAND,
    args: ["run", "--silent", "test:server:serial-required"],
  },
  { name: "e2e-a", command: NPM_COMMAND, args: ["run", "--silent", "test:e2e:ci:a"], parallelGroup: "e2e" },
  { name: "e2e-b", command: NPM_COMMAND, args: ["run", "--silent", "test:e2e:ci:b"], parallelGroup: "e2e" },
];

function formatElapsedMs(elapsedMs) {
  return `${(elapsedMs / 1000).toFixed(2)}s`;
}

export function formatStageSummary(stageResults) {
  const lines = ["verify:ci elapsed summary"];
  const totalElapsedMs = stageResults.reduce((sum, stage) => sum + stage.elapsedMs, 0);

  lines.push(`- reported-stage-total: elapsed ${formatElapsedMs(totalElapsedMs)}`);

  for (const stage of stageResults) {
    lines.push(`- ${stage.name}: elapsed ${formatElapsedMs(stage.elapsedMs)}`);
  }

  return lines.join("\n");
}

export function resolveRequestedStages(requestedStageNames, stages = DEFAULT_VERIFY_CI_STAGES) {
  if (!requestedStageNames) {
    return stages;
  }

  const requestedNames = requestedStageNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (requestedNames.length === 0) {
    return stages;
  }

  const stageMap = new Map(stages.map((stage) => [stage.name, stage]));
  const unknownStage = requestedNames.find((name) => !stageMap.has(name));
  if (unknownStage) {
    throw new Error(`unknown verify:ci stage: ${unknownStage}`);
  }

  return requestedNames.map((name) => stageMap.get(name));
}

export function groupStagesForExecution(stages) {
  const batches = [];

  for (const stage of stages) {
    const currentBatch = batches.at(-1);
    const stageParallelGroup = stage.parallelGroup ?? null;

    if (
      currentBatch &&
      currentBatch.parallelGroup !== null &&
      currentBatch.parallelGroup === stageParallelGroup
    ) {
      currentBatch.stages.push(stage);
      continue;
    }

    batches.push({
      parallelGroup: stageParallelGroup,
      stages: [stage],
    });
  }

  return batches.map((batch) => batch.stages);
}

function quoteWindowsArg(arg) {
  if (!/[\s"]/u.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

export async function runStage(stage, repoRoot = DEFAULT_REPO_ROOT) {
  const startedAt = Date.now();
  const child =
    process.platform === "win32"
      ? spawn(
          process.env.ComSpec ?? "cmd.exe",
          [
            "/d",
            "/s",
            "/c",
            [quoteWindowsArg(stage.command), ...stage.args.map(quoteWindowsArg)].join(" "),
          ],
          {
            cwd: repoRoot,
            stdio: "inherit",
            env: process.env,
          },
        )
      : spawn(stage.command, stage.args, {
          cwd: repoRoot,
          stdio: "inherit",
          env: process.env,
        });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });

  return {
    name: stage.name,
    elapsedMs: Date.now() - startedAt,
    exitCode: exitCode ?? 1,
  };
}

export async function runStageBatch(stages, repoRoot = DEFAULT_REPO_ROOT) {
  return Promise.all(stages.map((stage) => runStage(stage, repoRoot)));
}

export async function runVerifyCi(stages = DEFAULT_VERIFY_CI_STAGES, repoRoot = DEFAULT_REPO_ROOT) {
  const startedAt = Date.now();
  const stageResults = [];

  for (const batch of groupStagesForExecution(stages)) {
    const batchResults = await runStageBatch(batch, repoRoot);
    stageResults.push(...batchResults);

    if (batchResults.some((result) => result.exitCode !== 0)) {
      return {
        ok: false,
        totalElapsedMs: Date.now() - startedAt,
        stageResults,
      };
    }
  }

  return {
    ok: true,
    totalElapsedMs: Date.now() - startedAt,
    stageResults,
  };
}

async function main() {
  const selectedStages = resolveRequestedStages(process.env.VERIFY_CI_STAGES);
  const result = await runVerifyCi(selectedStages);
  console.log(
    [
      `verify:ci wall time ${formatElapsedMs(result.totalElapsedMs)}`,
      formatStageSummary(result.stageResults),
    ].join("\n"),
  );

  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] === SCRIPT_FILE) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
