import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildBotBalanceBaselineVariantComparison,
  buildBotBalanceBaselineVariantComparisonMarkdown,
} from "../tests/server/game-room/bot-balance-baseline-comparison";
import type { BotBalanceBaselineSummary } from "../tests/server/game-room/bot-balance-baseline-human-report";

type CliOptions = {
  summaryPaths: string[];
  historicalBossWinRate?: number;
  outputPath?: string;
};

function parseCliOptions(argv: string[]): CliOptions {
  const summaryPaths: string[] = [];
  let historicalBossWinRate: number | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--historical-boss-win-rate" && nextValue) {
      const parsed = Number.parseFloat(nextValue);
      historicalBossWinRate = Number.isFinite(parsed) ? parsed : undefined;
      index += 1;
      continue;
    }

    if (argument === "--output" && nextValue) {
      outputPath = resolve(nextValue);
      index += 1;
      continue;
    }

    if (argument === "--help") {
      console.log([
        "Usage: npm exec tsx scripts/compare-bot-balance-baselines.ts -- [options] <summary.json...>",
        "  --historical-boss-win-rate <rate>  Optional reference boss win rate, e.g. 0.56",
        "  --output <path>                   Write markdown report to this path instead of stdout",
      ].join("\n"));
      process.exit(0);
    }

    summaryPaths.push(resolve(argument));
  }

  return { summaryPaths, historicalBossWinRate, outputPath };
}

function readSummary(path: string): BotBalanceBaselineSummary {
  return JSON.parse(readFileSync(path, "utf8")) as BotBalanceBaselineSummary;
}

const options = parseCliOptions(process.argv.slice(2));
if (options.summaryPaths.length === 0) {
  throw new Error("At least one summary.json path is required");
}

const comparison = buildBotBalanceBaselineVariantComparison(
  options.summaryPaths.map((path) => readSummary(path)),
  { historicalBossWinRate: options.historicalBossWinRate },
);
const markdown = buildBotBalanceBaselineVariantComparisonMarkdown(comparison);

if (options.outputPath) {
  writeFileSync(options.outputPath, markdown, "utf8");
} else {
  process.stdout.write(markdown);
}
