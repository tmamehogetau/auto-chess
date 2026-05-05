import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { BoardUnitPlacement } from "../src/shared/room-messages";
import {
  buildBattleOnlyDiagnosticMarkdown,
  buildFactionDisabledVariant,
  runBattleOnlyDiagnostic,
  type BotBattleDiagnosticVariant,
  type BotBattleOnlyScenario,
  type BotBattleOnlyScenarioRecord,
} from "../tests/server/game-room/bot-battle-diagnostic";

export type BattleDiagnosticCliOptions = {
  scenarioPath: string;
  baselineSummaryPath?: string;
  outputDir?: string;
  matchIndex?: number;
  battleIndex?: number;
  samplesPerVariant?: number;
  seedBase?: number;
  round?: number;
  maxDurationMs?: number;
  includeBattleSamples?: boolean;
};

type BattleDiagnosticScenarioFile = BotBattleOnlyScenario & {
  variants?: BotBattleDiagnosticVariant[];
  seeds?: number[];
  samplesPerVariant?: number;
  seedBase?: number;
  maxDurationMs?: number;
  baselineVariantId?: string;
};

export function parseBattleDiagnosticCliArgs(argv: string[]): BattleDiagnosticCliOptions {
  const options: BattleDiagnosticCliOptions = {
    scenarioPath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--scenario" && nextValue) {
      options.scenarioPath = nextValue;
      index += 1;
      continue;
    }

    if ((argument === "--out-dir" || argument === "--output-dir") && nextValue) {
      options.outputDir = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--baseline-summary" && nextValue) {
      options.baselineSummaryPath = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--match-index" && nextValue) {
      options.matchIndex = parseInteger(nextValue, "--match-index");
      index += 1;
      continue;
    }

    if (argument === "--battle-index" && nextValue) {
      options.battleIndex = parseInteger(nextValue, "--battle-index");
      index += 1;
      continue;
    }

    if (argument === "--samples" && nextValue) {
      options.samplesPerVariant = parsePositiveInteger(nextValue, "--samples");
      index += 1;
      continue;
    }

    if (argument === "--seed-base" && nextValue) {
      options.seedBase = parseInteger(nextValue, "--seed-base");
      index += 1;
      continue;
    }

    if (argument === "--round" && nextValue) {
      options.round = parsePositiveInteger(nextValue, "--round");
      index += 1;
      continue;
    }

    if (argument === "--max-duration-ms" && nextValue) {
      options.maxDurationMs = parsePositiveInteger(nextValue, "--max-duration-ms");
      index += 1;
      continue;
    }

    if (argument === "--include-battles") {
      options.includeBattleSamples = true;
      continue;
    }

    if (argument === "--help") {
      console.log([
        "Usage: npm run bot:battle:diagnostic -- --scenario <path> [options]",
        "   or: npm run bot:battle:diagnostic -- --baseline-summary <path> --round <n> [options]",
        "  --scenario <path>         JSON file with leftPlacements/rightPlacements",
        "  --baseline-summary <path> Baseline summary/chunk JSON with battleDiagnosticScenarios",
        "  --out-dir <path>          Directory for summary.json and summary.md",
        "  --match-index <number>    Pick a baseline scenario by match index",
        "  --battle-index <number>   Pick a baseline scenario by battle index",
        "  --samples <number>        Generated seed count when scenario omits seeds",
        "  --seed-base <number>      Generated seed base when scenario omits seeds",
        "  --round <number>          Simulator round override",
        "  --max-duration-ms <ms>    Battle duration override",
        "  --include-battles         Include per-seed battle samples in summary.json",
      ].join("\n"));
      process.exit(0);
    }
  }

  if (options.scenarioPath.length === 0 && !options.baselineSummaryPath) {
    throw new Error("--scenario or --baseline-summary is required");
  }

  return options;
}

export function runBattleDiagnosticCli(options: BattleDiagnosticCliOptions): {
  outputDir: string;
  summaryPath: string;
  markdownPath: string;
} {
  const scenario = options.scenarioPath.length > 0
    ? readScenarioFile(resolve(options.scenarioPath))
    : readScenarioFromBaselineSummaryFile(
      resolveRequiredPath(options.baselineSummaryPath),
      buildBaselineScenarioSelection(options),
    );
  const outputDir = resolve(
    options.outputDir
      ?? join(process.cwd(), ".tmp", "bot-battle-diagnostic", new Date().toISOString().replaceAll(":", "-")),
  );

  mkdirSync(outputDir, { recursive: true });
  const report = runBattleOnlyDiagnostic({
    ...scenario,
    variants: scenario.variants?.length ? scenario.variants : [{ id: "normal" }, buildFactionDisabledVariant()],
    ...(options.samplesPerVariant !== undefined ? { samplesPerVariant: options.samplesPerVariant } : {}),
    ...(options.seedBase !== undefined ? { seedBase: options.seedBase } : {}),
    ...(options.round !== undefined ? { round: options.round } : {}),
    ...(options.maxDurationMs !== undefined ? { maxDurationMs: options.maxDurationMs } : {}),
    includeBattleSamples: options.includeBattleSamples ?? false,
  });
  const summaryPath = join(outputDir, "summary.json");
  const markdownPath = join(outputDir, "summary.md");
  writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, buildBattleOnlyDiagnosticMarkdown(report), "utf8");

  return {
    outputDir,
    summaryPath,
    markdownPath,
  };
}

