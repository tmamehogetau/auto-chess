import { describe, expect, it } from "vitest";

import {
  applyPrepIncomeToPlayers,
  initializeShopsForPrep,
  refreshShopByCount,
  refreshShopsForPrep,
} from "../../../src/server/match-room-controller/prep-economy";

interface TestOffer {
  unitType: string;
  rarity: number;
  cost: number;
  unitId?: string;
  displayName?: string;
  factionId?: string;
}

describe("prep-economy", () => {
  it("applies prep income to alive players and falls back to initial gold", () => {
    const goldByPlayer = new Map<string, number>([["p1", 3]]);

    applyPrepIncomeToPlayers({
      alivePlayerIds: ["p1", "p2"],
      goldByPlayer,
      baseIncome: 5,
      initialGold: 2,
    });

    expect(goldByPlayer.get("p1")).toBe(8);
    expect(goldByPlayer.get("p2")).toBe(7);
  });

  it("initializes prep shops, resets counters, and seeds boss offers only for the boss", () => {
    const shopRefreshCountByPlayer = new Map<string, number>([["boss", 9]]);
    const shopPurchaseCountByPlayer = new Map<string, number>([["boss", 9]]);
    const shopLockedByPlayer = new Map<string, boolean>([["boss", true]]);
    const kouRyuudouFreeRefreshConsumedByPlayer = new Map<string, boolean>([["boss", true]]);
    const rumorInfluenceEligibleByPlayer = new Map<string, boolean>([["boss", true], ["raid", false]]);
    const shopOffersByPlayer = new Map<string, TestOffer[]>();
    const bossShopOffersByPlayer = new Map<string, Array<{ unitType: string; cost: number }>>();

    initializeShopsForPrep({
      playerIds: ["boss", "raid"],
      roundIndex: 4,
      isBossPlayer: (playerId) => playerId === "boss",
      buildShopOffers: (playerId, roundIndex, refreshCount, purchaseCount, isRumorEligible) => [{
        unitType: playerId,
        rarity: roundIndex,
        cost: refreshCount + purchaseCount + (isRumorEligible ? 1 : 0),
      }],
      buildBossShopOffers: () => [{ unitType: "boss-only", cost: 9 }],
      shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer,
      shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer,
      bossShopOffersByPlayer,
      enableRumorInfluence: true,
      enableBossExclusiveShop: true,
    });

    expect(shopRefreshCountByPlayer.get("boss")).toBe(0);
    expect(shopPurchaseCountByPlayer.get("boss")).toBe(0);
    expect(shopLockedByPlayer.get("boss")).toBe(false);
    expect(kouRyuudouFreeRefreshConsumedByPlayer.get("boss")).toBe(false);
    expect(shopOffersByPlayer.get("boss")).toEqual([{ unitType: "boss", rarity: 4, cost: 1 }]);
    expect(shopOffersByPlayer.get("raid")).toEqual([{ unitType: "raid", rarity: 4, cost: 0 }]);
    expect(bossShopOffersByPlayer.get("boss")).toEqual([{ unitType: "boss-only", cost: 9 }]);
    expect(bossShopOffersByPlayer.has("raid")).toBe(false);
    expect(rumorInfluenceEligibleByPlayer.get("boss")).toBe(false);
  });

  it("refreshes only unlocked prep shops and clears prior battle results", () => {
    const shopRefreshCountByPlayer = new Map<string, number>([["boss", 2], ["raid", 3]]);
    const shopPurchaseCountByPlayer = new Map<string, number>([["boss", 1], ["raid", 4]]);
    const shopLockedByPlayer = new Map<string, boolean>([["boss", false], ["raid", true]]);
    const kouRyuudouFreeRefreshConsumedByPlayer = new Map<string, boolean>([["boss", true], ["raid", true]]);
    const rumorInfluenceEligibleByPlayer = new Map<string, boolean>([["boss", true], ["raid", true]]);
    const shopOffersByPlayer = new Map<string, TestOffer[]>([
      ["boss", [{ unitType: "before-boss", rarity: 1, cost: 1 }]],
      ["raid", [{ unitType: "before-raid", rarity: 1, cost: 1 }]],
    ]);
    const bossShopOffersByPlayer = new Map<string, Array<{ unitType: string; cost: number }>>();
    const battleResultsByPlayer = new Map<string, { won: boolean }>([
      ["boss", { won: true }],
      ["raid", { won: false }],
    ]);

    refreshShopsForPrep({
      alivePlayerIds: ["boss", "raid"],
      roundIndex: 6,
      isBossPlayer: (playerId) => playerId === "boss",
      buildShopOffers: (playerId, roundIndex, refreshCount, purchaseCount, isRumorEligible) => [{
        unitType: `${playerId}-${roundIndex}`,
        rarity: roundIndex,
        cost: refreshCount + purchaseCount + (isRumorEligible ? 1 : 0),
      }],
      buildBossShopOffers: () => [{ unitType: "boss-only", cost: 7 }],
      shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer,
      shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer,
      bossShopOffersByPlayer,
      battleResultsByPlayer,
      enableRumorInfluence: true,
      enableBossExclusiveShop: true,
    });

    expect(shopRefreshCountByPlayer.get("boss")).toBe(0);
    expect(shopPurchaseCountByPlayer.get("boss")).toBe(0);
    expect(kouRyuudouFreeRefreshConsumedByPlayer.get("boss")).toBe(false);
    expect(shopOffersByPlayer.get("boss")).toEqual([{ unitType: "boss-6", rarity: 6, cost: 1 }]);
    expect(shopOffersByPlayer.get("raid")).toEqual([{ unitType: "before-raid", rarity: 1, cost: 1 }]);
    expect(rumorInfluenceEligibleByPlayer.get("boss")).toBe(false);
    expect(rumorInfluenceEligibleByPlayer.get("raid")).toBe(true);
    expect(bossShopOffersByPlayer.get("boss")).toEqual([{ unitType: "boss-only", cost: 7 }]);
    expect(battleResultsByPlayer.size).toBe(0);
  });

  it("refreshes by count, rerolls identical offers, and consumes rumor/free refresh state", () => {
    const buildShopOffersCalls: Array<{
      playerId: string;
      roundIndex: number;
      refreshCount: number;
      purchaseCount: number;
      isRumorEligible: boolean;
    }> = [];
    const shopRefreshCountByPlayer = new Map<string, number>([["p1", 1]]);
    const shopPurchaseCountByPlayer = new Map<string, number>([["p1", 5]]);
    const kouRyuudouFreeRefreshConsumedByPlayer = new Map<string, boolean>([["p1", false]]);
    const rumorInfluenceEligibleByPlayer = new Map<string, boolean>([["p1", true]]);
    const shopOffersByPlayer = new Map<string, TestOffer[]>([
      ["p1", [{ unitType: "same", rarity: 2, cost: 2 }]],
    ]);

    refreshShopByCount({
      playerId: "p1",
      roundIndex: 7,
      refreshCount: 1,
      buildShopOffers: (playerId, roundIndex, refreshCount, purchaseCount, isRumorEligible) => {
        buildShopOffersCalls.push({
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount,
          isRumorEligible,
        });
        if (purchaseCount === 0) {
          return [{ unitType: "same", rarity: 2, cost: 2 }];
        }
        return [{ unitType: "rerolled", rarity: 3, cost: 4 }];
      },
      shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer,
      enableRumorInfluence: true,
      getAvailableFreeRefreshes: () => 1,
    });

    expect(buildShopOffersCalls).toEqual([
      {
        playerId: "p1",
        roundIndex: 7,
        refreshCount: 2,
        purchaseCount: 0,
        isRumorEligible: true,
      },
      {
        playerId: "p1",
        roundIndex: 7,
        refreshCount: 2,
        purchaseCount: 1,
        isRumorEligible: true,
      },
    ]);
    expect(shopRefreshCountByPlayer.get("p1")).toBe(2);
    expect(shopPurchaseCountByPlayer.get("p1")).toBe(0);
    expect(shopOffersByPlayer.get("p1")).toEqual([{ unitType: "rerolled", rarity: 3, cost: 4 }]);
    expect(kouRyuudouFreeRefreshConsumedByPlayer.get("p1")).toBe(true);
    expect(rumorInfluenceEligibleByPlayer.get("p1")).toBe(false);
  });
});
