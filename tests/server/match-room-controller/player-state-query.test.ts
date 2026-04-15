import { describe, expect, it } from "vitest";

import { GameLoopState } from "../../../src/domain/game-loop-state";
import {
  createBattleEndEvent,
  createBattleStartEvent,
} from "../../../src/server/combat/battle-timeline";
import {
  PlayerStateQueryService,
  type PlayerStateQueryServiceDeps,
} from "../../../src/server/match-room-controller/player-state-query";

function createDeps(): PlayerStateQueryServiceDeps {
  const state = new GameLoopState(["p1", "p2"]);
  state.setBossPlayer("p2");

  return {
    ensureKnownPlayer: (playerId: string) => {
      if (playerId !== "p1" && playerId !== "p2") {
        throw new Error(`Unknown player: ${playerId}`);
      }
    },
    ensureStarted: () => state,
    getCurrentPhase: () => state.phase,
    getCurrentRoundIndex: () => state.roundIndex,
    getAlivePlayerIds: () => state.alivePlayerIds,
    getCurrentPhaseDeadlineAtMs: () => 45_000,
    getTrackedPlayerIds: () => state.playerIds,
    getFinalRankingOverride: () => null,
    getEliminatedFromBottom: () => [],
    getCurrentRoundPairings: () => [
      {
        leftPlayerId: "p1",
        rightPlayerId: "p2",
        ghostSourcePlayerId: null,
      },
    ],
    getCurrentPhaseProgress: () => ({
      targetHp: 600,
      damageDealt: 250,
      result: "pending",
      completionRate: 0.42,
    }),
    wantsBossByPlayer: new Map([
      ["p1", false],
      ["p2", true],
    ]),
    selectedBossByPlayer: new Map([
      ["p1", ""],
      ["p2", "remilia"],
    ]),
    roleByPlayer: new Map([
      ["p1", "raid"],
      ["p2", "boss"],
    ]),
    getFinalRoundShield: () => 0,
    goldByPlayer: new Map([
      ["p1", 18],
      ["p2", 23],
    ]),
    xpByPlayer: new Map([
      ["p1", 4],
      ["p2", 0],
    ]),
    levelByPlayer: new Map([
      ["p1", 2],
      ["p2", 3],
    ]),
    shopOffersByPlayer: new Map([
      ["p1", [{ unitType: "vanguard", cost: 1, rarity: 1, unitId: "warrior_a" }]],
      ["p2", []],
    ]),
    shopLockedByPlayer: new Map([
      ["p1", true],
      ["p2", false],
    ]),
    benchUnitsByPlayer: new Map([
      ["p1", [{ unitType: "mage", cost: 2, starLevel: 2, unitCount: 1, unitId: "mage_a" }]],
      ["p2", []],
    ]),
    ownedUnitsByPlayer: new Map([
      ["p1", { vanguard: 1, ranger: 0, mage: 1, assassin: 0 }],
      ["p2", { vanguard: 0, ranger: 0, mage: 0, assassin: 0 }],
    ]),
    bossShopOffersByPlayer: new Map([
      ["p1", []],
      ["p2", [{ unitType: "assassin", cost: 3, rarity: 3, unitId: "boss_offer" }]],
    ]),
    battleResultsByPlayer: new Map([
      ["p1", {
        opponentId: "p2",
        won: true,
        damageDealt: 12,
        damageTaken: 3,
        survivors: 1,
        opponentSurvivors: 0,
        timeline: [
          createBattleStartEvent({
            battleId: "battle-1",
            round: 1,
            boardConfig: { width: 6, height: 6 },
            units: [],
          }),
          createBattleEndEvent({
            type: "battleEnd",
            battleId: "battle-1",
            atMs: 500,
            winner: "raid",
            endReason: "annihilation",
          }),
        ],
      }],
      ["p2", {
        opponentId: "p1",
        won: false,
        damageDealt: 3,
        damageTaken: 12,
        survivors: 0,
        opponentSurvivors: 1,
      }],
    ]),
    selectedHeroByPlayer: new Map([
      ["p1", "reimu"],
      ["p2", ""],
    ]),
    rumorInfluenceEligibleByPlayer: new Map([
      ["p1", true],
      ["p2", false],
    ]),
    boardUnitCountByPlayer: new Map([
      ["p1", 2],
      ["p2", 1],
    ]),
    boardPlacementsByPlayer: new Map([
      ["p1", [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "mage", starLevel: 2 },
      ]],
      ["p2", [{ cell: 5, unitType: "assassin" }]],
    ]),
    heroPlacementByPlayer: new Map([
      ["p1", 30],
      ["p2", -1],
    ]),
    heroSubHostCellByPlayer: new Map([
      ["p1", -1],
      ["p2", -1],
    ]),
    bossPlacementByPlayer: new Map([
      ["p1", -1],
      ["p2", 2],
    ]),
    enableBossExclusiveShop: true,
    enableSharedPool: true,
    sharedPool: {
      getAllInventory: () => new Map([[1, 20]]),
    },
    initialGold: 15,
    initialXp: 0,
    initialLevel: 1,
    buildActiveSynergies: () => [{ unitType: "vanguard", count: 2, tier: 1 }],
    resolveBenchUnitDisplayName: (benchUnit) => benchUnit.unitId ?? "",
    formatBoardUnitToken: (_playerId, placement) =>
      placement.starLevel && placement.starLevel > 1
        ? `${placement.cell}:${placement.unitType}:${placement.starLevel}`
        : `${placement.cell}:${placement.unitType}`,
    formatBoardSubUnitToken: (cell, placement) =>
      placement.starLevel && placement.starLevel > 1
        ? `${cell}:${placement.unitType}:${placement.starLevel}`
        : `${cell}:${placement.unitType}`,
  };
}

