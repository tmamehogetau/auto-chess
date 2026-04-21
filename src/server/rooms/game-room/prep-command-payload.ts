import type { PrepCommandMessage } from "../../../shared/room-messages";
import type { CommandPayload } from "../../match-room-controller/prep-command-validator";

export interface MergeUnitsPayload {
  unitType: string;
  unitLevel?: number;
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
    message.heroPlacementCell === undefined &&
    message.specialUnitUpgradeCount === undefined &&
    message.shopRefreshCount === undefined &&
    message.shopBuySlotIndex === undefined &&
    message.shopLock === undefined &&
    message.benchToBoardCell === undefined &&
    message.boardToBenchCell === undefined &&
    message.boardUnitMove === undefined &&
    message.subUnitToBenchCell === undefined &&
    message.subUnitMove === undefined &&
    message.subUnitSwapBench === undefined &&
    message.benchSellIndex === undefined &&
    message.boardSellIndex === undefined &&
    message.mergeUnits === undefined &&
    message.heroExclusiveShopBuySlotIndex === undefined &&
    message.bossShopBuySlotIndex === undefined
  ) {
    return undefined;
  }

  return {
    ...(message.boardUnitCount !== undefined && { boardUnitCount: message.boardUnitCount }),
    ...(message.boardPlacements !== undefined && { boardPlacements: message.boardPlacements }),
    ...(message.heroPlacementCell !== undefined && { heroPlacementCell: message.heroPlacementCell }),
    ...(message.specialUnitUpgradeCount !== undefined && {
      specialUnitUpgradeCount: message.specialUnitUpgradeCount,
    }),
    ...(message.shopRefreshCount !== undefined && { shopRefreshCount: message.shopRefreshCount }),
    ...(message.shopBuySlotIndex !== undefined && { shopBuySlotIndex: message.shopBuySlotIndex }),
    ...(message.shopLock !== undefined && { shopLock: message.shopLock }),
    ...(message.benchToBoardCell !== undefined && { benchToBoardCell: message.benchToBoardCell }),
    ...(message.boardToBenchCell !== undefined && { boardToBenchCell: message.boardToBenchCell }),
    ...(message.boardUnitMove !== undefined && { boardUnitMove: message.boardUnitMove }),
    ...(message.subUnitToBenchCell !== undefined && { subUnitToBenchCell: message.subUnitToBenchCell }),
    ...(message.subUnitMove !== undefined && { subUnitMove: message.subUnitMove }),
    ...(message.subUnitSwapBench !== undefined && { subUnitSwapBench: message.subUnitSwapBench }),
    ...(message.benchSellIndex !== undefined && { benchSellIndex: message.benchSellIndex }),
    ...(message.boardSellIndex !== undefined && { boardSellIndex: message.boardSellIndex }),
    ...(message.mergeUnits !== undefined && { mergeUnits: message.mergeUnits }),
    ...(message.heroExclusiveShopBuySlotIndex !== undefined && {
      heroExclusiveShopBuySlotIndex: message.heroExclusiveShopBuySlotIndex,
    }),
    ...(message.bossShopBuySlotIndex !== undefined && { bossShopBuySlotIndex: message.bossShopBuySlotIndex }),
  };
}
