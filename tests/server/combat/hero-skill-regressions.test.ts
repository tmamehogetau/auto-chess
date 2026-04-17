import { describe, expect, test } from "vitest";

import { BattleSimulator, type BattleUnit } from "../../../src/server/combat/battle-simulator";
import { HERO_SKILL_DEFINITIONS } from "../../../src/server/combat/skill-definitions";

function createBattleUnit(overrides: Partial<BattleUnit>): BattleUnit {
  return {
    id: "unit-1",
    sourceUnitId: "unit-1",
    battleSide: "left",
    type: "mage",
    starLevel: 1,
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

describe("hero skill regressions", () => {
  test("Dragon Meteor hero skill only damages one target", () => {
    const marisaSkill = HERO_SKILL_DEFINITIONS.marisa!;
    const caster = createBattleUnit({ id: "hero-left", sourceUnitId: "marisa" });
    const firstEnemy = createBattleUnit({ id: "enemy-1", sourceUnitId: "enemy-1", battleSide: "right", hp: 200, maxHp: 200 });
    const secondEnemy = createBattleUnit({ id: "enemy-2", sourceUnitId: "enemy-2", battleSide: "right", hp: 200, maxHp: 200 });
    const log: string[] = [];

    marisaSkill.execute(caster, [caster], [firstEnemy, secondEnemy], log);

    expect(firstEnemy.hp).toBe(80);
    expect(secondEnemy.hp).toBe(200);
    expect(log[0]).toContain("Deals 120 damage");
    expect(log[0]).not.toContain("all enemies");
  });

  test("Yuiman targets the lowest-HP enemy and respects crowd-control immunity", () => {
    const yuimanSkill = HERO_SKILL_DEFINITIONS.yuiman!;
    const caster = createBattleUnit({ id: "hero-left", sourceUnitId: "yuiman" });
    const healthyEnemy = createBattleUnit({ id: "enemy-1", sourceUnitId: "enemy-1", battleSide: "right", hp: 200, maxHp: 200 });
    const lowHpImmuneEnemy = createBattleUnit({
      id: "enemy-2",
      sourceUnitId: "enemy-2",
      battleSide: "right",
      hp: 50,
      maxHp: 50,
      debuffImmunityCategories: ["crowd_control"],
    });
    const lowHpEnemy = createBattleUnit({ id: "enemy-3", sourceUnitId: "enemy-3", battleSide: "right", hp: 60, maxHp: 60 });
    const log: string[] = [];

    yuimanSkill.execute(caster, [caster], [healthyEnemy, lowHpImmuneEnemy, lowHpEnemy], log);

    expect(lowHpImmuneEnemy.buffModifiers.attackSpeedMultiplier).toBe(1);
    expect(lowHpEnemy.buffModifiers.attackSpeedMultiplier).toBe(1);
    expect(log[0]).toContain("resisted");

    yuimanSkill.execute(caster, [caster], [healthyEnemy, lowHpEnemy], log);

    expect(lowHpEnemy.buffModifiers.attackSpeedMultiplier).toBe(0.5);
  });

  test("sourceUnitId-based heroes still schedule battle-start skills", () => {
    const simulator = new BattleSimulator();
    const marisa = createBattleUnit({
      id: "left-mage-0",
      sourceUnitId: "marisa",
      battleSide: "left",
      attackPower: 60,
      attackSpeed: 0,
      attackRange: 1,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-vanguard-0",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      type: "vanguard",
      hp: 200,
      maxHp: 200,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 30,
    });

    simulator.simulateBattle([marisa], [enemy], [], [], 500);

    expect(enemy.hp).toBe(80);
  });
});
