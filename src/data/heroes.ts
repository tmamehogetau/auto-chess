import type { BattleUnit } from "../server/combat/battle-simulator";

export interface Hero {
  id: string;
  name: string;
  role: 'tank' | 'dps' | 'support';
  hp: number;
  attack: number;
  skill: {
    name: string;
    description: string;
    effect: (caster: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], log: string[]) => void;
  };
}

export const HEROES: Hero[] = [
  {
    id: 'reimu',
    name: '霊夢',
    role: 'support',
    hp: 120,
    attack: 15,
    skill: {
      name: '博麗結界',
      description: '味方全体に防御バフを付与（与ダメージ-20%, 被ダメージ+10%）',
      effect: (caster, allies, _enemies, log) => {
        // 味方全員に防御バフ（簡易化実装）
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.defenseMultiplier *= 1.2;
          }
        }
        log.push(`${caster.type} activates 博麗結界! All allies gain +20% defense`);
      },
    },
  },
  {
    id: 'marisa',
    name: '魔理沙',
    role: 'dps',
    hp: 100,
    attack: 25,
    skill: {
      name: 'マスタースパーク',
      description: '直線に強力な魔法ダメージ（ATK × 3.0）',
      effect: (caster, _allies, enemies, log) => {
        // 全敵に魔法ダメージ（ATK × 3.0）
        const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 3.0);
        for (const enemy of enemies) {
          if (!enemy.isDead) {
            enemy.hp -= damage;
          }
        }
        log.push(`${caster.type} activates マスタースパーク! Deals ${damage} damage to all enemies`);
      },
    },
  },
  {
    id: 'sanae',
    name: '早苗',
    role: 'support',
    hp: 110,
    attack: 18,
    skill: {
      name: '奇跡『神風の祝福』',
      description: '味方全体に攻撃力バフと防御バフ（攻撃速度+25%, 被ダメージ-10%）',
      effect: (caster, allies, _enemies, log) => {
        // 味方全員に攻撃力バフと防御バフ
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.attackMultiplier *= 1.25;
            ally.buffModifiers.defenseMultiplier *= 1.1;
          }
        }
        log.push(`${caster.type} activates 奇跡『神風の祝福』! All allies gain +25% attack and +10% defense`);
      },
    },
  },
  {
    id: 'youmu',
    name: '妖夢',
    role: 'dps',
    hp: 130,
    attack: 22,
    skill: {
      name: '人符『現世斬』',
      description: 'ターゲットに3連撃（ATK × 1.2 × 3）',
      effect: (caster, _allies, enemies, log) => {
        // HPが最も低い敵に3連撃（ATK × 1.2 × 3）
        const livingEnemies = enemies.filter(e => !e.isDead);
        if (livingEnemies.length > 0) {
          const target = livingEnemies.reduce((lowest, e) => e.hp < lowest.hp ? e : lowest);
          const singleDamage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 1.2);
          const totalDamage = singleDamage * 3;
          target.hp -= totalDamage;
          log.push(`${caster.type} activates 人符『現世斬』! Deals ${totalDamage} damage (3 hits) to ${target.type}`);
        }
      },
    },
  },
];
