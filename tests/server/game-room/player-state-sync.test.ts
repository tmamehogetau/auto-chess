import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArraySchema } from "@colyseus/schema";
import {
  syncPlayerStateFromController,
  syncPlayerStateFromCommandResult,
  type ControllerPlayerStatus,
  type CommandResultPayload,
  type PlayerStatusBattleResult,
} from "../../../src/server/rooms/game-room/player-state-sync";
import { createBattleStartEvent } from "../../../src/server/combat/battle-timeline";
import {
  PlayerPresenceState,
  MatchRoomState,
  ShopOfferState,
  BattleResultSchema,
  SynergySchema,
} from "../../../src/server/schema/match-room-state";

describe("player-state-sync", () => {
  let playerState: PlayerPresenceState;
  let roomState: MatchRoomState;

  beforeEach(() => {
    playerState = new PlayerPresenceState();
    roomState = new MatchRoomState();
  });

  const battleTimeline = [
    createBattleStartEvent({
      battleId: "battle-1",
      round: 2,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "koishi",
          side: "raid",
          x: 1,
          y: 4,
          currentHp: 27,
          maxHp: 60,
        },
      ],
    }),
  ];

  it("should expose default boss preference fields", () => {
    expect(playerState.wantsBoss).toBe(false);
    expect(playerState.selectedBossId).toBe("");
    expect(playerState.role).toBe("unassigned");
    expect(roomState.lobbyStage).toBe("preference");
    expect(roomState.selectionDeadlineAtMs).toBe(0);
  });

  describe("syncPlayerStateFromController", () => {
    it("should map controller player data to room player schema fields", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 75,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 3,
        gold: 25,
        specialUnitLevel: 2,
        shopOffers: [
          { unitType: "vanguard", unitId: "shop:vanguard", cost: 1, rarity: 1, isRumorUnit: false },
          { unitType: "mage", unitId: "shop:mage", cost: 2, rarity: 2, isRumorUnit: true },
        ],
        shopLocked: true,
        benchUnits: ["unit-a", "unit-b"],
        benchDisplayNames: ["Unit A", "Unit B"],
        boardUnits: ["board-unit-1", "board-unit-2", "board-unit-3"],
        ownedUnits: {
          vanguard: 2,
          ranger: 1,
          mage: 0,
          assassin: 0,
        },
        bossShopOffers: [
          { unitType: "vanguard", unitId: "shop:vanguard", cost: 5, rarity: 4, isRumorUnit: false, purchased: true, unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [
          { unitType: "vanguard", unitId: "mayumi", cost: 3, rarity: 3, isRumorUnit: false, purchased: true, unitLevel: 4 },
        ],
        lastBattleResult: {
          opponentId: "player-2",
          won: true,
          damageDealt: 15,
          damageTaken: 8,
          survivors: 3,
          opponentSurvivors: 1,
        },
        activeSynergies: [
          { unitType: "vanguard", count: 3, tier: 2 },
          { unitType: "mage", count: 2, tier: 1 },
        ],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "hero-001",
        isRumorEligible: true,
        boardSubUnits: ["0:mage", "4:assassin:2"],
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      // Basic fields
      expect(playerState.hp).toBe(75);
      expect(playerState.remainingLives).toBe(0);
      expect(playerState.eliminated).toBe(false);
      expect(playerState.boardUnitCount).toBe(3);
      expect(playerState.gold).toBe(25);
      expect(playerState.specialUnitLevel).toBe(2);
      expect(playerState.shopLocked).toBe(true);

      // Owned units
      expect(playerState.ownedVanguard).toBe(2);
      expect(playerState.ownedRanger).toBe(1);
      expect(playerState.ownedMage).toBe(0);
      expect(playerState.ownedAssassin).toBe(0);

      // Shop offers
      expect(playerState.shopOffers.length).toBe(2);
      expect(playerState.shopOffers[0]!.unitType).toBe("vanguard");
      expect(playerState.shopOffers[0]!.cost).toBe(1);
      expect(playerState.shopOffers[0]!.rarity).toBe(1);
      expect(playerState.shopOffers[0]!.isRumorUnit).toBe(false);
      expect(playerState.shopOffers[1]!.isRumorUnit).toBe(true);

      // Bench and board units
      expect(playerState.benchUnits.length).toBe(2);
      expect(playerState.benchUnits[0]).toBe("unit-a");
      expect(playerState.benchDisplayNames.length).toBe(2);
      expect(playerState.benchDisplayNames[1]).toBe("Unit B");
      expect(playerState.boardUnits.length).toBe(3);
      expect(playerState.boardUnits[2]).toBe("board-unit-3");
      expect((playerState as any).boardSubUnits.length).toBe(2);
      expect((playerState as any).boardSubUnits[0]).toBe("0:mage");
    });

    it("should preserve optional unitId fields in shop payloads", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 75,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 3,
        gold: 25,
        specialUnitLevel: 2,
        shopOffers: [
          {
            unitType: "vanguard",
            unitId: "scarlet_guard",
            cost: 1,
            rarity: 1,
            isRumorUnit: false,
          },
        ] as ControllerPlayerStatus["shopOffers"],
        shopLocked: true,
        benchUnits: ["unit-a"],
        benchDisplayNames: ["Unit A"],
        boardUnits: ["board-unit-1"],
        ownedUnits: {
          vanguard: 2,
          ranger: 1,
          mage: 0,
          assassin: 0,
        },
        bossShopOffers: [
          {
            unitType: "mage",
            unitId: "patchouli_librarian",
            cost: 5,
            rarity: 4,
            isRumorUnit: false,
          },
        ] as ControllerPlayerStatus["bossShopOffers"],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.shopOffers[0]).toHaveProperty("unitId", "scarlet_guard");
      expect(playerState.shopOffers[0]!.unitType).toBe("vanguard");
      expect(playerState.bossShopOffers[0]).toHaveProperty("unitId", "patchouli_librarian");
      expect(playerState.bossShopOffers[0]!.unitType).toBe("mage");
    });

    it("should keep board / bench / shop fields consistent", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 0,
        gold: 15,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.boardUnits.length).toBe(0);
      expect(playerState.benchUnits.length).toBe(0);
      expect(playerState.shopOffers.length).toBe(0);
      expect(playerState.bossShopOffers.length).toBe(0);
      expect(playerState.activeSynergies.length).toBe(0);
    });

    it("should sync battle result fields when present", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: {
          opponentId: "opponent-123",
          won: false,
          damageDealt: 5,
          damageTaken: 12,
          survivors: 1,
          opponentSurvivors: 4,
          timeline: battleTimeline,
          survivorSnapshots: [
            {
              unitId: "koishi",
              displayName: "古明地こいし",
              unitType: "assassin",
              hp: 27,
              maxHp: 60,
              sharedBoardCellIndex: 5,
            },
          ],
        } as PlayerStatusBattleResult,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.lastBattleResult.opponentId).toBe("opponent-123");
      expect(playerState.lastBattleResult.won).toBe(false);
      expect(playerState.lastBattleResult.damageDealt).toBe(5);
      expect(playerState.lastBattleResult.damageTaken).toBe(12);
      expect(playerState.lastBattleResult.survivors).toBe(1);
      expect(playerState.lastBattleResult.opponentSurvivors).toBe(4);
      expect(playerState.lastBattleResult.survivorSnapshots.length).toBe(1);
      expect(playerState.lastBattleResult.survivorSnapshots[0]!.displayName).toBe("古明地こいし");
      expect(playerState.lastBattleResult.survivorSnapshots[0]!.hp).toBe(27);
      expect(playerState.lastBattleResult.timelineEndState.length).toBe(1);
      expect(playerState.lastBattleResult.timelineEndState[0]).toMatchObject({
        battleUnitId: "koishi",
        side: "raid",
        x: 1,
        y: 4,
        currentHp: 27,
        maxHp: 60,
      });
    });

    it("should prefer compact timeline end-state when upstream already provides it", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: {
          opponentId: "opponent-123",
          won: false,
          damageDealt: 5,
          damageTaken: 12,
          survivors: 1,
          opponentSurvivors: 4,
          timelineEndState: [
            {
              battleUnitId: "compact-koishi",
              side: "raid",
              x: 2,
              y: 5,
              currentHp: 31,
              maxHp: 60,
              displayName: "古明地こいし",
              unitType: "assassin",
            },
          ],
          survivorSnapshots: [
            {
              unitId: "compact-koishi",
              displayName: "古明地こいし",
              unitType: "assassin",
              hp: 31,
              maxHp: 60,
              sharedBoardCellIndex: 22,
            },
          ],
        } as PlayerStatusBattleResult,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.lastBattleResult.timelineEndState.length).toBe(1);
      expect(playerState.lastBattleResult.timelineEndState[0]).toMatchObject({
        battleUnitId: "compact-koishi",
        side: "raid",
        x: 2,
        y: 5,
        currentHp: 31,
        maxHp: 60,
        displayName: "古明地こいし",
        unitType: "assassin",
      });
    });

    it("should clear battle result when not present", () => {
      // First set some values
      playerState.lastBattleResult.opponentId = "old-opponent";
      playerState.lastBattleResult.won = true;
      playerState.lastBattleResult.damageDealt = 10;

      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.lastBattleResult.opponentId).toBe("");
      expect(playerState.lastBattleResult.won).toBe(false);
      expect(playerState.lastBattleResult.damageDealt).toBe(0);
      expect(playerState.lastBattleResult.damageTaken).toBe(0);
      expect(playerState.lastBattleResult.survivors).toBe(0);
      expect(playerState.lastBattleResult.opponentSurvivors).toBe(0);
      expect(playerState.lastBattleResult.survivorSnapshots.length).toBe(0);
      expect(playerState.lastBattleResult.timelineEndState.length).toBe(0);
    });

    it("should sync active synergies correctly", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [
          { unitType: "vanguard", count: 4, tier: 3 },
          { unitType: "assassin", count: 2, tier: 1 },
        ],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.activeSynergies.length).toBe(2);
      expect(playerState.activeSynergies[0]!.unitType).toBe("vanguard");
      expect(playerState.activeSynergies[0]!.count).toBe(4);
      expect(playerState.activeSynergies[0]!.tier).toBe(3);
      expect(playerState.activeSynergies[1]!.unitType).toBe("assassin");
    });

    it("should handle empty active synergies", () => {
      // Add some synergy first
      const synergy = new SynergySchema();
      synergy.unitType = "vanguard";
      synergy.count = 3;
      synergy.tier = 2;
      playerState.activeSynergies.push(synergy);

      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.activeSynergies.length).toBe(0);
    });

    it("should sync feature-flag fields (hero, rumor, boss shop)", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [
          { unitType: "vanguard", unitId: "shop:vanguard", cost: 5, rarity: 4, isRumorUnit: false, purchased: true, unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [
          { unitType: "vanguard", unitId: "mayumi", cost: 3, rarity: 3, isRumorUnit: false, purchased: true, unitLevel: 4 },
        ],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "hero-special-001",
        isRumorEligible: true,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.selectedHeroId).toBe("hero-special-001");
      expect(playerState.isRumorEligible).toBe(true);
      expect(playerState.bossShopOffers.length).toBe(1);
      expect(playerState.bossShopOffers[0]!.unitType).toBe("vanguard");
      expect(playerState.bossShopOffers[0]!.cost).toBe(5);
      expect(playerState.bossShopOffers[0]!.purchased).toBe(true);
      expect(playerState.bossShopOffers[0]!.unitLevel).toBe(2);
      expect((playerState as any).heroExclusiveShopOffers.length).toBe(1);
      expect((playerState as any).heroExclusiveShopOffers[0]!.unitId).toBe("mayumi");
      expect((playerState as any).heroExclusiveShopOffers[0]!.purchased).toBe(true);
      expect((playerState as any).heroExclusiveShopOffers[0]!.unitLevel).toBe(4);
    });

    it("should sync boss preference fields from controller status", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: true,
        selectedBossId: "remilia",
        role: "boss",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.wantsBoss).toBe(true);
      expect(playerState.selectedBossId).toBe("remilia");
      expect(playerState.role).toBe("boss");
    });

    it("should expose consumed rumor eligibility separately from rumor shop result", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        specialUnitLevel: 1,
        shopOffers: [
          { unitType: "mage", unitId: "shop:mage", cost: 2, rarity: 2, isRumorUnit: true },
          { unitType: "vanguard", unitId: "shop:vanguard", cost: 1, rarity: 1, isRumorUnit: false },
        ],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.isRumorEligible).toBe(false);
      expect(playerState.shopOffers[0]!.isRumorUnit).toBe(true);
      expect(playerState.shopOffers[1]!.isRumorUnit).toBe(false);
    });

    it("should replace existing data when syncing (clear then repopulate)", () => {
      // Set initial state with some data
      const oldOffer = new ShopOfferState();
      oldOffer.unitType = "ranger";
      oldOffer.cost = 99;
      playerState.shopOffers.push(oldOffer);
      playerState.benchUnits.push("old-unit");
      playerState.gold = 999;

      const controllerStatus: ControllerPlayerStatus = {
        hp: 50,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 2,
        gold: 10,
        specialUnitLevel: 1,
        shopOffers: [{ unitType: "mage", unitId: "shop:mage", cost: 3, rarity: 2, isRumorUnit: false }],
        shopLocked: false,
        benchUnits: ["new-unit-1"],
        benchDisplayNames: ["New Unit 1"],
        boardUnits: ["board-1", "board-2"],
        ownedUnits: { vanguard: 1, ranger: 0, mage: 1, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      // Old data should be replaced
      expect(playerState.gold).toBe(10);
      expect(playerState.shopOffers.length).toBe(1);
      expect(playerState.shopOffers[0]!.unitType).toBe("mage");
      expect(playerState.shopOffers[0]!.cost).toBe(3);
      expect(playerState.benchUnits.length).toBe(1);
      expect(playerState.benchUnits[0]).toBe("new-unit-1");
      expect(playerState.benchDisplayNames[0]).toBe("New Unit 1");
    });
  });

  describe("syncPlayerStateFromCommandResult", () => {
    it("should sync command result payload into room state", () => {
      const cmdResult = {
        boardUnitCount: 5,
        gold: 30,
        specialUnitLevel: 3,
        shopLocked: false,
        ownedUnits: {
          vanguard: 3,
          ranger: 2,
          mage: 1,
          assassin: 0,
        },
        shopOffers: [
          { unitType: "assassin", unitId: "shop:assassin", cost: 4, rarity: 3, isRumorUnit: false },
        ],
        benchUnits: ["unit-x", "unit-y", "unit-z"],
        benchUnitIds: ["nazrin", "sakuya", "patchouli"],
        benchDisplayNames: ["紅美鈴", "十六夜咲夜", "パチュリー・ノーレッジ"],
        boardUnits: ["b1", "b2", "b3", "b4", "b5"],
        boardSubUnits: ["1:mage"],
        lastBattleResult: {
          opponentId: "p2",
          won: true,
          damageDealt: 20,
          damageTaken: 5,
          survivors: 5,
          opponentSurvivors: 0,
          timeline: battleTimeline,
        } as PlayerStatusBattleResult,
        activeSynergies: [{ unitType: "ranger", count: 2, tier: 1 }],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 42);

      expect(playerState.lastCmdSeq).toBe(42);
      expect(playerState.boardUnitCount).toBe(5);
      expect(playerState.gold).toBe(30);
      expect(playerState.specialUnitLevel).toBe(3);
      expect(playerState.shopLocked).toBe(false);
      expect(playerState.ownedVanguard).toBe(3);
      expect(playerState.ownedRanger).toBe(2);
      expect(playerState.ownedMage).toBe(1);
      expect(playerState.benchUnits.length).toBe(3);
      expect((playerState as any).benchUnitIds[1]).toBe("sakuya");
      expect(playerState.benchDisplayNames[2]).toBe("パチュリー・ノーレッジ");
      expect(playerState.boardUnits.length).toBe(5);
      expect((playerState as any).boardSubUnits.length).toBe(1);
      expect((playerState as any).boardSubUnits[0]).toBe("1:mage");
      expect(playerState.lastBattleResult.timelineEndState.length).toBe(1);
      expect(playerState.lastBattleResult.timelineEndState[0]).toMatchObject({
        battleUnitId: "koishi",
        side: "raid",
        x: 1,
        y: 4,
      });
    });

    it("should keep compact timeline end-state from command results", () => {
      const cmdResult = {
        boardUnitCount: 5,
        gold: 30,
        specialUnitLevel: 3,
        shopLocked: false,
        ownedUnits: {
          vanguard: 3,
          ranger: 2,
          mage: 1,
          assassin: 0,
        },
        shopOffers: [],
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        lastBattleResult: {
          opponentId: "p2",
          won: true,
          damageDealt: 20,
          damageTaken: 5,
          survivors: 1,
          opponentSurvivors: 0,
          timelineEndState: [
            {
              battleUnitId: "compact-sakuya",
              side: "raid",
              x: 4,
              y: 4,
              currentHp: 22,
              maxHp: 35,
              displayName: "十六夜咲夜",
              unitType: "assassin",
            },
          ],
          survivorSnapshots: [
            {
              unitId: "compact-sakuya",
              displayName: "十六夜咲夜",
              unitType: "assassin",
              hp: 22,
              maxHp: 35,
              sharedBoardCellIndex: 28,
            },
          ],
        } as PlayerStatusBattleResult,
        activeSynergies: [{ unitType: "ranger", count: 2, tier: 1 }],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 42);

      expect(playerState.lastBattleResult.timelineEndState.length).toBe(1);
      expect(playerState.lastBattleResult.timelineEndState[0]).toMatchObject({
        battleUnitId: "compact-sakuya",
        side: "raid",
        x: 4,
        y: 4,
        currentHp: 22,
        maxHp: 35,
        displayName: "十六夜咲夜",
        unitType: "assassin",
      });
    });

    it("should update lastCmdSeq when provided", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 100);

      expect(playerState.lastCmdSeq).toBe(100);
    });

    it("should handle optional fields as undefined gracefully", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      // Should not throw and state should be valid
      expect(playerState.gold).toBe(15);
      expect(playerState.benchUnits.length).toBe(0);
    });

    it("should clear and repopulate arrays correctly", () => {
      // Pre-populate with old data
      playerState.shopOffers.push(new ShopOfferState());
      playerState.benchUnits.push("old");
      playerState.benchDisplayNames.push("Old");

      const cmdResult = {
        boardUnitCount: 2,
        gold: 20,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: ["new-1", "new-2"],
        benchDisplayNames: ["紅美鈴", "十六夜咲夜"],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 5);

      expect(playerState.shopOffers.length).toBe(0);
      expect(playerState.benchUnits.length).toBe(2);
      expect(playerState.benchUnits[0]).toBe("new-1");
      expect(playerState.benchDisplayNames[1]).toBe("十六夜咲夜");
    });

    it("should sync shopOffers with isRumorUnit field", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [
          { unitType: "vanguard", unitId: "shop:vanguard", cost: 1, rarity: 1, isRumorUnit: false },
          { unitType: "mage", unitId: "shop:mage", cost: 2, rarity: 2, isRumorUnit: true },
        ],
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      expect(playerState.shopOffers.length).toBe(2);
      expect(playerState.shopOffers[0]!.unitType).toBe("vanguard");
      expect(playerState.shopOffers[0]!.isRumorUnit).toBe(false);
      expect(playerState.shopOffers[1]!.unitType).toBe("mage");
      expect(playerState.shopOffers[1]!.isRumorUnit).toBe(true);
    });

    it("should sync bossShopOffers when provided", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        benchDisplayNames: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        bossShopOffers: [
          { unitType: "vanguard", unitId: "shop:vanguard", cost: 5, rarity: 4, isRumorUnit: false, purchased: true, unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [
          { unitType: "assassin", unitId: "shion", cost: 3, rarity: 3, isRumorUnit: false, purchased: true, unitLevel: 5 },
        ],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      expect(playerState.bossShopOffers.length).toBe(1);
      expect(playerState.bossShopOffers[0]!.unitType).toBe("vanguard");
      expect(playerState.bossShopOffers[0]!.cost).toBe(5);
      expect(playerState.bossShopOffers[0]!.isRumorUnit).toBe(false);
      expect(playerState.bossShopOffers[0]!.purchased).toBe(true);
      expect(playerState.bossShopOffers[0]!.unitLevel).toBe(2);
      expect((playerState as any).heroExclusiveShopOffers.length).toBe(1);
      expect((playerState as any).heroExclusiveShopOffers[0]!.unitId).toBe("shion");
      expect((playerState as any).heroExclusiveShopOffers[0]!.purchased).toBe(true);
      expect((playerState as any).heroExclusiveShopOffers[0]!.unitLevel).toBe(5);
    });

    it("should sync selectedHeroId and isRumorEligible when provided", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        selectedHeroId: "hero-special-001",
        isRumorEligible: true,
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      expect(playerState.selectedHeroId).toBe("hero-special-001");
      expect(playerState.isRumorEligible).toBe(true);
    });

    it("should sync boss preference fields when provided", () => {
      const cmdResult: CommandResultPayload = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: true,
        selectedBossId: "remilia",
        role: "boss",
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      expect(playerState.wantsBoss).toBe(true);
      expect(playerState.selectedBossId).toBe("remilia");
      expect(playerState.role).toBe("boss");
    });

    it("should preserve existing feature fields when not in command result", () => {
      // Set initial values
      playerState.selectedHeroId = "existing-hero";
      playerState.isRumorEligible = true;
      const bossOffer = new ShopOfferState();
      bossOffer.unitType = "ranger";
      bossOffer.cost = 5;
      playerState.bossShopOffers.push(bossOffer);

      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        // bossShopOffers, selectedHeroId, isRumorEligible not provided
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      // Existing values should be preserved (backward compatibility)
      expect(playerState.selectedHeroId).toBe("existing-hero");
      expect(playerState.isRumorEligible).toBe(true);
      // But bossShopOffers should be cleared when not provided (default behavior)
      expect(playerState.bossShopOffers.length).toBe(0);
    });

    it("should preserve feature fields when controller status omits them", () => {
      playerState.wantsBoss = true;
      playerState.selectedBossId = "remilia";
      playerState.role = "boss";
      playerState.selectedHeroId = "existing-hero";
      playerState.isRumorEligible = true;

      const controllerStatus = {
        hp: 90,
        remainingLives: 1,
        eliminated: false,
        boardUnitCount: 2,
        gold: 12,
        specialUnitLevel: 2,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: undefined,
        selectedBossId: undefined,
        role: undefined,
        selectedHeroId: undefined,
        isRumorEligible: undefined,
      } as unknown as ControllerPlayerStatus;

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.wantsBoss).toBe(true);
      expect(playerState.selectedBossId).toBe("remilia");
      expect(playerState.role).toBe("boss");
      expect(playerState.selectedHeroId).toBe("existing-hero");
      expect(playerState.isRumorEligible).toBe(true);
    });

    it("should clear eliminated state when a revived raid player syncs back in", () => {
      playerState.eliminated = true;
      playerState.remainingLives = 0;

      const controllerStatus: ControllerPlayerStatus = {
        hp: 90,
        remainingLives: 1,
        eliminated: false,
        boardUnitCount: 1,
        gold: 12,
        specialUnitLevel: 2,
        shopOffers: [],
        shopLocked: false,
        benchUnits: ["vanguard"],
        benchDisplayNames: ["博麗の守り"],
        boardUnits: [],
        ownedUnits: { vanguard: 1, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "raid",
        selectedHeroId: "marisa",
        isRumorEligible: false,
        finalRoundShield: 1,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.remainingLives).toBe(1);
      expect(playerState.eliminated).toBe(false);
      expect(playerState.finalRoundShield).toBe(1);
      expect(playerState.benchUnits.length).toBe(1);
      expect(playerState.benchUnits[0]).toBe("vanguard");
    });

    it("should sync final-round shield when controller status provides it", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 88,
        remainingLives: 2,
        eliminated: false,
        boardUnitCount: 2,
        gold: 10,
        specialUnitLevel: 2,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "raid",
        selectedHeroId: "reimu",
        isRumorEligible: false,
        finalRoundShield: 2,
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      expect(playerState.finalRoundShield).toBe(2);
    });
  });

  describe("disabled feature fields backward compatibility", () => {
    it("should keep default values for disabled features when controller does not provide them", () => {
      // Simulate controller data without feature-flagged fields
      const minimalStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "", // Empty when hero system disabled
        isRumorEligible: false, // False when rumor influence disabled
      };

      syncPlayerStateFromController(playerState, minimalStatus);

      // Default values should be preserved for disabled feature fields
      expect(playerState.selectedHeroId).toBe("");
      expect(playerState.isRumorEligible).toBe(false);
      expect(playerState.bossShopOffers.length).toBe(0);
    });

    it("should handle undefined optional arrays gracefully", () => {
      const statusWithUndefinedArrays: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 15,
        specialUnitLevel: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        bossShopOffers: [],
        lastBattleResult: undefined,
        activeSynergies: undefined as unknown as [],
        wantsBoss: false,
        selectedBossId: "",
        role: "unassigned",
        selectedHeroId: "",
        isRumorEligible: false,
      };

      // Should not throw
      expect(() => {
        syncPlayerStateFromController(playerState, statusWithUndefinedArrays);
      }).not.toThrow();

      expect(playerState.activeSynergies.length).toBe(0);
    });
  });
});
