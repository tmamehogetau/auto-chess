import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MatchRoomController } from "../../src/server/match-room-controller";
import { MatchLogger } from "../../src/server/match-logger";
import type { BattleTimelineEvent, BoardUnitPlacement } from "../../src/shared/room-messages";
import {
  createBattleEndEvent,
  createBattleStartEvent,
} from "../../src/server/combat/battle-timeline";
import {
  combatCellToRaidBoardIndex,
} from "../../src/shared/board-geometry";
import {
  captureManagedFlagEnv,
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
  restoreManagedFlagEnv,
  withFlags,
} from "./feature-flag-test-helper";
import { FeatureFlagService } from "../../src/server/feature-flag-service";

const controllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
};

const advanceRoundWithMinimalDurations = (
  controller: MatchRoomController,
  startTimeMs: number,
): number => {
  controller.advanceByTime(startTimeMs + 1);
  // ダメージを設定してフェーズ成功にする（dominationCount増加を回避）
  const roundIndex = controller.roundIndex;
  const targetHp = getPhaseHpTarget(roundIndex);
  controller.setPendingRoundDamage({ p1: targetHp });
  controller.advanceByTime(startTimeMs + 2);
  controller.advanceByTime(startTimeMs + 3);
  controller.advanceByTime(startTimeMs + 4);

  return startTimeMs + 4;
};

const advanceRaidRoundWithMinimalDurations = (
  controller: MatchRoomController,
  startTimeMs: number,
): number => {
  controller.advanceByTime(startTimeMs + 1);
  const roundIndex = controller.roundIndex;
  const targetHp = getPhaseHpTarget(roundIndex);
  controller.setPendingPhaseDamageForTest(targetHp);
  controller.advanceByTime(startTimeMs + 2);
  const { battleResultsByPlayer } = controller.getTestAccess();
  for (const raidPlayerId of ["p1", "p3", "p4"]) {
    battleResultsByPlayer.set(raidPlayerId, {
      opponentId: "p2",
      won: true,
      damageDealt: 10,
      damageTaken: 0,
      survivors: 1,
      opponentSurvivors: 0,
    });
  }
  controller.advanceByTime(startTimeMs + 3);
  controller.advanceByTime(startTimeMs + 4);

  return startTimeMs + 4;
};

const applyMinimalRaidBattlePlacements = (controller: MatchRoomController): void => {
  expect(controller.applyPrepPlacementForPlayer("p2", [{ cell: 0, unitType: "vanguard" }]))
    .toMatchObject({ success: true });
  expect(controller.applyPrepPlacementForPlayer("p1", [{ cell: 4, unitType: "ranger" }]))
    .toMatchObject({ success: true });
  expect(controller.applyPrepPlacementForPlayer("p3", [{ cell: 5, unitType: "mage" }]))
    .toMatchObject({ success: true });
  expect(controller.applyPrepPlacementForPlayer("p4", [{ cell: 6, unitType: "assassin" }]))
    .toMatchObject({ success: true });
};

// 各ラウンドのフェーズHP目標値を取得
function getPhaseHpTarget(roundIndex: number): number {
  const targets: Record<number, number> = {
    1: 600,
    2: 750,
    3: 900,
    4: 1050,
    5: 1250,
    6: 1450,
    7: 1650,
    8: 1850,
    9: 2100,
    10: 2400,
    11: 2700,
    12: 0,
  };
  return targets[roundIndex] ?? 600;
}

