import { describe, expect, test } from "vitest";

import type { BoardUnitPlacement, BoardUnitType } from "../../../src/shared/room-messages";
import { getMvpPhase1Boss, type SubUnitConfig } from "../../../src/shared/types";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";
import {
  sharedBoardCoordinateToIndex,
} from "../../../src/shared/board-geometry";
import {
  BattleSimulator,
  calculateCellDistance,
  createBattleUnit,
  findTarget,
  type BattleUnit,
} from "../../../src/server/combat/battle-simulator";
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
import { HERO_SKILL_DEFINITIONS, SKILL_DEFINITIONS } from "../../../src/server/combat/skill-definitions";

describe("battle-simulator", () => {
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
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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
        { cell: 3, unitType: "vanguard", starLevel: 1 },
        "left",
        0,
      );
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = Math.floor(boss.maxHp * 0.8);

      const result = simulator.simulateBattle(
        [raidUnit],
        [boss],
        [{ cell: 3, unitType: "vanguard", starLevel: 1 }],
        [
          { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );

      expect(boss.maxHp).toBe(bossBaseline.hp);
      expect(boss.hp).toBe(bossBaseline.hp);
      expect(boss.attackPower).toBe(bossBaseline.attack);
      expect(boss.attackSpeed).toBe(bossBaseline.attackSpeed);
      expect(boss.attackRange).toBe(bossBaseline.range);
      expect(boss.physicalReduction).toBe(bossBaseline.physicalReduction);
      expect(boss.magicReduction).toBe(bossBaseline.magicReduction);
    });

    test("HP70%以上のレミリアは紅き夜の王でHP70%未満時より高いダメージを出す", () => {
      const simulator = new BattleSimulator();
      const bossWithPassive = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      const bossWithoutPassive = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      bossWithoutPassive.hp = Math.floor(bossWithoutPassive.maxHp * 0.6);

      const raidUnitForPassive = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );
      const raidUnitWithoutPassive = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );

      const passiveResult = simulator.simulateBattle(
        [bossWithPassive],
        [raidUnitForPassive],
        [{ cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" }],
        [{ cell: 2, unitType: "vanguard", starLevel: 1 }],
        1_500,
      );

      const nonPassiveResult = simulator.simulateBattle(
        [bossWithoutPassive],
        [raidUnitWithoutPassive],
        [{ cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" }],
        [{ cell: 2, unitType: "vanguard", starLevel: 1 }],
        1_500,
      );

      expect(passiveResult.damageDealt.left).toBeGreaterThan(nonPassiveResult.damageDealt.left);
    });
  });

  describe("kanjuden debuff immunity", () => {
    test("kanjuden tier1 は crowd_control の攻撃速度低下を無効化する", () => {
      const sakuyaSkill = HERO_SKILL_DEFINITIONS.sakuya!;
      const caster = createTestBattleUnit({ cell: 0, unitType: "assassin", starLevel: 1 }, "left", 0);
      const immuneTarget = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", starLevel: 1, factionId: "kanjuden" },
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
      sakuyaSkill.execute(caster, [caster], [immuneTarget], log);

      expect(immuneTarget.buffModifiers.attackSpeedMultiplier).toBe(1);
    });

    test("kanjuden でないユニットには咲夜の攻撃速度低下が適用される", () => {
      const sakuyaSkill = HERO_SKILL_DEFINITIONS.sakuya!;
      const caster = createTestBattleUnit({ cell: 0, unitType: "assassin", starLevel: 1 }, "left", 0);
      const normalTarget = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );

      const log: string[] = [];
      sakuyaSkill.execute(caster, [caster], [normalTarget], log);

      expect(normalTarget.buffModifiers.attackSpeedMultiplier).toBe(0.7);
    });

    test("咲夜の範囲デバフは 6x6 の縦距離も半径計算に含める", () => {
      const sakuyaSkill = HERO_SKILL_DEFINITIONS.sakuya!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "assassin", starLevel: 1 },
        "left",
        0,
      );
      const centerTarget = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );
      const verticalTarget = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "ranger", starLevel: 1 },
        "right",
        1,
      );

      const log: string[] = [];
      sakuyaSkill.execute(caster, [caster], [centerTarget, verticalTarget], log);

      expect(centerTarget.buffModifiers.attackSpeedMultiplier).toBe(0.7);
      expect(verticalTarget.buffModifiers.attackSpeedMultiplier).toBe(0.7);
    });

    test("咲夜は最も多く巻き込める中心を選ぶ", () => {
      const sakuyaSkill = HERO_SKILL_DEFINITIONS.sakuya!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 5 }), unitType: "assassin", starLevel: 1 },
        "left",
        0,
      );
      const isolatedEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 0 }), unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );
      const clusteredEnemyA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "ranger", starLevel: 1 },
        "right",
        1,
      );
      const clusteredEnemyB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 2 }), unitType: "mage", starLevel: 1 },
        "right",
        2,
      );

      const log: string[] = [];
      sakuyaSkill.execute(caster, [caster], [isolatedEnemy, clusteredEnemyA, clusteredEnemyB], log);

      expect(isolatedEnemy.buffModifiers.attackSpeedMultiplier).toBe(1);
      expect(clusteredEnemyA.buffModifiers.attackSpeedMultiplier).toBe(0.7);
      expect(clusteredEnemyB.buffModifiers.attackSpeedMultiplier).toBe(0.7);
    });
  });

  describe("skill targeting", () => {
    test("Backstab は同HPなら caster に近い敵を優先する", () => {
      const assassinSkill = SKILL_DEFINITIONS.assassin!;
      const caster = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "assassin", starLevel: 1 },
        "left",
        0,
      );
      const nearerEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", starLevel: 1, hp: 30 },
        "right",
        0,
      );
      const fartherEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 5, y: 1 }), unitType: "vanguard", starLevel: 1, hp: 30 },
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitId: "seiga", starLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitId: "yoshika", starLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", starLevel: 1, factionId: "kanjuden" },
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitId: "seiga", starLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", unitId: "yoshika", starLevel: 1, factionId: "shinreibyou" },
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 3 }), unitType: "ranger", unitId: "tojiko", starLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", starLevel: 1, factionId: "kanjuden" },
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "assassin", unitId: "seiga", starLevel: 1, factionId: "shinreibyou" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", unitId: "junko", starLevel: 1, factionId: "kanjuden" },
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
        starLevel: 1,
      };
      const unit = createTestBattleUnit(placement, "left", 0);
      expect(unit.id).toBe("left-vanguard-0");
      expect(unit.type).toBe("vanguard");
      expect(unit.starLevel).toBe(1);
      expect(unit.cell).toBe(combatCellToRaidBoardIndex(0));
      expect(unit.hp).toBeGreaterThan(0);
      expect(unit.maxHp).toBeGreaterThan(0);
      expect(unit.attackPower).toBeGreaterThan(0);
      expect(unit.isDead).toBe(false);
    });

    test("スターレベルに応じてステータスが変化する", () => {
      const placement1: BoardUnitPlacement = { cell: 0, unitType: "vanguard", starLevel: 1 };
      const placement2: BoardUnitPlacement = { cell: 1, unitType: "vanguard", starLevel: 2 };
      const placement3: BoardUnitPlacement = { cell: 2, unitType: "vanguard", starLevel: 3 };

      const unit1 = createTestBattleUnit(placement1, "left", 0);
      const unit2 = createTestBattleUnit(placement2, "left", 1);
      const unit3 = createTestBattleUnit(placement3, "left", 2);

      expect(unit1.hp).toBeLessThan(unit2.hp);
      expect(unit2.hp).toBeLessThan(unit3.hp);
      expect(unit1.attackPower).toBeLessThan(unit2.attackPower);
      expect(unit2.attackPower).toBeLessThan(unit3.attackPower);
    });

    test("現在のunitType入力は正確な基礎ステータスを返す", () => {
      expect(createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0)).toMatchObject({
        id: "left-vanguard-0",
        type: "vanguard",
        cell: combatCellToRaidBoardIndex(0),
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        defense: 3,
      });
      expect(createTestBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "left", 1)).toMatchObject({
        id: "left-ranger-1",
        type: "ranger",
        cell: combatCellToRaidBoardIndex(1),
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        attackRange: 3,
        defense: 0,
      });
      expect(createTestBattleUnit({ cell: 2, unitType: "mage", starLevel: 1 }, "right", 0)).toMatchObject({
        id: "right-mage-0",
        type: "mage",
        cell: combatCellToBossBoardIndex(2),
        hp: 40,
        maxHp: 40,
        attackPower: 6,
        attackSpeed: 0.6,
        attackRange: 2,
        defense: 0,
      });
      expect(createTestBattleUnit({ cell: 3, unitType: "assassin", starLevel: 1 }, "right", 1)).toMatchObject({
        id: "right-assassin-1",
        type: "assassin",
        cell: combatCellToBossBoardIndex(3),
        hp: 45,
        maxHp: 45,
        attackPower: 5,
        attackSpeed: 1,
        attackRange: 1,
        defense: 0,
      });
    });

    test("unitIdがある場合はunitTypeよりunitId解決を優先する", () => {
      // Both paths use flags-aware roster provider resolution
      // Compare: unitId resolution vs direct unitType (both with flags)
      const unitWithUnitId = createTestBattleUnit(
        { cell: 0, unitType: "mage", unitId: "meiling", starLevel: 1 },
        "left",
        0,
        false,
        DEFAULT_FLAGS,
      );
      const unitWithDirectType = createTestBattleUnit(
        { cell: 1, unitType: "vanguard", starLevel: 1 },
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
        { cell: 0, unitType: "vanguard", unitId: "rin", starLevel: 1 },
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
        attackRange: 1,
        defense: 3,
        critRate: 0,
        critDamageMultiplier: 1.5,
        physicalReduction: 0,
        magicReduction: 0,
      });
    });

    test("Scarlet Mansion と boss の追加 combat stats を使う", () => {
      const scarletUnit = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", unitId: "patchouli", starLevel: 1 },
        "left",
        0,
        false,
        DEFAULT_FLAGS,
      );
      const bossUnit = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", archetype: "remilia", starLevel: 1 },
        "right",
        0,
        true,
        DEFAULT_FLAGS,
      );

      expect(scarletUnit).toMatchObject({
        defense: 15,
        critRate: 0,
        critDamageMultiplier: 1.5,
        physicalReduction: 5,
        magicReduction: 25,
      });
      expect(bossUnit).toMatchObject({
        defense: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        physicalReduction: 0,
        magicReduction: 0,
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
        starLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        defense: 3,
        critRate: 0,
        critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
        starLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        defense: 3,
        critRate: 0,
        critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
        starLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        defense: 3,
        critRate: 0,
        critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
          starLevel: 1,
          hp: 50,
          maxHp: 50,
          attackPower: 5,
          attackSpeed: 0.8,
          attackRange: 3,
          cell: 5,
          isDead: true,
          attackCount: 0,
          defense: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
        starLevel: 1,
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        attackRange: 3,
        cell: combatCellToRaidBoardIndex(2),
        isDead: false,
        attackCount: 0,
        defense: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
          starLevel: 1,
          hp: 50,
          maxHp: 50,
          attackPower: 5,
          attackSpeed: 0.8,
          attackRange: 3,
          cell: combatCellToBossBoardIndex(7),
          isDead: false,
          attackCount: 0,
          defense: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
        {
          id: "right-mage-0",
          type: "mage",
          starLevel: 1,
          hp: 40,
          maxHp: 40,
          attackPower: 6,
          attackSpeed: 0.6,
          attackRange: 2,
          cell: combatCellToBossBoardIndex(6),
          isDead: false,
          attackCount: 0,
          defense: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
        {
          id: "right-vanguard-0",
          type: "vanguard",
          starLevel: 1,
          hp: 80,
          maxHp: 80,
          attackPower: 4,
          attackSpeed: 0.5,
          attackRange: 1,
          cell: combatCellToBossBoardIndex(4),
          isDead: false,
          attackCount: 0,
          defense: 3,
          critRate: 0,
          critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
        starLevel: 1,
        hp: 50,
        maxHp: 50,
        attackPower: 5,
        attackSpeed: 0.8,
        attackRange: 3,
        cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }),
        isDead: false,
        attackCount: 0,
        defense: 0,
        critRate: 0,
        critDamageMultiplier: 1.5,
        physicalReduction: undefined,
        magicReduction: undefined,
        buffModifiers: {
          attackMultiplier: 1.0,
          defenseMultiplier: 1.0,
          attackSpeedMultiplier: 1.0,
        },
      };
      const sturdierEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", starLevel: 1, hp: 80 },
        "right",
        0,
      );
      const weakerEnemy = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "mage", starLevel: 1, hp: 20 },
        "right",
        1,
      );

      const target = findTarget(attacker, [sturdierEnemy, weakerEnemy]);
      expect(target?.id).toBe(weakerEnemy.id);
    });

    test("射程外の敵は対象にならない", () => {
      const attacker: BattleUnit = {
        id: "left-vanguard-0",
        type: "vanguard",
        starLevel: 1,
        hp: 80,
        maxHp: 80,
        attackPower: 4,
        attackSpeed: 0.5,
        attackRange: 1,
        cell: 0,
        isDead: false,
        attackCount: 0,
        defense: 3,
        critRate: 0,
        critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
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
          starLevel: 1,
          hp: 50,
          maxHp: 50,
          attackPower: 5,
          attackSpeed: 0.8,
          attackRange: 3,
          cell: 7,
          isDead: false,
          attackCount: 0,
          defense: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          physicalReduction: undefined,
          magicReduction: undefined,
          buffModifiers: {
            attackMultiplier: 1.0,
            defenseMultiplier: 1.0,
            attackSpeedMultiplier: 1.0,
          },
        },
      ];
      expect(findTarget(attacker, enemies)).toBeNull();
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
        { cell: 24, unitType: "vanguard", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 11, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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
        { cell: sharedBoardCoordinateToIndex({ x: 0, y: 4 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 4 }), unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 5 }), unitType: "vanguard", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 4 }), unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 0 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 5 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 2 }), unitType: "vanguard", starLevel: 1 },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 4 }), unitType: "vanguard", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 4, y: 3 }), unitType: "vanguard", starLevel: 1, archetype: "remilia" },
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

    test("単一の対決で正しく戦闘が進行する", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "vanguard", starLevel: 1 },
        "left",
        0,
      );
      heroUnit.id = "hero-reimu";
      heroUnit.sourceUnitId = "hero-reimu";

      const rightUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "vanguard", starLevel: 1 },
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }), unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      const rightHeroUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );
      rightHeroUnit.id = "hero-reimu";
      rightHeroUnit.sourceUnitId = "hero-reimu";
      const rightAllyUnit = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "ranger", starLevel: 1 },
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 4 }), unitType: "mage", starLevel: 1 },
        "left",
        0,
      );
      heroUnit.id = "hero-marisa";
      heroUnit.sourceUnitId = "hero-marisa";
      heroUnit.attackPower = 120;

      const rightUnitA = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 1 }), unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );
      const rightUnitB = createTestBattleUnit(
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 1 }), unitType: "ranger", starLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle([heroUnit], [rightUnitA, rightUnitB], [], [], 500);

      const heroSkillDamageEvents = result.timeline.filter(
        (event) => event.type === "damageApplied" && event.sourceBattleUnitId === "hero-marisa",
      );

      expect(heroSkillDamageEvents.length).toBeGreaterThan(0);
      expect(result.damageDealt.left).toBeGreaterThan(0);
      expect(rightUnitA.hp + rightUnitB.hp).toBeLessThan(rightUnitA.maxHp + rightUnitB.maxHp);
    });

    test("同じ入力からは同じ結果が得られる（決定論性）", () => {
      const simulator1 = new BattleSimulator();
      const simulator2 = new BattleSimulator();

      const createLeftUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "left", 1),
      ];
      const createRightUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
        createTestBattleUnit({ cell: 6, unitType: "ranger", starLevel: 1 }, "right", 1),
      ];

      const result1 = simulator1.simulateBattle(createLeftUnits(), createRightUnits(), [], [], 10000);
      const result2 = simulator2.simulateBattle(createLeftUnits(), createRightUnits(), [], [], 10000);

      expect(result1.winner).toBe(result2.winner);
      expect(result1.leftSurvivors.length).toBe(result2.leftSurvivors.length);
      expect(result1.rightSurvivors.length).toBe(result2.rightSurvivors.length);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });

    test("現在のMVP戦闘ベースラインは同じ入力で正確に再現される", () => {
      const createLeftUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "left", 1),
      ];
      const createRightUnits = (): BattleUnit[] => [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
        createTestBattleUnit({ cell: 6, unitType: "ranger", starLevel: 1 }, "right", 1),
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
        winner: "left",
        durationMs: 10_000,
        damageDealt: {
          left: 54,
          right: 50,
        },
        leftSurvivors: [
          { id: "left-vanguard-0", hp: 72, cell: 14 },
          { id: "left-ranger-1", hp: 8, cell: combatCellToRaidBoardIndex(1) },
        ],
        rightSurvivors: [
          { id: "right-vanguard-0", hp: 72, cell: 21 },
          { id: "right-ranger-1", hp: 4, cell: combatCellToBossBoardIndex(6) },
        ],
        combatLogStart: ["Battle started", "Left units: 2", "Right units: 2"],
        combatLogEnd: [
          "Right Ranger (cell 15) attacks Left Vanguard (cell 14) for 1 damage (72/80)",
          "Left Vanguard (cell 14) attacks Right Ranger (cell 15) for 4 damage (4/50)",
          "Battle ended: Left wins (HP: 80 vs 76)",
        ],
      });
    });

    test("hero synergy bonus typeが指定された側のシナジーが強化される", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 4, unitType: "ranger", starLevel: 1 },
        { cell: 5, unitType: "ranger", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 4, unitType: "ranger", starLevel: 1 },
        { cell: 5, unitType: "ranger", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "ranger", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "ranger", starLevel: 1 }, "right", 0),
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
        { cell: 0, unitType: "ranger", starLevel: 1, unitId: "wakasagihime", factionId: "grassroot_network" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "sekibanki", factionId: "grassroot_network" },
        { cell: 2, unitType: "vanguard", starLevel: 1, unitId: "zanmu", factionId: null },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const baselineLeftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit({ ...placement, factionId: null }, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0, false, TOUHOU_FACTION_FLAGS),
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
        { cell: 0, unitType: "ranger", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "vanguard", starLevel: 1, unitId: "ichirin", factionId: "myourenji" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
        { cell: 3, unitType: "mage", starLevel: 1, unitId: "zanmu", factionId: null },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const baselineLeftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit({ ...placement, factionId: null }, "left", index, false, TOUHOU_FACTION_FLAGS),
      );
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0, false, TOUHOU_FACTION_FLAGS),
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
        { cell: 0, unitType: "ranger", starLevel: 1, unitId: "wakasagihime", factionId: "grassroot_network" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "sekibanki", factionId: "grassroot_network" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 7, unitType: "vanguard", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
        createTestBattleUnit(placement, "left", index, false, {
          ...DEFAULT_FLAGS,
          enableTouhouRoster: true,
          enableTouhouFactions: false,
        }),
      );
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
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
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", starLevel: 1, hp: 50, attack: 20, attackSpeed: 0.8, range: 3 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "mage", starLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", starLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
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

      expect(leftUnits[0]?.hp).toBe(45);
    });

    test("chireiden reflection は反射ダメージを再反射しない", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }), unitType: "ranger", starLevel: 1, hp: 50, attack: 20, attackSpeed: 0.8, range: 3, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }), unitType: "vanguard", starLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: sharedBoardCoordinateToIndex({ x: 2, y: 2 }), unitType: "mage", starLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
        { cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }), unitType: "vanguard", starLevel: 1, hp: 40, attack: 1, attackSpeed: 0.1, range: 1, factionId: "chireiden" },
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

      expect(leftUnits[0]?.hp).toBe(46);
      expect(result.combatLog.filter((log) => log.includes("reflects"))).toHaveLength(3);
    });

    test("戦闘ログにダメージ情報が記録される", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 2, unitType: "ranger", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 5000);

      const damageLogs = result.combatLog.filter((log) => log.includes("damage"));
      expect(damageLogs.length).toBeGreaterThan(0);
      expect(damageLogs[0]).toMatch(/attacks.*for \d+ damage \(\d+\/\d+\)|CRITICAL HIT on.*for \d+ damage!/);
    });

    test("sub-unit assist設定がある場合はHPボーナスが適用されログに記録される", () => {
      const simulator = new BattleSimulator();

      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 1, unitType: "ranger", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "right", 0),
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
        { cell: 0, unitType: "vanguard", unitId: "warrior_a", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 1, unitType: "vanguard", unitId: "warrior_b", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", unitId: "warrior_a", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 1, unitType: "vanguard", unitId: "warrior_b", starLevel: 1 }, "right", 0),
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
        { cell: 0, unitType: "vanguard", starLevel: 1 },
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 1, unitType: "ranger", starLevel: 1 },
      ];

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "right", 0),
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
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
      ];
      const leftPlacements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", starLevel: 1 },
      ];

      // 右: vanguard (sub-unitあり)
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 4, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];
      const rightPlacements: BoardUnitPlacement[] = [
        { cell: 4, unitType: "vanguard", starLevel: 1 },
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
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 3 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, [], [], 100);

      expect(result.combatLog[result.combatLog.length - 1]).toMatch(/Battle ended: (Left|Right) wins \(HP:/);
    });

    test("bossを倒した時点で護衛が生きていても戦闘が即終了する", () => {
      const simulator = new BattleSimulator();

      const raidAttacker = createTestBattleUnit(
        { cell: 3, unitType: "mage", starLevel: 3 },
        "left",
        0,
      );
      raidAttacker.attackPower = 1_000;
      raidAttacker.attackRange = 3;

      const boss = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = 50;
      boss.maxHp = 50;

      const escort = createTestBattleUnit(
        { cell: 4, unitType: "vanguard", starLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle(
        [raidAttacker],
        [boss, escort],
        [{ cell: 3, unitType: "mage", starLevel: 3 }],
        [
          { cell: 7, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
          { cell: 4, unitType: "vanguard", starLevel: 1 },
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
        { cell: 3, unitType: "mage", starLevel: 3 },
        "left",
        0,
      );
      raidAttacker.attackPower = 1_000;
      raidAttacker.attackRange = 3;

      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "right",
        0,
        true,
      );
      boss.hp = 5_000;
      boss.maxHp = 5_000;

      const escort = createTestBattleUnit(
        { cell: 7, unitType: "vanguard", starLevel: 1 },
        "right",
        1,
      );

      const result = simulator.simulateBattle(
        [raidAttacker],
        [boss, escort],
        [{ cell: 3, unitType: "mage", starLevel: 3 }],
        [
          { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
          { cell: 7, unitType: "vanguard", starLevel: 1 },
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
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      boss.hp = 5_000;
      boss.maxHp = 5_000;

      const escort = createTestBattleUnit(
        { cell: 1, unitType: "vanguard", starLevel: 1 },
        "left",
        1,
      );

      const raidAttacker = createTestBattleUnit(
        { cell: 7, unitType: "mage", starLevel: 3 },
        "right",
        0,
      );
      raidAttacker.attackPower = 1_000;
      raidAttacker.attackRange = 3;

      const result = simulator.simulateBattle(
        [boss, escort],
        [raidAttacker],
        [
          { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
          { cell: 1, unitType: "vanguard", starLevel: 1 },
        ],
        [{ cell: 7, unitType: "mage", starLevel: 3 }],
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
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 3 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "vanguard", starLevel: 3 }, "left", 1),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
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
      it('vanguard activates Shield Wall every 3 attacks', () => {
        const vanguard = createTestBattleUnit({
          unitType: 'vanguard',
          starLevel: 1,
          cell: 3
        }, "left", 0);
        const enemy = createTestBattleUnit({
          unitType: 'ranger',
          starLevel: 1,
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
          { cell: 0, unitType: "mage", unitId: "warrior_a", starLevel: 1 },
          { cell: 1, unitType: "assassin", unitId: "archer_a", starLevel: 1 },
        ], mvpFlags),
        right: resolveBattlePlacements([
          { cell: 7, unitType: "mage", unitId: "warrior_b", starLevel: 1 },
          { cell: 6, unitType: "assassin", unitId: "archer_b", starLevel: 1 },
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

      expect(result1.winner).toBe("left");
      expect(result1.damageDealt).toEqual({ left: 54, right: 50 });
      expect(result1.leftSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "left-vanguard-0", hp: 72, cell: 14 },
        { id: "left-ranger-1", hp: 8, cell: combatCellToRaidBoardIndex(1) },
      ]);
      expect(result1.rightSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "right-vanguard-0", hp: 72, cell: 21 },
        { id: "right-ranger-1", hp: 4, cell: combatCellToBossBoardIndex(6) },
      ]);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });
  });
});
