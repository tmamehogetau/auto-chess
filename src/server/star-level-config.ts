import type { BoardUnitType } from "../shared/room-messages";

/**
 * 星レベルシステムの設定定数
 * 星上げ（スターアップ）システムの全設定を一元管理
 */

/** 最大星レベル（★1〜★3） */
export const STAR_LEVEL_MAX = 3;

/** 最小星レベル */
export const STAR_LEVEL_MIN = 1;

/** 購入回数進行で tier 2 へ上がる閾値 */
export const TIER_TWO_PURCHASE_THRESHOLD = 4;

/** 購入回数進行で tier 3 へ上がる閾値 */
export const TIER_THREE_PURCHASE_THRESHOLD = 7;

/**
 * 購入回数から upgrade tier を求める
 * 1-3回: tier 1, 4-6回: tier 2, 7回以上: tier 3
 */
export function getUpgradeTierForPurchaseCount(purchaseCount: number): number {
  if (!Number.isFinite(purchaseCount) || purchaseCount < 1) {
    return STAR_LEVEL_MIN;
  }

  if (purchaseCount >= TIER_THREE_PURCHASE_THRESHOLD) {
    return STAR_LEVEL_MAX;
  }

  if (purchaseCount >= TIER_TWO_PURCHASE_THRESHOLD) {
    return 2;
  }

  return STAR_LEVEL_MIN;
}

/**
 * tier に対応する最小購入回数を返す
 */
export function getMinimumPurchaseCountForTier(starLevel: number): number {
  if (starLevel >= STAR_LEVEL_MAX) {
    return TIER_THREE_PURCHASE_THRESHOLD;
  }

  if (starLevel >= 2) {
    return TIER_TWO_PURCHASE_THRESHOLD;
  }

  return STAR_LEVEL_MIN;
}

/**
 * 戦闘力の星レベル倍率
 * @param starLevel 星レベル（1〜3）
 * @returns 戦闘力に乗算する倍率
 */
export function getStarCombatMultiplier(starLevel: number = STAR_LEVEL_MIN): number {
  if (starLevel < STAR_LEVEL_MIN || starLevel > STAR_LEVEL_MAX) {
    return STAR_LEVEL_MIN;
  }
  return starLevel;
}

/**
 * ユニットタイプ別の基本売却値（★1時）
 * tier ごとの最終売却値は別計算で調整し、ここでは基準コストを保持する
 */
export const UNIT_SELL_VALUE_BY_TYPE: Readonly<Record<BoardUnitType, number>> = {
  vanguard: 1,
  ranger: 1,
  mage: 2,
  assassin: 2,
};

/**
 * 売却値を計算
 * @param totalPaidCost 実際に支払った累積コスト
 * @param unitType ユニットタイプ
 * @param starLevel 現在の tier
 * @param unitCount 購入回数
 * @returns 最終的な売却値
 */
export function calculateSellValue(
  totalPaidCost: number,
  unitType: BoardUnitType,
  starLevel: number = STAR_LEVEL_MIN,
  unitCount?: number,
): number {
  const trackedPurchaseCount = unitCount ?? getMinimumPurchaseCountForTier(starLevel);
  const trackedTier = getUpgradeTierForPurchaseCount(trackedPurchaseCount);
  const baseUnitCost = UNIT_SELL_VALUE_BY_TYPE[unitType] ?? 1;

  let formulaValue = 0;
  switch (trackedTier) {
    case 3:
      formulaValue = 4 * baseUnitCost - 2;
      break;
    case 2:
      formulaValue = 2 * baseUnitCost - 1;
      break;
    default:
      formulaValue = baseUnitCost - 1;
      break;
  }

  const normalizedFormulaValue = Math.max(0, formulaValue);
  if (totalPaidCost > 0) {
    return Math.min(totalPaidCost, normalizedFormulaValue);
  }

  return normalizedFormulaValue;
}
