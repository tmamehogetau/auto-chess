import type { PrepCommandMessage } from "../../../shared/room-messages";
import type { CommandPayload } from "../../match-room-controller/prep-command-validator";

export interface MergeUnitsPayload {
  unitType: string;
  starLevel: number;
  benchIndices?: number[];
  boardCells?: number[];
}

export type LoggedPrepCommandPayload = CommandPayload & {
  mergeUnits?: MergeUnitsPayload;
};

export function buildPrepCommandPayload(
  message: PrepCommandMessage,
): CommandPayload | undefined {
  if (
    message.boardUnitCount === undefined &&
    message.boardPlacements === undefined &&
    message.xpPurchaseCount === undefined &&
    message.shopRefreshCount === undefined &&
    message.shopBuySlotIndex === undefined &&
    message.shopLock === undefined &&
    message.benchToBoardCell === undefined &&
    message.boardToBenchCell === undefined &&
    message.benchSellIndex === undefined &&
    message.boardSellIndex === undefined &&
    message.bossShopBuySlotIndex === undefined
  ) {
    return undefined;
  }

  return {
    ...(message.boardUnitCount !== undefined && { boardUnitCount: message.boardUnitCount }),
    ...(message.boardPlacements !== undefined && { boardPlacements: message.boardPlacements }),
    ...(message.xpPurchaseCount !== undefined && { xpPurchaseCount: message.xpPurchaseCount }),
    ...(message.shopRefreshCount !== undefined && { shopRefreshCount: message.shopRefreshCount }),
    ...(message.shopBuySlotIndex !== undefined && { shopBuySlotIndex: message.shopBuySlotIndex }),
    ...(message.shopLock !== undefined && { shopLock: message.shopLock }),
    ...(message.benchToBoardCell !== undefined && { benchToBoardCell: message.benchToBoardCell }),
    ...(message.boardToBenchCell !== undefined && { boardToBenchCell: message.boardToBenchCell }),
    ...(message.benchSellIndex !== undefined && { benchSellIndex: message.benchSellIndex }),
    ...(message.boardSellIndex !== undefined && { boardSellIndex: message.boardSellIndex }),
    ...(message.bossShopBuySlotIndex !== undefined && { bossShopBuySlotIndex: message.bossShopBuySlotIndex }),
  };
}