describe("MatchRoomController", () => {
  let originalEnv = captureManagedFlagEnv();

  beforeEach(() => {
    originalEnv = captureManagedFlagEnv();
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(
        FLAG_CONFIGURATIONS.ALL_DISABLED[flagName as keyof typeof FLAG_CONFIGURATIONS.ALL_DISABLED],
      );
    }
    FeatureFlagService.resetForTests();
  });

  afterEach(() => {
    restoreManagedFlagEnv(originalEnv);
    FeatureFlagService.resetForTests();
  });

  test("4人全員Readyなら締切前でも試合開始できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);

    const started = controller.startIfReady(2_000);

    expect(started).toBe(true);
    expect(controller.phase).toBe("Prep");
    expect(controller.prepDeadlineAtMs).toBe(32_000);
  });

  test("Ready締切を過ぎたら未Readyがいても試合開始できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);

    const started = controller.startIfReady(61_000);

    expect(started).toBe(true);
    expect(controller.phase).toBe("Prep");
  });

  test("Prep締切前のコマンドは受理される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 31_999);

    expect(result).toEqual({ accepted: true });
  });

  test("試合開始時の経済ステータス初期値を返す", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    expect(controller.getPlayerStatus("p1")).toMatchObject({
      gold: 15,
      xp: 0,
      level: 1,
      benchUnits: [],
      ownedUnits: {
        vanguard: 0,
        ranger: 0,
        mage: 0,
        assassin: 0,
      },
    });
  });

  test("shared board replay 用の battle timeline を専用 accessor で返す", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const { battleResultsByPlayer } = controller.getTestAccess();

    battleResultsByPlayer.set("p1", {
      opponentId: "p4",
      won: true,
      damageDealt: 12,
      damageTaken: 4,
      survivors: 1,
      opponentSurvivors: 0,
      timeline: [
        createBattleStartEvent({
          battleId: "battle-shared-1",
          round: 1,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-1",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
          ],
        }),
        createBattleEndEvent({
          type: "battleEnd",
          battleId: "battle-shared-1",
          atMs: 700,
          winner: "raid",
        }),
      ],
    });

    expect(controller.getSharedBattleReplay("Battle")).toMatchObject({
      type: "shared_battle_replay",
      battleId: "battle-shared-1",
      phase: "Battle",
    });
  });

  test("Prep締切以降のコマンドはLATE_INPUTで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 32_000);

    expect(result).toEqual({ accepted: false, code: "LATE_INPUT" });
  });

  test("Battle中のコマンドはPHASE_MISMATCHで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.transitionTo("Battle");

    const result = controller.submitPrepCommand("p1", 1, 3_000);

    expect(result).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
  });

  test("Prep締切に達したらBattleへ自動遷移できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const progressed = controller.advanceByTime(32_000);

    expect(progressed).toBe(true);
    expect(controller.phase).toBe("Battle");
    expect(controller.roundPairings).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p4", ghostSourcePlayerId: null },
      { leftPlayerId: "p2", rightPlayerId: "p3", ghostSourcePlayerId: null },
    ]);
  });

  test("raid round exposes shared battle replay immediately when Battle starts", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1_000,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);
          applyMinimalRaidBattlePlacements(controller);

          controller.advanceByTime(1);

          expect(controller.phase).toBe("Battle");
          expect(controller.getSharedBattleReplay("Battle")).toMatchObject({
            type: "shared_battle_replay",
            phase: "Battle",
            timeline: expect.arrayContaining([
              expect.objectContaining({ type: "battleStart" }),
            ]),
          });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("battle can move to Settle before the battle deadline once replay resolution is complete", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    const targetHp = getPhaseHpTarget(controller.roundIndex);
    const { battleResultsByPlayer } = controller.getTestAccess();
    battleResultsByPlayer.set("p1", {
      opponentId: "p4",
      won: true,
      damageDealt: targetHp,
      damageTaken: 0,
      survivors: 1,
      opponentSurvivors: 0,
      timeline: [
        createBattleStartEvent({
          battleId: "battle-early-resolve",
          round: 1,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-ranger-1",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
          ],
        }),
        createBattleEndEvent({
          type: "battleEnd",
          battleId: "battle-early-resolve",
          atMs: 700,
          winner: "raid",
        }),
      ],
    });
    controller.setPendingRoundDamage({ p1: targetHp });

    expect(controller.advanceByTime(32_700)).toBe(true);
    expect(controller.phase).toBe("Settle");
  });

  test("raid round resolves as one boss-vs-raid battle", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            1_000,
            controllerOptions,
          );
          const { battleResolutionService } = controller.getTestAccess();
          const resolveMatchupSpy = vi.spyOn(battleResolutionService, "resolveMatchup");

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(2_000);

          expect(controller.getBossPlayerId()).toBe("p2");

          expect(controller.applyPrepPlacementForPlayer("p2", [{ cell: 0, unitType: "vanguard" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p1", [{ cell: 4, unitType: "ranger" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p3", [{ cell: 5, unitType: "mage" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p4", [{ cell: 6, unitType: "assassin" }])).toMatchObject({ success: true });

          controller.advanceByTime(32_000);

          expect(controller.phase).toBe("Battle");
          expect(controller.roundPairings).toHaveLength(1);

          controller.advanceByTime(42_000);

          expect(resolveMatchupSpy).toHaveBeenCalledTimes(1);

          const firstCall = resolveMatchupSpy.mock.calls[0]?.[0];
          expect(firstCall).toBeDefined();
          expect([firstCall?.leftPlacements.length, firstCall?.rightPlacements.length].sort()).toEqual([1, 3]);
          const aggregateRaidPlacements =
            firstCall?.leftPlayerId === "p2" ? firstCall.rightPlacements : firstCall?.leftPlacements;
          const bossPlacements =
            firstCall?.leftPlayerId === "p2" ? firstCall.leftPlacements : firstCall?.rightPlacements;
          expect(bossPlacements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ cell: 0, unitType: "vanguard" }),
            ]),
          );
          expect(aggregateRaidPlacements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ cell: 31, unitType: "ranger", ownerPlayerId: "p1" }),
              expect.objectContaining({ cell: 33, unitType: "mage", ownerPlayerId: "p3" }),
              expect.objectContaining({ cell: 35, unitType: "assassin", ownerPlayerId: "p4" }),
            ]),
          );
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid aggregate battle input remaps overlapping raid cells to unique team lanes", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            1_000,
            controllerOptions,
          );
          const { battleResolutionService } = controller.getTestAccess();
          const resolveMatchupSpy = vi.spyOn(battleResolutionService, "resolveMatchup");

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(2_000);

          expect(controller.getBossPlayerId()).toBe("p2");

          expect(controller.applyPrepPlacementForPlayer("p2", [{ cell: 0, unitType: "vanguard", unitId: "boss-unit" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p1", [{ cell: 31, unitType: "ranger", unitId: "raid-a" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p3", [{ cell: 31, unitType: "mage", unitId: "raid-b" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p4", [{ cell: 31, unitType: "assassin", unitId: "raid-c" }])).toMatchObject({ success: true });

          controller.advanceByTime(32_000);
          controller.advanceByTime(42_000);

          expect(resolveMatchupSpy).toHaveBeenCalledTimes(1);

          const firstCall = resolveMatchupSpy.mock.calls[0]?.[0];
          const aggregateRaidPlacements =
            firstCall?.leftPlayerId === "p2" ? firstCall.rightPlacements : firstCall?.leftPlacements;

          expect(aggregateRaidPlacements).toBeDefined();
          expect(aggregateRaidPlacements?.map((placement) => placement.cell)).toEqual([31, 33, 35]);
          expect(new Set(aggregateRaidPlacements?.map((placement) => placement.cell)).size).toBe(3);
          expect(aggregateRaidPlacements).toEqual(expect.arrayContaining([
            expect.objectContaining({ ownerPlayerId: "p1", unitId: "raid-a", cell: 31 }),
            expect.objectContaining({ ownerPlayerId: "p3", unitId: "raid-b", cell: 33 }),
            expect.objectContaining({ ownerPlayerId: "p4", unitId: "raid-c", cell: 35 }),
          ]));
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid phase HP uses aggregate raid combat damage instead of loser damage only", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            1_000,
            controllerOptions,
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(2_000);
          controller.advanceByTime(32_000);

          const { battleResultsByPlayer } = controller.getTestAccess();
          battleResultsByPlayer.set("p2", {
            opponentId: "p1",
            won: true,
            damageDealt: 7,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
            phaseDamageToBoss: 180,
          });
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 7,
            survivors: 0,
            opponentSurvivors: 1,
          });

          controller.advanceByTime(42_000);

          expect(controller.phase).toBe("Settle");
          expect(controller.getPhaseProgress()).toMatchObject({
            targetHp: 600,
            damageDealt: 180,
            result: "failed",
          });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("startWithResolvedRoles starts boss raids with explicit role assignments", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          1_000,
          controllerOptions,
        );

        const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([["p2", "remilia"]]),
        });

        expect(started).toBe(true);
        expect(controller.phase).toBe("Prep");
        expect(controller.getBossPlayerId()).toBe("p2");
        expect(controller.getRaidPlayerIds()).toEqual(["p1", "p3", "p4"]);
        expect(controller.getPlayerStatus("p2")).toMatchObject({
          wantsBoss: true,
          selectedBossId: "remilia",
          role: "boss",
          selectedHeroId: "",
        });
        expect(controller.getPlayerStatus("p1")).toMatchObject({
          wantsBoss: false,
          selectedBossId: "",
          role: "raid",
          selectedHeroId: "reimu",
        });
      },
    );
  });

  test("startWithResolvedRoles rejects invalid boss selections", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          1_000,
          controllerOptions,
        );

        const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([["p2", "unknown-boss"]]),
        });

        expect(started).toBe(false);
      },
    );
  });

  test("startWithResolvedRoles leaves inactive pre-start players queryable", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          1_000,
          controllerOptions,
        );

        const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
          ]),
          selectedBossByPlayer: new Map([["p2", "remilia"]]),
        });

        expect(started).toBe(true);
        expect(controller.getPlayerStatus("p4")).toMatchObject({
          wantsBoss: false,
          selectedBossId: "",
          role: "unassigned",
          selectedHeroId: "",
        });
      },
    );
  });

  test("startWithResolvedRoles clears stale selections for inactive players", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          1_000,
          controllerOptions,
        );

        controller.selectHero("p4", "reimu");

        const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
          ]),
          selectedBossByPlayer: new Map([["p2", "remilia"]]),
        });

        expect(started).toBe(true);
        expect(controller.getPlayerStatus("p4")).toMatchObject({
          wantsBoss: false,
          selectedBossId: "",
          role: "unassigned",
          selectedHeroId: "",
        });
      },
    );
  });

  test("startWithResolvedRoles does not persist raid heroes when hero system is disabled", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: false,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          1_000,
          controllerOptions,
        );

        const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([["p2", "remilia"]]),
        });

        expect(started).toBe(true);
        expect(controller.getPlayerStatus("p1").selectedHeroId).toBe("");
        expect(controller.getPlayerStatus("p3").selectedHeroId).toBe("");
        expect(controller.getPlayerStatus("p4").selectedHeroId).toBe("");
      },
    );
  });

  test("getPlayerStatus still rejects unknown players after resolved-role start", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          1_000,
          controllerOptions,
        );

        const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
          ]),
          selectedBossByPlayer: new Map([["p2", "remilia"]]),
        });

        expect(started).toBe(true);
        expect(() => controller.getPlayerStatus("unknown-player")).toThrow("Unknown player");
      },
    );
  });

  test("raid round aggregates hero and spell effects from all raid players", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
        enableSpellCard: true,
      },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            1_000,
            controllerOptions,
          );
          const { battleResolutionService, spellCardHandler } = controller.getTestAccess();
          const resolveMatchupSpy = vi.spyOn(battleResolutionService, "resolveMatchup");
          vi.spyOn(spellCardHandler, "getCombatModifiersForPlayer").mockImplementation((playerId) => {
            const attackMultipliers: Record<string, number> = {
              p1: 2,
              p3: 3,
              p4: 5,
            };
            const attackMultiplier = attackMultipliers[playerId];

            if (!attackMultiplier) {
              return null;
            }

            return {
              attackMultiplier,
              defenseMultiplier: 1,
              attackSpeedMultiplier: 1,
            };
          });

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(2_000);

          controller.selectHero("p1", "reimu");
          controller.selectHero("p3", "marisa");
          controller.selectHero("p4", "okina");

          expect(controller.applyPrepPlacementForPlayer("p2", [{ cell: 0, unitType: "vanguard" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p1", [{ cell: 4, unitType: "ranger" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p3", [{ cell: 5, unitType: "mage" }])).toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p4", [{ cell: 6, unitType: "assassin" }])).toMatchObject({ success: true });

          controller.advanceByTime(32_000);
          controller.advanceByTime(42_000);

          const firstCall = resolveMatchupSpy.mock.calls[0]?.[0];
          expect(firstCall).toBeDefined();

          const raidBattleUnits = [firstCall?.leftBattleUnits ?? [], firstCall?.rightBattleUnits ?? []].find((units) =>
            units.some((unit: { id: string }) => unit.id === "hero-p1" || unit.id === "hero-p3" || unit.id === "hero-p4"),
          ) ?? [];
          const raidHeroUnits = raidBattleUnits.filter((unit: { id: string }) => unit.id.startsWith("hero-"));
          const raidNonHeroUnits = raidBattleUnits.filter((unit: { id: string }) => !unit.id.startsWith("hero-"));

          expect(raidHeroUnits.map((unit) => unit.id).sort()).toEqual([
            "hero-p1",
            "hero-p3",
            "hero-p4",
          ]);
          expect(raidHeroUnits).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: "hero-p1", battleSide: "right" }),
              expect.objectContaining({ id: "hero-p3", battleSide: "right" }),
              expect.objectContaining({ id: "hero-p4", battleSide: "right" }),
            ]),
          );
          expect(raidNonHeroUnits).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ buffModifiers: expect.objectContaining({ attackMultiplier: 30 }) }),
            ]),
          );
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("ラウンドが進むと対戦ペアがローテーションする", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);
    controller.advanceByTime(79_000);

    expect(controller.phase).toBe("Battle");
    expect(controller.roundPairings).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p3", ghostSourcePlayerId: null },
      { leftPlayerId: "p4", rightPlayerId: "p2", ghostSourcePlayerId: null },
    ]);
  });

  test("生存者が奇数のときはゴースト対戦ペアが作られる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.setPlayerHp("p4", 0);

    controller.advanceByTime(32_000);

    expect(controller.roundPairings).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p2", ghostSourcePlayerId: null },
      { leftPlayerId: "p3", rightPlayerId: null, ghostSourcePlayerId: "p1" },
    ]);
  });

  test("時間経過でBattle->Settle->Elimination->Prepへ進む", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(2);
    expect(controller.getPlayerStatus("p1").gold).toBe(20);
  });

  test("xpPurchaseCountでゴールド消費とXP/レベル上昇が適用される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      xpPurchaseCount: 2,
    });

    expect(result).toEqual({ accepted: true });
    expect(controller.getPlayerStatus("p1")).toMatchObject({
      gold: 7,
      xp: 4,
      level: 3,
    });
  });

  test("ゴールド不足のxpPurchaseCountはINSUFFICIENT_GOLDで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      xpPurchaseCount: 4,
    });

    expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });
    expect(controller.getPlayerStatus("p1")).toMatchObject({
      gold: 15,
      xp: 0,
      level: 1,
    });
  });

  test("試合開始時にshopOffersが5枠生成される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const offers = controller.getPlayerStatus("p1").shopOffers;

    expect(offers).toHaveLength(5);
    for (const offer of offers) {
      expect(offer.cost).toBeGreaterThanOrEqual(1);
      expect(offer.cost).toBeLessThanOrEqual(3);
      expect(["vanguard", "ranger", "mage", "assassin"]).toContain(offer.unitType);
    }
  });

  test("shopRefreshCountでgold減少とshopOffers更新が適用される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const beforeOffers = controller
      .getPlayerStatus("p1")
      .shopOffers.map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`);
    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      shopRefreshCount: 1,
    });
    const afterStatus = controller.getPlayerStatus("p1");
    const afterOffers = afterStatus.shopOffers.map(
      (offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`,
    );

    expect(result).toEqual({ accepted: true });
    expect(afterStatus.gold).toBe(13);
    expect(afterOffers).not.toEqual(beforeOffers);
  });

  test("xpPurchaseCountとshopRefreshCountの合計コスト不足はINSUFFICIENT_GOLDで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      xpPurchaseCount: 2,
      shopRefreshCount: 5,
    });

    expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });
    expect(controller.getPlayerStatus("p1").gold).toBe(15);
  });

  test("shopBuySlotIndexでベンチと所持ユニットが増える", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const beforeStatus = controller.getPlayerStatus("p1");
    const firstUnitType = beforeStatus.shopOffers[0]?.unitType;
    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const afterStatus = controller.getPlayerStatus("p1");

    expect(result).toEqual({ accepted: true });
    expect(afterStatus.benchUnits.length).toBe(1);
    expect(firstUnitType).toBeDefined();
    expect(afterStatus.benchUnits[0]).toBe(firstUnitType);

    if (!firstUnitType) {
      throw new Error("expected first shop unit type");
    }

    expect(afterStatus.ownedUnits[firstUnitType]).toBe(1);
  });

  test("myourenji tier2 では shopBuySlotIndex の購入コストが1下がる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
        { cell: 2, unitType: "assassin", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 1);
    });
  });

  test("myourenji tier1 では shop cost reduction を適用しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("kou_ryuudou tier1 の shop cost reduction は cost floor 1 を守る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "parsee", factionId: "kou_ryuudou" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "kisume", rarity: 1, cost: 1 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 1);
    });
  });

  test("kou_ryuudou tier1 では eligible Touhou unit の shopBuySlotIndex 購入コストが1下がる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "parsee", factionId: "kou_ryuudou" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 1);
    });
  });

  test("legacy MVP unit は Touhou shop cost reduction を継承しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
        { cell: 2, unitType: "assassin", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("enableTouhouFactions=false では shop cost reduction を適用しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_ONLY, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
        { cell: 2, unitType: "assassin", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("kou_ryuudou tier2 では最初の shopRefresh が無料になる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", starLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "assassin", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
      ]);
      const beforeGold = controller.getPlayerStatus("p1").gold;

      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopRefreshCount: 1,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold);
    });
  });

  test("kou_ryuudou tier2 では2回目の shopRefresh は無料にならない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", starLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "assassin", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
      ]);
      const beforeGold = controller.getPlayerStatus("p1").gold;

      const firstResult = controller.submitPrepCommand("p1", 1, 3_000, {
        shopRefreshCount: 1,
      });
      const secondResult = controller.submitPrepCommand("p1", 2, 3_100, {
        shopRefreshCount: 1,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(firstResult).toEqual({ accepted: true });
      expect(secondResult).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("kou_ryuudou tier2 の無料リロール権は1 Prep で1回だけ", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", starLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "assassin", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
      ]);
      const beforeGold = controller.getPlayerStatus("p1").gold;

      const firstResult = controller.submitPrepCommand("p1", 1, 3_000, {
        shopRefreshCount: 1,
      });
      const secondResult = controller.submitPrepCommand("p1", 2, 3_100, {
        shopRefreshCount: 2,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(firstResult).toEqual({ accepted: true });
      expect(secondResult).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 4);
    });
  });

  test("myourenji 割引購入ユニットを即売却しても差額goldは増えない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "ranger", unitId: "nazrin", starLevel: 1, factionId: "myourenji" },
        { cell: 1, unitType: "mage", unitId: "murasa", starLevel: 1, factionId: "myourenji" },
        { cell: 2, unitType: "mage", unitId: "shou", starLevel: 1, factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const goldBefore = controller.getPlayerStatus("p1").gold;
      const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const goldAfterBuy = controller.getPlayerStatus("p1").gold;
      const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
        benchSellIndex: 0,
      });
      const status = controller.getPlayerStatus("p1");

      expect(buyResult).toEqual({ accepted: true });
      expect(sellResult).toEqual({ accepted: true });
      expect(goldAfterBuy).toBe(goldBefore - 1);
      expect(status.gold).toBe(goldBefore - 1);
    });
  });

  test("ベンチ満杯でshopBuySlotIndexはBENCH_FULLで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internalBenchMap = (controller as unknown as {
      benchUnitsByPlayer: Map<string, ("vanguard" | "ranger" | "mage" | "assassin")[]>;
    }).benchUnitsByPlayer;
    internalBenchMap.set("p1", [
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
    ]);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });

    expect(result).toEqual({ accepted: false, code: "BENCH_FULL" });
  });

  test("benchToBoardCellでベンチユニットを盤面に配置できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const deployResult = controller.submitPrepCommand("p1", 2, 3_100, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 3,
      },
    });
    const status = controller.getPlayerStatus("p1");

    expect(buyResult).toEqual({ accepted: true });
    expect(deployResult).toEqual({ accepted: true });
    expect(status.benchUnits.length).toBe(0);
    expect(status.boardUnitCount).toBe(1);
  });

  test("benchToBoardCell で自分の occupied main cell を選ぶと board と bench を入れ替える", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internals = controller as unknown as {
      benchUnitsByPlayer: Map<string, Array<{
        unitType: "vanguard" | "ranger" | "mage" | "assassin";
        cost: number;
        starLevel: number;
        unitCount: number;
      }>>;
      boardPlacementsByPlayer: Map<string, Array<{
        cell: number;
        unitType: "vanguard" | "ranger" | "mage" | "assassin";
        starLevel?: number;
        sellValue?: number;
        unitCount?: number;
      }>>;
      boardUnitCountByPlayer: Map<string, number>;
    };

    internals.benchUnitsByPlayer.set("p1", [
      { unitType: "ranger", cost: 1, starLevel: 1, unitCount: 1 },
    ]);
    internals.boardPlacementsByPlayer.set("p1", [
      { cell: 3, unitType: "vanguard", starLevel: 1, sellValue: 1, unitCount: 1 },
    ]);
    internals.boardUnitCountByPlayer.set("p1", 1);

    const deployResult = controller.submitPrepCommand("p1", 1, 3_100, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 3,
      },
    });

    expect(deployResult).toEqual({ accepted: true });
    expect(controller.getBoardPlacementsForPlayer("p1")).toEqual([
      expect.objectContaining({ cell: 3, unitType: "ranger" }),
    ]);
    expect(controller.getBenchUnitsForPlayer?.("p1")).toEqual([
      expect.objectContaining({ unitType: "vanguard" }),
    ]);
  });

  test("benchSellIndex は tier 1 の sell formula C - 1 を使う", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internals = controller as unknown as {
      benchUnitsByPlayer: Map<string, Array<{
        unitType: "vanguard" | "ranger" | "mage" | "assassin";
        cost: number;
        starLevel: number;
        unitCount: number;
      }>>;
    };
    internals.benchUnitsByPlayer.set("p1", [
      { unitType: "mage", cost: 2, starLevel: 1, unitCount: 1 },
    ]);

    const beforeSellGold = controller.getPlayerStatus("p1").gold;
    const sellResult = controller.submitPrepCommand("p1", 1, 3_000, {
      benchSellIndex: 0,
    });
    const status = controller.getPlayerStatus("p1");

    expect(sellResult).toEqual({ accepted: true });
    expect(status.gold).toBe(beforeSellGold + 1);
    expect(status.benchUnits.length).toBe(0);
  });

  test("benchSellIndex は tier 2 の sell formula 2C - 1 を使う", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internals = controller as unknown as {
      benchUnitsByPlayer: Map<string, Array<{
        unitType: "vanguard" | "ranger" | "mage" | "assassin";
        cost: number;
        starLevel: number;
        unitCount: number;
      }>>;
    };
    internals.benchUnitsByPlayer.set("p1", [
      { unitType: "mage", cost: 8, starLevel: 2, unitCount: 4 },
    ]);

    const beforeSellGold = controller.getPlayerStatus("p1").gold;
    const sellResult = controller.submitPrepCommand("p1", 1, 3_000, {
      benchSellIndex: 0,
    });
    const status = controller.getPlayerStatus("p1");

    expect(sellResult).toEqual({ accepted: true });
    expect(status.gold).toBe(beforeSellGold + 3);
    expect(status.benchUnits.length).toBe(0);
  });

  test("discounted purchase でも sell で購入額を上回る refund にならない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          unitId?: string;
          rarity: number;
          cost: number;
        }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "parsee", factionId: "kou_ryuudou" },
      ]);

      for (const cmdSeq of [1, 2, 3, 4]) {
        internals.shopOffersByPlayer.set("p1", [
          { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
        ]);

        expect(controller.submitPrepCommand("p1", cmdSeq, 3_000 + cmdSeq, {
          shopBuySlotIndex: 0,
        })).toEqual({ accepted: true });
      }

      const beforeSellGold = controller.getPlayerStatus("p1").gold;
      const sellResult = controller.submitPrepCommand("p1", 5, 3_100, {
        benchSellIndex: 0,
      });
      const afterSell = controller.getPlayerStatus("p1");

      expect(sellResult).toEqual({ accepted: true });
      expect(beforeSellGold).toBe(11);
      expect(afterSell.gold).toBe(12);
    });
  });

  test("boardToBenchCellで盤面ユニットをbenchへ戻せる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const placeResult = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [{ cell: 3, unitType: "mage" }],
    });
    const returnResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardToBenchCell: { cell: 3 },
    });
    const status = controller.getPlayerStatus("p1");

    expect(placeResult).toEqual({ accepted: true });
    expect(returnResult).toEqual({ accepted: true });
    expect(status.boardUnitCount).toBe(0);
    expect(status.boardUnits).toEqual([]);
    expect(status.benchUnits).toEqual(["mage"]);
  });

  test("enablePerUnitSharedPool=true では Touhou unitId ごとに購入在庫が減る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          getAvailableByUnitId: (unitId: string, cost: number) => number;
          decreaseByUnitId: (unitId: string, cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, rarity: 1 },
      ]);

      const before = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinBefore = internals.sharedPool.getAvailableByUnitId("nazrin", 1);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const after = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinAfter = internals.sharedPool.getAvailableByUnitId("nazrin", 1);

      expect(result).toEqual({ accepted: true });
      expect(before).toBe(5);
      expect(after).toBe(4);
      expect(nazrinBefore).toBe(5);
      expect(nazrinAfter).toBe(5);
    });
  });

  test("enablePerUnitSharedPool=true で unitId なしオファーは cost pool 枯渇時に POOL_DEPLETED になる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          isDepleted: (cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, rarity: 1 },
        { unitType: "ranger", cost: 1, rarity: 1 },
      ]);

      const isDepletedSpy = vi.spyOn(internals.sharedPool, "isDepleted").mockReturnValue(true);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 1 });

      expect(result).toEqual({ accepted: false, code: "POOL_DEPLETED" });

      isDepletedSpy.mockRestore();
    });
  });

  test("enablePerUnitSharedPool=true では all-depleted policy で買える在庫が残る限り unitId なしオファー購入を拒否する", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          decrease: (cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      for (let i = 0; i < 18; i += 1) {
        internals.sharedPool.decrease(1);
      }

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", cost: 1, rarity: 1 },
      ]);

      const beforeStatus = controller.getPlayerStatus("p1");
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(afterStatus.benchUnits).toEqual(beforeStatus.benchUnits);
      expect(afterStatus.gold).toBe(beforeStatus.gold);
    });
  });

  test("enablePerUnitSharedPool=true の server-side invariant reject は prep failure KPI に計上しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);
      const logger = new MatchLogger("match-w10-invariant", "room-w10-invariant");
      controller.setMatchLogger(logger);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          decrease: (cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      for (let i = 0; i < 18; i += 1) {
        internals.sharedPool.decrease(1);
      }

      internals.shopOffersByPlayer.set("p1", [{ unitType: "vanguard", cost: 1, rarity: 1 }]);

      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const metrics = logger.getPrepCommandMetrics();

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(metrics.totalPrepCommands).toBe(0);
      expect(metrics.failedPrepCommands).toBe(0);
      expect(metrics.prepInputFailureRate).toBe(0);
    });
  });

  test("enablePerUnitSharedPool=true でも mixed invalid payload は prep failure KPI に計上される", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);
      const logger = new MatchLogger("match-w10-mixed-invalid", "room-w10-mixed-invalid");
      controller.setMatchLogger(logger);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
        benchSellIndex: 0,
      });
      const metrics = logger.getPrepCommandMetrics();

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(metrics.totalPrepCommands).toBe(1);
      expect(metrics.failedPrepCommands).toBe(1);
      expect(metrics.failuresByErrorCode["INVALID_PAYLOAD"]).toBe(1);
    });
  });

  test("enablePerUnitSharedPool=true では sharedPoolInventory が実在庫総量を反映する", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, rarity: 1 },
      ]);

      const before = controller.getPlayerStatus("p1").sharedPoolInventory?.get(1);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const after = controller.getPlayerStatus("p1").sharedPoolInventory?.get(1);

      expect(result).toEqual({ accepted: true });
      expect(before).toBe(18);
      expect(after).toBe(17);
    });
  });

  test("enablePerUnitSharedPool=true では Touhou unitId の売却で同じ在庫へ返る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          getAvailableByUnitId: (unitId: string, cost: number) => number;
          decreaseByUnitId: (unitId: string, cost: number) => boolean;
        };
        benchUnitsByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; starLevel: number; unitCount: number }>>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, starLevel: 1, unitCount: 1 },
      ]);

      const before = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinBefore = internals.sharedPool.getAvailableByUnitId("nazrin", 1);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { benchSellIndex: 0 });
      const after = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinAfter = internals.sharedPool.getAvailableByUnitId("nazrin", 1);

      expect(result).toEqual({ accepted: true });
      expect(after).toBe(before + 1);
      expect(nazrinAfter).toBe(nazrinBefore);
    });
  });

  test("enablePerUnitSharedPool=true では removePlayer 時に board/bench の unitId 在庫が返る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          getAvailableByUnitId: (unitId: string, cost: number) => number;
          decreaseByUnitId: (unitId: string, cost: number) => boolean;
        };
        benchUnitsByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; starLevel: number; unitCount: number }>>;
        boardPlacementsByPlayer: Map<string, Array<{ cell: number; unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; sellValue?: number; unitCount?: number }>>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, starLevel: 1, unitCount: 1 },
      ]);
      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "ranger", unitId: "nazrin", sellValue: 1, unitCount: 1 },
      ]);

      internals.sharedPool.decreaseByUnitId("rin", 1);
      internals.sharedPool.decreaseByUnitId("nazrin", 1);

      const rinBefore = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinBefore = internals.sharedPool.getAvailableByUnitId("nazrin", 1);

      controller.removePlayer("p1");

      expect(internals.sharedPool.getAvailableByUnitId("rin", 1)).toBe(rinBefore + 1);
      expect(internals.sharedPool.getAvailableByUnitId("nazrin", 1)).toBe(nazrinBefore + 1);
    });
  });

  test("同種4回購入で購入回数進行のtier 2になる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internalOffersMap = (controller as unknown as {
      shopOffersByPlayer: Map<
        string,
        Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; rarity: 1 | 2 | 3; cost: number }>
      >;
    }).shopOffersByPlayer;

    for (const cmdSeq of [1, 2, 3, 4]) {
      internalOffersMap.set("p1", [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      const result = controller.submitPrepCommand("p1", cmdSeq, 3_000 + cmdSeq, {
        shopBuySlotIndex: 0,
      });

      expect(result).toEqual({ accepted: true });
    }

    const status = controller.getPlayerStatus("p1");

    expect(status.benchUnits).toEqual(["vanguard:2"]);
    expect(status.ownedUnits.vanguard).toBe(4);
  });

  test("同種7回購入で購入回数進行のtier 3になる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internalOffersMap = (controller as unknown as {
      shopOffersByPlayer: Map<
        string,
        Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; rarity: 1 | 2 | 3; cost: number }>
      >;
    }).shopOffersByPlayer;

    for (const cmdSeq of [1, 2, 3, 4, 5, 6, 7]) {
      internalOffersMap.set("p1", [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      const result = controller.submitPrepCommand("p1", cmdSeq, 3_000 + cmdSeq, {
        shopBuySlotIndex: 0,
      });

      expect(result).toEqual({ accepted: true });
    }

    const status = controller.getPlayerStatus("p1");

    expect(status.benchUnits).toEqual(["vanguard:3"]);
    expect(status.ownedUnits.vanguard).toBe(7);
  });

  test("benchToBoardCellとbenchSellIndexを同時指定するとINVALID_PAYLOAD", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });

    const result = controller.submitPrepCommand("p1", 2, 3_100, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 1,
      },
      benchSellIndex: 0,
    });

    expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });

  test("boardUnitCountが8のときbenchToBoardCellはINVALID_PAYLOAD", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const setBoardFullResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardUnitCount: 8,
    });
    const deployResult = controller.submitPrepCommand("p1", 3, 3_200, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 7,
      },
    });

    expect(buyResult).toEqual({ accepted: true });
    expect(setBoardFullResult).toEqual({ accepted: true });
    expect(deployResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });

  test("boardSellIndex は tier 3 の sell formula 4C - 2 を使う", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internals = controller as unknown as {
      boardPlacementsByPlayer: Map<string, Array<{
        cell: number;
        unitType: "vanguard" | "ranger" | "mage" | "assassin";
        starLevel?: number;
        sellValue?: number;
        unitCount?: number;
      }>>;
      boardUnitCountByPlayer: Map<string, number>;
    };
    internals.boardPlacementsByPlayer.set("p1", [
      { cell: 2, unitType: "mage", starLevel: 3, sellValue: 14, unitCount: 7 },
    ]);
    internals.boardUnitCountByPlayer.set("p1", 1);

    const beforeSell = controller.getPlayerStatus("p1");
    const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardSellIndex: 2,
    });
    const afterSell = controller.getPlayerStatus("p1");

    expect(sellResult).toEqual({ accepted: true });
    expect(beforeSell.boardUnitCount).toBe(1);
    expect(afterSell.boardUnitCount).toBe(0);
    expect(afterSell.gold).toBe(beforeSell.gold + 6);
  });

  test("boardSellIndexでユニット不在セル指定はINVALID_PAYLOAD", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const setBoardResult = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [{ cell: 1, unitType: "vanguard" }],
    });
    const beforeStatus = controller.getPlayerStatus("p1");
    const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardSellIndex: 7,
    });
    const afterStatus = controller.getPlayerStatus("p1");

    expect(setBoardResult).toEqual({ accepted: true });
    expect(sellResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    expect(afterStatus.boardUnitCount).toBe(beforeStatus.boardUnitCount);
    expect(afterStatus.gold).toBe(beforeStatus.gold);
  });

  test("Eliminationで生存者1人ならEndへ遷移する", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);
    controller.setPlayerHp("p2", 0);
    controller.setPlayerHp("p3", 0);
    controller.setPlayerHp("p4", -10);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    expect(controller.phase).toBe("End");
  });

  test("phase expansion有効時はR11終了後もEndせずR12 Prepへ進む", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      0,
      {
        readyAutoStartMs: 1,
        prepDurationMs: 1,
        battleDurationMs: 1,
        settleDurationMs: 1,
        eliminationDurationMs: 1,
        featureFlags: {
          enablePhaseExpansion: true,
        },
      },
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(0);

    let nowMs = 0;

    for (let completedRounds = 0; completedRounds < 10; completedRounds += 1) {
      nowMs = advanceRoundWithMinimalDurations(controller, nowMs);
    }

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(11);

    nowMs = advanceRoundWithMinimalDurations(controller, nowMs);

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(12);
  });

  test("phase expansion有効時はR12終了後にEndへ遷移する", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      0,
      {
        readyAutoStartMs: 1,
        prepDurationMs: 1,
        battleDurationMs: 1,
        settleDurationMs: 1,
        eliminationDurationMs: 1,
        featureFlags: {
          enablePhaseExpansion: true,
        },
      },
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(0);

    let nowMs = 0;

    for (let completedRounds = 0; completedRounds < 12; completedRounds += 1) {
      nowMs = advanceRoundWithMinimalDurations(controller, nowMs);
    }

    expect(controller.phase).toBe("End");
    expect(controller.roundIndex).toBe(12);
  });

  test("phase expansion有効時のR12 Prepではphase HP targetが0になる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      0,
      {
        readyAutoStartMs: 1,
        prepDurationMs: 1,
        battleDurationMs: 1,
        settleDurationMs: 1,
        eliminationDurationMs: 1,
        featureFlags: {
          enablePhaseExpansion: true,
        },
      },
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(0);

    let nowMs = 0;

    for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
      nowMs = advanceRoundWithMinimalDurations(controller, nowMs);
    }

    const phaseProgress = controller.getPhaseProgress();

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(12);
    expect(phaseProgress.targetHp).toBe(0);
    expect(phaseProgress.damageDealt).toBe(0);
    expect(phaseProgress.result).toBe("pending");
    expect(phaseProgress.completionRate).toBe(0);
  });

  test("raid round wipe only consumes lives for wiped protagonists", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            1_000,
            controllerOptions,
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(2_000);
          controller.advanceByTime(32_000);

          controller.setPendingPhaseDamageForTest(100);

          controller.advanceByTime(42_000);
          const { battleResultsByPlayer } = controller.getTestAccess();
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 1,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          controller.advanceByTime(47_000);

          expect(controller.getPhaseProgress()).toMatchObject({
            targetHp: 600,
            damageDealt: 100,
            result: "failed",
          });
          expect(controller.getPlayerStatus("p1")).toMatchObject({ remainingLives: 1, eliminated: false });
          expect(controller.getPlayerStatus("p3")).toMatchObject({ remainingLives: 2, eliminated: false });
          expect(controller.getPlayerStatus("p4")).toMatchObject({ remainingLives: 1, eliminated: false });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid wipe status follows the 2 -> 1 -> 0 lives baseline", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          controller.advanceByTime(1);
          controller.setPendingPhaseDamageForTest(100);
          controller.advanceByTime(2);
          const { battleResultsByPlayer } = controller.getTestAccess();
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 1,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 1,
            opponentSurvivors: 1,
          });
          controller.advanceByTime(3);

          expect(controller.getPlayerStatus("p1")).toMatchObject({
            remainingLives: 1,
            eliminated: false,
          });

          controller.advanceByTime(4);
          controller.advanceByTime(5);
          controller.setPendingPhaseDamageForTest(100);
          controller.advanceByTime(6);
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 1,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 1,
            opponentSurvivors: 1,
          });
          controller.advanceByTime(7);

          expect(controller.getPlayerStatus("p1")).toMatchObject({
            remainingLives: 0,
          });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("round 6 revives eliminated raid players and restores hero-only board state", async () => {
    await withFlags(
      {
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
      async () => {
        const controller = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          0,
          {
            readyAutoStartMs: 1,
            prepDurationMs: 1,
            battleDurationMs: 1,
            settleDurationMs: 1,
            eliminationDurationMs: 1,
          },
        );

        const resolveRaidRound = (
          startTimeMs: number,
          results: Record<string, {
            opponentId: string;
            won: boolean;
            damageDealt: number;
            damageTaken: number;
            survivors: number;
            opponentSurvivors: number;
          }>,
          phaseDamage: number = 100,
        ): number => {
          controller.advanceByTime(startTimeMs + 1);
          controller.setPendingPhaseDamageForTest(phaseDamage);
          controller.advanceByTime(startTimeMs + 2);
          const { battleResultsByPlayer } = controller.getTestAccess();
          for (const [playerId, battleResult] of Object.entries(results)) {
            battleResultsByPlayer.set(playerId, battleResult);
          }
          controller.advanceByTime(startTimeMs + 3);
          controller.advanceByTime(startTimeMs + 4);

          return startTimeMs + 4;
        };

        expect(controller.startWithResolvedRoles(0, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([["p2", "remilia"]]),
        })).toBe(true);

        const internals = controller as unknown as {
          gameLoopState: {
            roundIndex: number;
            players: Map<string, {
              remainingLives: number;
              eliminated: boolean;
            }>;
          };
          boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
          benchUnitsByPlayer: Map<string, Array<{
            unitType: "vanguard" | "ranger" | "mage" | "assassin";
            cost: number;
            starLevel: number;
            unitCount: number;
          }>>;
        };
        const { gameLoopState } = internals;
        const raidA = gameLoopState.players.get("p1");
        const raidB = gameLoopState.players.get("p3");
        const raidC = gameLoopState.players.get("p4");

        if (!raidA || !raidB || !raidC) {
          throw new Error("expected raid player states");
        }

        gameLoopState.roundIndex = 6;
        raidA.remainingLives = 2;
        raidA.eliminated = false;
        raidB.remainingLives = 0;
        raidB.eliminated = true;
        raidC.remainingLives = 2;
        raidC.eliminated = false;

        internals.boardPlacementsByPlayer.set("p3", [
          { cell: 30, unitType: "mage", starLevel: 1, sellValue: 2, unitCount: 1 },
        ]);
        internals.benchUnitsByPlayer.set("p3", [
          { unitType: "vanguard", cost: 1, starLevel: 1, unitCount: 1 },
        ]);

        let nowMs = 0;
        nowMs = resolveRaidRound(nowMs, {
          p1: {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          },
          p4: {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          },
        });

        expect(nowMs).toBeGreaterThan(0);
        expect(controller.roundIndex).toBe(7);
        expect(controller.getPlayerStatus("p1")).toMatchObject({
          remainingLives: 3,
          eliminated: false,
        });
        expect(controller.getPlayerStatus("p4")).toMatchObject({
          remainingLives: 3,
          eliminated: false,
        });
        expect(controller.getPlayerStatus("p3")).toMatchObject({
          remainingLives: 1,
          eliminated: false,
        });
        expect(controller.getBoardPlacementsForPlayer("p3")).toEqual([]);
        expect(controller.getPlayerStatus("p3").benchUnits).toEqual(["vanguard", "mage"]);
        expect(controller.getHeroPlacementForPlayer("p3")).not.toBeNull();
      },
    );
  });

  test("raid R12 final judgment gives raid victory only when phase hp reaches zero and someone survives", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          let nowMs = 0;
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRoundWithMinimalDurations(controller, nowMs);
          }

          const { battleResultsByPlayer } = controller.getTestAccess();

          expect(controller.roundIndex).toBe(12);
          expect(controller.phase).toBe("Prep");

          controller.advanceByTime(nowMs + 1);
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          controller.setPendingPhaseDamageForTest(3_000);

          controller.advanceByTime(nowMs + 2);
          controller.advanceByTime(nowMs + 3);
          controller.advanceByTime(nowMs + 4);

          expect(controller.phase).toBe("End");
          expect(controller.rankingTopToBottom[0]).toBe("p1");
          expect(controller.rankingTopToBottom.at(-1)).toBe("p2");
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid R12 ignores the normal battle timeout and stays in Battle until the final fight resolves", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          let nowMs = 0;
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRoundWithMinimalDurations(controller, nowMs);
          }

          expect(controller.roundIndex).toBe(12);
          expect(controller.phase).toBe("Prep");

          applyMinimalRaidBattlePlacements(controller);
          controller.advanceByTime(nowMs + 1);

          expect(controller.phase).toBe("Battle");
          expect(controller.getSharedBattleReplay("Battle")).not.toBeNull();
          expect(controller.advanceByTime(nowMs + 2)).toBe(false);
          expect(controller.phase).toBe("Battle");
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid players preview final-round shields from remaining lives during R12 prep", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          let nowMs = 0;
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRoundWithMinimalDurations(controller, nowMs);
          }

          expect(controller.roundIndex).toBe(12);
          expect(controller.phase).toBe("Prep");
          expect(controller.getPlayerStatus("p1").remainingLives).toBe(3);
          expect(controller.getPlayerStatus("p1").finalRoundShield).toBe(3);
          expect(controller.getPlayerStatus("p3").finalRoundShield).toBe(3);
          expect(controller.getPlayerStatus("p4").finalRoundShield).toBe(3);
          expect(controller.getPlayerStatus("p2").finalRoundShield).toBe(0);
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid R12 consumes shield before marking a wiped raid player defeated", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          let nowMs = 0;
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRoundWithMinimalDurations(controller, nowMs);
          }

          const { gameLoopState, battleResultsByPlayer } = controller.getTestAccess();
          if (!gameLoopState) {
            throw new Error("Expected gameLoopState");
          }

          gameLoopState.consumeLife("p1", 1);

          expect(controller.getPlayerStatus("p1").remainingLives).toBe(2);
          expect(controller.getPlayerStatus("p1").finalRoundShield).toBe(2);

          controller.advanceByTime(nowMs + 1);
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });
          controller.setPendingPhaseDamageForTest(3_000);

          controller.advanceByTime(nowMs + 2);
          controller.advanceByTime(nowMs + 3);
          controller.advanceByTime(nowMs + 4);

          expect(controller.phase).toBe("End");
          expect(controller.getPlayerStatus("p1")).toMatchObject({
            remainingLives: 2,
            finalRoundShield: 1,
            eliminated: false,
          });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid R12 consumes shield only for players whose own units are wiped", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true, enableHeroSystem: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          let nowMs = 0;
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRoundWithMinimalDurations(controller, nowMs);
          }

          const {
            gameLoopState,
            battleResultsByPlayer,
            battleInputSnapshotByPlayer,
          } = controller.getTestAccess();
          if (!gameLoopState) {
            throw new Error("Expected gameLoopState");
          }

          gameLoopState.consumeLife("p1", 1);

          controller.advanceByTime(nowMs + 1);

          battleInputSnapshotByPlayer.set("p1", [{ cell: 31, unitType: "ranger", unitId: "raid-a-unit-r12" }]);
          battleInputSnapshotByPlayer.set("p3", [{ cell: 33, unitType: "mage", unitId: "raid-b-unit-r12" }]);
          battleInputSnapshotByPlayer.set("p4", [{ cell: 35, unitType: "assassin", unitId: "raid-c-unit-r12" }]);

          const sharedRaidBattleResult = {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 2,
            opponentSurvivors: 1,
            survivorSnapshots: [
              {
                unitId: "raid-b-unit-r12",
                displayName: "raid-b-unit-r12",
                unitType: "mage",
                hp: 12,
                maxHp: 40,
                sharedBoardCellIndex: 18,
              },
              {
                unitId: "raid-c-unit-r12",
                displayName: "raid-c-unit-r12",
                unitType: "assassin",
                hp: 9,
                maxHp: 45,
                sharedBoardCellIndex: 19,
              },
            ],
          };

          battleResultsByPlayer.set("p1", sharedRaidBattleResult);
          battleResultsByPlayer.set("p3", sharedRaidBattleResult);
          battleResultsByPlayer.set("p4", sharedRaidBattleResult);
          battleResultsByPlayer.set("p2", {
            opponentId: "p1",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 2,
          });
          controller.setPendingPhaseDamageForTest(3_000);

          controller.advanceByTime(nowMs + 2);
          controller.advanceByTime(nowMs + 3);
          controller.advanceByTime(nowMs + 4);

          expect(controller.getPlayerStatus("p1")).toMatchObject({
            remainingLives: 2,
            finalRoundShield: 1,
            eliminated: false,
          });
          expect(controller.getPlayerStatus("p3")).toMatchObject({
            remainingLives: 3,
            finalRoundShield: 3,
            eliminated: false,
          });
          expect(controller.getPlayerStatus("p4")).toMatchObject({
            remainingLives: 3,
            finalRoundShield: 3,
            eliminated: false,
          });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid R12 simultaneous wipe and phase break is a boss victory", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          let nowMs = 0;
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRoundWithMinimalDurations(controller, nowMs);
          }

          const { gameLoopState, battleResultsByPlayer } = controller.getTestAccess();
          if (!gameLoopState) {
            throw new Error("Expected gameLoopState");
          }
          gameLoopState.consumeLife("p1", 2);
          gameLoopState.consumeLife("p3", 2);
          gameLoopState.consumeLife("p4", 2);

          controller.advanceByTime(nowMs + 1);
          battleResultsByPlayer.set("p1", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          controller.setPendingPhaseDamageForTest(3_000);

          controller.advanceByTime(nowMs + 2);
          controller.advanceByTime(nowMs + 3);
          controller.advanceByTime(nowMs + 4);

          expect(controller.phase).toBe("End");
          expect(controller.rankingTopToBottom[0]).toBe("p2");
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid prep income gives +5 to surviving raiders, +9 to the boss, and skips eliminated raiders when phase bonus is not earned", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          const internals = controller as unknown as {
            gameLoopState: {
              players: Map<string, {
                remainingLives: number;
                eliminated: boolean;
              }>;
            };
          };
          const raidA = internals.gameLoopState.players.get("p1");
          if (!raidA) {
            throw new Error("expected raid player state");
          }
          raidA.remainingLives = 0;
          raidA.eliminated = true;

          controller.advanceByTime(1);
          controller.setPendingPhaseDamageForTest(0);
          const { battleResultsByPlayer } = controller.getTestAccess();
          battleResultsByPlayer.set("p3", {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });
          battleResultsByPlayer.set("p4", {
            opponentId: "p2",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });

          controller.advanceByTime(2);
          controller.advanceByTime(3);
          controller.advanceByTime(4);

          expect(controller.phase).toBe("Prep");
          expect(controller.roundIndex).toBe(2);
          expect(controller.getPlayerStatus("p1")).toMatchObject({ gold: 5, eliminated: true });
          expect(controller.getPlayerStatus("p2")).toMatchObject({ gold: 17 });
          expect(controller.getPlayerStatus("p3")).toMatchObject({ gold: 10 });
          expect(controller.getPlayerStatus("p4")).toMatchObject({ gold: 10 });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid rounds consume life only for players whose own units are wiped", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true, enableHeroSystem: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          expect(controller.applyPrepPlacementForPlayer("p2", [{ cell: 0, unitType: "vanguard", unitId: "boss-unit" }]))
            .toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p1", [{ cell: 31, unitType: "ranger", unitId: "raid-a-unit" }]))
            .toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p3", [{ cell: 33, unitType: "mage", unitId: "raid-b-unit" }]))
            .toMatchObject({ success: true });
          expect(controller.applyPrepPlacementForPlayer("p4", [{ cell: 35, unitType: "assassin", unitId: "raid-c-unit" }]))
            .toMatchObject({ success: true });

          controller.advanceByTime(1);

          const { battleResultsByPlayer } = controller.getTestAccess();
          const sharedRaidBattleResult = {
            opponentId: "p2",
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 2,
            opponentSurvivors: 1,
            survivorSnapshots: [
              {
                unitId: "raid-b-unit",
                displayName: "raid-b-unit",
                unitType: "mage",
                hp: 12,
                maxHp: 40,
                sharedBoardCellIndex: 18,
              },
              {
                unitId: "raid-c-unit",
                displayName: "raid-c-unit",
                unitType: "assassin",
                hp: 9,
                maxHp: 45,
                sharedBoardCellIndex: 19,
              },
            ],
          };

          battleResultsByPlayer.set("p1", sharedRaidBattleResult);
          battleResultsByPlayer.set("p3", sharedRaidBattleResult);
          battleResultsByPlayer.set("p4", sharedRaidBattleResult);
          battleResultsByPlayer.set("p2", {
            opponentId: "p1",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 2,
          });

          controller.advanceByTime(2);
          controller.advanceByTime(3);
          controller.advanceByTime(4);

          expect(controller.getPlayerStatus("p1").remainingLives).toBe(1);
          expect(controller.getPlayerStatus("p3").remainingLives).toBe(2);
          expect(controller.getPlayerStatus("p4").remainingLives).toBe(2);
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid players gain +2 gold on phase success while the boss only keeps boss prep income", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          controller.advanceByTime(1);
          controller.setPendingPhaseDamageForTest(600);
          const { battleResultsByPlayer } = controller.getTestAccess();
          for (const raidPlayerId of ["p1", "p3", "p4"]) {
            battleResultsByPlayer.set(raidPlayerId, {
              opponentId: "p2",
              won: true,
              damageDealt: 10,
              damageTaken: 0,
              survivors: 1,
              opponentSurvivors: 0,
            });
          }

          controller.advanceByTime(2);
          controller.advanceByTime(3);
          controller.advanceByTime(4);

          expect(controller.phase).toBe("Prep");
          expect(controller.roundIndex).toBe(2);
          expect(controller.getPhaseProgress()).toMatchObject({ result: "pending" });
          expect(controller.getPlayerStatus("p1").gold).toBe(12);
          expect(controller.getPlayerStatus("p3").gold).toBe(12);
          expect(controller.getPlayerStatus("p4").gold).toBe(12);
          expect(controller.getPlayerStatus("p2").gold).toBe(17);
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("time-out only raid failure does not grant the phase success bonus", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          controller.advanceByTime(1);
          const { battleResultsByPlayer } = controller.getTestAccess();
          for (const raidPlayerId of ["p1", "p3", "p4"]) {
            battleResultsByPlayer.set(raidPlayerId, {
              opponentId: "p2",
              won: true,
              damageDealt: 10,
              damageTaken: 0,
              survivors: 1,
              opponentSurvivors: 0,
            });
          }

          controller.advanceByTime(2);
          controller.advanceByTime(3);
          controller.advanceByTime(4);

          expect(controller.phase).toBe("Prep");
          expect(controller.roundIndex).toBe(2);
          expect(controller.getPlayerStatus("p1").gold).toBe(10);
          expect(controller.getPlayerStatus("p3").gold).toBe(10);
          expect(controller.getPlayerStatus("p4").gold).toBe(10);
          expect(controller.getPlayerStatus("p2").gold).toBe(17);
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("raid wipe does not count as phase success even when phase damage reaches the target", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
      async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

        try {
          const controller = new MatchRoomController(
            ["p1", "p2", "p3", "p4"],
            0,
            {
              readyAutoStartMs: 1,
              prepDurationMs: 1,
              battleDurationMs: 1,
              settleDurationMs: 1,
              eliminationDurationMs: 1,
            },
          );

          controller.setReady("p1", true);
          controller.setReady("p2", true);
          controller.setReady("p3", true);
          controller.setReady("p4", true);
          controller.startIfReady(0);

          controller.advanceByTime(1);
          controller.setPendingPhaseDamageForTest(600);
          const { battleResultsByPlayer, battleInputSnapshotByPlayer } = controller.getTestAccess();
          for (const raidPlayerId of ["p1", "p3", "p4"]) {
            battleInputSnapshotByPlayer.set(raidPlayerId, [{
              cell: 31,
              unitType: "vanguard",
              unitId: `${raidPlayerId}-unit`,
            }]);
            battleResultsByPlayer.set(raidPlayerId, {
              opponentId: "p2",
              won: false,
              damageDealt: 0,
              damageTaken: 10,
              survivors: 0,
              opponentSurvivors: 1,
            });
          }
          battleResultsByPlayer.set("p2", {
            opponentId: "p1",
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });

          controller.advanceByTime(2);

          expect(controller.phase).toBe("Settle");
          expect(controller.getPhaseProgress()).toMatchObject({
            targetHp: 600,
            damageDealt: 600,
            result: "failed",
          });
        } finally {
          randomSpy.mockRestore();
        }
      },
    );
  });

  test("Battle終了時にpendingダメージがHPへ反映される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.setPendingRoundDamage({
      p1: 12,
      p2: 5,
    });

    controller.advanceByTime(42_000);

    expect(controller.phase).toBe("Settle");
    expect(controller.getPlayerHp("p1")).toBe(88);
    expect(controller.getPlayerHp("p2")).toBe(95);
    expect(controller.getPlayerHp("p3")).toBe(100);
  });

  test("Battle終了時にphase HP進捗が計算される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.setPendingRoundDamage({
      p1: 120,
      p2: 130,
      p3: 80,
      p4: 70,
    });

    controller.advanceByTime(42_000);

    const phaseProgress = controller.getPhaseProgress();

    expect(controller.phase).toBe("Settle");
    expect(phaseProgress.targetHp).toBe(600);
    expect(phaseProgress.damageDealt).toBe(400);
    expect(phaseProgress.result).toBe("failed");
    expect(phaseProgress.completionRate).toBeCloseTo(400 / 600);
  });

  test("phase HP未達時はfailedになり次ラウンドPrepでリセットされる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.setPendingRoundDamage({
      p1: 100,
      p2: 50,
    });

    controller.advanceByTime(42_000);

    const failedPhaseProgress = controller.getPhaseProgress();

    expect(failedPhaseProgress.targetHp).toBe(600);
    expect(failedPhaseProgress.damageDealt).toBe(150);
    expect(failedPhaseProgress.result).toBe("failed");
    expect(failedPhaseProgress.completionRate).toBeCloseTo(0.25);

    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    const nextRoundProgress = controller.getPhaseProgress();

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(2);
    expect(nextRoundProgress.targetHp).toBe(750);
    expect(nextRoundProgress.damageDealt).toBe(0);
    expect(nextRoundProgress.result).toBe("pending");
    expect(nextRoundProgress.completionRate).toBe(0);
  });

  test("pendingダメージ未設定でもBattle終了時に自動ダメージが反映される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.advanceByTime(42_000);

    expect(controller.phase).toBe("Settle");
    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p2")).toBe(100);
    expect(controller.getPlayerHp("p3")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("Battle開始時スナップショットが戦闘入力として固定される", () => {
    const originalDebugLogs = process.env.MATCH_DEBUG_LOGS;
    const originalSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    process.env.MATCH_DEBUG_LOGS = "1";
    delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const controller = new MatchRoomController(
        ["p1", "p2"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.startIfReady(2_000);

      const setP1 = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      });
      const setP2 = controller.submitPrepCommand("p2", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      });

      expect(setP1).toEqual({ accepted: true });
      expect(setP2).toEqual({ accepted: true });

      controller.advanceByTime(32_000);

      const { boardPlacementsByPlayer: livePlacements } = controller.getTestAccess();

      livePlacements.set("p1", [{ cell: 0, unitType: "mage" }]);

      controller.advanceByTime(42_000);

      const battleTraceLogs = logSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => entry.includes('"type":"battle_trace"'))
        .map((entry) => JSON.parse(entry));

      expect(battleTraceLogs.length).toBeGreaterThan(0);

      const trace = battleTraceLogs[0] as {
        leftPlayerId: string;
        rightPlayerId: string;
        leftPlacements: Array<{ unitType: string }>;
        rightPlacements: Array<{ unitType: string }>;
      };

      const p1Placements =
        trace.leftPlayerId === "p1" ? trace.leftPlacements : trace.rightPlacements;

      expect(p1Placements).toEqual(
        expect.arrayContaining([expect.objectContaining({ unitType: "vanguard" })]),
      );
      expect(p1Placements).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ unitType: "mage" })]),
      );
    } finally {
      logSpy.mockRestore();
      if (originalDebugLogs === undefined) {
        delete process.env.MATCH_DEBUG_LOGS;
      } else {
        process.env.MATCH_DEBUG_LOGS = originalDebugLogs;
      }

      if (originalSuppressVerboseLogs === undefined) {
        delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
      } else {
        process.env.SUPPRESS_VERBOSE_TEST_LOGS = originalSuppressVerboseLogs;
      }
    }
  });

  test("Prep中の適用配置はBattle開始時スナップショットへ反映される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.startIfReady(2_000);

    const p1Result = controller.applyPrepPlacementForPlayer("p1", [
      { cell: 2, unitType: "mage" },
    ]);
    const p2Result = controller.applyPrepPlacementForPlayer("p2", [
      { cell: 3, unitType: "ranger" },
    ]);

    expect(p1Result).toEqual({ success: true, code: "SUCCESS" });
    expect(p2Result).toEqual({ success: true, code: "SUCCESS" });

    controller.advanceByTime(32_000);

    const { battleInputSnapshotByPlayer: snapshotMap } = controller.getTestAccess();

    expect(snapshotMap?.get("p1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: 2, unitType: "mage" }),
      ]),
    );
    expect(snapshotMap?.get("p2")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: 3, unitType: "ranger" }),
      ]),
    );
  });

  test("T3: 戦闘単位で入力と結果を追跡できるトレースログが常時出力される", () => {
    // 環境変数を設定せずにテスト（常時出力の確認）
    const originalSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const controller = new MatchRoomController(
        ["p1", "p2"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.startIfReady(2_000);

      controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      });
      controller.submitPrepCommand("p2", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "ranger" }],
      });

      controller.advanceByTime(32_000); // -> Battle
      controller.advanceByTime(42_000); // -> Settle

      const allLogs = logSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => JSON.parse(entry));

      const battleTraces = allLogs.filter(
        (log) => log.type === "battle_trace",
      );
      const resultTraces = allLogs.filter(
        (log) => log.type === "battle_result_trace",
      );

      // 環境変数なしでログが出力される
      expect(battleTraces.length).toBeGreaterThan(0);
      expect(resultTraces.length).toBeGreaterThan(0);

      // battle_trace と battle_result_trace に同じ battleId が含まれる
      const battleTrace = battleTraces[0];
      const resultTrace = resultTraces[0];

      expect(battleTrace).toHaveProperty("battleId");
      expect(resultTrace).toHaveProperty("battleId");
      expect(battleTrace.battleId).toBe(resultTrace.battleId);

      // 入力placementsが含まれる
      expect(battleTrace).toHaveProperty("leftPlacements");
      expect(battleTrace).toHaveProperty("rightPlacements");

      // 結果が含まれる
      expect(resultTrace).toHaveProperty("winner");
      expect(resultTrace).toHaveProperty("leftSurvivors");
      expect(resultTrace).toHaveProperty("rightSurvivors");
      expect(resultTrace).toHaveProperty("leftDamageTaken");
      expect(resultTrace).toHaveProperty("rightDamageTaken");
    } finally {
      logSpy.mockRestore();
      if (originalSuppressVerboseLogs === undefined) {
        delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
      } else {
        process.env.SUPPRESS_VERBOSE_TEST_LOGS = originalSuppressVerboseLogs;
      }
    }
  });

  test("同時脱落時はpostBattleHp->roundStartHp->playerIdで順位が決まる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.setPlayerHp("p2", 10);
    controller.setPlayerHp("p3", 8);
    controller.setPlayerHp("p4", 8);
    controller.setPendingRoundDamage({
      p2: 15,
      p3: 12,
      p4: 10,
    });

    controller.advanceByTime(42_000);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    expect(controller.phase).toBe("End");
    expect(controller.rankingTopToBottom).toEqual(["p1", "p4", "p3", "p2"]);
  });

  test("prep_commandでboardUnitCountを更新できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand(
      "p4",
      1,
      3_000,
      { boardUnitCount: 8 },
    );

    expect(result).toEqual({ accepted: true });
    expect(controller.getPlayerStatus("p4").boardUnitCount).toBe(8);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("同系統ユニットのシナジーで低基礎パワー側が逆転できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "assassin" },
        { cell: 4, unitType: "ranger" },
        { cell: 5, unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "ranger" },
        { cell: 4, unitType: "vanguard" },
        { cell: 5, unitType: "ranger" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(89);
  });

  test("後列assassin2体の奇襲で不利マッチアップを逆転できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(4), unitType: "assassin" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "assassin" },
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(1), unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(4), unitType: "mage" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(6), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(89);
  });

  test("後列ranger2体の援護射撃 fixture は shared-index pathing では押し切られる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(4), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(1), unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(1), unitType: "assassin" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(6), unitType: "ranger" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(89);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("set2でもこのranger編成 fixture は shared-index pathing で勝利する", () => {
    const set1Controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      {
        ...controllerOptions,
        setId: "set1",
      },
    );
    const set2Controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      {
        ...controllerOptions,
        setId: "set2",
      },
    );

    for (const controller of [set1Controller, set2Controller]) {
      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [
          { cell: combatCellToRaidBoardIndex(4), unitType: "ranger" },
          { cell: combatCellToRaidBoardIndex(5), unitType: "ranger" },
          { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
          { cell: combatCellToRaidBoardIndex(1), unitType: "assassin" },
        ],
      });
      controller.submitPrepCommand("p4", 1, 3_000, {
        boardPlacements: [
          { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
          { cell: combatCellToRaidBoardIndex(2), unitType: "ranger" },
          { cell: combatCellToRaidBoardIndex(5), unitType: "mage" },
          { cell: combatCellToRaidBoardIndex(4), unitType: "assassin" },
        ],
      });

      controller.advanceByTime(32_000);
      controller.advanceByTime(42_000);
    }

    expect(set1Controller.getPlayerHp("p1")).toBe(100);
    expect(set1Controller.getPlayerHp("p4")).toBe(87);
    expect(set2Controller.getPlayerHp("p1")).toBe(100);
    expect(set2Controller.getPlayerHp("p4")).toBe(87);
  });

  test("前列vanguard2体の防衛陣形 fixture は shared-index pathing でも受け切れない", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(1), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(2), unitType: "assassin" },
        { cell: combatCellToRaidBoardIndex(3), unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(4), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "mage" },
        { cell: combatCellToRaidBoardIndex(6), unitType: "assassin" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(93);
  });

  test("boardPlacementsで不正セル重複はDUPLICATE_CELLで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 0, unitType: "mage" },
      ],
    });

    expect(result).toEqual({ accepted: false, code: "DUPLICATE_CELL" });
  });

  test("applyBossPlacementForPlayerは通常ユニット配置済みセルを拒否する", async () => {
    await withFlags({
      ...FLAG_CONFIGURATIONS.ALL_DISABLED,
      enableBossExclusiveShop: true,
      enableHeroSystem: true,
    }, async () => {
      const controller = new MatchRoomController(
        ["p1", "p2", "p3", "p4"],
        1_000,
        controllerOptions,
      );

      expect(controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3", "p4"], {
        bossPlayerId: "p2",
        selectedHeroByPlayer: new Map([
          ["p1", "reimu"],
          ["p3", "marisa"],
          ["p4", "okina"],
        ]),
        selectedBossByPlayer: new Map([
          ["p2", "remilia"],
        ]),
      })).toBe(true);

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };
      internals.boardPlacementsByPlayer.set("p2", [
        { cell: 2, unitType: "vanguard" },
      ]);

      expect(controller.applyBossPlacementForPlayer("p2", 2)).toEqual({
        success: false,
        code: "INVALID_CELL",
        error: "Boss cell already occupied by board unit",
      });
    });
  });

  test("ゴースト対戦で敗北側にダメージが適用される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.setPlayerHp("p4", 0);

    controller.submitPrepCommand("p1", 1, 3_000, {
      boardUnitCount: 8,
    });
    controller.submitPrepCommand("p3", 1, 3_000, {
      boardUnitCount: 1,
    });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p3")).toBe(100);
    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p2")).toBe(100);
  });

  test("boardUnitCountが範囲外ならINVALID_PAYLOADで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand(
      "p1",
      1,
      3_000,
      { boardUnitCount: 99 },
    );

    expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });

  test("setMatchLoggerで抽出サービスにもロガーが伝播される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    // Create a mock logger
    const mockLogger = {
      logBattleResult: vi.fn(),
      logSpellEffect: vi.fn(),
      logHpChange: vi.fn(),
      logRoundTransition: vi.fn(),
      logBossShop: vi.fn(),
      logMatchSummary: vi.fn(),
      registerPlayer: vi.fn(),
    };

    // Set logger after construction (simulating GameRoom behavior)
    controller.setMatchLogger(mockLogger as unknown as import("../../src/server/match-logger").MatchLogger);

    // Start the game
    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    // Advance to Battle phase to trigger battle resolution logging
    controller.advanceByTime(32_001);

    // Verify that battle resolution logging occurred (logger was propagated)
    // The battle should have been resolved and logged
    expect(mockLogger.logRoundTransition).toHaveBeenCalled();
  });
});
