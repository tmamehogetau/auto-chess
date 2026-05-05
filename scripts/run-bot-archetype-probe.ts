import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildBotArchetypeControlledProbeJapaneseMarkdown,
  runBotArchetypeControlledProbe,
} from "../tests/server/game-room/bot-archetype-controlled-probe";

type CliOptions = {
  samplesPerScenario: number;
  unitIds: string[] | undefined;
  unitLevel: number;
  enemyUnitLevel: number | undefined;
  roundIndex: number;
  seedBase: number;
  outputDir: string;
};

function parseCliOptions(argv: string[]): CliOptions {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultOutputDir = resolve(
    scriptDir,
    "..",
    ".tmp",
    "bot-archetype-probe",
    new Date().toISOString().replaceAll(":", "-"),
  );
  let samplesPerScenario = 50;
  let unitIds: string[] | undefined;
  let unitLevel = 4;
  let enemyUnitLevel: number | undefined;
  let roundIndex = 7;
  let seedBase = 1000;
  let outputDir = defaultOutputDir;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];
    if (argument === "--samples" && nextValue) {
      samplesPerScenario = Math.max(1, Number.parseInt(nextValue, 10) || samplesPerScenario);
      index += 1;
      continue;
    }

    if (argument === "--units" && nextValue) {
      unitIds = nextValue.split(",").map((unitId) => unitId.trim()).filter(Boolean);
      index += 1;
      continue;
    }

    if (argument === "--unit-level" && nextValue) {
      unitLevel = Math.max(1, Number.parseInt(nextValue, 10) || unitLevel);
      index += 1;
      continue;
    }

    if (argument === "--enemy-level" && nextValue) {
      enemyUnitLevel = Math.max(1, Number.parseInt(nextValue, 10) || unitLevel);
      index += 1;
      continue;
    }

    if (argument === "--round" && nextValue) {
      roundIndex = Math.max(1, Number.parseInt(nextValue, 10) || roundIndex);
      index += 1;
      continue;
    }

    if (argument === "--seed-base" && nextValue) {
      seedBase = Number.parseInt(nextValue, 10) || seedBase;
      index += 1;
      continue;
    }

    if (argument === "--output-dir" && nextValue) {
      outputDir = resolve(nextValue);
      index += 1;
      continue;
    }

    if (argument === "--help") {
      console.log([
        "Usage: npm run bot:archetype:probe -- [options]",
        "  --samples <number>     fit/nonfit samples per unit (default: 50)",
        "  --units <csv>          Unit ids, e.g. patchouli,sakuya,meiling",
        "  --unit-level <number>  Unit level for all probe boards (default: 4)",
        "  --enemy-level <number> Enemy unit level for tension tests (default: unit level)",
        "  --round <number>       Round index for simulator context (default: 7)",
        "  --seed-base <number>   Deterministic seed base (default: 1000)",
        "  --output-dir <path>    Directory for summary.json and summary.ja.md",
      ].join("\n"));
      process.exit(0);
    }
  }

  return {
    samplesPerScenario,
    unitIds,
    unitLevel,
    enemyUnitLevel,
    roundIndex,
    seedBase,
    outputDir,
  };
}

function main(): void {
  const options = parseCliOptions(process.argv.slice(2));
  mkdirSync(options.outputDir, { recursive: true });
  const report = runBotArchetypeControlledProbe(options);
  const summaryPath = join(options.outputDir, "summary.json");
  const humanMarkdownPath = join(options.outputDir, "summary.ja.md");
  writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    humanMarkdownPath,
    buildBotArchetypeControlledProbeJapaneseMarkdown(report),
    "utf8",
  );
  console.log(JSON.stringify({
    type: "bot_archetype_controlled_probe_summary",
    data: {
      summaryPath,
      humanMarkdownPath,
      outputDir: options.outputDir,
      samplesPerScenario: report.samplesPerScenario,
      metricCount: report.metrics.length,
    },
  }));
}

main();
