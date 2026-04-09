import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildManualPlayHumanReportText,
  normalizeManualPlayRoundPhaseContributionDamage,
  resolveManualPlayRoundTimeline,
  type ManualPlayHumanReport,
  writeManualPlayHumanReport,
} from "../../src/server/manual-play-human-log";
import type { BattleTimelineEvent } from "../../src/shared/room-messages";

function createReport(overrides: Partial<ManualPlayHumanReport> = {}): ManualPlayHumanReport {
  return {
    totalRounds: 2,
    bossPlayerId: "boss-1",
    ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
    playerLabels: {
      "boss-1": "P1",
      "raid-a": "P2",
      "raid-b": "P3",
      "raid-c": "P4",
    },
    finalPlayers: [
      { playerId: "boss-1", label: "P1", role: "boss", eliminated: false },
      { playerId: "raid-a", label: "P2", role: "raid", eliminated: true },
      { playerId: "raid-b", label: "P3", role: "raid", eliminated: true },
      { playerId: "raid-c", label: "P4", role: "raid", eliminated: true },
    ],
    rounds: [
      {
        roundIndex: 1,
        battleDurationMs: 18_420,
        phaseHpTarget: 600,
        phaseDamageDealt: 420,
        phaseResult: "failed",
        eliminations: [],
        battles: [{
          battleIndex: 0,
          unitOutcomes: [
            {
              playerId: "boss-1",
              label: "P1",
              unitId: "boss-boss-1",
              unitName: "レミリア",
              side: "boss",
              totalDamage: 120,
              phaseContributionDamage: 0,
              finalHp: 200,
              alive: true,
              starLevel: 1,
              subUnitName: "",
              isSpecialUnit: true,
            },
            {
              playerId: "raid-a",
              label: "P2",
              unitId: "nazrin",
              unitName: "ナズーリン",
              side: "raid",
              totalDamage: 180,
              phaseContributionDamage: 240,
              finalHp: 40,
              alive: true,
              starLevel: 2,
              subUnitName: "宮古芳香",
              isSpecialUnit: false,
            },
          ],
        }],
        playerConsequences: [
          {
            playerId: "raid-a",
            label: "P2",
            role: "raid",
            battleStartUnitCount: 3,
            playerWipedOut: false,
            remainingLivesBefore: 2,
            remainingLivesAfter: 2,
            eliminatedAfter: false,
          },
          {
            playerId: "raid-b",
            label: "P3",
            role: "raid",
            battleStartUnitCount: 3,
            playerWipedOut: true,
            remainingLivesBefore: 1,
            remainingLivesAfter: 0,
            eliminatedAfter: true,
          },
          {
            playerId: "raid-c",
            label: "P4",
            role: "raid",
            battleStartUnitCount: 3,
            playerWipedOut: false,
            remainingLivesBefore: 2,
            remainingLivesAfter: 2,
            eliminatedAfter: false,
          },
        ],
      },
      {
        roundIndex: 2,
        phaseHpTarget: 750,
        phaseDamageDealt: 0,
        phaseResult: "failed",
        eliminations: ["raid-a", "raid-c"],
        battles: [],
        playerConsequences: [
          {
            playerId: "raid-a",
            label: "P2",
            role: "raid",
            battleStartUnitCount: 1,
            playerWipedOut: true,
            remainingLivesBefore: 1,
            remainingLivesAfter: 0,
            eliminatedAfter: true,
          },
          {
            playerId: "raid-b",
            label: "P3",
            role: "raid",
            battleStartUnitCount: 0,
            playerWipedOut: true,
            remainingLivesBefore: 0,
            remainingLivesAfter: 0,
            eliminatedAfter: true,
          },
          {
            playerId: "raid-c",
            label: "P4",
            role: "raid",
            battleStartUnitCount: 1,
            playerWipedOut: true,
            remainingLivesBefore: 1,
            remainingLivesAfter: 0,
            eliminatedAfter: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("manual-play-human-log", () => {
  it("formats rounds, eliminations, and the final result in a human-readable report", () => {
    const text = buildManualPlayHumanReportText(createReport());

    expect(text).toContain("Round 1");
    expect(text).toContain("Boss");
    expect(text).toContain("バトル時間 18420ms");
    expect(text).toContain("ナズーリン Lv2 サブユニット宮古芳香 与ダメージ180 フェーズ貢献ダメージ420 最終HP40");
    expect(text).toContain("R1リザルト\nフェーズHP 420/600\nラウンド失敗");
    expect(text).toContain("脱落: P3");
    expect(text).toContain("R2リザルト\nフェーズHP 0/750\nラウンド失敗\n脱落: P2, P4");
    expect(text).toContain("最終リザルト\nR2でレイド側全滅\nボス勝利");
  });

  it("describes wipe failures and omits phase hp on the final judgment round", () => {
    const text = buildManualPlayHumanReportText(createReport({
      totalRounds: 12,
      rounds: Array.from({ length: 12 }, (_, index) => ({
        roundIndex: index + 1,
        battleDurationMs: 20_000,
        phaseHpTarget: 600 + index * 50,
        phaseDamageDealt: index === 0 ? 600 : 400 + index * 10,
        phaseResult: index === 0 ? "failed" : "success",
        eliminations: [],
        battles: index === 0 ? [{
          battleIndex: 0,
          unitOutcomes: [{
            playerId: "raid-a",
            label: "P2",
            unitId: "reimu",
            unitName: "霊夢",
            side: "raid" as const,
            totalDamage: 100,
            phaseContributionDamage: 100,
            finalHp: 0,
            alive: false,
            starLevel: 1,
            subUnitName: "",
            isSpecialUnit: true,
          }],
        }] : [],
        playerConsequences: [{
          playerId: "raid-a",
          label: "P2",
          role: "raid" as const,
          battleStartUnitCount: 1,
          playerWipedOut: index === 0,
          remainingLivesBefore: index === 0 ? 1 : 2,
          remainingLivesAfter: index === 0 ? 0 : 2,
          eliminatedAfter: index === 0,
        }],
      })),
    }));

    expect(text).toContain("R1リザルト\nフェーズHP 600/600\n全滅によりラウンド失敗");
    expect(text).toContain("R12リザルト\n最終判定ラウンド");
    expect(text).not.toContain("R12リザルト\nフェーズHP");
  });

  it("keeps duplicate raid copies separate when redistributing phase contribution damage", () => {
    const normalized = normalizeManualPlayRoundPhaseContributionDamage({
      roundIndex: 3,
      phaseHpTarget: 600,
      phaseDamageDealt: 90,
      phaseResult: "failed",
      eliminations: [],
      playerConsequences: [],
      battles: [{
        battleIndex: 0,
        unitOutcomes: [
          {
            battleUnitId: "raid-a-copy-1",
            playerId: "raid-a",
            label: "P2",
            unitId: "nazrin",
            unitName: "ナズーリン",
            side: "raid",
            totalDamage: 60,
            phaseContributionDamage: 0,
            finalHp: 10,
            alive: true,
            starLevel: 1,
            subUnitName: "",
            isSpecialUnit: false,
          },
          {
            battleUnitId: "raid-a-copy-2",
            playerId: "raid-a",
            label: "P2",
            unitId: "nazrin",
            unitName: "ナズーリン",
            side: "raid",
            totalDamage: 30,
            phaseContributionDamage: 0,
            finalHp: 0,
            alive: false,
            starLevel: 1,
            subUnitName: "",
            isSpecialUnit: false,
          },
        ],
      }],
    });

    const unitOutcomes = normalized.battles[0]?.unitOutcomes ?? [];
    expect(unitOutcomes.map((unit) => unit.phaseContributionDamage)).toEqual([60, 30]);
  });

  it("writes the human report to the requested file path", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "manual-play-human-log-"));
    try {
      const outputPath = join(tempDir, "manual-play-human.log");

      const writtenPath = writeManualPlayHumanReport(createReport(), outputPath);

      expect(writtenPath).toBe(outputPath);
      expect(readFileSync(outputPath, "utf8")).toContain("最終リザルト");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("prefers controller battle results when resolving a round timeline", () => {
    const roundOneTimeline: BattleTimelineEvent[] = [{
      type: "battleStart",
      battleId: "battle-r1-1",
      round: 1,
      boardConfig: { width: 6, height: 6 },
      units: [],
    }];
    const staleRoundTwoTimeline: BattleTimelineEvent[] = [{
      type: "battleStart",
      battleId: "battle-r2-1",
      round: 2,
      boardConfig: { width: 6, height: 6 },
      units: [],
    }];

    const resolved = resolveManualPlayRoundTimeline({
      roundIndex: 1,
      trackedPlayerIds: ["boss-1", "raid-a"],
      controllerBattleResultsByPlayer: new Map([
        ["boss-1", { timeline: roundOneTimeline }],
      ]),
      statePlayerBattleResults: new Map([
        ["boss-1", { timeline: staleRoundTwoTimeline }],
        ["raid-a", undefined],
      ]),
    });

    expect(resolved).toEqual(roundOneTimeline);
  });
});
