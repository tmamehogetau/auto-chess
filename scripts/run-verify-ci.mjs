import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";

export const DEFAULT_VERIFY_CI_STAGES = [
  { name: "typecheck", command: NPM_COMMAND, args: ["run", "--silent", "typecheck"] },
  { name: "client", command: NPM_COMMAND, args: ["run", "--silent", "test:client:ci"] },
  { name: "server-audit", command: NPM_COMMAND, args: ["run", "--silent", "test:server:audit"] },
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
  { name: "e2e", command: NPM_COMMAND, args: ["run", "--silent", "test:e2e:ci"] },
];

function formatElapsedMs(elapsedMs) {
  return `${(elapsedMs / 1000).toFixed(2)}s`;
}

export function formatStageSummary(stageResults) {
  const lines = ["verify:ci elapsed summary"];

  for (const stage of stageResults) {
    lines.push(`- ${stage.name}: elapsed ${formatElapsedMs(stage.elapsedMs)}`);
  }

  return lines.join("\n");
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

export async function runVerifyCi(stages = DEFAULT_VERIFY_CI_STAGES, repoRoot = DEFAULT_REPO_ROOT) {
  const stageResults = [];

  for (const stage of stages) {
    const result = await runStage(stage, repoRoot);
    stageResults.push(result);

    if (result.exitCode !== 0) {
      return {
        ok: false,
        stageResults,
      };
    }
  }

  return {
    ok: true,
    stageResults,
  };
}

async function main() {
  const result = await runVerifyCi();
  console.log(formatStageSummary(result.stageResults));

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
