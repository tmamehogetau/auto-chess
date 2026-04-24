import { describe, expect, test } from "vitest";

import { HEROES } from "../../../src/data/heroes";
import { BattleSimulator, type BattleUnit } from "../../../src/server/combat/battle-simulator";
import {
  HERO_SKILL_DEFINITIONS,
  resolveUnitSkillDefinition,
  type SkillExecutionContext,
} from "../../../src/server/combat/skill-definitions";

function createBattleUnit(overrides: Partial<BattleUnit>): BattleUnit {
  return {
    id: "unit-1",
    sourceUnitId: "unit-1",
    battleSide: "left",
    type: "mage",
    unitLevel: 1,
    hp: 100,
    maxHp: 100,
    attackPower: 60,
    attackSpeed: 0,
    movementSpeed: 0,
    attackRange: 4,
    cell: 0,
    isDead: false,
    attackCount: 0,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 0,
    buffModifiers: {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      attackSpeedMultiplier: 1,
    },
    debuffImmunityCategories: [],
    ...overrides,
  };
}

function createTestSkillContext(): SkillExecutionContext {
  return {
    currentTimeMs: 0,
    applyTimedModifier: (target, modifier) => {
      target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
      target.buffModifiers.defenseMultiplier *= modifier.defenseMultiplier ?? 1;
      target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
      target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
        * (modifier.incomingDamageMultiplier ?? 1);
    },
    applyShield: (target, amount) => {
      target.shieldAmount = (target.shieldAmount ?? 0) + amount;
    },
    findCurrentOrNearestTarget: (caster, enemies) => (
      enemies.find((enemy) => enemy.id === caster.currentTargetId && !enemy.isDead)
      ?? enemies.find((enemy) => !enemy.isDead)
      ?? null
    ),
    executePairSkillsOnMainSkillActivated: () => undefined,
  };
}

