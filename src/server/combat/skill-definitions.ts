import type { BoardUnitType } from "../../shared/room-messages";
import {
  sharedBoardIndexToCoordinate,
  sharedBoardManhattanDistance,
} from "../../shared/board-geometry";
import type { BattleUnit } from "./battle-simulator";

export interface SkillEffect {
  name: string;
  triggerType: 'on_attack_count';  // N 回攻撃ごとにトリガー
  triggerCount: number;             // N の値
  execute: (caster: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], log: string[]) => void;
}

export interface HeroSkillEffect {
  name: string;
  triggerType: 'on_mana_full';      // マナ100到達でトリガー
  execute: (caster: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], log: string[]) => void;
}

function isDebuffedTarget(unit: BattleUnit): boolean {
  return unit.buffModifiers.attackMultiplier < 1
    || unit.buffModifiers.defenseMultiplier < 1
    || unit.buffModifiers.attackSpeedMultiplier < 1;
}

function calculateUltimateDamage(caster: BattleUnit, baseDamage: number, target?: BattleUnit): number {
  let damage = baseDamage * (caster.ultimateDamageMultiplier ?? 1);

  if (target && isDebuffedTarget(target)) {
    damage *= 1 + (caster.bonusDamageVsDebuffedTarget ?? 0);
  }

  return Math.floor(damage);
}

function calculateSharedBoardDistance(leftCell: number, rightCell: number): number {
  return sharedBoardManhattanDistance(
    sharedBoardIndexToCoordinate(leftCell),
    sharedBoardIndexToCoordinate(rightCell),
  );
}

function selectLowestHpTarget(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  return livingEnemies.reduce((best, enemy) => {
    if (enemy.hp !== best.hp) {
      return enemy.hp < best.hp ? enemy : best;
    }

    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const enemyDistance = calculateSharedBoardDistance(caster.cell, enemy.cell);
    if (enemyDistance !== bestDistance) {
      return enemyDistance < bestDistance ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function selectBestAreaCenter(caster: BattleUnit, enemies: BattleUnit[], radius: number): number | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  let bestCenter = livingEnemies[0]!.cell;
  let bestCount = -1;
  let bestCasterDistance = Infinity;

  for (const candidate of livingEnemies) {
    const affectedCount = livingEnemies.filter(
      (enemy) => calculateSharedBoardDistance(enemy.cell, candidate.cell) <= radius,
    ).length;
    const casterDistance = calculateSharedBoardDistance(caster.cell, candidate.cell);

    if (
      affectedCount > bestCount
      || (
        affectedCount === bestCount
        && (
          casterDistance < bestCasterDistance
          || (casterDistance === bestCasterDistance && candidate.cell < bestCenter)
        )
      )
    ) {
      bestCenter = candidate.cell;
      bestCount = affectedCount;
      bestCasterDistance = casterDistance;
    }
  }

  return bestCenter;
}

export const SKILL_DEFINITIONS: Record<BoardUnitType, SkillEffect> = {
  vanguard: {
    name: 'Shield Wall',
    triggerType: 'on_attack_count',
    triggerCount: 3,  // 3 回攻撃ごと
    execute: (caster, allies, _enemies, log) => {
      // 味方全員に残り戦闘中 +50% 防御力を付与
      for (const ally of allies) {
        if (!ally.isDead) {
          ally.buffModifiers.defenseMultiplier *= 1.5;
        }
      }
      log.push(`${caster.type} activates Shield Wall! All allies gain +50% defense`);
    }
  },
  ranger: {
    name: 'Precise Shot',
    triggerType: 'on_attack_count',
    triggerCount: 3,
    execute: (caster, _allies, enemies, log) => {
      // HP が最も低い敵に 2 倍攻撃ダメージを与える
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 2,
          target,
        );
        target.hp -= damage;
        log.push(`${caster.type} activates Precise Shot! Deals ${damage} damage to ${target.type}`);
      }
    }
  },
  mage: {
    name: 'Arcane Burst',
    triggerType: 'on_attack_count',
    triggerCount: 3,
    execute: (caster, _allies, enemies, log) => {
      // 全敵に 1.5 倍攻撃ダメージを与える
      for (const enemy of enemies) {
        if (!enemy.isDead) {
          const damage = calculateUltimateDamage(
            caster,
            caster.attackPower * caster.buffModifiers.attackMultiplier * 1.5,
            enemy,
          );
          enemy.hp -= damage;
        }
      }
      const sampleTarget = enemies.find((enemy) => !enemy.isDead);
      const damage = sampleTarget
        ? calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 1.5,
          sampleTarget,
        )
        : 0;
      log.push(`${caster.type} activates Arcane Burst! Deals ${damage} damage to all enemies`);
    }
  },
  assassin: {
    name: 'Backstab',
    triggerType: 'on_attack_count',
    triggerCount: 2,  // Assassin はトリガーが速い
    execute: (caster, _allies, enemies, log) => {
      // HP が最も低い敵に 3 倍ダメージを与える
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 3,
          target,
        );
        target.hp -= damage;
        log.push(`${caster.type} activates Backstab! Deals ${damage} damage to ${target.type}`);
      }
    }
  }
};

