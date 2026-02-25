import type { BoardUnitType } from "../../shared/room-messages";
import type { BattleUnit } from "./battle-simulator";

export interface SkillEffect {
  name: string;
  triggerType: 'on_attack_count';  // N 回攻撃ごとにトリガー
  triggerCount: number;             // N の値
  execute: (caster: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], log: string[]) => void;
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
      const livingEnemies = enemies.filter(e => !e.isDead);
      if (livingEnemies.length > 0) {
        const target = livingEnemies.reduce((lowest, e) => e.hp < lowest.hp ? e : lowest);
        const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 2);
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
      const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 1.5);
      for (const enemy of enemies) {
        if (!enemy.isDead) {
          enemy.hp -= damage;
        }
      }
      log.push(`${caster.type} activates Arcane Burst! Deals ${damage} damage to all enemies`);
    }
  },
  assassin: {
    name: 'Backstab',
    triggerType: 'on_attack_count',
    triggerCount: 2,  // Assassin はトリガーが速い
    execute: (caster, _allies, enemies, log) => {
      // HP が最も低い敵に 3 倍ダメージを与える
      const livingEnemies = enemies.filter(e => !e.isDead);
      if (livingEnemies.length > 0) {
        const target = livingEnemies.reduce((lowest, e) => e.hp < lowest.hp ? e : lowest);
        const damage = Math.floor(caster.attackPower * caster.buffModifiers.attackMultiplier * 3);
        target.hp -= damage;
        log.push(`${caster.type} activates Backstab! Deals ${damage} damage to ${target.type}`);
      }
    }
  }
};
