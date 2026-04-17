import { describe, expect, it } from "vitest";

import { GameLoopState } from "../../../src/domain/game-loop-state";
import type { FeatureFlags } from "../../../src/shared/feature-flags";
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import { SharedPool } from "../../../src/server/shared-pool";
import { resolveSharedPoolCost } from "../../../src/server/unit-id-resolver";
import {
  ShopManager,
  type ShopManagerBenchUnit,
  type ShopManagerDeps,
  type ShopManagerOwnedUnits,
  type ShopManagerShopOffer,
} from "../../../src/server/match-room-controller/shop-manager";

const BASE_FLAGS: FeatureFlags = {
  enableHeroSystem: false,
  enableSharedPool: false,
  enablePhaseExpansion: false,
  enableDominationSystem: false,
  enableSubUnitSystem: false,
  enableEmblemCells: false,
  enableSpellCard: false,
  enableRumorInfluence: false,
  enableBossExclusiveShop: false,
  enableSharedBoardShadow: false,
  enableTouhouRoster: false,
  enableTouhouFactions: false,
  enablePerUnitSharedPool: false,
};

type ShopManagerHarness = {
  manager: ShopManager;
  deps: ShopManagerDeps;
  sharedPool: SharedPool | null;
};

function createHarness(options?: {
  rosterFlags?: FeatureFlags;
  enableSharedPool?: boolean;
  enableBossExclusiveShop?: boolean;
  isBossPlayer?: boolean;
  initialOffers?: ShopManagerShopOffer[];
  bossOffers?: ShopManagerShopOffer[];
  replacementOffer?: ShopManagerShopOffer;
  boardPlacements?: BoardUnitPlacement[];
  benchUnits?: ShopManagerBenchUnit[];
  ownedUnits?: ShopManagerOwnedUnits;
  gold?: number;
}): ShopManagerHarness {
  const state = new GameLoopState(["p1", "p2"]);
  const rosterFlags = options?.rosterFlags ?? BASE_FLAGS;
  const enableSharedPool = options?.enableSharedPool ?? false;
  const sharedPool = enableSharedPool ? new SharedPool() : null;
  const replacementOffer = options?.replacementOffer ?? {
    unitType: "mage",
    unitId: "ichirin",
    rarity: 2,
    cost: 2,
  };

  const deps: ShopManagerDeps = {
    ensureStarted: () => state,
    buildShopOffers: () => [],
    buildBossShopOffers: () => [],
    buildReplacementOffer: () => replacementOffer,
    shopRefreshCountByPlayer: new Map([["p1", 0]]),
    shopPurchaseCountByPlayer: new Map([["p1", 0]]),
    shopLockedByPlayer: new Map([["p1", false]]),
    kouRyuudouFreeRefreshConsumedByPlayer: new Map([["p1", false]]),
    rumorInfluenceEligibleByPlayer: new Map([["p1", false]]),
    shopOffersByPlayer: new Map([["p1", options?.initialOffers ?? []]]),
    bossShopOffersByPlayer: new Map([["p1", options?.bossOffers ?? []]]),
    battleResultsByPlayer: new Map(),
    benchUnitsByPlayer: new Map([["p1", options?.benchUnits ?? []]]),
    boardPlacementsByPlayer: new Map([["p1", options?.boardPlacements ?? []]]),
    boardUnitCountByPlayer: new Map([["p1", (options?.boardPlacements ?? []).length]]),
    ownedUnitsByPlayer: new Map([["p1", options?.ownedUnits ?? {
      vanguard: 0,
      ranger: 0,
      mage: 0,
      assassin: 0,
    }]]),
    goldByPlayer: new Map([["p1", options?.gold ?? 15]]),
    enableRumorInfluence: false,
    enableBossExclusiveShop: options?.enableBossExclusiveShop ?? false,
    enableSharedPool,
    sharedPool,
    rosterFlags,
    initialGold: 15,
    maxBenchSize: 8,
    getMaxBoardUnitCount: (playerId: string) => {
      if (playerId !== "p1") {
        return 8;
      }
      return options?.isBossPlayer ? 6 : 2;
    },
  };

  return {
    manager: new ShopManager(deps),
    deps,
    sharedPool,
  };
}

