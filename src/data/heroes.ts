import type { BattleUnit } from "../server/combat/battle-simulator";

export interface Hero {
  id: string;
  name: string;
  role: 'tank' | 'dps' | 'support' | 'control';
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
      name: '夢符「二重結界」',
      description: '味方全体に防御バフを付与（与ダメージ-20%, 被ダメージ+10%）',
      effect: (caster, allies, _enemies, log) => {
        // 味方全員に防御バフ（簡易化実装）
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.defenseMultiplier *= 1.2;
          }
        }
        log.push(`${caster.type} activates 夢符「二重結界」! All allies gain +20% defense`);
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
      name: '恋符「マスタースパーク」',
      description: '直線に強力な魔法ダメージ（ATK × 3.0）',
      effect: (caster, _allies, enemies, log) => {
        // 全敵に魔法ダメージ（ATK × 3.0）
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
  {
    id: 'sanae',
    name: '早苗',
    role: 'support',
    hp: 110,
    attack: 18,
    skill: {
      name: '奇跡「神の風」',
      description: '味方全体に攻撃力バフと防御バフ（攻撃速度+25%, 被ダメージ-10%）',
      effect: (caster, allies, _enemies, log) => {
        // 味方全員に攻撃力バフと防御バフ
        for (const ally of allies) {
          if (!ally.isDead) {
            ally.buffModifiers.attackMultiplier *= 1.25;
            ally.buffModifiers.defenseMultiplier *= 1.1;
          }
        }
        log.push(`${caster.type} activates 奇跡「神の風」! All allies gain +25% attack and +10% defense`);
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
      name: '人符「現世斬」',
      description: 'ターゲットに3連撃（ATK × 1.2 × 3）',
      effect: (caster, _allies, enemies, log) => {
        // HPが最も低い敵に3連撃（ATK × 1.2 × 3）
        const livingEnemies = enemies.filter(e => !e.isDead);
        if (livingEnemies.length > 0) {
          const target = livingEnemies.reduce((lowest, e) => e.hp < lowest.hp ? e : lowest);
          const singleDamage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 1.2);
          const totalDamage = singleDamage * 3;
          target.hp -= totalDamage;
          log.push(`${caster.type} activates 人符「現世斬」! Deals ${totalDamage} damage (3 hits) to ${target.type}`);
        }
      },
    },
  },
  {
    id: 'sakuya',
    name: '咲夜',
    role: 'control',
    hp: 110,
    attack: 20,
    skill: {
      name: '時符「プライベートスクウェア」',
      description: '範囲内の敵の移動速度-60%、攻撃速度-30%（3秒間）',
      effect: (caster, _allies, enemies, log) => {
        // 最も敵が密集している地点を中心に、半径2マスの円形範囲内の敵にデバフを適用
        // 現在のシステムでは移動速度は実装されていないため、攻撃速度減少のみ適用
        const livingEnemies = enemies.filter(e => !e.isDead);
        if (livingEnemies.length === 0) return;

        // 各セルの敵の数をカウントして、最も密集しているセルを探す
        const cellCounts: Record<number, number> = {};
        for (const enemy of livingEnemies) {
          cellCounts[enemy.cell] = (cellCounts[enemy.cell] || 0) + 1;
        }

        let maxCount = 0;
        let centerCell = livingEnemies[0]?.cell ?? 0;
        for (const [cell, count] of Object.entries(cellCounts)) {
          if (count > maxCount) {
            maxCount = count;
            centerCell = parseInt(cell, 10);
          }
        }

        // 半径2マス以内の敵を検索してデバフを適用
        const radius = 2;
        const affectedEnemies: BattleUnit[] = [];
        for (const enemy of livingEnemies) {
          const distance = Math.abs(enemy.cell - centerCell);
          if (distance <= radius) {
            // 攻撃速度 -30% (3秒間)
            // 注: 現在のシステムでは永続的なバフのみ実装されているため、即座に適用
            // 将来的にはデバフ持続時間の管理機能が必要
            enemy.buffModifiers.attackSpeedMultiplier *= 0.7;
            affectedEnemies.push(enemy);
          }
        }

        if (affectedEnemies.length > 0) {
          log.push(`${caster.type} activates 時符「プライベートスクウェア」! ${affectedEnemies.length} enemies slowed by -30% attack speed at cell ${centerCell}`);
          // 注: 移動速度 -60% は将来的な実装待ち
        }
      },
    },
  },
];
