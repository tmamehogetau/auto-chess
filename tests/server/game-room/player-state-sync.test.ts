import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArraySchema } from "@colyseus/schema";
import {
  syncPlayerStateFromController,
  syncPlayerStateFromCommandResult,
  type ControllerPlayerStatus,
  type CommandResultPayload,
  type PlayerStatusBattleResult,
} from "../../../src/server/rooms/game-room/player-state-sync";
import {
  PlayerPresenceState,
  MatchRoomState,
  ShopOfferState,
  ShopItemOfferState,
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
        xp: 4,
        level: 2,
        shopOffers: [
          { unitType: "vanguard", cost: 1, rarity: 1, isRumorUnit: false },
          { unitType: "mage", cost: 2, rarity: 2, isRumorUnit: true },
        ],
        shopLocked: true,
        benchUnits: ["unit-a", "unit-b"],
        boardUnits: ["board-unit-1", "board-unit-2", "board-unit-3"],
        ownedUnits: {
          vanguard: 2,
          ranger: 1,
          mage: 0,
          assassin: 0,
        },
        itemInventory: ["sword", "shield"],
        itemShopOffers: [
          { itemType: "sword", cost: 3 },
          { itemType: "bow", cost: 4 },
        ],
        bossShopOffers: [
          { unitType: "vanguard", cost: 5, rarity: 4, isRumorUnit: false },
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
      };

      syncPlayerStateFromController(playerState, controllerStatus);

      // Basic fields
      expect(playerState.hp).toBe(75);
      expect(playerState.remainingLives).toBe(0);
      expect(playerState.eliminated).toBe(false);
      expect(playerState.boardUnitCount).toBe(3);
      expect(playerState.gold).toBe(25);
      expect(playerState.xp).toBe(4);
      expect(playerState.level).toBe(2);
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
      expect(playerState.boardUnits.length).toBe(3);
      expect(playerState.boardUnits[2]).toBe("board-unit-3");
    });

    it("should preserve optional unitId fields in shop payloads", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 75,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 3,
        gold: 25,
        xp: 4,
        level: 2,
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
        boardUnits: ["board-unit-1"],
        ownedUnits: {
          vanguard: 2,
          ranger: 1,
          mage: 0,
          assassin: 0,
        },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
      expect(playerState.itemInventory.length).toBe(0);
      expect(playerState.itemShopOffers.length).toBe(0);
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
        bossShopOffers: [],
        lastBattleResult: {
          opponentId: "opponent-123",
          won: false,
          damageDealt: 5,
          damageTaken: 12,
          survivors: 1,
          opponentSurvivors: 4,
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
    });

    it("should sync active synergies correctly", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
        bossShopOffers: [
          { unitType: "vanguard", cost: 5, rarity: 4, isRumorUnit: false },
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
    });

    it("should sync boss preference fields from controller status", () => {
      const controllerStatus: ControllerPlayerStatus = {
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnitCount: 4,
        gold: 20,
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 0,
        level: 1,
        shopOffers: [
          { unitType: "mage", cost: 2, rarity: 2, isRumorUnit: true },
          { unitType: "vanguard", cost: 1, rarity: 1, isRumorUnit: false },
        ],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 2,
        level: 1,
        shopOffers: [{ unitType: "mage", cost: 3, rarity: 2, isRumorUnit: false }],
        shopLocked: false,
        benchUnits: ["new-unit-1"],
        boardUnits: ["board-1", "board-2"],
        ownedUnits: { vanguard: 1, ranger: 0, mage: 1, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
    });
  });

  describe("syncPlayerStateFromCommandResult", () => {
    it("should sync command result payload into room state", () => {
      const cmdResult = {
        boardUnitCount: 5,
        gold: 30,
        xp: 8,
        level: 3,
        shopLocked: false,
        ownedUnits: {
          vanguard: 3,
          ranger: 2,
          mage: 1,
          assassin: 0,
        },
        shopOffers: [
          { unitType: "assassin", cost: 4, rarity: 3, isRumorUnit: false },
        ],
        benchUnits: ["unit-x", "unit-y", "unit-z"],
        boardUnits: ["b1", "b2", "b3", "b4", "b5"],
        itemShopOffers: [{ itemType: "staff", cost: 5 }],
        itemInventory: ["potion"],
        lastBattleResult: {
          opponentId: "p2",
          won: true,
          damageDealt: 20,
          damageTaken: 5,
          survivors: 5,
          opponentSurvivors: 0,
        } as PlayerStatusBattleResult,
        activeSynergies: [{ unitType: "ranger", count: 2, tier: 1 }],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 42);

      expect(playerState.lastCmdSeq).toBe(42);
      expect(playerState.boardUnitCount).toBe(5);
      expect(playerState.gold).toBe(30);
      expect(playerState.xp).toBe(8);
      expect(playerState.level).toBe(3);
      expect(playerState.shopLocked).toBe(false);
      expect(playerState.ownedVanguard).toBe(3);
      expect(playerState.ownedRanger).toBe(2);
      expect(playerState.ownedMage).toBe(1);
      expect(playerState.benchUnits.length).toBe(3);
      expect(playerState.boardUnits.length).toBe(5);
    });

    it("should update lastCmdSeq when provided", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
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
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
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
      playerState.itemInventory.push("old-item");

      const cmdResult = {
        boardUnitCount: 2,
        gold: 20,
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: ["new-1", "new-2"],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: ["new-item"],
        lastBattleResult: undefined,
        activeSynergies: [],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 5);

      expect(playerState.shopOffers.length).toBe(0);
      expect(playerState.benchUnits.length).toBe(2);
      expect(playerState.benchUnits[0]).toBe("new-1");
      expect(playerState.itemInventory.length).toBe(1);
      expect(playerState.itemInventory[0]).toBe("new-item");
    });

    it("should sync shopOffers with isRumorUnit field", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [
          { unitType: "vanguard", cost: 1, rarity: 1, isRumorUnit: false },
          { unitType: "mage", cost: 2, rarity: 2, isRumorUnit: true },
        ],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
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
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
        lastBattleResult: undefined,
        activeSynergies: [],
        bossShopOffers: [
          { unitType: "vanguard", cost: 5, rarity: 4, isRumorUnit: false },
        ],
      };

      syncPlayerStateFromCommandResult(playerState, cmdResult, 1);

      expect(playerState.bossShopOffers.length).toBe(1);
      expect(playerState.bossShopOffers[0]!.unitType).toBe("vanguard");
      expect(playerState.bossShopOffers[0]!.cost).toBe(5);
      expect(playerState.bossShopOffers[0]!.isRumorUnit).toBe(false);
    });

    it("should sync selectedHeroId and isRumorEligible when provided", () => {
      const cmdResult = {
        boardUnitCount: 4,
        gold: 15,
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
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
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
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
        xp: 0,
        level: 1,
        shopLocked: false,
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        shopOffers: [],
        benchUnits: [],
        boardUnits: [],
        itemShopOffers: [],
        itemInventory: [],
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
        xp: 3,
        level: 2,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
        xp: 0,
        level: 1,
        shopOffers: [],
        shopLocked: false,
        benchUnits: [],
        boardUnits: [],
        ownedUnits: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
        itemInventory: [],
        itemShopOffers: [],
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
