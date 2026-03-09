/**
 * 噂勢力 KPI サマリー
 * ログから派生したメトリクスを構築する純粋関数
 * 
 * Architecture:
 * - 責務を小さな純粋関数に分解
 * - 前計算で重複ロジックを排除
 * - opportunity key は (grantRoundIndex, playerId)
 * - rumor purchase action は grantRoundIndex = action.roundIndex - 1 で正規化
 */

import type { RoundSummaryLog, PlayerActionLog } from "../match-logger";

/**
 * 噂勢力 KPI サマリー型
 */
export interface RumorKpiSummary {
  /** 噂勢力確定枠が適用されたラウンド数（グローバル） */
  guaranteedRounds: number;
  /** 噂勢力ユニットの購入回数（グローバル） */
  rumorPurchaseCount: number;
  /** 購入率（購入回数 / guaranteed opportunities） */
  rumorPurchaseRate: number;
  /** 購入がなかった確定ラウンド数 */
  roundsWithoutPurchase: number;
  /** プレイヤー別確定ラウンド数 */
  perPlayerGuaranteedRounds: Record<string, number>;
  /** プレイヤー別購入回数 */
  perPlayerRumorPurchases: Record<string, number>;
}

/**
 * (grantRoundIndex, playerId) ペアを表すキー
 */
function makeOpportunityKey(grantRoundIndex: number, playerId: string): string {
  return `${grantRoundIndex}:${playerId}`;
}

/**
 * 全プレイヤーIDを収集
 */
function collectAllPlayerIds(
  roundLogs: RoundSummaryLog[],
  actionLogs: PlayerActionLog[],
): Set<string> {
  const playerIds = new Set<string>();
  
  for (const log of roundLogs) {
    if (log.grantedPlayerIds) {
      for (const playerId of log.grantedPlayerIds) {
        playerIds.add(playerId);
      }
    }
    for (const battle of log.battles) {
      playerIds.add(battle.leftPlayerId);
      playerIds.add(battle.rightPlayerId);
    }
    for (const playerId of log.eliminations) {
      playerIds.add(playerId);
    }
  }
  
  for (const log of actionLogs) {
    playerIds.add(log.playerId);
  }
  
  return playerIds;
}

/**
 * 確定ラウンドとgrantedPlayerIdsから全opportunityを構築
 * ボスはgrantedPlayerIdsに含まれないため自動的に除外される
 */
function buildOpportunities(
  roundLogs: RoundSummaryLog[],
): Set<string> {
  const opportunities = new Set<string>();
  
  for (const log of roundLogs) {
    if (log.guaranteedRumorSlotApplied === true && log.grantedPlayerIds) {
      for (const playerId of log.grantedPlayerIds) {
        opportunities.add(makeOpportunityKey(log.roundIndex, playerId));
      }
    }
  }
  
  return opportunities;
}

/**
 * プレイヤー別確定ラウンド数を計算
 * grantedPlayerIds を使用してボスを除外
 */
function calculatePerPlayerGuaranteedRounds(
  opportunities: Set<string>,
  playerIds: Set<string>,
): Record<string, number> {
  const result: Record<string, number> = {};
  
  // 全プレイヤーを初期化
  for (const playerId of playerIds) {
    result[playerId] = 0;
  }
  
  // opportunityからカウント
  for (const key of opportunities) {
    const [, playerId] = key.split(":");
    if (playerId !== undefined) {
      result[playerId] = (result[playerId] ?? 0) + 1;
    }
  }
  
  return result;
}

/**
 * 購入を集計
 * - grantRoundIndex = action.roundIndex - 1 で正規化
 * - 同じ(grantRoundIndex, playerId)での重複は1回とカウント
 */
function calculatePurchases(
  actionLogs: PlayerActionLog[],
  opportunities: Set<string>,
  playerIds: Set<string>,
): {
  purchaseCount: number;
  perPlayerPurchases: Record<string, number>;
  purchaseOpportunities: Set<string>;
} {
  const perPlayerPurchases: Record<string, number> = {};
  const purchaseOpportunities = new Set<string>();
  
  // 初期化
  for (const playerId of playerIds) {
    perPlayerPurchases[playerId] = 0;
  }
  
  for (const log of actionLogs) {
    if (log.actionType === "buy_unit" && log.details.isRumorUnit === true) {
      // purchase action は next Prep (round R+1) で記録される
      // grant round は R なので、正規化: grantRoundIndex = action.roundIndex - 1
      const grantRoundIndex = log.roundIndex - 1;
      const key = makeOpportunityKey(grantRoundIndex, log.playerId);
      
      // opportunity に存在する場合のみカウント（不正な購入は無視）
      if (opportunities.has(key) && !purchaseOpportunities.has(key)) {
        purchaseOpportunities.add(key);
        perPlayerPurchases[log.playerId] = (perPlayerPurchases[log.playerId] ?? 0) + 1;
      }
    }
  }
  
  return {
    purchaseCount: purchaseOpportunities.size,
    perPlayerPurchases,
    purchaseOpportunities,
  };
}

/**
 * roundsWithoutPurchase を計算
 * opportunities - purchase opportunities
 */
function calculateRoundsWithoutPurchase(
  opportunities: Set<string>,
  purchaseOpportunities: Set<string>,
): number {
  let count = 0;
  
  for (const key of opportunities) {
    if (!purchaseOpportunities.has(key)) {
      count++;
    }
  }
  
  return count;
}

/**
 * ログから噂勢力 KPI サマリーを構築する
 * 
 * @param roundLogs - ラウンドサマリーログ配列
 * @param actionLogs - プレイヤーアクションログ配列
 * @returns KPI サマリー
 */
export function buildRumorKpiSummary(
  roundLogs: RoundSummaryLog[],
  actionLogs: PlayerActionLog[],
): RumorKpiSummary {
  // Step 1: 前計算
  const opportunities = buildOpportunities(roundLogs);
  const playerIds = collectAllPlayerIds(roundLogs, actionLogs);
  
  // Step 2: 基本メトリクス
  const guaranteedRounds = new Set(
    roundLogs
      .filter(log => log.guaranteedRumorSlotApplied === true)
      .map(log => log.roundIndex)
  ).size;
  
  // Step 3: プレイヤー別確定ラウンド数
  const perPlayerGuaranteedRounds = calculatePerPlayerGuaranteedRounds(
    opportunities,
    playerIds,
  );
  
  // Step 4: 購入集計
  const { purchaseCount, perPlayerPurchases, purchaseOpportunities } = calculatePurchases(
    actionLogs,
    opportunities,
    playerIds,
  );
  
  // Step 5: roundsWithoutPurchase
  const roundsWithoutPurchase = calculateRoundsWithoutPurchase(
    opportunities,
    purchaseOpportunities,
  );
  
  // Step 6: opportunity-based rate
  const totalOpportunities = opportunities.size;
  
  const rumorPurchaseRate = totalOpportunities > 0
    ? purchaseCount / totalOpportunities
    : 0;
  
  return {
    guaranteedRounds,
    rumorPurchaseCount: purchaseCount,
    rumorPurchaseRate,
    roundsWithoutPurchase,
    perPlayerGuaranteedRounds,
    perPlayerRumorPurchases: perPlayerPurchases,
  };
}
