import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  mergeBotOnlyBaselineAggregateReports,
  type BotOnlyBaselineAggregateReport,
} from "../tests/server/game-room/bot-balance-baseline-aggregate";
import {
  buildBotBalanceBaselineAnalysis,
} from "../tests/server/game-room/bot-balance-baseline-analysis";
import {
  buildBotBalanceBaselineJapaneseJson,
  buildBotBalanceBaselineJapaneseMarkdown,
  buildBotBalanceBaselineRoundDetailsJapaneseMarkdown,
  type BotBalanceBaselineSummary,
} from "../tests/server/game-room/bot-balance-baseline-human-report";
import {
  baselineChunkConfigMatches,
  createBaselineChunkConfigSnapshot,
  createBotBalanceBaselineHelperConfigs,
  createBaselineChunkDefinitions,
  resolveBotBalanceBaselineHelperPolicy,
  resolveBotBalanceBaselineParallelism,
  resolveBotBalanceBaselinePortOffsetBase,
  resolveBotBalanceBaselineRaidPolicies,
  resolveBotBalanceBaselineWorkerPortOffset,
  type BaselineChunkConfigSnapshot,
} from "../tests/server/game-room/bot-balance-baseline-runner";

type ChunkFailure = {
  matchIndex: number;
  message: string;
};

