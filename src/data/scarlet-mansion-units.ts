/**
 * Scarlet Devil Mansion Units (紅魔館ユニット)
 * 
 * Boss Exclusive Shop専用のユニット定義
 * 紅魔館シナジー: 2体以上出場でレミリアが強化
 */

import type { BoardUnitType } from "../shared/room-messages";
import type { UnitId } from "../shared/types";

export interface ScarletMansionUnit {
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
  /** HP */
  hp: number;
  /** 攻撃力 */
  attack: number;
  /** 攻撃速度 */
  attackSpeed: number;
  /** 射程 */
  range: number;
  /** 物理軽減率（0-100） */
  physicalReduction: number;
  /** 魔法軽減率（0-100） */
  magicReduction: number;
  /** 役割説明 */
  role: string;
  /** スキル説明 */
  skillDescription: string;
  /** フレーバーテキスト */
  flavorText: string;
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
    range: 1,
    physicalReduction: 20,
    magicReduction: 15,
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
    range: 2,
    physicalReduction: 10,
    magicReduction: 10,
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
    range: 4,
    physicalReduction: 5,
    magicReduction: 25,
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
