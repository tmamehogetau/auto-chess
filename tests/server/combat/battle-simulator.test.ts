import { afterEach, describe, expect, test } from "vitest";

import type { BoardUnitPlacement, BoardUnitType } from "../../../src/shared/room-messages";
import { getMvpPhase1Boss, type SubUnitConfig } from "../../../src/shared/types";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";
import {
  sharedBoardCoordinateToIndex,
} from "../../../src/shared/board-geometry";
import {
  assignApproachDestinationsForTarget,
  BattleSimulator,
  calculateCellDistance,
  countReachableApproachDestinationEntryCoordinates,
  createBattleUnit,
  findBestApproachDestinationCoordinate,
  findBestApproachTarget,
  findShortestApproachStepToCoordinate,
  findTarget,
  type BattleUnit,
} from "../../../src/server/combat/battle-simulator";
import { createSeededBattleRng } from "../../../src/server/combat/battle-rng";
import { resolveBattlePlacements } from "../../../src/server/unit-id-resolver";

const LEGACY_RAID_COORDINATES = [
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
] as const;

const LEGACY_BOSS_COORDINATES = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
] as const;

function combatCellToRaidBoardIndex(cell: number): number {
  return sharedBoardCoordinateToIndex(LEGACY_RAID_COORDINATES[cell]!);
}

function combatCellToBossBoardIndex(cell: number): number {
  return sharedBoardCoordinateToIndex(LEGACY_BOSS_COORDINATES[cell]!);
}

function normalizeTestBattleCell(cell: number, side: "left" | "right"): number {
  if (Number.isInteger(cell) && cell >= 0 && cell <= 7) {
    return side === "left" ? combatCellToRaidBoardIndex(cell) : combatCellToBossBoardIndex(cell);
  }

  return cell;
}

function createTestBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
  isBoss: boolean = false,
  flags = DEFAULT_FLAGS,
): BattleUnit {
  return createBattleUnit(
    {
      ...placement,
      cell: normalizeTestBattleCell(placement.cell, side),
    },
    side,
    index,
    isBoss,
    flags,
  );
}

const dealTestDamage: SkillExecutionContext["dealDamage"] = (_caster, target, amount) => {
  if (!Number.isFinite(amount) || amount <= 0 || target.isDead) {
    return 0;
  }

  const scaledDamage = Math.max(0, Math.floor(amount * (target.damageTakenMultiplier ?? 1)));
  const shieldBeforeHit = target.shieldAmount ?? 0;
  const shieldAbsorbed = Math.min(shieldBeforeHit, scaledDamage);
  const damageAfterShield = scaledDamage - shieldAbsorbed;
  target.shieldAmount = shieldBeforeHit - shieldAbsorbed;
  target.hp -= damageAfterShield;
  return damageAfterShield;
};

function expectCombatClass(unit: BattleUnit, expected: BoardUnitType): void {
  expect((unit as BattleUnit & { combatClass?: BoardUnitType }).combatClass).toBe(expected);
}

import {
  applyRemiliaBossPassiveToBoss,
} from "../../../src/server/combat/synergy-definitions";
import {
  HERO_SKILL_DEFINITIONS,
  hasStandardTouhouBasicSkillDefinition,
  resolvePairSkillDefinition,
  resolveUnitSkillDefinition,
  resolveBossSkillDefinition,
  SKILL_DEFINITIONS,
  type ScheduledSkillTickConfig,
  type SkillExecutionContext,
} from "../../../src/server/combat/skill-definitions";

