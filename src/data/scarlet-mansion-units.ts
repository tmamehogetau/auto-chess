/**
 * Scarlet Devil Mansion Units (紅魔館ユニット)
 * 
 * Boss Exclusive Shop専用のユニット定義
 * レミリアの幼きデーモンロードパッシブによりboss側支援を受ける
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
  /** 戦闘中のクラス判定 */
  combatClass?: BoardUnitType;
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
    combatClass: "vanguard",
    cost: 2,
    hp: 860,
    attack: 55,
    attackSpeed: 0.8,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: approximateLegacyDamageReduction({
      defense: 15,
      physicalReduction: 12,
      magicReduction: 12,
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
    combatClass: "assassin",
    cost: 3,
    hp: 650,
    attack: 78,
    attackSpeed: 1.05,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 2,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: approximateLegacyDamageReduction({
      defense: 5,
      physicalReduction: 5,
      magicReduction: 5,
    }),
    role: "単体制御",
    skillDescription: "時符「プライベートスクウェア」- 攻撃力の高い敵1体の攻撃速度と移動速度を低下",
    flavorText: "紅魔館のメイド長。完璧で瀟洒な仕事人。",
  },
  {
    id: "patchouli",
    unitId: "patchouli",
    displayName: "パチュリー・ノーレッジ",
    unitType: "mage",
    combatClass: "mage",
    cost: 4,
    hp: 500,
    attack: 86,
    attackSpeed: 0.75,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 4,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: approximateLegacyDamageReduction({
      defense: 4,
      physicalReduction: 0,
      magicReduction: 8,
    }),
    role: "爆発補助",
    skillDescription: "日符「ロイヤルフレア」- 激重発動で自身の周囲3マスに大ダメージ",
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
