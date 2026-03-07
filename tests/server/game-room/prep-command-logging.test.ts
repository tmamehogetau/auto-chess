import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logPrepCommandActions,
  type PrepCommandLoggingDeps,
} from "../../../src/server/rooms/game-room/prep-command-logging";
import type { MatchLogger } from "../../../src/server/match-logger";

describe("prep-command-logging", () => {
  let mockLogger: MatchLogger;
  let mockGetShopOffers: (sessionId: string) => Array<{ unitType: string; cost: number }> | undefined;
  let mockGetPlayerStatus: (sessionId: string) => {
    gold: number;
    itemShopOffers: Array<{ itemType: string; cost: number }>;
    itemInventory: string[];
    benchUnits: string[];
  } | null;
  let mockRoundIndex: number;
  let deps: PrepCommandLoggingDeps;
  let loggedActions: Array<{ sessionId: string; roundIndex: number; action: string; details: unknown }>;

  beforeEach(() => {
    loggedActions = [];
    mockRoundIndex = 5;

    mockLogger = {
      logAction: vi.fn((sessionId, roundIndex, action, details) => {
        loggedActions.push({ sessionId, roundIndex, action, details });
      }),
    } as unknown as MatchLogger;

    mockGetShopOffers = vi.fn(() => [
      { unitType: "vanguard", cost: 3 },
      { unitType: "ranger", cost: 2 },
      { unitType: "mage", cost: 4 },
    ]);

    mockGetPlayerStatus = vi.fn(() => ({
      gold: 10,
      itemShopOffers: [
        { itemType: "sword", cost: 5 },
        { itemType: "shield", cost: 3 },
      ],
      itemInventory: ["sword", "shield"],
      benchUnits: ["unit1", "unit2"],
    }));

    deps = {
      logger: mockLogger,
      getShopOffers: mockGetShopOffers,
      getBossShopOffers: vi.fn(() => [
        { unitType: "boss_vanguard", cost: 10 },
      ]),
      getPlayerStatus: mockGetPlayerStatus,
      getRoundIndex: () => mockRoundIndex,
      getPlayerGold: () => 10,
    };
  });

  describe("logPrepCommandActions", () => {
    it("should log buy_unit action when shopBuySlotIndex is provided", () => {
      const payload = {
        shopBuySlotIndex: 1,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_unit");
      expect(loggedActions[0]!.sessionId).toBe("player1");
      expect(loggedActions[0]!.roundIndex).toBe(5);
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "ranger",
        cost: 2,
        goldBefore: 10,
        goldAfter: 8,
      });
    });

    it("should not log buy_unit when shop offer is not found", () => {
      mockGetShopOffers = vi.fn(() => []);
      deps.getShopOffers = mockGetShopOffers;

      const payload = {
        shopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(0);
    });

    it("should log sell_unit action when benchSellIndex is provided", () => {
      const payload = {
        benchSellIndex: 2,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("sell_unit");
      expect(loggedActions[0]!.details).toMatchObject({
        benchIndex: 2,
        goldBefore: 10,
        goldAfter: 11,
      });
    });

    it("should log deploy action when benchToBoardCell is provided", () => {
      const payload = {
        benchToBoardCell: { benchIndex: 1, cell: 5 },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("deploy");
      expect(loggedActions[0]!.details).toMatchObject({
        benchIndex: 1,
        toCell: 5,
        goldBefore: 10,
        goldAfter: 10,
      });
    });

    it("should log shop_refresh action when shopRefreshCount is provided", () => {
      const payload = {
        shopRefreshCount: 3,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("shop_refresh");
      expect(loggedActions[0]!.details).toMatchObject({
        itemCount: 3,
        goldBefore: 10,
        goldAfter: 8,
      });
    });

    it("should log buy_xp action when xpPurchaseCount is provided", () => {
      const payload = {
        xpPurchaseCount: 2,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_xp");
      expect(loggedActions[0]!.details).toMatchObject({
        itemCount: 2,
        goldBefore: 10,
        goldAfter: 6,
      });
    });

    it("should log board_sell action when boardSellIndex is provided", () => {
      const payload = {
        boardSellIndex: 3,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("board_sell");
      expect(loggedActions[0]!.details).toMatchObject({
        cell: 3,
        goldBefore: 10,
        goldAfter: 11,
      });
    });

    it("should log buy_item action when itemBuySlotIndex is provided", () => {
      const payload = {
        itemBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_item");
      expect(loggedActions[0]!.details).toMatchObject({
        itemType: "sword",
        cost: 5,
        goldBefore: 10,
        goldAfter: 5,
      });
    });

    it("should not log buy_item when item offer is not found", () => {
      mockGetPlayerStatus = vi.fn(() => ({
        gold: 10,
        itemShopOffers: [],
        itemInventory: [],
        benchUnits: [],
      }));
      deps.getPlayerStatus = mockGetPlayerStatus;

      const payload = {
        itemBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(0);
    });

    it("should log equip_item action when itemEquipToBench is provided", () => {
      const payload = {
        itemEquipToBench: { inventoryItemIndex: 0, benchIndex: 1 },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("equip_item");
      expect(loggedActions[0]!.details).toMatchObject({
        inventoryIndex: 0,
        benchIndex: 1,
        itemType: "sword",
        goldBefore: 10,
        goldAfter: 10,
      });
    });

    it("should log equip_item without itemType when inventory index is out of bounds", () => {
      const payload = {
        itemEquipToBench: { inventoryItemIndex: 10, benchIndex: 1 },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("equip_item");
      expect(loggedActions[0]!.details).not.toHaveProperty("itemType");
    });

    it("should log unequip_item action when itemUnequipFromBench is provided", () => {
      const payload = {
        itemUnequipFromBench: { benchIndex: 0, itemSlotIndex: 1 },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("unequip_item");
      expect(loggedActions[0]!.details).toMatchObject({
        benchIndex: 0,
        itemSlotIndex: 1,
        benchUnit: "unit1",
        goldBefore: 10,
        goldAfter: 10,
      });
    });

    it("should log unequip_item without benchUnit when bench index is out of bounds", () => {
      const payload = {
        itemUnequipFromBench: { benchIndex: 10, itemSlotIndex: 0 },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("unequip_item");
      expect(loggedActions[0]!.details).not.toHaveProperty("benchUnit");
    });

    it("should log sell_item action when itemSellInventoryIndex is provided", () => {
      const payload = {
        itemSellInventoryIndex: 1,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("sell_item");
      expect(loggedActions[0]!.details).toMatchObject({
        inventoryIndex: 1,
        itemType: "shield",
        goldBefore: 10,
        goldAfter: 11,
      });
    });

    it("should log sell_item without itemType when inventory index is out of bounds", () => {
      const payload = {
        itemSellInventoryIndex: 10,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("sell_item");
      expect(loggedActions[0]!.details).not.toHaveProperty("itemType");
    });

    it("should log buy_boss_unit action when bossShopBuySlotIndex is provided", () => {
      const payload = {
        bossShopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_boss_unit");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "boss_vanguard",
        cost: 10,
        goldBefore: 10,
        goldAfter: 0,
      });
    });

    it("should not log buy_boss_unit when boss shop offer is not found", () => {
      deps.getBossShopOffers = vi.fn(() => []);

      const payload = {
        bossShopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(0);
    });

    it("should log shop_lock action when shopLock is provided", () => {
      const payload = {
        shopLock: true,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("shop_lock");
      expect(loggedActions[0]!.details).toMatchObject({
        locked: true,
        goldBefore: 10,
        goldAfter: 10,
      });
    });

    it("should log shop_lock action when shopLock is false (unlock)", () => {
      const payload = {
        shopLock: false,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("shop_lock");
      expect(loggedActions[0]!.details).toMatchObject({
        locked: false,
      });
    });

    it("should log merge action when mergeUnits is provided", () => {
      const payload = {
        mergeUnits: { unitType: "vanguard", starLevel: 2, benchIndices: [0, 1, 2] },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("merge");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "vanguard",
        starLevel: 2,
        benchIndices: [0, 1, 2],
        goldBefore: 10,
        goldAfter: 10,
      });
    });

    it("should log merge action with boardCells when merging from board", () => {
      const payload = {
        mergeUnits: { unitType: "ranger", starLevel: 3, boardCells: [5, 10, 15] },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("merge");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "ranger",
        starLevel: 3,
        boardCells: [5, 10, 15],
        goldBefore: 10,
        goldAfter: 10,
      });
    });

    it("should log merge action without benchIndices when not provided", () => {
      const payload = {
        mergeUnits: { unitType: "mage", starLevel: 2 },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("merge");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "mage",
        starLevel: 2,
      });
      expect(loggedActions[0]!.details).not.toHaveProperty("benchIndices");
      expect(loggedActions[0]!.details).not.toHaveProperty("boardCells");
    });

    it("should log multiple actions when multiple payload fields are provided", () => {
      const payload = {
        shopBuySlotIndex: 0,
        shopRefreshCount: 1,
        xpPurchaseCount: 1,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(3);
      const actions = loggedActions.map((a) => a.action);
      expect(actions).toContain("buy_unit");
      expect(actions).toContain("shop_refresh");
      expect(actions).toContain("buy_xp");
    });

    it("should return early when logger is null", () => {
      deps.logger = null;

      const payload = {
        shopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(0);
    });

    it("should return early when payload is undefined", () => {
      logPrepCommandActions("player1", undefined as unknown as Record<string, unknown>, deps);

      expect(loggedActions).toHaveLength(0);
    });

    it("should log all action types in a complex payload", () => {
      const payload = {
        shopBuySlotIndex: 0,
        benchSellIndex: 0,
        benchToBoardCell: { benchIndex: 0, cell: 0 },
        shopRefreshCount: 1,
        xpPurchaseCount: 1,
        boardSellIndex: 0,
        itemBuySlotIndex: 0,
        itemEquipToBench: { inventoryItemIndex: 0, benchIndex: 0 },
        itemUnequipFromBench: { benchIndex: 0, itemSlotIndex: 0 },
        itemSellInventoryIndex: 0,
        bossShopBuySlotIndex: 0,
        shopLock: true,
        mergeUnits: { unitType: "vanguard", starLevel: 2, benchIndices: [0, 1, 2] },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(13);
    });
  });
});