// ヒーロースキル定義
export const HERO_SKILL_DEFINITIONS: Record<string, HeroSkillEffect> = {
  reimu: {
    name: '博麗結界',
    triggerType: 'on_mana_full',
    execute: (caster, allies, _enemies, log) => {
      // 味方全員に防御バフ（簡易化実装）
      for (const ally of allies) {
        if (!ally.isDead) {
          ally.buffModifiers.defenseMultiplier *= 1.2;
        }
      }
      log.push(`${caster.type} activates 博麗結界! All allies gain +20% defense`);
    }
  },
  marisa: {
    name: 'マスタースパーク',
    triggerType: 'on_mana_full',
    execute: (caster, _allies, enemies, log) => {
      // 全敵に魔法ダメージ（ATK × 3.0）
      const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 3.0);
      for (const enemy of enemies) {
        if (!enemy.isDead) {
          enemy.hp -= damage;
        }
      }
      log.push(`${caster.type} activates マスタースパーク! Deals ${damage} damage to all enemies`);
    }
  },
  sanae: {
    name: '奇跡『神風の祝福』',
    triggerType: 'on_mana_full',
    execute: (caster, allies, _enemies, log) => {
      // 味方全員に攻撃力バフと防御バフ
      for (const ally of allies) {
        if (!ally.isDead) {
          ally.buffModifiers.attackMultiplier *= 1.25;
          ally.buffModifiers.defenseMultiplier *= 1.1;
        }
      }
      log.push(`${caster.type} activates 奇跡『神風の祝福』! All allies gain +25% attack and +10% defense`);
    }
  },
  youmu: {
    name: '人符『現世斬』',
    triggerType: 'on_mana_full',
    execute: (caster, _allies, enemies, log) => {
      // HPが最も低い敵に3連撃（ATK × 1.2 × 3）
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const singleDamage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 1.2);
        const totalDamage = singleDamage * 3;
        target.hp -= totalDamage;
        log.push(`${caster.type} activates 人符『現世斬』! Deals ${totalDamage} damage (3 hits) to ${target.type}`);
      }
    }
  },
  sakuya: {
    name: '時符『プライベートスクウェア』',
    triggerType: 'on_mana_full',
    execute: (caster, _allies, enemies, log) => {
      // 最も敵が密集している地点を中心に、半径2マスの円形範囲内の敵にデバフを適用
      // 現在のシステムでは移動速度は実装されていないため、攻撃速度減少のみ適用
      const livingEnemies = enemies.filter(e => !e.isDead);
      if (livingEnemies.length === 0) return;

      // 半径2マス以内の敵を検索してデバフを適用
      const radius = 2;
      const centerCell = selectBestAreaCenter(caster, livingEnemies, radius) ?? (livingEnemies[0]?.cell ?? 0);
      const affectedEnemies: BattleUnit[] = [];
      for (const enemy of livingEnemies) {
        const distance = calculateSharedBoardDistance(enemy.cell, centerCell);
        if (distance <= radius) {
          if (enemy.debuffImmunityCategories?.includes('crowd_control')) {
            continue;
          }
          // 攻撃速度 -30% (3秒間)
          // 注: 現在のシステムでは永続的なバフのみ実装されているため、即座に適用
          // 将来的にはデバフ持続時間の管理機能が必要
          enemy.buffModifiers.attackSpeedMultiplier *= 0.7;
          affectedEnemies.push(enemy);
        }
      }

      if (affectedEnemies.length > 0) {
        log.push(`${caster.type} activates 時符『プライベートスクウェア』! ${affectedEnemies.length} enemies slowed by -30% attack speed at cell ${centerCell}`);
        // 注: 移動速度 -60% は将来的な実装待ち
      }
    }
  }
};
