import type { MatchLogger } from "../../match-logger";
import type { LoggedPrepCommandPayload } from "./prep-command-payload";

export interface PrepCommandLoggingDeps {
  logger: MatchLogger | null;
  getShopOffers: (sessionId: string) => Array<{ unitType: string; cost: number; isRumorUnit?: boolean }> | undefined;
  getBossShopOffers: (sessionId: string) => Array<{ unitType: string; cost: number }> | undefined;
  getRoundIndex: () => number;
  getPlayerGold: (sessionId: string) => number;
}

export interface LogPrepCommandActionsOptions {
  shopOffersSnapshot?: Array<{ unitType: string; cost: number; isRumorUnit?: boolean }> | undefined;
}

/**
 * Prepコマンドのアクションをログに記録する
 * @param sessionId - プレイヤーセッションID
 * @param commandPayload - コマンドペイロード
 * @param deps - 依存関係（logger, controller accessors）
 * @param options - オプション（shopOffersSnapshot: submit前のショップ状態を使用）
 */
export function logPrepCommandActions(
  sessionId: string,
  commandPayload: LoggedPrepCommandPayload | undefined,
  deps: PrepCommandLoggingDeps,
  options?: LogPrepCommandActionsOptions,
): void {
  if (!deps.logger || !commandPayload) {
    return;
  }

  const goldBefore = deps.getPlayerGold(sessionId);
  const roundIndex = deps.getRoundIndex();

  if (commandPayload.shopBuySlotIndex !== undefined) {
    const offers = options?.shopOffersSnapshot ?? deps.getShopOffers(sessionId);
    const offer = offers?.[commandPayload.shopBuySlotIndex];
    if (offer) {
      deps.logger.logAction(sessionId, roundIndex, "buy_unit", {
        unitType: offer.unitType,
        cost: offer.cost,
        ...(offer.isRumorUnit === true && { isRumorUnit: true }),
        goldBefore,
        goldAfter: goldBefore - offer.cost,
      });
    }
  }

  if (commandPayload.benchSellIndex !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "sell_unit", {
      benchIndex: commandPayload.benchSellIndex,
      goldBefore,
      goldAfter: goldBefore + 1,
    });
  }

  if (commandPayload.benchToBoardCell !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "deploy", {
      benchIndex: commandPayload.benchToBoardCell.benchIndex,
      toCell: commandPayload.benchToBoardCell.cell,
      goldBefore,
      goldAfter: goldBefore,
    });
  }

  if (commandPayload.boardToBenchCell !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "undeploy", {
      cell: commandPayload.boardToBenchCell.cell,
      goldBefore,
      goldAfter: goldBefore,
    });
  }

  if (commandPayload.shopRefreshCount !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "shop_refresh", {
      itemCount: commandPayload.shopRefreshCount,
      goldBefore,
      goldAfter: goldBefore - 2,
    });
  }

  if (commandPayload.xpPurchaseCount !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "buy_xp", {
      itemCount: commandPayload.xpPurchaseCount,
      goldBefore,
      goldAfter: goldBefore - 4,
    });
  }

  if (commandPayload.boardSellIndex !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "board_sell", {
      cell: commandPayload.boardSellIndex,
      goldBefore,
      goldAfter: goldBefore + 1,
    });
  }

  if (commandPayload.bossShopBuySlotIndex !== undefined) {
    const bossOffers = deps.getBossShopOffers(sessionId);
    const offer = bossOffers?.[commandPayload.bossShopBuySlotIndex];
    if (offer) {
      deps.logger.logAction(sessionId, roundIndex, "buy_boss_unit", {
        unitType: offer.unitType,
        cost: offer.cost,
        goldBefore,
        goldAfter: goldBefore - offer.cost,
      });
    }
  }

  if (commandPayload.shopLock !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "shop_lock", {
      locked: commandPayload.shopLock,
      goldBefore,
      goldAfter: goldBefore,
    });
  }

  if (commandPayload.mergeUnits !== undefined) {
    deps.logger.logAction(sessionId, roundIndex, "merge", {
      unitType: commandPayload.mergeUnits.unitType,
      starLevel: commandPayload.mergeUnits.starLevel,
      ...(commandPayload.mergeUnits.benchIndices !== undefined && {
        benchIndices: commandPayload.mergeUnits.benchIndices,
      }),
      ...(commandPayload.mergeUnits.boardCells !== undefined && {
        boardCells: commandPayload.mergeUnits.boardCells,
      }),
      goldBefore,
      goldAfter: goldBefore,
    });
  }
}
