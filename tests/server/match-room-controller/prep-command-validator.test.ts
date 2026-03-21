import { describe, expect, test, vi } from "vitest";
import {
  validatePrepCommand,
  type ValidationDependencies,
  type ValidationContext,
  type ValidationInternalResult,
} from "../../../src/server/match-room-controller/prep-command-validator";
import type { BoardUnitPlacement, CommandResult } from "../../../src/shared/room-messages";

describe("PrepCommandValidator", () => {
  // 最小限の依存関係をセットアップ
  const createDependencies = (overrides?: Partial<ValidationDependencies>): ValidationDependencies => ({
    isKnownPlayer: vi.fn().mockReturnValue(true),
    isGameStarted: vi.fn().mockReturnValue(true),
    getCurrentPhase: vi.fn().mockReturnValue("Prep"),
    getLastCmdSeq: vi.fn().mockReturnValue(0),
    getGold: vi.fn().mockReturnValue(15),
    getShopOffers: vi.fn().mockReturnValue([
      { unitType: "vanguard", rarity: 1, cost: 1 },
      { unitType: "ranger", rarity: 1, cost: 1 },
      { unitType: "mage", rarity: 2, cost: 2 },
      { unitType: "assassin", rarity: 2, cost: 2 },
      { unitType: "vanguard", rarity: 1, cost: 1 },
    ]),
    getBenchUnits: vi.fn().mockReturnValue([]),
    getBoardPlacements: vi.fn().mockReturnValue([]),
    getBoardUnitCount: vi.fn().mockReturnValue(4),
    getItemInventory: vi.fn().mockReturnValue([]),
    getItemShopOffers: vi.fn().mockReturnValue([]),
    getBossShopOffers: vi.fn().mockReturnValue([]),
    getShopRefreshGoldCost: vi.fn().mockImplementation((_playerId: string, refreshCount: number) => 2 * refreshCount),
    isBossPlayer: vi.fn().mockReturnValue(false),
    isSharedPoolEnabled: vi.fn().mockReturnValue(false),
    isPoolDepleted: vi.fn().mockReturnValue(false),
    getPrepDeadlineAtMs: vi.fn().mockReturnValue(32000),
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
    ...overrides,
  });

  describe("Basic Validation", () => {
    test("unknown player returns UNKNOWN_PLAYER", () => {
      const deps = createDependencies({
        isKnownPlayer: vi.fn().mockReturnValue(false),
      });

      const result = validatePrepCommand("p1", 1, 1000, {}, deps);

      expect(result).toEqual({ accepted: false, code: "UNKNOWN_PLAYER" });
    });

    test("null prepDeadline returns PHASE_MISMATCH", () => {
      const deps = createDependencies({
        getPrepDeadlineAtMs: vi.fn().mockReturnValue(null),
      });

      const result = validatePrepCommand("p1", 1, 1000, {}, deps);

      expect(result).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
    });

    test("game not started returns PHASE_MISMATCH", () => {
      const deps = createDependencies({
        isGameStarted: vi.fn().mockReturnValue(false),
      });

      const result = validatePrepCommand("p1", 1, 1000, {}, deps);

      expect(result).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
    });

    test("not in Prep phase returns PHASE_MISMATCH", () => {
      const deps = createDependencies({
        getCurrentPhase: vi.fn().mockReturnValue("Battle"),
      });

      const result = validatePrepCommand("p1", 1, 1000, {}, deps);

      expect(result).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
    });

    test("late input returns LATE_INPUT", () => {
      const deps = createDependencies({
        getPrepDeadlineAtMs: vi.fn().mockReturnValue(32000),
      });

      const result = validatePrepCommand("p1", 1, 32001, {}, deps);

      expect(result).toEqual({ accepted: false, code: "LATE_INPUT" });
    });

    test("out of sequence command returns DUPLICATE_CMD", () => {
      const deps = createDependencies({
        getLastCmdSeq: vi.fn().mockReturnValue(5),
      });

      const result = validatePrepCommand("p1", 3, 1000, {}, deps);

      expect(result).toEqual({ accepted: false, code: "DUPLICATE_CMD" });
    });

    test("duplicate sequence returns DUPLICATE_CMD", () => {
      const deps = createDependencies({
        getLastCmdSeq: vi.fn().mockReturnValue(5),
      });

      const result = validatePrepCommand("p1", 5, 1000, {}, deps);

      expect(result).toEqual({ accepted: false, code: "DUPLICATE_CMD" });
    });
  });

  describe("Payload Validation", () => {
    test("invalid boardUnitCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { boardUnitCount: 99 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("negative boardUnitCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { boardUnitCount: -1 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("invalid xpPurchaseCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { xpPurchaseCount: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("excessive xpPurchaseCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { xpPurchaseCount: 11 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("invalid shopRefreshCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { shopRefreshCount: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("excessive shopRefreshCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { shopRefreshCount: 6 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("invalid shopBuySlotIndex returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 5 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("negative shopBuySlotIndex returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: -1 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });
  });

  describe("Command Conflict Validation", () => {
    test("shopBuySlotIndex and shopRefreshCount together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        shopBuySlotIndex: 0,
        shopRefreshCount: 1,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("benchSellIndex and shopBuySlotIndex together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        benchSellIndex: 0,
        shopBuySlotIndex: 0,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("benchToBoardCell and benchSellIndex together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        benchToBoardCell: { benchIndex: 0, cell: 3 },
        benchSellIndex: 0,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("boardSellIndex and benchToBoardCell together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardSellIndex: 2,
        benchToBoardCell: { benchIndex: 0, cell: 3 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("boardSellIndex and benchSellIndex together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardSellIndex: 2,
        benchSellIndex: 0,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("boardSellIndex and shopBuySlotIndex together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardSellIndex: 2,
        shopBuySlotIndex: 0,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("boardSellIndex with boardPlacements returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardSellIndex: 2,
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("boardSellIndex with boardUnitCount returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardSellIndex: 2,
        boardUnitCount: 4,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemBuySlotIndex and shopRefreshCount together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        itemBuySlotIndex: 0,
        shopRefreshCount: 1,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemBuySlotIndex and shopBuySlotIndex together returns INVALID_PAYLOAD", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        itemBuySlotIndex: 0,
        shopBuySlotIndex: 0,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });
  });

  describe("Precondition Validation", () => {
    test("benchToBoardCell with non-existent bench index returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        benchToBoardCell: { benchIndex: 0, cell: 3 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("benchToBoardCell with full board returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBoardUnitCount: vi.fn().mockReturnValue(8),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        benchToBoardCell: { benchIndex: 0, cell: 3 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("benchToBoardCell with duplicated cell returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBoardPlacements: vi.fn().mockReturnValue([
          { cell: 3, unitType: "vanguard" },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        benchToBoardCell: { benchIndex: 0, cell: 3 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("benchSellIndex with non-existent bench index returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { benchSellIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("boardSellIndex with no unit at cell returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBoardPlacements: vi.fn().mockReturnValue([
          { cell: 0, unitType: "vanguard" },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { boardSellIndex: 3 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("shopBuySlotIndex with full bench returns BENCH_FULL", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue(new Array(9).fill({ unitType: "vanguard" })),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "BENCH_FULL" });
    });

    test("shopBuySlotIndex with non-existent offer returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 3 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("shopBuySlotIndex with depleted pool returns POOL_DEPLETED", () => {
      const deps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        isPoolDepleted: vi.fn().mockReturnValue(true),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "POOL_DEPLETED" });
    });

    test("shopBuySlotIndex with depleted unitId pool returns POOL_DEPLETED", () => {
      const deps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        isPoolDepleted: vi.fn().mockImplementation((_cost: number, unitId?: string) => unitId === "rin"),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1, unitId: "rin" },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "POOL_DEPLETED" });
    });

    test("enablePerUnitSharedPool=true かつ unitId 未指定オファーは cost pool 枯渇を POOL_DEPLETED で返す", () => {
      const deps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        isPoolDepleted: vi.fn().mockImplementation((_cost: number, unitId?: string) => unitId === undefined),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
        getRosterFlags: vi.fn().mockReturnValue({
          enableHeroSystem: false,
          enableSharedPool: true,
          enablePhaseExpansion: false,
          enableSubUnitSystem: false,
          enableEmblemCells: false,
          enableSpellCard: false,
          enableRumorInfluence: false,
          enableBossExclusiveShop: false,
          enableSharedBoardShadow: false,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
          enablePerUnitSharedPool: true,
        }),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "POOL_DEPLETED" });
    });

    test("enablePerUnitSharedPool=true かつ unitId 未指定オファーは W10 policy 上の買える在庫有無でエラーコードを分岐する", () => {
      const baseFlags = {
        enableHeroSystem: false,
        enableSharedPool: true,
        enablePhaseExpansion: false,
        enableSubUnitSystem: false,
        enableEmblemCells: false,
        enableSpellCard: false,
        enableRumorInfluence: false,
        enableBossExclusiveShop: false,
        enableSharedBoardShadow: false,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
        enablePerUnitSharedPool: true,
      };

      const supplyRemainsDeps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        isPoolDepleted: vi.fn().mockImplementation((cost: number, unitId?: string) => unitId === undefined && cost === 1),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
        getRosterFlags: vi.fn().mockReturnValue(baseFlags),
      });

      const supplyRemainsResult = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, supplyRemainsDeps);

      expect(supplyRemainsResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

      const allDepletedDeps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        isPoolDepleted: vi.fn().mockImplementation((_cost: number, unitId?: string) => unitId === undefined),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
        getRosterFlags: vi.fn().mockReturnValue(baseFlags),
      });

      const allDepletedResult = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, allDepletedDeps);

      expect(allDepletedResult).toEqual({ accepted: false, code: "POOL_DEPLETED" });
    });

    test("enablePerUnitSharedPool=true の invariant breach では internal reason を返す", () => {
      const internal: ValidationInternalResult = {};
      const deps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        isPoolDepleted: vi.fn().mockImplementation((cost: number, unitId?: string) => unitId === undefined && cost === 1),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
        getRosterFlags: vi.fn().mockReturnValue({
          enableHeroSystem: false,
          enableSharedPool: true,
          enablePhaseExpansion: false,
          enableSubUnitSystem: false,
          enableEmblemCells: false,
          enableSpellCard: false,
          enableRumorInfluence: false,
          enableBossExclusiveShop: false,
          enableSharedBoardShadow: false,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
          enablePerUnitSharedPool: true,
        }),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, deps, internal);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(internal.rejectReason).toBe("SERVER_INVARIANT_BREACH");
    });

    test("mixed invalid payload では internal reason を付与しない", () => {
      const internal: ValidationInternalResult = {};
      const deps = createDependencies({
        isSharedPoolEnabled: vi.fn().mockReturnValue(true),
        getRosterFlags: vi.fn().mockReturnValue({
          enableHeroSystem: false,
          enableSharedPool: true,
          enablePhaseExpansion: false,
          enableSubUnitSystem: false,
          enableEmblemCells: false,
          enableSpellCard: false,
          enableRumorInfluence: false,
          enableBossExclusiveShop: false,
          enableSharedBoardShadow: false,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
          enablePerUnitSharedPool: true,
        }),
      });

      const result = validatePrepCommand(
        "p1",
        1,
        1000,
        { shopBuySlotIndex: 0, benchSellIndex: 0 },
        deps,
        internal,
      );

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(internal.rejectReason).toBeUndefined();
    });

    test("itemBuySlotIndex with full inventory returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getItemInventory: vi.fn().mockReturnValue(new Array(9).fill("sword")),
      });

      const result = validatePrepCommand("p1", 1, 1000, { itemBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemBuySlotIndex with non-existent offer returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getItemShopOffers: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { itemBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemEquipToBench with full item slots returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([
          { unitType: "vanguard", items: ["sword", "shield", "armor"] },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        itemEquipToBench: { inventoryItemIndex: 0, benchIndex: 0 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemEquipToBench with non-existent inventory item returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getItemInventory: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        itemEquipToBench: { inventoryItemIndex: 0, benchIndex: 0 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemEquipToBench with non-existent bench unit returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getItemInventory: vi.fn().mockReturnValue(["sword"]),
        getBenchUnits: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        itemEquipToBench: { inventoryItemIndex: 0, benchIndex: 0 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemUnequipFromBench with full inventory returns INVENTORY_FULL", () => {
      const deps = createDependencies({
        getItemInventory: vi.fn().mockReturnValue(new Array(9).fill("sword")),
        getBenchUnits: vi.fn().mockReturnValue([
          { unitType: "vanguard", items: ["sword"] },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        itemUnequipFromBench: { benchIndex: 0, itemSlotIndex: 0 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVENTORY_FULL" });
    });

    test("itemUnequipFromBench with non-existent bench unit returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        itemUnequipFromBench: { benchIndex: 0, itemSlotIndex: 0 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemUnequipFromBench with invalid item slot returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([
          { unitType: "vanguard", items: ["sword"] },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        itemUnequipFromBench: { benchIndex: 0, itemSlotIndex: 5 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("itemSellInventoryIndex with non-existent item returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        getItemInventory: vi.fn().mockReturnValue([]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { itemSellInventoryIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("bossShopBuySlotIndex for non-boss returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        isBossPlayer: vi.fn().mockReturnValue(false),
      });

      const result = validatePrepCommand("p1", 1, 1000, { bossShopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("bossShopBuySlotIndex with already purchased offer returns INVALID_PAYLOAD", () => {
      const deps = createDependencies({
        isBossPlayer: vi.fn().mockReturnValue(true),
        getBossShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 0, purchased: true },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { bossShopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });

    test("bossShopBuySlotIndex with full bench returns BENCH_FULL", () => {
      const deps = createDependencies({
        isBossPlayer: vi.fn().mockReturnValue(true),
        getBossShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 0 },
        ]),
        getBenchUnits: vi.fn().mockReturnValue(new Array(9).fill({ unitType: "vanguard" })),
      });

      const result = validatePrepCommand("p1", 1, 1000, { bossShopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "BENCH_FULL" });
    });

    test("bossShopBuySlotIndex with insufficient gold returns INSUFFICIENT_GOLD", () => {
      const deps = createDependencies({
        isBossPlayer: vi.fn().mockReturnValue(true),
        getGold: vi.fn().mockReturnValue(1),
        getBossShopOffers: vi.fn().mockReturnValue([
          { unitType: "mage", rarity: 4, cost: 4 },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { bossShopBuySlotIndex: 0 }, deps);

      expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });
    });
  });

  describe("Gold Check Validation", () => {
    test("insufficient gold returns INSUFFICIENT_GOLD", () => {
      const deps = createDependencies({
        getGold: vi.fn().mockReturnValue(1),
      });

      const result = validatePrepCommand("p1", 1, 1000, { xpPurchaseCount: 1 }, deps);

      expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });
    });

    test("sufficient gold returns null (no error)", () => {
      const deps = createDependencies({
        getGold: vi.fn().mockReturnValue(20),
      });

      const result = validatePrepCommand("p1", 1, 1000, { xpPurchaseCount: 1 }, deps);

      expect(result).toBeNull();
    });

    test("complex command with insufficient gold returns INSUFFICIENT_GOLD", () => {
      const deps = createDependencies({
        getGold: vi.fn().mockReturnValue(5),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 3 },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        shopBuySlotIndex: 0,
        shopRefreshCount: 1,
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });
  });

  describe("Valid Commands", () => {
    test("empty command returns null (valid)", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {}, deps);

      expect(result).toBeNull();
    });

    test("boardUnitCount only returns null (valid)", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { boardUnitCount: 6 }, deps);

      expect(result).toBeNull();
    });

    test("boardPlacements only returns null (valid)", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      }, deps);

      expect(result).toBeNull();
    });

    test("shopLock only returns null (valid)", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, { shopLock: true }, deps);

      expect(result).toBeNull();
    });

    test("valid xp purchase returns null with correct context", () => {
      const deps = createDependencies({
        getGold: vi.fn().mockReturnValue(20),
      });

      const result = validatePrepCommand("p1", 1, 1000, { xpPurchaseCount: 2 }, deps);

      expect(result).toBeNull();
    });

    test("valid shop buy returns null with correct context", () => {
      const deps = createDependencies({
        getGold: vi.fn().mockReturnValue(10),
        getShopOffers: vi.fn().mockReturnValue([
          { unitType: "vanguard", rarity: 1, cost: 1 },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { shopBuySlotIndex: 0 }, deps);

      expect(result).toBeNull();
    });

    test("valid benchToBoardCell returns null with correct context", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([{ unitType: "vanguard" }]),
        getBoardUnitCount: vi.fn().mockReturnValue(4),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        benchToBoardCell: { benchIndex: 0, cell: 3 },
      }, deps);

      expect(result).toBeNull();
    });

    test("valid benchSellIndex returns null with correct context", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([{ unitType: "vanguard" }]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { benchSellIndex: 0 }, deps);

      expect(result).toBeNull();
    });

    test("valid boardSellIndex returns null with correct context", () => {
      const deps = createDependencies({
        getBoardPlacements: vi.fn().mockReturnValue([
          { cell: 2, unitType: "vanguard" },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, { boardSellIndex: 2 }, deps);

      expect(result).toBeNull();
    });

    test("valid boardToBenchCell returns null with correct context", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue([
          { unitType: "mage" },
          { unitType: "vanguard" },
        ]),
        getBoardPlacements: vi.fn().mockReturnValue([
          { cell: 2, unitType: "vanguard" },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        boardToBenchCell: { cell: 2 },
      }, deps);

      expect(result).toBeNull();
    });

    test("boardToBenchCell returns BENCH_FULL when bench is full", () => {
      const deps = createDependencies({
        getBenchUnits: vi.fn().mockReturnValue(Array.from({ length: 9 }, () => ({ unitType: "mage" }))),
        getBoardPlacements: vi.fn().mockReturnValue([
          { cell: 2, unitType: "vanguard" },
        ]),
      });

      const result = validatePrepCommand("p1", 1, 1000, {
        boardToBenchCell: { cell: 2 },
      }, deps);

      expect(result).toEqual({ accepted: false, code: "BENCH_FULL" });
    });
  });

  describe("boardPlacements Validation", () => {
    test("duplicate cell in boardPlacements returns DUPLICATE_CELL", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardPlacements: [
          { cell: 0, unitType: "vanguard" },
          { cell: 0, unitType: "mage" },
        ],
      }, deps);

      expect(result).toEqual({ accepted: false, code: "DUPLICATE_CELL" });
    });

    test("too many units in boardPlacements returns INVALID_ARRAY", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardPlacements: Array(9).fill(null).map((_, i) => ({
          cell: i,
          unitType: "vanguard",
        })),
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_ARRAY" });
    });

    test("invalid cell index returns INVALID_CELL", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardPlacements: [{ cell: -1, unitType: "vanguard" }],
      }, deps);

      expect(result).toEqual({ accepted: false, code: "INVALID_CELL" });
    });

    test("valid boardPlacements returns null", () => {
      const deps = createDependencies();

      const result = validatePrepCommand("p1", 1, 1000, {
        boardPlacements: [
          { cell: 0, unitType: "vanguard" },
          { cell: 3, unitType: "mage" },
        ],
      }, deps);

      expect(result).toBeNull();
    });
  });
});
