import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logPrepCommandActions,
  type PrepCommandLoggingDeps,
} from "../../../src/server/rooms/game-room/prep-command-logging";
import type { MatchLogger, PlayerActionLog } from "../../../src/server/match-logger";
import type { BoardUnitType } from "../../../src/shared/room-messages";

interface LoggedAction {
  sessionId: string;
  roundIndex: number;
  action: PlayerActionLog["actionType"];
  details: PlayerActionLog["details"];
}

describe("prep-command-logging", () => {
  let mockLogger: MatchLogger;
  let mockGetShopOffers: (sessionId: string) => Array<{ unitType: string; cost: number; isRumorUnit?: boolean }> | undefined;
  let mockRoundIndex: number;
  let deps: PrepCommandLoggingDeps;
  let loggedActions: LoggedAction[];

  beforeEach(() => {
    loggedActions = [];
    mockRoundIndex = 5;

    mockLogger = {
      logAction: vi.fn((sessionId: string, roundIndex: number, actionType: PlayerActionLog["actionType"], details: PlayerActionLog["details"]) => {
        loggedActions.push({ sessionId, roundIndex, action: actionType, details });
      }),
    } as unknown as MatchLogger;

    mockGetShopOffers = vi.fn(() => [
      { unitType: "vanguard", cost: 3, isRumorUnit: false },
      { unitType: "ranger", cost: 2, isRumorUnit: false },
      { unitType: "mage", cost: 4, isRumorUnit: false },
    ]);

    deps = {
      logger: mockLogger,
      getShopOffers: mockGetShopOffers,
      getBossShopOffers: vi.fn(() => [
        { unitType: "boss_vanguard", cost: 10 },
      ]),
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
      (deps as PrepCommandLoggingDeps & {
        getBenchUnits: (sessionId: string) => Array<{
          unitType: BoardUnitType;
          cost: number;
          starLevel: number;
          unitCount: number;
        }> | undefined;
      }).getBenchUnits = vi.fn((): Array<{
        unitType: BoardUnitType;
        cost: number;
        starLevel: number;
        unitCount: number;
      }> => [
        { unitType: "mage", cost: 8, starLevel: 2, unitCount: 4 },
      ]);

      const payload = {
        benchSellIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("sell_unit");
      expect(loggedActions[0]!.details).toMatchObject({
        benchIndex: 0,
        goldBefore: 10,
        goldAfter: 13,
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
      (deps as PrepCommandLoggingDeps & {
        getBoardPlacements: (sessionId: string) => Array<{
          cell: number;
          unitType: BoardUnitType;
          sellValue?: number;
          starLevel?: number;
          unitCount?: number;
        }> | undefined;
      }).getBoardPlacements = vi.fn((): Array<{
        cell: number;
        unitType: BoardUnitType;
        sellValue?: number;
        starLevel?: number;
        unitCount?: number;
      }> => [
        { cell: 3, unitType: "mage", sellValue: 14, starLevel: 3, unitCount: 7 },
      ]);

      const payload = {
        boardSellIndex: 3,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("board_sell");
      expect(loggedActions[0]!.details).toMatchObject({
        cell: 3,
        goldBefore: 10,
        goldAfter: 16,
      });
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

      // Type check: ensure boardCells is an array of numbers
      expect(Array.isArray(loggedActions[0]!.details.boardCells)).toBe(true);
      expect(loggedActions[0]!.details.boardCells).toEqual([5, 10, 15]);
      expect(loggedActions[0]!.details).not.toHaveProperty("benchIndices");
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

    it("should include isRumorUnit: true when buying a guaranteed rumor offer", () => {
      mockGetShopOffers = vi.fn(() => [
        { unitType: "vanguard", cost: 3 },
        { unitType: "reimu", cost: 4, isRumorUnit: true },
        { unitType: "mage", cost: 4 },
      ]);
      deps.getShopOffers = mockGetShopOffers;

      const payload = {
        shopBuySlotIndex: 1,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_unit");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "reimu",
        cost: 4,
        isRumorUnit: true,
        goldBefore: 10,
        goldAfter: 6,
      });
    });

    it("should not include isRumorUnit when buying a non-rumor unit", () => {
      mockGetShopOffers = vi.fn(() => [
        { unitType: "vanguard", cost: 3 },
        { unitType: "ranger", cost: 2 },
        { unitType: "mage", cost: 4 },
      ]);
      deps.getShopOffers = mockGetShopOffers;

      const payload = {
        shopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_unit");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "vanguard",
        cost: 3,
        goldBefore: 10,
        goldAfter: 7,
      });
      expect(loggedActions[0]!.details).not.toHaveProperty("isRumorUnit");
    });

    it("should not include isRumorUnit when offer has isRumorUnit: false", () => {
      mockGetShopOffers = vi.fn(() => [
        { unitType: "vanguard", cost: 3, isRumorUnit: false },
        { unitType: "ranger", cost: 2 },
      ]);
      deps.getShopOffers = mockGetShopOffers;

      const payload = {
        shopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.details).not.toHaveProperty("isRumorUnit");
    });

    it("should use shopOffersSnapshot when provided instead of getShopOffers (regression test)", () => {
      // Simulate shop slot replacement after buy: getShopOffers returns new offers
      mockGetShopOffers = vi.fn(() => [
        { unitType: "replaced_unit", cost: 5 }, // slot 0 replaced with different unit
        { unitType: "ranger", cost: 2 },
      ]);
      deps.getShopOffers = mockGetShopOffers;

      // But snapshot contains original offer with isRumorUnit flag
      const shopOffersSnapshot = [
        { unitType: "reimu", cost: 4, isRumorUnit: true },
        { unitType: "ranger", cost: 2 },
      ];

      const payload = {
        shopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps, { shopOffersSnapshot });

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_unit");
      // Should use snapshot data, not getShopOffers data
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "reimu",
        cost: 4,
        isRumorUnit: true,
      });
    });

    it("should fallback to getShopOffers when shopOffersSnapshot is not provided", () => {
      const payload = {
        shopBuySlotIndex: 0,
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(1);
      expect(loggedActions[0]!.action).toBe("buy_unit");
      expect(loggedActions[0]!.details).toMatchObject({
        unitType: "vanguard",
        cost: 3,
      });
    });

    it("should log all action types in a complex payload", () => {
      const payload = {
        shopBuySlotIndex: 0,
        benchSellIndex: 0,
        benchToBoardCell: { benchIndex: 0, cell: 0 },
        shopRefreshCount: 1,
        xpPurchaseCount: 1,
        boardSellIndex: 0,
        bossShopBuySlotIndex: 0,
        shopLock: true,
        mergeUnits: { unitType: "vanguard", starLevel: 2, benchIndices: [0, 1, 2] },
      };

      logPrepCommandActions("player1", payload, deps);

      expect(loggedActions).toHaveLength(9);
    });
  });
});
