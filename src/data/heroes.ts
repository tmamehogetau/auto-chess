import type { BattleUnit } from "../server/combat/battle-simulator";
import {
  type BoardCoordinate,
  sharedBoardIndexToCoordinate,
  sharedBoardManhattanDistance,
} from "../shared/board-geometry";
import { DEFAULT_MOVEMENT_SPEED, type BoardUnitType, type CombatStats } from "../shared/types";

const DEFAULT_MELEE_MOVEMENT_SPEED = DEFAULT_MOVEMENT_SPEED * 2;

function buildLineCoordinates(from: BoardCoordinate, to: BoardCoordinate): BoardCoordinate[] {
  const coordinates: BoardCoordinate[] = [];
  let currentX = from.x;
  let currentY = from.y;
  const deltaX = Math.abs(to.x - from.x);
  const stepX = from.x < to.x ? 1 : -1;
  const deltaY = -Math.abs(to.y - from.y);
  const stepY = from.y < to.y ? 1 : -1;
  let error = deltaX + deltaY;

  while (true) {
    coordinates.push({ x: currentX, y: currentY });

    if (currentX === to.x && currentY === to.y) {
      return coordinates;
    }

    const doubledError = error * 2;
    if (doubledError >= deltaY) {
      error += deltaY;
      currentX += stepX;
    }
    if (doubledError <= deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }
}

function getUnitsOnBeamLine(caster: BattleUnit, primaryTarget: BattleUnit, enemies: BattleUnit[]): BattleUnit[] {
  const from = sharedBoardIndexToCoordinate(caster.cell);
  const to = sharedBoardIndexToCoordinate(primaryTarget.cell);
  const lineCoordinates = buildLineCoordinates(from, to);
  const lineSet = new Set(lineCoordinates.map((coordinate) => `${coordinate.x},${coordinate.y}`));

  return enemies.filter((enemy) => {
    if (enemy.isDead) {
      return false;
    }

    const coordinate = sharedBoardIndexToCoordinate(enemy.cell);
    return lineSet.has(`${coordinate.x},${coordinate.y}`);
  });
}

export interface Hero extends CombatStats {
  id: string;
  name: string;
  role: 'tank' | 'dps' | 'support' | 'control' | 'balance' | 'economy';
  unitType: BoardUnitType;
  synergyBonusType: BoardUnitType;
  skill: {
    name: string;
    description: string;
    effect: (caster: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], log: string[]) => void;
  };
}

// Hero combat stats are intentionally tuned around low-to-mid cost shop units.
// They should survive long enough to express role identity without eclipsing bought units.
export const HEROES: Hero[] = [
  // バランス型 - 防御バフ
  {
    id: 'reimu',
    name: '霊夢',
    role: 'balance',
    unitType: 'ranger',
    synergyBonusType: 'ranger',
    hp: 680,
    attack: 45,
    attackSpeed: 0.80,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 3,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
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
    unitType: 'mage',
    synergyBonusType: 'mage',
    hp: 400,
    attack: 60,
    attackSpeed: 0.85,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 4,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
    skill: {
      name: '恋符「マスタースパーク」',
      description: 'ターゲットとの直線上の敵に魔法ダメージ（ATK × 2.0）',
      effect: (caster, _allies, enemies, log) => {
        const primaryTarget = enemies.find((enemy) => !enemy.isDead);
        if (!primaryTarget) {
          return;
        }

        const targets = getUnitsOnBeamLine(caster, primaryTarget, enemies);
        if (targets.length === 0) {
          return;
        }

        for (const target of targets) {
          const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 2.0);
          target.hp -= damage;
        }

        log.push(`${caster.type} activates 恋符「マスタースパーク」! Hits ${targets.length} enemies`);
      },
    },
  },
  // サポート - 攻撃バフ
  {
    id: 'okina',
    name: '隠岐奈',
    role: 'support',
    unitType: 'mage',
    synergyBonusType: 'mage',
    hp: 540,
    attack: 40,
    attackSpeed: 0.7,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 4,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
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
  // サポート - ダメージ軽減
  {
    id: 'keiki',
    name: '袿姫',
    role: 'support',
    unitType: 'mage',
    synergyBonusType: 'mage',
    hp: 880,
    attack: 30,
    attackSpeed: 0.65,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 2,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
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
  // 火力型 - 累積ATKバフ
  {
    id: 'jyoon',
    name: '女苑',
    role: 'dps',
    unitType: 'vanguard',
    synergyBonusType: 'vanguard',
    hp: 500,
    attack: 35,
    attackSpeed: 1.4,
    movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
    skill: {
      name: '財符「黄金のトルネード」',
      description: '攻撃毎に自己ATK+10%累積（最大+50%）',
      effect: (caster, _allies, _enemies, log) => {
        const currentBonus = caster.buffModifiers.attackMultiplier;
        const maxBonus = 1.5;
        if (currentBonus < maxBonus) {
          caster.buffModifiers.attackMultiplier = Math.min(currentBonus + 0.1, maxBonus);
        }
        log.push(`${caster.type} activates 財符「黄金のトルネード」! ATK now x${caster.buffModifiers.attackMultiplier.toFixed(1)}`);
      },
    },
  },
  // サポート - 単体無効化（プレースホルダー）
  {
    id: 'yuiman',
    name: 'ユイマン・浅間',
    role: 'support',
    unitType: 'mage',
    synergyBonusType: 'mage',
    hp: 520,
    attack: 38,
    attackSpeed: 0.70,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 4,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
    skill: {
      name: '虚構「ディスコミュニケーション」',
      description: '最もHPの低い敵の攻撃を一時無効化（プレースホルダー）',
      effect: (caster, _allies, enemies, log) => {
        const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
        const target = livingEnemies.reduce<BattleUnit | null>((lowest, enemy) => {
          if (lowest == null || enemy.hp < lowest.hp) {
            return enemy;
          }
          return lowest;
        }, null);
        if (target?.debuffImmunityCategories?.includes("crowd_control")) {
          log.push(`${caster.type} activates 虚構「ディスコミュニケーション」! ${target.type} resisted the slow`);
          return;
        }
        if (target) {
          target.buffModifiers.attackSpeedMultiplier *= 0.5;
          log.push(`${caster.type} activates 虚構「ディスコミュニケーション」! Slowed ${target.type}`);
        }
      },
    },
  },
];
