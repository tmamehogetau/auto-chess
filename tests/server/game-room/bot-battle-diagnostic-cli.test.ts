import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  parseBattleDiagnosticCliArgs,
  runBattleDiagnosticCli,
} from "../../../scripts/run-bot-battle-diagnostic";

describe("bot battle diagnostic cli", () => {
  test("parses scenario path and numeric overrides", () => {
    expect(parseBattleDiagnosticCliArgs([
      "--scenario",
      "C:\\tmp\\scenario.json",
      "--out-dir",
      "C:\\tmp\\diag",
      "--samples",
      "40",
      "--seed-base",
      "9000",
      "--round",
      "12",
      "--max-duration-ms",
      "20000",
      "--include-battles",
    ])).toEqual({
      scenarioPath: "C:\\tmp\\scenario.json",
      outputDir: "C:\\tmp\\diag",
      samplesPerVariant: 40,
      seedBase: 9000,
      round: 12,
      maxDurationMs: 20000,
      includeBattleSamples: true,
    });
  });

  test("parses baseline summary scenario selection", () => {
    expect(parseBattleDiagnosticCliArgs([
      "--baseline-summary",
      "C:\\tmp\\baseline\\summary.json",
      "--match-index",
      "17",
      "--round",
      "12",
      "--battle-index",
      "1",
    ])).toEqual({
      scenarioPath: "",
      baselineSummaryPath: "C:\\tmp\\baseline\\summary.json",
      matchIndex: 17,
      round: 12,
      battleIndex: 1,
    });
  });

  test("requires either a scenario path or baseline summary path", () => {
    expect(() => parseBattleDiagnosticCliArgs([])).toThrow("--scenario or --baseline-summary is required");
  });

  test("runs a selected scenario from a baseline summary", () => {
    const tmpRoot = join(process.cwd(), ".tmp");
    mkdirSync(tmpRoot, { recursive: true });
    const tmpDir = mkdtempSync(join(tmpRoot, "bot-battle-diagnostic-cli-"));
    const summaryPath = join(tmpDir, "summary.json");
    const outputDir = join(tmpDir, "out");
    writeFileSync(summaryPath, `${JSON.stringify({
      aggregate: {
        battleDiagnosticScenarios: [{
          matchIndex: 17,
          roundIndex: 12,
          battleIndex: 1,
          leftPlayerId: "raid-1",
          rightPlayerId: "boss-1",
          scenario: {
            round: 12,
            leftPlacements: [{ cell: 30, unitId: "junko", unitType: "mage", unitLevel: 4, factionId: "kanjuden" }],
            rightPlacements: [{ cell: 2, unitId: "remilia", unitType: "vanguard", unitLevel: 4, factionId: null }],
            rightBossUnitIds: ["remilia"],
          },
        }],
      },
    })}\n`, "utf8");

    const result = runBattleDiagnosticCli({
      scenarioPath: "",
      baselineSummaryPath: summaryPath,
      outputDir,
      matchIndex: 17,
      round: 12,
      battleIndex: 1,
      samplesPerVariant: 1,
    });

    expect(result.summaryPath).toBe(join(outputDir, "summary.json"));
    const report = JSON.parse(readFileSync(result.summaryPath, "utf8")) as {
      samplesPerVariant?: number;
      variants?: Array<{ variantId: string }>;
    };
    expect(report.samplesPerVariant).toBe(1);
    expect(report.variants?.map((variant) => variant.variantId)).toEqual(["normal", "faction-disabled"]);
  });
});
