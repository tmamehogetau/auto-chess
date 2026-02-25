import type { BoardUnitType } from "../shared/room-messages";

/**
 * 星レベルシステムの設定定数
 * 星上げ（スターアップ）システムの全設定を一元管理
 */

/** 最大星レベル（★1〜★3） */
export const STAR_LEVEL_MAX = 3;

/** 最小星レベル */
export const STAR_LEVEL_MIN = 1;

/** 星上げに必要な同種ユニット数（3体合成） */
export const STAR_MERGE_THRESHOLD = 3;

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
 * 星レベルに応じて累積（★2は3体分、★3は9体分）
 */
export const UNIT_SELL_VALUE_BY_TYPE: Readonly<Record<BoardUnitType, number>> = {
  vanguard: 1,
  ranger: 1,
  mage: 2,
  assassin: 2,
};

/**
 * 売却値を計算
 * @param baseValue 基本売却値（購入時のコスト累積値）
 * @param unitType ユニットタイプ（フォールバック用）
 * @returns 最終的な売却値
 */
export function calculateSellValue(
  baseValue: number,
  unitType: BoardUnitType,
): number {
  if (baseValue > 0) {
    return baseValue;
  }
  // フォールバック: タイプ別基本値
  return UNIT_SELL_VALUE_BY_TYPE[unitType] ?? 1;
}
