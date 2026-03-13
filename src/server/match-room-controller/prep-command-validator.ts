import type { BoardUnitPlacement } from "../../shared/room-messages";
import type { ItemType } from "../../shared/types";
import { normalizeBoardPlacements } from "../combat/unit-effects";
import {
  COMBAT_CELL_MAX_INDEX,
  COMBAT_CELL_MIN_INDEX,
} from "../../shared/board-geometry";
import type { FeatureFlags } from "../../shared/feature-flags";
import { calculateDiscountedShopOfferCost } from "./shop-cost-reduction";

// Constants from the controller
const XP_PURCHASE_COST = 4;
const MAX_XP_PURCHASE_COUNT = 10;
const SHOP_REFRESH_COST = 2;
const MAX_SHOP_REFRESH_COUNT = 5;
const SHOP_SIZE = 5;
const MAX_SHOP_BUY_SLOT_INDEX = SHOP_SIZE - 1;
const MAX_BENCH_SIZE = 9;
const MAX_INVENTORY_SIZE = 9;
const MAX_ITEMS_PER_UNIT = 3;
const ITEM_SHOP_SIZE = 5;
const TOUHOU_COST_TIERS: readonly [1, 2, 3, 4, 5] = [1, 2, 3, 4, 5];

export interface ShopOffer {
  unitType: string;
  unitId?: string;
  rarity: number;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  starLevel?: number;
}

export interface ItemShopOffer {
  itemType: ItemType;
  cost: number;
}

export interface BenchUnit {
  unitType: string;
  unitId?: string;
  cost: number;
  starLevel: number;
  unitCount: number;
  items?: ItemType[];
}

export interface CommandPayload {
  boardUnitCount?: number;
  boardPlacements?: BoardUnitPlacement[];
  xpPurchaseCount?: number;
  shopRefreshCount?: number;
  shopBuySlotIndex?: number;
  shopLock?: boolean;
  benchToBoardCell?: {
    benchIndex: number;
    cell: number;
  };
  benchSellIndex?: number;
  boardSellIndex?: number;
  itemBuySlotIndex?: number;
  itemEquipToBench?: {
    inventoryItemIndex: number;
    benchIndex: number;
  };
  itemUnequipFromBench?: {
    benchIndex: number;
    itemSlotIndex: number;
  };
  itemSellInventoryIndex?: number;
  bossShopBuySlotIndex?: number;
}

export interface ValidationDependencies {
  isKnownPlayer: (playerId: string) => boolean;
  isGameStarted: () => boolean;
  getCurrentPhase: () => string;
  getLastCmdSeq: (playerId: string) => number;
  getGold: (playerId: string) => number;
  getShopOffers: (playerId: string) => ShopOffer[];
  getBenchUnits: (playerId: string) => BenchUnit[];
  getBoardPlacements: (playerId: string) => BoardUnitPlacement[];
  getBoardUnitCount: (playerId: string) => number;
  getItemInventory: (playerId: string) => ItemType[];
  getItemShopOffers: (playerId: string) => ItemShopOffer[];
  getBossShopOffers: (playerId: string) => ShopOffer[];
  isBossPlayer: (playerId: string) => boolean;
  isSharedPoolEnabled: () => boolean;
  isPoolDepleted: (cost: number, unitId?: string) => boolean;
  getPrepDeadlineAtMs: () => number | null;
  getRosterFlags: () => FeatureFlags;
}

export interface ValidationContext {
  playerId: string;
  cmdSeq: number;
  receivedAtMs: number;
  payload: CommandPayload;
  // Computed values that can be used by executor
  shopBuyCost?: number;
  itemBuyCost?: number;
  bossShopBuyCost?: number;
  requiredGold?: number;
}

export type ValidationInternalRejectReason = "SERVER_INVARIANT_BREACH";

export interface ValidationInternalResult {
  rejectReason?: ValidationInternalRejectReason;
}

