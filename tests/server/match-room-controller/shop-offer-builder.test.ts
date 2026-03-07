import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ShopOfferBuilder,
  type ShopOfferBuilderDependencies,
} from "../../../src/server/match-room-controller/shop-offer-builder";
import type { BoardUnitType } from "../../../src/shared/room-messages";
import type { ItemType } from "../../../src/server/combat/item-definitions";

describe("ShopOfferBuilder", () => {
  let builder: ShopOfferBuilder;
  let mockDeps: ShopOfferBuilderDependencies;

  beforeEach(() => {
    mockDeps = {
      getRumorUnitForRound: vi.fn(),
      getRandomScarletMansionUnit: vi.fn(),
      hashToUint32: vi.fn((text: string) => {
        // Simple deterministic hash for testing
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = ((hash << 5) - hash) + text.charCodeAt(i);
          hash = hash & hash;
        }
        return Math.abs(hash) % 4294967296;
      }),
      seedToUnitFloat: vi.fn((seed: number) => {
        // Deterministic float generation
        return ((seed * 9301 + 49297) % 233280) / 233280;
      }),
      pickRarity: vi.fn((odds, roll) => {
        const [one, two] = odds;
        if (roll < one) return 1;
        if (roll < one + two) return 2;
        return 3;
      }),
      getPlayerLevel: vi.fn(() => 1),
      isSharedPoolEnabled: vi.fn(() => false),
      isPoolDepleted: vi.fn(() => false),
      enableRumorInfluence: false,
      setId: "default",
    };

    builder = new ShopOfferBuilder(mockDeps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildShopOffers", () => {
    test("creates 5 normal shop offers at level 1", () => {
      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      offers.forEach((offer) => {
        expect(offer).toHaveProperty("unitType");
        expect(offer).toHaveProperty("rarity");
        expect(offer).toHaveProperty("cost");
        expect(offer.cost).toBe(offer.rarity);
      });
    });

    test("respects different player levels for rarity distribution", () => {
      mockDeps.getPlayerLevel = vi.fn(() => 5);

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getPlayerLevel).toHaveBeenCalledWith("player1");
    });

    test("includes rumor unit for eligible players when feature is enabled", () => {
      mockDeps.enableRumorInfluence = true;
      mockDeps.getRumorUnitForRound = vi.fn(() => ({
        unitType: "vanguard" as BoardUnitType,
        rarity: 2 as const,
        cost: 2,
      }));

      const offers = builder.buildShopOffers("player1", 1, 0, 0, true);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getRumorUnitForRound).toHaveBeenCalledWith(1);
      expect(offers[0]).toMatchObject({
        unitType: "vanguard",
        rarity: 2,
        cost: 2,
        isRumorUnit: true,
      });
    });

    test("does not include rumor unit when player is not eligible", () => {
      mockDeps.enableRumorInfluence = true;

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getRumorUnitForRound).not.toHaveBeenCalled();
      offers.forEach((offer) => {
        expect(offer.isRumorUnit).toBeUndefined();
      });
    });

    test("does not include rumor unit when feature is disabled", () => {
      mockDeps.enableRumorInfluence = false;

      const offers = builder.buildShopOffers("player1", 1, 0, 0, true);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getRumorUnitForRound).not.toHaveBeenCalled();
    });

    test("handles refresh count and purchase count for seed generation", () => {
      const offers1 = builder.buildShopOffers("player1", 1, 0, 0, false);
      const offers2 = builder.buildShopOffers("player1", 1, 1, 0, false);

      expect(offers1).toHaveLength(5);
      expect(offers2).toHaveLength(5);
      // Different refresh counts should produce different seeds
      expect(mockDeps.hashToUint32).toHaveBeenCalledWith(
        expect.stringContaining(":1:0:0:")
      );
      expect(mockDeps.hashToUint32).toHaveBeenCalledWith(
        expect.stringContaining(":1:1:0:")
      );
    });
  });

  describe("buildBossShopOffers", () => {
    test("creates 2 boss shop offers", () => {
      mockDeps.getRandomScarletMansionUnit = vi.fn(() => ({
        unitType: "vanguard" as BoardUnitType,
        cost: 3,
        name: "Test Boss Unit",
      }));

      const offers = builder.buildBossShopOffers();

      expect(offers).toHaveLength(2);
      expect(mockDeps.getRandomScarletMansionUnit).toHaveBeenCalledTimes(2);
      offers.forEach((offer) => {
        expect(offer).toHaveProperty("unitType");
        expect(offer).toHaveProperty("rarity");
        expect(offer).toHaveProperty("cost");
      });
    });

    test("uses scarlet mansion units from data source", () => {
      mockDeps.getRandomScarletMansionUnit = vi.fn()
        .mockReturnValueOnce({
          unitType: "vanguard" as BoardUnitType,
          cost: 2,
          name: "Unit A",
        })
        .mockReturnValueOnce({
          unitType: "mage" as BoardUnitType,
          cost: 3,
          name: "Unit B",
        });

      const offers = builder.buildBossShopOffers();

      expect(offers[0].unitType).toBe("vanguard");
      expect(offers[0].cost).toBe(2);
      expect(offers[1].unitType).toBe("mage");
      expect(offers[1].cost).toBe(3);
    });
  });

  describe("buildItemShopOffers", () => {
    test("creates 5 item shop offers", () => {
      const mockItems: ItemType[] = ["sword", "shield", "potion"];
      const mockItemDefs = {
        sword: { cost: 5, name: "Sword" },
        shield: { cost: 4, name: "Shield" },
        potion: { cost: 3, name: "Potion" },
      };

      const offers = builder.buildItemShopOffers(mockItems, mockItemDefs);

      expect(offers).toHaveLength(5);
      offers.forEach((offer) => {
        expect(offer).toHaveProperty("itemType");
        expect(offer).toHaveProperty("cost");
        expect(mockItems).toContain(offer.itemType);
      });
    });

    test("uses provided item definitions for costs", () => {
      const mockItems: ItemType[] = ["sword"];
      const mockItemDefs = {
        sword: { cost: 10, name: "Expensive Sword" },
      };

      // Mock Math.random to always return 0 (first item)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0);

      const offers = builder.buildItemShopOffers(mockItems, mockItemDefs);

      expect(offers[0].cost).toBe(10);

      Math.random = originalRandom;
    });
  });

  describe("shared pool integration", () => {
    test("filters depleted units when shared pool is enabled", () => {
      mockDeps.isSharedPoolEnabled = vi.fn(() => true);
      mockDeps.isPoolDepleted = vi.fn((cost: number) => cost === 1);

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(mockDeps.isPoolDepleted).toHaveBeenCalled();
    });

    test("falls back to lower rarity when all units depleted", () => {
      mockDeps.isSharedPoolEnabled = vi.fn(() => true);
      mockDeps.isPoolDepleted = vi.fn(() => true);
      mockDeps.pickRarity = vi.fn(() => 3); // Try to get rarity 3
      mockDeps.getPlayerLevel = vi.fn(() => 6); // High level to allow rarity 3

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      // Should still produce offers even when pool is depleted
      offers.forEach((offer) => {
        expect(offer.unitType).toBeDefined();
      });
    });
  });

  describe("deterministic behavior", () => {
    test("produces same offers with same inputs", () => {
      mockDeps.getPlayerLevel = vi.fn(() => 1);
      mockDeps.hashToUint32 = vi.fn((text) => {
        // Deterministic hash
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = ((hash << 5) - hash) + text.charCodeAt(i);
          hash = hash & hash;
        }
        return Math.abs(hash) % 4294967296;
      });
      mockDeps.seedToUnitFloat = vi.fn((seed) => {
        return ((seed * 9301 + 49297) % 233280) / 233280;
      });

      const offers1 = builder.buildShopOffers("player1", 1, 0, 0, false);
      const offers2 = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers1).toEqual(offers2);
    });

    test("produces different offers with different seeds", () => {
      const offers1 = builder.buildShopOffers("player1", 1, 0, 0, false);
      const offers2 = builder.buildShopOffers("player2", 1, 0, 0, false);

      expect(offers1).toHaveLength(5);
      expect(offers2).toHaveLength(5);
      // Different players should have different seeds
      expect(mockDeps.hashToUint32).toHaveBeenCalledWith(
        expect.stringContaining("player1")
      );
      expect(mockDeps.hashToUint32).toHaveBeenCalledWith(
        expect.stringContaining("player2")
      );
    });
  });
});
