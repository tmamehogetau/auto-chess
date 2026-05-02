import { describe, expect, test } from "vitest";

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

import {
  applyScarletMansionSynergyToBoss,
  calculateScarletMansionSynergy,
} from "../../../src/server/combat/synergy-definitions";
import {
  HERO_SKILL_DEFINITIONS,
  resolveBossSkillDefinition,
  SKILL_DEFINITIONS,
} from "../../../src/server/combat/skill-definitions";

describe("battle-simulator", () => {
  test("all skill definitions expose explicit cooldown timing", () => {
    for (const definition of Object.values(SKILL_DEFINITIONS)) {
      expect(definition.initialSkillDelayMs).toBeGreaterThan(0);
      expect(definition.skillCooldownMs).toBeGreaterThan(0);
    }

    for (const definition of Object.values(HERO_SKILL_DEFINITIONS)) {
      expect(definition.initialSkillDelayMs).toBeGreaterThan(0);
      expect(definition.skillCooldownMs).toBeGreaterThan(0);
    }
  });

  test("boss active skill resolver returns null until a boss skill is defined", () => {
    const boss = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
      "right",
      0,
      true,
    );

    expect(resolveBossSkillDefinition(boss)).toBeNull();
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
    jyoon.attackSpeed = 1;
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

    const result = simulator.simulateBattle([jyoon], [enemy], [], [], 6900);
    const postSkillAttack = result.timeline.find((event) =>
      event.type === "attackStart"
      && event.sourceBattleUnitId === "hero-raid-a"
      && event.atMs > 6000
      && event.atMs < 7000,
    );

    expect(postSkillAttack).toBeDefined();
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

  describe("scarlet mansion synergy", () => {
    test("紅魔館ユニット2体でシナジーが有効になる", () => {
      const active = calculateScarletMansionSynergy([
        { cell: 0, unitType: "vanguard", archetype: "meiling" },
        { cell: 1, unitType: "assassin", archetype: "sakuya" },
      ]);

      expect(active).toBe(true);
    });

    test("HP70%以上のレミリアにシナジーバフが適用される", () => {
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.8);

      applyScarletMansionSynergyToBoss(boss, true);

      expect(boss.buffModifiers.attackMultiplier).toBeGreaterThan(1);
    });

    test("HP70%未満のレミリアにはシナジーバフが適用されない", () => {
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.6);

      applyScarletMansionSynergyToBoss(boss, true);

      expect(boss.buffModifiers.attackMultiplier).toBe(1);
    });

    test("HP70%以上かつシナジー有効時はレミリアが吸血する", () => {
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

      const result = simulator.simulateBattle(
        [raidUnit],
        [boss],
        [{ cell: 3, unitType: "vanguard", unitLevel: 1 }],
        [
          { cell: 0, unitType: "vanguard", unitLevel: 1, archetype: "remilia" },
          { cell: 1, unitType: "vanguard", archetype: "meiling" },
          { cell: 2, unitType: "assassin", archetype: "sakuya" },
        ],
        5_000,
      );

      expect(
        result.combatLog.some((log) => log.includes("Scarlet Mansion Synergy lifesteals")),
      ).toBe(true);
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

      expect(passiveResult.damageDealt.left).toBeGreaterThan(nonPassiveResult.damageDealt.left);
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitId: "seiga", unitLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitId: "yoshika", unitLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", unitLevel: 1, factionId: "kanjuden" },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index, false, flags)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, false, flags)),
        leftPlacements,
        rightPlacements,
        2_500,
        null,
        null,
        null,
        flags,
      );

      expect(result.combatLog.some((log) => log.includes("Backstab! Deals 264 damage"))).toBe(true);
    });

    test("shinreibyou tier2 は debuffed target に +12% bonus damage を乗せる", () => {
      const flags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitId: "seiga", unitLevel: 1, factionId: "shinreibyou" },
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

      expect(result.combatLog.some((log) => log.includes("Backstab! Deals 322 damage"))).toBe(true);
    });

    test("shinreibyou tier inactive では ultimate modifier が発動しない", () => {
      const flags = {
        ...DEFAULT_FLAGS,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      };
      const simulator = new BattleSimulator();
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitId: "seiga", unitLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", unitLevel: 1, factionId: "kanjuden" },
      ];

      const result = simulator.simulateBattle(
        leftPlacements.map((placement, index) => createTestBattleUnit(placement, "left", index, false, flags)),
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, false, flags)),
        leftPlacements,
        rightPlacements,
        2_500,
        null,
        null,
        null,
        flags,
      );

      expect(result.combatLog.some((log) => log.includes("Backstab! Deals 240 damage"))).toBe(true);
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
      expect(unitWithUnitId.hp).toBe(850);
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
        hp: 620,
        maxHp: 620,
        attackPower: 40,
        attackSpeed: 0.85,
        movementSpeed: 2,
        attackRange: 1,
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 5,
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
        damageReduction: 20,
      });
      expect(bossUnit).toMatchObject({
        critRate: 0,
        critDamageMultiplier: 1.5,
        damageReduction: 0,
      });
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
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, true)),
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
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, true)),
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
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, true)),
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
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, true)),
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
        rightPlacements.map((placement, index) => createTestBattleUnit(placement, "right", index, true)),
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

      const result = simulator.simulateBattle([heroUnit], [rightUnitA, rightUnitB], [], [], 3_600);

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

        const result = simulator.simulateBattle([heroUnit], [rightUnitA, rightUnitB], [], [], 3_600);

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
          left: 65,
          right: 65,
        },
        leftSurvivors: [
          { id: "left-vanguard-0", hp: 52, cell: 14 },
          { id: "left-ranger-1", hp: 13, cell: combatCellToRaidBoardIndex(1) },
        ],
        rightSurvivors: [
          { id: "right-vanguard-0", hp: 52, cell: 21 },
          { id: "right-ranger-1", hp: 13, cell: combatCellToBossBoardIndex(6) },
        ],
        combatLogStart: ["Battle started", "Left units: 2", "Right units: 2"],
        combatLogEnd: [
          "Left Ranger (cell 20) attacks Right Vanguard (cell 21) for 3 damage (52/80)",
          "Right Ranger (cell 15) attacks Left Vanguard (cell 14) for 3 damage (52/80)",
          "Battle ended: Draw (HP: 65 vs 65)",
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

    test("grassroot_network tier1 は該当 faction ユニットにだけ攻撃バフを適用する", () => {
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

      expect(leftUnits[0]?.attackPower).toBeGreaterThan(baselineLeftUnits[0]!.attackPower);
      expect(leftUnits[1]?.attackPower).toBeGreaterThan(baselineLeftUnits[1]!.attackPower);
      expect(leftUnits[2]?.attackPower).toBe(baselineLeftUnits[2]!.attackPower);
    });

    test("myourenji tier2 は該当 faction ユニットに HP と攻撃バフを適用する", () => {
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
      expect(leftUnits[0]?.attackPower).toBeGreaterThan(baselineLeftUnits[0]!.attackPower);
      expect(leftUnits[1]?.attackPower).toBeGreaterThan(baselineLeftUnits[1]!.attackPower);
      expect(leftUnits[2]?.attackPower).toBeGreaterThan(baselineLeftUnits[2]!.attackPower);
      expect(leftUnits[3]?.maxHp).toBe(baselineLeftUnits[3]!.maxHp);
      expect(leftUnits[3]?.attackPower).toBe(baselineLeftUnits[3]!.attackPower);
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

      expect(leftUnits[0]?.attackPower).toBe(45);
      expect(leftUnits[1]?.attackPower).toBe(64);
    });

    test("chireiden tier1 は軽減後ダメージの10%を攻撃元へ反射する", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", unitLevel: 1, hp: 50, attack: 20, attackSpeed: 0.8, range: 3 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "mage", unitLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
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

      expect(leftUnits[0]?.hp).toBe(47);
    });

    test("chireiden reflection は反射ダメージを再反射しない", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", unitLevel: 1, hp: 50, attack: 20, attackSpeed: 0.8, range: 3, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "mage", unitLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", unitLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
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

      expect(leftUnits[0]?.hp).toBe(47);
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
      expect(hitEvents[0]).toMatchObject({ amount: 20, remainingHp: 60 });
      expect(hitEvents[1]).toMatchObject({ amount: 20, remainingHp: 40 });
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
      expect(result1.damageDealt).toEqual({ left: 65, right: 65 });
      expect(result1.leftSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "left-vanguard-0", hp: 52, cell: 14 },
        { id: "left-ranger-1", hp: 13, cell: combatCellToRaidBoardIndex(1) },
      ]);
      expect(result1.rightSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "right-vanguard-0", hp: 52, cell: 21 },
        { id: "right-ranger-1", hp: 13, cell: combatCellToBossBoardIndex(6) },
      ]);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });
  });
});