/**
 * Validates a prep command and returns a CommandResult if invalid, null if valid.
 * This function performs all validation checks without mutating any state.
 */
export function validatePrepCommand(
  playerId: string,
  cmdSeq: number,
  receivedAtMs: number,
  payload: CommandPayload,
  deps: ValidationDependencies,
  internalResult?: ValidationInternalResult,
): import("../../shared/room-messages").CommandResult | null {
  // Basic state validation
  const basicValidation = validateBasicState(playerId, cmdSeq, receivedAtMs, deps);
  if (basicValidation) {
    return basicValidation;
  }

  // Payload validation
  const payloadValidation = validatePayload(payload, deps);
  if (payloadValidation) {
    return payloadValidation;
  }

  // Command conflict validation
  const conflictValidation = validateCommandConflicts(payload, deps);
  if (conflictValidation) {
    return conflictValidation;
  }

  // Precondition validation
  const preconditionValidation = validatePreconditions(playerId, payload, deps, internalResult);
  if (preconditionValidation) {
    return preconditionValidation;
  }

  // Gold check
  const goldValidation = validateGold(playerId, payload, deps);
  if (goldValidation) {
    return goldValidation;
  }

  return null;
}

function validateBasicState(
  playerId: string,
  cmdSeq: number,
  receivedAtMs: number,
  deps: ValidationDependencies,
): import("../../shared/room-messages").CommandResult | null {
  // Check if game has started (phase check should come before player check)
  if (!deps.isGameStarted()) {
    return { accepted: false, code: "PHASE_MISMATCH" };
  }

  // Check phase
  const currentPhase = deps.getCurrentPhase();
  if (currentPhase !== "Prep") {
    return { accepted: false, code: "PHASE_MISMATCH" };
  }

  // Check if player is known
  if (!deps.isKnownPlayer(playerId)) {
    return { accepted: false, code: "UNKNOWN_PLAYER" };
  }

  // Check deadline (null deadline is invalid)
  const prepDeadline = deps.getPrepDeadlineAtMs();
  if (prepDeadline === null) {
    return { accepted: false, code: "PHASE_MISMATCH" };
  }
  if (receivedAtMs >= prepDeadline) {
    return { accepted: false, code: "LATE_INPUT" };
  }

  // Check command sequence
  const lastCmdSeq = deps.getLastCmdSeq(playerId);
  if (cmdSeq <= lastCmdSeq) {
    return { accepted: false, code: "DUPLICATE_CMD" };
  }

  return null;
}