function readScenarioFile(path: string): BattleDiagnosticScenarioFile {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<BattleDiagnosticScenarioFile> & {
    scenario?: Partial<BattleDiagnosticScenarioFile>;
  };
  if (parsed.scenario) {
    return normalizeScenarioFile(parsed.scenario);
  }

  return normalizeScenarioFile(parsed);
}

function normalizeScenarioFile(parsed: Partial<BattleDiagnosticScenarioFile>): BattleDiagnosticScenarioFile {
  if (!Array.isArray(parsed.leftPlacements) || !Array.isArray(parsed.rightPlacements)) {
    throw new Error("Scenario must include leftPlacements and rightPlacements arrays");
  }

  const scenario: BattleDiagnosticScenarioFile = {
    leftPlacements: parsed.leftPlacements,
    rightPlacements: parsed.rightPlacements,
  };

  if (parsed.variants !== undefined) {
    scenario.variants = parsed.variants;
  }
  if (parsed.seeds !== undefined) {
    scenario.seeds = parsed.seeds;
  }
  if (parsed.battleSeed !== undefined) {
    scenario.battleSeed = parsed.battleSeed;
  }
  if (parsed.samplesPerVariant !== undefined) {
    scenario.samplesPerVariant = parsed.samplesPerVariant;
  }
  if (parsed.seedBase !== undefined) {
    scenario.seedBase = parsed.seedBase;
  }
  if (parsed.maxDurationMs !== undefined) {
    scenario.maxDurationMs = parsed.maxDurationMs;
  }
  if (parsed.round !== undefined) {
    scenario.round = parsed.round;
  }
  if (parsed.baselineVariantId !== undefined) {
    scenario.baselineVariantId = parsed.baselineVariantId;
  }
  if (parsed.leftBossUnitIds !== undefined) {
    scenario.leftBossUnitIds = parsed.leftBossUnitIds;
  }
  if (parsed.rightBossUnitIds !== undefined) {
    scenario.rightBossUnitIds = parsed.rightBossUnitIds;
  }
  if (parsed.leftHeroSynergyBonusType !== undefined) {
    scenario.leftHeroSynergyBonusType = parsed.leftHeroSynergyBonusType;
  }
  if (parsed.rightHeroSynergyBonusType !== undefined) {
    scenario.rightHeroSynergyBonusType = parsed.rightHeroSynergyBonusType;
  }
  if (parsed.leftActiveBossSpellId !== undefined) {
    scenario.leftActiveBossSpellId = parsed.leftActiveBossSpellId;
  }
  if (parsed.rightActiveBossSpellId !== undefined) {
    scenario.rightActiveBossSpellId = parsed.rightActiveBossSpellId;
  }
  if (parsed.leftBossHpOverride !== undefined) {
    scenario.leftBossHpOverride = parsed.leftBossHpOverride;
  }
  if (parsed.rightBossHpOverride !== undefined) {
    scenario.rightBossHpOverride = parsed.rightBossHpOverride;
  }

  return scenario;
}

function readScenarioFromBaselineSummaryFile(
  path: string,
  selection: {
    matchIndex?: number;
    roundIndex?: number;
    battleIndex?: number;
  },
): BattleDiagnosticScenarioFile {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    aggregate?: { battleDiagnosticScenarios?: BotBattleOnlyScenarioRecord[] };
    battleDiagnosticScenarios?: BotBattleOnlyScenarioRecord[];
  };
  const records = parsed.aggregate?.battleDiagnosticScenarios ?? parsed.battleDiagnosticScenarios ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Baseline summary does not include battleDiagnosticScenarios");
  }

  const selected = records.find((record) =>
    (selection.matchIndex === undefined || record.matchIndex === selection.matchIndex)
    && (selection.roundIndex === undefined || record.roundIndex === selection.roundIndex)
    && (selection.battleIndex === undefined || record.battleIndex === selection.battleIndex))
    ?? null;

  if (!selected) {
    throw new Error("Could not find a baseline battle diagnostic scenario for the requested selection");
  }

  return normalizeScenarioFile(selected.scenario);
}

function buildBaselineScenarioSelection(options: BattleDiagnosticCliOptions): {
  matchIndex?: number;
  roundIndex?: number;
  battleIndex?: number;
} {
  return {
    ...(options.matchIndex !== undefined ? { matchIndex: options.matchIndex } : {}),
    ...(options.round !== undefined ? { roundIndex: options.round } : {}),
    ...(options.battleIndex !== undefined ? { battleIndex: options.battleIndex } : {}),
  };
}

function resolveRequiredPath(path: string | undefined): string {
  if (!path) {
    throw new Error("--baseline-summary is required when --scenario is omitted");
  }

  return path;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = parseInteger(value, label);
  if (parsed <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return parsed;
}

function parseInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
}

function main(): void {
  const result = runBattleDiagnosticCli(parseBattleDiagnosticCliArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    type: "bot_battle_diagnostic_summary",
    data: result,
  }));
}

if (require.main === module) {
  main();
}