describe("ShopManager", () => {
  it("buys a shop offer, appends a bench unit, and decrements matching shared-pool inventory", () => {
    const touhouPoolFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
      enablePerUnitSharedPool: true,
    };
    const { manager, deps, sharedPool } = createHarness({
      rosterFlags: touhouPoolFlags,
      enableSharedPool: true,
      initialOffers: [{ unitType: "ranger", unitId: "nazrin", rarity: 1, cost: 1 }],
    });

    if (!sharedPool) {
      throw new Error("expected shared pool");
    }

    const before = sharedPool.getAvailableByUnitId("nazrin", 1);

    manager.buyShopOfferBySlot("p1", 0);

    expect(deps.shopPurchaseCountByPlayer.get("p1")).toBe(1);
    expect(deps.shopOffersByPlayer.get("p1")).toEqual([
      { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
    ]);
    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "ranger", unitId: "nazrin", cost: 1, starLevel: 1, unitCount: 1 },
    ]);
    expect(deps.ownedUnitsByPlayer.get("p1")).toEqual({
      vanguard: 0,
      ranger: 1,
      mage: 0,
      assassin: 0,
    });
    expect(sharedPool.getAvailableByUnitId("nazrin", 1)).toBe(before - 1);
  });

  it("marks boss shop offers as purchased and does not duplicate bench units on repeat buys", () => {
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, starLevel: 2 }],
    });

    manager.buyBossShopOffer("p1", 0);
    manager.buyBossShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", cost: 3, starLevel: 2, unitCount: 1 },
    ]);
    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, starLevel: 2, purchased: true },
    ]);
  });

  it("returns board and bench unit inventory back to matching unit ids", () => {
    const touhouPoolFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
      enablePerUnitSharedPool: true,
    };
    const { manager, sharedPool } = createHarness({
      rosterFlags: touhouPoolFlags,
      enableSharedPool: true,
      boardPlacements: [{ cell: 0, unitType: "ranger", unitId: "nazrin", sellValue: 1, unitCount: 1 }],
      benchUnits: [{ unitType: "vanguard", unitId: "rin", cost: 1, starLevel: 1, unitCount: 1 }],
    });

    if (!sharedPool) {
      throw new Error("expected shared pool");
    }

    sharedPool.decreaseByUnitId("nazrin", 1);
    sharedPool.decreaseByUnitId("rin", 1);
    const nazrinBefore = sharedPool.getAvailableByUnitId("nazrin", 1);
    const rinBefore = sharedPool.getAvailableByUnitId("rin", 1);

    manager.releasePlayerInventoryToSharedPool("p1");

    expect(sharedPool.getAvailableByUnitId("nazrin", 1)).toBe(nazrinBefore + 1);
    expect(sharedPool.getAvailableByUnitId("rin", 1)).toBe(rinBefore + 1);
  });

  it("does not mutate shop state when a regular shop buy would overflow a full bench", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      starLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      initialOffers: [{ unitType: "ranger", unitId: "nazrin", rarity: 1, cost: 1 }],
      benchUnits: fullBench,
    });

    manager.buyShopOfferBySlot("p1", 0);

    expect(deps.shopPurchaseCountByPlayer.get("p1")).toBe(0);
    expect(deps.shopOffersByPlayer.get("p1")).toEqual([
      { unitType: "ranger", unitId: "nazrin", rarity: 1, cost: 1 },
    ]);
    expect(deps.benchUnitsByPlayer.get("p1")).toEqual(fullBench);
    expect(deps.ownedUnitsByPlayer.get("p1")).toEqual({
      vanguard: 0,
      ranger: 0,
      mage: 0,
      assassin: 0,
    });
  });

  it("does not mutate boss shop state when a boss buy would overflow a full bench", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      starLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, starLevel: 2 }],
      benchUnits: fullBench,
    });

    manager.buyBossShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toEqual(fullBench);
    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, starLevel: 2 },
    ]);
  });

  it("merges a purchased unit into an attached sub unit even when the bench is full", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      starLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      initialOffers: [{ unitType: "mage", unitId: "patchouli", rarity: 2, cost: 2 }],
      benchUnits: fullBench,
      boardPlacements: [{
        cell: 3,
        unitType: "vanguard",
        unitId: "meiling",
        subUnit: {
          unitType: "mage",
          unitId: "patchouli",
          sellValue: 2,
          starLevel: 1,
          unitCount: 1,
        },
      }],
      ownedUnits: {
        vanguard: 10,
        ranger: 0,
        mage: 1,
        assassin: 0,
      },
    });

    manager.buyShopOfferBySlot("p1", 0);

    expect(deps.shopPurchaseCountByPlayer.get("p1")).toBe(1);
    expect(deps.benchUnitsByPlayer.get("p1")).toHaveLength(8);
    expect(deps.boardPlacementsByPlayer.get("p1")).toEqual([{
      cell: 3,
      unitType: "vanguard",
      unitId: "meiling",
      subUnit: {
        unitType: "mage",
        unitId: "patchouli",
        sellValue: 4,
        starLevel: 1,
        unitCount: 2,
      },
    }]);
  });

  it("merges a boss-shop purchase into an existing board unit even when the bench is full", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      starLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, starLevel: 2 }],
      benchUnits: fullBench,
      boardPlacements: [{
        cell: 1,
        unitType: "assassin",
        unitId: "murasa",
        sellValue: 3,
        starLevel: 2,
        unitCount: 4,
      }],
      ownedUnits: {
        vanguard: 9,
        ranger: 0,
        mage: 0,
        assassin: 4,
      },
    });

    manager.buyBossShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toHaveLength(8);
    expect(deps.boardPlacementsByPlayer.get("p1")).toEqual([{
      cell: 1,
      unitType: "assassin",
      unitId: "murasa",
      sellValue: 6,
      starLevel: 2,
      unitCount: 5,
    }]);
    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, starLevel: 2, purchased: true },
    ]);
  });

  it("prevents a raider from deploying a third main unit onto an empty cell", () => {
    const { manager, deps } = createHarness({
      isBossPlayer: false,
      boardPlacements: [
        { cell: 18, unitType: "vanguard", sellValue: 1, unitCount: 1 },
        { cell: 19, unitType: "mage", sellValue: 2, unitCount: 1 },
      ],
      benchUnits: [
        { unitType: "ranger", cost: 1, starLevel: 1, unitCount: 1 },
      ],
    });

    manager.deployBenchUnitToBoard("p1", 0, 20);

    expect(deps.boardPlacementsByPlayer.get("p1")).toHaveLength(2);
    expect(deps.benchUnitsByPlayer.get("p1")).toHaveLength(1);
  });

  it("prevents the boss from deploying a seventh main unit onto an empty cell", () => {
    const { manager, deps } = createHarness({
      isBossPlayer: true,
      boardPlacements: [
        { cell: 0, unitType: "vanguard", sellValue: 1, unitCount: 1 },
        { cell: 1, unitType: "mage", sellValue: 2, unitCount: 1 },
        { cell: 2, unitType: "ranger", sellValue: 1, unitCount: 1 },
        { cell: 3, unitType: "assassin", sellValue: 1, unitCount: 1 },
        { cell: 4, unitType: "vanguard", sellValue: 1, unitCount: 1 },
        { cell: 5, unitType: "mage", sellValue: 2, unitCount: 1 },
      ],
      benchUnits: [
        { unitType: "ranger", cost: 1, starLevel: 1, unitCount: 1 },
      ],
    });

    manager.deployBenchUnitToBoard("p1", 0, 6);

    expect(deps.boardPlacementsByPlayer.get("p1")).toHaveLength(6);
    expect(deps.benchUnitsByPlayer.get("p1")).toHaveLength(1);
  });

  it("sells an attached host by refunding both the host and its sub unit", () => {
    const touhouPoolFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
      enablePerUnitSharedPool: true,
    };
    const { manager, deps, sharedPool } = createHarness({
      rosterFlags: touhouPoolFlags,
      enableSharedPool: true,
      boardPlacements: [{
        cell: 0,
        unitType: "vanguard",
        unitId: "meiling",
        sellValue: 1,
        starLevel: 1,
        unitCount: 1,
        subUnit: {
          unitType: "mage",
          unitId: "patchouli",
          sellValue: 2,
          starLevel: 1,
          unitCount: 1,
        },
      }],
      ownedUnits: {
        vanguard: 1,
        ranger: 0,
        mage: 1,
        assassin: 0,
      },
      gold: 5,
    });

    if (!sharedPool) {
      throw new Error("expected shared pool");
    }

    const meilingPoolCost = resolveSharedPoolCost("meiling", 1, touhouPoolFlags);
    const patchouliPoolCost = resolveSharedPoolCost("patchouli", 2, touhouPoolFlags);
    const increaseByUnitIdSpy = vi.spyOn(sharedPool, "increaseByUnitId");

    manager.sellBoardUnit("p1", 0);

    expect(deps.boardPlacementsByPlayer.get("p1")).toEqual([]);
    expect(deps.ownedUnitsByPlayer.get("p1")).toEqual({
      vanguard: 0,
      ranger: 0,
      mage: 0,
      assassin: 0,
    });
    expect(deps.goldByPlayer.get("p1")).toBe(6);
    expect(increaseByUnitIdSpy).toHaveBeenCalledWith("meiling", meilingPoolCost);
    expect(increaseByUnitIdSpy).toHaveBeenCalledWith("patchouli", patchouliPoolCost);
  });

  it("returns attached sub units to the shared pool when releasing player inventory", () => {
    const touhouPoolFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
      enablePerUnitSharedPool: true,
    };
    const { manager, sharedPool } = createHarness({
      rosterFlags: touhouPoolFlags,
      enableSharedPool: true,
      boardPlacements: [{
        cell: 0,
        unitType: "ranger",
        unitId: "nazrin",
        sellValue: 1,
        unitCount: 1,
        subUnit: {
          unitType: "mage",
          unitId: "patchouli",
          sellValue: 2,
          unitCount: 1,
        },
      }],
    });

    if (!sharedPool) {
      throw new Error("expected shared pool");
    }

    const nazrinPoolCost = resolveSharedPoolCost("nazrin", 1, touhouPoolFlags);
    const patchouliPoolCost = resolveSharedPoolCost("patchouli", 2, touhouPoolFlags);
    const increaseByUnitIdSpy = vi.spyOn(sharedPool, "increaseByUnitId");

    manager.releasePlayerInventoryToSharedPool("p1");

    expect(increaseByUnitIdSpy).toHaveBeenCalledWith("nazrin", nazrinPoolCost);
    expect(increaseByUnitIdSpy).toHaveBeenCalledWith("patchouli", patchouliPoolCost);
  });
});