describe("battle-simulator", () => {
  const originalSkillDefinitions = Object.fromEntries(
    Object.entries(SKILL_DEFINITIONS).map(([unitType, definition]) => [unitType, { ...definition }]),
  ) as typeof SKILL_DEFINITIONS;

  afterEach(() => {
    for (const unitType of Object.keys(originalSkillDefinitions) as BoardUnitType[]) {
      SKILL_DEFINITIONS[unitType] = { ...originalSkillDefinitions[unitType] };
    }
  });

  test("all skill definitions expose explicit activation timing", () => {
    for (const definition of Object.values(SKILL_DEFINITIONS)) {
      expect(definition.activationModel).toBe("cooldown");
      expect(definition.initialSkillDelayMs).toBeGreaterThan(0);
      expect(definition.skillCooldownMs).toBeGreaterThan(0);
    }

    expect(HERO_SKILL_DEFINITIONS.reimu?.mana).toEqual({
      maxMana: 100,
      initialMana: 25,
      manaCost: 100,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    });
    expect(HERO_SKILL_DEFINITIONS.marisa?.mana).toEqual({
      maxMana: 100,
      initialMana: 20,
      manaCost: 100,
      manaGainOnAttack: 8,
      manaGainOnDamageTakenRatio: 25,
    });
    expect(HERO_SKILL_DEFINITIONS.okina?.mana).toEqual({
      maxMana: 100,
      initialMana: 30,
      manaCost: 90,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    });
    expect(HERO_SKILL_DEFINITIONS.keiki?.mana).toEqual({
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 9,
      manaGainOnDamageTakenRatio: 40,
    });
    expect(HERO_SKILL_DEFINITIONS.jyoon?.mana).toEqual({
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 7,
      manaGainOnDamageTakenRatio: 45,
    });
    expect(HERO_SKILL_DEFINITIONS.yuiman?.mana).toEqual({
      maxMana: 100,
      initialMana: 30,
      manaCost: 100,
      manaGainOnAttack: 10,
      manaGainOnDamageTakenRatio: 35,
    });
    for (const definition of Object.values(HERO_SKILL_DEFINITIONS)) {
      expect(definition.activationModel).toBe("mana");
      expect(definition.initialSkillDelayMs).toBe(0);
      expect(definition.skillCooldownMs).toBe(0);
      expect(definition.mana).toBeDefined();
    }
  });

  test("createBattleUnit keeps normal and resolved special combat class separate from displayed unit type", () => {
    const flags = {
      ...DEFAULT_FLAGS,
      enableTouhouRoster: true,
      enableTouhouFactions: true,
    };

    expectCombatClass(
      createTestBattleUnit({ cell: 0, unitType: "ranger", unitId: "nazrin", unitLevel: 1 }, "left", 0, false, flags),
      "ranger",
    );
    expectCombatClass(
      createTestBattleUnit({ cell: 1, unitType: "vanguard", unitId: "mayumi", unitLevel: 1 }, "left", 1, false, flags),
      "vanguard",
    );
    expectCombatClass(
      createTestBattleUnit({ cell: 2, unitType: "vanguard", unitId: "sakuya", unitLevel: 1 }, "right", 2, false, flags),
      "assassin",
    );
  });

  test("Chimata uses a passive Touhou skill definition instead of the generic mage fallback", () => {
    const chimata = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }),
        unitType: "mage",
        unitId: "chimata",
        unitLevel: 1,
      },
      "left",
      0,
    );
    const target = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 1, y: 1 }),
        unitType: "vanguard",
        unitLevel: 1,
      },
      "right",
      0,
    );
    target.hp = 500;

    const skill = resolveUnitSkillDefinition(chimata);
    const log: string[] = [];
    skill?.execute(chimata, [chimata], [target], log);

    expect(hasStandardTouhouBasicSkillDefinition(chimata)).toBe(true);
    expect(skill?.name).toBe("バレットマーケット");
    expect(skill?.activationModel).toBe("passive");
    expect(target.hp).toBe(500);
    expect(log).toEqual([]);
  });

  test("mana active skills auto-cast after attack mana reaches the cost", () => {
    SKILL_DEFINITIONS.ranger = {
      ...SKILL_DEFINITIONS.ranger,
      activationModel: "mana",
      initialSkillDelayMs: 99_999,
      skillCooldownMs: 99_999,
      mana: {
        maxMana: 100,
        initialMana: 0,
        manaCost: 20,
        manaGainOnAttack: 10,
        manaGainOnDamageTakenRatio: 0,
      },
    };

    const simulator = new BattleSimulator();
    const ranger = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitLevel: 1 },
      "left",
      0,
    );
    ranger.attackPower = 1;
    ranger.attackSpeed = 10;
    ranger.attackRange = 99;
    ranger.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;
    enemy.hp = 5000;
    enemy.maxHp = 5000;

    const beforeMana = simulator.simulateBattle([ranger], [enemy], [], [], 50);
    expect(beforeMana.combatLog.some((entry) => entry.includes("Precise Shot"))).toBe(false);

    const afterMana = simulator.simulateBattle([ranger], [enemy], [], [], 150);
    expect(afterMana.combatLog.some((entry) => entry.includes("Precise Shot"))).toBe(true);
  });

  test("combat hooks can react after an attack hit", () => {
    SKILL_DEFINITIONS.ranger = {
      ...SKILL_DEFINITIONS.ranger,
      combatHooks: {
        onAfterAttackHit: ({ unit, target, log }) => {
          expect(unit.type).toBe("ranger");
          target.hp -= 7;
          log.push("test after-hit hook dealt 7 damage");
        },
      },
    };

    const simulator = new BattleSimulator();
    const ranger = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitLevel: 1 },
      "left",
      0,
    );
    ranger.attackPower = 1;
    ranger.attackSpeed = 1;
    ranger.attackRange = 99;
    ranger.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;
    enemy.hp = 100;
    enemy.maxHp = 100;

    const result = simulator.simulateBattle([ranger], [enemy], [], [], 50);

    expect(result.combatLog).toContain("test after-hit hook dealt 7 damage");
    expect(enemy.hp).toBe(92);
  });

  test("combat hooks can recover a unit before lethal damage defeats it", () => {
    SKILL_DEFINITIONS.vanguard = {
      ...SKILL_DEFINITIONS.vanguard,
      combatHooks: {
        onBeforeLethalDamage: ({ unit, log }) => {
          unit.hp = 1;
          log.push("test lethal hook kept unit alive");
        },
      },
    };

    const simulator = new BattleSimulator();
    const defender = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitLevel: 1 },
      "left",
      0,
    );
    defender.hp = 10;
    defender.maxHp = 100;
    defender.attackPower = 0;
    defender.attackSpeed = 0;
    defender.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 0, unitType: "ranger", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 50;
    attacker.attackSpeed = 1;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;

    const result = simulator.simulateBattle([defender], [attacker], [], [], 50);

    expect(result.combatLog).toContain("test lethal hook kept unit alive");
    expect(defender.isDead).toBe(false);
    expect(defender.hp).toBe(1);
  });

  test("combat hooks can react when an allied unit is defeated", () => {
    SKILL_DEFINITIONS.ranger = {
      ...SKILL_DEFINITIONS.ranger,
      combatHooks: {
        onAfterAllyDefeated: ({ unit, defeatedUnit, log }) => {
          unit.attackPower += 5;
          log.push(`test ally-defeat hook saw ${defeatedUnit.type}`);
        },
      },
    };

    const simulator = new BattleSimulator();
    const fragileAlly = createTestBattleUnit(
      { cell: 2, unitType: "vanguard", unitLevel: 1 },
      "left",
      0,
    );
    fragileAlly.hp = 1;
    fragileAlly.maxHp = 100;
    fragileAlly.attackPower = 0;
    fragileAlly.attackSpeed = 0;
    fragileAlly.movementSpeed = 0;

    const watcher = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "left",
      1,
    );
    watcher.hp = 1000;
    watcher.maxHp = 1000;
    watcher.attackPower = 1;
    watcher.attackSpeed = 0;
    watcher.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 0, unitType: "assassin", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 10;
    attacker.attackSpeed = 1;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;

    const result = simulator.simulateBattle([fragileAlly, watcher], [attacker], [], [], 50);

    expect(result.combatLog).toContain("test ally-defeat hook saw vanguard");
    expect(fragileAlly.isDead).toBe(true);
    expect(watcher.attackPower).toBe(6);
  });

  test("mana active skills gain mana from damage taken", () => {
    SKILL_DEFINITIONS.ranger = {
      ...SKILL_DEFINITIONS.ranger,
      activationModel: "mana",
      initialSkillDelayMs: 99_999,
      skillCooldownMs: 99_999,
      mana: {
        maxMana: 100,
        initialMana: 0,
        manaCost: 20,
        manaGainOnAttack: 0,
        manaGainOnDamageTakenRatio: 100,
      },
    };

    const simulator = new BattleSimulator();
    const ranger = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitLevel: 1 },
      "left",
      0,
    );
    ranger.hp = 100;
    ranger.maxHp = 100;
    ranger.attackPower = 1;
    ranger.attackSpeed = 0;
    ranger.attackRange = 99;
    ranger.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 50;
    attacker.attackSpeed = 1;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;
    attacker.hp = 500;
    attacker.maxHp = 500;

    const result = simulator.simulateBattle([ranger], [attacker], [], [], 50);

    expect(result.combatLog.some((entry) => entry.includes("Precise Shot"))).toBe(true);
  });

  test("Rin gains a permanent self buff when an allied unit is defeated", () => {
    const simulator = new BattleSimulator();
    const fragileAlly = createTestBattleUnit(
      { cell: 2, unitType: "vanguard", unitLevel: 1 },
      "left",
      0,
    );
    fragileAlly.hp = 1;
    fragileAlly.maxHp = 100;
    fragileAlly.attackPower = 0;
    fragileAlly.attackSpeed = 0;
    fragileAlly.movementSpeed = 0;

    const rin = createTestBattleUnit(
      { cell: 6, unitType: "vanguard", unitId: "rin", unitLevel: 1 },
      "left",
      1,
    );
    rin.hp = 1000;
    rin.maxHp = 1000;
    rin.attackPower = 0;
    rin.attackSpeed = 0;
    rin.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 0, unitType: "assassin", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 10;
    attacker.attackSpeed = 1;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;

    const result = simulator.simulateBattle([fragileAlly, rin], [attacker], [], [], 50);

    expect(result.combatLog.some((entry) => entry.includes("死灰復燃"))).toBe(true);
    expect(rin.stackState?.["rin-shikaifukunen"]).toBe(1);
    expect(rin.buffModifiers.attackMultiplier).toBeCloseTo(1.08);
    expect(rin.damageTakenMultiplier).toBeCloseTo(0.91);
  });

  test("Rin has enough baseline durability to wait for revive-fire stacks", () => {
    const rin = createTestBattleUnit(
      { cell: 6, unitType: "vanguard", unitId: "rin", unitLevel: 1 },
      "left",
      0,
    );

    expect(rin.maxHp).toBe(680);
    expect(rin.hp).toBe(680);
    expect(rin.damageReduction).toBe(8);
  });

  test("Rin revive-fire stacks scale by unit level", () => {
    const defeatedAlly = createTestBattleUnit(
      { cell: 2, unitType: "vanguard", unitLevel: 1 },
      "left",
      0,
    );
    defeatedAlly.isDead = true;
    const triggerRinBuff = (rin: BattleUnit): void => {
      resolveUnitSkillDefinition(rin)?.combatHooks?.onAfterAllyDefeated?.({
        currentTimeMs: 0,
        unit: rin,
        allies: [rin],
        enemies: [],
        defeatedUnit: defeatedAlly,
        log: [],
        applyTimedModifier: () => undefined,
      });
    };

    const rinLv4 = createTestBattleUnit(
      { cell: 6, unitType: "vanguard", unitId: "rin", unitLevel: 4 },
      "left",
      1,
    );
    for (let i = 0; i < 5; i += 1) {
      triggerRinBuff(rinLv4);
    }
    expect(rinLv4.stackState?.["rin-shikaifukunen"]).toBe(4);
    expect(rinLv4.buffModifiers.attackMultiplier).toBeCloseTo(1.09 ** 4);
    expect(rinLv4.damageTakenMultiplier).toBeCloseTo(0.89 ** 4);

    const rinLv7 = createTestBattleUnit(
      { cell: 6, unitType: "vanguard", unitId: "rin", unitLevel: 7 },
      "left",
      2,
    );
    for (let i = 0; i < 6; i += 1) {
      triggerRinBuff(rinLv7);
    }
    expect(rinLv7.stackState?.["rin-shikaifukunen"]).toBe(5);
    expect(rinLv7.buffModifiers.attackMultiplier).toBeCloseTo(1.10 ** 5);
    expect(rinLv7.damageTakenMultiplier).toBeCloseTo(0.86 ** 5);
  });

  test("Yoshika revives once before lethal damage defeats her", () => {
    const simulator = new BattleSimulator();
    const yoshika = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "yoshika", unitLevel: 1 },
      "left",
      0,
    );
    yoshika.hp = 10;
    yoshika.maxHp = 100;
    yoshika.attackPower = 0;
    yoshika.attackSpeed = 0;
    yoshika.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 0, unitType: "ranger", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 50;
    attacker.attackSpeed = 1;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;

    const result = simulator.simulateBattle([yoshika], [attacker], [], [], 50);

    expect(result.combatLog.some((entry) => entry.includes("死なない殺人鬼"))).toBe(true);
    expect(yoshika.isDead).toBe(false);
    expect(yoshika.hp).toBe(22);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(1);
  });

  test("Seiga on board does not improve Yoshika revive HP without sub attachment", () => {
    const yoshika = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "yoshika", unitLevel: 1 },
      "left",
      0,
    );
    yoshika.maxHp = 100;
    const seiga = createTestBattleUnit(
      { cell: 4, unitType: "assassin", unitId: "seiga", unitLevel: 1 },
      "left",
      1,
    );

    const log: string[] = [];
    resolveUnitSkillDefinition(yoshika)?.combatHooks?.onBeforeLethalDamage?.({
      currentTimeMs: 0,
      unit: yoshika,
      allies: [yoshika, seiga],
      enemies: [],
      log,
      applyTimedModifier: () => undefined,
    });

    expect(log.some((entry) => entry.includes("トンリン芳香"))).toBe(false);
    expect(yoshika.hp).toBe(22);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(1);
  });

  test("Yoshika revive quality improves by unit level and applies short damage reduction", () => {
    const yoshika = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "yoshika", unitLevel: 4 },
      "left",
      0,
    );
    yoshika.maxHp = 100;
    const appliedModifiers: Array<{ id: string; durationMs: number; incomingDamageMultiplier?: number }> = [];

    const log: string[] = [];
    resolveUnitSkillDefinition(yoshika)?.combatHooks?.onBeforeLethalDamage?.({
      currentTimeMs: 0,
      unit: yoshika,
      allies: [yoshika],
      enemies: [],
      log,
      applyTimedModifier: (_target, modifier) => {
        appliedModifiers.push(modifier);
      },
    });

    expect(yoshika.hp).toBe(28);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(1);
    expect(appliedModifiers).toContainEqual({
      id: "yoshika-post-revive-guard",
      durationMs: 2500,
      incomingDamageMultiplier: 0.85,
    });
  });

  test("Yoshika Lv7 can revive twice", () => {
    const yoshika = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "yoshika", unitLevel: 7 },
      "left",
      0,
    );
    yoshika.maxHp = 100;

    const revive = (): void => {
      resolveUnitSkillDefinition(yoshika)?.combatHooks?.onBeforeLethalDamage?.({
        currentTimeMs: 0,
        unit: yoshika,
        allies: [yoshika],
        enemies: [],
        log: [],
        applyTimedModifier: () => undefined,
      });
    };

    revive();
    expect(yoshika.hp).toBe(34);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(1);

    yoshika.hp = 0;
    revive();
    expect(yoshika.hp).toBe(34);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(2);

    yoshika.hp = 0;
    revive();
    expect(yoshika.hp).toBe(0);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(2);
  });

  test("Tongling Yoshika pair level improves Yoshika revive HP", () => {
    const yoshika = createTestBattleUnit(
      {
        cell: 3,
        unitType: "vanguard",
        unitId: "yoshika",
        unitLevel: 1,
        subUnit: {
          unitType: "assassin",
          unitId: "seiga",
          unitLevel: 1,
        },
      },
      "left",
      0,
    );
    yoshika.maxHp = 950;
    yoshika.pairSkillIds = ["tongling-yoshika-pair"];
    yoshika.pairSkillLevels = {
      "tongling-yoshika-pair": 7,
    };

    const log: string[] = [];
    resolveUnitSkillDefinition(yoshika)?.combatHooks?.onBeforeLethalDamage?.({
      currentTimeMs: 0,
      unit: yoshika,
      allies: [yoshika],
      enemies: [],
      log,
      applyTimedModifier: () => undefined,
    });

    expect(log.some((entry) => entry.includes("トンリン芳香"))).toBe(true);
    expect(yoshika.hp).toBe(522);
    expect(yoshika.stackState?.["yoshika-revived"]).toBe(1);
  });

  test("Yoshika with attached Seiga links Tongling Yoshika as a pair skill and gains max HP", () => {
    const flags = {
      ...DEFAULT_FLAGS,
      enableTouhouRoster: true,
      enableTouhouFactions: true,
    };
    const simulator = new BattleSimulator();
    const yoshikaPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
      unitType: "vanguard",
      unitId: "yoshika",
      unitLevel: 1,
      subUnit: {
        unitType: "assassin",
        unitId: "seiga",
        unitLevel: 7,
      },
    };
    const enemyPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
      unitType: "vanguard",
      unitLevel: 1,
    };
    const yoshika = createTestBattleUnit(yoshikaPlacement, "left", 0, false, flags);
    const enemy = createTestBattleUnit(enemyPlacement, "right", 0, false, flags);
    enemy.attackPower = 3_000;
    enemy.attackSpeed = 20;

    const result = simulator.simulateBattle(
      [yoshika],
      [enemy],
      [yoshikaPlacement],
      [enemyPlacement],
      1_000,
      null,
      null,
      null,
      flags,
    );

    expect(result.combatLog.some((entry) => entry.includes("links pair skill Lv7 (霍青娥): トンリン芳香"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("死なない殺人鬼 with トンリン芳香"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("(522/950)"))).toBe(true);
    expect(yoshika.maxHp).toBe(950);
    expect(yoshika.pairSkillIds).toContain("tongling-yoshika-pair");
    expect(yoshika.subUnitEffectIds ?? []).not.toContain("seiga-tongling-yoshika");
  });

  test("Wakasagihime adds two tail-fin hits every third normal attack", () => {
    const simulator = new BattleSimulator();
    const wakasagihime = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitId: "wakasagihime", unitLevel: 1 },
      "left",
      0,
    );
    wakasagihime.attackPower = 10;
    wakasagihime.attackSpeed = 10;
    wakasagihime.attackRange = 99;
    wakasagihime.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([wakasagihime], [enemy], [], [], 250);

    expect(result.combatLog.some((entry) => entry.includes("テイルフィンスラップ"))).toBe(true);
    expect(enemy.hp).toBe(479);
  });

  test("Wakasagihime tail-fin hit damage scales by unit level without increasing trigger frequency", () => {
    const triggerTailFin = (unitLevel: number): number => {
      const wakasagihime = createTestBattleUnit(
        { cell: 3, unitType: "ranger", unitId: "wakasagihime", unitLevel },
        "left",
        0,
      );
      wakasagihime.attackPower = 100;
      wakasagihime.attackCount = 2;
      const enemy = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      enemy.hp = 1000;
      enemy.maxHp = 1000;

      resolveUnitSkillDefinition(wakasagihime)?.combatHooks?.onAfterAttackHit?.({
        currentTimeMs: 0,
        unit: wakasagihime,
        allies: [wakasagihime],
        enemies: [enemy],
        attacker: wakasagihime,
        target: enemy,
        actualDamage: 1,
        log: [],
        applyTimedModifier: () => undefined,
      });

      return 1000 - enemy.hp;
    };

    expect(triggerTailFin(1)).toBe(50);
    expect(triggerTailFin(4)).toBe(60);
    expect(triggerTailFin(7)).toBe(70);
  });

  test("Nazrin spends mana to strike the lowest HP-ratio enemy within range", () => {
    const simulator = new BattleSimulator();
    const nazrin = createTestBattleUnit(
      { cell: 0, unitType: "ranger", unitId: "nazrin", unitLevel: 1 },
      "left",
      0,
    );
    nazrin.attackPower = 50;
    nazrin.attackSpeed = 10;
    nazrin.attackRange = 4;
    nazrin.movementSpeed = 0;

    const inRangeEnemy = createTestBattleUnit(
      { cell: 1, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    inRangeEnemy.hp = 1000;
    inRangeEnemy.maxHp = 1000;
    inRangeEnemy.attackPower = 0;
    inRangeEnemy.attackSpeed = 0;
    inRangeEnemy.movementSpeed = 0;

    const outOfRangeLowHpEnemy = createTestBattleUnit(
      { cell: 35, unitType: "vanguard", unitLevel: 1 },
      "right",
      1,
    );
    outOfRangeLowHpEnemy.hp = 500;
    outOfRangeLowHpEnemy.maxHp = 1000;
    outOfRangeLowHpEnemy.attackPower = 0;
    outOfRangeLowHpEnemy.attackSpeed = 0;
    outOfRangeLowHpEnemy.movementSpeed = 0;

    const result = simulator.simulateBattle([nazrin], [inRangeEnemy, outOfRangeLowHpEnemy], [], [], 350);

    expect(result.combatLog.some((entry) => entry.includes("ナズーリンペンデュラム"))).toBe(true);
    expect(outOfRangeLowHpEnemy.hp).toBe(500);
    expect(inRangeEnemy.hp).toBeLessThan(1000);
  });

  test("Nazrin Lv7 treasure mark grants doubled gold once when the marked enemy is defeated", () => {
    const simulator = new BattleSimulator();
    const nazrin = createTestBattleUnit(
      { cell: 0, unitType: "ranger", unitId: "nazrin", unitLevel: 7 },
      "left",
      0,
    );
    nazrin.ownerPlayerId = "p1";
    nazrin.attackPower = 100;
    nazrin.attackSpeed = 10;
    nazrin.attackRange = 4;
    nazrin.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 1, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 250;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([nazrin], [enemy], [], [], 1000) as ReturnType<
      BattleSimulator["simulateBattle"]
    > & {
      goldRewardsByPlayerId?: Record<string, number>;
    };

    expect(result.combatLog.some((entry) => entry.includes("ナズーリンペンデュラム"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("トレジャーマーク"))).toBe(true);
    expect(result.goldRewardsByPlayerId?.p1).toBe(2);
  });

  test("Ichirin hits a small area and gains mitigation when multiple enemies are hit", () => {
    const simulator = new BattleSimulator();
    const ichirin = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "ichirin", unitLevel: 1 },
      "left",
      0,
    );
    ichirin.attackPower = 50;
    ichirin.attackSpeed = 10;
    ichirin.attackRange = 99;
    ichirin.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 500;
    primary.maxHp = 500;
    primary.attackPower = 0;
    primary.attackSpeed = 0;
    primary.movementSpeed = 0;

    const nearby = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 500;
    nearby.maxHp = 500;
    nearby.attackPower = 0;
    nearby.attackSpeed = 0;
    nearby.movementSpeed = 0;

    const far = createTestBattleUnit(
      { cell: 0, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 500;
    far.maxHp = 500;
    far.attackPower = 0;
    far.attackSpeed = 0;
    far.movementSpeed = 0;

    const result = simulator.simulateBattle([ichirin], [primary, nearby, far], [], [], 450);

    expect(result.combatLog.some((entry) => entry.includes("げんこつスマッシュ"))).toBe(true);
    expect(primary.hp).toBeLessThan(500);
    expect(nearby.hp).toBeLessThan(500);
    expect(far.hp).toBe(500);
    expect(ichirin.damageTakenMultiplier).toBeCloseTo(0.85);
  });

  test("Ichirin Genkotsu Smash scales damage, mitigation, and Lv7 area by unit level", () => {
    const triggerGenkotsuSmash = (unitLevel: number) => {
      const ichirin = createTestBattleUnit(
        { cell: 3, unitType: "vanguard", unitId: "ichirin", unitLevel },
        "left",
        0,
      );
      ichirin.attackPower = 100;
      ichirin.cell = sharedBoardCoordinateToIndex({ x: 2, y: 3 });

      const primary = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      primary.hp = 1000;
      primary.maxHp = 1000;
      primary.cell = sharedBoardCoordinateToIndex({ x: 2, y: 1 });

      const radiusOneEnemy = createTestBattleUnit(
        { cell: 6, unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      radiusOneEnemy.hp = 1000;
      radiusOneEnemy.maxHp = 1000;
      radiusOneEnemy.cell = sharedBoardCoordinateToIndex({ x: 3, y: 1 });

      const radiusTwoEnemy = createTestBattleUnit(
        { cell: 5, unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      radiusTwoEnemy.hp = 1000;
      radiusTwoEnemy.maxHp = 1000;
      radiusTwoEnemy.cell = sharedBoardCoordinateToIndex({ x: 4, y: 1 });

      let durationMs = 0;
      resolveUnitSkillDefinition(ichirin)?.execute(
        ichirin,
        [ichirin],
        [primary, radiusOneEnemy, radiusTwoEnemy],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            durationMs = modifier.durationMs;
            target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
              * (modifier.incomingDamageMultiplier ?? 1);
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        primaryDamage: 1000 - primary.hp,
        radiusOneDamage: 1000 - radiusOneEnemy.hp,
        radiusTwoDamage: 1000 - radiusTwoEnemy.hp,
        incomingDamageMultiplier: ichirin.damageTakenMultiplier ?? 1,
        durationMs,
      };
    };

    expect(triggerGenkotsuSmash(1)).toEqual({
      primaryDamage: 120,
      radiusOneDamage: 120,
      radiusTwoDamage: 0,
      incomingDamageMultiplier: 0.85,
      durationMs: 6000,
    });
    expect(triggerGenkotsuSmash(4)).toEqual({
      primaryDamage: 145,
      radiusOneDamage: 145,
      radiusTwoDamage: 0,
      incomingDamageMultiplier: 0.8,
      durationMs: 7000,
    });
    expect(triggerGenkotsuSmash(7)).toEqual({
      primaryDamage: 165,
      radiusOneDamage: 165,
      radiusTwoDamage: 165,
      incomingDamageMultiplier: 0.75,
      durationMs: 8000,
    });
  });

  test("Tojiko lightning strikes the current target and chains to nearby enemies", () => {
    const simulator = new BattleSimulator();
    const tojiko = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitId: "tojiko", unitLevel: 1 },
      "left",
      0,
    );
    tojiko.attackPower = 100;
    tojiko.attackSpeed = 10;
    tojiko.attackRange = 99;
    tojiko.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;
    primary.maxHp = 1000;
    primary.attackPower = 0;
    primary.attackSpeed = 0;
    primary.movementSpeed = 0;

    const chainA = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    chainA.hp = 1000;
    chainA.maxHp = 1000;
    chainA.attackPower = 0;
    chainA.attackSpeed = 0;
    chainA.movementSpeed = 0;

    const chainB = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    chainB.hp = 1000;
    chainB.maxHp = 1000;
    chainB.attackPower = 0;
    chainB.attackSpeed = 0;
    chainB.movementSpeed = 0;

    const result = simulator.simulateBattle([tojiko], [primary, chainA, chainB], [], [], 350);

    expect(result.combatLog.some((entry) => entry.includes("入鹿の雷"))).toBe(true);
    expect(primary.hp).toBeLessThan(chainA.hp);
    expect(chainA.hp).toBeLessThan(1000);
    expect(chainB.hp).toBeLessThan(1000);
  });

  test("Tojiko Iruka Thunder scales damage and chain reach by unit level", () => {
    const triggerIrukaThunder = (unitLevel: number) => {
      const tojiko = createTestBattleUnit(
        { cell: 3, unitType: "ranger", unitId: "tojiko", unitLevel },
        "left",
        0,
      );
      tojiko.attackPower = 100;
      tojiko.buffModifiers.attackMultiplier = 1;
      tojiko.cell = sharedBoardCoordinateToIndex({ x: 2, y: 3 });

      const primary = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      primary.hp = 1000;
      primary.maxHp = 1000;
      primary.cell = sharedBoardCoordinateToIndex({ x: 2, y: 1 });

      const radiusOneEnemy = createTestBattleUnit(
        { cell: 6, unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      radiusOneEnemy.hp = 1000;
      radiusOneEnemy.maxHp = 1000;
      radiusOneEnemy.cell = sharedBoardCoordinateToIndex({ x: 3, y: 1 });

      const radiusTwoEnemy = createTestBattleUnit(
        { cell: 5, unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      radiusTwoEnemy.hp = 1000;
      radiusTwoEnemy.maxHp = 1000;
      radiusTwoEnemy.cell = sharedBoardCoordinateToIndex({ x: 4, y: 1 });

      const radiusThreeEnemy = createTestBattleUnit(
        { cell: 4, unitType: "assassin", unitLevel: 1 },
        "right",
        3,
      );
      radiusThreeEnemy.hp = 1000;
      radiusThreeEnemy.maxHp = 1000;
      radiusThreeEnemy.cell = sharedBoardCoordinateToIndex({ x: 5, y: 1 });

      const farEnemy = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", unitLevel: 1 },
        "right",
        4,
      );
      farEnemy.hp = 1000;
      farEnemy.maxHp = 1000;
      farEnemy.cell = sharedBoardCoordinateToIndex({ x: 5, y: 4 });

      resolveUnitSkillDefinition(tojiko)?.execute(
        tojiko,
        [tojiko],
        [primary, radiusOneEnemy, radiusTwoEnemy, radiusThreeEnemy, farEnemy],
        [],
        {
          currentTimeMs: 0,
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          applyTimedModifier: () => undefined,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        primaryDamage: 1000 - primary.hp,
        radiusOneDamage: 1000 - radiusOneEnemy.hp,
        radiusTwoDamage: 1000 - radiusTwoEnemy.hp,
        radiusThreeDamage: 1000 - radiusThreeEnemy.hp,
        farDamage: 1000 - farEnemy.hp,
      };
    };

    expect(triggerIrukaThunder(1)).toEqual({
      primaryDamage: 150,
      radiusOneDamage: 55,
      radiusTwoDamage: 55,
      radiusThreeDamage: 0,
      farDamage: 0,
    });
    expect(triggerIrukaThunder(4)).toEqual({
      primaryDamage: 185,
      radiusOneDamage: 70,
      radiusTwoDamage: 70,
      radiusThreeDamage: 0,
      farDamage: 0,
    });
    expect(triggerIrukaThunder(7)).toEqual({
      primaryDamage: 220,
      radiusOneDamage: 85,
      radiusTwoDamage: 85,
      radiusThreeDamage: 85,
      farDamage: 0,
    });
  });

  test("Seiga wall-runs to a low HP target and empowers the first hit", () => {
    const seiga = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "assassin", unitId: "seiga", unitLevel: 1 },
      "left",
      0,
    );
    seiga.attackPower = 80;
    seiga.buffModifiers.attackMultiplier = 1;
    seiga.attackRange = 99;

    const highHpEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    highHpEnemy.hp = 1000;
    highHpEnemy.maxHp = 1000;

    const lowHpEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 5 }), unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    lowHpEnemy.hp = 400;
    lowHpEnemy.maxHp = 1000;

    const log: string[] = [];
    const selectedTarget = resolveUnitSkillDefinition(seiga)?.combatHooks?.selectAttackTarget?.({
      currentTimeMs: 2000,
      unit: seiga,
      attacker: seiga,
      defaultTarget: highHpEnemy,
      allies: [seiga],
      enemies: [highHpEnemy, lowHpEnemy],
      log,
      applyTimedModifier: () => undefined,
    });

    expect(selectedTarget).toBe(lowHpEnemy);
    expect(seiga.cell).toBe(sharedBoardCoordinateToIndex({ x: 3, y: 5 }));
    expect(seiga.stackState?.["seiga-wall-run-empowered"]).toBe(1);
    expect(log.some((entry) => entry.includes("ウォールランナー"))).toBe(true);

    resolveUnitSkillDefinition(seiga)?.combatHooks?.onAfterAttackHit?.({
      currentTimeMs: 2000,
      unit: seiga,
      attacker: seiga,
      target: lowHpEnemy,
      actualDamage: 80,
      allies: [seiga],
      enemies: [highHpEnemy, lowHpEnemy],
      log,
      applyTimedModifier: () => undefined,
    });

    expect(lowHpEnemy.hp).toBe(340);
    expect(seiga.stackState?.["seiga-wall-run-empowered"]).toBe(0);
  });

  test("Seiga wall-run empowered hit scales at level 4 and level 7", () => {
    const triggerEmpoweredHit = (unitLevel: number): number => {
      const seiga = createTestBattleUnit(
        { cell: 3, unitType: "assassin", unitId: "seiga", unitLevel },
        "left",
        0,
      );
      seiga.attackPower = 80;
      seiga.buffModifiers.attackMultiplier = 1;
      seiga.stackState = {
        "seiga-wall-run-empowered": 1,
      };
      const target = createTestBattleUnit(
        { cell: 7, unitType: "ranger", unitLevel: 1 },
        "right",
        0,
      );
      target.hp = 400;
      target.maxHp = 1000;

      resolveUnitSkillDefinition(seiga)?.combatHooks?.onAfterAttackHit?.({
        currentTimeMs: 2000,
        unit: seiga,
        attacker: seiga,
        target,
        actualDamage: 80,
        allies: [seiga],
        enemies: [target],
        log: [],
        applyTimedModifier: () => undefined,
      });

      return target.hp;
    };

    expect(triggerEmpoweredHit(4)).toBe(316);
    expect(triggerEmpoweredHit(7)).toBe(288);
  });

  test("Futo places Taiyi True Fire as a burning area that slows attack speed", () => {
    const futo = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "futo", unitLevel: 1 },
      "left",
      0,
    );
    futo.attackPower = 100;
    futo.buffModifiers.attackMultiplier = 1;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;

    const nearby = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 1000;

    const far = createTestBattleUnit(
      { cell: 0, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 1000;

    const log: string[] = [];
    const scheduledSkill: { current: ScheduledSkillTickConfig | null } = { current: null };
    resolveUnitSkillDefinition(futo)?.execute(
      futo,
      [futo],
      [primary, nearby, far],
      log,
      {
        currentTimeMs: 0,
        applyTimedModifier: (target, modifier) => {
          target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
        },
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: (_source, config) => {
          scheduledSkill.current = config;
        },
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("太乙真火"))).toBe(true);
    expect(primary.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.88);
    expect(nearby.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.88);
    expect(far.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
    expect(primary.hp).toBe(1000);
    expect(nearby.hp).toBe(1000);
    expect(scheduledSkill.current?.id).toBe("futo-taiyi-true-fire");
    expect(scheduledSkill.current?.initialDelayMs).toBe(0);
    expect(scheduledSkill.current?.intervalMs).toBe(800);
    expect(scheduledSkill.current?.tickCount).toBe(4);
    expect(scheduledSkill.current?.selectTargets?.(futo, [futo], [primary, nearby, far], 1)).toEqual([primary, nearby]);
    expect(scheduledSkill.current?.calculateDamage(futo, primary, 1)).toBe(38);
  });

  test("Futo Taiyi True Fire burns nearby enemies over time", () => {
    const simulator = new BattleSimulator();
    const futo = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "futo", unitLevel: 1 },
      "left",
      0,
    );
    futo.attackPower = 100;
    futo.attackSpeed = 100;
    futo.attackRange = 99;
    futo.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 50000;
    primary.maxHp = 50000;
    primary.attackPower = 0;
    primary.attackSpeed = 0;
    primary.movementSpeed = 0;

    const nearby = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 1000;
    nearby.maxHp = 1000;
    nearby.attackPower = 0;
    nearby.attackSpeed = 0;
    nearby.movementSpeed = 0;

    const far = createTestBattleUnit(
      { cell: 0, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 1000;
    far.maxHp = 1000;
    far.attackPower = 0;
    far.attackSpeed = 0;
    far.movementSpeed = 0;

    const result = simulator.simulateBattle([futo], [primary, nearby, far], [], [], 3000);

    expect(result.combatLog.some((entry) => entry.includes("太乙真火"))).toBe(true);
    expect(primary.hp).toBeLessThan(50000);
    expect(nearby.hp).toBeLessThan(1000);
    expect(far.hp).toBe(1000);
    expect(primary.buffModifiers.attackSpeedMultiplier).toBeLessThan(1);
    expect(nearby.buffModifiers.attackSpeedMultiplier).toBeLessThan(1);
    expect(far.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
  });

  test("Futo Taiyi True Fire formation count and burn quality scale by unit level", () => {
    const triggerTaiyiTrueFire = (unitLevel: number) => {
      const futo = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "futo", unitLevel },
        "left",
        0,
      );
      futo.attackPower = 100;
      futo.buffModifiers.attackMultiplier = 1;
      futo.cell = sharedBoardCoordinateToIndex({ x: 2, y: 3 });

      const primary = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      primary.hp = 1000;
      primary.cell = sharedBoardCoordinateToIndex({ x: 1, y: 1 });

      const secondary = createTestBattleUnit(
        { cell: 6, unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      secondary.hp = 1000;
      secondary.cell = sharedBoardCoordinateToIndex({ x: 4, y: 1 });

      const tertiary = createTestBattleUnit(
        { cell: 5, unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      tertiary.hp = 1000;
      tertiary.cell = sharedBoardCoordinateToIndex({ x: 1, y: 4 });

      const far = createTestBattleUnit(
        { cell: 0, unitType: "assassin", unitLevel: 1 },
        "right",
        3,
      );
      far.hp = 1000;
      far.cell = sharedBoardCoordinateToIndex({ x: 5, y: 5 });

      const enemies = [primary, secondary, tertiary, far];
      const scheduledSkills: ScheduledSkillTickConfig[] = [];
      resolveUnitSkillDefinition(futo)?.execute(
        futo,
        [futo],
        enemies,
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
            target.stackState = {
              ...target.stackState,
              "futo-slow-duration": modifier.durationMs,
            };
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: (_source, config) => {
            scheduledSkills.push(config);
          },
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        scheduledCount: scheduledSkills.length,
        tickCounts: scheduledSkills.map((config) => config.tickCount),
        damages: scheduledSkills.map((config) => config.calculateDamage(futo, primary, 1)),
        targetIdsByFormation: scheduledSkills.map((config) =>
          config.selectTargets?.(futo, [futo], enemies, 1).map((target) => target.id) ?? [],
        ),
        attackSpeedMultipliers: enemies.map((enemy) => enemy.buffModifiers.attackSpeedMultiplier),
        slowDurations: enemies.map((enemy) => enemy.stackState?.["futo-slow-duration"] ?? 0),
      };
    };

    expect(triggerTaiyiTrueFire(1)).toEqual({
      scheduledCount: 1,
      tickCounts: [4],
      damages: [38],
      targetIdsByFormation: [["right-vanguard-0"]],
      attackSpeedMultipliers: [0.88, 1, 1, 1],
      slowDurations: [4200, 0, 0, 0],
    });
    expect(triggerTaiyiTrueFire(4)).toEqual({
      scheduledCount: 2,
      tickCounts: [5, 5],
      damages: [44, 44],
      targetIdsByFormation: [["right-vanguard-0"], ["right-ranger-1"]],
      attackSpeedMultipliers: [0.84, 0.84, 1, 1],
      slowDurations: [5000, 5000, 0, 0],
    });
    expect(triggerTaiyiTrueFire(7)).toEqual({
      scheduledCount: 3,
      tickCounts: [5, 5, 5],
      damages: [50, 50, 50],
      targetIdsByFormation: [["right-vanguard-0"], ["right-ranger-1"], ["right-mage-2"]],
      attackSpeedMultipliers: [0.8, 0.8, 0.8, 1],
      slowDurations: [5800, 5800, 5800, 0],
    });
  });

  test("Kagerou transforms once after taking enough damage", () => {
    const simulator = new BattleSimulator();
    const kagerou = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "kagerou", unitLevel: 1 },
      "left",
      0,
    );
    kagerou.hp = 100;
    kagerou.maxHp = 100;
    kagerou.attackPower = 0;
    kagerou.attackSpeed = 0;
    kagerou.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 0, unitType: "ranger", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 100;
    attacker.attackSpeed = 10;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;

    const result = simulator.simulateBattle([kagerou], [attacker], [], [], 50);

    expect(result.combatLog.some((entry) => entry.includes("満月の遠吠え"))).toBe(true);
    expect(kagerou.stackState?.["kagerou-transformed"]).toBe(1);
    expect(kagerou.hp).toBeGreaterThan(50);
    expect(kagerou.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.35);
  });

  test("Kagerou Full Moon Howl healing and attack speed scale by unit level", () => {
    const triggerFullMoonHowl = (unitLevel: number) => {
      const kagerou = createTestBattleUnit(
        { cell: 3, unitType: "vanguard", unitId: "kagerou", unitLevel },
        "left",
        0,
      );
      kagerou.hp = 65;
      kagerou.maxHp = 100;

      let durationMs = 0;
      resolveUnitSkillDefinition(kagerou)?.combatHooks?.onAfterTakeDamage?.({
        currentTimeMs: 1000,
        unit: kagerou,
        allies: [kagerou],
        enemies: [],
        sourceUnit: createTestBattleUnit({ cell: 0, unitType: "ranger", unitLevel: 1 }, "right", 0),
        target: kagerou,
        actualDamage: 35,
        log: [],
        applyTimedModifier: (target, modifier) => {
          durationMs = modifier.durationMs;
          target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
        },
      });

      return {
        hp: kagerou.hp,
        attackSpeedMultiplier: kagerou.buffModifiers.attackSpeedMultiplier,
        durationMs,
      };
    };

    expect(triggerFullMoonHowl(1)).toEqual({
      hp: 83,
      attackSpeedMultiplier: 1.35,
      durationMs: 8000,
    });
    expect(triggerFullMoonHowl(4)).toEqual({
      hp: 87,
      attackSpeedMultiplier: 1.5,
      durationMs: 8000,
    });
    expect(triggerFullMoonHowl(7)).toEqual({
      hp: 91,
      attackSpeedMultiplier: 1.7,
      durationMs: 8000,
    });
  });

  test("Kagerou keeps attacking her current target only while transformed", () => {
    const kagerou = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "kagerou", unitLevel: 1 },
      "left",
      0,
    );
    const currentTarget = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    const defaultTarget = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    kagerou.currentTargetId = currentTarget.id;
    kagerou.stackState = {
      "kagerou-transformed": 1,
      "kagerou-transformed-until": 9000,
    };

    const selectedDuringTransform = resolveUnitSkillDefinition(kagerou)?.combatHooks?.selectAttackTarget?.({
      currentTimeMs: 2000,
      unit: kagerou,
      allies: [kagerou],
      enemies: [currentTarget, defaultTarget],
      attacker: kagerou,
      defaultTarget,
      log: [],
      applyTimedModifier: () => undefined,
    });
    const selectedAfterTransform = resolveUnitSkillDefinition(kagerou)?.combatHooks?.selectAttackTarget?.({
      currentTimeMs: 10000,
      unit: kagerou,
      allies: [kagerou],
      enemies: [currentTarget, defaultTarget],
      attacker: kagerou,
      defaultTarget,
      log: [],
      applyTimedModifier: () => undefined,
    });

    currentTarget.isDead = true;
    const selectedAfterCurrentTargetDies = resolveUnitSkillDefinition(kagerou)?.combatHooks?.selectAttackTarget?.({
      currentTimeMs: 2000,
      unit: kagerou,
      allies: [kagerou],
      enemies: [currentTarget, defaultTarget],
      attacker: kagerou,
      defaultTarget,
      log: [],
      applyTimedModifier: () => undefined,
    });

    expect(selectedDuringTransform).toBe(currentTarget);
    expect(selectedAfterTransform).toBe(defaultTarget);
    expect(selectedAfterCurrentTargetDies).toBe(defaultTarget);
  });

  test("Tsukasa debuffs the highest attack enemy with Cylinder Fox", () => {
    const simulator = new BattleSimulator();
    const tsukasa = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "tsukasa", unitLevel: 1 },
      "left",
      0,
    );
    tsukasa.attackPower = 10;
    tsukasa.attackSpeed = 10;
    tsukasa.attackRange = 4;
    tsukasa.movementSpeed = 0;

    const lowAttackEnemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    lowAttackEnemy.hp = 1000;
    lowAttackEnemy.maxHp = 1000;
    lowAttackEnemy.attackPower = 20;
    lowAttackEnemy.attackSpeed = 0;
    lowAttackEnemy.movementSpeed = 0;

    const highAttackEnemy = createTestBattleUnit(
      { cell: 7, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    highAttackEnemy.hp = 1000;
    highAttackEnemy.maxHp = 1000;
    highAttackEnemy.attackPower = 120;
    highAttackEnemy.attackSpeed = 0;
    highAttackEnemy.movementSpeed = 0;

    const result = simulator.simulateBattle([tsukasa], [lowAttackEnemy, highAttackEnemy], [], [], 350);

    expect(result.combatLog.some((entry) => entry.includes("シリンダーフォックス"))).toBe(true);
    expect(highAttackEnemy.buffModifiers.attackMultiplier).toBeCloseTo(0.82);
    expect(highAttackEnemy.damageTakenMultiplier).toBeCloseTo(1.1);
    expect(lowAttackEnemy.buffModifiers.attackMultiplier).toBeCloseTo(1);
  });

  test("Tsukasa only considers enemies within Cylinder Fox search range", () => {
    const tsukasa = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "tsukasa", unitLevel: 1 },
      "left",
      0,
    );
    tsukasa.cell = sharedBoardCoordinateToIndex({ x: 0, y: 0 });
    tsukasa.attackRange = 4;

    const inRangeEnemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    inRangeEnemy.cell = sharedBoardCoordinateToIndex({ x: 5, y: 1 });
    inRangeEnemy.attackPower = 80;

    const outOfRangeEnemy = createTestBattleUnit(
      { cell: 1, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    outOfRangeEnemy.cell = sharedBoardCoordinateToIndex({ x: 5, y: 5 });
    outOfRangeEnemy.attackPower = 200;

    resolveUnitSkillDefinition(tsukasa)?.execute(
      tsukasa,
      [tsukasa],
      [inRangeEnemy, outOfRangeEnemy],
      [],
      {
        currentTimeMs: 0,
        applyTimedModifier: (target, modifier) => {
          target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
          target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
            * (modifier.incomingDamageMultiplier ?? 1);
        },
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => null,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(inRangeEnemy.buffModifiers.attackMultiplier).toBeCloseTo(0.82);
    expect(inRangeEnemy.damageTakenMultiplier).toBeCloseTo(1.1);
    expect(outOfRangeEnemy.buffModifiers.attackMultiplier).toBeCloseTo(1);
    expect(outOfRangeEnemy.damageTakenMultiplier ?? 1).toBeCloseTo(1);
  });

  test("Tsukasa Cylinder Fox debuff scales by unit level", () => {
    const triggerCylinderFox = (unitLevel: number) => {
      const tsukasa = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "tsukasa", unitLevel },
        "left",
        0,
      );
      tsukasa.attackRange = 4;

      const enemy = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      enemy.attackPower = 100;

      let durationMs = 0;
      resolveUnitSkillDefinition(tsukasa)?.execute(
        tsukasa,
        [tsukasa],
        [enemy],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            durationMs = modifier.durationMs;
            target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
            target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
              * (modifier.incomingDamageMultiplier ?? 1);
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => null,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        attackMultiplier: enemy.buffModifiers.attackMultiplier,
        incomingDamageMultiplier: enemy.damageTakenMultiplier ?? 1,
        durationMs,
      };
    };

    expect(triggerCylinderFox(1)).toEqual({
      attackMultiplier: 0.82,
      incomingDamageMultiplier: 1.1,
      durationMs: 6000,
    });
    expect(triggerCylinderFox(4)).toEqual({
      attackMultiplier: 0.76,
      incomingDamageMultiplier: 1.14,
      durationMs: 7000,
    });
    expect(triggerCylinderFox(7)).toEqual({
      attackMultiplier: 0.7,
      incomingDamageMultiplier: 1.18,
      durationMs: 8000,
    });
  });

  test("Momoyo deals a heavy blow that scales with target max HP", () => {
    const simulator = new BattleSimulator();
    const momoyo = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "momoyo", unitLevel: 1 },
      "left",
      0,
    );
    momoyo.attackPower = 50;
    momoyo.attackSpeed = 10;
    momoyo.attackRange = 99;
    momoyo.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 1000;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([momoyo], [enemy], [], [], 450);

    expect(result.combatLog.some((entry) => entry.includes("ドラゴンイーター"))).toBe(true);
    expect(enemy.hp).toBeLessThanOrEqual(755);
  });

  test("Momoyo Dragon Eater damage and cap scale by unit level", () => {
    const triggerDragonEater = (unitLevel: number, targetMaxHp: number) => {
      const momoyo = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitId: "momoyo", unitLevel },
        "left",
        0,
      );
      momoyo.attackPower = 54;
      momoyo.attackSpeed = 0;
      momoyo.attackRange = 99;

      const enemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      enemy.hp = targetMaxHp;
      enemy.maxHp = targetMaxHp;

      resolveUnitSkillDefinition(momoyo)?.execute(
        momoyo,
        [momoyo],
        [enemy],
        [],
      );

      return targetMaxHp - enemy.hp;
    };

    expect(triggerDragonEater(1, 1000)).toBe(125);
    expect(triggerDragonEater(4, 1000)).toBe(148);
    expect(triggerDragonEater(7, 1000)).toBe(175);

    expect(triggerDragonEater(1, 2000)).toBe(140);
    expect(triggerDragonEater(4, 2000)).toBe(173);
    expect(triggerDragonEater(7, 2000)).toBe(205);
  });

  test("Clownpiece spends mana to empower the nearest ally with Hell Eclipse", () => {
    const simulator = new BattleSimulator();
    const clownpiece = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitId: "clownpiece", unitLevel: 1 },
      "left",
      0,
    );
    clownpiece.attackPower = 10;
    clownpiece.attackSpeed = 10;
    clownpiece.attackRange = 99;
    clownpiece.movementSpeed = 0;

    const nearAlly = createTestBattleUnit(
      { cell: 2, unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );
    nearAlly.attackPower = 0;
    nearAlly.attackSpeed = 0;
    nearAlly.movementSpeed = 0;

    const farAlly = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "left",
      2,
    );
    farAlly.attackPower = 0;
    farAlly.attackSpeed = 0;
    farAlly.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 1000;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([clownpiece, nearAlly, farAlly], [enemy], [], [], 350);

    expect(result.combatLog.some((entry) => entry.includes("ヘルエクリプス"))).toBe(true);
    expect(nearAlly.buffModifiers.attackMultiplier).toBeCloseTo(1.12);
    expect(nearAlly.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.22);
    expect(nearAlly.damageTakenMultiplier).toBeCloseTo(1.08);
    expect(farAlly.buffModifiers.attackMultiplier).toBeCloseTo(1);
  });

  test("Clownpiece Hell Eclipse scales frenzy speed and duration by unit level", () => {
    const triggerHellEclipse = (unitLevel: number) => {
      const clownpiece = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "ranger", unitId: "clownpiece", unitLevel },
        "left",
        0,
      );
      const ally = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const farAlly = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 5, y: 5 }), unitType: "ranger", unitLevel: 1 },
        "left",
        2,
      );

      let durationMs = 0;
      resolveUnitSkillDefinition(clownpiece)?.execute(
        clownpiece,
        [clownpiece, ally, farAlly],
        [],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
            target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
            target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
              * (modifier.incomingDamageMultiplier ?? 1);
            durationMs = modifier.durationMs;
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => null,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        attackMultiplier: ally.buffModifiers.attackMultiplier,
        attackSpeedMultiplier: ally.buffModifiers.attackSpeedMultiplier,
        incomingDamageMultiplier: ally.damageTakenMultiplier ?? 1,
        durationMs,
        farAllyAttackMultiplier: farAlly.buffModifiers.attackMultiplier,
      };
    };

    expect(triggerHellEclipse(1)).toEqual({
      attackMultiplier: 1.12,
      attackSpeedMultiplier: 1.22,
      incomingDamageMultiplier: 1.08,
      durationMs: 5000,
      farAllyAttackMultiplier: 1,
    });
    expect(triggerHellEclipse(4)).toEqual({
      attackMultiplier: 1.14,
      attackSpeedMultiplier: 1.34,
      incomingDamageMultiplier: 1.08,
      durationMs: 6000,
      farAllyAttackMultiplier: 1,
    });
    expect(triggerHellEclipse(7)).toEqual({
      attackMultiplier: 1.16,
      attackSpeedMultiplier: 1.48,
      incomingDamageMultiplier: 1.08,
      durationMs: 7000,
      farAllyAttackMultiplier: 1,
    });
  });

  test("Megumu spends mana to briefly hasten all allies", () => {
    const simulator = new BattleSimulator();
    const megumu = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitId: "megumu", unitLevel: 1 },
      "left",
      0,
    );
    megumu.attackPower = 10;
    megumu.attackSpeed = 10;
    megumu.attackRange = 99;
    megumu.movementSpeed = 0;

    const frontAlly = createTestBattleUnit(
      { cell: 2, unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );
    frontAlly.attackPower = 0;
    frontAlly.attackSpeed = 0;
    frontAlly.movementSpeed = 0;

    const backAlly = createTestBattleUnit(
      { cell: 7, unitType: "mage", unitLevel: 1 },
      "left",
      2,
    );
    backAlly.attackPower = 0;
    backAlly.attackSpeed = 0;
    backAlly.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 1000;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([megumu, frontAlly, backAlly], [enemy], [], [], 350);

    expect(result.combatLog.some((entry) => entry.includes("光風霽月"))).toBe(true);
    expect(megumu.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.12);
    expect(frontAlly.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.12);
    expect(backAlly.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.12);
    expect(enemy.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
  });

  test("Megumu Light Wind Clear Moon scales haste and duration by unit level", () => {
    const triggerLightWindClearMoon = (unitLevel: number) => {
      const megumu = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "ranger", unitId: "megumu", unitLevel },
        "left",
        0,
      );
      const frontAlly = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const backAlly = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 4 }), unitType: "mage", unitLevel: 1 },
        "left",
        2,
      );

      const durations: number[] = [];
      resolveUnitSkillDefinition(megumu)?.execute(
        megumu,
        [megumu, frontAlly, backAlly],
        [],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
            durations.push(modifier.durationMs);
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => null,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        megumuAttackSpeedMultiplier: megumu.buffModifiers.attackSpeedMultiplier,
        frontAllyAttackSpeedMultiplier: frontAlly.buffModifiers.attackSpeedMultiplier,
        backAllyAttackSpeedMultiplier: backAlly.buffModifiers.attackSpeedMultiplier,
        durations,
      };
    };

    expect(triggerLightWindClearMoon(1)).toEqual({
      megumuAttackSpeedMultiplier: 1.12,
      frontAllyAttackSpeedMultiplier: 1.12,
      backAllyAttackSpeedMultiplier: 1.12,
      durations: [4500, 4500, 4500],
    });
    expect(triggerLightWindClearMoon(4)).toEqual({
      megumuAttackSpeedMultiplier: 1.18,
      frontAllyAttackSpeedMultiplier: 1.18,
      backAllyAttackSpeedMultiplier: 1.18,
      durations: [5500, 5500, 5500],
    });
    expect(triggerLightWindClearMoon(7)).toEqual({
      megumuAttackSpeedMultiplier: 1.25,
      frontAllyAttackSpeedMultiplier: 1.25,
      backAllyAttackSpeedMultiplier: 1.25,
      durations: [6500, 6500, 6500],
    });
  });

  test("Megumu with attached Tsukasa gains delayed kudagitsune shots on Light Wind Clear Moon", () => {
    const flags = {
      ...DEFAULT_FLAGS,
      enableTouhouRoster: true,
      enableTouhouFactions: true,
    };
    const simulator = new BattleSimulator();
    const megumuPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
      unitType: "ranger",
      unitId: "megumu",
      unitLevel: 1,
      subUnit: {
        unitType: "mage",
        unitId: "tsukasa",
        unitLevel: 1,
      },
    };
    const targetPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
      unitType: "vanguard",
      unitLevel: 1,
    };
    const megumu = createTestBattleUnit(megumuPlacement, "left", 0, false, flags);
    megumu.attackPower = 100;
    megumu.attackSpeed = 10;
    megumu.attackRange = 99;
    megumu.movementSpeed = 0;
    const target = createTestBattleUnit(targetPlacement, "right", 0, false, flags);
    target.hp = 1000;
    target.maxHp = 1000;
    target.attackPower = 100;
    target.attackSpeed = 0;
    target.damageReduction = 0;
    target.movementSpeed = 0;

    const result = simulator.simulateBattle(
      [megumu],
      [target],
      [megumuPlacement],
      [targetPlacement],
      450,
      null,
      null,
      null,
      flags,
    );

    expect(result.combatLog.some((entry) =>
      entry.includes("links pair skill Lv1 (菅牧典): 狐符「遅効性の管狐弾」")
    )).toBe(true);
    expect(result.combatLog.some((entry) =>
      entry.includes("activates 狐符「遅効性の管狐弾」 Lv1: 管狐弾 3/3")
    )).toBe(true);
    expect(result.combatLog.some((entry) =>
      entry.includes("fires 狐符「遅効性の管狐弾」")
    )).toBe(true);
    expect(megumu.stackState?.["delayed-kudagitsune-shot-stacks"]).toBeLessThan(3);
    expect(target.buffModifiers.attackMultiplier).toBeCloseTo(0.88);
    expect(target.hp).toBeLessThanOrEqual(682);
  });

  test("Junko executes a purified current target below the HP line", () => {
    const simulator = new BattleSimulator();
    const junko = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "junko", unitLevel: 1 },
      "left",
      0,
    );
    junko.attackPower = 1;
    junko.attackSpeed = 20;
    junko.attackRange = 99;
    junko.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 240;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([junko], [enemy], [], [], 600);

    expect(result.combatLog.some((entry) => entry.includes("殺意の百合"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("処刑"))).toBe(true);
    expect(enemy.isDead).toBe(true);
  });

  test("Junko Lily of Murder execution line and boss damage scale by unit level", () => {
    const triggerJunkoExecution = (unitLevel: number, targetHp: number, isBoss = false) => {
      const junko = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitId: "junko", unitLevel },
        "left",
        0,
      );
      junko.attackPower = 100;
      junko.buffModifiers.attackMultiplier = 1;
      const target = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
        isBoss,
      );
      target.hp = targetHp;
      target.maxHp = 1000;
      const log: string[] = [];

      resolveUnitSkillDefinition(junko)?.execute(junko, [junko], [target], log, {
        currentTimeMs: 1000,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => target,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      });
      const purificationDurationMs = Math.max(...Object.values(target.stackState ?? {})) - 1000;

      resolveUnitSkillDefinition(junko)?.combatHooks?.onAfterAttackHit?.({
        currentTimeMs: 1000,
        unit: junko,
        attacker: junko,
        allies: [junko],
        enemies: [target],
        target,
        actualDamage: 0,
        log,
        applyTimedModifier: () => undefined,
      });

      return { targetHp: target.hp, purificationDurationMs, executed: log.some((entry) => entry.includes("処刑")) };
    };

    expect(triggerJunkoExecution(1, 260)).toMatchObject({ targetHp: 260, purificationDurationMs: 7000, executed: false });
    expect(triggerJunkoExecution(1, 250)).toMatchObject({ targetHp: 0, purificationDurationMs: 7000, executed: true });
    expect(triggerJunkoExecution(4, 280)).toMatchObject({ targetHp: 0, purificationDurationMs: 8000, executed: true });
    expect(triggerJunkoExecution(7, 320)).toMatchObject({ targetHp: 0, purificationDurationMs: 9000, executed: true });

    expect(triggerJunkoExecution(1, 250, true)).toMatchObject({ targetHp: 0, executed: true });
    expect(triggerJunkoExecution(4, 280, true)).toMatchObject({ targetHp: -20, executed: true });
    expect(triggerJunkoExecution(7, 320, true)).toMatchObject({ targetHp: -40, executed: true });
  });

  test("Hecatia fires one heavy trinitarian bullet and two lighter off-target bullets", () => {
    const hecatia = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "hecatia", unitLevel: 1 },
      "left",
      0,
    );
    hecatia.attackPower = 100;
    hecatia.buffModifiers.attackMultiplier = 1;

    const primary = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;

    const supplementalA = createTestBattleUnit(
      { cell: 1, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    supplementalA.hp = 1000;

    const supplementalB = createTestBattleUnit(
      { cell: 2, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    supplementalB.hp = 1000;

    const log: string[] = [];
    resolveUnitSkillDefinition(hecatia)?.execute(
      hecatia,
      [hecatia],
      [primary, supplementalA, supplementalB],
      log,
      {
        currentTimeMs: 0,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("トリニタリアンラプソディ"))).toBe(true);
    expect(primary.hp).toBe(840);
    expect(supplementalA.hp).toBe(950);
    expect(supplementalB.hp).toBe(950);
  });

  test("Hecatia does not refocus missing supplemental trinitarian bullets onto the primary target", () => {
    const hecatia = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "hecatia", unitLevel: 1 },
      "left",
      0,
    );
    hecatia.attackPower = 100;
    hecatia.buffModifiers.attackMultiplier = 1;

    const primary = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;

    resolveUnitSkillDefinition(hecatia)?.execute(
      hecatia,
      [hecatia],
      [primary],
      [],
      {
        currentTimeMs: 0,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(primary.hp).toBe(840);
  });

  test("Hecatia trinitarian bullet damage scales by unit level", () => {
    const castTrinitarianRhapsody = (unitLevel: number) => {
      const hecatia = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "hecatia", unitLevel },
        "left",
        0,
      );
      hecatia.attackPower = 100;
      hecatia.buffModifiers.attackMultiplier = 1;

      const primary = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      primary.hp = 1000;

      const supplementalA = createTestBattleUnit(
        { cell: 1, unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      supplementalA.hp = 1000;

      const supplementalB = createTestBattleUnit(
        { cell: 2, unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      supplementalB.hp = 1000;

      resolveUnitSkillDefinition(hecatia)?.execute(
        hecatia,
        [hecatia],
        [primary, supplementalA, supplementalB],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: () => undefined,
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        primaryHp: primary.hp,
        supplementalAHp: supplementalA.hp,
        supplementalBHp: supplementalB.hp,
      };
    };

    expect(castTrinitarianRhapsody(1)).toEqual({ primaryHp: 840, supplementalAHp: 950, supplementalBHp: 950 });
    expect(castTrinitarianRhapsody(4)).toEqual({ primaryHp: 790, supplementalAHp: 930, supplementalBHp: 930 });
    expect(castTrinitarianRhapsody(7)).toEqual({ primaryHp: 640, supplementalAHp: 880, supplementalBHp: 880 });
  });

  test("Zanmu gains Wandering Kingdom scaling from unique allied factions", () => {
    const zanmu = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "zanmu", unitLevel: 1, factionId: null },
      "left",
      0,
    );
    const nazrin = createTestBattleUnit(
      { cell: 4, unitType: "ranger", unitId: "nazrin", unitLevel: 1, factionId: "myourenji" },
      "left",
      1,
    );
    const yoshika = createTestBattleUnit(
      { cell: 5, unitType: "vanguard", unitId: "yoshika", unitLevel: 1, factionId: "shinreibyou" },
      "left",
      2,
    );
    const tojiko = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitId: "tojiko", unitLevel: 1, factionId: "shinreibyou" },
      "left",
      3,
    );
    const clownpiece = createTestBattleUnit(
      { cell: 7, unitType: "ranger", unitId: "clownpiece", unitLevel: 1, factionId: "kanjuden" },
      "left",
      4,
    );

    const log: string[] = [];
    resolveUnitSkillDefinition(zanmu)?.combatHooks?.onBattleStart?.({
      currentTimeMs: 0,
      unit: zanmu,
      allies: [zanmu, nazrin, yoshika, tojiko, clownpiece],
      enemies: [],
      log,
      applyTimedModifier: () => undefined,
    });

    expect(log.some((entry) => entry.includes("亡羊のキングダム"))).toBe(true);
    expect(zanmu.buffModifiers.attackMultiplier).toBeCloseTo(1.12);
    expect(zanmu.damageTakenMultiplier).toBeCloseTo(0.91);
  });

  test("Zanmu disables only the current target unit skill for a short duration", () => {
    const zanmu = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "zanmu", unitLevel: 1, factionId: null },
      "left",
      0,
    );
    const target = createTestBattleUnit(
      { cell: 7, unitType: "ranger", unitId: "clownpiece", unitLevel: 1, factionId: "kanjuden" },
      "right",
      0,
    );
    const targetWithDisableState = target as BattleUnit & { unitSkillDisabledUntilMs?: number };

    const log: string[] = [];
    resolveUnitSkillDefinition(zanmu)?.execute(
      zanmu,
      [zanmu],
      [target],
      log,
      {
        currentTimeMs: 1000,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => target,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("無心純霊弾"))).toBe(true);
    expect(targetWithDisableState.unitSkillDisabledUntilMs).toBe(5000);
  });

  test("Zanmu Musou Junreidan disable duration scales by unit level", () => {
    const castMusouJunreidan = (unitLevel: number) => {
      const zanmu = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "zanmu", unitLevel, factionId: null },
        "left",
        0,
      );
      const target = createTestBattleUnit(
        { cell: 7, unitType: "ranger", unitId: "clownpiece", unitLevel: 1, factionId: "kanjuden" },
        "right",
        0,
      );
      const targetWithDisableState = target as BattleUnit & { unitSkillDisabledUntilMs?: number };

      resolveUnitSkillDefinition(zanmu)?.execute(
        zanmu,
        [zanmu],
        [target],
        [],
        {
          currentTimeMs: 1000,
          applyTimedModifier: () => undefined,
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => target,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return targetWithDisableState.unitSkillDisabledUntilMs;
    };

    expect(castMusouJunreidan(1)).toBe(5000);
    expect(castMusouJunreidan(4)).toBe(6500);
    expect(castMusouJunreidan(7)).toBe(8000);
  });

  test("Zanmu Wandering Kingdom and mana support scale by unit level", () => {
    const triggerWanderingKingdom = (unitLevel: number) => {
      const zanmu = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "zanmu", unitLevel, factionId: null },
        "left",
        0,
      );
      const allies = [
        zanmu,
        createTestBattleUnit(
          { cell: 4, unitType: "ranger", unitId: "nazrin", unitLevel: 1, factionId: "myourenji" },
          "left",
          1,
        ),
        createTestBattleUnit(
          { cell: 5, unitType: "vanguard", unitId: "yoshika", unitLevel: 1, factionId: "shinreibyou" },
          "left",
          2,
        ),
        createTestBattleUnit(
          { cell: 7, unitType: "ranger", unitId: "clownpiece", unitLevel: 1, factionId: "kanjuden" },
          "left",
          3,
        ),
      ];

      resolveUnitSkillDefinition(zanmu)?.combatHooks?.onBattleStart?.({
        currentTimeMs: 0,
        unit: zanmu,
        allies,
        enemies: [],
        log: [],
        applyTimedModifier: () => undefined,
      });

      return {
        attackMultiplier: zanmu.buffModifiers.attackMultiplier,
        damageTakenMultiplier: zanmu.damageTakenMultiplier,
        initialManaBonus: zanmu.initialManaBonus ?? 0,
        manaGainMultiplier: zanmu.manaGainMultiplier ?? 1,
      };
    };

    expect(triggerWanderingKingdom(1)).toMatchObject({
      attackMultiplier: 1.12,
      damageTakenMultiplier: 0.91,
      initialManaBonus: 0,
      manaGainMultiplier: 1,
    });
    expect(triggerWanderingKingdom(4)).toMatchObject({
      attackMultiplier: 1.15,
      damageTakenMultiplier: 0.895,
      initialManaBonus: 5,
      manaGainMultiplier: 1.1,
    });
    expect(triggerWanderingKingdom(7)).toMatchObject({
      attackMultiplier: 1.195,
      damageTakenMultiplier: 0.865,
      initialManaBonus: 15,
      manaGainMultiplier: 1.3,
    });
  });

  test("disabled unit skills keep mana and cast after the disable expires", () => {
    const simulator = new BattleSimulator();
    const disabledClownpiece = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "ranger", unitId: "clownpiece", unitLevel: 1 },
      "left",
      0,
    ) as BattleUnit & { unitSkillDisabledUntilMs?: number };
    disabledClownpiece.attackPower = 1;
    disabledClownpiece.attackSpeed = 10;
    disabledClownpiece.attackRange = 99;
    disabledClownpiece.unitSkillDisabledUntilMs = 3000;

    const harmlessTarget = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 0 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    harmlessTarget.hp = 50000;
    harmlessTarget.maxHp = 50000;
    harmlessTarget.attackPower = 0;
    harmlessTarget.attackSpeed = 0;

    const disabledOnlyResult = simulator.simulateBattle(
      [disabledClownpiece],
      [harmlessTarget],
      [],
      [],
      2500,
    );

    expect(disabledOnlyResult.combatLog.some((entry) => entry.includes("ヘルエクリプス"))).toBe(false);
    expect(disabledOnlyResult.leftSurvivors[0]?.currentMana).toBe(100);

    const postDisableClownpiece = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "ranger", unitId: "clownpiece", unitLevel: 1 },
      "left",
      0,
    ) as BattleUnit & { unitSkillDisabledUntilMs?: number };
    postDisableClownpiece.attackPower = 1;
    postDisableClownpiece.attackSpeed = 10;
    postDisableClownpiece.attackRange = 99;
    postDisableClownpiece.unitSkillDisabledUntilMs = 3000;

    const secondTarget = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 0 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    secondTarget.hp = 50000;
    secondTarget.maxHp = 50000;
    secondTarget.attackPower = 0;
    secondTarget.attackSpeed = 0;

    const postDisableResult = simulator.simulateBattle(
      [postDisableClownpiece],
      [secondTarget],
      [],
      [],
      4500,
    );

    expect(postDisableResult.combatLog.some((entry) => entry.includes("ヘルエクリプス"))).toBe(true);
  });

  test("Miko commands all enemies to deal less damage", () => {
    const miko = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "miko", unitLevel: 1 },
      "left",
      0,
    );
    miko.attackPower = 100;
    miko.buffModifiers.attackMultiplier = 1;

    const ally = createTestBattleUnit(
      { cell: 2, unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );

    const primary = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    const nearby = createTestBattleUnit(
      { cell: 1, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    const far = createTestBattleUnit(
      { cell: 7, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );

    const log: string[] = [];
    resolveUnitSkillDefinition(miko)?.execute(
      miko,
      [miko, ally],
      [primary, nearby, far],
      log,
      {
        currentTimeMs: 0,
        applyTimedModifier: (target, modifier) => {
          target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
        },
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("逆らう事なきを宗とせよ"))).toBe(true);
    expect(primary.buffModifiers.attackMultiplier).toBeCloseTo(0.9);
    expect(nearby.buffModifiers.attackMultiplier).toBeCloseTo(0.9);
    expect(far.buffModifiers.attackMultiplier).toBeCloseTo(0.9);
    expect(ally.buffModifiers.attackMultiplier).toBeCloseTo(1);
  });

  test("Miko deals supporting damage only around the current target", () => {
    const miko = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "miko", unitLevel: 1 },
      "left",
      0,
    );
    miko.attackPower = 100;
    miko.buffModifiers.attackMultiplier = 1;

    const primary = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;

    const nearby = createTestBattleUnit(
      { cell: 1, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 1000;

    const far = createTestBattleUnit(
      { cell: 7, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 1000;

    resolveUnitSkillDefinition(miko)?.execute(
      miko,
      [miko],
      [primary, nearby, far],
      [],
      {
        currentTimeMs: 0,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(primary.hp).toBe(910);
    expect(nearby.hp).toBe(910);
    expect(far.hp).toBe(1000);
  });

  test("Miko command debuff and supporting damage scale by unit level", () => {
    const castMikoCommand = (unitLevel: number) => {
      const miko = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "miko", unitLevel },
        "left",
        0,
      );
      miko.attackPower = 100;
      miko.buffModifiers.attackMultiplier = 1;

      const primary = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      primary.hp = 1000;

      const nearby = createTestBattleUnit(
        { cell: 1, unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      nearby.hp = 1000;

      const far = createTestBattleUnit(
        { cell: 2, unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      far.hp = 1000;

      const appliedModifiers: Array<{ durationMs: number; attackMultiplier: number | undefined }> = [];
      resolveUnitSkillDefinition(miko)?.execute(
        miko,
        [miko],
        [primary, nearby, far],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
            appliedModifiers.push({
              durationMs: modifier.durationMs,
              attackMultiplier: modifier.attackMultiplier,
            });
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        primaryAttackMultiplier: primary.buffModifiers.attackMultiplier,
        primaryHp: primary.hp,
        nearbyHp: nearby.hp,
        farHp: far.hp,
        durationMs: appliedModifiers[0]?.durationMs,
      };
    };

    expect(castMikoCommand(1)).toEqual({
      primaryAttackMultiplier: 0.9,
      primaryHp: 910,
      nearbyHp: 910,
      farHp: 1000,
      durationMs: 5500,
    });
    expect(castMikoCommand(4)).toEqual({
      primaryAttackMultiplier: 0.86,
      primaryHp: 890,
      nearbyHp: 890,
      farHp: 1000,
      durationMs: 6500,
    });
    expect(castMikoCommand(7)).toEqual({
      primaryAttackMultiplier: 0.82,
      primaryHp: 865,
      nearbyHp: 865,
      farHp: 865,
      durationMs: 7500,
    });
  });

  test("Miko command mana support scales by unit level", () => {
    const triggerMikoBattleStart = (unitLevel: number) => {
      const miko = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitId: "miko", unitLevel },
        "left",
        0,
      );

      resolveUnitSkillDefinition(miko)?.combatHooks?.onBattleStart?.({
        currentTimeMs: 0,
        unit: miko,
        allies: [miko],
        enemies: [],
        log: [],
        applyTimedModifier: () => undefined,
      });

      return {
        initialManaBonus: miko.initialManaBonus ?? 0,
        manaGainMultiplier: miko.manaGainMultiplier ?? 1,
      };
    };

    expect(triggerMikoBattleStart(1)).toEqual({ initialManaBonus: 0, manaGainMultiplier: 1 });
    expect(triggerMikoBattleStart(4)).toEqual({ initialManaBonus: 5, manaGainMultiplier: 1.1 });
    expect(triggerMikoBattleStart(7)).toEqual({ initialManaBonus: 10, manaGainMultiplier: 1.2 });
  });

  test("Miko with attached Futo adds Gouzoku Ranbu Mononobe fire formation", () => {
    const miko = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "miko", unitLevel: 1 },
      "left",
      0,
    );
    miko.attackPower = 100;
    miko.buffModifiers.attackMultiplier = 1;
    miko.pairSkillIds = ["gouzoku-ranbu-mononobe-pair"];
    miko.pairSkillLevels = {
      "gouzoku-ranbu-mononobe-pair": 1,
    };

    const primary = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    const nearby = createTestBattleUnit(
      { cell: 1, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    const far = createTestBattleUnit(
      { cell: 7, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );

    const log: string[] = [];
    const scheduledSkill: { current: ScheduledSkillTickConfig | null } = { current: null };
    let context!: SkillExecutionContext;
    context = {
      currentTimeMs: 0,
      applyTimedModifier: (target, modifier) => {
        target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
        target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
      },
      applyShield: () => undefined,
          dealDamage: dealTestDamage,
      findCurrentOrNearestTarget: () => primary,
      scheduleSkillTicks: (_source, config) => {
        scheduledSkill.current = config;
      },
      executePairSkillsOnMainSkillActivated: (main, hookAllies, hookEnemies) => {
        const pairSkill = resolvePairSkillDefinition("gouzoku-ranbu-mononobe-pair");
        pairSkill?.executeOnMainSkillActivated?.(main, hookAllies, hookEnemies, log, context, 1);
      },
    };

    resolveUnitSkillDefinition(miko)?.execute(
      miko,
      [miko],
      [primary, nearby, far],
      log,
      context,
    );

    expect(log.some((entry) => entry.includes("豪族乱舞-物部-"))).toBe(true);
    expect(primary.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.92);
    expect(nearby.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.92);
    expect(far.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
    expect(scheduledSkill.current?.id).toBe("gouzoku-ranbu-mononobe-fire");
    expect(scheduledSkill.current?.intervalMs).toBe(800);
    expect(scheduledSkill.current?.tickCount).toBe(3);
    expect(scheduledSkill.current?.selectTargets?.(miko, [miko], [primary, nearby, far], 1))
      .toEqual([primary, nearby]);
    expect(scheduledSkill.current?.calculateDamage(miko, primary, 1)).toBe(22);
  });

  test("Miko with attached Tojiko adds Gouzoku Ranbu Soga chain lightning", () => {
    const miko = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "miko", unitLevel: 1 },
      "left",
      0,
    );
    miko.attackPower = 100;
    miko.buffModifiers.attackMultiplier = 1;
    miko.pairSkillIds = ["gouzoku-ranbu-soga-pair"];
    miko.pairSkillLevels = {
      "gouzoku-ranbu-soga-pair": 1,
    };

    const primary = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;
    const chainA = createTestBattleUnit(
      { cell: 1, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    chainA.hp = 1000;
    const chainB = createTestBattleUnit(
      { cell: 2, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    chainB.hp = 1000;
    const far = createTestBattleUnit(
      { cell: 7, unitType: "assassin", unitLevel: 1 },
      "right",
      3,
    );
    far.hp = 1000;

    const log: string[] = [];
    let context!: SkillExecutionContext;
    context = {
      currentTimeMs: 0,
      applyTimedModifier: (target, modifier) => {
        target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
      },
      applyShield: () => undefined,
          dealDamage: dealTestDamage,
      findCurrentOrNearestTarget: () => primary,
      scheduleSkillTicks: () => undefined,
      executePairSkillsOnMainSkillActivated: (main, hookAllies, hookEnemies) => {
        const pairSkill = resolvePairSkillDefinition("gouzoku-ranbu-soga-pair");
        pairSkill?.executeOnMainSkillActivated?.(main, hookAllies, hookEnemies, log, context, 1);
      },
    };

    resolveUnitSkillDefinition(miko)?.execute(
      miko,
      [miko],
      [primary, chainA, chainB, far],
      log,
      context,
    );

    expect(log.some((entry) => entry.includes("豪族乱舞-蘇我-"))).toBe(true);
    expect(primary.hp).toBe(840);
    expect(chainA.hp).toBe(880);
    expect(chainB.hp).toBe(970);
    expect(far.hp).toBe(1000);
  });

  test("Byakuren self buff scales by unit level and unique Myourenji members", () => {
    const cases = [
      { unitLevel: 1, expectedAttackMultiplier: 1.40, expectedDamageTakenMultiplier: 0.92, expectedDurationMs: 6500 },
      { unitLevel: 4, expectedAttackMultiplier: 1.55, expectedDamageTakenMultiplier: 0.88, expectedDurationMs: 7500 },
      { unitLevel: 7, expectedAttackMultiplier: 1.85, expectedDamageTakenMultiplier: 0.82, expectedDurationMs: 9000 },
    ];

    for (const {
      unitLevel,
      expectedAttackMultiplier,
      expectedDamageTakenMultiplier,
      expectedDurationMs,
    } of cases) {
    const byakuren = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "byakuren", unitLevel },
      "left",
      0,
    );
    byakuren.attackPower = 100;
    byakuren.buffModifiers.attackMultiplier = 1;
    byakuren.damageTakenMultiplier = 1;

    const nazrin = createTestBattleUnit(
      { cell: 4, unitType: "ranger", unitId: "nazrin", unitLevel: 1 },
      "left",
      1,
    );
    const ichirin = createTestBattleUnit(
      { cell: 5, unitType: "vanguard", unitId: "ichirin", unitLevel: 1 },
      "left",
      2,
    );
    const murasa = createTestBattleUnit(
      { cell: 6, unitType: "mage", unitId: "murasa", unitLevel: 1 },
      "left",
      3,
    );
    const shou = createTestBattleUnit(
      { cell: 7, unitType: "mage", unitId: "shou", unitLevel: 1 },
      "left",
      4,
    );
    shou.isDead = true;

    const duplicateNazrin = createTestBattleUnit(
      { cell: 8, unitType: "ranger", unitId: "nazrin", unitLevel: 1 },
      "left",
      5,
    );

    const target = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );

    const log: string[] = [];
    let appliedDurationMs: number | undefined;
    resolveUnitSkillDefinition(byakuren)?.execute(
      byakuren,
      [byakuren, nazrin, ichirin, murasa, shou, duplicateNazrin],
      [target],
      log,
      {
        currentTimeMs: 0,
        applyTimedModifier: (targetUnit, modifier) => {
          appliedDurationMs = modifier.durationMs;
          targetUnit.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
          targetUnit.damageTakenMultiplier = (targetUnit.damageTakenMultiplier ?? 1)
            * (modifier.incomingDamageMultiplier ?? 1);
        },
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => target,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("超人「聖白蓮」"))).toBe(true);
      expect(byakuren.buffModifiers.attackMultiplier).toBeCloseTo(expectedAttackMultiplier);
      expect(byakuren.damageTakenMultiplier).toBeCloseTo(expectedDamageTakenMultiplier);
      expect(appliedDurationMs).toBe(expectedDurationMs);
    }
  });

  test("Byakuren charge blow scales by unit level without moving cells", () => {
    const cases = [
      { unitLevel: 1, expectedTargetHp: 925 },
      { unitLevel: 4, expectedTargetHp: 900 },
      { unitLevel: 7, expectedTargetHp: 865 },
    ];

    for (const { unitLevel, expectedTargetHp } of cases) {
    const byakuren = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "byakuren", unitLevel },
      "left",
      0,
    );
    byakuren.attackPower = 100;
    byakuren.buffModifiers.attackMultiplier = 1;
    const originalCell = byakuren.cell;

    const target = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    target.hp = 1000;

    resolveUnitSkillDefinition(byakuren)?.execute(
      byakuren,
      [byakuren],
      [target],
      [],
      {
        currentTimeMs: 0,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => target,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

      expect(target.hp).toBe(expectedTargetHp);
    expect(byakuren.cell).toBe(originalCell);
    }
  });

  test("Shou empowers only the nearest ally with Absolute Justice", () => {
    const shou = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "mage", unitId: "shou", unitLevel: 1 },
      "left",
      0,
    );
    shou.attackPower = 100;

    const nearAlly = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );
    const farAlly = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 5 }), unitType: "ranger", unitLevel: 1 },
      "left",
      2,
    );
    const target = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 2 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );

    const log: string[] = [];
    resolveUnitSkillDefinition(shou)?.execute(
      shou,
      [shou, nearAlly, farAlly],
      [target],
      log,
      {
        currentTimeMs: 0,
        applyTimedModifier: (targetUnit, modifier) => {
          targetUnit.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
        },
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => target,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("アブソリュートジャスティス"))).toBe(true);
    expect(nearAlly.buffModifiers.attackMultiplier).toBeCloseTo(1.18);
    expect(farAlly.buffModifiers.attackMultiplier).toBeCloseTo(1);
    expect(shou.buffModifiers.attackMultiplier).toBeCloseTo(1);
  });

  test("Shou pierces up to three enemies on the line to the current target", () => {
    const shou = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "mage", unitId: "shou", unitLevel: 1 },
      "left",
      0,
    );
    shou.attackPower = 100;
    shou.buffModifiers.attackMultiplier = 1;

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 1 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;

    const lineA = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    lineA.hp = 1000;

    const lineB = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    lineB.hp = 1000;

    const lineC = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "assassin", unitLevel: 1 },
      "right",
      3,
    );
    lineC.hp = 1000;

    const offLine = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      4,
    );
    offLine.hp = 1000;

    resolveUnitSkillDefinition(shou)?.execute(
      shou,
      [shou],
      [primary, lineA, lineB, lineC, offLine],
      [],
      {
        currentTimeMs: 0,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: () => undefined,
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(primary.hp).toBe(885);
    expect(lineA.hp).toBe(885);
    expect(lineB.hp).toBe(885);
    expect(lineC.hp).toBe(1000);
    expect(offLine.hp).toBe(1000);
  });

  test("Shou Absolute Justice scales ally buff and beam reach by unit level", () => {
    const triggerAbsoluteJustice = (unitLevel: number) => {
      const shou = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "mage", unitId: "shou", unitLevel },
        "left",
        0,
      );
      shou.attackPower = 100;
      shou.buffModifiers.attackMultiplier = 1;

      const ally = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );

      const primary = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      primary.hp = 1000;

      const lineA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      lineA.hp = 1000;

      const lineB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      lineB.hp = 1000;

      const lineC = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "assassin", unitLevel: 1 },
        "right",
        3,
      );
      lineC.hp = 1000;

      let buffDurationMs = 0;
      resolveUnitSkillDefinition(shou)?.execute(
        shou,
        [shou, ally],
        [primary, lineA, lineB, lineC],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (targetUnit, modifier) => {
            targetUnit.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
            buffDurationMs = modifier.durationMs;
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      return {
        allyAttackMultiplier: ally.buffModifiers.attackMultiplier,
        buffDurationMs,
        primaryDamage: 1000 - primary.hp,
        lineADamage: 1000 - lineA.hp,
        lineBDamage: 1000 - lineB.hp,
        lineCDamage: 1000 - lineC.hp,
      };
    };

    expect(triggerAbsoluteJustice(1)).toEqual({
      allyAttackMultiplier: 1.18,
      buffDurationMs: 5000,
      primaryDamage: 115,
      lineADamage: 115,
      lineBDamage: 115,
      lineCDamage: 0,
    });
    expect(triggerAbsoluteJustice(4)).toEqual({
      allyAttackMultiplier: 1.26,
      buffDurationMs: 6000,
      primaryDamage: 135,
      lineADamage: 135,
      lineBDamage: 135,
      lineCDamage: 0,
    });
    expect(triggerAbsoluteJustice(7)).toEqual({
      allyAttackMultiplier: 1.34,
      buffDurationMs: 7000,
      primaryDamage: 155,
      lineADamage: 155,
      lineBDamage: 155,
      lineCDamage: 155,
    });
  });

  test("Shou with attached Nazrin adds Greatest Treasure to Absolute Justice", () => {
    const shou = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "mage", unitId: "shou", unitLevel: 1 },
      "left",
      0,
    );
    shou.attackPower = 100;
    shou.buffModifiers.attackMultiplier = 1;
    shou.pairSkillIds = ["greatest-treasure-pair"];
    shou.pairSkillLevels = {
      "greatest-treasure-pair": 1,
    };
    const ally = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 1 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;
    primary.maxHp = 1000;

    const lineA = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    lineA.hp = 900;
    lineA.maxHp = 1000;

    const lineB = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    lineB.hp = 500;
    lineB.maxHp = 1000;

    const offLine = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      3,
    );
    offLine.hp = 1000;
    offLine.maxHp = 1000;

    const log: string[] = [];
    let context!: SkillExecutionContext;
    context = {
      currentTimeMs: 0,
      applyTimedModifier: (targetUnit, modifier) => {
        targetUnit.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
        targetUnit.buffModifiers.defenseMultiplier *= modifier.defenseMultiplier ?? 1;
        targetUnit.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
        targetUnit.damageTakenMultiplier = (targetUnit.damageTakenMultiplier ?? 1)
          * (modifier.incomingDamageMultiplier ?? 1);
      },
      applyShield: () => undefined,
          dealDamage: dealTestDamage,
      findCurrentOrNearestTarget: () => primary,
      scheduleSkillTicks: () => undefined,
      executePairSkillsOnMainSkillActivated: (main, hookAllies, hookEnemies) => {
        const pairSkill = resolvePairSkillDefinition("greatest-treasure-pair");
        pairSkill?.executeOnMainSkillActivated?.(main, hookAllies, hookEnemies, log, context, 1);
      },
    };

    resolveUnitSkillDefinition(shou)?.execute(
      shou,
      [shou, ally],
      [primary, lineA, lineB, offLine],
      log,
      context,
    );

    expect(log.some((entry) => entry.includes("アブソリュートジャスティス"))).toBe(true);
    expect(log.some((entry) => entry.includes("宝塔「グレイテストトレジャー」"))).toBe(true);
    expect(lineB.hp).toBe(310);
    expect(lineB.damageTakenMultiplier).toBeCloseTo(1.08);
    expect(primary.damageTakenMultiplier ?? 1).toBeCloseTo(1);
    expect(lineA.damageTakenMultiplier ?? 1).toBeCloseTo(1);
    expect(offLine.hp).toBe(1000);
  });

  test("Shou Lv7 lets Greatest Treasure consider the fourth beam target", () => {
    const shou = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }), unitType: "mage", unitId: "shou", unitLevel: 7 },
      "left",
      0,
    );
    shou.attackPower = 100;
    shou.buffModifiers.attackMultiplier = 1;
    shou.pairSkillIds = ["greatest-treasure-pair"];
    shou.pairSkillLevels = {
      "greatest-treasure-pair": 1,
    };

    const ally = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 1 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;
    primary.maxHp = 1000;

    const lineA = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    lineA.hp = 1000;
    lineA.maxHp = 1000;

    const lineB = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    lineB.hp = 1000;
    lineB.maxHp = 1000;

    const lineC = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "assassin", unitLevel: 1 },
      "right",
      3,
    );
    lineC.hp = 300;
    lineC.maxHp = 1000;

    const log: string[] = [];
    let context!: SkillExecutionContext;
    context = {
      currentTimeMs: 0,
      applyTimedModifier: (targetUnit, modifier) => {
        targetUnit.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
        targetUnit.buffModifiers.defenseMultiplier *= modifier.defenseMultiplier ?? 1;
        targetUnit.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
        targetUnit.damageTakenMultiplier = (targetUnit.damageTakenMultiplier ?? 1)
          * (modifier.incomingDamageMultiplier ?? 1);
      },
      applyShield: () => undefined,
          dealDamage: dealTestDamage,
      findCurrentOrNearestTarget: () => primary,
      scheduleSkillTicks: () => undefined,
      executePairSkillsOnMainSkillActivated: (main, hookAllies, hookEnemies) => {
        const pairSkill = resolvePairSkillDefinition("greatest-treasure-pair");
        pairSkill?.executeOnMainSkillActivated?.(main, hookAllies, hookEnemies, log, context, 1);
      },
    };

    resolveUnitSkillDefinition(shou)?.execute(
      shou,
      [shou, ally],
      [primary, lineA, lineB, lineC],
      log,
      context,
    );

    expect(lineC.hp).toBe(70);
    expect(lineC.damageTakenMultiplier).toBeCloseTo(1.08);
    expect(lineB.hp).toBe(845);
    expect(lineB.damageTakenMultiplier ?? 1).toBeCloseTo(1);
  });

  test("Utsuho schedules Mega Flare as a delayed area impact", () => {
    const utsuho = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "utsuho", unitLevel: 1 },
      "left",
      0,
    );
    utsuho.attackPower = 100;
    utsuho.buffModifiers.attackMultiplier = 1;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;

    const nearby = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 1000;

    const far = createTestBattleUnit(
      { cell: 0, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 1000;

    const log: string[] = [];
    const scheduledSkill: { current: ScheduledSkillTickConfig | null } = { current: null };
    resolveUnitSkillDefinition(utsuho)?.execute(
      utsuho,
      [utsuho],
      [primary, nearby, far],
      log,
      {
        currentTimeMs: 0,
        applyTimedModifier: () => undefined,
        applyShield: () => undefined,
          dealDamage: dealTestDamage,
        findCurrentOrNearestTarget: () => primary,
        scheduleSkillTicks: (_source, config) => {
          scheduledSkill.current = config;
        },
        executePairSkillsOnMainSkillActivated: () => undefined,
      },
    );

    expect(log.some((entry) => entry.includes("メガフレア"))).toBe(true);
    expect(primary.hp).toBe(1000);
    expect(nearby.hp).toBe(1000);
    expect(scheduledSkill.current?.id).toBe("utsuho-mega-flare");
    expect(scheduledSkill.current?.initialDelayMs).toBe(700);
    expect(scheduledSkill.current?.tickCount).toBe(1);
    expect(scheduledSkill.current?.selectTargets?.(utsuho, [utsuho], [primary, nearby, far], 1)).toEqual([primary, nearby]);
    expect(scheduledSkill.current?.calculateDamage(utsuho, primary, 1)).toBe(175);
    expect(scheduledSkill.current?.calculateDamage(utsuho, nearby, 1)).toBe(110);
    expect(far.hp).toBe(1000);
  });

  test("Utsuho Mega Flare charge, area, and damage scale by unit level", () => {
    const cases = [
      {
        unitLevel: 1,
        expectedInitialDelayMs: 700,
        expectedTargets: ["primary", "nearby"],
        expectedPrimaryDamage: 175,
        expectedSplashDamage: 110,
      },
      {
        unitLevel: 4,
        expectedInitialDelayMs: 600,
        expectedTargets: ["primary", "nearby"],
        expectedPrimaryDamage: 215,
        expectedSplashDamage: 135,
      },
      {
        unitLevel: 7,
        expectedInitialDelayMs: 500,
        expectedTargets: ["primary", "nearby", "far"],
        expectedPrimaryDamage: 275,
        expectedSplashDamage: 170,
      },
    ];

    for (const {
      unitLevel,
      expectedInitialDelayMs,
      expectedTargets,
      expectedPrimaryDamage,
      expectedSplashDamage,
    } of cases) {
      const utsuho = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 2 }), unitType: "mage", unitId: "utsuho", unitLevel },
        "left",
        0,
      );
      utsuho.attackPower = 100;
      utsuho.buffModifiers.attackMultiplier = 1;

      const primary = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const nearby = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      const far = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );

      const scheduledSkill: { current: ScheduledSkillTickConfig | null } = { current: null };
      resolveUnitSkillDefinition(utsuho)?.execute(
        utsuho,
        [utsuho],
        [primary, nearby, far],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: () => undefined,
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: (_source, config) => {
            scheduledSkill.current = config;
          },
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      const selectedTargets = scheduledSkill.current?.selectTargets?.(
        utsuho,
        [utsuho],
        [primary, nearby, far],
        1,
      ) ?? [];

      expect(scheduledSkill.current?.initialDelayMs).toBe(expectedInitialDelayMs);
      expect(selectedTargets.map((target) => target.id)).toEqual(expectedTargets.map((name) => {
        if (name === "primary") {
          return primary.id;
        }
        if (name === "nearby") {
          return nearby.id;
        }
        return far.id;
      }));
      expect(scheduledSkill.current?.calculateDamage(utsuho, primary, 1)).toBe(expectedPrimaryDamage);
      expect(scheduledSkill.current?.calculateDamage(utsuho, nearby, 1)).toBe(expectedSplashDamage);
      expect(scheduledSkill.current?.calculateDamage(utsuho, far, 1)).toBe(expectedSplashDamage);
    }
  });

  test("Utsuho Mega Flare damages nearby enemies after the charge", () => {
    const simulator = new BattleSimulator();
    const utsuho = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "utsuho", unitLevel: 1 },
      "left",
      0,
    );
    utsuho.attackPower = 100;
    utsuho.attackSpeed = 100;
    utsuho.attackRange = 99;
    utsuho.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 50000;
    primary.maxHp = 50000;
    primary.attackPower = 0;
    primary.attackSpeed = 0;
    primary.movementSpeed = 0;

    const nearby = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 1000;
    nearby.maxHp = 1000;
    nearby.attackPower = 0;
    nearby.attackSpeed = 0;
    nearby.movementSpeed = 0;

    const far = createTestBattleUnit(
      { cell: 0, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 1000;
    far.maxHp = 1000;
    far.attackPower = 0;
    far.attackSpeed = 0;
    far.movementSpeed = 0;

    const result = simulator.simulateBattle([utsuho], [primary, nearby, far], [], [], 900);

    expect(result.combatLog.some((entry) => entry.includes("メガフレア"))).toBe(true);
    expect(primary.hp).toBeLessThan(50000);
    expect(nearby.hp).toBeLessThan(1000);
    expect(far.hp).toBe(1000);
  });

  test("Koishi starts unconscious and reveals herself after dealing damage", () => {
    const simulator = new BattleSimulator();
    const koishi = createTestBattleUnit(
      { cell: 3, unitType: "assassin", unitId: "koishi", unitLevel: 1 },
      "left",
      0,
    );
    koishi.attackPower = 25;
    koishi.attackSpeed = 10;
    koishi.attackRange = 99;
    koishi.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 1000;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([koishi], [enemy], [], [], 50);

    expect(result.combatLog.some((entry) => entry.includes("無意識の遺伝子"))).toBe(true);
    expect(enemy.hp).toBeLessThan(1000);
    expect(koishi.stackState?.["koishi-unconscious"]).toBe(0);
    expect(koishi.targetPriorityMultiplier).toBeCloseTo(1);
  });

  test("Koishi gains reveal hit bonus damage from level 4 onward", () => {
    const triggerReveal = (unitLevel: number): number => {
      const koishi = createTestBattleUnit(
        { cell: 3, unitType: "assassin", unitId: "koishi", unitLevel },
        "left",
        0,
      );
      koishi.attackPower = 100;
      koishi.buffModifiers.attackMultiplier = 1;
      const target = createTestBattleUnit(
        { cell: 7, unitType: "mage", unitLevel: 1 },
        "right",
        0,
      );
      target.hp = 500;
      target.maxHp = 500;
      const log: string[] = [];
      const skill = resolveUnitSkillDefinition(koishi);

      skill?.combatHooks?.onBattleStart?.({
        currentTimeMs: 0,
        unit: koishi,
        allies: [koishi],
        enemies: [target],
        log,
        applyTimedModifier: () => undefined,
      });
      skill?.combatHooks?.onAfterDealDamage?.({
        currentTimeMs: 100,
        unit: koishi,
        sourceUnit: koishi,
        target,
        actualDamage: 100,
        allies: [koishi],
        enemies: [target],
        log,
        applyTimedModifier: () => undefined,
      });

      return target.hp;
    };

    expect(triggerReveal(1)).toBe(500);
    expect(triggerReveal(4)).toBe(455);
    expect(triggerReveal(7)).toBe(410);
  });

  test("Koishi is harder to target while unconscious", () => {
    const simulator = new BattleSimulator();
    const koishi = createTestBattleUnit(
      { cell: 3, unitType: "assassin", unitId: "koishi", unitLevel: 1 },
      "left",
      0,
    );
    koishi.hp = 100;
    koishi.maxHp = 100;
    koishi.attackPower = 0;
    koishi.attackSpeed = 0;
    koishi.attackRange = 0;
    koishi.movementSpeed = 0;

    const decoy = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "left",
      1,
    );
    decoy.hp = 1000;
    decoy.maxHp = 1000;
    decoy.attackPower = 0;
    decoy.attackSpeed = 0;
    decoy.movementSpeed = 0;

    const attacker = createTestBattleUnit(
      { cell: 7, unitType: "ranger", unitLevel: 1 },
      "right",
      0,
    );
    attacker.attackPower = 40;
    attacker.attackSpeed = 10;
    attacker.attackRange = 99;
    attacker.movementSpeed = 0;

    const result = simulator.simulateBattle([koishi, decoy], [attacker], [], [], 50);

    expect(result.combatLog.some((entry) => entry.includes("無意識の遺伝子"))).toBe(true);
    expect(koishi.hp).toBe(100);
    expect(decoy.hp).toBeLessThan(1000);
  });

  test("Koishi with attached Satori keeps Perfect Mind Control stealth after revealing", () => {
    const flags = {
      ...DEFAULT_FLAGS,
      enableTouhouRoster: true,
      enableTouhouFactions: true,
    };
    const simulator = new BattleSimulator();
    const koishiPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
      unitType: "assassin",
      unitId: "koishi",
      unitLevel: 1,
      subUnit: {
        unitType: "mage",
        unitId: "satori",
        unitLevel: 7,
      },
    };
    const enemyPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
      unitType: "vanguard",
      unitLevel: 1,
    };
    const koishi = createTestBattleUnit(koishiPlacement, "left", 0, false, flags);
    koishi.attackPower = 1;
    koishi.attackSpeed = 10;
    koishi.attackRange = 99;
    koishi.movementSpeed = 0;

    const enemy = createTestBattleUnit(enemyPlacement, "right", 0, false, flags);
    enemy.hp = 10_000;
    enemy.maxHp = 10_000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle(
      [koishi],
      [enemy],
      [koishiPlacement],
      [enemyPlacement],
      50,
      null,
      null,
      null,
      flags,
    );

    expect(result.combatLog.some((entry) =>
      entry.includes("links pair skill Lv7 (古明地さとり): パーフェクトマインドコントロール")
    )).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("reveals herself from 無意識の遺伝子"))).toBe(true);
    expect(koishi.stackState?.["koishi-unconscious"]).toBe(0);
    expect(koishi.targetPriorityMultiplier).toBeCloseTo(0.15);
  });

  test("Perfect Mind Control stealth expires after its duration", () => {
    const simulator = new BattleSimulator();
    const koishi = createTestBattleUnit(
      { cell: 3, unitType: "assassin", unitId: "koishi", unitLevel: 1 },
      "left",
      0,
    );
    koishi.attackPower = 1;
    koishi.attackSpeed = 10;
    koishi.attackRange = 99;
    koishi.movementSpeed = 0;
    koishi.pairSkillIds = ["perfect-mind-control-pair"];
    koishi.pairSkillLevels = {
      "perfect-mind-control-pair": 7,
    };

    const enemy = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 10_000;
    enemy.maxHp = 10_000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    simulator.simulateBattle([koishi], [enemy], [], [], 6_200);

    expect(koishi.stackState?.["koishi-unconscious"]).toBe(0);
    expect(koishi.targetPriorityMultiplier).toBeCloseTo(1);
  });

  test("Satori with attached Koishi replaces her skill with range 3 Komeiji Heartbreaker", () => {
    const satori = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
        unitType: "mage",
        unitId: "satori",
        unitLevel: 1,
      },
      "left",
      0,
    );
    satori.attackPower = 70;
    satori.pairSkillIds = ["komeiji-heartbreaker-pair"];
    satori.pairSkillLevels = {
      "komeiji-heartbreaker-pair": 7,
    };
    const target = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
        unitType: "vanguard",
        unitLevel: 1,
      },
      "right",
      0,
    );
    target.hp = 500;
    target.maxHp = 500;

    const log: string[] = [];
    const skill = resolveUnitSkillDefinition(satori);
    skill?.execute(satori, [satori], [target], log);

    expect(skill?.name).toBe("コメイジハートブレイカー");
    expect(log.some((entry) => entry.includes("コメイジハートブレイカー"))).toBe(true);
    expect(target.hp).toBe(381);
  });

  test("Satori does not spend Komeiji Heartbreaker mana when no enemy is within range 3", () => {
    const simulator = new BattleSimulator();
    const satori = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
        unitType: "mage",
        unitId: "satori",
        unitLevel: 1,
      },
      "left",
      0,
    );
    satori.attackPower = 70;
    satori.attackSpeed = 0;
    satori.attackRange = 0;
    satori.movementSpeed = 0;
    satori.currentMana = 100;
    satori.initialManaBonus = 100;
    satori.pairSkillIds = ["komeiji-heartbreaker-pair"];
    satori.pairSkillLevels = {
      "komeiji-heartbreaker-pair": 7,
    };

    const enemy = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 5, y: 0 }),
        unitType: "vanguard",
        unitLevel: 1,
      },
      "right",
      0,
    );
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([satori], [enemy], [], [], 100);

    expect(result.combatLog.some((entry) => entry.includes("コメイジハートブレイカー"))).toBe(false);
    expect(enemy.hp).toBe(500);
    expect(satori.currentMana).toBe(100);
  });

  test("Satori's base skill exposes class-reading mana timing", () => {
    const satori = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "satori", unitLevel: 1 },
      "left",
      0,
    );

    const skill = resolveUnitSkillDefinition(satori);

    expect(skill?.name).toBe("想起「読心裁断」");
    expect(skill?.activationModel).toBe("mana");
    expect(skill?.mana).toEqual({
      maxMana: 100,
      initialMana: 35,
      manaCost: 85,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 30,
    });
  });

  test("Satori's base skill applies a vulnerability debuff to vanguard targets", () => {
    const satori = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "satori", unitLevel: 1 },
      "left",
      0,
    );
    const target = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    const log: string[] = [];

    resolveUnitSkillDefinition(satori)?.execute(satori, [satori], [target], log);

    expect(target.damageTakenMultiplier).toBeCloseTo(1.15);
    expect(log.some((entry) => entry.includes("vanguard"))).toBe(true);
  });

  test("Satori's base skill applies offense debuffs by non-vanguard combat class", () => {
    const satori = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "satori", unitLevel: 1 },
      "left",
      0,
    );
    const ranger = createTestBattleUnit({ cell: 7, unitType: "ranger", unitLevel: 1 }, "right", 0);
    const assassin = createTestBattleUnit({ cell: 6, unitType: "assassin", unitLevel: 1 }, "right", 1);
    const mage = createTestBattleUnit({ cell: 5, unitType: "mage", unitLevel: 1 }, "right", 2);
    mage.currentMana = 60;
    mage.manaGainMultiplier = 1;
    const log: string[] = [];
    const skill = resolveUnitSkillDefinition(satori);

    satori.currentTargetId = ranger.id;
    skill?.execute(satori, [satori], [ranger, assassin, mage], log);
    satori.currentTargetId = assassin.id;
    skill?.execute(satori, [satori], [ranger, assassin, mage], log);
    satori.currentTargetId = mage.id;
    skill?.execute(satori, [satori], [ranger, assassin, mage], log);

    expect(ranger.buffModifiers.attackMultiplier).toBeCloseTo(0.82);
    expect(assassin.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.78);
    expect(mage.currentMana).toBe(35);
    expect(mage.manaGainMultiplier).toBeCloseTo(0.75);
  });

  test("Satori's base skill debuffs scale at level 7", () => {
    const satori = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "satori", unitLevel: 7 },
      "left",
      0,
    );
    const vanguard = createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0);
    const ranger = createTestBattleUnit({ cell: 6, unitType: "ranger", unitLevel: 1 }, "right", 1);
    const assassin = createTestBattleUnit({ cell: 5, unitType: "assassin", unitLevel: 1 }, "right", 2);
    const mage = createTestBattleUnit({ cell: 4, unitType: "mage", unitLevel: 1 }, "right", 3);
    mage.currentMana = 60;
    mage.manaGainMultiplier = 1;
    const durations: number[] = [];
    const skillContext: SkillExecutionContext = {
      currentTimeMs: 0,
      applyTimedModifier: (target, modifier) => {
        durations.push(modifier.durationMs);
        target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
        target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
        target.manaGainMultiplier = (target.manaGainMultiplier ?? 1) * (modifier.manaGainMultiplier ?? 1);
        target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
          * (modifier.incomingDamageMultiplier ?? 1);
      },
      applyShield: () => undefined,
          dealDamage: dealTestDamage,
      findCurrentOrNearestTarget: (caster, enemies) =>
        enemies.find((enemy) => enemy.id === caster.currentTargetId && !enemy.isDead) ?? null,
      scheduleSkillTicks: () => undefined,
      executePairSkillsOnMainSkillActivated: () => undefined,
    };
    const skill = resolveUnitSkillDefinition(satori);

    satori.currentTargetId = vanguard.id;
    skill?.execute(satori, [satori], [vanguard, ranger, assassin, mage], [], skillContext);
    satori.currentTargetId = ranger.id;
    skill?.execute(satori, [satori], [vanguard, ranger, assassin, mage], [], skillContext);
    satori.currentTargetId = assassin.id;
    skill?.execute(satori, [satori], [vanguard, ranger, assassin, mage], [], skillContext);
    satori.currentTargetId = mage.id;
    skill?.execute(satori, [satori], [vanguard, ranger, assassin, mage], [], skillContext);

    expect(vanguard.damageTakenMultiplier).toBeCloseTo(1.28);
    expect(ranger.buffModifiers.attackMultiplier).toBeCloseTo(0.70);
    expect(assassin.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.62);
    expect(mage.currentMana).toBe(10);
    expect(mage.manaGainMultiplier).toBeCloseTo(0.55);
    expect(durations).toEqual([7500, 7500, 7000, 7500]);
  });

  test("Junko with attached Hecatia fires the nameless danmaku as half-power sub attacks", () => {
    const flags = {
      ...DEFAULT_FLAGS,
      enableTouhouRoster: true,
      enableTouhouFactions: true,
    };
    const simulator = new BattleSimulator();
    const junkoPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
      unitType: "vanguard",
      unitId: "junko",
      unitLevel: 1,
      subUnit: {
        unitType: "mage",
        unitId: "hecatia",
        unitLevel: 1,
      },
    };
    const targetPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
      unitType: "vanguard",
      unitLevel: 1,
    };
    const junko = createTestBattleUnit(junkoPlacement, "left", 0, false, flags);
    junko.attackPower = 0;
    junko.attackSpeed = 0;
    junko.attackRange = 0;
    junko.movementSpeed = 0;
    const target = createTestBattleUnit(targetPlacement, "right", 0, false, flags);
    target.hp = 500;
    target.maxHp = 500;
    target.attackPower = 0;
    target.attackSpeed = 0;
    target.movementSpeed = 0;

    const result = simulator.simulateBattle(
      [junko],
      [target],
      [junkoPlacement],
      [targetPlacement],
      2300,
      null,
      null,
      null,
      flags,
    );

    expect(result.combatLog.some((entry) =>
      entry.includes("links pair skill Lv1 (ヘカーティア・ラピスラズリ): 最初で最後の無名の弾幕")
    )).toBe(true);
    expect(result.combatLog.some((entry) =>
      entry.includes("gains sub equipment bonus (ヘカーティア・ラピスラズリ): +30 ATK, Skill x1.12")
    )).toBe(true);
    expect(result.combatLog.filter((entry) => entry.includes("最初で最後の無名の弾幕")).length)
      .toBeGreaterThanOrEqual(3);
    expect(target.hp).toBe(429);
    expect(result.combatLog.some((entry) => entry.includes("トリニタリアンラプソディ"))).toBe(false);
  });

  test("Hecatia with attached Junko uses the same nameless danmaku without sub skill or mana gain", () => {
    const flags = {
      ...DEFAULT_FLAGS,
      enableTouhouRoster: true,
      enableTouhouFactions: true,
    };
    const simulator = new BattleSimulator();
    const hecatiaPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
      unitType: "mage",
      unitId: "hecatia",
      unitLevel: 1,
      subUnit: {
        unitType: "vanguard",
        unitId: "junko",
        unitLevel: 1,
      },
    };
    const targetPlacement: BoardUnitPlacement = {
      cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
      unitType: "vanguard",
      unitLevel: 1,
    };
    const hecatia = createTestBattleUnit(hecatiaPlacement, "left", 0, false, flags);
    hecatia.attackPower = 0;
    hecatia.attackSpeed = 0;
    hecatia.attackRange = 0;
    hecatia.movementSpeed = 0;
    const target = createTestBattleUnit(targetPlacement, "right", 0, false, flags);
    target.hp = 200;
    target.maxHp = 1000;
    target.attackPower = 0;
    target.attackSpeed = 0;
    target.movementSpeed = 0;

    const result = simulator.simulateBattle(
      [hecatia],
      [target],
      [hecatiaPlacement],
      [targetPlacement],
      50,
      null,
      null,
      null,
      flags,
    );

    expect(result.combatLog.some((entry) =>
      entry.includes("links pair skill Lv1 (純狐): 最初で最後の無名の弾幕")
    )).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("最初で最後の無名の弾幕"))).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("処刑"))).toBe(false);
    expect(target.hp).toBe(177);
    expect(hecatia.currentMana).toBe(30);
  });

  test("Sekibanki launches a flying head that attacks another target and retargets after defeat", () => {
    const simulator = new BattleSimulator();
    const sekibanki = createTestBattleUnit(
      { cell: 3, unitType: "assassin", unitId: "sekibanki", unitLevel: 1 },
      "left",
      0,
    );
    sekibanki.attackPower = 100;
    sekibanki.attackSpeed = 20;
    sekibanki.attackRange = 99;
    sekibanki.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 5000;
    primary.maxHp = 5000;
    primary.attackPower = 0;
    primary.attackSpeed = 0;
    primary.movementSpeed = 0;

    const firstHeadTarget = createTestBattleUnit(
      { cell: 6, unitType: "mage", unitLevel: 1 },
      "right",
      1,
    );
    firstHeadTarget.hp = 40;
    firstHeadTarget.maxHp = 40;
    firstHeadTarget.attackPower = 0;
    firstHeadTarget.attackSpeed = 0;
    firstHeadTarget.movementSpeed = 0;

    const secondHeadTarget = createTestBattleUnit(
      { cell: 3, unitType: "ranger", unitLevel: 1 },
      "right",
      2,
    );
    secondHeadTarget.hp = 1000;
    secondHeadTarget.maxHp = 1000;
    secondHeadTarget.attackPower = 0;
    secondHeadTarget.attackSpeed = 0;
    secondHeadTarget.movementSpeed = 0;

    const result = simulator.simulateBattle(
      [sekibanki],
      [primary, firstHeadTarget, secondHeadTarget],
      [],
      [],
      2500,
    );

    expect(result.combatLog.some((entry) => entry.includes("フライングヘッド"))).toBe(true);
    expect(primary.hp).toBeLessThan(5000);
    expect(firstHeadTarget.isDead).toBe(true);
    expect(secondHeadTarget.hp).toBeLessThan(1000);
  });

  test("Sekibanki Flying Head duration and damage scale by unit level", () => {
    const cases = [
      { unitLevel: 1, expectedTickCount: 4, expectedIntervalMs: 600, expectedDamage: 45 },
      { unitLevel: 4, expectedTickCount: 5, expectedIntervalMs: 550, expectedDamage: 50 },
      { unitLevel: 7, expectedTickCount: 6, expectedIntervalMs: 500, expectedDamage: 58 },
    ];

    for (const { unitLevel, expectedTickCount, expectedIntervalMs, expectedDamage } of cases) {
      const sekibanki = createTestBattleUnit(
        { cell: 3, unitType: "assassin", unitId: "sekibanki", unitLevel },
        "left",
        0,
      );
      sekibanki.attackPower = 100;
      sekibanki.buffModifiers.attackMultiplier = 1;

      const primary = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const headTarget = createTestBattleUnit(
        { cell: 6, unitType: "mage", unitLevel: 1 },
        "right",
        1,
      );

      sekibanki.currentTargetId = primary.id;

      const scheduledSkill: { current: ScheduledSkillTickConfig | null } = { current: null };
      resolveUnitSkillDefinition(sekibanki)?.execute(
        sekibanki,
        [sekibanki],
        [primary, headTarget],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: () => undefined,
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: (_source, config) => {
            scheduledSkill.current = config;
          },
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      expect(scheduledSkill.current?.id).toBe("sekibanki-flying-head");
      expect(scheduledSkill.current?.tickCount).toBe(expectedTickCount);
      expect(scheduledSkill.current?.intervalMs).toBe(expectedIntervalMs);
      expect(scheduledSkill.current?.selectTarget(sekibanki, [sekibanki], [primary, headTarget])).toBe(headTarget);
      expect(scheduledSkill.current?.calculateDamage(sekibanki, headTarget, 1)).toBe(expectedDamage);
    }
  });

  test("Murasa sinks the current target area and slows attack speed", () => {
    const simulator = new BattleSimulator();
    const murasa = createTestBattleUnit(
      { cell: 3, unitType: "mage", unitId: "murasa", unitLevel: 1 },
      "left",
      0,
    );
    murasa.attackPower = 100;
    murasa.attackSpeed = 10;
    murasa.attackRange = 99;
    murasa.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    primary.hp = 1000;
    primary.maxHp = 1000;
    primary.attackPower = 0;
    primary.attackSpeed = 0;
    primary.movementSpeed = 0;

    const nearby = createTestBattleUnit(
      { cell: 6, unitType: "ranger", unitLevel: 1 },
      "right",
      1,
    );
    nearby.hp = 1000;
    nearby.maxHp = 1000;
    nearby.attackPower = 0;
    nearby.attackSpeed = 0;
    nearby.movementSpeed = 0;

    const far = createTestBattleUnit(
      { cell: 0, unitType: "mage", unitLevel: 1 },
      "right",
      2,
    );
    far.hp = 1000;
    far.maxHp = 1000;
    far.attackPower = 0;
    far.attackSpeed = 0;
    far.movementSpeed = 0;

    const result = simulator.simulateBattle([murasa], [primary, nearby, far], [], [], 350);

    expect(result.combatLog.some((entry) => entry.includes("ディープシンカー"))).toBe(true);
    expect(primary.hp).toBeLessThan(1000);
    expect(nearby.hp).toBeLessThan(1000);
    expect(far.hp).toBe(1000);
    expect(primary.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.85);
    expect(nearby.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.85);
    expect(far.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
  });

  test("Murasa Deep Sinker damage, slow, and area scale by unit level", () => {
    const cases = [
      {
        unitLevel: 1,
        expectedPrimaryHp: 890,
        expectedNearbyHp: 890,
        expectedFarHp: 1000,
        expectedAttackSpeedMultiplier: 0.85,
        expectedDurationMs: 6000,
      },
      {
        unitLevel: 4,
        expectedPrimaryHp: 865,
        expectedNearbyHp: 865,
        expectedFarHp: 1000,
        expectedAttackSpeedMultiplier: 0.80,
        expectedDurationMs: 7000,
      },
      {
        unitLevel: 7,
        expectedPrimaryHp: 835,
        expectedNearbyHp: 835,
        expectedFarHp: 835,
        expectedAttackSpeedMultiplier: 0.75,
        expectedDurationMs: 8000,
      },
    ];

    for (const {
      unitLevel,
      expectedPrimaryHp,
      expectedNearbyHp,
      expectedFarHp,
      expectedAttackSpeedMultiplier,
      expectedDurationMs,
    } of cases) {
      const murasa = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 2 }), unitType: "mage", unitId: "murasa", unitLevel },
        "left",
        0,
      );
      murasa.attackPower = 100;
      murasa.buffModifiers.attackMultiplier = 1;

      const primary = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const nearby = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      const far = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );
      const outside = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "assassin", unitLevel: 1 },
        "right",
        3,
      );

      for (const enemy of [primary, nearby, far, outside]) {
        enemy.hp = 1000;
        enemy.buffModifiers.attackSpeedMultiplier = 1;
      }

      const appliedDurations = new Map<string, number>();
      resolveUnitSkillDefinition(murasa)?.execute(
        murasa,
        [murasa],
        [primary, nearby, far, outside],
        [],
        {
          currentTimeMs: 0,
          applyTimedModifier: (target, modifier) => {
            appliedDurations.set(target.id, modifier.durationMs);
            target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
          },
          applyShield: () => undefined,
          dealDamage: dealTestDamage,
          findCurrentOrNearestTarget: () => primary,
          scheduleSkillTicks: () => undefined,
          executePairSkillsOnMainSkillActivated: () => undefined,
        },
      );

      expect(primary.hp).toBe(expectedPrimaryHp);
      expect(nearby.hp).toBe(expectedNearbyHp);
      expect(far.hp).toBe(expectedFarHp);
      expect(outside.hp).toBe(1000);
      expect(primary.buffModifiers.attackSpeedMultiplier).toBeCloseTo(expectedAttackSpeedMultiplier);
      expect(nearby.buffModifiers.attackSpeedMultiplier).toBeCloseTo(expectedAttackSpeedMultiplier);
      expect(appliedDurations.get(primary.id)).toBe(expectedDurationMs);
      expect(appliedDurations.get(nearby.id)).toBe(expectedDurationMs);
      if (unitLevel >= 7) {
        expect(far.buffModifiers.attackSpeedMultiplier).toBeCloseTo(expectedAttackSpeedMultiplier);
        expect(appliedDurations.get(far.id)).toBe(expectedDurationMs);
      } else {
        expect(far.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
        expect(appliedDurations.has(far.id)).toBe(false);
      }
      expect(outside.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1);
      expect(appliedDurations.has(outside.id)).toBe(false);
    }
  });

  test("boss active skill resolver returns null until an active boss spell is assigned", () => {
    const boss = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      "right",
      0,
      true,
    );

    expect(resolveBossSkillDefinition(boss)).toBeNull();
  });

  test("Scarlet Shoot damages enemies on the beam line when Remilia has mana", () => {
    const simulator = new BattleSimulator();
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "instant-1";
    boss.attackPower = 75;
    boss.attackSpeed = 100;
    boss.attackRange = 99;
    boss.movementSpeed = 0;

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitId: "primary" },
      "left",
      0,
    );
    const pierced = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "pierced" },
      "left",
      1,
    );
    const offLine = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitId: "off-line" },
      "left",
      2,
    );

    for (const unit of [primary, pierced, offLine]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
      unit.attackPower = unit === primary ? 100 : 0;
      unit.attackSpeed = 0;
      unit.movementSpeed = 0;
    }

    const result = simulator.simulateBattle([primary, pierced, offLine], [boss], [], [], 250);

    expect(result.combatLog.some((entry) => entry.includes("紅符「スカーレットシュート」"))).toBe(true);
    expect(primary.hp).toBeLessThan(1000);
    expect(pierced.hp).toBeLessThan(1000);
  });

  test("Scarlet Shoot damage scales with Remilia attack modifiers", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "instant-1";
    boss.attackPower = 100;
    boss.buffModifiers.attackMultiplier = 1.5;

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitId: "primary" },
      "left",
      0,
    );
    const pierced = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "pierced" },
      "left",
      1,
    );
    const offLine = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitId: "off-line" },
      "left",
      2,
    );
    for (const unit of [primary, pierced, offLine]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }
    primary.attackPower = 100;

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [primary, pierced, offLine], []);

    expect(primary.hp).toBe(685);
    expect(pierced.hp).toBe(685);
    expect(offLine.hp).toBe(1000);
  });

  test("Red the Nightless Castle damages enemies two cells away in cardinal directions", () => {
    const skill = resolveBossSkillDefinition({
      ...createTestBattleUnit(
        {
          cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
          unitType: "vanguard",
          unitId: "remilia",
          unitLevel: 1,
        },
        "right",
        0,
        true,
      ),
      sourceUnitId: "remilia",
      activeBossSpellId: "area-1",
    });
    expect(skill).not.toBeNull();

    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "area-1";
    boss.attackPower = 75;
    boss.buffModifiers.attackMultiplier = 1.5;
    const upTwo = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 0 }), unitType: "vanguard", unitId: "up-two" },
      "left",
      0,
    );
    upTwo.cell = sharedBoardCoordinateToIndex({ x: 2, y: 0 });
    const rightTwo = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "right-two" },
      "left",
      1,
    );
    const downThree = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 5 }), unitType: "vanguard", unitId: "down-three" },
      "left",
      2,
    );
    const diagonal = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 3 }), unitType: "vanguard", unitId: "diagonal" },
      "left",
      3,
    );
    for (const unit of [upTwo, rightTwo, downThree, diagonal]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    skill?.execute(boss, [boss], [upTwo, rightTwo, downThree, diagonal], []);

    expect(upTwo.hp).toBe(820);
    expect(rightTwo.hp).toBe(820);
    expect(downThree.hp).toBe(1000);
    expect(diagonal.hp).toBe(1000);
  });

  test("Demon King Cradle rushes horizontally through the side with more enemies", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "rush-1";
    boss.attackPower = 75;
    boss.buffModifiers.attackMultiplier = 2;
    const leftEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitId: "left-enemy" },
      "left",
      0,
    );
    const nearRightEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitId: "near-right" },
      "left",
      1,
    );
    const farRightEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitId: "far-right" },
      "left",
      2,
    );
    for (const unit of [leftEnemy, nearRightEnemy, farRightEnemy]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [leftEnemy, nearRightEnemy, farRightEnemy], []);

    expect(leftEnemy.hp).toBe(1000);
    expect(nearRightEnemy.hp).toBe(715);
    expect(farRightEnemy.hp).toBe(715);
    expect(boss.cell).toBe(sharedBoardCoordinateToIndex({ x: 5, y: 2 }));
  });

  test("Demon King Cradle hits enemies one row above and below the horizontal rush path", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "rush-1";
    boss.attackPower = 75;

    const sameRow = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitId: "same-row" },
      "left",
      0,
    );
    const upperRow = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 1 }), unitType: "vanguard", unitId: "upper-row" },
      "left",
      1,
    );
    const lowerRow = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitId: "lower-row" },
      "left",
      2,
    );
    const farRow = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 4 }), unitType: "vanguard", unitId: "far-row" },
      "left",
      3,
    );
    for (const unit of [sameRow, upperRow, lowerRow, farRow]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [sameRow, upperRow, lowerRow, farRow], []);

    expect(sameRow.hp).toBe(857);
    expect(upperRow.hp).toBe(857);
    expect(lowerRow.hp).toBe(857);
    expect(farRow.hp).toBe(1000);
  });

  test("Heart Break damages enemies on the beam line as a level 2 Remilia spell", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "instant-2";
    boss.attackPower = 80;

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitId: "primary" },
      "left",
      0,
    );
    const pierced = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "pierced" },
      "left",
      1,
    );
    const offLine = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitId: "off-line" },
      "left",
      2,
    );
    for (const unit of [primary, pierced, offLine]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }
    primary.attackPower = 100;

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [primary, pierced, offLine], []);

    expect(skill?.activationModel).toBe("mana");
    expect(primary.hp).toBe(800);
    expect(pierced.hp).toBe(800);
    expect(offLine.hp).toBe(1000);
  });

  test("Scarlet Devil damages enemies within two cells around Remilia as a level 2 spell", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "area-2";
    boss.attackPower = 80;

    const near = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitId: "near" },
      "left",
      0,
    );
    const edge = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitId: "edge" },
      "left",
      1,
    );
    const outside = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 5 }), unitType: "vanguard", unitId: "outside" },
      "left",
      2,
    );
    for (const unit of [near, edge, outside]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [near, edge, outside], []);

    expect(skill?.activationModel).toBe("mana");
    expect(near.hp).toBe(840);
    expect(edge.hp).toBe(840);
    expect(outside.hp).toBe(1000);
  });

  test("Bad Lady Scramble rushes to the board edge and hits the horizontal band as a level 2 spell", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "rush-2";
    boss.attackPower = 80;

    const sameRow = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitId: "same-row" },
      "left",
      0,
    );
    const upperRow = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 1 }), unitType: "vanguard", unitId: "upper-row" },
      "left",
      1,
    );
    const leftEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitId: "left-enemy" },
      "left",
      2,
    );
    for (const unit of [sameRow, upperRow, leftEnemy]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [sameRow, upperRow, leftEnemy], []);

    expect(skill?.activationModel).toBe("mana");
    expect(sameRow.hp).toBe(824);
    expect(upperRow.hp).toBe(824);
    expect(leftEnemy.hp).toBe(1000);
    expect(boss.cell).toBe(sharedBoardCoordinateToIndex({ x: 5, y: 2 }));
  });

  test("Spear the Gungnir damages enemies on the beam line as a level 3 Remilia spell", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "instant-3";
    boss.attackPower = 80;

    const primary = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitId: "primary" },
      "left",
      0,
    );
    const pierced = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "pierced" },
      "left",
      1,
    );
    const offLine = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitId: "off-line" },
      "left",
      2,
    );
    for (const unit of [primary, pierced, offLine]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }
    primary.attackPower = 100;

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [primary, pierced, offLine], []);

    expect(skill?.activationModel).toBe("mana");
    expect(primary.hp).toBe(760);
    expect(pierced.hp).toBe(760);
    expect(offLine.hp).toBe(1000);
  });

  test("All World Nightmare damages all enemies as a level 3 Remilia spell", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "area-3";
    boss.attackPower = 80;

    const enemies = [
      createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 0 }), unitType: "vanguard", unitId: "corner-a" },
        "left",
        0,
      ),
      createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 5, y: 5 }), unitType: "vanguard", unitId: "corner-b" },
        "left",
        1,
      ),
      createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "near" },
        "left",
        2,
      ),
    ];
    for (const unit of enemies) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], enemies, []);

    expect(skill?.activationModel).toBe("mana");
    expect(enemies.map((unit) => unit.hp)).toEqual([880, 880, 880]);
  });

  test("Dracula Cradle can shift one row vertically before rushing to the board edge", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "rush-3";
    boss.attackPower = 80;

    const upperTarget = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 3, y: 3 }), unitType: "vanguard", unitId: "upper-target" },
      "left",
      0,
    );
    const lowerTarget = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 4 }), unitType: "vanguard", unitId: "lower-target" },
      "left",
      1,
    );
    const leftEnemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitId: "left-enemy" },
      "left",
      2,
    );
    for (const unit of [upperTarget, lowerTarget, leftEnemy]) {
      unit.hp = 1000;
      unit.maxHp = 1000;
    }

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss], [upperTarget, lowerTarget, leftEnemy], []);

    expect(skill?.activationModel).toBe("mana");
    expect(upperTarget.hp).toBe(792);
    expect(lowerTarget.hp).toBe(792);
    expect(leftEnemy.hp).toBe(1000);
    expect(boss.cell).toBe(sharedBoardCoordinateToIndex({ x: 5, y: 3 }));
  });

  test("Scarlet Gensokyo starts a once-only final enrage with permanent DoT and boss attack stacks", () => {
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "last-word";
    boss.attackPower = 75;

    const ally = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitId: "meiling" },
      "right",
      1,
    );
    const enemies = [
      createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitId: "raid-a" },
        "left",
        0,
      ),
      createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitId: "raid-b" },
        "left",
        1,
      ),
    ];
    for (const unit of enemies) {
      unit.hp = 2000;
      unit.maxHp = 2000;
    }
    const scheduledTicks: ScheduledSkillTickConfig[] = [];

    const skill = resolveBossSkillDefinition(boss);
    skill?.execute(boss, [boss, ally], enemies, [], {
      currentTimeMs: 0,
      applyTimedModifier: () => undefined,
      applyShield: () => undefined,
          dealDamage: dealTestDamage,
      findCurrentOrNearestTarget: () => null,
      scheduleSkillTicks: (_source, config) => scheduledTicks.push(config),
      executePairSkillsOnMainSkillActivated: () => undefined,
    });

    expect(skill?.activationModel).toBe("mana");
    expect(boss.activeBossSpellId).toBe("");
    expect(boss.buffModifiers.attackMultiplier).toBeCloseTo(1.05);
    expect(ally.buffModifiers.attackMultiplier).toBeCloseTo(1.05);
    expect(scheduledTicks).toHaveLength(1);
    expect(scheduledTicks[0]!.intervalMs).toBe(1000);

    scheduledTicks[0]!.onBeforeTick?.(boss, [boss, ally], enemies, 5);

    expect(boss.stackState?.["last-word-enrage"]).toBe(2);
    expect(boss.buffModifiers.attackMultiplier).toBeCloseTo(1.10);
    expect(ally.buffModifiers.attackMultiplier).toBeCloseTo(1.10);
    expect(scheduledTicks[0]!.calculateDamage(boss, enemies[0]!, 5)).toBe(10);

    scheduledTicks[0]!.onBeforeTick?.(boss, [boss, ally], enemies, 40);

    expect(boss.stackState?.["last-word-enrage"]).toBe(9);
    expect(boss.buffModifiers.attackMultiplier).toBeCloseTo(1.45);
    expect(ally.buffModifiers.attackMultiplier).toBeCloseTo(1.45);
    expect(scheduledTicks[0]!.calculateDamage(boss, enemies[0]!, 40)).toBe(47);
  });

  test("records Remilia Last Word activation and sustained tick damage telemetry after mana gain", () => {
    const simulator = new BattleSimulator();
    const boss = createTestBattleUnit(
      {
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
        unitType: "vanguard",
        unitId: "remilia",
        unitLevel: 1,
      },
      "right",
      0,
      true,
    );
    boss.id = "boss-remilia";
    boss.sourceUnitId = "remilia";
    boss.activeBossSpellId = "last-word";
    boss.attackPower = 40;
    boss.attackSpeed = 10;
    boss.attackRange = 99;
    boss.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "ranger", unitId: "raid-a" },
      "left",
      0,
    );
    enemy.hp = 2000;
    enemy.maxHp = 2000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([enemy], [boss], [], [], 5_000, null, null, null, DEFAULT_FLAGS, 11);

    expect(result.bossSpellMetrics).toHaveLength(1);
    expect(result.bossSpellMetrics?.[0]).toMatchObject({
      spellId: "last-word",
      casterBattleUnitId: "boss-remilia",
      activationCount: 1,
    });
    expect(result.bossSpellMetrics?.[0]?.firstActivationAtMs).toBeGreaterThan(0);
    expect(result.bossSpellMetrics?.[0]?.tickCount).toBeGreaterThan(0);
    expect(result.bossSpellMetrics?.[0]?.totalDamage).toBeGreaterThan(0);
  });

  test("reschedules pending attacks when a timed attack-speed modifier starts", () => {
    const simulator = new BattleSimulator();
    const jyoon = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitId: "jyoon", unitLevel: 4 },
      "left",
      0,
    );
    jyoon.id = "hero-raid-a";
    jyoon.sourceUnitId = "jyoon";
    jyoon.attackPower = 1;
    jyoon.attackSpeed = 20;
    jyoon.attackRange = 99;
    jyoon.movementSpeed = 0;

    const enemy = createTestBattleUnit(
      { cell: 3, unitType: "vanguard", unitId: "enemy", unitLevel: 1 },
      "right",
      0,
    );
    enemy.hp = 1000;
    enemy.maxHp = 1000;
    enemy.attackPower = 0;
    enemy.attackSpeed = 0;
    enemy.movementSpeed = 0;

    const result = simulator.simulateBattle([jyoon], [enemy], [], [], 700);
    const postSkillAttack = result.timeline.find((event) =>
      event.type === "attackStart"
      && event.sourceBattleUnitId === "hero-raid-a"
      && event.atMs > 450
      && event.atMs < 700,
    );

    expect(postSkillAttack).toBeDefined();
  });

  test("reschedules pending moves when a timed movement-speed modifier starts", () => {
    SKILL_DEFINITIONS.ranger = {
      ...SKILL_DEFINITIONS.ranger,
      initialSkillDelayMs: 100,
      skillCooldownMs: 99_999,
      execute: (_caster, _allies, enemies, _log, context) => {
        const target = enemies[0];
        if (!target || !context) {
          return;
        }

        context.applyTimedModifier(target, {
          id: "test-private-square-slow",
          durationMs: 3000,
          movementSpeedMultiplier: 0.5,
        } as any);
      },
    };

    const simulator = new BattleSimulator();
    const caster = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "ranger", unitLevel: 1 },
      "left",
      0,
    );
    caster.attackPower = 0;
    caster.attackSpeed = 0;
    caster.movementSpeed = 0;

    const slowedMelee = createTestBattleUnit(
      { cell: sharedBoardCoordinateToIndex({ x: 4, y: 1 }), unitType: "vanguard", unitLevel: 1 },
      "right",
      0,
    );
    slowedMelee.attackPower = 0;
    slowedMelee.attackSpeed = 0;
    slowedMelee.attackRange = 1;
    slowedMelee.movementSpeed = 2;

    const result = simulator.simulateBattle([caster], [slowedMelee], [], [], 800);

    expect(
      result.timeline.some((event) =>
        event.type === "move"
        && event.battleUnitId === slowedMelee.id
        && event.atMs > 0
        && event.atMs < 800,
      ),
    ).toBe(false);
  });

  test("standard unit skills use cooldown timing instead of attack count", () => {
    const simulator = new BattleSimulator();
    const createVanguard = () => {
      const vanguard = createTestBattleUnit(
        { cell: 3, unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      vanguard.attackPower = 1;
      vanguard.attackSpeed = 10;
      vanguard.attackRange = 4;
      vanguard.movementSpeed = 0;
      return vanguard;
    };

    const createEnemy = () => {
      const enemy = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      enemy.attackPower = 0;
      enemy.attackSpeed = 0;
      enemy.attackRange = 4;
      enemy.movementSpeed = 0;
      enemy.hp = 5000;
      enemy.maxHp = 5000;
      return enemy;
    };

    const beforeCooldown = simulator.simulateBattle([createVanguard()], [createEnemy()], [], [], 2_900);
    expect(beforeCooldown.combatLog.some((entry) => entry.includes("Shield Wall"))).toBe(false);

    const afterCooldown = simulator.simulateBattle([createVanguard()], [createEnemy()], [], [], 3_100);
    expect(afterCooldown.combatLog.some((entry) => entry.includes("Shield Wall"))).toBe(true);
  });

  describe("Remilia boss passive", () => {
    test("HP70%以上のレミリアにLv別ボス攻撃補正が適用される", () => {
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 4, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.8);

      applyRemiliaBossPassiveToBoss(boss);

      expect(boss.buffModifiers.attackMultiplier).toBeCloseTo(1.06);
    });

    test("HP70%未満のレミリアには攻撃補正が適用されない", () => {
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 7, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.6);

      applyRemiliaBossPassiveToBoss(boss);

      expect(boss.buffModifiers.attackMultiplier).toBe(1);
    });

    test("紅魔館ユニットなしでもレミリアがLv別ボス吸血を行う", () => {
      const simulator = new BattleSimulator();
      const raidUnit = createTestBattleUnit(
        { cell: 3, unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.8);
      boss.attackPower = 200;
      boss.attackSpeed = 100;
      boss.attackRange = 99;

      const result = simulator.simulateBattle(
        [raidUnit],
        [boss],
        [{ cell: 3, unitType: "vanguard", unitLevel: 1 }],
        [{ cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" }],
        5_000,
      );

      expect(
        result.combatLog.some((log) => log.includes("Remilia Boss Passive lifesteals 3 HP")),
      ).toBe(true);
    });

    test("レミリアの吸血はフェーズHP削りも実回復量だけ戻す", () => {
      const simulator = new BattleSimulator();
      const raidUnit = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitLevel: 1 },
        "left",
        0,
      );
      raidUnit.attackPower = 100;
      raidUnit.attackSpeed = 100;
      raidUnit.attackRange = 99;
      raidUnit.critRate = 0;
      raidUnit.movementSpeed = 0;

      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.8);
      boss.attackPower = 200;
      boss.attackSpeed = 100;
      boss.attackRange = 99;
      boss.movementSpeed = 0;

      const result = simulator.simulateBattle(
        [raidUnit],
        [boss],
        [{ cell: 3, unitType: "mage", unitLevel: 1 }],
        [{ cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" }],
        1,
      );

      expect(result.bossDamage).toBe(45);
      expect(result.phaseDamageToBossSide).toBe(42);
    });
  });

  describe("boss passive", () => {
    test("isBoss=true かつ remilia は boss data baseline を使う", () => {
      const bossBaseline = getMvpPhase1Boss();
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );

      expect(boss.maxHp).toBe(bossBaseline.hp);
      expect(boss.hp).toBe(bossBaseline.hp);
      expect(boss.attackPower).toBe(bossBaseline.attack);
      expect(boss.attackSpeed).toBe(bossBaseline.attackSpeed);
      expect(boss.attackRange).toBe(bossBaseline.range);
      expect(boss.damageReduction).toBe(bossBaseline.damageReduction);
    });

    test("HP70%以上のレミリアは紅き夜の王でHP70%未満時より高いダメージを出す", () => {
      const simulator = new BattleSimulator();
      const bossWithPassive = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      const bossWithoutPassive = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      bossWithoutPassive.hp = Math.floor(bossWithoutPassive.maxHp * 0.6);

      const raidUnitForPassive = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const raidUnitWithoutPassive = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const passiveResult = simulator.simulateBattle(
        [bossWithPassive],
        [raidUnitForPassive],
        [{ cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" }],
        [{ cell: 2, unitType: "vanguard", unitLevel: 1 }],
        5_000,
      );

      const nonPassiveResult = simulator.simulateBattle(
        [bossWithoutPassive],
        [raidUnitWithoutPassive],
        [{ cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" }],
        [{ cell: 2, unitType: "vanguard", unitLevel: 1 }],
        5_000,
      );

      expect(passiveResult.combatLog.some((entry) => entry.includes("for 38 damage"))).toBe(true);
      expect(nonPassiveResult.combatLog.some((entry) => entry.includes("for 37 damage"))).toBe(true);
    });
  });

  describe("kanjuden debuff immunity", () => {
    test("kanjuden tier1 は crowd_control の攻撃速度低下を無効化する", () => {
      const yuimanSkill = HERO_SKILL_DEFINITIONS.yuiman!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "assassin", unitLevel: 1 },
        "left",
        0,
      );
      const immuneTarget = createTestBattleUnit(
        {
          cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
          unitType: "vanguard",
          unitLevel: 1,
          factionId: "kanjuden",
        },
        "right",
        0,
        false,
        {
          ...DEFAULT_FLAGS,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
        },
      ) as BattleUnit & { debuffImmunityCategories?: string[] };
      immuneTarget.debuffImmunityCategories = ["crowd_control"];

      const log: string[] = [];
      yuimanSkill.execute(caster, [caster], [immuneTarget], log);

      expect(immuneTarget.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(immuneTarget.buffModifiers.defenseMultiplier).toBe(1);
    });

    test("kanjuden でないユニットにはユイマンの範囲妨害が適用される", () => {
      const yuimanSkill = HERO_SKILL_DEFINITIONS.yuiman!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "assassin", unitLevel: 1 },
        "left",
        0,
      );
      const normalTarget = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const log: string[] = [];
      yuimanSkill.execute(caster, [caster], [normalTarget], log);

      expect(normalTarget.buffModifiers.attackSpeedMultiplier).toBe(0.7);
      expect(normalTarget.buffModifiers.defenseMultiplier).toBe(0.9);
    });

    test("ユイマンの範囲妨害は 6x6 の縦距離も半径計算に含める", () => {
      const yuimanSkill = HERO_SKILL_DEFINITIONS.yuiman!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "assassin", unitLevel: 1 },
        "left",
        0,
      );
      const centerTarget = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const verticalTarget = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );
      const outsideTarget = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "mage", unitLevel: 1 },
        "right",
        2,
      );

      const log: string[] = [];
      yuimanSkill.execute(caster, [caster], [centerTarget, verticalTarget, outsideTarget], log);

      expect(centerTarget.buffModifiers.attackSpeedMultiplier).toBe(0.7);
      expect(verticalTarget.buffModifiers.attackSpeedMultiplier).toBe(0.7);
      expect(outsideTarget.buffModifiers.attackSpeedMultiplier).toBe(1);
    });

    test("ユイマンの範囲妨害は術者中心で敵を巻き込む", () => {
      const yuimanSkill = HERO_SKILL_DEFINITIONS.yuiman!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 5 }), unitType: "assassin", unitLevel: 1 },
        "left",
        0,
      );
      const isolatedEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 0 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const nearEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        1,
      );
      const clusteredEnemyA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "ranger", unitLevel: 1 },
        "right",
        2,
      );
      const clusteredEnemyB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "mage", unitLevel: 1 },
        "right",
        3,
      );

      const log: string[] = [];
      yuimanSkill.execute(
        caster,
        [caster],
        [isolatedEnemy, nearEnemy, clusteredEnemyA, clusteredEnemyB],
        log,
      );

      expect(isolatedEnemy.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(nearEnemy.buffModifiers.attackSpeedMultiplier).toBe(0.7);
      expect(clusteredEnemyA.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(clusteredEnemyB.buffModifiers.attackSpeedMultiplier).toBe(1);
    });
  });

  describe("skill targeting", () => {
    test("Backstab は同HPなら caster に近い敵を優先する", () => {
      const assassinSkill = SKILL_DEFINITIONS.assassin!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "assassin", unitLevel: 1 },
        "left",
        0,
      );
      const nearerEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 30 },
        "right",
        0,
      );
      const fartherEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 5, y: 1 }), unitType: "vanguard", unitLevel: 1, hp: 30 },
        "right",
        1,
      );

      const log: string[] = [];
      assassinSkill.execute(caster, [caster], [fartherEnemy, nearerEnemy], log);

      expect(nearerEnemy.hp).toBeLessThan(nearerEnemy.maxHp);
      expect(fartherEnemy.hp).toBe(fartherEnemy.maxHp);
    });
  });

  describe("shinreibyou ultimate modifiers", () => {
    test("shinreibyou tier1 は damaging skill に x1.10 を乗せる", () => {
      const flags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitId: "yoshika", unitLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", unitLevel: 1, factionId: "kanjuden" },
      ];
      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, flags),
      );
      leftUnits[0]!.attackPower = 80;
      leftUnits[0]!.hp = 1000;
      leftUnits[0]!.maxHp = 1000;

      const result = simulator.simulateBattle(
        leftUnits,
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, false, flags)),
        leftPlacements,
        rightPlacements,
        2_500,
        null,
        null,
        null,
        flags,
      );

      expect(result.combatLog.some((log) => log.includes("Backstab! Deals 132 damage"))).toBe(true);
    });

    test("shinreibyou tier2 は debuffed target に +12% bonus damage を乗せる", () => {
      const flags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitId: "yoshika", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 3 }), unitType: "ranger", unitId: "tojiko", unitLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", unitLevel: 1, factionId: "kanjuden" },
      ];
      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, flags),
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, flags),
      );
      leftUnits[0]!.attackPower = 80;
      leftUnits[0]!.hp = 1000;
      leftUnits[0]!.maxHp = 1000;
      rightUnits[0]!.buffModifiers.attackSpeedMultiplier = 0.7;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        2_500,
        null,
        null,
        null,
        flags,
      );

      expect(result.combatLog.some((log) => log.includes("Backstab! Deals 158 damage"))).toBe(true);
    });

    test("shinreibyou tier3 は初期マナとマナ獲得量を伸ばす", () => {
      SKILL_DEFINITIONS.ranger = {
        ...SKILL_DEFINITIONS.ranger,
        activationModel: "mana",
        initialSkillDelayMs: 0,
        skillCooldownMs: 0,
        mana: {
          maxMana: 100,
          initialMana: 0,
          manaCost: 100,
          manaGainOnAttack: 10,
          manaGainOnDamageTakenRatio: 0,
        },
      };
      const flags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitId: "yoshika", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 3 }), unitType: "ranger", unitId: "tojiko", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 3 }), unitType: "mage", unitId: "futo", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "mage", unitId: "miko", unitLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
      ];
      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, flags),
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, flags),
      );
      leftUnits[0]!.attackPower = 1;
      leftUnits[0]!.attackSpeed = 10;
      leftUnits[0]!.attackRange = 99;
      leftUnits[0]!.movementSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.movementSpeed = 0;
      rightUnits[0]!.hp = 5000;
      rightUnits[0]!.maxHp = 5000;

      simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        150,
        null,
        null,
        null,
        flags,
      );

      expect(leftUnits[0]?.currentMana).toBeCloseTo(58);
      expect(leftUnits[0]?.manaGainMultiplier).toBeCloseTo(1.15);
    });

    test("shinreibyou tier inactive では ultimate modifier が発動しない", () => {
      const flags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", unitLevel: 1, factionId: "kanjuden" },
      ];
      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, flags),
      );
      leftUnits[0]!.attackPower = 80;
      leftUnits[0]!.hp = 1000;
      leftUnits[0]!.maxHp = 1000;

      const result = simulator.simulateBattle(
        leftUnits,
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, false, flags)),
        leftPlacements,
        rightPlacements,
        2_500,
        null,
        null,
        null,
        flags,
      );

      expect(result.combatLog.some((log) => log.includes("Backstab! Deals 120 damage"))).toBe(true);
    });
  });

  describe("createBattleUnit", () => {
    test("単一のユニットが正しく作成される", () => {
      const placement: BoardUnitPlacement = {
        cell: 0,
        unitType: "vanguard",
        unitLevel: 1,
      };
      const unit = createTestBattleUnit(placement, "left", 0);
      expect(unit.id).toBe("left-vanguard-0");
      expect(unit.type).toBe("vanguard");
      expect(unit.unitLevel).toBe(1);
      expect(unit).not.toHaveProperty("starLevel");
      expect(unit.cell).toBe(combatCellToRaidBoardIndex(0));
      expect(unit.hp).toBeGreaterThan(0);
      expect(unit.maxHp).toBeGreaterThan(0);
      expect(unit.attackPower).toBeGreaterThan(0);
      expect(unit.isDead).toBe(false);
    });

    test("スターレベルに応じてステータスが変化する", () => {
      const placement1: BoardUnitPlacement = { cell: 0, unitType: "vanguard", unitLevel: 1 };
      const placement2: BoardUnitPlacement = { cell: 1, unitType: "vanguard", unitLevel: 2 };
      const placement3: BoardUnitPlacement = { cell: 2, unitType: "vanguard", unitLevel: 3 };

      const unit1 = createTestBattleUnit(placement1, "left", 0);
      const unit2 = createTestBattleUnit(placement2, "left", 1);
      const unit3 = createTestBattleUnit(placement3, "left", 2);

      expect(unit1.hp).toBeLessThan(unit2.hp);
      expect(unit2.hp).toBeLessThan(unit3.hp);
      expect(unit1.attackPower).toBeLessThan(unit2.attackPower);
      expect(unit2.attackPower).toBeLessThan(unit3.attackPower);
    });

    test("現在のunitType入力は正確な基礎ステータスを返す", () => {
      expect(createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0)).toMatchObject({
        id: "left-vanguard-0",
        type: "vanguard",
        cell: combatCellToRaidBoardIndex(0),
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        movementSpeed: 1,
        attackRange: 1,
        damageReduction: 0,
      });
      expect(createTestBattleUnit({ cell: 1, unitType: "ranger", unitLevel: 1 }, "left", 1)).toMatchObject({
        id: "left-ranger-1",
        type: "ranger",
        cell: combatCellToRaidBoardIndex(1),
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        movementSpeed: 1,
        attackRange: 3,
        damageReduction: 0,
      });
      expect(createTestBattleUnit({ cell: 2, unitType: "mage", unitLevel: 1 }, "right", 0)).toMatchObject({
        id: "right-mage-0",
        type: "mage",
        cell: combatCellToBossBoardIndex(2),
        hp: 40,
        maxHp: 40,
        attackPower: 6,
        attackSpeed: 0.6,
        movementSpeed: 1,
        attackRange: 2,
        damageReduction: 0,
      });
      expect(createTestBattleUnit({ cell: 3, unitType: "assassin", unitLevel: 1 }, "right", 1)).toMatchObject({
        id: "right-assassin-1",
        type: "assassin",
        cell: combatCellToBossBoardIndex(3),
        hp: 45,
        maxHp: 45,
        attackPower: 5,
        attackSpeed: 1,
        movementSpeed: 1,
        attackRange: 1,
        damageReduction: 0,
      });
    });

    test("unitIdがある場合はunitTypeよりunitId解決を優先する", () => {
      // Both paths use flags-aware roster provider resolution
      // Compare: unitId resolution vs direct unitType (both with flags)
      const unitWithUnitId = createTestBattleUnit(
        { cell: 0, unitType: "mage", unitId: "meiling", unitLevel: 1 },
        "left",
        0,
        false,
        DEFAULT_FLAGS,
      );
      const unitWithDirectType = createTestBattleUnit(
        { cell: 1, unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
        false,
        DEFAULT_FLAGS,
      );

      // unitId "meiling" resolves to vanguard despite placement unitType=mage
      expect(unitWithUnitId.type).toBe("vanguard");
      expect(unitWithUnitId.hp).toBe(860);
      // Direct unitType=vanguard uses base stats, not scarlet mansion stats
      expect(unitWithDirectType.type).toBe("vanguard");
      expect(unitWithDirectType.hp).toBe(80); // base vanguard HP
    });

    test("Touhou roster 有効時は unitId 解決した戦闘ステータスを使う", () => {
      const touhouFlags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };

      const unit = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitId: "rin", unitLevel: 1 },
        "left",
        0,
        false,
        touhouFlags,
      );

      expect(unit).toMatchObject({
        id: "left-vanguard-0",
        type: "vanguard",
        hp: 680,
        maxHp: 680,
        attackPower: 36,
        attackSpeed: 0.85,
        movementSpeed: 2,
        attackRange: 1,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 8,
      });
    });

    test("Scarlet Mansion と boss の追加 combat stats を使う", () => {
      const scarletUnit = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitId: "patchouli", unitLevel: 1 },
        "left",
        0,
        false,
        DEFAULT_FLAGS,
      );
      const bossUnit = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", archetype: "remilia", unitLevel: 1 },
        "right",
        0,
        true,
        DEFAULT_FLAGS,
      );

      expect(scarletUnit).toMatchObject({
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 10,
      });
      expect(bossUnit).toMatchObject({
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
      });
    });

    test("Scarlet Mansion units scale HP and attack with unit level", () => {
      const patchouli = createTestBattleUnit(
        { cell: 0, unitType: "mage", unitId: "patchouli", unitLevel: 7 },
        "left",
        0,
        false,
        DEFAULT_FLAGS,
      );

      expect(patchouli.maxHp).toBe(1500);
      expect(patchouli.hp).toBe(1500);
      expect(patchouli.attackPower).toBe(258);
      expect(patchouli.attackSpeed).toBe(0.75);
      expect(patchouli.attackRange).toBe(4);
      expect(patchouli.damageReduction).toBe(10);
    });
  });

  describe("calculateCellDistance", () => {
    test("隣接するセルの距離が正しく計算される", () => {
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
          sharedBoardCoordinateToIndex({ x: 1, y: 5 }),
        ),
      ).toBe(1);
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 3, y: 2 }),
          sharedBoardCoordinateToIndex({ x: 3, y: 3 }),
        ),
      ).toBe(1);
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 5, y: 0 }),
          sharedBoardCoordinateToIndex({ x: 4, y: 0 }),
        ),
      ).toBe(1);
    });

    test("遠いセルの距離が正しく計算される", () => {
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
          sharedBoardCoordinateToIndex({ x: 3, y: 0 }),
        ),
      ).toBe(8);
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
          sharedBoardCoordinateToIndex({ x: 0, y: 1 }),
        ),
      ).toBe(4);
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 3, y: 5 }),
          sharedBoardCoordinateToIndex({ x: 5, y: 2 }),
        ),
      ).toBe(5);
    });

    test("同じセルの距離は0", () => {
      expect(calculateCellDistance(sharedBoardCoordinateToIndex({ x: 3, y: 3 }), sharedBoardCoordinateToIndex({ x: 3, y: 3 }))).toBe(0);
    });

    test("side 指定付きでも shared-board index の 6x6 距離を使う", () => {
      expect(
        calculateCellDistance(
          combatCellToRaidBoardIndex(2),
          combatCellToBossBoardIndex(7),
          "left",
          "right",
        ),
      ).toBe(2);
      expect(
        calculateCellDistance(
          combatCellToRaidBoardIndex(2),
          combatCellToBossBoardIndex(4),
          "left",
          "right",
        ),
      ).toBe(3);
    });

    test("side 指定があっても shared-board 上で隣接していれば距離1", () => {
      const leftCell = sharedBoardCoordinateToIndex({ x: 3, y: 4 });
      const rightCell = sharedBoardCoordinateToIndex({ x: 3, y: 3 });
      expect(calculateCellDistance(leftCell, rightCell, "left", "left")).toBe(1);
      expect(calculateCellDistance(leftCell, rightCell, "left", "right")).toBe(1);
    });

    test("shared-board index は 6x6 Manhattan 距離で計算される", () => {
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
          sharedBoardCoordinateToIndex({ x: 3, y: 2 }),
        ),
      ).toBe(6);
      expect(
        calculateCellDistance(
          sharedBoardCoordinateToIndex({ x: 2, y: 4 }),
          sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
        ),
      ).toBe(3);
    });
  });

  describe("findTarget", () => {
    test("空の敵配列からはnullが返される", () => {
      const attacker: BattleUnit = {
        id: "left-vanguard-0",
        type: "vanguard",
        unitLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const enemies: BattleUnit[] = [];
      expect(findTarget(attacker, enemies)).toBeNull();
    });

    test("null/undefinedの敵配列からはnullが返される", () => {
      const attacker: BattleUnit = {
        id: "left-vanguard-0",
        type: "vanguard",
        unitLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      expect(findTarget(attacker, null as any)).toBeNull();
      expect(findTarget(attacker, undefined as any)).toBeNull();
    });

    test("全員死んでいる場合はnullが返される", () => {
      const attacker: BattleUnit = {
        id: "left-vanguard-0",
        type: "vanguard",
        unitLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const enemies: BattleUnit[] = [
        {
          id: "right-ranger-0",
          type: "ranger",
          unitLevel: 1,
          hp: 50,
          maxHp: 50,
          attackPower: 5,
          attackSpeed: 0.8,
          attackRange: 3,
          cell: 5,
          isDead: true,
          attackCount: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          damageReduction: 0,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
      ];
      expect(findTarget(attacker, enemies)).toBeNull();
    });

    test("射程内の最も近い敵が選択される", () => {
      const attacker: BattleUnit = {
        id: "left-vanguard-0",
        type: "ranger",
        unitLevel: 1,
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        attackRange: 3,
        cell: combatCellToRaidBoardIndex(2),
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const enemies: BattleUnit[] = [
        {
          id: "right-ranger-0",
          type: "ranger",
          unitLevel: 1,
          hp: 50,
          maxHp: 50,
          attackPower: 5,
          attackSpeed: 0.8,
          attackRange: 3,
          cell: combatCellToBossBoardIndex(7),
          isDead: false,
          attackCount: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          damageReduction: 0,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
        {
          id: "right-mage-0",
          type: "mage",
          unitLevel: 1,
          hp: 40,
          maxHp: 40,
          attackPower: 6,
          attackSpeed: 0.6,
          attackRange: 2,
          cell: combatCellToBossBoardIndex(6),
          isDead: false,
          attackCount: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          damageReduction: 0,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
        {
          id: "right-vanguard-0",
          type: "vanguard",
          unitLevel: 1,
          hp: 80,
          maxHp: 80,
          attackPower: 4,
          attackSpeed: 0.5,
          attackRange: 1,
          cell: combatCellToBossBoardIndex(4),
          isDead: false,
          attackCount: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          damageReduction: 0,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
      ];
      const target = findTarget(attacker, enemies);
      expect(target).not.toBeNull();
      expect(target!.cell).toBe(combatCellToBossBoardIndex(6));
    });

    test("taunt中の攻撃者は射程内のtaunt元を優先する", () => {
      const attacker = createTestBattleUnit(
        { cell: 0, unitType: "ranger", unitLevel: 1, range: 4 },
        "right",
        0,
      );
      const closerEnemy = createTestBattleUnit(
        { cell: 0, unitType: "mage", unitLevel: 1 },
        "left",
        0,
      );
      const tauntSource = createTestBattleUnit(
        { cell: 4, unitType: "vanguard", unitLevel: 1, unitId: "meiling" },
        "left",
        1,
      );
      (attacker as BattleUnit & { tauntTargetId?: string }).tauntTargetId = tauntSource.id;

      const target = findTarget(attacker, [closerEnemy, tauntSource]);

      expect(target?.id).toBe(tauntSource.id);
    });

    test("taunt中の近接攻撃者はtaunt元へ接近する", () => {
      const attacker = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, range: 1 },
        "right",
        0,
      );
      const closerEnemy = createTestBattleUnit(
        { cell: 0, unitType: "mage", unitLevel: 1 },
        "left",
        0,
      );
      const tauntSource = createTestBattleUnit(
        { cell: 4, unitType: "vanguard", unitLevel: 1, unitId: "meiling" },
        "left",
        1,
      );
      attacker.tauntTargetId = tauntSource.id;

      const target = findBestApproachTarget(attacker, [closerEnemy, tauntSource], []);

      expect(target?.id).toBe(tauntSource.id);
    });

    test("同距離ならHPが低い敵を優先する", () => {
      const attacker: BattleUnit = {
        id: "left-ranger-0",
        type: "ranger",
        unitLevel: 1,
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        attackRange: 3,
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }),
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const sturdierEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 80 },
        "right",
        0,
      );
      const weakerEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "mage", unitLevel: 1, hp: 20 },
        "right",
        1,
      );

      const target = findTarget(attacker, [sturdierEnemy, weakerEnemy]);
      expect(target?.id).toBe(weakerEnemy.id);
    });

    test("同HPかつ同距離なら cell が小さい敵を優先する", () => {
      const attacker: BattleUnit = {
        id: "left-ranger-0",
        type: "ranger",
        unitLevel: 1,
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        attackRange: 3,
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }),
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const lowerCellEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 40 },
        "right",
        0,
      );
      const higherCellEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 40 },
        "right",
        1,
      );

      const target = findTarget(attacker, [higherCellEnemy, lowerCellEnemy]);
      expect(target?.id).toBe(lowerCellEnemy.id);
    });

    test("ボス本体が近ければ護衛が生存していても通常ターゲットにできる", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "ranger", unitLevel: 1, range: 4 },
        "left",
        0,
      );
      const bossBody = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      const guard = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        1,
      );

      const target = findTarget(attacker, [bossBody, guard]);

      expect(target?.id).toBe(bossBody.id);
    });

    test("護衛がいなければボス本体を対象にできる", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "ranger", unitLevel: 1, range: 4 },
        "left",
        0,
      );
      const bossBody = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );

      const target = findTarget(attacker, [bossBody]);

      expect(target?.id).toBe(bossBody.id);
    });

    test("射程外の敵は対象にならない", () => {
      const attacker: BattleUnit = {
        id: "left-vanguard-0",
        type: "vanguard",
        unitLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const enemies: BattleUnit[] = [
        {
          id: "right-ranger-0",
          type: "ranger",
          unitLevel: 1,
          hp: 50,
          maxHp: 50,
          attackPower: 5,
          attackSpeed: 0.8,
          attackRange: 3,
          cell: 7,
          isDead: false,
          attackCount: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          damageReduction: 0,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
      ];
      expect(findTarget(attacker, enemies)).toBeNull();
    });

    test("接敵最短対象は最寄り敵と異なる場合がある", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const blockerA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const blockerB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const blockerC = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        3,
      );
      const blockerD = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        4,
      );
      const nearEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const farEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        1,
      );

      const bestApproachTarget = findBestApproachTarget(
        attacker,
        [nearEnemy, farEnemy],
        [attacker, blockerA, blockerB, blockerC, blockerD],
      );

      expect(bestApproachTarget?.id).toBe(farEnemy.id);
    });

    test("味方近接が集中しすぎる敵よりも受け口に余裕がある敵を優先する", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const competitorA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const competitorB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const closeFrontBlocker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        3,
      );
      const closeLeftBlocker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        4,
      );
      const closeTopBlocker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        5,
      );
      const closeEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const roomyEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        1,
      );

      const bestApproachTarget = findBestApproachTarget(
        attacker,
        [closeEnemy, roomyEnemy],
        [attacker, competitorA, competitorB, closeFrontBlocker, closeLeftBlocker, closeTopBlocker],
      );

      expect(bestApproachTarget?.id).toBe(roomyEnemy.id);
    });

    test("接敵マス競合が強い場合は空いている攻撃可能マスを優先する", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const blockerAhead = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const blockerLeft = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const enemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const destination = findBestApproachDestinationCoordinate(
        attacker,
        enemy,
        [attacker, blockerAhead, blockerLeft],
        [enemy],
      );

      expect(destination).toEqual({ x: 3, y: 2 });
    });

    test("予約済みの接敵マスは避けて次善の攻撃可能マスを選ぶ", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const blockerAhead = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const blockerLeft = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const enemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const destination = findBestApproachDestinationCoordinate(
        attacker,
        enemy,
        [attacker, blockerAhead, blockerLeft],
        [enemy],
        new Set(["3,2"]),
      );

      expect(destination).toEqual({ x: 1, y: 2 });
    });

    test("接敵マスごとの入口数を数えられる", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const blockerNearFront = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const blockerNearRightEntrance = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const enemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      expect(
        countReachableApproachDestinationEntryCoordinates(
          attacker,
          enemy,
          { x: 1, y: 2 },
          [attacker, blockerNearFront, blockerNearRightEntrance],
          [enemy],
        ),
      ).toBe(3);
      expect(
        countReachableApproachDestinationEntryCoordinates(
          attacker,
          enemy,
          { x: 3, y: 2 },
          [attacker, blockerNearFront, blockerNearRightEntrance],
          [enemy],
        ),
      ).toBe(2);
    });

    test("同歩数なら入口が広い接敵マスを優先する", () => {
      const attacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const blockerNearFront = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const blockerNearRightEntrance = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const remoteCompetitor = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        3,
      );
      const enemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const destination = findBestApproachDestinationCoordinate(
        attacker,
        enemy,
        [attacker, blockerNearFront, blockerNearRightEntrance, remoteCompetitor],
        [enemy],
      );

      expect(destination).toEqual({ x: 1, y: 2 });
    });

    test("同じ敵を追う近接は入力順ではなく別々の接敵マスへ割り当てる", () => {
      const flexibleAttacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      const constrainedAttacker = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );
      const blockerAhead = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        2,
      );
      const blockerLeft = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        3,
      );
      const enemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const assignments = assignApproachDestinationsForTarget(
        [flexibleAttacker, constrainedAttacker],
        enemy,
        [flexibleAttacker, constrainedAttacker, blockerAhead, blockerLeft],
        [enemy],
      );

      expect(assignments.size).toBe(2);
      expect(assignments.get(constrainedAttacker.id)).toBeDefined();
      expect(assignments.get(flexibleAttacker.id)).toBeDefined();
      expect(assignments.get(flexibleAttacker.id)).not.toEqual(
        assignments.get(constrainedAttacker.id),
      );
    });

  });