describe("PlayerStateQueryService", () => {
  it("builds player status snapshots without exposing internal arrays directly", () => {
    const deps = createDeps();
    const service = new PlayerStateQueryService(deps);

    const status = service.getPlayerStatus("p1");

    expect(status).toMatchObject({
      wantsBoss: false,
      selectedBossId: "",
      role: "raid",
      hp: 100,
      remainingLives: 2,
      eliminated: false,
      boardUnitCount: 2,
      gold: 18,
      xp: 4,
      level: 2,
      shopLocked: true,
      benchUnits: ["mage:2"],
      benchUnitIds: ["mage_a"],
      benchDisplayNames: ["mage_a"],
      boardUnits: ["0:vanguard", "1:mage:2"],
      ownedUnits: {
        vanguard: 1,
        ranger: 0,
        mage: 1,
        assassin: 0,
      },
      selectedHeroId: "reimu",
      isRumorEligible: true,
      activeSynergies: [{ unitType: "vanguard", count: 2, tier: 1 }],
      sharedPoolInventory: new Map([[1, 20]]),
    });
    expect(status.shopOffers).toEqual([{ unitType: "vanguard", cost: 1, rarity: 1, unitId: "warrior_a" }]);
    expect(status.shopOffers).not.toBe(deps.shopOffersByPlayer.get("p1"));
    expect(status.lastBattleResult?.timeline?.[0]?.battleId).toBe("battle-1");
  });

  it("normalizes missing shop offer unitIds into stable view ids", () => {
    const deps = createDeps();
    const shopOffersByPlayer = deps.shopOffersByPlayer as Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; cost: number; rarity: 1 | 2 | 3 | 4 | 5; unitId?: string }>>;
    const bossShopOffersByPlayer = deps.bossShopOffersByPlayer as Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; cost: number; rarity: 1 | 2 | 3 | 4 | 5; unitId?: string }>>;
    shopOffersByPlayer.set("p1", [{ unitType: "mage", cost: 2, rarity: 2 }]);
    bossShopOffersByPlayer.set("p2", [{ unitType: "assassin", cost: 3, rarity: 3 }]);
    const service = new PlayerStateQueryService(deps);

    const raidStatus = service.getPlayerStatus("p1");
    const bossStatus = service.getPlayerStatus("p2");

    expect(raidStatus.shopOffers).toEqual([{ unitType: "mage", cost: 2, rarity: 2, unitId: "" }]);
    expect(bossStatus.bossShopOffers).toEqual([{ unitType: "assassin", cost: 3, rarity: 3, unitId: "" }]);
  });

  it("returns the first available shared battle replay from player battle results", () => {
    const service = new PlayerStateQueryService(createDeps());

    expect(service.getSharedBattleReplay("Settle")).toEqual({
      type: "shared_battle_replay",
      battleId: "battle-1",
      phase: "Settle",
      timeline: expect.any(Array),
    });
  });
});
