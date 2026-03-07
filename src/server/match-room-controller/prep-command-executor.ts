import type { CommandResult, BoardUnitPlacement } from "../../shared/room-messages";
import type { ItemType } from "../../shared/types";
import type {
  CommandPayload,
  ShopOffer,
  ItemShopOffer,
} from "./prep-command-validator";

// Constants from the controller
const XP_PURCHASE_COST = 4;
const XP_PURCHASE_GAIN = 4;
const SHOP_REFRESH_COST = 2;
const INITIAL_GOLD = 15;
const STAR_LEVEL_MIN = 1;

export interface ExecutionDependencies {
  // State setters
  setBoardUnitCount: (playerId: string, count: number) => void;
  setBoardPlacements: (playerId: string, placements: BoardUnitPlacement[]) => void;
  setShopLock: (playerId: string, locked: boolean) => void;
  setLastCmdSeq: (playerId: string, cmdSeq: number) => void;

  // Gold and XP operations
  addGold: (playerId: string, amount: number) => void;
  addXp: (playerId: string, amount: number) => void;

  // Shop operations
  refreshShop: (playerId: string, count: number) => void;
  buyShopOffer: (playerId: string, slotIndex: number) => void;

  // Unit operations
  deployBenchUnitToBoard: (playerId: string, benchIndex: number, cell: number) => void;
  sellBenchUnit: (playerId: string, benchIndex: number) => void;
  sellBoardUnit: (playerId: string, cell: number) => void;

  // Item operations
  addItemToInventory: (playerId: string, itemType: ItemType) => void;
  equipItemToBenchUnit: (playerId: string, inventoryItemIndex: number, benchIndex: number) => void;
  unequipItemFromBenchUnit: (playerId: string, benchIndex: number, itemSlotIndex: number) => void;
  sellInventoryItem: (playerId: string, inventoryItemIndex: number) => void;

  // Boss shop operations
  buyBossShopOffer: (playerId: string, slotIndex: number) => void;

  // State getters (for execution context)
  getBenchUnits: (playerId: string) => Array<{
    unitType: string;
    cost: number;
    starLevel: number;
    unitCount: number;
    items?: ItemType[];
  }>;
  getOwnedUnits: (playerId: string) => { vanguard: number; ranger: number; mage: number; assassin: number };
  getItemInventory: (playerId: string) => ItemType[];
  getShopOffers: (playerId: string) => ShopOffer[];
  getItemShopOffers: (playerId: string) => ItemShopOffer[];
  getBossShopOffers: (playerId: string) => ShopOffer[];

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

  // 2. Apply board placements
  if (payload.boardPlacements !== undefined) {
    deps.setBoardPlacements(playerId, payload.boardPlacements);
    deps.setBoardUnitCount(playerId, payload.boardPlacements.length);
  }

  // 3. Calculate and apply gold changes for all purchase operations
  let totalGoldCost = 0;

  // XP purchase cost
  if (payload.xpPurchaseCount !== undefined && payload.xpPurchaseCount > 0) {
    totalGoldCost += XP_PURCHASE_COST * payload.xpPurchaseCount;
  }

  // Shop refresh cost
  if (payload.shopRefreshCount !== undefined && payload.shopRefreshCount > 0) {
    totalGoldCost += SHOP_REFRESH_COST * payload.shopRefreshCount;
  }

  // Shop buy cost
  if (payload.shopBuySlotIndex !== undefined) {
    const offers = deps.getShopOffers(playerId);
    const targetOffer = offers[payload.shopBuySlotIndex];
    if (targetOffer) {
      totalGoldCost += targetOffer.cost;
    }
  }

  // Item buy cost
  if (payload.itemBuySlotIndex !== undefined) {
    const itemShop = deps.getItemShopOffers(playerId);
    if (itemShop && payload.itemBuySlotIndex < itemShop.length) {
      const offer = itemShop[payload.itemBuySlotIndex];
      if (offer) {
        totalGoldCost += offer.cost;
      }
    }
  }

  // Apply gold deduction if any
  if (totalGoldCost > 0) {
    deps.addGold(playerId, -totalGoldCost);
  }

  // 4. Execute XP purchase (after gold deduction)
  if (payload.xpPurchaseCount !== undefined && payload.xpPurchaseCount > 0) {
    deps.addXp(playerId, XP_PURCHASE_GAIN * payload.xpPurchaseCount);
  }

  // 5. Execute shop refresh
  if (payload.shopRefreshCount !== undefined && payload.shopRefreshCount > 0) {
    deps.refreshShop(playerId, payload.shopRefreshCount);
  }

  // 6. Execute shop buy
  if (payload.shopBuySlotIndex !== undefined) {
    deps.buyShopOffer(playerId, payload.shopBuySlotIndex);
  }

  // 7. Execute item buy
  if (payload.itemBuySlotIndex !== undefined) {
    const itemShop = deps.getItemShopOffers(playerId);
    if (itemShop) {
      const offer = itemShop[payload.itemBuySlotIndex];
      if (offer) {
        deps.addItemToInventory(playerId, offer.itemType);
      }
    }
  }

  // 8. Execute boss shop buy
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

  // 9. Apply shop lock
  if (payload.shopLock !== undefined) {
    deps.setShopLock(playerId, payload.shopLock);
  }

  // 10. Execute bench to board
  if (payload.benchToBoardCell !== undefined) {
    deps.deployBenchUnitToBoard(
      playerId,
      payload.benchToBoardCell.benchIndex,
      payload.benchToBoardCell.cell,
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

  // 13. Execute item equip to bench
  if (payload.itemEquipToBench !== undefined) {
    deps.equipItemToBenchUnit(
      playerId,
      payload.itemEquipToBench.inventoryItemIndex,
      payload.itemEquipToBench.benchIndex,
    );
  }

  // 14. Execute item unequip from bench
  if (payload.itemUnequipFromBench !== undefined) {
    deps.unequipItemFromBenchUnit(
      playerId,
      payload.itemUnequipFromBench.benchIndex,
      payload.itemUnequipFromBench.itemSlotIndex,
    );
  }

  // 15. Execute item sell
  if (payload.itemSellInventoryIndex !== undefined) {
    deps.sellInventoryItem(playerId, payload.itemSellInventoryIndex);
  }

  // 16. Update last command sequence
  deps.setLastCmdSeq(playerId, cmdSeq);

  return { accepted: true };
}