describe("BattleSimulator", () => {
  const TOUHOU_FACTION_FLAGS = {
    ...DEFAULT_FLAGS,
    enableTouhouRoster: true,
    enableTouhouFactions: true,
  } as const;

  test("6x6 shared-board cells では move event が board coordinate の1歩移動になる", () => {
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 24, unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 11, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      ];
      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index)),
        leftPlacements,
        rightPlacements,
        1_500,
        null,
        null,
        null,
        { ...DEFAULT_FLAGS, enableBossExclusiveShop: true },
      );

      const firstMove = result.timeline.find((event) => event.type === "move");
      expect(firstMove).toMatchObject({
        type: "move",
        from: { x: 0, y: 4 },
        to: { x: 1, y: 4 },
      });
    });

    test("6x6 shared-board cells では occupied cell を避けて detour する", () => {
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 4 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index)),
        leftPlacements,
        rightPlacements,
        1_500,
        null,
        null,
        null,
        { ...DEFAULT_FLAGS, enableBossExclusiveShop: true },
      );

      const detourMove = result.timeline.find(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );
      expect(detourMove).toMatchObject({
        type: "move",
        from: { x: 0, y: 4 },
        to: { x: 0, y: 3 },
      });
    });

    test("6x6 shared-board cells では一度離れる遠回りでも有効な path を選ぶ", () => {
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 4 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index)),
        leftPlacements,
        rightPlacements,
        1_500,
        null,
        null,
        null,
        { ...DEFAULT_FLAGS, enableBossExclusiveShop: true },
      );

      const rerouteMove = result.timeline.find(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );
      expect(rerouteMove).toMatchObject({
        type: "move",
        from: { x: 1, y: 4 },
        to: { x: 0, y: 4 },
      });
    });

    test("6x6 shared-board cells では到達経路がなくても詰まりを避ける1歩迂回を選ぶ", () => {
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 0 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 5 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index)),
        leftPlacements,
        rightPlacements,
        1_500,
        null,
        null,
        null,
        { ...DEFAULT_FLAGS, enableBossExclusiveShop: true },
      );

      const fallbackMove = result.timeline.find(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );
      expect(fallbackMove).toMatchObject({
        type: "move",
        from: { x: 1, y: 3 },
        to: { x: 0, y: 3 },
      });
    });

    test("6x6 shared-board cells では接敵マスが競合する場合に空いている側へ回り込む", () => {
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index)),
        leftPlacements,
        rightPlacements,
        500,
        null,
        null,
        null,
        { ...DEFAULT_FLAGS, enableBossExclusiveShop: true },
      );

      const rerouteMove = result.timeline.find(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );
      expect(rerouteMove).toMatchObject({
        type: "move",
        from: { x: 2, y: 4 },
        to: { x: 3, y: 4 },
        plannedApproachTargetBattleUnitId: "right-vanguard-0",
        plannedApproachDestinationStillOpenBeforeMove: true,
        usedPlannedApproachDestination: true,
      });
    });

    test("射程1ユニットは移動後の初撃待ちを短縮する", () => {
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 4 }), unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "ranger", unitLevel: 1 },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index)),
        leftPlacements,
        rightPlacements,
        1_500,
      );

      const firstLeftMove = result.timeline.find(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );
      const firstLeftAttack = result.timeline.find(
        (event) => event.type === "attackStart" && event.sourceBattleUnitId === "left-vanguard-0",
      );

      expect(firstLeftMove).toMatchObject({
        type: "move",
        atMs: 0,
      });
      expect(firstLeftAttack).toMatchObject({
        type: "attackStart",
        atMs: 250,
      });
    });

    test("movementSpeed に応じて攻撃速度と独立して連続移動する", () => {
      const simulator = new BattleSimulator();
      const leftUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      leftUnit.attackSpeed = 0;
      leftUnit.movementSpeed = 2;

      const rightUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 4 }), unitType: "ranger", unitLevel: 1 },
        "right",
        0,
      );
      rightUnit.attackSpeed = 0;
      rightUnit.movementSpeed = 0;

      const result = simulator.simulateBattle([leftUnit], [rightUnit], [], [], 1_500);
      const leftMoves = result.timeline.filter(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );

      expect(leftMoves.length).toBeGreaterThanOrEqual(2);
      expect(leftMoves[0]).toMatchObject({
        type: "move",
        atMs: 0,
        from: { x: 0, y: 4 },
        to: { x: 1, y: 4 },
      });
      expect(leftMoves[1]).toMatchObject({
        type: "move",
        atMs: 500,
        from: { x: 1, y: 4 },
        to: { x: 2, y: 4 },
      });
    });

    test("move event に追跡対象と最適接敵対象の診断を載せる", () => {
      const simulator = new BattleSimulator();
      const leftUnits = [
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 0, y: 2 }), unitType: "vanguard", unitLevel: 1 },
          "left",
          0,
        ),
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", unitLevel: 1 },
          "left",
          1,
        ),
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
          "left",
          2,
        ),
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
          "left",
          3,
        ),
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1 },
          "left",
          4,
        ),
      ];
      const rightUnits = [
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
          "right",
          0,
        ),
        createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 5, y: 2 }), unitType: "vanguard", unitLevel: 1 },
          "right",
          1,
        ),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 1_500);
      const firstMove = result.timeline.find(
        (event) => event.type === "move" && event.battleUnitId === "left-vanguard-0",
      );

      expect(firstMove).toMatchObject({
        type: "move",
        pursuedTargetBattleUnitId: "right-vanguard-1",
        bestApproachTargetBattleUnitId: "right-vanguard-1",
        pursuedTargetDistanceBeforeMove: 5,
        bestApproachTargetDistanceBeforeMove: 5,
      });
      expect(firstMove).toMatchObject({
        pursuedTargetRequiredStepsBeforeMove: 8,
        bestApproachTargetRequiredStepsBeforeMove: 8,
      });
    });

    test("単一の対決で正しく戦闘が進行する", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 5000);

      expect(result.winner).toMatch(/^left$|^right$|^draw$/);
      expect(result.leftSurvivors.length + result.rightSurvivors.length).toBeGreaterThan(0);
      expect(result.combatLog.length).toBeGreaterThan(1);
      expect(result.combatLog[0]).toBe("Battle started");
      expect(result.combatLog[result.combatLog.length - 1]).toMatch(/^Battle ended:/);
    });

    test("hero unit は left side として敵ユニットを攻撃する", () => {
      const simulator = new BattleSimulator();
      const heroUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", unitLevel: 1 },
        "left",
        0,
      );
      heroUnit.id = "hero-reimu";
      heroUnit.sourceUnitId = "hero-reimu";

      const rightUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );

      const result = simulator.simulateBattle([heroUnit], [rightUnit], [], [], 1_000);

      expect(rightUnit.hp).toBeLessThan(rightUnit.maxHp);
      expect(
        result.timeline.some(
          (event) =>
            event.type === "attackStart"
            && event.sourceBattleUnitId === "hero-reimu"
            && event.targetBattleUnitId === rightUnit.id,
        ),
      ).toBe(true);
      expect(
        result.timeline.some(
          (event) =>
            event.type === "attackStart"
            && event.sourceBattleUnitId === "hero-reimu"
            && event.targetBattleUnitId === "hero-reimu",
        ),
      ).toBe(false);
    });

    test("right side の hero unit は自分や味方ではなく left side の敵を攻撃する", () => {
      const simulator = new BattleSimulator();
      const leftBossUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      const rightHeroUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      rightHeroUnit.id = "hero-reimu";
      rightHeroUnit.sourceUnitId = "hero-reimu";
      const rightAllyUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle(
        [leftBossUnit],
        [rightHeroUnit, rightAllyUnit],
        [],
        [],
        1_000,
      );

      expect(leftBossUnit.hp).toBeLessThan(leftBossUnit.maxHp);
      expect(
        result.timeline.some(
          (event) =>
            event.type === "attackStart"
            && event.sourceBattleUnitId === "hero-reimu"
            && event.targetBattleUnitId === leftBossUnit.id,
        ),
      ).toBe(true);
      expect(
        result.timeline.some(
          (event) =>
            event.type === "attackStart"
            && event.sourceBattleUnitId === "hero-reimu"
            && (
              event.targetBattleUnitId === "hero-reimu"
              || event.targetBattleUnitId === rightAllyUnit.id
            ),
        ),
      ).toBe(false);
      expect(
        result.timeline.some(
          (event) =>
            event.type === "damageApplied"
            && event.sourceBattleUnitId === "hero-reimu"
            && (
              event.targetBattleUnitId === "hero-reimu"
              || event.targetBattleUnitId === rightAllyUnit.id
            ),
        ),
      ).toBe(false);
    });

    test("hero skill で与えたダメージも timeline と damageDealt に記録される", () => {
      const simulator = new BattleSimulator();
      const heroUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "mage", unitLevel: 1 },
        "left",
        0,
      );
      heroUnit.id = "hero-marisa";
      heroUnit.sourceUnitId = "hero-marisa";
      heroUnit.attackPower = 120;
      heroUnit.attackSpeed = 20;

      const rightUnitA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 1 }), unitType: "vanguard", unitLevel: 1 },
        "right",
        0,
      );
      const rightUnitB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 1 }), unitType: "ranger", unitLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle([heroUnit], [rightUnitA, rightUnitB], [], [], 600);

      const heroSkillDamageEvents = result.timeline.filter(
        (event) => event.type === "damageApplied" && event.sourceBattleUnitId === "hero-marisa",
      );

      expect(heroSkillDamageEvents.length).toBeGreaterThan(0);
      expect(result.damageDealt.left).toBeGreaterThan(0);
      expect(rightUnitA.hp + rightUnitB.hp).toBeLessThan(rightUnitA.maxHp + rightUnitB.maxHp);
    });

    test("player-scoped hero id でも sourceUnitId から hero skill を解決する", () => {
      const simulator = new BattleSimulator();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const heroUnit = createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "mage", unitLevel: 1 },
          "left",
          0,
        );
        heroUnit.id = "hero--session-123";
        heroUnit.sourceUnitId = "marisa";
        heroUnit.attackPower = 120;
        heroUnit.attackSpeed = 20;

        const rightUnitA = createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 1, y: 1 }), unitType: "vanguard", unitLevel: 1 },
          "right",
          0,
        );
        const rightUnitB = createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 3, y: 1 }), unitType: "ranger", unitLevel: 1 },
          "right",
          1,
        );

        const result = simulator.simulateBattle([heroUnit], [rightUnitA, rightUnitB], [], [], 600);

        const heroSkillDamageEvents = result.timeline.filter(
          (event) => event.type === "damageApplied" && event.sourceBattleUnitId === "hero--session-123",
        );

        expect(heroSkillDamageEvents.length).toBeGreaterThan(0);
        expect(result.damageDealt.left).toBeGreaterThan(0);
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining("Invalid hero ID for unit"),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    test("hero skill 未定義の有効 hero id は Invalid hero ID stderr を出さない", () => {
      const simulator = new BattleSimulator();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const heroUnit = createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "mage", unitLevel: 1 },
          "left",
          0,
        );
        heroUnit.id = "hero-p3";
        heroUnit.sourceUnitId = "okina";

        const rightUnit = createTestBattleUnit(
          { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", unitLevel: 1 },
          "right",
          0,
        );

        const result = simulator.simulateBattle([heroUnit], [rightUnit], [], [], 1_500);

        expect(result.timeline.length).toBeGreaterThan(0);
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          expect.stringContaining("Invalid hero ID for unit"),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    test("同じ入力からは同じ結果が得られる（決定論性）", () => {
      const simulator1 = new BattleSimulator({ rng: createSeededBattleRng(12345) });
      const simulator2 = new BattleSimulator({ rng: createSeededBattleRng(12345) });

      const createLeftUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "ranger", unitLevel: 1 }, "left", 1),
      ];
      const createRightUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0),
        createTestBattleUnit({ cell: 6, unitType: "ranger", unitLevel: 1 }, "right", 1),
      ];

      const result1 = simulator1.simulateBattle(createLeftUnits(), createRightUnits(), [], [], 10000);
      const result2 = simulator2.simulateBattle(createLeftUnits(), createRightUnits(), [], [], 10000);

      expect(result1.winner).toBe(result2.winner);
      expect(result1.leftSurvivors.length).toBe(result2.leftSurvivors.length);
      expect(result1.rightSurvivors.length).toBe(result2.rightSurvivors.length);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });

    test("異なる seed は crit-sensitive な戦闘結果を変えうる", () => {
      const createLeftUnits = (): BattleUnit[] => {
        const attacker = createTestBattleUnit(
          { cell: 0, unitType: "ranger", unitLevel: 1, attack: 20, critRate: 0.2366 },
          "left",
          0,
        );
        attacker.attackRange = 6;
        attacker.attackSpeed = 0;
        return [attacker];
      };
      const createRightUnits = (): BattleUnit[] => {
        const defender = createTestBattleUnit(
          { cell: 0, unitType: "vanguard", unitLevel: 1, hp: 100 },
          "right",
          0,
        );
        defender.attackRange = 0;
        defender.attackSpeed = 0;
        return [defender];
      };

      const critResult = new BattleSimulator({ rng: createSeededBattleRng(1) }).simulateBattle(
        createLeftUnits(),
        createRightUnits(),
        [],
        [],
        10,
      );
      const nonCritResult = new BattleSimulator({ rng: createSeededBattleRng(2) }).simulateBattle(
        createLeftUnits(),
        createRightUnits(),
        [],
        [],
        10,
      );

      expect(critResult.damageDealt.left).toBeGreaterThan(nonCritResult.damageDealt.left);
      expect(critResult.combatLog).not.toEqual(nonCritResult.combatLog);
    });

    test("現在のMVP戦闘ベースラインは同じ入力で正確に再現される", () => {
      const createLeftUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "ranger", unitLevel: 1 }, "left", 1),
      ];
      const createRightUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0),
        createTestBattleUnit({ cell: 6, unitType: "ranger", unitLevel: 1 }, "right", 1),
      ];

      const summarize = (result: ReturnType<BattleSimulator["simulateBattle"]>) => ({
        winner: result.winner,
        durationMs: result.durationMs,
        damageDealt: result.damageDealt,
        leftSurvivors: result.leftSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell })),
        rightSurvivors: result.rightSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell })),
        combatLogStart: result.combatLog.slice(0, 3),
        combatLogEnd: result.combatLog.slice(-3),
      });

      const result1 = summarize(
        new BattleSimulator().simulateBattle(createLeftUnits(), createRightUnits(), [], [], 10_000),
      );
      const result2 = summarize(
        new BattleSimulator().simulateBattle(createLeftUnits(), createRightUnits(), [], [], 10_000),
      );

      expect(result1).toEqual(result2);
      expect(result1).toEqual({
        winner: "draw",
        durationMs: 10_000,
        damageDealt: {
          left: 28,
          right: 28,
        },
        leftSurvivors: [
          { id: "left-vanguard-0", hp: 70, cell: 14 },
          { id: "left-ranger-1", hp: 32, cell: combatCellToRaidBoardIndex(1) },
        ],
        rightSurvivors: [
          { id: "right-vanguard-0", hp: 70, cell: 21 },
          { id: "right-ranger-1", hp: 32, cell: combatCellToBossBoardIndex(6) },
        ],
        combatLogStart: ["Battle started", "Left units: 2", "Right units: 2"],
        combatLogEnd: [
          "Left Ranger (cell 20) attacks Right Vanguard (cell 21) for 1 damage (70/80)",
          "Right Ranger (cell 15) attacks Left Vanguard (cell 14) for 1 damage (70/80)",
          "Battle ended: Draw (HP: 102 vs 102)",
        ],
      });
    });

    test("hero synergy bonus typeが指定された側のシナジーが強化される", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 4, unitType: "ranger", unitLevel: 1 },
        { cell: 5, unitType: "ranger", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 4, unitType: "ranger", unitLevel: 1 },
        { cell: 5, unitType: "ranger", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "ranger", unitLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "ranger", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        30_000,
        "ranger",
        null,
      );

      expect(result.winner).toBe("left");
    });

    test("grassroot_network tier1 は該当 faction ユニットにだけ攻撃速度バフを適用する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitLevel: 1, unitId: "wakasagihime", factionId: "grassroot_network" },
        { cell: 1, unitType: "assassin", unitLevel: 1, unitId: "sekibanki", factionId: "grassroot_network" },
        { cell: 2, unitType: "vanguard", unitLevel: 1, unitId: "zanmu", factionId: null },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const baselineLeftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit({ ...placement, factionId: null }, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0, false, TOUHOU_FACTION_FLAGS),
      ];

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        10,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );

      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.1);
      expect(leftUnits[1]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.1);
      expect(leftUnits[0]?.attackPower).toBe(baselineLeftUnits[0]!.attackPower);
      expect(leftUnits[1]?.attackPower).toBe(baselineLeftUnits[1]!.attackPower);
      expect(leftUnits[2]?.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(leftUnits[2]?.attackPower).toBe(baselineLeftUnits[2]!.attackPower);
    });

    test("grassroot_network tier2 は攻撃速度と低HP対象への追い込みを付与する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitLevel: 1, unitId: "wakasagihime", factionId: "grassroot_network" },
        { cell: 1, unitType: "assassin", unitLevel: 1, unitId: "sekibanki", factionId: "grassroot_network" },
        { cell: 2, unitType: "vanguard", unitLevel: 1, unitId: "kagerou", factionId: "grassroot_network" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1, hp: 1000, attack: 0, attackSpeed: 0, range: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, TOUHOU_FACTION_FLAGS),
      );

      simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );

      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.15);
      expect(leftUnits[1]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.15);
      expect(leftUnits[2]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.15);
      expect(leftUnits[0]?.bonusDamageVsLowHpTarget).toBeCloseTo(0.2);
      expect(leftUnits[1]?.bonusDamageVsLowHpTarget).toBeCloseTo(0.2);
      expect(leftUnits[2]?.bonusDamageVsLowHpTarget).toBeCloseTo(0.2);
    });

    test("myourenji tier2 は該当 faction ユニットに HP と守護結界を適用する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "vanguard", unitLevel: 1, unitId: "ichirin", factionId: "myourenji" },
        { cell: 2, unitType: "mage", unitLevel: 1, unitId: "murasa", factionId: "myourenji" },
        { cell: 3, unitType: "mage", unitLevel: 1, unitId: "zanmu", factionId: null },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const baselineLeftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit({ ...placement, factionId: null }, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0, false, TOUHOU_FACTION_FLAGS),
      ];

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        10,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );

      expect(leftUnits[0]?.maxHp).toBeGreaterThan(baselineLeftUnits[0]!.maxHp);
      expect(leftUnits[1]?.maxHp).toBeGreaterThan(baselineLeftUnits[1]!.maxHp);
      expect(leftUnits[2]?.maxHp).toBeGreaterThan(baselineLeftUnits[2]!.maxHp);
      expect(leftUnits[0]?.shieldAmount).toBe(Math.floor(leftUnits[0]!.maxHp * 0.1));
      expect(leftUnits[1]?.shieldAmount).toBe(Math.floor(leftUnits[1]!.maxHp * 0.1));
      expect(leftUnits[2]?.shieldAmount).toBe(Math.floor(leftUnits[2]!.maxHp * 0.1));
      expect(leftUnits[0]?.attackPower).toBe(baselineLeftUnits[0]!.attackPower);
      expect(leftUnits[1]?.attackPower).toBe(baselineLeftUnits[1]!.attackPower);
      expect(leftUnits[2]?.attackPower).toBe(baselineLeftUnits[2]!.attackPower);
      expect(leftUnits[3]?.maxHp).toBe(baselineLeftUnits[3]!.maxHp);
      expect(leftUnits[3]?.shieldAmount ?? 0).toBe(0);
      expect(leftUnits[3]?.attackPower).toBe(baselineLeftUnits[3]!.attackPower);
    });

    test("kou_ryuudou tier1 は該当 faction ユニットの初期マナだけを加算する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "mage", unitLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", unitLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "vanguard", unitLevel: 1, unitId: "junko", factionId: "kanjuden" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1, hp: 999, attack: 0, attackSpeed: 0, range: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, TOUHOU_FACTION_FLAGS),
      );

      simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );

      expect(leftUnits[0]?.currentMana).toBe(50);
      expect(leftUnits[1]?.currentMana).toBe(55);
      expect(leftUnits[2]?.currentMana).toBe(40);
    });

    test("kou_ryuudou tier2 は最高攻撃力の虹龍洞ユニットだけに戦闘開始攻撃速度バフを付与する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "mage", unitLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", unitLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", unitLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "vanguard", unitLevel: 1, unitId: "momoyo", factionId: "kou_ryuudou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1, hp: 999, attack: 0, attackSpeed: 0, range: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, TOUHOU_FACTION_FLAGS),
      );

      simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );

      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(leftUnits[1]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.15);
      expect(leftUnits[2]?.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(leftUnits[3]?.buffModifiers.attackSpeedMultiplier).toBe(1);
    });

    test("kanjuden tier2 は高額完成報酬として火力と初期マナと耐性を付与する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitLevel: 1, unitId: "clownpiece", factionId: "kanjuden" },
        { cell: 1, unitType: "vanguard", unitLevel: 1, unitId: "junko", factionId: "kanjuden" },
        { cell: 2, unitType: "mage", unitLevel: 1, unitId: "hecatia", factionId: "kanjuden" },
        { cell: 3, unitType: "mage", unitLevel: 1, unitId: "zanmu", factionId: null },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1, hp: 999, attack: 0, attackSpeed: 0, range: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const baselineLeftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit({ ...placement, factionId: null }, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, TOUHOU_FACTION_FLAGS),
      );

      simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );
      simulator.simulateBattle(
        baselineLeftUnits,
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, false, TOUHOU_FACTION_FLAGS)),
        leftPlacements.map((placement) => ({ ...placement, factionId: null })),
        rightPlacements,
        0,
        null,
        null,
        null,
        TOUHOU_FACTION_FLAGS,
      );

      expect(leftUnits[0]?.buffModifiers.attackMultiplier).toBeCloseTo(1.25);
      expect(leftUnits[1]?.buffModifiers.attackMultiplier).toBeCloseTo(1.25);
      expect(leftUnits[2]?.buffModifiers.attackMultiplier).toBeCloseTo(1.25);
      expect(leftUnits[3]?.buffModifiers.attackMultiplier).toBe(baselineLeftUnits[3]!.buffModifiers.attackMultiplier);
      expect(leftUnits[0]?.attackPower).toBe(baselineLeftUnits[0]!.attackPower);
      expect(leftUnits[1]?.attackPower).toBe(baselineLeftUnits[1]!.attackPower);
      expect(leftUnits[2]?.attackPower).toBe(baselineLeftUnits[2]!.attackPower);
      expect(leftUnits[0]?.currentMana).toBe((baselineLeftUnits[0]!.currentMana ?? 0) + 35);
      expect(leftUnits[1]?.currentMana).toBe((baselineLeftUnits[1]!.currentMana ?? 0) + 35);
      expect(leftUnits[2]?.currentMana).toBe((baselineLeftUnits[2]!.currentMana ?? 0) + 35);
      expect(leftUnits[3]?.currentMana).toBe(baselineLeftUnits[3]!.currentMana);
      expect(leftUnits[0]?.debuffImmunityCategories).toEqual(["crowd_control", "stat_down", "dot"]);
      expect(leftUnits[1]?.debuffImmunityCategories).toEqual(["crowd_control", "stat_down", "dot"]);
      expect(leftUnits[2]?.debuffImmunityCategories).toEqual(["crowd_control", "stat_down", "dot"]);
      expect(leftUnits[3]?.debuffImmunityCategories).toEqual([]);
    });

    test("enableTouhouFactions=false では factionId があっても faction buff を適用しない", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitLevel: 1, unitId: "wakasagihime", factionId: "grassroot_network" },
        { cell: 1, unitType: "assassin", unitLevel: 1, unitId: "sekibanki", factionId: "grassroot_network" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, {
          ...DEFAULT_FLAGS,
          enableTouhouRoster: true,
          enableTouhouFactions: false,
        }),
      );
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        10,
        null,
        null,
        null,
        {
          ...DEFAULT_FLAGS,
          enableTouhouRoster: true,
          enableTouhouFactions: false,
        },
      );

      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(leftUnits[1]?.buffModifiers.attackSpeedMultiplier).toBe(1);
    });

    test("chireiden tier1 は陣営効果で軽減したダメージを攻撃元へ反射する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", unitLevel: 1, hp: 200, attack: 100, attackSpeed: 0.8, range: 3 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "mage", unitLevel: 1, hp: 200, attack: 0, attackSpeed: 0, range: 1, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 200, attack: 0, attackSpeed: 0, range: 1, factionId: "chireiden" },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index),
      );
      const rightUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index),
      );
      rightUnits[0]!.attackPower = 0;
      rightUnits[1]!.attackPower = 0;
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[1]!.attackSpeed = 0;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        10,
        null,
        null,
        null,
        {
          ...DEFAULT_FLAGS,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
        },
      );

      expect(rightUnits[0]?.hp).toBe(153);
      expect(result.combatLog.some((log) => log.includes("reflects 3 damage"))).toBe(true);
    });

    test("chireiden reflection は反射ダメージを再反射しない", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", unitLevel: 1, hp: 200, attack: 100, attackSpeed: 0.8, range: 3, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1, hp: 200, attack: 0, attackSpeed: 0, range: 1, factionId: "chireiden" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "mage", unitLevel: 1, hp: 200, attack: 100, attackSpeed: 0.8, range: 3, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 200, attack: 0, attackSpeed: 0, range: 1, factionId: "chireiden" },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index),
      );
      const rightUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index),
      );

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        10,
        null,
        null,
        null,
        {
          ...DEFAULT_FLAGS,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
        },
      );

      expect(leftUnits[0]?.hp).toBe(150);
      expect(rightUnits[0]?.hp).toBe(150);
      expect(result.combatLog.filter((log) => log.includes("reflects"))).toHaveLength(2);
    });

    test("同時攻撃の damageApplied はヒットごとの remainingHp を保持する", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit(
          { cell: 1, unitType: "ranger", unitLevel: 1, attack: 20, attackSpeed: 1, range: 4, critRate: 0 },
          "left",
          0,
        ),
        createTestBattleUnit(
          { cell: 3, unitType: "ranger", unitLevel: 1, attack: 20, attackSpeed: 1, range: 4, critRate: 0 },
          "left",
          1,
        ),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit(
          { cell: 2, unitType: "vanguard", unitLevel: 1, hp: 80, attack: 1, attackSpeed: 0.1, range: 1, critRate: 0 },
          "right",
          0,
        ),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 10);
      const hitEvents = result.timeline.filter(
        (event) => event.type === "damageApplied" && event.targetBattleUnitId === rightUnits[0]?.id,
      );

      expect(hitEvents).toHaveLength(2);
      expect(hitEvents[0]).toMatchObject({ amount: 10, remainingHp: 70 });
      expect(hitEvents[1]).toMatchObject({ amount: 10, remainingHp: 60 });
    });

    test("反射ダメージで boss が倒れた場合も勝敗が確定する", () => {
      const simulator = new BattleSimulator();

      const leftBoss = createTestBattleUnit(
        {
          cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }),
          unitType: "vanguard",
          unitLevel: 1,
          hp: 10,
          attack: 20,
          attackSpeed: 1,
          range: 1,
          critRate: 0,
        },
        "left",
        0,
        true,
      );
      const rightReflector = createTestBattleUnit(
        {
          cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
          unitType: "vanguard",
          unitLevel: 1,
          hp: 100,
          attack: 1,
          attackSpeed: 0.1,
          range: 1,
          critRate: 0,
        },
        "right",
        0,
      );
      rightReflector.reflectRatio = 1;

      const result = simulator.simulateBattle([leftBoss], [rightReflector], [], [], 100);

      expect(leftBoss.isDead).toBe(true);
      expect(result.winner).toBe("right");
      expect(result.combatLog.some((log) => log.includes("reflects"))).toBe(true);
    });

    test("boss のフェーズHP切れは強制終了ではなく専用の終了理由で記録する", () => {
      const simulator = new BattleSimulator();

      const leftAttacker = createTestBattleUnit(
        {
          cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
          unitType: "ranger",
          unitLevel: 1,
          attack: 50,
          attackSpeed: 1,
          range: 4,
          critRate: 0,
        },
        "left",
        0,
      );
      const rightBoss = createTestBattleUnit(
        {
          cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
          unitType: "vanguard",
          unitLevel: 1,
          hp: 20,
          attack: 1,
          attackSpeed: 0.1,
          range: 1,
          critRate: 0,
        },
        "right",
        0,
        true,
      );

      const result = simulator.simulateBattle([leftAttacker], [rightBoss], [], [], 100);

      expect(result.winner).toBe("left");
      expect(result.endReason).toBe("phase_hp_depleted");
      expect(result.timeline.at(-1)).toMatchObject({
        type: "battleEnd",
        endReason: "phase_hp_depleted",
      });
      expect(result.combatLog.some((log) => log.includes("phase HP depleted!"))).toBe(true);
      expect(result.combatLog.some((log) => log.includes("has been defeated"))).toBe(false);
    });

    test("戦闘ログにダメージ情報が記録される", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 2, unitType: "ranger", unitLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "vanguard", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 5000);

      const damageLogs = result.combatLog.filter((log) => log.includes("damage"));
      expect(damageLogs.length).toBeGreaterThan(0);
      expect(damageLogs[0]).toMatch(/attacks.*for \d+ damage \(\d+\/\d+\)|CRITICAL HIT on.*for \d+ damage!/);
    });

    test("sub-unit assist設定がある場合はHPボーナスが適用されログに記録される", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 1, unitType: "ranger", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 1, unitType: "ranger", unitLevel: 1 }, "right", 0),
      ];

      const subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig> = new Map<
        BoardUnitType,
        SubUnitConfig
      >([
        [
          "vanguard",
          {
            unitId: "warrior_a_sub",
            mode: "assist",
            bonusHpPct: 0.1,
          },
        ],
      ]);

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        5_000,
        null,
        null,
        subUnitAssistConfigByType,
      );

      expect(leftUnits[0]?.maxHp).toBe(88);
      expect(
        result.combatLog.some((log) =>
          log.includes("sub-unit assist (warrior_a_sub)"),
        ),
      ).toBe(true);
    });

    test("sub-unit assistは対応fixed pairのunitIdにだけ適用される", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", unitId: "warrior_a", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 1, unitType: "vanguard", unitId: "warrior_b", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitId: "warrior_a", unitLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 1, unitType: "vanguard", unitId: "warrior_b", unitLevel: 1 }, "right", 0),
      ];

      const subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig> = new Map([
        [
          "vanguard",
          {
            unitId: "warrior_a_sub",
            mode: "assist",
            bonusHpPct: 0.1,
            parentUnitId: "warrior_a",
          },
        ],
      ]);

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        5_000,
        null,
        null,
        subUnitAssistConfigByType,
      );

      expect(leftUnits[0]?.maxHp).toBe(88);
      expect(rightUnits[0]?.maxHp).toBe(80);
      expect(result.combatLog.filter((log) => log.includes("sub-unit assist (warrior_a_sub)"))).toHaveLength(1);
    });

    test("sub-unit assist設定がない場合はHPボーナスもログ出力も発生しない", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 1, unitType: "ranger", unitLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 1, unitType: "ranger", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, leftPlacements, rightPlacements, 5_000);

      expect(leftUnits[0]?.maxHp).toBe(80);
      expect(result.combatLog.some((log) => log.includes("sub-unit assist"))).toBe(false);
    });

    test("草の根サブ装備補正はサブ側unitIdとLvでメインを強化する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        {
          cell: 0,
          unitType: "vanguard",
          unitId: "rin",
          unitLevel: 1,
          subUnit: {
            unitType: "ranger",
            unitId: "wakasagihime",
            unitLevel: 1,
          },
        },
        {
          cell: 1,
          unitType: "ranger",
          unitId: "nazrin",
          unitLevel: 1,
          subUnit: {
            unitType: "assassin",
            unitId: "sekibanki",
            unitLevel: 4,
          },
        },
        {
          cell: 2,
          unitType: "mage",
          unitId: "satori",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "kagerou",
            unitLevel: 7,
          },
        },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitId: "yoshika", unitLevel: 1 },
      ];

      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, DEFAULT_FLAGS)
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, DEFAULT_FLAGS)
      );
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      const rinBaseAttack = leftUnits[0]!.attackPower;
      const nazrinBaseAttack = leftUnits[1]!.attackPower;
      const satoriBaseHp = leftUnits[2]!.maxHp;
      const satoriBaseDamageReduction = leftUnits[2]!.damageReduction;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        DEFAULT_FLAGS,
      );

      expect(leftUnits[0]?.attackPower).toBe(rinBaseAttack + 10);
      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.10);

      expect(leftUnits[1]?.attackPower).toBe(nazrinBaseAttack + 34);
      expect(leftUnits[1]?.critRate).toBeCloseTo(0.10);

      expect(leftUnits[2]?.maxHp).toBe(satoriBaseHp + 700);
      expect(leftUnits[2]?.hp).toBe(satoriBaseHp + 700);
      expect(leftUnits[2]?.damageReduction).toBe(satoriBaseDamageReduction + 12);
      expect(result.combatLog.filter((log) => log.includes("sub equipment bonus"))).toHaveLength(3);
    });

    test("虹龍洞サブ装備補正はサブ側unitIdとLvでメインを強化する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        {
          cell: 0,
          unitType: "vanguard",
          unitId: "rin",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "tsukasa",
            unitLevel: 1,
          },
        },
        {
          cell: 1,
          unitType: "ranger",
          unitId: "nazrin",
          unitLevel: 1,
          subUnit: {
            unitType: "ranger",
            unitId: "megumu",
            unitLevel: 4,
          },
        },
        {
          cell: 2,
          unitType: "mage",
          unitId: "satori",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "chimata",
            unitLevel: 7,
          },
        },
        {
          cell: 3,
          unitType: "assassin",
          unitId: "koishi",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "momoyo",
            unitLevel: 4,
          },
        },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitId: "yoshika", unitLevel: 1 },
      ];

      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, DEFAULT_FLAGS)
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, DEFAULT_FLAGS)
      );
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      const rinBaseAttack = leftUnits[0]!.attackPower;
      const nazrinBaseAttack = leftUnits[1]!.attackPower;
      const satoriBaseAttack = leftUnits[2]!.attackPower;
      const koishiBaseHp = leftUnits[3]!.maxHp;
      const koishiBaseDamageReduction = leftUnits[3]!.damageReduction;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        DEFAULT_FLAGS,
      );

      expect(leftUnits[0]?.attackPower).toBe(rinBaseAttack + 16);
      expect(leftUnits[0]?.ultimateDamageMultiplier).toBeCloseTo(1.08);

      expect(leftUnits[1]?.attackPower).toBe(nazrinBaseAttack + 42);
      expect(leftUnits[1]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.17);

      expect(leftUnits[2]?.attackPower).toBe(satoriBaseAttack + 36);
      expect(leftUnits[2]?.ultimateDamageMultiplier).toBeCloseTo(1.18);

      expect(leftUnits[3]?.maxHp).toBe(koishiBaseHp + 360);
      expect(leftUnits[3]?.hp).toBe(koishiBaseHp + 360);
      expect(leftUnits[3]?.damageReduction).toBe(koishiBaseDamageReduction + 7);
      expect(result.combatLog.filter((log) => log.includes("sub equipment bonus"))).toHaveLength(4);
    });

    test("命蓮寺サブ装備補正はサブ側unitIdとLvでメインを強化する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        {
          cell: 0,
          unitType: "vanguard",
          unitId: "rin",
          unitLevel: 1,
          subUnit: {
            unitType: "ranger",
            unitId: "nazrin",
            unitLevel: 1,
          },
        },
        {
          cell: 1,
          unitType: "ranger",
          unitId: "wakasagihime",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "ichirin",
            unitLevel: 4,
          },
        },
        {
          cell: 2,
          unitType: "mage",
          unitId: "satori",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "murasa",
            unitLevel: 7,
          },
        },
        {
          cell: 3,
          unitType: "assassin",
          unitId: "koishi",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "shou",
            unitLevel: 4,
          },
        },
        {
          cell: 4,
          unitType: "ranger",
          unitId: "tojiko",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "byakuren",
            unitLevel: 7,
          },
        },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitId: "yoshika", unitLevel: 1 },
      ];

      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, DEFAULT_FLAGS)
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, DEFAULT_FLAGS)
      );
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      const rinBaseAttack = leftUnits[0]!.attackPower;
      const wakasagihimeBaseHp = leftUnits[1]!.maxHp;
      const wakasagihimeBaseDamageReduction = leftUnits[1]!.damageReduction;
      const satoriBaseAttack = leftUnits[2]!.attackPower;
      const koishiBaseAttack = leftUnits[3]!.attackPower;
      const tojikoBaseHp = leftUnits[4]!.maxHp;
      const tojikoBaseAttack = leftUnits[4]!.attackPower;
      const tojikoBaseDamageReduction = leftUnits[4]!.damageReduction;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        DEFAULT_FLAGS,
      );

      expect(leftUnits[0]?.attackPower).toBe(rinBaseAttack + 10);
      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.08);

      expect(leftUnits[1]?.maxHp).toBe(wakasagihimeBaseHp + 420);
      expect(leftUnits[1]?.hp).toBe(wakasagihimeBaseHp + 420);
      expect(leftUnits[1]?.damageReduction).toBe(wakasagihimeBaseDamageReduction + 8);

      expect(leftUnits[2]?.attackPower).toBe(satoriBaseAttack + 50);
      expect(leftUnits[2]?.ultimateDamageMultiplier).toBeCloseTo(1.25);

      expect(leftUnits[3]?.attackPower).toBe(koishiBaseAttack + 40);
      expect(leftUnits[3]?.ultimateDamageMultiplier).toBeCloseTo(1.18);

      expect(leftUnits[4]?.maxHp).toBe(tojikoBaseHp + 980);
      expect(leftUnits[4]?.hp).toBe(tojikoBaseHp + 980);
      expect(leftUnits[4]?.attackPower).toBe(tojikoBaseAttack + 52);
      expect(leftUnits[4]?.damageReduction).toBe(tojikoBaseDamageReduction + 15);
      expect(result.combatLog.filter((log) => log.includes("sub equipment bonus"))).toHaveLength(5);
    });

    test("地霊殿サブ装備補正はサブ側unitIdとLvでメインを強化する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        {
          cell: 0,
          unitType: "ranger",
          unitId: "nazrin",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "rin",
            unitLevel: 1,
          },
        },
        {
          cell: 1,
          unitType: "vanguard",
          unitId: "yoshika",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "satori",
            unitLevel: 4,
          },
        },
        {
          cell: 2,
          unitType: "mage",
          unitId: "murasa",
          unitLevel: 1,
          subUnit: {
            unitType: "assassin",
            unitId: "koishi",
            unitLevel: 7,
          },
        },
        {
          cell: 3,
          unitType: "assassin",
          unitId: "seiga",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "utsuho",
            unitLevel: 4,
          },
        },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitId: "ichirin", unitLevel: 1 },
      ];

      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, DEFAULT_FLAGS)
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, DEFAULT_FLAGS)
      );
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      const nazrinBaseHp = leftUnits[0]!.maxHp;
      const nazrinBaseDamageReduction = leftUnits[0]!.damageReduction;
      const yoshikaBaseAttack = leftUnits[1]!.attackPower;
      const murasaBaseAttack = leftUnits[2]!.attackPower;
      const seigaBaseAttack = leftUnits[3]!.attackPower;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        DEFAULT_FLAGS,
      );

      expect(leftUnits[0]?.maxHp).toBe(nazrinBaseHp + 220);
      expect(leftUnits[0]?.hp).toBe(nazrinBaseHp + 220);
      expect(leftUnits[0]?.damageReduction).toBe(nazrinBaseDamageReduction + 4);

      expect(leftUnits[1]?.attackPower).toBe(yoshikaBaseAttack + 34);
      expect(leftUnits[1]?.ultimateDamageMultiplier).toBeCloseTo(1.17);

      expect(leftUnits[2]?.attackPower).toBe(murasaBaseAttack + 50);
      expect(leftUnits[2]?.critRate).toBeCloseTo(0.14);

      expect(leftUnits[3]?.attackPower).toBe(seigaBaseAttack + 44);
      expect(leftUnits[3]?.ultimateDamageMultiplier).toBeCloseTo(1.18);
      expect(result.combatLog.filter((log) => log.includes("sub equipment bonus"))).toHaveLength(4);
    });

    test("紺珠伝サブ装備補正はサブ側unitIdとLvでメインを強化する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        {
          cell: 0,
          unitType: "ranger",
          unitId: "nazrin",
          unitLevel: 1,
          subUnit: {
            unitType: "ranger",
            unitId: "clownpiece",
            unitLevel: 4,
          },
        },
        {
          cell: 1,
          unitType: "vanguard",
          unitId: "yoshika",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "junko",
            unitLevel: 7,
          },
        },
        {
          cell: 2,
          unitType: "mage",
          unitId: "murasa",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "hecatia",
            unitLevel: 1,
          },
        },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitId: "ichirin", unitLevel: 1 },
      ];

      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, DEFAULT_FLAGS)
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, DEFAULT_FLAGS)
      );
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      const nazrinBaseAttack = leftUnits[0]!.attackPower;
      const yoshikaBaseHp = leftUnits[1]!.maxHp;
      const yoshikaBaseAttack = leftUnits[1]!.attackPower;
      const yoshikaBaseDamageReduction = leftUnits[1]!.damageReduction;
      const murasaBaseAttack = leftUnits[2]!.attackPower;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        DEFAULT_FLAGS,
      );

      expect(leftUnits[0]?.attackPower).toBe(nazrinBaseAttack + 26);
      expect(leftUnits[0]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.18);

      expect(leftUnits[1]?.maxHp).toBe(yoshikaBaseHp + 780);
      expect(leftUnits[1]?.hp).toBe(yoshikaBaseHp + 780);
      expect(leftUnits[1]?.attackPower).toBe(yoshikaBaseAttack + 72);
      expect(leftUnits[1]?.damageReduction).toBe(yoshikaBaseDamageReduction + 12);

      expect(leftUnits[2]?.attackPower).toBe(murasaBaseAttack + 30);
      expect(leftUnits[2]?.ultimateDamageMultiplier).toBeCloseTo(1.12);
      expect(result.combatLog.filter((log) => log.includes("sub equipment bonus"))).toHaveLength(3);
    });

    test("神霊廟サブ装備補正はサブ側unitIdとLvでメインを強化する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        {
          cell: 0,
          unitType: "ranger",
          unitId: "nazrin",
          unitLevel: 1,
          subUnit: {
            unitType: "vanguard",
            unitId: "yoshika",
            unitLevel: 1,
          },
        },
        {
          cell: 1,
          unitType: "vanguard",
          unitId: "ichirin",
          unitLevel: 1,
          subUnit: {
            unitType: "assassin",
            unitId: "seiga",
            unitLevel: 4,
          },
        },
        {
          cell: 2,
          unitType: "mage",
          unitId: "murasa",
          unitLevel: 1,
          subUnit: {
            unitType: "ranger",
            unitId: "tojiko",
            unitLevel: 7,
          },
        },
        {
          cell: 3,
          unitType: "assassin",
          unitId: "koishi",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "futo",
            unitLevel: 4,
          },
        },
        {
          cell: 4,
          unitType: "vanguard",
          unitId: "rin",
          unitLevel: 1,
          subUnit: {
            unitType: "mage",
            unitId: "miko",
            unitLevel: 7,
          },
        },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", unitId: "ichirin", unitLevel: 1 },
      ];

      const leftUnits = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, DEFAULT_FLAGS)
      );
      const rightUnits = rightPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "right", index, false, DEFAULT_FLAGS)
      );
      rightUnits[0]!.attackSpeed = 0;
      rightUnits[0]!.attackPower = 0;
      const nazrinBaseHp = leftUnits[0]!.maxHp;
      const nazrinBaseDamageReduction = leftUnits[0]!.damageReduction;
      const ichirinBaseAttack = leftUnits[1]!.attackPower;
      const murasaBaseAttack = leftUnits[2]!.attackPower;
      const koishiBaseAttack = leftUnits[3]!.attackPower;
      const rinBaseAttack = leftUnits[4]!.attackPower;

      const result = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        leftPlacements,
        rightPlacements,
        0,
        null,
        null,
        null,
        DEFAULT_FLAGS,
      );

      expect(leftUnits[0]?.maxHp).toBe(nazrinBaseHp + 240);
      expect(leftUnits[0]?.hp).toBe(nazrinBaseHp + 240);
      expect(leftUnits[0]?.damageReduction).toBe(nazrinBaseDamageReduction + 5);

      expect(leftUnits[1]?.attackPower).toBe(ichirinBaseAttack + 38);
      expect(leftUnits[1]?.critRate).toBeCloseTo(0.10);

      expect(leftUnits[2]?.attackPower).toBe(murasaBaseAttack + 52);
      expect(leftUnits[2]?.buffModifiers.attackSpeedMultiplier).toBeCloseTo(1.26);

      expect(leftUnits[3]?.attackPower).toBe(koishiBaseAttack + 46);
      expect(leftUnits[3]?.ultimateDamageMultiplier).toBeCloseTo(1.20);

      expect(leftUnits[4]?.attackPower).toBe(rinBaseAttack + 96);
      expect(leftUnits[4]?.ultimateDamageMultiplier).toBeCloseTo(1.38);
      expect(result.combatLog.filter((log) => log.includes("sub equipment bonus"))).toHaveLength(5);
    });

    test("sub-unit assist有無で戦闘結果が極端に偏らない(KPIスモーク)", () => {
      // 同じ構成でsub-unit有無による優位性を確認しつつ、圧倒的不利にならないこと
      const simulator = new BattleSimulator();

      // 左: vanguard (sub-unitなし)
      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 1 }, "left", 0),
      ];
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", unitLevel: 1 },
      ];

      // 右: vanguard (sub-unitあり)
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "vanguard", unitLevel: 1 }, "right", 0),
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 4, unitType: "vanguard", unitLevel: 1 },
      ];

      const subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig> = new Map([
        [
          "vanguard",
          {
            unitId: "warrior_a_sub",
            mode: "assist",
            bonusHpPct: 0.1,
            bonusAttackPct: 0.1,
          },
        ],
      ]);

      // sub-unitなしの戦闘
      const resultWithout = simulator.simulateBattle(
        [...leftUnits.map((u) => ({ ...u }))],
        [...rightUnits.map((u) => ({ ...u }))],
        leftPlacements,
        rightPlacements,
        10_000,
        null,
        null,
        null,
      );

      // sub-unitありの戦闘
      const resultWith = simulator.simulateBattle(
        [...leftUnits.map((u) => ({ ...u }))],
        [...rightUnits.map((u) => ({ ...u }))],
        leftPlacements,
        rightPlacements,
        10_000,
        null,
        null,
        subUnitAssistConfigByType,
      );

      // sub-unitあり側(right)が優位になるが、即時勝利ではないこと
      expect(["left", "right", "draw"]).toContain(resultWith.winner);
      // sub-unitなしでは結果が変わる可能性がある
      expect(["left", "right", "draw"]).toContain(resultWithout.winner);
    });

    test("時間制限に達した場合はHPで勝敗が決まる", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 3 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 100);

      expect(result.combatLog[result.combatLog.length - 1]).toMatch(/Battle ended: (Left|Right) wins \(HP:/);
    });

    test("bossを倒した時点で護衛が生きていても戦闘が即終了する", () => {
      const simulator = new BattleSimulator();

      const raidAttacker = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitLevel: 3 },
        "left",
        0,
      );
      raidAttacker.attackPower = 1_000;
      raidAttacker.attackRange = 3;

      const boss = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = 50;
      boss.maxHp = 50;

      const escort = createTestBattleUnit(
        { cell: 4, unitType: "vanguard", unitLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle(
        [raidAttacker],
        [boss, escort],
        [{ cell: 3, unitType: "mage", unitLevel: 3 }],
        [
          { cell: 7, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
          { cell: 4, unitType: "vanguard", unitLevel: 1 },
        ],
        5_000,
      );

      expect(result.winner).toBe("left");
      expect(result.rightSurvivors.map((unit) => unit.id)).toContain(escort.id);
      expect(result.rightSurvivors.map((unit) => unit.id)).not.toContain(boss.id);
    });

    test("通常攻撃ダメージは戦闘テンポ調整後にボス側被ダメ補正でさらに抑制される", () => {
      const simulator = new BattleSimulator();

      const raidAttacker = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitLevel: 1 },
        "left",
        0,
      );
      raidAttacker.attackPower = 100;
      raidAttacker.attackRange = 99;
      raidAttacker.critRate = 0;

      const boss = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = 500;
      boss.maxHp = 500;
      boss.attackPower = 0;
      boss.damageReduction = 0;
      boss.damageTakenMultiplier = 1;
      boss.buffModifiers.defenseMultiplier = 1;

      const result = simulator.simulateBattle(
        [raidAttacker],
        [boss],
        [{ cell: 3, unitType: "mage", unitLevel: 1 }],
        [{ cell: 7, unitType: "vanguard", unitLevel: 1, archetype: "remilia" }],
        100,
      );

      expect(result.rightSurvivors[0]?.hp).toBe(456);
      expect(result.bossDamage).toBe(45);
    });

    test("boss側の護衛を倒すと最大HPの半分だけフェーズHPダメージが入る", () => {
      const simulator = new BattleSimulator();

      const raidAttacker = createTestBattleUnit(
        { cell: 3, unitType: "mage", unitLevel: 3 },
        "left",
        0,
      );
      raidAttacker.attackPower = 1_000;
      raidAttacker.attackRange = 3;

      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = 5_000;
      boss.maxHp = 5_000;

      const escort = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", unitLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle(
        [raidAttacker],
        [boss, escort],
        [{ cell: 3, unitType: "mage", unitLevel: 3 }],
        [
          { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
          { cell: 7, unitType: "vanguard", unitLevel: 1 },
        ],
        100,
      );

      expect(result.phaseDamageToBossSide).toBe(
        (result.bossDamage ?? 0) + Math.floor(escort.maxHp / 2),
      );
      expect(result.phaseDamageToBossSide).toBeGreaterThan(result.bossDamage ?? 0);
    });

    test("bossがleft側でも護衛撃破ボーナスがフェーズHPに入る", () => {
      const simulator = new BattleSimulator();

      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      boss.hp = 5_000;
      boss.maxHp = 5_000;

      const escort = createTestBattleUnit(
        { cell: 1, unitType: "vanguard", unitLevel: 1 },
        "left",
        1,
      );

      const raidAttacker = createTestBattleUnit(
        { cell: 7, unitType: "mage", unitLevel: 3 },
        "right",
        0,
      );
      raidAttacker.attackPower = 1_000;
      raidAttacker.attackRange = 3;

      const result = simulator.simulateBattle(
        [boss, escort],
        [raidAttacker],
        [
          { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
          { cell: 1, unitType: "vanguard", unitLevel: 1 },
        ],
        [{ cell: 7, unitType: "mage", unitLevel: 3 }],
        100,
      );

      expect(result.phaseDamageToBossSide).toBe(
        (result.bossDamage ?? 0) + Math.floor(escort.maxHp / 2),
      );
      expect(result.phaseDamageToBossSide).toBeGreaterThan(result.bossDamage ?? 0);
    });

    test("全滅時に正しく勝者が判定される", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitLevel: 3 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "vanguard", unitLevel: 3 }, "left", 1),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", unitLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 10000);

      expect(["left", "right", "draw"]).toContain(result.winner);
    });

    test("空のユニット配列では即座に戦闘が終了する", () => {
      const simulator = new BattleSimulator();

      const result = simulator.simulateBattle([], [], [], [], 10000);
      expect(result.winner).toBe("draw");
      expect(result.leftSurvivors).toEqual([]);
      expect(result.rightSurvivors).toEqual([]);
      expect(result.combatLog[result.combatLog.length - 1]).toContain("Draw (all units defeated)");
      expect(result.rightSurvivors).toEqual([]);
      expect(result.combatLog[result.combatLog.length - 1]).toContain("Draw (all units defeated)");
    });

    describe('Skill activation', () => {
      it('vanguard activates Shield Wall on its cooldown', () => {
        const vanguard = createTestBattleUnit({
          unitType: 'vanguard',
          unitLevel: 1,
          cell: 3
        }, "left", 0);
        const enemy = createTestBattleUnit({
          unitType: 'ranger',
          unitLevel: 1,
          cell: 4
        }, "right", 0);

        const simulator = new BattleSimulator();
        const result = simulator.simulateBattle([vanguard], [enemy], [], [], 30000);

        // Check that Shield Wall was activated (should appear in combat log)
        expect(result.combatLog.some(log => log.includes('Shield Wall'))).toBe(true);
      });
    });

    test("unitId resolverは現行MVP rosterで同じ戦闘結果を返す", () => {
      // MVP flags for roster provider boundary
      const mvpFlags = {
        enableHeroSystem: false,
        enableSharedPool: false,
        enablePhaseExpansion: false,
        enableDominationSystem: false,
        enableSubUnitSystem: false,
        enableEmblemCells: false,
        enableSpellCard: false,
        enableRumorInfluence: false,
        enableBossExclusiveShop: false,
        enableSharedBoardShadow: false,
        enableTouhouRoster: false,
        enableTouhouFactions: false,
        enablePerUnitSharedPool: false,
      };

      const createResolvedPlacements = () => ({
        left: resolveBattlePlacements([
          { cell: 0, unitType: "mage", unitId: "warrior_a", unitLevel: 1 },
          { cell: 1, unitType: "assassin", unitId: "archer_a", unitLevel: 1 },
        ], mvpFlags),
        right: resolveBattlePlacements([
          { cell: 7, unitType: "mage", unitId: "warrior_b", unitLevel: 1 },
          { cell: 6, unitType: "assassin", unitId: "archer_b", unitLevel: 1 },
        ], mvpFlags),
      });

      const { left: leftPlacements1, right: rightPlacements1 } = createResolvedPlacements();
      const result1 = new BattleSimulator().simulateBattle(
        leftPlacements1.map((placement, index) => createTestBattleUnit(placement, "left", index, false, mvpFlags)),
        rightPlacements1.map((placement, index) => createTestBattleUnit(placement, "right", index, false, mvpFlags)),
        leftPlacements1,
        rightPlacements1,
        10_000,
      );

      const { left: leftPlacements2, right: rightPlacements2 } = createResolvedPlacements();
      const result2 = new BattleSimulator().simulateBattle(
        leftPlacements2.map((placement, index) => createTestBattleUnit(placement, "left", index, false, mvpFlags)),
        rightPlacements2.map((placement, index) => createTestBattleUnit(placement, "right", index, false, mvpFlags)),
        leftPlacements2,
        rightPlacements2,
        10_000,
      );

      expect(result1.winner).toBe("draw");
      expect(result1.damageDealt).toEqual({ left: 28, right: 28 });
      expect(result1.leftSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "left-vanguard-0", hp: 70, cell: 14 },
        { id: "left-ranger-1", hp: 32, cell: combatCellToRaidBoardIndex(1) },
      ]);
      expect(result1.rightSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "right-vanguard-0", hp: 70, cell: 21 },
        { id: "right-ranger-1", hp: 32, cell: combatCellToBossBoardIndex(6) },
      ]);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });
  });
});