type ChunkRunRecord = {
  chunkIndex: number;
  matchStartIndex: number;
  requestedMatchCount: number;
  baselineConfig: BaselineChunkConfigSnapshot;
  workerIndex: number;
  portOffset: number;
  aggregate: BotOnlyBaselineAggregateReport;
  failures: ChunkFailure[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  logPath: string;
};

type ParsedBaselinePayload = {
  aggregate: BotOnlyBaselineAggregateReport;
  failures: ChunkFailure[];
};

type CliOptions = {
  matchCount: number;
  chunkSize: number;
  parallelism: number;
  portOffsetBase: number;
  bossPolicy: "strength" | "growth";
  raidPolicies: Array<"strength" | "growth">;
  outputDir: string;
  resume: boolean;
};

const BASELINE_TEST_NAME = "bot-only baseline report aggregates multiple helper matches";

function parseCliOptions(argv: string[]): CliOptions {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultOutputDir = resolve(
    scriptDir,
    "..",
    ".tmp",
    "bot-balance-baseline",
    new Date().toISOString().replaceAll(":", "-"),
  );

  let matchCount = 100;
  let chunkSize = 5;
  let parallelism = resolveBotBalanceBaselineParallelism(undefined);
  let portOffsetBase = resolveBotBalanceBaselinePortOffsetBase(undefined);
  let bossPolicy = resolveBotBalanceBaselineHelperPolicy(undefined);
  let raidPolicies = resolveBotBalanceBaselineRaidPolicies(undefined);
  let outputDir = defaultOutputDir;
  let resume = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];
    if (argument === "--matches" && nextValue) {
      matchCount = Math.max(1, Number.parseInt(nextValue, 10) || matchCount);
      index += 1;
      continue;
    }

    if (argument === "--chunk-size" && nextValue) {
      chunkSize = Math.max(1, Number.parseInt(nextValue, 10) || chunkSize);
      index += 1;
      continue;
    }

    if (argument === "--output-dir" && nextValue) {
      outputDir = resolve(nextValue);
      index += 1;
      continue;
    }

    if (argument === "--parallelism" && nextValue) {
      parallelism = resolveBotBalanceBaselineParallelism(
        Number.parseInt(nextValue, 10),
      );
      index += 1;
      continue;
    }

    if (argument === "--port-offset-base" && nextValue) {
      portOffsetBase = resolveBotBalanceBaselinePortOffsetBase(
        Number.parseInt(nextValue, 10),
      );
      index += 1;
      continue;
    }

    if (argument === "--boss-policy" && nextValue) {
      bossPolicy = resolveBotBalanceBaselineHelperPolicy(nextValue);
      index += 1;
      continue;
    }

    if (argument === "--raid-policies" && nextValue) {
      raidPolicies = resolveBotBalanceBaselineRaidPolicies(nextValue);
      index += 1;
      continue;
    }

    if (argument === "--resume") {
      resume = true;
      continue;
    }

    if (argument === "--help") {
      console.log(
        [
          "Usage: npm run bot:balance:baseline -- [options]",
          "  --matches <number>     Total match count (default: 100)",
          "  --chunk-size <number>  Matches per chunk (default: 5)",
          "  --parallelism <number> Concurrent chunk workers (default: auto 4-16 by CPU)",
          "  --port-offset-base <n> Base port offset for this run (default: 10000)",
          "  --boss-policy <mode>   Boss helper purchase policy: strength|growth",
          "  --raid-policies <csv>  Raid helper policies for bots 2-4 (default: strength,strength,strength)",
          "  --output-dir <path>    Directory for chunk logs and summary",
          "  --resume               Reuse existing chunk JSON files in output dir",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  return {
    matchCount,
    chunkSize,
    parallelism,
    portOffsetBase: resolveBotBalanceBaselinePortOffsetBase(portOffsetBase, parallelism),
    bossPolicy,
    raidPolicies,
    outputDir,
    resume,
  };
}

function readChunkRecordIfPresent(
  path: string,
  expectedConfig?: BaselineChunkConfigSnapshot,
): ChunkRunRecord | null {
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ChunkRunRecord>;
  if (
    typeof parsed.chunkIndex !== "number"
    || typeof parsed.matchStartIndex !== "number"
    || typeof parsed.requestedMatchCount !== "number"
    || parsed.baselineConfig == null
    || parsed.aggregate == null
    || typeof parsed.logPath !== "string"
  ) {
    throw new Error(`Existing chunk file has an invalid shape: ${path}`);
  }

  if (expectedConfig && !baselineChunkConfigMatches(parsed.baselineConfig, expectedConfig)) {
    throw new Error(`Existing chunk file baseline config does not match current run: ${path}`);
  }

  return parsed as ChunkRunRecord;
}

function parseBaselinePayload(output: string): ParsedBaselinePayload {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.includes("\"type\":\"bot_balance_baseline\""));

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    try {
      const jsonStartIndex = line.indexOf("{");
      if (jsonStartIndex < 0) {
        continue;
      }
      const parsed = JSON.parse(line.slice(jsonStartIndex)) as {
        type?: string;
        data?: BotOnlyBaselineAggregateReport & { failures?: ChunkFailure[] };
      };
      if (parsed.type !== "bot_balance_baseline" || parsed.data == null) {
        continue;
      }

      const { failures = [], ...aggregate } = parsed.data;
      return {
        aggregate,
        failures,
      };
    } catch {
      continue;
    }
  }

  throw new Error("Could not find bot_balance_baseline JSON payload in chunk output");
}

function estimateChunkTimeoutMs(chunkMatchCount: number): number {
  return Math.max(120_000, 60_000 + chunkMatchCount * 25_000);
}

async function runBaselineChunk(
  repoRoot: string,
  chunkIndex: number,
  matchStartIndex: number,
  requestedMatchCount: number,
  outputDir: string,
  workerIndex: number,
  portOffsetBase: number,
  bossPolicy: "strength" | "growth",
  raidPolicies: Array<"strength" | "growth">,
): Promise<ChunkRunRecord> {
  const logPath = join(outputDir, `chunk-${String(chunkIndex + 1).padStart(3, "0")}.log`);
  const startedAt = new Date().toISOString();
  const timeoutMs = estimateChunkTimeoutMs(requestedMatchCount);
  const vitestEntrypoint = resolve(repoRoot, "node_modules", "vitest", "vitest.mjs");
  const portOffset = resolveBotBalanceBaselineWorkerPortOffset(workerIndex, portOffsetBase);
  const command = process.execPath;
  const args = [
    vitestEntrypoint,
    "run",
    "tests/server/game-room/bot-playability.test.ts",
    "-t",
    BASELINE_TEST_NAME,
    "--reporter=dot",
  ];

  const result = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    output: string;
  }>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        RUN_BOT_BALANCE_BASELINE: "true",
        BOT_BASELINE_MATCH_COUNT: String(requestedMatchCount),
        BOT_BASELINE_BOSS_POLICY: bossPolicy,
        BOT_BASELINE_RAID_POLICIES: raidPolicies.join(","),
        BOT_BASELINE_TIMEOUT_MS: String(timeoutMs),
        BOT_BASELINE_WORKER_INDEX: String(workerIndex),
        SUPPRESS_VERBOSE_TEST_LOGS: "true",
        TEST_SERVER_PORT_OFFSET: String(portOffset),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let combinedOutput = "";
    child.stdout.on("data", (chunk) => {
      combinedOutput += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      combinedOutput += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (exitCode, signal) => {
      resolvePromise({ exitCode, signal, output: combinedOutput });
    });
  });

  writeFileSync(logPath, result.output, "utf8");
  if (result.exitCode !== 0) {
    throw new Error(
      `Chunk ${chunkIndex + 1} failed with exit code ${result.exitCode ?? "null"}`
      + ` (${logPath})`,
    );
  }
  if (result.signal) {
    throw new Error(`Chunk ${chunkIndex + 1} exited with signal ${result.signal} (${logPath})`);
  }

  const parsed = parseBaselinePayload(result.output);
  const finishedAt = new Date().toISOString();
  return {
    chunkIndex,
    matchStartIndex,
    requestedMatchCount,
    baselineConfig: createBaselineChunkConfigSnapshot({
      requestedMatchCount,
      bossPolicy,
      raidPolicies,
    }),
    workerIndex,
    portOffset,
    aggregate: parsed.aggregate,
    failures: parsed.failures,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    logPath,
  };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, "..");
  mkdirSync(options.outputDir, { recursive: true });

  const chunkRecords: ChunkRunRecord[] = [];
  const chunkDefinitions = createBaselineChunkDefinitions(
    options.matchCount,
    options.chunkSize,
    options.outputDir,
  );
  const totalChunks = chunkDefinitions.length;
  const workerCount = Math.min(options.parallelism, totalChunks);
  let nextChunkCursor = 0;

  const runWorker = async (workerIndex: number): Promise<void> => {
    while (true) {
      const chunkDefinition = chunkDefinitions[nextChunkCursor];
      nextChunkCursor += 1;
      if (!chunkDefinition) {
        return;
      }

      const existingChunk = options.resume
        ? readChunkRecordIfPresent(
          chunkDefinition.chunkJsonPath,
          createBaselineChunkConfigSnapshot({
            requestedMatchCount: chunkDefinition.requestedMatchCount,
            bossPolicy: options.bossPolicy,
            raidPolicies: options.raidPolicies,
          }),
        )
        : null;
      const chunkRecord = existingChunk ?? await runBaselineChunk(
        repoRoot,
        chunkDefinition.chunkIndex,
        chunkDefinition.matchStartIndex,
        chunkDefinition.requestedMatchCount,
        options.outputDir,
        workerIndex,
        options.portOffsetBase,
        options.bossPolicy,
        options.raidPolicies,
      );

      if (!existingChunk) {
        writeFileSync(
          chunkDefinition.chunkJsonPath,
          `${JSON.stringify(chunkRecord, null, 2)}\n`,
          "utf8",
        );
      }

      chunkRecords.push(chunkRecord);
      console.log(
        [
          `[${chunkDefinition.chunkIndex + 1}/${totalChunks}]`,
          `worker=${workerIndex + 1}/${workerCount}`,
          `completed=${chunkRecord.aggregate.completedMatches}/${chunkRecord.requestedMatchCount}`,
          `bossWins=${chunkRecord.aggregate.bossWins}`,
          `avgRounds=${chunkRecord.aggregate.averageRounds.toFixed(2)}`,
          existingChunk ? "(resumed)" : "",
        ].filter(Boolean).join(" "),
      );
    }
  };

  await Promise.all(
    Array.from({ length: workerCount }, (_, workerIndex) => runWorker(workerIndex)),
  );
  chunkRecords.sort((left, right) => left.chunkIndex - right.chunkIndex);

  const aggregate = mergeBotOnlyBaselineAggregateReports(
    chunkRecords.map((record) => record.aggregate),
    options.matchCount,
  );
  const failures = chunkRecords.flatMap((record) =>
    record.failures.map((failure) => ({
      chunkIndex: record.chunkIndex,
      globalMatchIndex: record.matchStartIndex + failure.matchIndex,
      localMatchIndex: failure.matchIndex,
      message: failure.message,
    })));
  const summaryPath = join(options.outputDir, "summary.json");
  const analysisJsonPath = join(options.outputDir, "summary.analysis.json");
  const humanMarkdownPath = join(options.outputDir, "summary.ja.md");
  const roundDetailsMarkdownPath = join(options.outputDir, "round-details.ja.md");
  const humanJsonPath = join(options.outputDir, "summary.ja.json");
  const helperConfigs = createBotBalanceBaselineHelperConfigs({
    bossPolicy: options.bossPolicy,
    raidPolicies: options.raidPolicies,
  });
  const summary: BotBalanceBaselineSummary = {
    requestedMatchCount: options.matchCount,
    chunkSize: options.chunkSize,
    parallelism: workerCount,
    portOffsetBase: options.portOffsetBase,
    bossPolicy: options.bossPolicy,
    raidPolicies: options.raidPolicies,
    helperConfigs,
    chunkCount: chunkRecords.length,
    outputDir: options.outputDir,
    aggregate,
    failures,
    chunks: chunkRecords.map((record) => ({
      chunkIndex: record.chunkIndex,
      matchStartIndex: record.matchStartIndex,
      requestedMatchCount: record.requestedMatchCount,
      workerIndex: record.workerIndex,
      portOffset: record.portOffset,
      completedMatches: record.aggregate.completedMatches,
      abortedMatches: record.aggregate.abortedMatches,
      logPath: record.logPath,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      durationMs: record.durationMs,
    })),
  };
  const analysisReport = buildBotBalanceBaselineAnalysis(summary);
  const japaneseJsonReport = buildBotBalanceBaselineJapaneseJson(summary);
  const japaneseMarkdownReport = buildBotBalanceBaselineJapaneseMarkdown(summary);
  const roundDetailsMarkdownReport = buildBotBalanceBaselineRoundDetailsJapaneseMarkdown(summary);

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(analysisJsonPath, `${JSON.stringify(analysisReport, null, 2)}\n`, "utf8");
  writeFileSync(humanJsonPath, `${JSON.stringify(japaneseJsonReport, null, 2)}\n`, "utf8");
  writeFileSync(humanMarkdownPath, japaneseMarkdownReport, "utf8");
  writeFileSync(roundDetailsMarkdownPath, roundDetailsMarkdownReport, "utf8");
  console.log(JSON.stringify({
    type: "bot_balance_baseline_summary",
    data: {
      summaryPath,
      analysisJsonPath,
      humanJsonPath,
      humanMarkdownPath,
      roundDetailsMarkdownPath,
      outputDir: options.outputDir,
      completedMatches: aggregate.completedMatches,
      abortedMatches: aggregate.abortedMatches,
      bossWinRate: aggregate.bossWinRate,
      averageRounds: aggregate.averageRounds,
      failureCount: failures.length,
    },
  }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