function validatePayload(
  payload: CommandPayload,
  deps: ValidationDependencies,
): import("../../shared/room-messages").CommandResult | null {
  // boardUnitCount validation
  if (payload.boardUnitCount !== undefined) {
    if (!Number.isInteger(payload.boardUnitCount) || payload.boardUnitCount < 0 || payload.boardUnitCount > 8) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // boardPlacements validation
  if (payload.boardPlacements !== undefined) {
    const validationResult = normalizeBoardPlacements(payload.boardPlacements);
    if (!validationResult.normalized) {
      const errorCode = validationResult.errorCode ?? "INVALID_PAYLOAD";
      return { accepted: false, code: errorCode };
    }
    // Check for too many units (max 8)
    if (validationResult.normalized.length > 8) {
      return { accepted: false, code: "TOO_MANY_UNITS" };
    }
  }

  // xpPurchaseCount validation
  if (payload.xpPurchaseCount !== undefined) {
    if (
      !Number.isInteger(payload.xpPurchaseCount) ||
      payload.xpPurchaseCount < 1 ||
      payload.xpPurchaseCount > MAX_XP_PURCHASE_COUNT
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // shopRefreshCount validation
  if (payload.shopRefreshCount !== undefined) {
    if (
      !Number.isInteger(payload.shopRefreshCount) ||
      payload.shopRefreshCount < 1 ||
      payload.shopRefreshCount > MAX_SHOP_REFRESH_COUNT
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // shopBuySlotIndex validation
  if (payload.shopBuySlotIndex !== undefined) {
    if (
      !Number.isInteger(payload.shopBuySlotIndex) ||
      payload.shopBuySlotIndex < 0 ||
      payload.shopBuySlotIndex > MAX_SHOP_BUY_SLOT_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // benchToBoardCell validation
  if (payload.benchToBoardCell !== undefined) {
    const { benchIndex, cell } = payload.benchToBoardCell;
    if (
      !Number.isInteger(benchIndex) ||
      benchIndex < 0 ||
      !Number.isInteger(cell) ||
      cell < COMBAT_CELL_MIN_INDEX ||
      cell > COMBAT_CELL_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // benchSellIndex validation
  if (payload.benchSellIndex !== undefined) {
    if (!Number.isInteger(payload.benchSellIndex) || payload.benchSellIndex < 0) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // boardSellIndex validation
  if (payload.boardSellIndex !== undefined) {
    if (
      !Number.isInteger(payload.boardSellIndex) ||
      payload.boardSellIndex < COMBAT_CELL_MIN_INDEX ||
      payload.boardSellIndex > COMBAT_CELL_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // itemBuySlotIndex validation
  if (payload.itemBuySlotIndex !== undefined) {
    if (
      !Number.isInteger(payload.itemBuySlotIndex) ||
      payload.itemBuySlotIndex < 0 ||
      payload.itemBuySlotIndex >= ITEM_SHOP_SIZE
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // itemEquipToBench validation
  if (payload.itemEquipToBench !== undefined) {
    const { inventoryItemIndex, benchIndex } = payload.itemEquipToBench;
    if (
      !Number.isInteger(inventoryItemIndex) ||
      !Number.isInteger(benchIndex) ||
      inventoryItemIndex < 0 ||
      benchIndex < 0
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // itemUnequipFromBench validation
  if (payload.itemUnequipFromBench !== undefined) {
    const { benchIndex, itemSlotIndex } = payload.itemUnequipFromBench;
    if (
      !Number.isInteger(benchIndex) ||
      !Number.isInteger(itemSlotIndex) ||
      benchIndex < 0 ||
      itemSlotIndex < 0
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // itemSellInventoryIndex validation
  if (payload.itemSellInventoryIndex !== undefined) {
    if (!Number.isInteger(payload.itemSellInventoryIndex) || payload.itemSellInventoryIndex < 0) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // bossShopBuySlotIndex validation
  if (payload.bossShopBuySlotIndex !== undefined) {
    if (
      !Number.isInteger(payload.bossShopBuySlotIndex) ||
      payload.bossShopBuySlotIndex < 0 ||
      payload.bossShopBuySlotIndex > 1
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  return null;
}

function validateCommandConflicts(
  payload: CommandPayload,
  deps: ValidationDependencies,
): import("../../shared/room-messages").CommandResult | null {
  // shopBuySlotIndex and shopRefreshCount cannot be used together
  if (payload.shopBuySlotIndex !== undefined && payload.shopRefreshCount !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // benchSellIndex and shopBuySlotIndex cannot be used together
  if (payload.benchSellIndex !== undefined && payload.shopBuySlotIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // benchToBoardCell and benchSellIndex cannot be used together
  if (payload.benchToBoardCell !== undefined && payload.benchSellIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and benchToBoardCell cannot be used together
  if (payload.boardSellIndex !== undefined && payload.benchToBoardCell !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and benchSellIndex cannot be used together
  if (payload.boardSellIndex !== undefined && payload.benchSellIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and shopBuySlotIndex cannot be used together
  if (payload.boardSellIndex !== undefined && payload.shopBuySlotIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and boardUnitCount cannot be used together
  if (payload.boardSellIndex !== undefined && payload.boardUnitCount !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and boardPlacements cannot be used together
  if (payload.boardSellIndex !== undefined && payload.boardPlacements !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // itemBuySlotIndex and shopRefreshCount cannot be used together
  if (payload.itemBuySlotIndex !== undefined && payload.shopRefreshCount !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // itemBuySlotIndex and shopBuySlotIndex cannot be used together
  if (payload.itemBuySlotIndex !== undefined && payload.shopBuySlotIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  return null;
}

function validatePreconditions(
  playerId: string,
  payload: CommandPayload,
  deps: ValidationDependencies,
  internalResult?: ValidationInternalResult,
): import("../../shared/room-messages").CommandResult | null {
  // benchToBoardCell preconditions
  if (payload.benchToBoardCell !== undefined) {
    const benchUnits = deps.getBenchUnits(playerId);
    const boardPlacements = deps.getBoardPlacements(playerId);
    const currentBoardUnitCount = deps.getBoardUnitCount(playerId);

    if (!benchUnits[payload.benchToBoardCell.benchIndex]) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (currentBoardUnitCount >= 8) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const duplicatedCell = boardPlacements.some(
      (placement) => placement.cell === payload.benchToBoardCell?.cell,
    );

    if (duplicatedCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // benchSellIndex preconditions
  if (payload.benchSellIndex !== undefined) {
    const benchUnits = deps.getBenchUnits(playerId);

    if (!benchUnits[payload.benchSellIndex]) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // boardSellIndex preconditions
  if (payload.boardSellIndex !== undefined) {
    const boardPlacements = deps.getBoardPlacements(playerId);
    const hasBoardUnit = boardPlacements.some(
      (placement) => placement.cell === payload.boardSellIndex,
    );

    if (!hasBoardUnit) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // shopBuySlotIndex preconditions
  if (payload.shopBuySlotIndex !== undefined) {
    const offers = deps.getShopOffers(playerId);
    const benchUnits = deps.getBenchUnits(playerId);

    if (!offers[payload.shopBuySlotIndex]) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (benchUnits.length >= MAX_BENCH_SIZE) {
      return { accepted: false, code: "BENCH_FULL" };
    }

    // Shared pool check
    if (deps.isSharedPoolEnabled()) {
      const targetOffer = offers[payload.shopBuySlotIndex];
      if (targetOffer) {
        const rosterFlags = deps.getRosterFlags();
        if (rosterFlags.enablePerUnitSharedPool && !targetOffer.unitId) {
          const hasPurchasableSupply = TOUHOU_COST_TIERS.some((cost) => !deps.isPoolDepleted(cost));
          if (hasPurchasableSupply) {
            if (internalResult) {
              internalResult.rejectReason = "SERVER_INVARIANT_BREACH";
            }
            return { accepted: false, code: "INVALID_PAYLOAD" };
          }

          return { accepted: false, code: "POOL_DEPLETED" };
        }

        if (deps.isPoolDepleted(targetOffer.cost, targetOffer.unitId)) {
          return { accepted: false, code: "POOL_DEPLETED" };
        }
      }
    }
  }

  // itemBuySlotIndex preconditions
  if (payload.itemBuySlotIndex !== undefined) {
    const itemShop = deps.getItemShopOffers(playerId);

    if (!itemShop || payload.itemBuySlotIndex < 0 || payload.itemBuySlotIndex >= itemShop.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const inventory = deps.getItemInventory(playerId);

    if (!inventory || inventory.length >= MAX_INVENTORY_SIZE) {
      return { accepted: false, code: "INVENTORY_FULL" };
    }
  }

  // itemEquipToBench preconditions
  if (payload.itemEquipToBench !== undefined) {
    const { inventoryItemIndex, benchIndex } = payload.itemEquipToBench;
    const inventory = deps.getItemInventory(playerId);
    const benchUnits = deps.getBenchUnits(playerId);

    if (!inventory || inventoryItemIndex >= inventory.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (benchIndex >= benchUnits.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const benchUnit = benchUnits[benchIndex];
    if (!benchUnit) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const currentItems = benchUnit.items || [];
    if (currentItems.length >= MAX_ITEMS_PER_UNIT) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // itemUnequipFromBench preconditions
  if (payload.itemUnequipFromBench !== undefined) {
    const { benchIndex, itemSlotIndex } = payload.itemUnequipFromBench;
    const benchUnits = deps.getBenchUnits(playerId);
    const inventory = deps.getItemInventory(playerId);

    if (benchIndex >= benchUnits.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (!inventory || inventory.length >= MAX_INVENTORY_SIZE) {
      return { accepted: false, code: "INVENTORY_FULL" };
    }

    const benchUnit = benchUnits[benchIndex];
    if (!benchUnit) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const currentItems = benchUnit.items || [];
    if (itemSlotIndex >= currentItems.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // itemSellInventoryIndex preconditions
  if (payload.itemSellInventoryIndex !== undefined) {
    const inventory = deps.getItemInventory(playerId);

    if (!inventory || payload.itemSellInventoryIndex >= inventory.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // bossShopBuySlotIndex preconditions
  if (payload.bossShopBuySlotIndex !== undefined) {
    if (!deps.isBossPlayer(playerId)) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const bossOffers = deps.getBossShopOffers(playerId);
    if (!bossOffers || payload.bossShopBuySlotIndex >= bossOffers.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const bossOffer = bossOffers[payload.bossShopBuySlotIndex];
    if (!bossOffer || bossOffer.purchased) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const benchUnits = deps.getBenchUnits(playerId);
    if (benchUnits.length >= MAX_BENCH_SIZE) {
      return { accepted: false, code: "BENCH_FULL" };
    }
  }

  return null;
}

function validateGold(
  playerId: string,
  payload: CommandPayload,
  deps: ValidationDependencies,
): import("../../shared/room-messages").CommandResult | null {
  let xpPurchaseCount = payload.xpPurchaseCount ?? 0;
  let shopRefreshCount = payload.shopRefreshCount ?? 0;
  let shopBuyCost = 0;
  let itemBuyCost = 0;
  let bossShopBuyCost = 0;

  // Calculate shop buy cost
  if (payload.shopBuySlotIndex !== undefined) {
    const offers = deps.getShopOffers(playerId);
    const targetOffer = offers[payload.shopBuySlotIndex];
    if (targetOffer) {
      const boardPlacements = payload.boardPlacements ?? deps.getBoardPlacements(playerId);
      shopBuyCost = calculateDiscountedShopOfferCost(
        targetOffer,
        boardPlacements,
        deps.getRosterFlags(),
      );
    }
  }

  // Calculate item buy cost
  if (payload.itemBuySlotIndex !== undefined) {
    const itemShop = deps.getItemShopOffers(playerId);
    if (itemShop && payload.itemBuySlotIndex < itemShop.length) {
      const offer = itemShop[payload.itemBuySlotIndex];
      if (offer) {
        itemBuyCost = offer.cost;
      }
    }
  }

  // Calculate boss shop buy cost
  if (payload.bossShopBuySlotIndex !== undefined) {
    const bossOffers = deps.getBossShopOffers(playerId);
    const bossOffer = bossOffers[payload.bossShopBuySlotIndex];
    if (bossOffer) {
      bossShopBuyCost = bossOffer.cost;
    }
  }

  const currentGold = deps.getGold(playerId);
  const requiredGold =
    XP_PURCHASE_COST * xpPurchaseCount +
    SHOP_REFRESH_COST * shopRefreshCount +
    shopBuyCost +
    itemBuyCost +
    bossShopBuyCost;

  if (currentGold < requiredGold) {
    return { accepted: false, code: "INSUFFICIENT_GOLD" };
  }

  return null;
}

export type { BoardUnitPlacement, ItemType };
