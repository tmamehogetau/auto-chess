import type { CommandResult, BoardUnitPlacement } from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";
import { normalizeBoardPlacements } from "../combat/unit-effects";
import { calculateDiscountedShopOfferCost } from "./shop-cost-reduction";
import { calculateSpecialUnitUpgradeCost } from "../special-unit-level-config";
import type {
  CommandPayload,
  ShopOffer,
} from "./prep-command-validator";

// Constants from the controller
const SHOP_REFRESH_COST = 2;
const INITIAL_GOLD = 15;
const UNIT_LEVEL_MIN = 1;

export interface ExecutionDependencies {
  // State setters
  setBoardUnitCount: (playerId: string, count: number) => void;
  setBoardPlacements: (playerId: string, placements: BoardUnitPlacement[]) => void;
  setShopLock: (playerId: string, locked: boolean) => void;
  setLastCmdSeq: (playerId: string, cmdSeq: number) => void;

  // Gold and special unit operations
  addGold: (playerId: string, amount: number) => void;
  getSpecialUnitLevel: (playerId: string) => number;
  getSelectedSpecialUnitId: (playerId: string) => string | undefined;
  upgradeSpecialUnit: (playerId: string, count: number) => void;

  // Shop operations
  getShopRefreshGoldCost: (playerId: string, refreshCount: number) => number;
  refreshShop: (playerId: string, count: number) => void;
  buyShopOffer: (playerId: string, slotIndex: number) => void;
  buyHeroExclusiveShopOffer: (playerId: string, slotIndex: number) => void;

  // Unit operations
  deployBenchUnitToBoard: (playerId: string, benchIndex: number, cell: number, slot?: "main" | "sub") => void;
  returnBoardUnitToBench: (playerId: string, cell: number) => void;
  moveBoardUnit: (playerId: string, fromCell: number, toCell: number, slot?: "main" | "sub") => void;
  swapBoardUnits: (playerId: string, fromCell: number, toCell: number) => void;
  returnAttachedSubUnitToBench: (playerId: string, cell: number) => void;
  moveAttachedSubUnit: (playerId: string, fromCell: number, toCell: number, slot?: "main" | "sub") => void;
  swapAttachedSubUnitWithBench: (playerId: string, cell: number, benchIndex: number) => void;
  applyHeroPlacement: (playerId: string, cell: number) => CommandResult;
  sellBenchUnit: (playerId: string, benchIndex: number) => void;
  sellBoardUnit: (playerId: string, cell: number) => void;

  // Boss shop operations
  buyBossShopOffer: (playerId: string, slotIndex: number) => void;

  // State getters (for execution context)
  getBenchUnits: (playerId: string) => Array<{
    unitType: string;
    cost: number;
    unitLevel: number;
    unitCount: number;
  }>;
  getOwnedUnits: (playerId: string) => { vanguard: number; ranger: number; mage: number; assassin: number };
  getBoardPlacements: (playerId: string) => BoardUnitPlacement[];
  getShopOffers: (playerId: string) => ShopOffer[];
  getHeroExclusiveShopOffers: (playerId: string) => ShopOffer[];
  getBossShopOffers: (playerId: string) => ShopOffer[];
  getRosterFlags: () => FeatureFlags;

  // Logging
  logBossShop: (
    playerId: string,
    offers: Array<{ unitType: string; cost: number; isRumorUnit?: boolean }>,
    purchase: { slotIndex: number; unitType: string; cost: number },
  ) => void;
}

export { type CommandPayload };

/**
 * Executes a prep command and applies all state mutations.
 * Assumes validation has already passed.
 */
