import { describe, expect, test, vi } from "vitest";
import {
  executePrepCommand,
  type ExecutionDependencies,
  type CommandPayload,
} from "../../../src/server/match-room-controller/prep-command-executor";

describe("PrepCommandExecutor", () => {
  // 最小限の依存関係をセットアップ
  const createDependencies = (overrides?: Partial<ExecutionDependencies>): ExecutionDependencies => ({
    setBoardUnitCount: vi.fn(),
    setBoardPlacements: vi.fn(),
    setShopLock: vi.fn(),
    addGold: vi.fn(),
    addXp: vi.fn(),
    refreshShop: vi.fn(),
    buyShopOffer: vi.fn(),
    deployBenchUnitToBoard: vi.fn(),
    sellBenchUnit: vi.fn(),
    sellBoardUnit: vi.fn(),
    addItemToInventory: vi.fn(),
    equipItemToBenchUnit: vi.fn(),
    unequipItemFromBenchUnit: vi.fn(),
    sellInventoryItem: vi.fn(),
    buyBossShopOffer: vi.fn(),
    setLastCmdSeq: vi.fn(),
    getBenchUnits: vi.fn().mockReturnValue([]),
    getOwnedUnits: vi.fn().mockReturnValue({ vanguard: 0, ranger: 0, mage: 0, assassin: 0 }),
    getItemInventory: vi.fn().mockReturnValue([]),
    getBoardPlacements: vi.fn().mockReturnValue([]),
    getShopOffers: vi.fn().mockReturnValue([]),
    getItemShopOffers: vi.fn().mockReturnValue([]),
    getBossShopOffers: vi.fn().mockReturnValue([]),
    getRosterFlags: vi.fn().mockReturnValue({
      enableHeroSystem: false,
      enableSharedPool: false,
      enablePhaseExpansion: false,
      enableSubUnitSystem: false,
      enableEmblemCells: false,
      enableSpellCard: false,
      enableRumorInfluence: false,
      enableBossExclusiveShop: false,
      enableSharedBoardShadow: false,
      enableTouhouRoster: false,
      enableTouhouFactions: false,
      enablePerUnitSharedPool: false,
    }),
    logBossShop: vi.fn(),
    ...overrides,
  });

  describe("Board Unit Count", () => {
    test("sets board unit count when provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { boardUnitCount: 6 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.setBoardUnitCount).toHaveBeenCalledWith("p1", 6);
    });

    test("does not set board unit count when not provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.setBoardUnitCount).not.toHaveBeenCalled();
    });
  });

  describe("Board Placements", () => {
    test("sets normalized board placements when provided", () => {
      const deps = createDependencies();
      const placements = [{ cell: 0, unitType: "vanguard" as const }];
      const payload: CommandPayload = { boardPlacements: placements };

      executePrepCommand("p1", 1, payload, deps);

      // normalized placements have starLevel defaulted to 1 and sorted by cell
      expect(deps.setBoardPlacements).toHaveBeenCalledWith("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1 },
      ]);
    });

    test("normalizes board placements with default starLevel", () => {
      const deps = createDependencies();
      const placements = [
        { cell: 3, unitType: "ranger" as const },
        { cell: 1, unitType: "mage" as const },
      ];
      const payload: CommandPayload = { boardPlacements: placements };

      executePrepCommand("p1", 1, payload, deps);

      // Should be sorted by cell and have starLevel defaulted to 1
      expect(deps.setBoardPlacements).toHaveBeenCalledWith("p1", [
        { cell: 1, unitType: "mage", starLevel: 1 },
        { cell: 3, unitType: "ranger", starLevel: 1 },
      ]);
    });

    test("does not set board placements when not provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.setBoardPlacements).not.toHaveBeenCalled();
    });
  });

  describe("Shop Lock", () => {
    test("sets shop lock when provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { shopLock: true };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.setShopLock).toHaveBeenCalledWith("p1", true);
    });

    test("sets shop unlock when provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { shopLock: false };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.setShopLock).toHaveBeenCalledWith("p1", false);
    });

    test("does not set shop lock when not provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.setShopLock).not.toHaveBeenCalled();
    });
  });

  describe("XP Purchase", () => {
    test("spends gold and adds XP when xpPurchaseCount provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { xpPurchaseCount: 2 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -8); // 2 * 4 XP_PURCHASE_COST
      expect(deps.addXp).toHaveBeenCalledWith("p1", 8); // 2 * 4 XP_PURCHASE_GAIN
    });

    test("does not spend gold when xpPurchaseCount not provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).not.toHaveBeenCalled();
      expect(deps.addXp).not.toHaveBeenCalled();
    });
  });

  describe("Shop Refresh", () => {
    test("spends gold and refreshes shop when shopRefreshCount provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { shopRefreshCount: 1 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -2); // 1 * 2 SHOP_REFRESH_COST
      expect(deps.refreshShop).toHaveBeenCalledWith("p1", 1);
    });

    test("handles multiple shop refreshes", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { shopRefreshCount: 3 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -6); // 3 * 2 SHOP_REFRESH_COST
      expect(deps.refreshShop).toHaveBeenCalledWith("p1", 3);
    });
  });

  describe("Shop Buy", () => {
    test("spends gold and buys shop offer when shopBuySlotIndex provided", () => {
      const deps = createDependencies({
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
      });
      const payload: CommandPayload = { shopBuySlotIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -1);
      expect(deps.buyShopOffer).toHaveBeenCalledWith("p1", 0);
    });

    test("handles more expensive units", () => {
      const deps = createDependencies({
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "mage", rarity: 2, cost: 2 },
        ]),
      });
      const payload: CommandPayload = { shopBuySlotIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -2);
    });
  });

  describe("Item Buy", () => {
    test("spends gold and adds item to inventory when itemBuySlotIndex provided", () => {
      const deps = createDependencies({
        getItemShopOffers: vi.fn().mockReturnValue([
          { itemType: "sword", cost: 5 },
        ]),
      });
      const payload: CommandPayload = { itemBuySlotIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -5);
      expect(deps.addItemToInventory).toHaveBeenCalledWith("p1", "sword");
    });
  });

  describe("Boss Shop Buy", () => {
    test("buys boss shop offer without spending gold", () => {
      const deps = createDependencies({
        getBossShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 0 },
        ]),
      });
      const payload: CommandPayload = { bossShopBuySlotIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).not.toHaveBeenCalled();
      expect(deps.buyBossShopOffer).toHaveBeenCalledWith("p1", 0);
      expect(deps.logBossShop).toHaveBeenCalled();
    });
  });

  describe("Bench to Board", () => {
    test("deploys bench unit to board when benchToBoardCell provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        benchToBoardCell: { benchIndex: 0, cell: 3 },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.deployBenchUnitToBoard).toHaveBeenCalledWith("p1", 0, 3);
    });
  });

  describe("Bench Sell", () => {
    test("sells bench unit and adds gold when benchSellIndex provided", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([
          { unitType: "vanguard", cost: 1, starLevel: 1, unitCount: 1 },
        ]),
      });
      const payload: CommandPayload = { benchSellIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.sellBenchUnit).toHaveBeenCalledWith("p1", 0);
    });
  });

  describe("Board Sell", () => {
    test("sells board unit and adds gold when boardSellIndex provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { boardSellIndex: 2 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.sellBoardUnit).toHaveBeenCalledWith("p1", 2);
    });
  });

  describe("Item Equip", () => {
    test("equips item from inventory to bench unit when itemEquipToBench provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        itemEquipToBench: { inventoryItemIndex: 0, benchIndex: 1 },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.equipItemToBenchUnit).toHaveBeenCalledWith("p1", 0, 1);
    });
  });

  describe("Item Unequip", () => {
    test("unequips item from bench unit to inventory when itemUnequipFromBench provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        itemUnequipFromBench: { benchIndex: 1, itemSlotIndex: 0 },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.unequipItemFromBenchUnit).toHaveBeenCalledWith("p1", 1, 0);
    });
  });

  describe("Item Sell", () => {
    test("sells inventory item and adds gold when itemSellInventoryIndex provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { itemSellInventoryIndex: 2 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.sellInventoryItem).toHaveBeenCalledWith("p1", 2);
    });
  });

  describe("Command Sequence", () => {
    test("sets last command sequence at the end", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      executePrepCommand("p1", 5, payload, deps);

      expect(deps.setLastCmdSeq).toHaveBeenCalledWith("p1", 5);
    });
  });

  describe("Complex Commands", () => {
    test("handles multiple operations in single command", () => {
      const deps = createDependencies({
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
      });
      const payload: CommandPayload = {
        xpPurchaseCount: 1, // 4 gold
        shopBuySlotIndex: 0, // 1 gold
        benchToBoardCell: { benchIndex: 0, cell: 3 },
        shopLock: true,
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -5); // 4 + 1
      expect(deps.addXp).toHaveBeenCalledWith("p1", 4);
      expect(deps.buyShopOffer).toHaveBeenCalledWith("p1", 0);
      expect(deps.deployBenchUnitToBoard).toHaveBeenCalledWith("p1", 0, 3);
      expect(deps.setShopLock).toHaveBeenCalledWith("p1", true);
    });

    test("execution order is correct", () => {
      const executionOrder: string[] = [];
      const deps = createDependencies({
        getShopOffers: vi.fn().mockImplementation(() => {
          executionOrder.push("getShopOffers");
          return [{ unitType: "vanguard", rarity: 1, cost: 1 }];
        }),
        addGold: vi.fn().mockImplementation(() => {
          executionOrder.push("addGold");
        }),
        addXp: vi.fn().mockImplementation(() => {
          executionOrder.push("addXp");
        }),
        buyShopOffer: vi.fn().mockImplementation(() => {
          executionOrder.push("buyShopOffer");
        }),
        setLastCmdSeq: vi.fn().mockImplementation(() => {
          executionOrder.push("setLastCmdSeq");
        }),
      });

      const payload: CommandPayload = {
        xpPurchaseCount: 1,
        shopBuySlotIndex: 0,
      };

      executePrepCommand("p1", 1, payload, deps);

      // Gold operations happen before state mutations
      expect(executionOrder.indexOf("addGold")).toBeLessThan(executionOrder.indexOf("addXp"));
      expect(executionOrder.indexOf("addGold")).toBeLessThan(executionOrder.indexOf("buyShopOffer"));
      // Last command sequence is always last
      expect(executionOrder[executionOrder.length - 1]).toBe("setLastCmdSeq");
    });
  });

  describe("Return Value", () => {
    test("returns accepted: true on success", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      const result = executePrepCommand("p1", 1, payload, deps);

      expect(result).toEqual({ accepted: true });
    });
  });
});
