import type { BoardUnitPlacement } from "../../shared/room-messages";
import { normalizeBoardPlacements } from "../combat/unit-effects";
import { DEFAULT_SHARED_BOARD_CONFIG } from "../../shared/shared-board-config";
import type { FeatureFlags } from "../../shared/feature-flags";
import { calculateDiscountedShopOfferCost } from "./shop-cost-reduction";
import { calculateSpecialUnitUpgradeCost } from "../special-unit-level-config";
import {
  MAX_BENCH_SIZE,
} from "../player-slot-limits";

// Constants from the controller
const MAX_SPECIAL_UNIT_UPGRADE_COUNT = 10;
const SHOP_REFRESH_COST = 2;
const MAX_SHOP_REFRESH_COUNT = 5;
const SHOP_SIZE = 5;
const MAX_SHOP_BUY_SLOT_INDEX = SHOP_SIZE - 1;
const HERO_EXCLUSIVE_SHOP_SIZE = 1;
const MAX_HERO_EXCLUSIVE_SHOP_BUY_SLOT_INDEX = HERO_EXCLUSIVE_SHOP_SIZE - 1;
const TOUHOU_COST_TIERS: readonly [1, 2, 3, 4, 5] = [1, 2, 3, 4, 5];
const SHARED_BOARD_MIN_INDEX = 0;
const SHARED_BOARD_MAX_INDEX = DEFAULT_SHARED_BOARD_CONFIG.width * DEFAULT_SHARED_BOARD_CONFIG.height - 1;

export interface ShopOffer {
  unitType: string;
  unitId?: string;
  rarity: number;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  unitLevel?: number;
}

export interface BenchUnit {
  unitType: string;
  unitId?: string;
  cost: number;
  unitLevel?: number;
  unitCount: number;
}

export interface CommandPayload {
  boardUnitCount?: number;
  boardPlacements?: BoardUnitPlacement[];
  heroPlacementCell?: number;
  specialUnitUpgradeCount?: number;
  shopRefreshCount?: number;
  shopBuySlotIndex?: number;
  heroExclusiveShopBuySlotIndex?: number;
  shopLock?: boolean;
  benchToBoardCell?: {
    benchIndex: number;
    cell: number;
    slot?: "main" | "sub";
  };
  boardToBenchCell?: {
    cell: number;
  };
  boardUnitMove?: {
    fromCell: number;
    toCell: number;
    slot?: "main" | "sub";
  };
  subUnitToBenchCell?: {
    cell: number;
  };
  subUnitMove?: {
    fromCell: number;
    toCell: number;
    slot?: "main" | "sub";
  };
  subUnitSwapBench?: {
    cell: number;
    benchIndex: number;
  };
  benchSellIndex?: number;
  boardSellIndex?: number;
  mergeUnits?: {
    unitType: string;
    unitLevel?: number;
    benchIndices?: number[];
    boardCells?: number[];
  };
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
  getMaxBoardUnitCount: (playerId: string) => number;
  getBossShopOffers: (playerId: string) => ShopOffer[];
  getHeroExclusiveShopOffers: (playerId: string) => ShopOffer[];
  getShopRefreshGoldCost: (playerId: string, refreshCount: number) => number;
  isBossPlayer: (playerId: string) => boolean;
  isSubUnitSystemEnabled: () => boolean;
  isSharedPoolEnabled: () => boolean;
  isPoolDepleted: (cost: number, unitId?: string) => boolean;
  getPrepDeadlineAtMs: () => number | null;
  getRosterFlags: () => FeatureFlags;
  getSpecialUnitLevel: (playerId: string) => number;
  getSelectedSpecialUnitId: (playerId: string) => string | undefined;
  getReservedBoardCells?: (playerId: string) => number[];
  getSelectedHeroIdForPlayer?: (playerId: string) => string;
  getHeroPlacementForPlayer?: (playerId: string) => number | null;
  getHeroAttachedSubUnitForPlayer?: (playerId: string) => NonNullable<BoardUnitPlacement["subUnit"]> | null;
  getHeroSubHostCellForPlayer?: (playerId: string) => number | null;
}

export interface ValidationContext {
  playerId: string;
  cmdSeq: number;
  receivedAtMs: number;
  payload: CommandPayload;
  // Computed values that can be used by executor
  shopBuyCost?: number;
  heroExclusiveShopBuyCost?: number;
  bossShopBuyCost?: number;
  requiredGold?: number;
}

export type ValidationInternalRejectReason = "SERVER_INVARIANT_BREACH";