export function executePrepCommand(
  playerId: string,
  cmdSeq: number,
  payload: CommandPayload,
  deps: ExecutionDependencies,
): CommandResult {
  // 1. Apply board unit count change
  if (payload.boardUnitCount !== undefined) {
    deps.setBoardUnitCount(playerId, payload.boardUnitCount);
  }

  // 2. Apply board placements (normalize before saving)
  if (payload.boardPlacements !== undefined) {
    const normalizedResult = normalizeBoardPlacements(payload.boardPlacements);
    if (normalizedResult.normalized) {
      deps.setBoardPlacements(playerId, normalizedResult.normalized);
      deps.setBoardUnitCount(playerId, normalizedResult.normalized.length);
    }
  }

  // 3. Calculate and apply gold changes for all purchase operations
  let totalGoldCost = 0;
  let canApplySpecialUnitUpgrade = false;

  // Special unit upgrade cost
  if (payload.specialUnitUpgradeCount !== undefined && payload.specialUnitUpgradeCount > 0) {
    const upgradeCost = calculateSpecialUnitUpgradeCost(
      deps.getSpecialUnitLevel(playerId),
      payload.specialUnitUpgradeCount,
      deps.getSelectedSpecialUnitId(playerId),
    );
    if (upgradeCost !== null) {
      totalGoldCost += upgradeCost;
      canApplySpecialUnitUpgrade = true;
    }
  }

  // Shop refresh cost
  if (payload.shopRefreshCount !== undefined && payload.shopRefreshCount > 0) {
    totalGoldCost += deps.getShopRefreshGoldCost(playerId, payload.shopRefreshCount);
  }

  // Shop buy cost
  if (payload.shopBuySlotIndex !== undefined) {
    const offers = deps.getShopOffers(playerId);
    const targetOffer = offers[payload.shopBuySlotIndex];
    if (targetOffer) {
      totalGoldCost += calculateDiscountedShopOfferCost(
        targetOffer,
        deps.getBoardPlacements(playerId),
        deps.getRosterFlags(),
      );
    }
  }

  if (payload.heroExclusiveShopBuySlotIndex !== undefined) {
    const heroExclusiveOffers = deps.getHeroExclusiveShopOffers(playerId);
    const heroExclusiveOffer = heroExclusiveOffers[payload.heroExclusiveShopBuySlotIndex];
    if (heroExclusiveOffer) {
      totalGoldCost += heroExclusiveOffer.cost;
    }
  }

  // Boss shop buy cost
  if (payload.bossShopBuySlotIndex !== undefined) {
    const bossOffers = deps.getBossShopOffers(playerId);
    const bossOffer = bossOffers[payload.bossShopBuySlotIndex];
    if (bossOffer) {
      totalGoldCost += bossOffer.cost;
    }
  }

  // Apply gold deduction if any
  if (totalGoldCost > 0) {
    deps.addGold(playerId, -totalGoldCost);
  }

  // 4. Execute special unit upgrade (after gold deduction)
  if (
    canApplySpecialUnitUpgrade
    && payload.specialUnitUpgradeCount !== undefined
    && payload.specialUnitUpgradeCount > 0
  ) {
    deps.upgradeSpecialUnit(playerId, payload.specialUnitUpgradeCount);
  }

  // 5. Execute shop refresh
  if (payload.shopRefreshCount !== undefined && payload.shopRefreshCount > 0) {
    deps.refreshShop(playerId, payload.shopRefreshCount);
  }

  // 6. Execute shop buy
  if (payload.shopBuySlotIndex !== undefined) {
    deps.buyShopOffer(playerId, payload.shopBuySlotIndex);
  }

  if (payload.heroExclusiveShopBuySlotIndex !== undefined) {
    deps.buyHeroExclusiveShopOffer(playerId, payload.heroExclusiveShopBuySlotIndex);
  }

  // 7. Execute boss shop buy
  if (payload.bossShopBuySlotIndex !== undefined) {
    deps.buyBossShopOffer(playerId, payload.bossShopBuySlotIndex);

    // Log boss shop purchase
    const bossOffers = deps.getBossShopOffers(playerId);
    if (bossOffers && payload.bossShopBuySlotIndex < bossOffers.length) {
      const bossOffer = bossOffers[payload.bossShopBuySlotIndex];
      if (bossOffer) {
        deps.logBossShop(
          playerId,
          bossOffers.map((o) => {
            const offer: { unitType: string; cost: number; isRumorUnit?: boolean } = {
              unitType: o.unitType,
              cost: o.cost,
            };
            if (o.isRumorUnit !== undefined) {
              offer.isRumorUnit = o.isRumorUnit;
            }
            return offer;
          }),
          {
            slotIndex: payload.bossShopBuySlotIndex,
            unitType: bossOffer.unitType,
            cost: bossOffer.cost,
          },
        );
      }
    }
  }

  // 8. Apply shop lock
  if (payload.shopLock !== undefined) {
    deps.setShopLock(playerId, payload.shopLock);
  }

  // 9. Execute bench to board
  if (payload.benchToBoardCell !== undefined) {
    if (payload.benchToBoardCell.slot !== undefined) {
      deps.deployBenchUnitToBoard(
        playerId,
        payload.benchToBoardCell.benchIndex,
        payload.benchToBoardCell.cell,
        payload.benchToBoardCell.slot,
      );
    } else {
      deps.deployBenchUnitToBoard(
        playerId,
        payload.benchToBoardCell.benchIndex,
        payload.benchToBoardCell.cell,
      );
    }
  }

  // 10. Execute board to bench
  if (payload.boardToBenchCell !== undefined) {
    deps.returnBoardUnitToBench(playerId, payload.boardToBenchCell.cell);
  }

  if (payload.heroPlacementCell !== undefined) {
    const heroResult = deps.applyHeroPlacement(playerId, payload.heroPlacementCell);
    if (!heroResult.accepted) {
      return heroResult;
    }
  }

  if (payload.boardUnitMove !== undefined) {
    deps.moveBoardUnit(
      playerId,
      payload.boardUnitMove.fromCell,
      payload.boardUnitMove.toCell,
      payload.boardUnitMove.slot,
    );
  }

  if (payload.boardUnitSwap !== undefined) {
    deps.swapBoardUnits(
      playerId,
      payload.boardUnitSwap.fromCell,
      payload.boardUnitSwap.toCell,
    );
  }

  if (payload.subUnitToBenchCell !== undefined) {
    deps.returnAttachedSubUnitToBench(playerId, payload.subUnitToBenchCell.cell);
  }

  if (payload.subUnitMove !== undefined) {
    deps.moveAttachedSubUnit(
      playerId,
      payload.subUnitMove.fromCell,
      payload.subUnitMove.toCell,
      payload.subUnitMove.slot,
    );
  }

  if (payload.subUnitSwapBench !== undefined) {
    deps.swapAttachedSubUnitWithBench(
      playerId,
      payload.subUnitSwapBench.cell,
      payload.subUnitSwapBench.benchIndex,
    );
  }

  // 11. Execute bench sell
  if (payload.benchSellIndex !== undefined) {
    deps.sellBenchUnit(playerId, payload.benchSellIndex);
  }

  // 12. Execute board sell
  if (payload.boardSellIndex !== undefined) {
    deps.sellBoardUnit(playerId, payload.boardSellIndex);
  }

  // 13. Update last command sequence
  deps.setLastCmdSeq(playerId, cmdSeq);

  return { accepted: true };
}
