import type { BattleUnit } from "../server/combat/battle-simulator";
import {
  sharedBoardIndexToCoordinate,
  sharedBoardManhattanDistance,
} from "../shared/board-geometry";
import type { BoardUnitType } from "../shared/types";

export interface Hero {
  id: string;
  name: string;
  role: 'tank' | 'dps' | 'support' | 'control' | 'balance' | 'economy';
  synergyBonusType: BoardUnitType;
  hp: number;
  attack: number;
  skill: {
    name: string;
    description: string;
    effect: (caster: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], log: string[]) => void;
  };
}

export const HEROES: Hero[] = [
  // バランス型 - 防御バフ
  {
    id: 'reimu',
    name: '霊夢',
    role: 'balance',
    synergyBonusType: 'vanguard',
    hp: 120,
    attack: 18,
    skill: {
      name: '夢符「二重結界」',
      description: '味方全体に防御バフ（被ダメージ-20%）',
      effect: (caster, allies, _enemies, log) => {
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.defenseMultiplier *= 1.2;
          }
        }
        log.push(`${caster.type} activates 夢符「二重結界」! All allies gain +20% defense`);
      },
    },
  },
  // パワー型 - 全体魔法
  {
    id: 'marisa',
    name: '魔理沙',
    role: 'dps',
    synergyBonusType: 'ranger',
    hp: 100,
    attack: 25,
    skill: {
      name: '恋符「マスタースパーク」',
      description: '全敵に強力な魔法ダメージ（ATK × 3.0）',
      effect: (caster, _allies, enemies, log) => {
        const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 3.0);
        for (const enemy of enemies) {
          if (!enemy.isDead) {
            enemy.hp -= damage;
          }
        }
        log.push(`${caster.type} activates 恋符「マスタースパーク」! Deals ${damage} damage to all enemies`);
      },
    },
  },
  // サポート - 攻撃バフ
  {
    id: 'okina',
    name: '隠岐奈',
    role: 'support',
    synergyBonusType: 'mage',
    hp: 110,
    attack: 16,
    skill: {
      name: '秘神「裏表の逆転」',
      description: '味方全体に攻撃力バフ（与ダメージ+25%）',
      effect: (caster, allies, _enemies, log) => {
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.attackMultiplier *= 1.25;
          }
        }
        log.push(`${caster.type} activates 秘神「裏表の逆転」! All allies gain +25% attack`);
      },
    },
  },
  // タンク - ダメージ軽減
  {
    id: 'keiki',
    name: '袿姫',
    role: 'tank',
    synergyBonusType: 'vanguard',
    hp: 180,
    attack: 12,
    skill: {
      name: '埴安神「偶像の加護」',
      description: '自身の被ダメージ-40%、周囲の味方に被ダメージ-15%',
      effect: (caster, allies, _enemies, log) => {
        // 自身に大防御バフ
        caster.buffModifiers.defenseMultiplier *= 1.4;
        
        // 周囲（同セル〜隣接）の味方に小防御バフ
        for (const ally of allies) {
          if (!ally.isDead && ally !== caster) {
            const distance = sharedBoardManhattanDistance(
              sharedBoardIndexToCoordinate(ally.cell),
              sharedBoardIndexToCoordinate(caster.cell),
            );
            if (distance <= 1) {
              ally.buffModifiers.defenseMultiplier *= 1.15;
            }
          }
        }
        log.push(`${caster.type} activates 埴安神「偶像の加護」! +40% self defense, +15% nearby allies defense`);
      },
    },
  },
  // 経済型 - ゴールドボーナス（戦闘効果のみ、ゴールド加算は別途実装予定）
  {
    id: 'megumu',
    name: '女苑',
    role: 'economy',
    synergyBonusType: 'assassin',
    hp: 90,
    attack: 14,
    skill: {
      name: '吉凶「星の導き」',
      description: '味方全体に攻撃バフ（与ダメージ+15%）。※ゴールドボーナス効果は後で実装予定',
      effect: (caster, allies, _enemies, log) => {
        // 味方全体に攻撃バフ
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.attackMultiplier *= 1.15;
          }
        }
        log.push(`${caster.type} activates 吉凶「星の導き」! All allies gain +15% attack`);
      },
    },
  },
];
