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

type TouhouLevelUpGoldBonusClaimKey = string;

function createHarness(options?: {
  rosterFlags?: FeatureFlags;
  enableSharedPool?: boolean;
  enableBossExclusiveShop?: boolean;
  isBossPlayer?: boolean;
  initialOffers?: ShopManagerShopOffer[];
  bossOffers?: ShopManagerShopOffer[];
  heroExclusiveOffers?: ShopManagerShopOffer[];
  replacementOffer?: ShopManagerShopOffer;
  boardPlacements?: BoardUnitPlacement[];
  benchUnits?: ShopManagerBenchUnit[];
  ownedUnits?: ShopManagerOwnedUnits;
  gold?: number;
  touhouLevelUpGoldBonusClaimKeys?: Set<TouhouLevelUpGoldBonusClaimKey>;
  touhouBonusFreeRefreshCount?: number;
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
    touhouBonusFreeRefreshCountByPlayer: new Map([["p1", options?.touhouBonusFreeRefreshCount ?? 0]]),
    touhouLevelUpGoldBonusClaimKeysByPlayer: new Map([
      ["p1", options?.touhouLevelUpGoldBonusClaimKeys ?? new Set<TouhouLevelUpGoldBonusClaimKey>()],
    ]),
    rumorInfluenceEligibleByPlayer: new Map([["p1", false]]),
    shopOffersByPlayer: new Map([["p1", options?.initialOffers ?? []]]),
    bossShopOffersByPlayer: new Map([["p1", options?.bossOffers ?? []]]),
    heroExclusiveShopOffersByPlayer: new Map([["p1", options?.heroExclusiveOffers ?? []]]),
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
      { unitType: "ranger", unitId: "nazrin", cost: 1, unitLevel: 1, unitCount: 1 },
    ]);
    expect(deps.ownedUnitsByPlayer.get("p1")).toEqual({
      vanguard: 0,
      ranger: 1,
      mage: 0,
      assassin: 0,
    });
    expect(sharedPool.getAvailableByUnitId("nazrin", 1)).toBe(before - 1);
  });

  it("does not grant gold when buying Chimata without a level up", () => {
    const touhouRosterFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
    };
    const { manager, deps } = createHarness({
      rosterFlags: touhouRosterFlags,
      gold: 5,
      initialOffers: [{ unitType: "mage", unitId: "chimata", rarity: 2, cost: 2 }],
    });

    manager.buyShopOfferBySlot("p1", 0);

    expect(deps.goldByPlayer.get("p1")).toBe(5);
    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "mage", unitId: "chimata", cost: 2, unitLevel: 1, unitCount: 1 },
    ]);
  });

  it("grants Chimata gold only when a purchase raises Chimata's level", () => {
    const touhouRosterFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
    };
    const { manager, deps } = createHarness({
      rosterFlags: touhouRosterFlags,
      gold: 5,
      initialOffers: [{ unitType: "mage", unitId: "chimata", rarity: 2, cost: 2 }],
      replacementOffer: { unitType: "mage", unitId: "chimata", rarity: 2, cost: 2 },
    });

    manager.buyShopOfferBySlot("p1", 0);
    manager.buyShopOfferBySlot("p1", 0);

    expect(deps.goldByPlayer.get("p1")).toBe(6);
    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "mage", unitId: "chimata", cost: 4, unitLevel: 2, unitCount: 2 },
    ]);
  });

  it("grants Chimata gold on each level up and bonus free refreshes at level 4 and level 7", () => {
    const touhouRosterFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
    };
    const { manager, deps } = createHarness({
      rosterFlags: touhouRosterFlags,
      gold: 5,
      initialOffers: [{ unitType: "mage", unitId: "chimata", rarity: 2, cost: 2 }],
      replacementOffer: { unitType: "mage", unitId: "chimata", rarity: 2, cost: 2 },
    });

    for (let index = 0; index < 8; index += 1) {
      manager.buyShopOfferBySlot("p1", 0);
    }

    expect(deps.goldByPlayer.get("p1")).toBe(11);
    expect(deps.touhouBonusFreeRefreshCountByPlayer.get("p1")).toBe(3);
    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "mage", unitId: "chimata", cost: 16, unitLevel: 7, unitCount: 8 },
    ]);
  });

  it("grants Chimata level refund when a purchase upgrades the board copy", () => {
    const touhouRosterFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
    };
    const { manager, deps } = createHarness({
      rosterFlags: touhouRosterFlags,
      gold: 5,
      initialOffers: [{ unitType: "mage", unitId: "chimata", rarity: 2, cost: 2 }],
      boardPlacements: [{
        cell: 0,
        unitType: "mage",
        unitId: "chimata",
        unitLevel: 3,
        unitCount: 3,
        sellValue: 6,
      }],
    });

    manager.buyShopOfferBySlot("p1", 0);

    expect(deps.goldByPlayer.get("p1")).toBe(6);
    expect(deps.touhouBonusFreeRefreshCountByPlayer.get("p1")).toBe(1);
    expect(deps.boardPlacementsByPlayer.get("p1")).toEqual([{
      cell: 0,
      unitType: "mage",
      unitId: "chimata",
      unitLevel: 4,
      unitCount: 4,
      sellValue: 8,
    }]);
  });

  it("spends Chimata bonus free refreshes before charging gold for rerolls", () => {
    const touhouRosterFlags: FeatureFlags = {
      ...BASE_FLAGS,
      enableTouhouRoster: true,
    };
    const { manager, deps } = createHarness({
      rosterFlags: touhouRosterFlags,
      gold: 5,
      touhouBonusFreeRefreshCount: 2,
    });

    manager.refreshShopByCount("p1", 2);

    expect(deps.goldByPlayer.get("p1")).toBe(5);
    expect(deps.touhouBonusFreeRefreshCountByPlayer.get("p1")).toBe(0);
    expect(deps.shopRefreshCountByPlayer.get("p1")).toBe(2);
  });

  it("marks boss shop offers as purchased and does not duplicate bench units on repeat buys", () => {
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2 }],
    });

    manager.buyBossShopOffer("p1", 0);
    manager.buyBossShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", cost: 3, unitLevel: 2, unitCount: 1 },
    ]);
    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2, purchased: true },
    ]);
  });

  it("normalizes legacy boss shop unitLevel input to unitLevel after purchase", () => {
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2 }] as unknown as ShopManagerShopOffer[],
    });

    manager.buyBossShopOffer("p1", 0);

    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2, purchased: true },
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
      benchUnits: [{ unitType: "vanguard", unitId: "rin", cost: 1, unitLevel: 1, unitCount: 1 }],
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
      unitLevel: 1,
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
      unitLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2 }],
      benchUnits: fullBench,
    });

    manager.buyBossShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toEqual(fullBench);
    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2 },
    ]);
  });

  it("marks hero-exclusive shop offers as purchased and does not duplicate bench units on repeat buys", () => {
    const { manager, deps } = createHarness({
      heroExclusiveOffers: [{ unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 }],
    });

    manager.buyHeroExclusiveShopOffer("p1", 0);
    manager.buyHeroExclusiveShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toEqual([
      { unitType: "vanguard", unitId: "mayumi", cost: 3, unitLevel: 1, unitCount: 1 },
    ]);
    expect(deps.heroExclusiveShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3, unitLevel: 1, purchased: true },
    ]);
  });

  it("does not mutate hero-exclusive shop state when a buy would overflow a full bench", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      unitLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      heroExclusiveOffers: [{ unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 }],
      benchUnits: fullBench,
    });

    manager.buyHeroExclusiveShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toEqual(fullBench);
    expect(deps.heroExclusiveShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 },
    ]);
  });

  it("merges a hero-exclusive shop purchase into an existing board unit even when the bench is full", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      unitLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      heroExclusiveOffers: [{ unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 }],
      benchUnits: fullBench,
      boardPlacements: [{
        cell: 1,
        unitType: "vanguard",
        unitId: "mayumi",
        sellValue: 3,
        unitLevel: 2,
        unitCount: 4,
      }],
      ownedUnits: {
        vanguard: 4,
        ranger: 0,
        mage: 0,
        assassin: 0,
      },
    });

    manager.buyHeroExclusiveShopOffer("p1", 0);

    expect(deps.benchUnitsByPlayer.get("p1")).toHaveLength(8);
    expect(deps.boardPlacementsByPlayer.get("p1")).toEqual([{
      cell: 1,
      unitType: "vanguard",
      unitId: "mayumi",
      sellValue: 6,
      unitLevel: 5,
      unitCount: 5,
    }]);
    expect(deps.heroExclusiveShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3, unitLevel: 1, purchased: true },
    ]);
  });

  it("does not return sold hero-exclusive bench units to the shared pool", () => {
    const { manager, deps, sharedPool } = createHarness({
      enableSharedPool: true,
      benchUnits: [{ unitType: "vanguard", unitId: "mayumi", cost: 3, unitLevel: 1, unitCount: 1 }],
      ownedUnits: {
        vanguard: 1,
        ranger: 0,
        mage: 0,
        assassin: 0,
      },
      gold: 5,
    });

    if (!sharedPool) {
      throw new Error("expected shared pool");
    }

    const before = sharedPool.getAvailable(3);

    manager.sellBenchUnit("p1", 0);

    expect(deps.goldByPlayer.get("p1")).toBe(7);
    expect(sharedPool.getAvailable(3)).toBe(before);
  });

  it("does not return hero-exclusive inventory to the shared pool on release", () => {
    const { manager, sharedPool } = createHarness({
      enableSharedPool: true,
      boardPlacements: [{
        cell: 0,
        unitType: "vanguard",
        unitId: "mayumi",
        sellValue: 3,
        unitLevel: 1,
        unitCount: 1,
        subUnit: {
          unitType: "assassin",
          unitId: "shion",
          sellValue: 3,
          unitLevel: 1,
          unitCount: 1,
        },
      }],
      benchUnits: [{ unitType: "vanguard", unitId: "ariya", cost: 3, unitLevel: 1, unitCount: 1 }],
    });

    if (!sharedPool) {
      throw new Error("expected shared pool");
    }

    const before = sharedPool.getAvailable(3);

    manager.releasePlayerInventoryToSharedPool("p1");

    expect(sharedPool.getAvailable(3)).toBe(before);
  });

  it("merges a purchased unit into an attached sub unit even when the bench is full", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      unitLevel: 1,
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
          unitLevel: 1,
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
        unitLevel: 2,
        unitCount: 2,
      },
    }]);
  });

  it("merges a boss-shop purchase into an existing board unit even when the bench is full", () => {
    const fullBench = Array.from({ length: 8 }, (_, index) => ({
      unitType: "vanguard" as const,
      unitId: `bench-${index}`,
      cost: 1,
      unitLevel: 1,
      unitCount: 1,
    }));
    const { manager, deps } = createHarness({
      enableBossExclusiveShop: true,
      bossOffers: [{ unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2 }],
      benchUnits: fullBench,
      boardPlacements: [{
        cell: 1,
        unitType: "assassin",
        unitId: "murasa",
        sellValue: 3,
        unitLevel: 2,
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
      unitLevel: 5,
      unitCount: 5,
    }]);
    expect(deps.bossShopOffersByPlayer.get("p1")).toEqual([
      { unitType: "assassin", unitId: "murasa", rarity: 3, cost: 3, unitLevel: 2, purchased: true },
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
        { unitType: "ranger", cost: 1, unitLevel: 1, unitCount: 1 },
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
        { unitType: "ranger", cost: 1, unitLevel: 1, unitCount: 1 },
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
        unitLevel: 1,
        unitCount: 1,
        subUnit: {
          unitType: "mage",
          unitId: "patchouli",
          sellValue: 2,
          unitLevel: 1,
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
