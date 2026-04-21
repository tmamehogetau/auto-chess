import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ShopOfferBuilder,
  type ShopOfferBuilderDependencies,
} from "../../../src/server/match-room-controller/shop-offer-builder";
import type { BoardUnitType } from "../../../src/shared/room-messages";
import {
  ROSTER_KIND_MVP,
  ROSTER_KIND_TOUHOU,
  getTouhouDraftRosterUnits,
} from "../../../src/server/roster/roster-provider";
import {
  hashToUint32 as productionHashToUint32,
  pickRarity as productionPickRarity,
  seedToUnitFloat as productionSeedToUnitFloat,
} from "../../../src/server/match-room-controller/random-utils";

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
      pickRarity: vi.fn((odds, roll): 1 | 2 | 3 => {
        const [one, two] = odds;
        if (roll < one) return 1;
        if (roll < one + two) return 2;
        return 3;
      }) as ShopOfferBuilderDependencies['pickRarity'],
      getSpecialUnitLevel: vi.fn(() => 1),
      isSharedPoolEnabled: vi.fn(() => false),
      isPoolDepleted: vi.fn(() => false),
      isPerUnitPoolEnabled: vi.fn(() => false),
      isUnitIdPoolDepleted: vi.fn(() => false),
      isRumorInfluenceEnabled: vi.fn(() => false),
      setId: "default",
      random: vi.fn(() => 0.5),
      getActiveRosterKind: vi.fn(() => ROSTER_KIND_MVP),
      getTouhouDraftRosterUnits: vi.fn(() => []),
    };

    builder = new ShopOfferBuilder(mockDeps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockTouhouRollStreams(costRoll: number, unitRoll = 0): void {
    mockDeps.hashToUint32 = vi.fn((text: string) => {
      if (text.endsWith(":touhou:cost")) {
        return 1;
      }

      if (text.endsWith(":touhou:unit")) {
        return 2;
      }

      return 0;
    });
    mockDeps.seedToUnitFloat = vi.fn((seed: number) => {
      if (seed === 1) {
        return costRoll;
      }

      if (seed === 2) {
        return unitRoll;
      }

      return 0;
    });
  }

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
      mockDeps.getSpecialUnitLevel = vi.fn(() => 5);

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getSpecialUnitLevel).toHaveBeenCalledWith("player1");
    });

    test("includes rumor unit for eligible players when feature is enabled", () => {
      mockDeps.isRumorInfluenceEnabled = vi.fn(() => true);
      mockDeps.getRumorUnitForRound = vi.fn((): import("../../../src/data/rumor-units").RumorUnit | null => ({
        targetRound: 1,
        unitId: "rumor_test_vanguard_r1",
        unitType: "vanguard",
        rarity: 2,
        displayName: "テスト噂ユニット",
        description: "テスト用",
      }));

      const offers = builder.buildShopOffers("player1", 1, 0, 0, true);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getRumorUnitForRound).toHaveBeenCalledWith(1);
      expect(offers[0]).toMatchObject({
        unitType: "vanguard",
        unitId: "rumor_test_vanguard_r1",
        displayName: "テスト噂ユニット",
        rarity: 2,
        cost: 2,
        isRumorUnit: true,
      });
      expect(offers.slice(1).every((offer) => offer.isRumorUnit !== true)).toBe(true);
    });

    test("does not include rumor unit when player is not eligible", () => {
      mockDeps.isRumorInfluenceEnabled = vi.fn(() => true);

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(mockDeps.getRumorUnitForRound).not.toHaveBeenCalled();
      offers.forEach((offer) => {
        expect(offer.isRumorUnit).toBeUndefined();
      });
    });

    test("does not include rumor unit when feature is disabled", () => {
      mockDeps.isRumorInfluenceEnabled = vi.fn(() => false);

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
      mockDeps.getRandomScarletMansionUnit = vi.fn((): import("../../../src/data/scarlet-mansion-units").ScarletMansionUnit => ({
        id: "test-unit",
        unitId: "test-unit",
        displayName: "テストボスユニット",
        unitType: "vanguard",
        cost: 3,
        hp: 1000,
        attack: 100,
        attackSpeed: 1.0,
        movementSpeed: 1,
        range: 1,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        role: "テスト",
        skillDescription: "テストスキル",
        flavorText: "テストフレーバー",
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
      const createMockUnit = (unitType: BoardUnitType, cost: 2 | 3 | 4, id: string): import("../../../src/data/scarlet-mansion-units").ScarletMansionUnit => ({
        id,
        unitId: id,
        displayName: `Unit ${id}`,
        unitType,
        cost,
        hp: 1000,
        attack: 100,
        attackSpeed: 1.0,
        movementSpeed: 1,
        range: 1,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        role: "テスト",
        skillDescription: "テストスキル",
        flavorText: "テストフレーバー",
      });

      mockDeps.getRandomScarletMansionUnit = vi.fn()
        .mockReturnValueOnce(createMockUnit("vanguard", 2, "unit-a"))
        .mockReturnValueOnce(createMockUnit("mage", 3, "unit-b"));

      const offers = builder.buildBossShopOffers();

      expect(offers.length).toBeGreaterThanOrEqual(2);
      expect(offers[0]!.unitType).toBe("vanguard");
      expect(offers[0]!.cost).toBe(2);
      expect(offers[1]!.unitType).toBe("mage");
      expect(offers[1]!.cost).toBe(3);
    });
  });

  describe("buildHeroExclusiveShopOffers", () => {
    test("returns a fixed 1-slot offer for supported heroes", () => {
      expect(builder.buildHeroExclusiveShopOffers("keiki")).toEqual([
        expect.objectContaining({
          unitId: "mayumi",
          unitType: "vanguard",
        }),
      ]);
      expect(builder.buildHeroExclusiveShopOffers("jyoon")).toEqual([
        expect.objectContaining({
          unitId: "shion",
          unitType: "assassin",
        }),
      ]);
      expect(builder.buildHeroExclusiveShopOffers("yuiman")).toEqual([
        expect.objectContaining({
          unitId: "ariya",
          unitType: "vanguard",
        }),
      ]);
    });

    test("returns empty offers for unsupported heroes", () => {
      expect(builder.buildHeroExclusiveShopOffers("reimu")).toEqual([]);
      expect(builder.buildHeroExclusiveShopOffers("")).toEqual([]);
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
  });

  describe("deterministic behavior", () => {
    test("produces same offers with same inputs", () => {
      mockDeps.getSpecialUnitLevel = vi.fn(() => 1);
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

  describe("roster provider boundary", () => {
    test("uses hardcoded pools for byte-for-byte MVP compatibility when roster is MVP", () => {
      // This test verifies that the shop builder uses hardcoded SHOP_UNIT_POOL_BY_RARITY
      // for byte-for-byte compatibility with existing MVP behavior.
      // The builder should NOT rebuild pools from MVP JSON costs.

      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);
      expect(offers).toHaveLength(5);

      // Verify getActiveRosterKind was called to check roster boundary
      expect(mockDeps.getActiveRosterKind).toHaveBeenCalled();

      // Define expected hardcoded MVP pools for strict verification
      const expectedPoolsByRarity: Record<number, readonly BoardUnitType[]> = {
        1: ["vanguard", "ranger"],
        2: ["mage", "assassin"],
        3: ["assassin", "mage"],
      };

      // Verify each offer uses unit types from correct hardcoded pool for its rarity
      offers.forEach((offer) => {
        // Cost should equal rarity (MVP behavior)
        expect(offer.cost).toBe(offer.rarity);

        // Verify unit type is in the correct pool for this rarity
        const expectedPool = expectedPoolsByRarity[offer.rarity];
        expect(expectedPool).toContain(offer.unitType);
      });

      // Additional verification: ensure we don't have impossible rarity values
      const rarities = offers.map((o) => o.rarity);
      expect(Math.min(...rarities)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...rarities)).toBeLessThanOrEqual(3);
    });

    test("builds Touhou unitId-based offers when Touhou roster is active", () => {
      mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
      mockDeps.getTouhouDraftRosterUnits = vi.fn(() => getTouhouDraftRosterUnits());
      
      // Re-create builder with new mock
      builder = new ShopOfferBuilder(mockDeps);
      
      const offers = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(offers.every((offer) => offer.unitId)).toBe(true);
      expect(offers.every((offer) => offer.cost >= 1 && offer.cost <= 5)).toBe(true);
      expect(offers.every((offer) => offer.rarity === offer.cost)).toBe(true);
    });

    test("shared+per-unit excludes depleted unitId and keeps same-cost Touhou alternative", () => {
      const touhouRoster = getTouhouDraftRosterUnits();
      const cost2Units = touhouRoster.filter((unit) => unit.cost === 2).map((unit) => unit.unitId);
      expect(cost2Units.length).toBeGreaterThan(1);
      const depletedCost2UnitId = cost2Units[0]!;
      const nonDepletedCost2UnitIds = new Set(cost2Units.slice(1));

      mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
      mockDeps.getTouhouDraftRosterUnits = vi.fn(() => touhouRoster);
      mockDeps.isSharedPoolEnabled = vi.fn(() => true);
      mockDeps.isPerUnitPoolEnabled = vi.fn(() => true);
      mockTouhouRollStreams(0.8, 0);
      const isUnitIdPoolDepletedMock = vi.fn(
        (unitId: string, cost: number) => cost === 2 && unitId === depletedCost2UnitId,
      );
      mockDeps.isUnitIdPoolDepleted = isUnitIdPoolDepletedMock;

      builder = new ShopOfferBuilder(mockDeps);

      const offers = builder.buildShopOffers("player1", 2, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(offers.every((offer) => offer.unitId !== depletedCost2UnitId)).toBe(true);
      expect(offers.every((offer) => offer.cost === 2)).toBe(true);
      expect(
        offers.every(
          (offer) => offer.unitId !== undefined && nonDepletedCost2UnitIds.has(offer.unitId),
        ),
      ).toBe(true);
      expect(offers.every((offer) => offer.unitId === cost2Units[1])).toBe(true);
      expect(isUnitIdPoolDepletedMock).toHaveBeenCalled();
      expect(
        isUnitIdPoolDepletedMock.mock.calls.every(([, cost]) => cost === 2),
      ).toBe(true);
      expect(isUnitIdPoolDepletedMock).toHaveBeenCalledTimes(cost2Units.length * offers.length);
    });

    test("shared+per-unit applies one deterministic nearest-tier policy for all-depleted selected cost", () => {
      const touhouRoster = getTouhouDraftRosterUnits();
      const cases: Array<{
        roundIndex: number;
        selectedCostRoll: number;
        depletedCosts: number[];
        expectedCost: number;
      }> = [
        {
          roundIndex: 1,
          selectedCostRoll: 0,
          depletedCosts: [1],
          expectedCost: 2,
        },
        {
          roundIndex: 2,
          selectedCostRoll: 0.75,
          depletedCosts: [2],
          expectedCost: 1,
        },
        {
          roundIndex: 8,
          selectedCostRoll: 0.4,
          depletedCosts: [3, 2],
          expectedCost: 4,
        },
      ];

      for (const testCase of cases) {
        const depletedCosts = new Set(testCase.depletedCosts);

        mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
        mockDeps.getTouhouDraftRosterUnits = vi.fn(() => touhouRoster);
        mockDeps.isSharedPoolEnabled = vi.fn(() => true);
        mockDeps.isPerUnitPoolEnabled = vi.fn(() => true);
        mockTouhouRollStreams(testCase.selectedCostRoll, 0);
        mockDeps.isUnitIdPoolDepleted = vi.fn((_: string, cost: number) => depletedCosts.has(cost));

        builder = new ShopOfferBuilder(mockDeps);

        const offers = builder.buildShopOffers("player1", testCase.roundIndex ?? 1, 0, 0, false);
        const expectedUnitIds = new Set(
          touhouRoster
            .filter((unit) => unit.cost === testCase.expectedCost)
            .map((unit) => unit.unitId),
        );

        expect(offers).toHaveLength(5);
        expect(offers.every((offer) => offer.cost === testCase.expectedCost)).toBe(true);
        expect(offers.every((offer) => offer.unitId !== undefined && expectedUnitIds.has(offer.unitId))).toBe(true);
        expect(new Set(offers.map((offer) => offer.unitId)).size).toBe(1);
      }
    });

    test("shared-only Touhou path keeps legacy lower-tier-only fallback", () => {
      const touhouRoster = getTouhouDraftRosterUnits();
      const expectedFallbackUnitIds = new Set(
        touhouRoster
          .filter((unit) => unit.cost === 1)
          .map((unit) => unit.unitId),
      );

      mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
      mockDeps.getTouhouDraftRosterUnits = vi.fn(() => touhouRoster);
      mockDeps.isSharedPoolEnabled = vi.fn(() => true);
      mockDeps.isPerUnitPoolEnabled = vi.fn(() => false);
      mockDeps.hashToUint32 = vi.fn(() => 0);
      mockDeps.seedToUnitFloat = vi.fn((seed: number) => (seed === 1 ? 0.4 : 0));
      mockDeps.isPoolDepleted = vi.fn((cost: number) => cost === 3 || cost === 2);

      builder = new ShopOfferBuilder(mockDeps);

      const offers = builder.buildShopOffers("player1", 8, 0, 0, false);

      expect(offers).toHaveLength(5);
      expect(offers.every((offer) => offer.cost === 1)).toBe(true);
      expect(offers.every((offer) => offer.unitId !== undefined && expectedFallbackUnitIds.has(offer.unitId))).toBe(true);
      expect(new Set(offers.map((offer) => offer.unitId)).size).toBe(1);
    });

    test("shared+per-unit applies fallback only when weighted selected tier is unavailable", () => {
      const touhouRoster = getTouhouDraftRosterUnits();
      const cases: Array<{
        name: string;
        depletedCosts: number[];
        expectedCost: number;
        expectedCheckedCostsInOrder: number[];
      }> = [
        {
          name: "selected tier available",
          depletedCosts: [1, 3, 4, 5],
          expectedCost: 2,
          expectedCheckedCostsInOrder: [2],
        },
        {
          name: "selected tier unavailable",
          depletedCosts: [2, 3, 4, 5],
          expectedCost: 1,
          expectedCheckedCostsInOrder: [2, 1],
        },
      ];

      for (const testCase of cases) {
        mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
        mockDeps.getTouhouDraftRosterUnits = vi.fn(() => touhouRoster);
        mockDeps.isSharedPoolEnabled = vi.fn(() => true);
        mockDeps.isPerUnitPoolEnabled = vi.fn(() => true);
        mockTouhouRollStreams(0.75, 0);
        const depletedCosts = new Set(testCase.depletedCosts);
        const isUnitIdPoolDepletedMock = vi.fn((_: string, cost: number) => depletedCosts.has(cost));
        const isPoolDepletedMock = vi.fn(() => true);
        mockDeps.isUnitIdPoolDepleted = isUnitIdPoolDepletedMock;
        mockDeps.isPoolDepleted = isPoolDepletedMock;

        builder = new ShopOfferBuilder(mockDeps);

        const offers = builder.buildShopOffers("player1", 2, 0, 0, false);

        expect(offers, testCase.name).toHaveLength(5);
        expect(offers.every((offer) => offer.cost === testCase.expectedCost), testCase.name).toBe(true);

        const checkedCostsInOrder = isUnitIdPoolDepletedMock.mock.calls.reduce<number[]>((acc, [, cost]) => {
          if (acc[acc.length - 1] !== cost) {
            acc.push(cost);
          }
          return acc;
        }, []);
        expect(
          checkedCostsInOrder.length % testCase.expectedCheckedCostsInOrder.length,
          testCase.name,
        ).toBe(0);
        checkedCostsInOrder.forEach((cost, index) => {
          expect(cost, `${testCase.name} #${index}`).toBe(
            testCase.expectedCheckedCostsInOrder[index % testCase.expectedCheckedCostsInOrder.length],
          );
        });
        expect(isPoolDepletedMock, testCase.name).not.toHaveBeenCalled();
      }
    });

    test("uses Touhou round-based weighting boundaries deterministically", () => {
      const touhouRoster = getTouhouDraftRosterUnits();
      const cases: Array<{ roundIndex: number; roll: number; expectedCost: number }> = [
        { roundIndex: 1, roll: 0.799999, expectedCost: 1 },
        { roundIndex: 1, roll: 0.8, expectedCost: 2 },
        { roundIndex: 2, roll: 0.849999, expectedCost: 2 },
        { roundIndex: 2, roll: 0.850001, expectedCost: 3 },
        { roundIndex: 4, roll: 0.97, expectedCost: 4 },
        { roundIndex: 10, roll: 0.97, expectedCost: 5 },
      ];

      mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
      mockDeps.getTouhouDraftRosterUnits = vi.fn(() => touhouRoster);

      for (const testCase of cases) {
        mockTouhouRollStreams(testCase.roll, 0);
        builder = new ShopOfferBuilder(mockDeps);

        const offers = builder.buildShopOffers("player1", testCase.roundIndex, 0, 0, false);

        expect(offers).toHaveLength(5);
        expect(offers.every((offer) => offer.cost === testCase.expectedCost)).toBe(true);
      }
    });

    test("Touhou shop candidate sampling can reach every roster unit", () => {
      const touhouRoster = getTouhouDraftRosterUnits();
      const seenUnitIds = new Set<string>();
      const remainingUnitCount = () => touhouRoster.length - seenUnitIds.size;

      mockDeps.getActiveRosterKind = vi.fn(() => ROSTER_KIND_TOUHOU);
      mockDeps.getTouhouDraftRosterUnits = vi.fn(() => touhouRoster);
      mockDeps.hashToUint32 = productionHashToUint32;
      mockDeps.seedToUnitFloat = productionSeedToUnitFloat;
      mockDeps.pickRarity = productionPickRarity;

      builder = new ShopOfferBuilder(mockDeps);

      samplingLoop:
      for (let roundIndex = 1; roundIndex <= 12; roundIndex += 1) {
        for (let refreshCount = 0; refreshCount < 30; refreshCount += 1) {
          for (let purchaseCount = 0; purchaseCount < 25; purchaseCount += 1) {
            for (let playerIndex = 0; playerIndex < 32; playerIndex += 1) {
              const offers = builder.buildShopOffers(
                `player-${playerIndex}`,
                roundIndex,
                refreshCount,
                purchaseCount,
                false,
              );

              for (const offer of offers) {
                if (typeof offer.unitId === "string" && offer.unitId.length > 0) {
                  seenUnitIds.add(offer.unitId);
                }
              }

              if (remainingUnitCount() === 0) {
                break samplingLoop;
              }
            }
          }
        }
      }

      expect(
        touhouRoster
          .map((unit) => unit.unitId)
          .filter((unitId) => !seenUnitIds.has(unitId)),
      ).toEqual([]);
    }, 15_000);

    test("produces deterministic results with same seed (MVP behavior)", () => {
      // Same inputs should produce same outputs (using hardcoded pools)
      mockDeps.hashToUint32 = vi.fn((text: string) => {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = ((hash << 5) - hash) + text.charCodeAt(i);
          hash = hash & hash;
        }
        return Math.abs(hash) % 4294967296;
      });
      mockDeps.seedToUnitFloat = vi.fn((seed: number) => {
        return ((seed * 9301 + 49297) % 233280) / 233280;
      });

      const offers1 = builder.buildShopOffers("player1", 1, 0, 0, false);
      const offers2 = builder.buildShopOffers("player1", 1, 0, 0, false);

      expect(offers1).toEqual(offers2);
      
      // Verify the actual unit types are from hardcoded pools
      offers1.forEach((offer) => {
        expect([1, 2, 3]).toContain(offer.rarity);
        expect(["vanguard", "ranger", "mage", "assassin"]).toContain(offer.unitType);
      });
    });
  });
});
