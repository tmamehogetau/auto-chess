import type { BoardUnitType } from "../shared/room-messages";
import type { UnitProgressionBonusConfig } from "../shared/progression-bonus-types";
import { getStandardUnitProgressionBonusConfig as getTouhouStandardUnitProgressionBonusConfig } from "../data/touhou-units";

/**
 * 通常ユニット level 進行の設定定数
 */

/** 最大 unit level（Lv1〜Lv7） */
export const UNIT_LEVEL_MAX = 7;

/** 最小 unit level */
export const UNIT_LEVEL_MIN = 1;

/** 旧 tier 2 売却帯へ入る購入回数閾値 */
export const TIER_TWO_PURCHASE_THRESHOLD = 4;

/** 旧 tier 3 売却帯へ入る購入回数閾値 */
export const TIER_THREE_PURCHASE_THRESHOLD = 7;

const UNIT_LEVEL_COMBAT_MULTIPLIER_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 1.0,
  2: 1.15,
  3: 1.3,
  4: 1.7,
  5: 2.1,
  6: 2.5,
  7: 3.0,
};

const DEFAULT_UNIT_LEVEL_COMBAT_MULTIPLIER = 1.0;

/**
 * 購入回数から unit level を求める
 * 1回ごとに 1 level 上がり、Lv7 で打ち止め
 */
export function getUnitLevelForPurchaseCount(purchaseCount: number): number {
  if (!Number.isFinite(purchaseCount) || purchaseCount < 1) {
    return UNIT_LEVEL_MIN;
  }

  return Math.min(UNIT_LEVEL_MAX, Math.floor(purchaseCount));
}

/**
 * unit level に対応する最小購入回数を返す
 */
export function getMinimumPurchaseCountForUnitLevel(unitLevel: number): number {
  if (!Number.isFinite(unitLevel)) {
    return UNIT_LEVEL_MIN;
  }

  return Math.max(UNIT_LEVEL_MIN, Math.min(UNIT_LEVEL_MAX, Math.floor(unitLevel)));
}

/**
 * 戦闘力の unit level 倍率
 * @param unitLevel ユニットレベル（1〜7）
 * @returns 戦闘力に乗算する倍率
 */
export function getUnitLevelCombatMultiplier(unitLevel: number = UNIT_LEVEL_MIN): number {
  if (!Number.isFinite(unitLevel)) {
    return DEFAULT_UNIT_LEVEL_COMBAT_MULTIPLIER;
  }

  const normalizedLevel = Math.max(UNIT_LEVEL_MIN, Math.min(UNIT_LEVEL_MAX, Math.floor(unitLevel)));
  return UNIT_LEVEL_COMBAT_MULTIPLIER_BY_LEVEL[normalizedLevel] ?? DEFAULT_UNIT_LEVEL_COMBAT_MULTIPLIER;
}

export function getUnitLevelCombatMultiplierDelta(currentLevel: number): number {
  if (!Number.isFinite(currentLevel)) {
    return 0;
  }

  const normalizedCurrentLevel = Math.max(UNIT_LEVEL_MIN, Math.min(UNIT_LEVEL_MAX, Math.floor(currentLevel)));
  if (normalizedCurrentLevel >= UNIT_LEVEL_MAX) {
    return 0;
  }

  return getUnitLevelCombatMultiplier(normalizedCurrentLevel + 1)
    - getUnitLevelCombatMultiplier(normalizedCurrentLevel);
}

export function getStandardUnitProgressionBonusConfig(unitId: string): UnitProgressionBonusConfig {
  return getTouhouStandardUnitProgressionBonusConfig(unitId);
}

/**
 * ユニットタイプ別の基本売却値（Lv1時）
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
 * @param unitLevel 現在の tier
 * @param unitCount 購入回数
 * @returns 最終的な売却値
 */
export function calculateSellValue(
  totalPaidCost: number,
  unitType: BoardUnitType,
  unitLevel: number = UNIT_LEVEL_MIN,
  unitCount?: number,
): number {
  const trackedPurchaseCount = unitCount ?? getMinimumPurchaseCountForUnitLevel(unitLevel);
  const trackedSellTier = trackedPurchaseCount >= TIER_THREE_PURCHASE_THRESHOLD
    ? 3
    : trackedPurchaseCount >= TIER_TWO_PURCHASE_THRESHOLD
      ? 2
      : 1;
  const fallbackUnitCost = UNIT_SELL_VALUE_BY_TYPE[unitType] ?? 1;
  const baseUnitCost = totalPaidCost > 0 && trackedPurchaseCount > 0
    ? Math.max(1, Math.round(totalPaidCost / trackedPurchaseCount))
    : fallbackUnitCost;

  let formulaValue = 0;
  switch (trackedSellTier) {
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