export interface ValidationInternalResult {
  rejectReason?: ValidationInternalRejectReason;
}

function getMaxBoardUnitCount(playerId: string, deps: ValidationDependencies): number {
  return deps.getMaxBoardUnitCount(playerId);
}

function matchesUpgradeTrack(
  unitType: string,
  unitId: string | undefined,
  candidate: { unitType: string; unitId?: string },
): boolean {
  return candidate.unitType === unitType && (candidate.unitId ?? "") === (unitId ?? "");
}

function placementContainsUpgradeTrack(
  unitType: string,
  unitId: string | undefined,
  placement: BoardUnitPlacement,
): boolean {
  return matchesUpgradeTrack(unitType, unitId, placement)
    || (placement.subUnit !== undefined && matchesUpgradeTrack(unitType, unitId, placement.subUnit));
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
  const payloadValidation = validatePayload(playerId, payload, deps);
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
  playerId: string,
  payload: CommandPayload,
  deps: ValidationDependencies,
): import("../../shared/room-messages").CommandResult | null {
  if (payload.mergeUnits !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardUnitCount validation
  if (payload.boardUnitCount !== undefined) {
    const maxBoardUnitCount = getMaxBoardUnitCount(playerId, deps);
    if (
      !Number.isInteger(payload.boardUnitCount)
      || payload.boardUnitCount < 0
      || payload.boardUnitCount > maxBoardUnitCount
    ) {
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

    const hasSubAttachment = validationResult.normalized.some((placement) => placement.subUnit !== undefined);
    if (hasSubAttachment && !deps.isSubUnitSystemEnabled()) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const maxBoardUnitCount = getMaxBoardUnitCount(playerId, deps);
    if (validationResult.normalized.length > maxBoardUnitCount) {
      return { accepted: false, code: "TOO_MANY_UNITS" };
    }
  }

  // specialUnitUpgradeCount validation
  if (payload.specialUnitUpgradeCount !== undefined) {
    if (
      !Number.isInteger(payload.specialUnitUpgradeCount) ||
      payload.specialUnitUpgradeCount < 1 ||
      payload.specialUnitUpgradeCount > MAX_SPECIAL_UNIT_UPGRADE_COUNT
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const upgradeCost = calculateSpecialUnitUpgradeCost(
      deps.getSpecialUnitLevel(playerId),
      payload.specialUnitUpgradeCount,
      deps.getSelectedSpecialUnitId(playerId),
    );
    if (upgradeCost === null) {
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

  if (payload.heroExclusiveShopBuySlotIndex !== undefined) {
    if (
      !Number.isInteger(payload.heroExclusiveShopBuySlotIndex) ||
      payload.heroExclusiveShopBuySlotIndex < 0 ||
      payload.heroExclusiveShopBuySlotIndex > MAX_HERO_EXCLUSIVE_SHOP_BUY_SLOT_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // benchToBoardCell validation
  if (payload.benchToBoardCell !== undefined) {
    const { benchIndex, cell, slot } = payload.benchToBoardCell;
    if (
      !Number.isInteger(benchIndex) ||
      benchIndex < 0 ||
      !Number.isInteger(cell) ||
      cell < SHARED_BOARD_MIN_INDEX ||
      cell > SHARED_BOARD_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (slot !== undefined && slot !== "main" && slot !== "sub") {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // benchSellIndex validation
  if (payload.benchSellIndex !== undefined) {
    if (!Number.isInteger(payload.benchSellIndex) || payload.benchSellIndex < 0) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.boardToBenchCell !== undefined) {
    if (
      !Number.isInteger(payload.boardToBenchCell.cell) ||
      payload.boardToBenchCell.cell < SHARED_BOARD_MIN_INDEX ||
      payload.boardToBenchCell.cell > SHARED_BOARD_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.boardUnitMove !== undefined) {
    const { fromCell, toCell, slot } = payload.boardUnitMove;
    if (
      !Number.isInteger(fromCell) ||
      fromCell < SHARED_BOARD_MIN_INDEX ||
      fromCell > SHARED_BOARD_MAX_INDEX ||
      !Number.isInteger(toCell) ||
      toCell < SHARED_BOARD_MIN_INDEX ||
      toCell > SHARED_BOARD_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (slot !== undefined && slot !== "main" && slot !== "sub") {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.subUnitToBenchCell !== undefined) {
    if (
      !Number.isInteger(payload.subUnitToBenchCell.cell) ||
      payload.subUnitToBenchCell.cell < SHARED_BOARD_MIN_INDEX ||
      payload.subUnitToBenchCell.cell > SHARED_BOARD_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.subUnitMove !== undefined) {
    const { fromCell, toCell, slot } = payload.subUnitMove;
    if (
      !Number.isInteger(fromCell) ||
      fromCell < SHARED_BOARD_MIN_INDEX ||
      fromCell > SHARED_BOARD_MAX_INDEX ||
      !Number.isInteger(toCell) ||
      toCell < SHARED_BOARD_MIN_INDEX ||
      toCell > SHARED_BOARD_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (slot !== undefined && slot !== "main" && slot !== "sub") {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.subUnitSwapBench !== undefined) {
    if (
      !Number.isInteger(payload.subUnitSwapBench.cell) ||
      payload.subUnitSwapBench.cell < SHARED_BOARD_MIN_INDEX ||
      payload.subUnitSwapBench.cell > SHARED_BOARD_MAX_INDEX ||
      !Number.isInteger(payload.subUnitSwapBench.benchIndex) ||
      payload.subUnitSwapBench.benchIndex < 0
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // boardSellIndex validation
  if (payload.boardSellIndex !== undefined) {
    if (
      !Number.isInteger(payload.boardSellIndex) ||
      payload.boardSellIndex < SHARED_BOARD_MIN_INDEX ||
      payload.boardSellIndex > SHARED_BOARD_MAX_INDEX
    ) {
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
  const hasSubUnitCommand =
    payload.heroPlacementCell !== undefined
    || payload.boardUnitMove !== undefined
    || payload.subUnitToBenchCell !== undefined
    || payload.subUnitMove !== undefined
    || payload.subUnitSwapBench !== undefined;

  if (
    hasSubUnitCommand
    && (
      payload.shopBuySlotIndex !== undefined
      || payload.shopRefreshCount !== undefined
      || payload.benchToBoardCell !== undefined
      || payload.boardToBenchCell !== undefined
      || payload.benchSellIndex !== undefined
      || payload.boardSellIndex !== undefined
      || payload.boardUnitCount !== undefined
      || payload.boardPlacements !== undefined
      || payload.heroExclusiveShopBuySlotIndex !== undefined
      || payload.bossShopBuySlotIndex !== undefined
      || payload.specialUnitUpgradeCount !== undefined
      || payload.shopLock !== undefined
    )
  ) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (
    (payload.boardUnitMove !== undefined && payload.subUnitToBenchCell !== undefined)
    || (payload.boardUnitMove !== undefined && payload.subUnitMove !== undefined)
    || (payload.boardUnitMove !== undefined && payload.subUnitSwapBench !== undefined)
    || (payload.subUnitToBenchCell !== undefined && payload.subUnitMove !== undefined)
    || (payload.subUnitToBenchCell !== undefined && payload.subUnitSwapBench !== undefined)
    || (payload.subUnitMove !== undefined && payload.subUnitSwapBench !== undefined)
  ) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (
    payload.heroPlacementCell !== undefined
    && (
      payload.benchToBoardCell !== undefined
      || payload.boardToBenchCell !== undefined
      || payload.boardPlacements !== undefined
      || payload.boardUnitMove !== undefined
      || payload.subUnitToBenchCell !== undefined
      || payload.subUnitMove !== undefined
      || payload.subUnitSwapBench !== undefined
    )
  ) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

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

  if (payload.boardToBenchCell !== undefined && payload.benchToBoardCell !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and benchSellIndex cannot be used together
  if (payload.boardSellIndex !== undefined && payload.benchSellIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (payload.boardToBenchCell !== undefined && payload.benchSellIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (payload.boardToBenchCell !== undefined && payload.boardSellIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and shopBuySlotIndex cannot be used together
  if (payload.boardSellIndex !== undefined && payload.shopBuySlotIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (payload.boardToBenchCell !== undefined && payload.shopBuySlotIndex !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and boardUnitCount cannot be used together
  if (payload.boardSellIndex !== undefined && payload.boardUnitCount !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (payload.boardToBenchCell !== undefined && payload.boardUnitCount !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  // boardSellIndex and boardPlacements cannot be used together
  if (payload.boardSellIndex !== undefined && payload.boardPlacements !== undefined) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  if (payload.boardToBenchCell !== undefined && payload.boardPlacements !== undefined) {
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
  const reservedBoardCells = new Set(deps.getReservedBoardCells?.(playerId) ?? []);

  // benchToBoardCell preconditions
  if (payload.benchToBoardCell !== undefined) {
    const benchUnits = deps.getBenchUnits(playerId);
    const boardPlacements = deps.getBoardPlacements(playerId);
    const currentBoardUnitCount = deps.getBoardUnitCount(playerId);
    const occupiedPlacement = boardPlacements.find(
      (placement) => placement.cell === payload.benchToBoardCell?.cell,
    );
    const targetSlot = payload.benchToBoardCell.slot ?? "main";
    const heroPlacement = deps.getHeroPlacementForPlayer?.(playerId) ?? null;
    const targetsOwnHeroCell = heroPlacement === payload.benchToBoardCell.cell;

    if (!benchUnits[payload.benchToBoardCell.benchIndex]) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetSlot === "sub") {
      if (!deps.isSubUnitSystemEnabled()) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (deps.isBossPlayer(playerId)) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (!occupiedPlacement && !targetsOwnHeroCell) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    } else {
      if (currentBoardUnitCount >= getMaxBoardUnitCount(playerId, deps) && !occupiedPlacement) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (reservedBoardCells.has(payload.benchToBoardCell.cell)) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (occupiedPlacement?.subUnit) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
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

  if (payload.boardToBenchCell !== undefined) {
    const benchUnits = deps.getBenchUnits(playerId);
    const boardPlacements = deps.getBoardPlacements(playerId);
    const returnedPlacement = boardPlacements.find(
      (placement) => placement.cell === payload.boardToBenchCell?.cell,
    );
    const heroPlacement = deps.getHeroPlacementForPlayer?.(playerId) ?? null;
    const heroAttachedSubUnit = deps.getHeroAttachedSubUnitForPlayer?.(playerId) ?? null;
    const isHeroAttachedSubUnitCell =
      heroPlacement === payload.boardToBenchCell.cell && heroAttachedSubUnit !== null;
    const hasBoardUnit = returnedPlacement !== undefined || isHeroAttachedSubUnitCell;

    if (!hasBoardUnit) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const requiredBenchSlots = returnedPlacement?.subUnit ? 2 : 1;
    if (benchUnits.length + requiredBenchSlots > MAX_BENCH_SIZE) {
      return { accepted: false, code: "BENCH_FULL" };
    }
  }

  if (payload.heroPlacementCell !== undefined) {
    const selectedHeroId = deps.getSelectedHeroIdForPlayer?.(playerId) ?? "";
    const boardPlacements = deps.getBoardPlacements(playerId);
    const targetPlacement = boardPlacements.find(
      (placement) => placement.cell === payload.heroPlacementCell,
    );
    const heroAttachedSubUnit = deps.getHeroAttachedSubUnitForPlayer?.(playerId) ?? null;
    const targetRow = Math.floor(payload.heroPlacementCell / DEFAULT_SHARED_BOARD_CONFIG.width);

    if (deps.isBossPlayer(playerId) || selectedHeroId.length === 0) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetRow < Math.floor(DEFAULT_SHARED_BOARD_CONFIG.height / 2)) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetPlacement) {
      if (!deps.isSubUnitSystemEnabled() || selectedHeroId !== "okina" || heroAttachedSubUnit !== null) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    } else if (reservedBoardCells.has(payload.heroPlacementCell)) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.boardUnitMove !== undefined) {
    const boardPlacements = deps.getBoardPlacements(playerId);
    const sourcePlacement = boardPlacements.find((placement) => placement.cell === payload.boardUnitMove?.fromCell);
    const targetPlacement = boardPlacements.find((placement) => placement.cell === payload.boardUnitMove?.toCell);
    const targetSlot = payload.boardUnitMove.slot ?? "main";
    const heroPlacement = deps.getHeroPlacementForPlayer?.(playerId) ?? null;
    const heroSubHostCell = deps.getHeroSubHostCellForPlayer?.(playerId) ?? null;
    const targetsOwnHeroCell = heroPlacement === payload.boardUnitMove.toCell;

    if (!sourcePlacement || payload.boardUnitMove.fromCell === payload.boardUnitMove.toCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetSlot !== "sub") {
      if (targetPlacement || targetsOwnHeroCell || reservedBoardCells.has(payload.boardUnitMove.toCell)) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      return null;
    }

    if (!deps.isSubUnitSystemEnabled() || deps.isBossPlayer(playerId)) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (sourcePlacement.subUnit !== undefined) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (!targetPlacement && !targetsOwnHeroCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetPlacement?.subUnit !== undefined || heroSubHostCell === payload.boardUnitMove.toCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetsOwnHeroCell) {
      const heroAttachedSubUnit = deps.getHeroAttachedSubUnitForPlayer?.(playerId) ?? null;
      if (heroAttachedSubUnit !== null) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }
  }

  if (payload.subUnitToBenchCell !== undefined) {
    const benchUnits = deps.getBenchUnits(playerId);
    const boardPlacements = deps.getBoardPlacements(playerId);
    const hostPlacement = boardPlacements.find(
      (placement) => placement.cell === payload.subUnitToBenchCell?.cell,
    );
    const heroPlacement = deps.getHeroPlacementForPlayer?.(playerId) ?? null;
    const heroAttachedSubUnit = deps.getHeroAttachedSubUnitForPlayer?.(playerId) ?? null;
    const hasAttachedSubUnit = hostPlacement?.subUnit !== undefined
      || (heroPlacement === payload.subUnitToBenchCell.cell && heroAttachedSubUnit !== null);

    if (!hasAttachedSubUnit) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (benchUnits.length >= MAX_BENCH_SIZE) {
      return { accepted: false, code: "BENCH_FULL" };
    }
  }

  if (payload.subUnitSwapBench !== undefined) {
    const boardPlacements = deps.getBoardPlacements(playerId);
    const hostPlacement = boardPlacements.find(
      (placement) => placement.cell === payload.subUnitSwapBench?.cell,
    );
    const heroPlacement = deps.getHeroPlacementForPlayer?.(playerId) ?? null;
    const heroAttachedSubUnit = deps.getHeroAttachedSubUnitForPlayer?.(playerId) ?? null;
    const hasAttachedSubUnit = hostPlacement?.subUnit !== undefined
      || (heroPlacement === payload.subUnitSwapBench.cell && heroAttachedSubUnit !== null);

    if (!hasAttachedSubUnit || !deps.getBenchUnits(playerId)[payload.subUnitSwapBench.benchIndex]) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.subUnitMove !== undefined) {
    const boardPlacements = deps.getBoardPlacements(playerId);
    const sourcePlacement = boardPlacements.find((placement) => placement.cell === payload.subUnitMove?.fromCell);
    const targetPlacement = boardPlacements.find((placement) => placement.cell === payload.subUnitMove?.toCell);
    const heroPlacement = deps.getHeroPlacementForPlayer?.(playerId) ?? null;
    const heroSubHostCell = deps.getHeroSubHostCellForPlayer?.(playerId) ?? null;
    const heroAttachedSubUnit = deps.getHeroAttachedSubUnitForPlayer?.(playerId) ?? null;
    const sourceHasAttachedSubUnit = sourcePlacement?.subUnit !== undefined
      || (heroPlacement === payload.subUnitMove.fromCell && heroAttachedSubUnit !== null)
      || (heroSubHostCell === payload.subUnitMove.fromCell);
    const sourceIsHeroSubHost = heroSubHostCell === payload.subUnitMove.fromCell;
    const targetSlot = payload.subUnitMove.slot ?? "main";
    const targetsOwnHeroCell = heroPlacement === payload.subUnitMove.toCell;

    if (!sourceHasAttachedSubUnit || payload.subUnitMove.fromCell === payload.subUnitMove.toCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (targetSlot === "sub") {
      if (!deps.isSubUnitSystemEnabled() || deps.isBossPlayer(playerId)) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (!targetPlacement && !targetsOwnHeroCell) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (sourceIsHeroSubHost && targetPlacement?.subUnit !== undefined) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    } else {
      if (!sourceIsHeroSubHost && deps.getBoardUnitCount(playerId) >= getMaxBoardUnitCount(playerId, deps)) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (sourceIsHeroSubHost) {
        const targetRow = Math.floor(payload.subUnitMove.toCell / DEFAULT_SHARED_BOARD_CONFIG.width);
        if (targetRow < Math.floor(DEFAULT_SHARED_BOARD_CONFIG.height / 2)) {
          return { accepted: false, code: "INVALID_PAYLOAD" };
        }
      }

      if (targetPlacement || targetsOwnHeroCell || reservedBoardCells.has(payload.subUnitMove.toCell)) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }
  }

  if (payload.boardPlacements !== undefined) {
    if (deps.isBossPlayer(playerId) && payload.boardPlacements.some((placement) => placement.subUnit !== undefined)) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const conflictsWithReservedCell = payload.boardPlacements.some((placement) =>
      reservedBoardCells.has(placement.cell),
    );

    if (conflictsWithReservedCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  if (payload.heroPlacementCell !== undefined) {
    if (
      !Number.isInteger(payload.heroPlacementCell) ||
      payload.heroPlacementCell < SHARED_BOARD_MIN_INDEX ||
      payload.heroPlacementCell > SHARED_BOARD_MAX_INDEX
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }
  }

  // shopBuySlotIndex preconditions
  if (payload.shopBuySlotIndex !== undefined) {
    const offers = deps.getShopOffers(playerId);
    const benchUnits = deps.getBenchUnits(playerId);
    const targetOffer = offers[payload.shopBuySlotIndex];

    if (!targetOffer) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const boardPlacements = deps.getBoardPlacements(playerId);
    const canStackIntoExistingUnit =
      benchUnits.some((unit) => matchesUpgradeTrack(targetOffer.unitType, targetOffer.unitId, unit)) ||
      boardPlacements.some((placement) => placementContainsUpgradeTrack(targetOffer.unitType, targetOffer.unitId, placement));

    if (benchUnits.length >= MAX_BENCH_SIZE && !canStackIntoExistingUnit) {
      return { accepted: false, code: "BENCH_FULL" };
    }

    // Shared pool check
    if (deps.isSharedPoolEnabled()) {
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

  if (payload.heroExclusiveShopBuySlotIndex !== undefined) {
    if (deps.isBossPlayer(playerId)) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const heroExclusiveOffers = deps.getHeroExclusiveShopOffers(playerId);
    if (!heroExclusiveOffers || payload.heroExclusiveShopBuySlotIndex >= heroExclusiveOffers.length) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const heroExclusiveOffer = heroExclusiveOffers[payload.heroExclusiveShopBuySlotIndex];
    if (!heroExclusiveOffer || heroExclusiveOffer.purchased) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    const benchUnits = deps.getBenchUnits(playerId);
    const boardPlacements = deps.getBoardPlacements(playerId);
    const canStackIntoExistingUnit =
      benchUnits.some((unit) =>
        matchesUpgradeTrack(heroExclusiveOffer.unitType, heroExclusiveOffer.unitId, unit)
      ) ||
      boardPlacements.some((placement) =>
        placementContainsUpgradeTrack(heroExclusiveOffer.unitType, heroExclusiveOffer.unitId, placement)
      );

    if (benchUnits.length >= MAX_BENCH_SIZE && !canStackIntoExistingUnit) {
      return { accepted: false, code: "BENCH_FULL" };
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
    const boardPlacements = deps.getBoardPlacements(playerId);
    const canStackIntoExistingUnit =
      benchUnits.some((unit) => matchesUpgradeTrack(bossOffer.unitType, bossOffer.unitId, unit)) ||
      boardPlacements.some((placement) => placementContainsUpgradeTrack(bossOffer.unitType, bossOffer.unitId, placement));

    if (benchUnits.length >= MAX_BENCH_SIZE && !canStackIntoExistingUnit) {
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
  const specialUnitUpgradeCount = payload.specialUnitUpgradeCount ?? 0;
  const shopRefreshCount = payload.shopRefreshCount ?? 0;
  let shopBuyCost = 0;
  let heroExclusiveShopBuyCost = 0;
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

  if (payload.heroExclusiveShopBuySlotIndex !== undefined) {
    const heroExclusiveOffers = deps.getHeroExclusiveShopOffers(playerId);
    const heroExclusiveOffer = heroExclusiveOffers[payload.heroExclusiveShopBuySlotIndex];
    if (heroExclusiveOffer) {
      heroExclusiveShopBuyCost = heroExclusiveOffer.cost;
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

  const specialUnitUpgradeCost = specialUnitUpgradeCount > 0
    ? calculateSpecialUnitUpgradeCost(
      deps.getSpecialUnitLevel(playerId),
      specialUnitUpgradeCount,
      deps.getSelectedSpecialUnitId(playerId),
    )
    : 0;
  if (specialUnitUpgradeCost === null) {
    return { accepted: false, code: "INVALID_PAYLOAD" };
  }

  const currentGold = deps.getGold(playerId);
  const requiredGold =
    specialUnitUpgradeCost +
    deps.getShopRefreshGoldCost(playerId, shopRefreshCount) +
    shopBuyCost +
    heroExclusiveShopBuyCost +
    bossShopBuyCost;

  if (currentGold < requiredGold) {
    return { accepted: false, code: "INSUFFICIENT_GOLD" };
  }

  return null;
}

export type { BoardUnitPlacement };
