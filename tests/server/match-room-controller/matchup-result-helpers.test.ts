import { describe, expect, it } from "vitest";

import {
  buildBattleResultAssignments,
  buildBattleResultTraceSummary,
} from "../../../src/server/match-room-controller/matchup-result-helpers";
import type { BattleResolutionResult } from "../../../src/server/match-room-controller/battle-resolution";

function createResolutionResult(
  overrides: Partial<BattleResolutionResult> = {},
): BattleResolutionResult {
  return {
    outcome: {
      winnerId: "left",
      loserId: "right",
      winnerUnitCount: 2,
      loserUnitCount: 0,
      isDraw: false,
    },
    leftBattleResult: {
      opponentId: "right",
      won: true,
      damageDealt: 10,
      damageTaken: 1,
      survivors: 2,
      opponentSurvivors: 0,
    },
    rightBattleResult: {
      opponentId: "left",
      won: false,
      damageDealt: 1,
      damageTaken: 10,
      survivors: 0,
      opponentSurvivors: 2,
    },
    ...overrides,
  };
}

describe("matchup-result-helpers", () => {
  it("keeps one-to-one assignments unchanged outside raid mode", () => {
    const resolutionResult = createResolutionResult();

    expect(buildBattleResultAssignments("left", "right", resolutionResult, null)).toEqual([
      { playerId: "left", battleResult: resolutionResult.leftBattleResult },
      { playerId: "right", battleResult: resolutionResult.rightBattleResult },
    ]);
  });

  it("fans out raid results to every raid player while preserving the boss result", () => {
    const resolutionResult = createResolutionResult({
      outcome: {
        winnerId: "boss",
        loserId: "raid-lead",
        winnerUnitCount: 1,
        loserUnitCount: 0,
        isDraw: false,
      },
      leftBattleResult: {
        opponentId: "raid-lead",
        won: true,
        damageDealt: 12,
        damageTaken: 2,
        survivors: 1,
        opponentSurvivors: 0,
      },
      rightBattleResult: {
        opponentId: "boss",
        won: false,
        damageDealt: 2,
        damageTaken: 12,
        survivors: 0,
        opponentSurvivors: 1,
      },
    });

    expect(
      buildBattleResultAssignments("boss", "raid-lead", resolutionResult, {
        bossPlayerId: "boss",
        raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
        bossIsLeft: true,
      }),
    ).toEqual([
      {
        playerId: "boss",
        battleResult: {
          ...resolutionResult.leftBattleResult,
          phaseDamageToBoss: 0,
        },
      },
      {
        playerId: "raid-a",
        battleResult: { ...resolutionResult.rightBattleResult, opponentId: "boss" },
      },
      {
        playerId: "raid-b",
        battleResult: { ...resolutionResult.rightBattleResult, opponentId: "boss" },
      },
      {
        playerId: "raid-c",
        battleResult: { ...resolutionResult.rightBattleResult, opponentId: "boss" },
      },
    ]);
  });

  it("carries aggregate raid combat damage onto the boss result for phase HP tracking", () => {
    const resolutionResult = createResolutionResult({
      leftBattleResult: {
        opponentId: "raid-lead",
        won: true,
        damageDealt: 12,
        damageTaken: 2,
        survivors: 1,
        opponentSurvivors: 0,
      },
      rightBattleResult: {
        opponentId: "boss",
        won: false,
        damageDealt: 2,
        damageTaken: 12,
        survivors: 0,
        opponentSurvivors: 1,
      },
      combatDamageDealt: {
        left: 24,
        right: 180,
      },
      phaseDamageToBossSide: 180,
    });

    expect(
      buildBattleResultAssignments("boss", "raid-lead", resolutionResult, {
        bossPlayerId: "boss",
        raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
        bossIsLeft: true,
      })[0],
    ).toEqual({
      playerId: "boss",
      battleResult: {
        ...resolutionResult.leftBattleResult,
        phaseDamageToBoss: 180,
      },
    });
  });

  it("uses boss-only damage instead of aggregate side damage for phase HP tracking", () => {
    const resolutionResult = createResolutionResult({
      leftBattleResult: {
        opponentId: "raid-lead",
        won: true,
        damageDealt: 12,
        damageTaken: 0,
        survivors: 3,
        opponentSurvivors: 0,
      },
      rightBattleResult: {
        opponentId: "boss",
        won: false,
        damageDealt: 0,
        damageTaken: 12,
        survivors: 0,
        opponentSurvivors: 3,
      },
      combatDamageDealt: {
        left: 24,
        right: 750,
      },
      bossDamageToBoss: 0,
      phaseDamageToBossSide: 0,
    });

    expect(
      buildBattleResultAssignments("boss", "raid-lead", resolutionResult, {
        bossPlayerId: "boss",
        raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
        bossIsLeft: true,
      })[0],
    ).toEqual({
      playerId: "boss",
      battleResult: {
        ...resolutionResult.leftBattleResult,
        phaseDamageToBoss: 0,
      },
    });
  });

  it("uses escort defeat bonus as phase HP damage when the boss itself is unharmed", () => {
    const resolutionResult = createResolutionResult({
      leftBattleResult: {
        opponentId: "raid-lead",
        won: true,
        damageDealt: 12,
        damageTaken: 0,
        survivors: 2,
        opponentSurvivors: 0,
      },
      rightBattleResult: {
        opponentId: "boss",
        won: false,
        damageDealt: 0,
        damageTaken: 12,
        survivors: 0,
        opponentSurvivors: 2,
      },
      bossDamageToBoss: 0,
      phaseDamageToBossSide: 40,
    });

    expect(
      buildBattleResultAssignments("boss", "raid-lead", resolutionResult, {
        bossPlayerId: "boss",
        raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
        bossIsLeft: true,
      })[0],
    ).toEqual({
      playerId: "boss",
      battleResult: {
        ...resolutionResult.leftBattleResult,
        phaseDamageToBoss: 40,
      },
    });
  });

  it("builds a draw trace summary without damage attribution", () => {
    const resolutionResult = createResolutionResult({
      outcome: {
        winnerId: null,
        loserId: null,
        winnerUnitCount: 0,
        loserUnitCount: 0,
        isDraw: true,
      },
    });

    expect(buildBattleResultTraceSummary("left", resolutionResult)).toEqual({
      winner: "draw",
      leftSurvivors: 2,
      rightSurvivors: 0,
      leftDamageTaken: 0,
      rightDamageTaken: 0,
    });
  });

  it("attributes trace damage to the losing side for non-draw results", () => {
    const resolutionResult = createResolutionResult();

    expect(buildBattleResultTraceSummary("left", resolutionResult)).toEqual({
      winner: "left",
      leftSurvivors: 2,
      rightSurvivors: 0,
      leftDamageTaken: 0,
      rightDamageTaken: 10,
    });
  });
});
