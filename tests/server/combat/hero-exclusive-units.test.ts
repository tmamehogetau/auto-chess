import { describe, expect, test } from "vitest";

import { getHeroExclusiveUnitById } from "../../../src/data/hero-exclusive-units";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";
import { BattleSimulator, type BattleUnit } from "../../../src/server/combat/battle-simulator";
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import {
  HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS,
  resolvePairSkillDefinition,
  resolvePairSkillDefinitions,
  resolveUnitSkillDefinition,
  type SkillExecutionContext,
} from "../../../src/server/combat/skill-definitions";
import {
  MAIN_SUB_PAIR_SKILL_BINDINGS,
  SUB_UNIT_EFFECT_BINDINGS,
  resolveMainSubPairSkillLevel,
  resolveSubUnitEffectLevel,
  resolveSubUnitEquipmentBonus,
} from "../../../src/server/combat/pair-sub-bindings";

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
    scheduleSkillTicks: () => undefined,
    executePairSkillsOnMainSkillActivated: () => undefined,
  };
}

describe("hero-exclusive unit skills", () => {
  test("hero-exclusive units expose progression bonus inventory with explicit implementation state", () => {
    expect(getHeroExclusiveUnitById("mayumi")?.progressionBonus).toEqual({
      baseGrowthProfile: "frontline",
      level4Bonus: {
        kind: "pair-skill-unlock",
        summary: "Lv4で埴輪「アイドルクリーチャー」が解禁される",
        skillScore: 24,
      },
      level7Bonus: {
        kind: "pair-skill-upgrade",
        summary: "Lv7で埴輪「アイドルクリーチャー」のシールドと攻撃支援が強化される",
        skillScore: 22,
      },
      skillImplementationState: "implemented",
    });
    expect(getHeroExclusiveUnitById("shion")?.progressionBonus).toEqual({
      baseGrowthProfile: "debuff",
      level4Bonus: {
        kind: "pair-skill-unlock",
        summary: "Lv4で最凶最悪の双子神が解禁される",
        skillScore: 22,
      },
      level7Bonus: {
        kind: "pair-skill-upgrade",
        summary: "Lv7で最凶最悪の双子神の妨害と女苑支援が強化される",
        skillScore: 20,
      },
      skillImplementationState: "implemented",
    });
    expect(getHeroExclusiveUnitById("ariya")?.progressionBonus).toEqual({
      baseGrowthProfile: "offense",
      level4Bonus: {
        kind: "skill-upgrade",
        summary: "Lv4でストーンゴッデスのスタック上限と1スタック性能が強化される",
        skillScore: 18,
      },
      level7Bonus: {
        kind: "skill-upgrade",
        summary: "Lv7でストーンゴッデスの最大成長量が強化される",
        skillScore: 22,
      },
      skillImplementationState: "implemented",
    });
  });

  test("resolves hero-exclusive basic skills by sourceUnitId before type fallback", () => {
    const mayumi = createBattleUnit({ sourceUnitId: "mayumi", type: "vanguard" });
    const ordinaryVanguard = createBattleUnit({ sourceUnitId: "ordinary", type: "vanguard" });

    expect(resolveUnitSkillDefinition(mayumi)?.name).toBe(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["mayumi-basic"]?.name);
    expect(resolveUnitSkillDefinition(ordinaryVanguard)?.name).toBe("Shield Wall");
  });

  test("shion basic skill prefers the current attack target", () => {
    const shionSkill = HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["shion-basic"]!;
    const caster = createBattleUnit({
      sourceUnitId: "shion",
      type: "assassin",
      currentTargetId: "enemy-current",
    });
    const healthyEnemy = createBattleUnit({ id: "enemy-1", sourceUnitId: "enemy-1", battleSide: "right", hp: 200, maxHp: 200 });
    const currentEnemy = createBattleUnit({ id: "enemy-current", sourceUnitId: "enemy-current", battleSide: "right", hp: 200, maxHp: 200 });
    const log: string[] = [];

    shionSkill.execute(caster, [caster], [healthyEnemy, currentEnemy], log, createTestSkillContext());

    expect(healthyEnemy.buffModifiers.attackMultiplier).toBe(1);
    expect(currentEnemy.buffModifiers.attackMultiplier).toBe(0.8);
    expect(currentEnemy.hp).toBe(168);
    expect(log[0]).toContain("貧符「超貧乏玉」");
  });

  test("hero-exclusive unit stats emphasize their intended frontline, debuff, and offense roles", () => {
    const mayumi = getHeroExclusiveUnitById("mayumi");
    const shion = getHeroExclusiveUnitById("shion");
    const ariya = getHeroExclusiveUnitById("ariya");

    expect(mayumi?.hp).toBeGreaterThan(ariya?.hp ?? 0);
    expect(mayumi?.damageReduction).toBeGreaterThan(ariya?.damageReduction ?? 0);
    expect(shion?.attack).toBeGreaterThan(mayumi?.attack ?? 0);
    expect(ariya?.attack).toBeGreaterThan(shion?.attack ?? 0);
    expect(mayumi?.damageReduction).toBeGreaterThanOrEqual(28);
    expect(shion?.hp).toBeGreaterThanOrEqual(860);
    expect(ariya?.attack).toBeGreaterThanOrEqual(176);
  });

  test("resolves pair skill definitions from battle units and filters unknown ids", () => {
    const host = createBattleUnit({
      pairSkillIds: ["shion-pair", "unknown-pair", "mayumi-pair"],
    });

    expect(resolvePairSkillDefinition("shion-pair")?.name).toBe("最凶最悪の双子神");
    expect(resolvePairSkillDefinition("unknown-pair")).toBeNull();
    expect(resolvePairSkillDefinitions(host).map((definition) => definition.name)).toEqual([
      "最凶最悪の双子神",
      "埴輪「アイドルクリーチャー」",
    ]);
  });

  test("pair and sub effect binding registries expose the existing relationships", () => {
    expect(MAIN_SUB_PAIR_SKILL_BINDINGS.map((binding) => ({
      id: binding.id,
      mainHeroId: binding.mainHeroId,
      mainUnitId: binding.mainUnitId,
      subUnitId: binding.subUnitId,
      pairSkillId: binding.pairSkillId,
    }))).toEqual([
      {
        id: "keiki-mayumi-pair",
        mainHeroId: "keiki",
        mainUnitId: undefined,
        subUnitId: "mayumi",
        pairSkillId: "mayumi-pair",
      },
      {
        id: "jyoon-shion-pair",
        mainHeroId: "jyoon",
        mainUnitId: undefined,
        subUnitId: "shion",
        pairSkillId: "shion-pair",
      },
      {
        id: "yoshika-seiga-pair",
        mainHeroId: undefined,
        mainUnitId: "yoshika",
        subUnitId: "seiga",
        pairSkillId: "tongling-yoshika-pair",
      },
      {
        id: "koishi-satori-perfect-mind-control-pair",
        mainHeroId: undefined,
        mainUnitId: "koishi",
        subUnitId: "satori",
        pairSkillId: "perfect-mind-control-pair",
      },
      {
        id: "satori-koishi-heartbreaker-pair",
        mainHeroId: undefined,
        mainUnitId: "satori",
        subUnitId: "koishi",
        pairSkillId: "komeiji-heartbreaker-pair",
      },
      {
        id: "junko-hecatia-nameless-danmaku-pair",
        mainHeroId: undefined,
        mainUnitId: "junko",
        subUnitId: "hecatia",
        pairSkillId: "nameless-danmaku-pair",
      },
      {
        id: "hecatia-junko-nameless-danmaku-pair",
        mainHeroId: undefined,
        mainUnitId: "hecatia",
        subUnitId: "junko",
        pairSkillId: "nameless-danmaku-pair",
      },
      {
        id: "megumu-tsukasa-delayed-kudagitsune-pair",
        mainHeroId: undefined,
        mainUnitId: "megumu",
        subUnitId: "tsukasa",
        pairSkillId: "delayed-kudagitsune-shot-pair",
      },
      {
        id: "shou-nazrin-greatest-treasure-pair",
        mainHeroId: undefined,
        mainUnitId: "shou",
        subUnitId: "nazrin",
        pairSkillId: "greatest-treasure-pair",
      },
      {
        id: "miko-futo-gouzoku-ranbu-mononobe-pair",
        mainHeroId: undefined,
        mainUnitId: "miko",
        subUnitId: "futo",
        pairSkillId: "gouzoku-ranbu-mononobe-pair",
      },
      {
        id: "miko-tojiko-gouzoku-ranbu-soga-pair",
        mainHeroId: undefined,
        mainUnitId: "miko",
        subUnitId: "tojiko",
        pairSkillId: "gouzoku-ranbu-soga-pair",
      },
    ]);

    const mayumiPair = MAIN_SUB_PAIR_SKILL_BINDINGS.find((binding) => binding.id === "keiki-mayumi-pair")!;
    const tonglingPair = MAIN_SUB_PAIR_SKILL_BINDINGS.find((binding) => binding.id === "yoshika-seiga-pair")!;
    const perfectMindPair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "koishi-satori-perfect-mind-control-pair")!;
    const heartbreakerPair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "satori-koishi-heartbreaker-pair")!;
    const junkoNamelessPair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "junko-hecatia-nameless-danmaku-pair")!;
    const hecatiaNamelessPair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "hecatia-junko-nameless-danmaku-pair")!;
    const delayedKudagitsunePair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "megumu-tsukasa-delayed-kudagitsune-pair")!;
    const greatestTreasurePair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "shou-nazrin-greatest-treasure-pair")!;
    const gouzokuRanbuMononobePair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "miko-futo-gouzoku-ranbu-mononobe-pair")!;
    const gouzokuRanbuSogaPair = MAIN_SUB_PAIR_SKILL_BINDINGS
      .find((binding) => binding.id === "miko-tojiko-gouzoku-ranbu-soga-pair")!;
    expect(resolveMainSubPairSkillLevel(mayumiPair, 3)).toBe(0);
    expect(resolveMainSubPairSkillLevel(mayumiPair, 4)).toBe(1);
    expect(resolveMainSubPairSkillLevel(mayumiPair, 7)).toBe(2);
    expect(resolveMainSubPairSkillLevel(tonglingPair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(tonglingPair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(tonglingPair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(perfectMindPair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(perfectMindPair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(perfectMindPair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(heartbreakerPair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(heartbreakerPair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(heartbreakerPair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(junkoNamelessPair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(junkoNamelessPair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(junkoNamelessPair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(hecatiaNamelessPair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(hecatiaNamelessPair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(hecatiaNamelessPair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(delayedKudagitsunePair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(delayedKudagitsunePair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(delayedKudagitsunePair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(greatestTreasurePair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(greatestTreasurePair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(greatestTreasurePair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(gouzokuRanbuMononobePair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(gouzokuRanbuMononobePair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(gouzokuRanbuMononobePair, 7)).toBe(7);
    expect(resolveMainSubPairSkillLevel(gouzokuRanbuSogaPair, 1)).toBe(1);
    expect(resolveMainSubPairSkillLevel(gouzokuRanbuSogaPair, 4)).toBe(4);
    expect(resolveMainSubPairSkillLevel(gouzokuRanbuSogaPair, 7)).toBe(7);
    expect(SUB_UNIT_EFFECT_BINDINGS.map((binding) => ({
      id: binding.id,
      mainUnitId: binding.mainUnitId,
      subUnitId: binding.subUnitId,
      subUnitEffectId: binding.subUnitEffectId,
    }))).toEqual([
      {
        id: "okina-back-sub-effect",
        mainUnitId: undefined,
        subUnitId: "okina",
        subUnitEffectId: "okina-back",
      },
    ]);
    expect(resolveSubUnitEffectLevel(SUB_UNIT_EFFECT_BINDINGS[0]!, 1)).toBe(1);
    expect(resolveSubUnitEffectLevel(SUB_UNIT_EFFECT_BINDINGS[0]!, 4)).toBe(4);
    expect(resolveSubUnitEffectLevel(SUB_UNIT_EFFECT_BINDINGS[0]!, 7)).toBe(7);
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
      type: "ranger",
      hp: 1000,
      maxHp: 1000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 3,
    });

    const result = simulator.simulateBattle([mayumi], [enemy], [], [], 7100);

    expect(mayumi.buffModifiers.defenseMultiplier).toBe(1.3);
    expect(result.combatLog.some((entry) => entry.includes("埴輪「熟練剣士埴輪」"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("Shield Wall"))).toBe(false);
  });

  test("hero-exclusive basic skills expose the approved mana timing", () => {
    expect(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["mayumi-basic"]?.activationModel).toBe("mana");
    expect(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["mayumi-basic"]?.mana).toEqual({
      maxMana: 100,
      initialMana: 40,
      manaCost: 100,
      manaGainOnAttack: 9,
      manaGainOnDamageTakenRatio: 55,
    });
    expect(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["shion-basic"]?.activationModel).toBe("mana");
    expect(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["shion-basic"]?.mana).toEqual({
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 9,
      manaGainOnDamageTakenRatio: 25,
    });
    expect(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["ariya-basic"]?.activationModel).toBe("mana");
    expect(HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["ariya-basic"]?.mana).toEqual({
      maxMana: 100,
      initialMana: 40,
      manaCost: 100,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    });
  });

  test("hero-exclusive basic skills do not cast from timer alone without mana", () => {
    const simulator = new BattleSimulator();
    const mayumi = createBattleUnit({
      id: "left-mayumi",
      sourceUnitId: "mayumi",
      type: "vanguard",
      attackPower: 0,
      attackSpeed: 0,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-dummy",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      type: "ranger",
      hp: 1000,
      maxHp: 1000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 3,
    });

    const result = simulator.simulateBattle([mayumi], [enemy], [], [], 20000);

    expect(result.combatLog.some((entry) => entry.includes("埴輪「熟練剣士埴輪」"))).toBe(false);
  });

  test("ariya basic skill stacks her self-buff offense profile", () => {
    const ariyaSkill = HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS["ariya-basic"]!;
    const caster = createBattleUnit({ sourceUnitId: "ariya", type: "vanguard" });
    const log: string[] = [];

    ariyaSkill.execute(caster, [caster], [], log);

    expect(caster.buffModifiers.attackMultiplier).toBe(1.05);
    expect(caster.buffModifiers.defenseMultiplier).toBe(1.04);
    expect(caster.stackState?.["ariya-stone-goddess"]).toBe(1);
    expect(log[0]).toContain("ストーンゴッデス");
  });

  test("pair skills stay inactive before the level 4 milestone", () => {
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
        unitLevel: 3,
        unitId: "shion",
      },
    }];

    const result = simulator.simulateBattle([host], [enemy], leftPlacements, [], 600);

    expect(enemy.buffModifiers.attackMultiplier).toBe(1);
    expect(result.combatLog.some((entry) => entry.includes("shion-pair"))).toBe(false);
  });

  test("shion pair skill unlocks at level 4 and triggers with Jyoon basic skill", () => {
    const simulator = new BattleSimulator();
    const jyoon = createBattleUnit({
      id: "hero-jyoon",
      sourceUnitId: "jyoon",
      type: "vanguard",
      unitLevel: 4,
      attackPower: 20,
      attackSpeed: 20,
      attackRange: 1,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-dummy",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      type: "ranger",
      hp: 1000,
      maxHp: 1000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 1,
    });
    const leftPlacements: BoardUnitPlacement[] = [{
      cell: 0,
      unitType: "vanguard",
      unitLevel: 4,
      unitId: "jyoon",
      subUnit: {
        unitType: "assassin",
        unitLevel: 4,
        unitId: "shion",
      },
    }];

    const result = simulator.simulateBattle([jyoon], [enemy], leftPlacements, [], 700);

    expect(jyoon.buffModifiers.attackMultiplier).toBeCloseTo(1.35 * 1.1);
    expect(enemy.buffModifiers.attackMultiplier).toBe(0.85);
    expect(result.combatLog.some((entry) => entry.includes("最凶最悪の双子神 Lv1"))).toBe(true);
  });

  test("shion pair skill gets stronger at level 7", () => {
    const simulator = new BattleSimulator();
    const jyoon = createBattleUnit({
      id: "hero-jyoon",
      sourceUnitId: "jyoon",
      type: "vanguard",
      unitLevel: 7,
      attackPower: 20,
      attackSpeed: 20,
      attackRange: 1,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-dummy",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      type: "ranger",
      hp: 1000,
      maxHp: 1000,
      attackPower: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      cell: 1,
    });
    const leftPlacements: BoardUnitPlacement[] = [{
      cell: 0,
      unitType: "vanguard",
      unitLevel: 7,
      unitId: "jyoon",
      subUnit: {
        unitType: "assassin",
        unitLevel: 7,
        unitId: "shion",
      },
    }];

    const result = simulator.simulateBattle([jyoon], [enemy], leftPlacements, [], 700);

    expect(jyoon.buffModifiers.attackMultiplier).toBeCloseTo(1.65 * 1.2);
    expect(enemy.buffModifiers.attackMultiplier).toBe(0.70);
    expect(result.combatLog.some((entry) => entry.includes("最凶最悪の双子神 Lv2"))).toBe(true);
  });

  test("mayumi pair skill unlocks at level 4 and triggers with Keiki basic skill", () => {
    const simulator = new BattleSimulator();
    const keiki = createBattleUnit({
      id: "hero-keiki",
      sourceUnitId: "keiki",
      type: "mage",
      unitLevel: 4,
      hp: 1000,
      maxHp: 1000,
      attackPower: 20,
      attackSpeed: 20,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-attacker",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      hp: 500,
      maxHp: 500,
      attackPower: 0,
      attackSpeed: 0,
      attackRange: 4,
      movementSpeed: 0,
      cell: 3,
    });
    const leftPlacements: BoardUnitPlacement[] = [{
      cell: 0,
      unitType: "mage",
      unitLevel: 4,
      unitId: "keiki",
      subUnit: {
        unitType: "vanguard",
        unitLevel: 4,
        unitId: "mayumi",
      },
    }];

    const result = simulator.simulateBattle([keiki], [enemy], leftPlacements, [], 700);

    expect(keiki.shieldAmount).toBeCloseTo(150);
    expect(keiki.buffModifiers.attackMultiplier).toBeCloseTo(1.24 * 1.15);
    expect(result.combatLog.some((entry) => entry.includes("埴輪「アイドルクリーチャー」 Lv1"))).toBe(true);
  });

  test("hero-attached exclusive sub units bind pair skills without board placements", () => {
    const simulator = new BattleSimulator();
    const keiki = createBattleUnit({
      id: "hero-keiki",
      sourceUnitId: "keiki",
      type: "mage",
      unitLevel: 4,
      hp: 1000,
      maxHp: 1000,
      attackPower: 20,
      attackSpeed: 20,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
      attachedSubUnit: {
        unitType: "vanguard",
        unitLevel: 4,
        unitId: "mayumi",
      },
    });
    const enemy = createBattleUnit({
      id: "right-attacker",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      hp: 500,
      maxHp: 500,
      attackPower: 0,
      attackSpeed: 0,
      attackRange: 4,
      movementSpeed: 0,
      cell: 3,
    });

    const result = simulator.simulateBattle([keiki], [enemy], [], [], 700);

    expect(keiki.shieldAmount).toBeCloseTo(150);
    expect(result.combatLog.some((entry) => entry.includes("埴輪「アイドルクリーチャー」 Lv1"))).toBe(true);
  });

  test("hero-attached okina schedules the back-side sub effect", () => {
    const simulator = new BattleSimulator();
    const host = createBattleUnit({
      id: "hero-reimu",
      sourceUnitId: "reimu",
      type: "vanguard",
      unitLevel: 4,
      attackPower: 20,
      attackSpeed: 0,
      attackRange: 1,
      movementSpeed: 0,
      cell: 0,
      attachedSubUnit: {
        unitType: "vanguard",
        unitLevel: 7,
        unitId: "okina",
      },
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
      cell: 1,
    });

    const result = simulator.simulateBattle([host], [enemy], [], [], 7100);

    expect(host.buffModifiers.attackMultiplier).toBeCloseTo(1.85);
    expect(result.combatLog.some((entry) => entry.includes("秘神「裏表の逆転:裏」"))).toBe(true);
  });

  test("hero-attached okina applies the common sub equipment bonus", () => {
    const simulator = new BattleSimulator();
    const host = createBattleUnit({
      id: "host-unit",
      sourceUnitId: "host-unit",
      type: "vanguard",
      hp: 1000,
      maxHp: 1000,
      attackPower: 50,
      attackSpeed: 0,
      attackRange: 1,
      movementSpeed: 0,
      cell: 0,
      attachedSubUnit: {
        unitType: "mage",
        combatClass: "mage",
        unitLevel: 4,
        unitId: "okina",
      },
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
      cell: 1,
    });

    const resolvedBonus = resolveSubUnitEquipmentBonus("okina", 4);
    const resolvedLevel7Bonus = resolveSubUnitEquipmentBonus("okina", 7);
    const result = simulator.simulateBattle([host], [enemy], [], [], 100);

    expect(resolvedBonus?.bonus).toEqual({
      attackBonus: 34,
      skillDamageMultiplier: 1.17,
    });
    expect(resolvedLevel7Bonus?.bonus).toEqual({
      attackBonus: 56,
      skillDamageMultiplier: 1.28,
    });
    expect(host.attackPower).toBe(84);
    expect(host.ultimateDamageMultiplier).toBeCloseTo(1.17);
    expect(result.combatLog.some((entry) =>
      entry.includes("gains sub equipment bonus (摩多羅隠岐奈): +34 ATK, Skill x1.17")
    )).toBe(true);
  });

  test("mayumi pair skill gets stronger at level 7", () => {
    const simulator = new BattleSimulator();
    const keiki = createBattleUnit({
      id: "hero-keiki",
      sourceUnitId: "keiki",
      type: "mage",
      unitLevel: 7,
      hp: 1000,
      maxHp: 1000,
      attackPower: 20,
      attackSpeed: 20,
      attackRange: 4,
      movementSpeed: 0,
      cell: 0,
    });
    const enemy = createBattleUnit({
      id: "right-attacker",
      sourceUnitId: "enemy-1",
      battleSide: "right",
      hp: 500,
      maxHp: 500,
      attackPower: 0,
      attackSpeed: 0,
      attackRange: 4,
      movementSpeed: 0,
      cell: 3,
    });
    const leftPlacements: BoardUnitPlacement[] = [{
      cell: 0,
      unitType: "mage",
      unitLevel: 7,
      unitId: "keiki",
      subUnit: {
        unitType: "vanguard",
        unitLevel: 7,
        unitId: "mayumi",
      },
    }];

    const result = simulator.simulateBattle([keiki], [enemy], leftPlacements, [], 700);

    expect(keiki.shieldAmount).toBeCloseTo(250);
    expect(keiki.buffModifiers.attackMultiplier).toBeCloseTo(1.38 * 1.25);
    expect(result.combatLog.some((entry) => entry.includes("埴輪「アイドルクリーチャー」 Lv2"))).toBe(true);
  });

  test("pair skills do not bind when the hero system flag is disabled", () => {
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
      attackPower: 0,
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

    const result = simulator.simulateBattle(
      [host],
      [enemy],
      leftPlacements,
      [],
      1200,
      null,
      null,
      null,
      { ...DEFAULT_FLAGS, enableHeroSystem: false },
    );

    expect(host.buffModifiers.defenseMultiplier).toBe(1);
    expect(result.combatLog.some((entry) => entry.includes("mayumi-pair"))).toBe(false);
  });

  test("pair skills do not bind when the Touhou roster flag is disabled", () => {
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

    const result = simulator.simulateBattle(
      [host],
      [enemy],
      leftPlacements,
      [],
      1200,
      null,
      null,
      null,
      { ...DEFAULT_FLAGS, enableTouhouRoster: false },
    );

    expect(host.buffModifiers.defenseMultiplier).toBe(1);
    expect(result.combatLog.some((entry) => entry.includes("mayumi-pair"))).toBe(false);
  });
});
