/**
 * Rumor Influence Units (噂勢力ユニット)
 * 
 * Phase成功時の報酬: 次ラウンドのショップに該当ユニットが
 * 最低1体確定で出現する
 */

import type { BoardUnitType } from "../shared/room-messages";
import type { UnitId } from "../shared/types";

export interface RumorUnit {
  /** 対象ラウンド（このラウンドの次に出現） */
  targetRound: number;
  /** stable unitId */
  unitId: UnitId;
  /** ユニットタイプ */
  unitType: BoardUnitType;
  /** レアリティ（1-3） */
  rarity: 1 | 2 | 3;
  /** 表示名（デバッグ/ログ用） */
  displayName: string;
  /** フレーバーテキスト */
  description: string;
}

/**
 * ラウンドごとの噂勢力ユニット定義
 * フェーズ成功時、次ラウンドのショップに最低1体確定出現
 */
export const RUMOR_UNITS_BY_ROUND: Readonly<Record<number, RumorUnit>> = {
  // 序盤: バランスの取れた前衛
  1: {
    targetRound: 1,
    unitId: "rumor_vanguard_r1",
    unitType: "vanguard",
    rarity: 1,
    displayName: "噂の先鋒",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  2: {
    targetRound: 2,
    unitId: "rumor_ranger_r2",
    unitType: "ranger",
    rarity: 1,
    displayName: "噂の射手",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  3: {
    targetRound: 3,
    unitId: "rumor_vanguard_r3",
    unitType: "vanguard",
    rarity: 1,
    displayName: "噂の先鋒",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  4: {
    targetRound: 4,
    unitId: "rumor_mage_r4",
    unitType: "mage",
    rarity: 2,
    displayName: "噂の術師",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  // 中盤: やや強めのユニット
  5: {
    targetRound: 5,
    unitId: "rumor_assassin_r5",
    unitType: "assassin",
    rarity: 2,
    displayName: "噂の刺客",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  6: {
    targetRound: 6,
    unitId: "rumor_mage_r6",
    unitType: "mage",
    rarity: 2,
    displayName: "噂の術師",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  7: {
    targetRound: 7,
    unitId: "rumor_ranger_r7",
    unitType: "ranger",
    rarity: 2,
    displayName: "噂の射手",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  8: {
    targetRound: 8,
    unitId: "rumor_assassin_r8",
    unitType: "assassin",
    rarity: 2,
    displayName: "噂の刺客",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  // 終盤: レアユニット
  9: {
    targetRound: 9,
    unitId: "rumor_mage_r9",
    unitType: "mage",
    rarity: 3,
    displayName: "噂の大術師",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  10: {
    targetRound: 10,
    unitId: "rumor_assassin_r10",
    unitType: "assassin",
    rarity: 3,
    displayName: "噂の暗殺者",
    description: "フェーズ成功の報酬としてショップに出現",
  },
  11: {
    targetRound: 11,
    unitId: "rumor_mage_r11",
    unitType: "mage",
    rarity: 3,
    displayName: "噂の大術師",
    description: "フェーズ成功の報酬としてショップに出現",
  },
};

/**
 * 指定ラウンドの噂勢力ユニットを取得
 * @param round 現在のラウンド（次ラウンドの出現判定用）
 * @returns 噂勢力ユニット、存在しない場合はnull
 */
export function getRumorUnitForRound(round: number): RumorUnit | null {
  return RUMOR_UNITS_BY_ROUND[round] ?? null;
}

/**
 * 噂勢力ユニットのコストを取得
 * @param rarity レアリティ
 * @returns コスト（1-3）
 */
export function getRumorUnitCost(rarity: 1 | 2 | 3): number {
  return rarity;
}
