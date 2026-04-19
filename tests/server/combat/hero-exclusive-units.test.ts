import { describe, expect, test } from "vitest";

import { getHeroExclusiveUnitById } from "../../../src/data/hero-exclusive-units";
import { BattleSimulator, type BattleUnit } from "../../../src/server/combat/battle-simulator";
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import {
  HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS,
  resolvePairSkillDefinition,
  resolvePairSkillDefinitions,
  resolveUnitSkillDefinition,
} from "../../../src/server/combat/skill-definitions";

function createBattleUnit(overrides: Partial<BattleUnit>): BattleUnit {
  return {
    id: "unit-1",
    sourceUnitId: "unit-1",
    battleSide: "left",
    type: "vanguard",
    unitLevel: 1,
    hp: 200,
    maxHp: 200,
    attackPower: 50,
    attackSpeed: 1,
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

describe("hero-exclusive unit skills", () => {
  test("resolves hero-exclusive basic skills by sourceUnitId before type fallback", () => {
    const mayumi = createBattleUnit({ sourceUnitId: "mayumi", type: "vanguard" });
    const ordinaryVanguard = createBattleUnit({ sourceUnitId: "ordinary", type: "vanguard" });

    expect(resolveUnitSkillDefinition(mayumi)?.name).toBe(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["mayumi-basic"]?.name);
    expect(resolveUnitSkillDefinition(ordinaryVanguard)?.name).toBe("Shield Wall");
  });

  test("shion basic skill lowers the lowest-HP enemy attack output", () => {
    const shionSkill = HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["shion-basic"]!;
    const caster = createBattleUnit({ sourceUnitId: "shion", type: "assassin" });
    const healthyEnemy = createBattleUnit({ id: "enemy-1", sourceUnitId: "enemy-1", battleSide: "right", hp: 200, maxHp: 200 });
    const lowHpEnemy = createBattleUnit({ id: "enemy-2", sourceUnitId: "enemy-2", battleSide: "right", hp: 80, maxHp: 80 });
    const log: string[] = [];

    shionSkill.execute(caster, [caster], [healthyEnemy, lowHpEnemy], log);

    expect(healthyEnemy.buffModifiers.attackMultiplier).toBe(1);
    expect(lowHpEnemy.buffModifiers.attackMultiplier).toBe(0.75);
    expect(log[0]).toContain("貧困の気配");
  });

  test("hero-exclusive unit stats emphasize their intended frontline, debuff, and offense roles", () => {
    const mayumi = getHeroExclusiveUnitById("mayumi");
    const shion = getHeroExclusiveUnitById("shion");
    const ariya = getHeroExclusiveUnitById("ariya");

    expect(mayumi?.hp).toBeGreaterThan(ariya?.hp ?? 0);
    expect(mayumi?.damageReduction).toBeGreaterThan(ariya?.damageReduction ?? 0);
    expect(shion?.attack).toBeGreaterThan(mayumi?.attack ?? 0);
    expect(ariya?.attack).toBeGreaterThan(shion?.attack ?? 0);
  });

  test("resolves pair skill definitions from battle units and filters unknown ids", () => {
    const host = createBattleUnit({
      pairSkillIds: ["shion-pair", "unknown-pair", "mayumi-pair"],
    });

    expect(resolvePairSkillDefinition("shion-pair")?.name).toBe("疫病の縁");
    expect(resolvePairSkillDefinition("unknown-pair")).toBeNull();
    expect(resolvePairSkillDefinitions(host).map((definition) => definition.name)).toEqual([
      "疫病の縁",
      "埴輪の護り",
    ]);
  });

  test("battle simulator schedules mayumi basic skill instead of the default vanguard skill", () => {
    const simulator = new BattleSimulator();
    const mayumi = createBattleUnit({
      id: "left-mayumi",
      sourceUnitId: "mayumi",
      type: "vanguard",
      attackPower: 20,
      attackSpeed: 2,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-dummy",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      hp: 1000,
      maxHp: 1000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 3,
    });

    const result = simulator.simulateBattle([mayumi], [enemy], [], [], 2200);

    expect(mayumi.buffModifiers.defenseMultiplier).toBe(1.4);
    expect(result.combatLog.some((entry) => entry.includes("埴輪防衛線"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("Shield Wall"))).toBe(false);
  });

  test("ariya basic skill sharply boosts her self-buff offense profile", () => {
    const ariyaSkill = HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["ariya-basic"]!;
    const caster = createBattleUnit({ sourceUnitId: "ariya", type: "vanguard" });
    const log: string[] = [];

    ariyaSkill.execute(caster, [caster], [], log);

    expect(caster.buffModifiers.attackMultiplier).toBe(1.4);
    expect(caster.buffModifiers.attackSpeedMultiplier).toBe(1.2);
    expect(log[0]).toContain("破城の踏み込み");
  });

  test("shion pair skill applies attack-down on the host unit's first hit", () => {
    const simulator = new BattleSimulator();
    const host = createBattleUnit({
      id: "left-host",
      sourceUnitId: "host-1",
      type: "ranger",
      attackPower: 20,
      attackSpeed: 2,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-dummy",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      hp: 1000,
      maxHp: 1000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 3,
    });
    const leftPlacements: BoardUnitPlacement[] = [{
      cell: 0,
      unitType: "ranger",
      unitLevel: 1,
      unitId: "host-1",
      subUnit: {
        unitType: "assassin",
        unitLevel: 1,
        unitId: "shion",
      },
    }];

    const result = simulator.simulateBattle([host], [enemy], leftPlacements, [], 600);

    expect(enemy.buffModifiers.attackMultiplier).toBe(0.8);
    expect(result.combatLog.some((entry) => entry.includes("shion-pair"))).toBe(true);
  });

  test("mayumi pair skill grants emergency defense once the host drops below half HP", () => {
    const simulator = new BattleSimulator();
    const host = createBattleUnit({
      id: "left-host",
      sourceUnitId: "host-1",
      type: "vanguard",
      hp: 100,
      maxHp: 100,
      attackPower: 0,
      attackSpeed: 0,
      attackRange: 1,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-attacker",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      hp: 500,
      maxHp: 500,
      attackPower: 40,
      attackSpeed: 2,
      attackRange: 4,
      movementSpeed: 0,
      cell: 3,
    });
    const leftPlacements: BoardUnitPlacement[] = [{
      cell: 0,
      unitType: "vanguard",
      unitLevel: 1,
      unitId: "host-1",
      subUnit: {
        unitType: "vanguard",
        unitLevel: 1,
        unitId: "mayumi",
      },
    }];

    const result = simulator.simulateBattle([host], [enemy], leftPlacements, [], 1200);

    expect(host.buffModifiers.defenseMultiplier).toBe(1.25);
    expect(result.combatLog.some((entry) => entry.includes("mayumi-pair"))).toBe(true);
  });
});
