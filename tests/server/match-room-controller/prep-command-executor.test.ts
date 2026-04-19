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
    getSpecialUnitLevel: vi.fn().mockReturnValue(1),
    getSelectedSpecialUnitId: vi.fn().mockReturnValue("reimu"),
    upgradeSpecialUnit: vi.fn(),
    getShopRefreshGoldCost: vi.fn().mockImplementation((_playerId: string, refreshCount: number) => 2 * refreshCount),
    refreshShop: vi.fn(),
    buyShopOffer: vi.fn(),
    buyHeroExclusiveShopOffer: vi.fn(),
    deployBenchUnitToBoard: vi.fn(),
    returnBoardUnitToBench: vi.fn(),
    moveBoardUnit: vi.fn(),
    returnAttachedSubUnitToBench: vi.fn(),
    moveAttachedSubUnit: vi.fn(),
    swapAttachedSubUnitWithBench: vi.fn(),
    applyHeroPlacement: vi.fn().mockReturnValue({ accepted: true }),
    sellBenchUnit: vi.fn(),
    sellBoardUnit: vi.fn(),
    buyBossShopOffer: vi.fn(),
    setLastCmdSeq: vi.fn(),
    getBenchUnits: vi.fn().mockReturnValue([]),
    getOwnedUnits: vi.fn().mockReturnValue({ vanguard: 0, ranger: 0, mage: 0, assassin: 0 }),
    getBoardPlacements: vi.fn().mockReturnValue([]),
    getShopOffers: vi.fn().mockReturnValue([]),
    getBossShopOffers: vi.fn().mockReturnValue([]),
    getHeroExclusiveShopOffers: vi.fn().mockReturnValue([]),
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

      // normalized placements have unitLevel defaulted to 1 and sorted by cell
      expect(deps.setBoardPlacements).toHaveBeenCalledWith("p1", [
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
      ]);
    });

    test("normalizes board placements with default unitLevel", () => {
      const deps = createDependencies();
      const placements = [
        { cell: 3, unitType: "ranger" as const },
        { cell: 1, unitType: "mage" as const },
      ];
      const payload: CommandPayload = { boardPlacements: placements };

      executePrepCommand("p1", 1, payload, deps);

      // Should be sorted by cell and have unitLevel defaulted to 1
      expect(deps.setBoardPlacements).toHaveBeenCalledWith("p1", [
        { cell: 1, unitType: "mage", unitLevel: 1 },
        { cell: 3, unitType: "ranger", unitLevel: 1 },
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

  describe("Special Unit Upgrade", () => {
    test("spends gold and upgrades the special unit when specialUnitUpgradeCount provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { specialUnitUpgradeCount: 2 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -4); // 1->2:2, 2->3:2
      expect(deps.upgradeSpecialUnit).toHaveBeenCalledWith("p1", 2);
    });

    test("uses Jyoon-specific upgrade costs", () => {
      const deps = createDependencies({
        getSelectedSpecialUnitId: vi.fn().mockReturnValue("jyoon"),
      });
      const payload: CommandPayload = { specialUnitUpgradeCount: 2 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -6); // 1->2:3, 2->3:3
      expect(deps.upgradeSpecialUnit).toHaveBeenCalledWith("p1", 2);
    });

    test("does not spend gold when specialUnitUpgradeCount not provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {};

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).not.toHaveBeenCalled();
      expect(deps.upgradeSpecialUnit).not.toHaveBeenCalled();
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

  describe("Board To Bench", () => {
    test("returns board unit to bench when boardToBenchCell provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { boardToBenchCell: { cell: 3 } };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.returnBoardUnitToBench).toHaveBeenCalledWith("p1", 3);
    });

    test("returns attached sub unit to bench when subUnitToBenchCell provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { subUnitToBenchCell: { cell: 24 } };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.returnAttachedSubUnitToBench).toHaveBeenCalledWith("p1", 24);
    });

    test("applies dedicated hero placement when heroPlacementCell provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = { heroPlacementCell: 24 };

      const result = executePrepCommand("p1", 1, payload, deps);

      expect(result).toEqual({ accepted: true });
      expect(deps.applyHeroPlacement).toHaveBeenCalledWith("p1", 24);
    });

    test("moves attached sub unit across board targets when subUnitMove provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        subUnitMove: { fromCell: 24, toCell: 31, slot: "sub" },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.moveAttachedSubUnit).toHaveBeenCalledWith("p1", 24, 31, "sub");
    });

    test("moves a board unit into a target sub slot when boardUnitMove provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        boardUnitMove: { fromCell: 24, toCell: 31, slot: "sub" },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.moveBoardUnit).toHaveBeenCalledWith("p1", 24, 31, "sub");
    });

    test("swaps attached sub unit with a bench slot when subUnitSwapBench provided", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        subUnitSwapBench: { cell: 24, benchIndex: 1 },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.swapAttachedSubUnitWithBench).toHaveBeenCalledWith("p1", 24, 1);
    });
  });

  describe("Boss Shop Buy", () => {
    test("spends gold and buys boss shop offer", () => {
      const deps = createDependencies({
        getBossShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 2, cost: 2 },
        ]),
      });
      const payload: CommandPayload = { bossShopBuySlotIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -2);
      expect(deps.buyBossShopOffer).toHaveBeenCalledWith("p1", 0);
      expect(deps.logBossShop).toHaveBeenCalled();
    });
  });

  describe("Hero-Exclusive Shop Buy", () => {
    test("spends gold and buys hero-exclusive shop offer", () => {
      const deps = createDependencies({
        getHeroExclusiveShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 },
        ]),
      });
      const payload: CommandPayload = { heroExclusiveShopBuySlotIndex: 0 };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -3);
      expect(deps.buyHeroExclusiveShopOffer).toHaveBeenCalledWith("p1", 0);
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

    test("passes through sub-slot bench deploy targets", () => {
      const deps = createDependencies();
      const payload: CommandPayload = {
        benchToBoardCell: { benchIndex: 0, cell: 24, slot: "sub" },
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.deployBenchUnitToBoard).toHaveBeenCalledWith("p1", 0, 24, "sub");
    });
  });

  describe("Bench Sell", () => {
    test("sells bench unit and adds gold when benchSellIndex provided", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([
          { unitType: "vanguard", cost: 1, unitLevel: 1, unitCount: 1 },
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
        getHeroExclusiveShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 },
        ]),
      });
      const payload: CommandPayload = {
        specialUnitUpgradeCount: 1, // 2 gold
        shopBuySlotIndex: 0, // 1 gold
        heroExclusiveShopBuySlotIndex: 0, // 3 gold
        benchToBoardCell: { benchIndex: 0, cell: 3 },
        shopLock: true,
      };

      executePrepCommand("p1", 1, payload, deps);

      expect(deps.addGold).toHaveBeenCalledWith("p1", -6); // 2 + 1 + 3
      expect(deps.upgradeSpecialUnit).toHaveBeenCalledWith("p1", 1);
      expect(deps.buyShopOffer).toHaveBeenCalledWith("p1", 0);
      expect(deps.buyHeroExclusiveShopOffer).toHaveBeenCalledWith("p1", 0);
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
        getHeroExclusiveShopOffers: vi.fn().mockImplementation(() => {
          executionOrder.push("getHeroExclusiveShopOffers");
          return [{ unitType: "vanguard", unitId: "mayumi", rarity: 3, cost: 3 }];
        }),
        addGold: vi.fn().mockImplementation(() => {
          executionOrder.push("addGold");
        }),
        upgradeSpecialUnit: vi.fn().mockImplementation(() => {
          executionOrder.push("upgradeSpecialUnit");
        }),
        buyShopOffer: vi.fn().mockImplementation(() => {
          executionOrder.push("buyShopOffer");
        }),
        buyHeroExclusiveShopOffer: vi.fn().mockImplementation(() => {
          executionOrder.push("buyHeroExclusiveShopOffer");
        }),
        setLastCmdSeq: vi.fn().mockImplementation(() => {
          executionOrder.push("setLastCmdSeq");
        }),
      });

      const payload: CommandPayload = {
        specialUnitUpgradeCount: 1,
        shopBuySlotIndex: 0,
        heroExclusiveShopBuySlotIndex: 0,
      };

      executePrepCommand("p1", 1, payload, deps);

      // Gold operations happen before state mutations
      expect(executionOrder.indexOf("addGold")).toBeLessThan(executionOrder.indexOf("upgradeSpecialUnit"));
      expect(executionOrder.indexOf("addGold")).toBeLessThan(executionOrder.indexOf("buyShopOffer"));
      expect(executionOrder.indexOf("addGold")).toBeLessThan(executionOrder.indexOf("buyHeroExclusiveShopOffer"));
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
