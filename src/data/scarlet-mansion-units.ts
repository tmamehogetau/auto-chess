/**
 * Scarlet Devil Mansion Units (紅魔館ユニット)
 * 
 * Boss Exclusive Shop専用のユニット定義
 * 紅魔館シナジー: 2体以上出場でレミリアが強化
 */

import type { BoardUnitType } from "../shared/room-messages";
import { DEFAULT_MOVEMENT_SPEED, type CombatStats, type UnitId } from "../shared/types";

export interface ScarletMansionUnit extends CombatStats {
  /** ユニットID */
  id: string;
  /** stable unitId */
  unitId: UnitId;
  /** 表示名 */
  displayName: string;
  /** ユニットタイプ（通常のBoardUnitTypeとは別枠） */
  unitType: BoardUnitType;
  /** コスト（2G-4G） */
  cost: 2 | 3 | 4;
  /** 役割説明 */
  role: string;
  /** スキル説明 */
  skillDescription: string;
  /** フレーバーテキスト */
  flavorText: string;
}

function approximateLegacyDamageReduction(input: {
  defense: number;
  physicalReduction: number;
  magicReduction: number;
}): number {
  const representativeIncomingDamage = 60;
  const flatReductionShare = Math.min(0.8, Math.max(0, input.defense) / representativeIncomingDamage);
  const reductionShare = Math.max(
    0,
    Math.min(1, (input.physicalReduction + input.magicReduction) / 200),
  );

  return Math.round((1 - (1 - flatReductionShare) * (1 - reductionShare)) * 100);
}

/**
 * 紅魔館ユニット定義
 * ボス専用ショップで購入可能
 */
export const SCARLET_MANSION_UNITS: Readonly<ScarletMansionUnit[]> = [
  {
    id: "meiling",
    unitId: "meiling",
    displayName: "紅美鈴",
    unitType: "vanguard",
    cost: 2,
    hp: 850,
    attack: 65,
    attackSpeed: 0.85,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: approximateLegacyDamageReduction({
      defense: 17.5,
      physicalReduction: 20,
      magicReduction: 15,
    }),
    role: "序盤の壁",
    skillDescription: "彩華「虹色太極拳」- 周囲の敵攻撃を誘引し、被ダメージを軽減",
    flavorText: "紅魔館の門番。悠々自適に勤務中。",
  },
  {
    id: "sakuya",
    unitId: "sakuya",
    displayName: "十六夜咲夜",
    unitType: "assassin",
    cost: 3,
    hp: 720,
    attack: 95,
    attackSpeed: 1.15,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 2,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: approximateLegacyDamageReduction({
      defense: 10,
      physicalReduction: 10,
      magicReduction: 10,
    }),
    role: "守護サポート",
    skillDescription: "幻幽「ジャック・ザ・ルドビレ」- 最もHPの低い味方を守護し、被ダメージを肩代わり",
    flavorText: "紅魔館のメイド長。完璧で瀟洒な仕事人。",
  },
  {
    id: "patchouli",
    unitId: "patchouli",
    displayName: "パチュリー・ノーレッジ",
    unitType: "mage",
    cost: 4,
    hp: 600,
    attack: 140,
    attackSpeed: 0.75,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 4,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: approximateLegacyDamageReduction({
      defense: 15,
      physicalReduction: 5,
      magicReduction: 25,
    }),
    role: "爆発補助",
    skillDescription: "火水木金土符「賢者の石」- ランダムな敵3体に大魔法ダメージ",
    flavorText: "紅魔館の魔法使い。動きたくない。",
  },
] as const;

/**
 * コスト別の紅魔館ユニットを取得
 * @param cost コスト（2-4）
 * @returns 該当コストのユニット配列
 */
export function getScarletMansionUnitsByCost(cost: 2 | 3 | 4): ScarletMansionUnit[] {
  return SCARLET_MANSION_UNITS.filter((unit) => unit.cost === cost);
}

/**
 * 全紅魔館ユニットを取得
 * @returns 全ユニット配列
 */
export function getAllScarletMansionUnits(): readonly ScarletMansionUnit[] {
  return SCARLET_MANSION_UNITS;
}

/**
 * ユニットIDから紅魔館ユニットを取得
 * @param id ユニットID
 * @returns ユニット、存在しない場合はnull
 */
export function getScarletMansionUnitById(id: string): ScarletMansionUnit | null {
  return SCARLET_MANSION_UNITS.find((unit) => unit.id === id) ?? null;
}

/**
 * ランダムな紅魔館ユニットを取得
 * @returns ランダムなユニット
 */
export function getRandomScarletMansionUnit(): ScarletMansionUnit {
  const index = Math.floor(Math.random() * SCARLET_MANSION_UNITS.length);
  return SCARLET_MANSION_UNITS[index] ?? SCARLET_MANSION_UNITS[0]!;
}
