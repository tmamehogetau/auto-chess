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
    dealDamage: (_caster, target, amount) => {
      const shieldBeforeHit = target.shieldAmount ?? 0;
      const damage = Math.max(0, Math.floor(amount * (target.damageTakenMultiplier ?? 1)));
      const shieldAbsorbed = Math.min(shieldBeforeHit, damage);
      const damageAfterShield = damage - shieldAbsorbed;
      target.shieldAmount = shieldBeforeHit - shieldAbsorbed;
      target.hp -= damageAfterShield;
      return damageAfterShield;
    },
    findCurrentOrNearestTarget: (caster, enemies) => (
      enemies.find((enemy) => enemy.id === caster.currentTargetId && !enemy.isDead)
      ?? enemies.find((enemy) => !enemy.isDead)
      ?? null
    ),
    scheduleSkillTicks: () => undefined,
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
        skillImplementationState: "provisional",
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

    expect(primaryTarget.hp).toBe(178);
    expect(linedEnemy.hp).toBe(128);
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

  test.each([
    [1, 1.12, 8000],
    [4, 1.24, 10000],
    [7, 1.38, 12000],
  ])("Keiki Modeling grants stronger range-3 support at level %i", (unitLevel, multiplier, durationMs) => {
    const keikiSkill = HERO_SKILL_DEFINITIONS.keiki!;
    const caster = createBattleUnit({
      id: "hero-keiki",
      sourceUnitId: "keiki",
      unitLevel,
      cell: 7,
    });
    const edgeAlly = createBattleUnit({
      id: "ally-edge",
      sourceUnitId: "ally-edge",
      battleSide: "left",
      cell: 10,
    });
    const outsideAlly = createBattleUnit({
      id: "ally-outside",
      sourceUnitId: "ally-outside",
      battleSide: "left",
      cell: 11,
    });
    const appliedModifiers: Array<{
      targetId: string;
      modifier: Parameters<SkillExecutionContext["applyTimedModifier"]>[1];
    }> = [];
    const context: SkillExecutionContext = {
      ...createTestSkillContext(),
      applyTimedModifier: (target, modifier) => {
        appliedModifiers.push({ targetId: target.id, modifier });
      },
    };

    keikiSkill.execute(caster, [caster, edgeAlly, outsideAlly], [], [], context);

    expect(appliedModifiers).toEqual([
      {
        targetId: caster.id,
        modifier: {
          id: "keiki-modeling",
          durationMs,
          attackMultiplier: multiplier,
          defenseMultiplier: multiplier,
        },
      },
      {
        targetId: edgeAlly.id,
        modifier: {
          id: "keiki-modeling",
          durationMs,
          attackMultiplier: multiplier,
          defenseMultiplier: multiplier,
        },
      },
    ]);
  });

  test("sourceUnitId-based heroes cast mana skills after gaining enough attack mana", () => {
    const simulator = new BattleSimulator();
    const marisa = createBattleUnit({
      id: "left-mage-0",
      sourceUnitId: "marisa",
      battleSide: "left",
      attackPower: 1,
      attackSpeed: 20,
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

    const beforeManaCost = simulator.simulateBattle([marisa], [enemy], [], [], 450);
    expect(beforeManaCost.combatLog.some((entry) => entry.includes("マスタースパーク"))).toBe(false);

    const afterManaCost = simulator.simulateBattle([marisa], [enemy], [], [], 550);
    expect(afterManaCost.combatLog.some((entry) => entry.includes("マスタースパーク"))).toBe(true);
  });

  test("Meiling uses Rainbow Taijiquan to mitigate damage and taunt nearby enemies", () => {
    const meilingSkill = resolveUnitSkillDefinition(createBattleUnit({
      id: "boss-unit-1",
      sourceUnitId: "meiling",
      type: "vanguard",
    }));
    const caster = createBattleUnit({
      id: "boss-unit-1",
      sourceUnitId: "meiling",
      battleSide: "right",
      type: "vanguard",
      unitLevel: 4,
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
    const edgeEnemy = createBattleUnit({
      id: "enemy-2",
      sourceUnitId: "enemy-2",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 3,
    });
    const outsideEnemy = createBattleUnit({
      id: "enemy-3",
      sourceUnitId: "enemy-3",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 4,
    });
    const appliedModifiers: Array<{
      targetId: string;
      modifier: Parameters<SkillExecutionContext["applyTimedModifier"]>[1];
    }> = [];
    const context: SkillExecutionContext = {
      ...createTestSkillContext(),
      applyTimedModifier: (target, modifier) => {
        appliedModifiers.push({ targetId: target.id, modifier });
      },
    };
    const log: string[] = [];

    meilingSkill?.execute(
      caster,
      [caster],
      [outsideEnemy, closeEnemy, edgeEnemy],
      log,
      context,
    );

    expect(meilingSkill?.name).toBe("彩華「虹色太極拳」");
    expect(meilingSkill?.activationModel).toBe("mana");
    expect(meilingSkill?.mana).toEqual({
      maxMana: 100,
      initialMana: 40,
      manaCost: 100,
      manaGainOnAttack: 10,
      manaGainOnDamageTakenRatio: 70,
    });
    expect(appliedModifiers).toEqual([
      {
        targetId: caster.id,
        modifier: {
          id: "meiling-rainbow-taijiquan-guard",
          durationMs: 6000,
          incomingDamageMultiplier: 0.72,
        },
      },
      {
        targetId: closeEnemy.id,
        modifier: {
          id: "meiling-rainbow-taijiquan-taunt",
          durationMs: 6000,
          tauntTargetId: caster.id,
        },
      },
      {
        targetId: edgeEnemy.id,
        modifier: {
          id: "meiling-rainbow-taijiquan-taunt",
          durationMs: 6000,
          tauntTargetId: caster.id,
        },
      },
    ]);
    expect(log[0]).toContain("虹色太極拳");
  });

  test.each([
    [1, 0.80],
    [4, 0.72],
    [7, 0.64],
  ])("Meiling guard mitigation scales at level %i", (unitLevel, incomingDamageMultiplier) => {
    const meilingSkill = resolveUnitSkillDefinition(createBattleUnit({
      id: "boss-unit-1",
      sourceUnitId: "meiling",
      type: "vanguard",
    }));
    const caster = createBattleUnit({
      id: "boss-unit-1",
      sourceUnitId: "meiling",
      battleSide: "right",
      type: "vanguard",
      unitLevel,
      cell: 0,
    });
    const appliedModifiers: Array<Parameters<SkillExecutionContext["applyTimedModifier"]>[1]> = [];
    const context: SkillExecutionContext = {
      ...createTestSkillContext(),
      applyTimedModifier: (_target, modifier) => {
        appliedModifiers.push(modifier);
      },
    };

    meilingSkill?.execute(caster, [caster], [], [], context);

    expect(appliedModifiers).toContainEqual({
      id: "meiling-rainbow-taijiquan-guard",
      durationMs: 6000,
      incomingDamageMultiplier,
    });
  });

  test("Sakuya uses Private Square to slow one high-attack enemy", () => {
    const sakuyaSkill = resolveUnitSkillDefinition(createBattleUnit({
      id: "boss-unit-2",
      sourceUnitId: "sakuya",
      type: "assassin",
    }));
    const caster = createBattleUnit({
      id: "boss-unit-2",
      sourceUnitId: "sakuya",
      battleSide: "right",
      type: "assassin",
      unitLevel: 7,
      cell: 0,
    });
    const lowAttackEnemy = createBattleUnit({
      id: "enemy-1",
      sourceUnitId: "enemy-1",
      battleSide: "left",
      attackPower: 50,
      cell: 1,
    });
    const highAttackEnemy = createBattleUnit({
      id: "enemy-2",
      sourceUnitId: "enemy-2",
      battleSide: "left",
      attackPower: 180,
      cell: 2,
    });
    const appliedModifiers: Array<{
      targetId: string;
      modifier: Parameters<SkillExecutionContext["applyTimedModifier"]>[1];
    }> = [];
    const context: SkillExecutionContext = {
      ...createTestSkillContext(),
      applyTimedModifier: (target, modifier) => {
        appliedModifiers.push({ targetId: target.id, modifier });
      },
    };
    const log: string[] = [];

    sakuyaSkill?.execute(
      caster,
      [caster],
      [lowAttackEnemy, highAttackEnemy],
      log,
      context,
    );

    expect(sakuyaSkill?.name).toBe("時符「プライベートスクウェア」");
    expect(sakuyaSkill?.activationModel).toBe("mana");
    expect(sakuyaSkill?.mana).toEqual({
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 20,
    });
    expect(appliedModifiers).toEqual([
      {
        targetId: highAttackEnemy.id,
        modifier: {
          id: "sakuya-private-square",
          durationMs: 6000,
          attackSpeedMultiplier: 0.58,
          movementSpeedMultiplier: 0.40,
        },
      },
    ]);
    expect(log[0]).toContain("プライベートスクウェア");
  });

  test("Patchouli uses Royal Flare as a heavy mana burst around herself", () => {
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
    const edgeEnemy = createBattleUnit({
      id: "enemy-3",
      sourceUnitId: "enemy-3",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 3,
    });
    const sideEnemy = createBattleUnit({
      id: "enemy-4",
      sourceUnitId: "enemy-4",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 6,
    });
    const untouchedEnemy = createBattleUnit({
      id: "enemy-5",
      sourceUnitId: "enemy-5",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 4,
    });
    const log: string[] = [];

    patchouliSkill?.execute(
      caster,
      [caster],
      [untouchedEnemy, edgeEnemy, sideEnemy, midEnemy, closeEnemy],
      log,
    );

    expect(patchouliSkill?.name).toBe("日符「ロイヤルフレア」");
    expect(patchouliSkill?.activationModel).toBe("mana");
    expect(patchouliSkill?.mana).toEqual({
      maxMana: 100,
      initialMana: 0,
      manaCost: 100,
      manaGainOnAttack: 8,
      manaGainOnDamageTakenRatio: 20,
    });
    expect(closeEnemy.hp).toBe(370);
    expect(midEnemy.hp).toBe(370);
    expect(edgeEnemy.hp).toBe(370);
    expect(sideEnemy.hp).toBe(370);
    expect(untouchedEnemy.hp).toBe(500);
    expect(log[0]).toContain("ロイヤルフレア");

    const level4Caster = createBattleUnit({
      id: "boss-unit-2",
      sourceUnitId: "patchouli",
      battleSide: "right",
      type: "mage",
      unitLevel: 4,
      attackPower: 100,
      cell: 0,
    });
    const level4Enemy = createBattleUnit({
      id: "enemy-6",
      sourceUnitId: "enemy-6",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 1,
    });
    patchouliSkill?.execute(level4Caster, [level4Caster], [level4Enemy], []);
    expect(level4Enemy.hp).toBe(350);

    const level7Caster = createBattleUnit({
      id: "boss-unit-3",
      sourceUnitId: "patchouli",
      battleSide: "right",
      type: "mage",
      unitLevel: 7,
      attackPower: 100,
      cell: 0,
    });
    const level7Enemy = createBattleUnit({
      id: "enemy-7",
      sourceUnitId: "enemy-7",
      battleSide: "left",
      hp: 500,
      maxHp: 500,
      cell: 1,
    });
    patchouliSkill?.execute(level7Caster, [level7Caster], [level7Enemy], []);
    expect(level7Enemy.hp).toBe(320);
  });
});