describe("hero skill regressions", () => {
  test("heroes expose progression bonus inventory with explicit implementation state", () => {
    const heroProgressions = HEROES.map((hero) => ({
      id: hero.id,
      baseGrowthProfile: hero.progressionBonus.baseGrowthProfile,
      level4Bonus: hero.progressionBonus.level4Bonus,
      level7Bonus: hero.progressionBonus.level7Bonus,
      skillImplementationState: hero.progressionBonus.skillImplementationState,
    }));

    expect(heroProgressions).toEqual([
      {
        id: "reimu",
        baseGrowthProfile: "balanced",
        level4Bonus: {
          kind: "skill-upgrade",
          summary: "Lv4で二重結界の防御支援が強化される",
          skillScore: 16,
        },
        level7Bonus: {
          kind: "skill-upgrade",
          summary: "Lv7で二重結界の範囲ダメージが強化される",
          skillScore: 18,
        },
        skillImplementationState: "implemented",
      },
      {
        id: "marisa",
        baseGrowthProfile: "burst",
        level4Bonus: {
          kind: "skill-upgrade",
          summary: "Lv4でマスタースパークの威力が強化される",
          skillScore: 18,
        },
        level7Bonus: {
          kind: "skill-upgrade",
          summary: "Lv7でマスタースパークの火力が大きく強化される",
          skillScore: 24,
        },
        skillImplementationState: "implemented",
      },
      {
        id: "okina",
        baseGrowthProfile: "support",
        level4Bonus: {
          kind: "skill-upgrade",
          summary: "Lv4で表の味方全体攻撃支援が強化される",
          skillScore: 16,
        },
        level7Bonus: {
          kind: "skill-upgrade",
          summary: "Lv7で表と裏の攻撃支援がさらに強化される",
          skillScore: 20,
        },
        skillImplementationState: "implemented",
      },
      {
        id: "keiki",
        baseGrowthProfile: "support",
        level4Bonus: {
          kind: "skill-upgrade",
          summary: "Lv4で鬼形造形術の攻防支援が強化される",
          skillScore: 18,
        },
        level7Bonus: {
          kind: "skill-upgrade",
          summary: "Lv7で鬼形造形術の効果量と効果時間が強化される",
          skillScore: 20,
        },
        skillImplementationState: "implemented",
      },
      {
        id: "jyoon",
        baseGrowthProfile: "late-bloom",
        level4Bonus: {
          kind: "skill-upgrade",
          summary: "Lv4で黄金のトルネードの攻撃性能が強化される",
          skillScore: 20,
        },
        level7Bonus: {
          kind: "skill-upgrade",
          summary: "Lv7で高コストに見合う後半火力が解禁される",
          skillScore: 30,
        },
        skillImplementationState: "implemented",
      },
      {
        id: "yuiman",
        baseGrowthProfile: "support",
        level4Bonus: {
          kind: "skill-upgrade",
          summary: "Lv4で範囲妨害が強化される",
          skillScore: 18,
        },
        level7Bonus: {
          kind: "skill-upgrade",
          summary: "Lv7で範囲妨害がさらに強化される",
          skillScore: 20,
        },
        skillImplementationState: "implemented",
      },
    ]);
    expect(Object.keys(HERO_SKILL_DEFINITIONS).sort()).toEqual([
      "jyoon",
      "keiki",
      "marisa",
      "okina",
      "reimu",
      "yuiman",
    ]);
  });

  test("Master Spark hits every enemy on the line between caster and target", () => {
    const marisaSkill = HERO_SKILL_DEFINITIONS.marisa!;
    const caster = createBattleUnit({ id: "hero-left", sourceUnitId: "marisa", cell: 0 });
    const primaryTarget = createBattleUnit({
      id: "enemy-1",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      cell: 3,
      hp: 250,
      maxHp: 250,
    });
    const linedEnemy = createBattleUnit({
      id: "enemy-2",
      sourceUnitId: "enemy-2",
      battleSide: "right",
      cell: 2,
      hp: 200,
      maxHp: 200,
    });
    const offLineEnemy = createBattleUnit({
      id: "enemy-3",
      sourceUnitId: "enemy-3",
      battleSide: "right",
      cell: 7,
      hp: 200,
      maxHp: 200,
    });
    const log: string[] = [];

    marisaSkill.execute(caster, [caster], [primaryTarget, linedEnemy, offLineEnemy], log);

    expect(primaryTarget.hp).toBe(106);
    expect(linedEnemy.hp).toBe(56);
    expect(offLineEnemy.hp).toBe(200);
    expect(log[0]).toContain("マスタースパーク");
  });

  test("Master Spark log and hero data use Master Spark naming", () => {
    expect(HERO_SKILL_DEFINITIONS.marisa?.name).toBe("恋符「マスタースパーク」");
    expect(HEROES.find((hero) => hero.id === "marisa")?.skill.name).toBe("恋符「マスタースパーク」");
  });

  test("Yuiman applies area debuff and respects crowd-control immunity", () => {
    const yuimanSkill = HERO_SKILL_DEFINITIONS.yuiman!;
    const caster = createBattleUnit({ id: "hero-left", sourceUnitId: "yuiman", unitLevel: 7, cell: 7 });
    const immuneEnemy = createBattleUnit({
      id: "enemy-2",
      sourceUnitId: "enemy-2",
      battleSide: "right",
      hp: 50,
      maxHp: 50,
      cell: 8,
      debuffImmunityCategories: ["crowd_control"],
    });
    const affectedEnemy = createBattleUnit({
      id: "enemy-3",
      sourceUnitId: "enemy-3",
      battleSide: "right",
      hp: 60,
      maxHp: 60,
      cell: 13,
    });
    const outsideEnemy = createBattleUnit({
      id: "enemy-4",
      sourceUnitId: "enemy-4",
      battleSide: "right",
      hp: 60,
      maxHp: 60,
      cell: 35,
    });
    const log: string[] = [];

    yuimanSkill.execute(caster, [caster], [immuneEnemy, affectedEnemy, outsideEnemy], log, createTestSkillContext());

    expect(immuneEnemy.buffModifiers.attackSpeedMultiplier).toBe(1);
    expect(affectedEnemy.buffModifiers.attackSpeedMultiplier).toBe(0.5);
    expect(affectedEnemy.buffModifiers.defenseMultiplier).toBe(0.75);
    expect(outsideEnemy.buffModifiers.attackSpeedMultiplier).toBe(1);
  });

  test("sourceUnitId-based heroes schedule cooldown skills", () => {
    const simulator = new BattleSimulator();
    const marisa = createBattleUnit({
      id: "left-mage-0",
      sourceUnitId: "marisa",
      battleSide: "left",
      attackPower: 1,
      attackSpeed: 0,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-vanguard-0",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      type: "vanguard",
      hp: 5000,
      maxHp: 5000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 3,
    });

    const beforeInitialDelay = simulator.simulateBattle([marisa], [enemy], [], [], 9_900);
    expect(beforeInitialDelay.combatLog.some((entry) => entry.includes("マスタースパーク"))).toBe(false);

    const afterInitialDelay = simulator.simulateBattle([marisa], [enemy], [], [], 10_100);
    expect(afterInitialDelay.combatLog.some((entry) => entry.includes("マスタースパーク"))).toBe(true);
  });

  test("Patchouli uses her scarlet mansion skill instead of generic all-enemy mage burst", () => {
    const patchouliSkill = resolveUnitSkillDefinition(createBattleUnit({
      id: "boss-unit-1",
      sourceUnitId: "patchouli",
      type: "mage",
    }));
    const caster = createBattleUnit({
      id: "boss-unit-1",
      sourceUnitId: "patchouli",
      battleSide: "right",
      type: "mage",
      attackPower: 100,
      cell: 0,
    });
    const closeEnemy = createBattleUnit({
      id: "enemy-1",
      sourceUnitId: "enemy-1",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 1,
    });
    const midEnemy = createBattleUnit({
      id: "enemy-2",
      sourceUnitId: "enemy-2",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 2,
    });
    const farEnemy = createBattleUnit({
      id: "enemy-3",
      sourceUnitId: "enemy-3",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 3,
    });
    const untouchedEnemy = createBattleUnit({
      id: "enemy-4",
      sourceUnitId: "enemy-4",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 4,
    });
    const log: string[] = [];

    patchouliSkill?.execute(caster, [caster], [untouchedEnemy, farEnemy, midEnemy, closeEnemy], log);

    expect(patchouliSkill?.name).toBe("火水木金土符「賢者の石」");
    expect(closeEnemy.hp).toBe(380);
    expect(midEnemy.hp).toBe(380);
    expect(farEnemy.hp).toBe(380);
    expect(untouchedEnemy.hp).toBe(500);
    expect(log[0]).toContain("賢者の石");
  });
});
