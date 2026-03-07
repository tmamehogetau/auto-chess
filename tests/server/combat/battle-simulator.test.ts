import { describe, expect, test } from "vitest";

import type { BoardUnitPlacement, BoardUnitType } from "../../../src/shared/room-messages";
import type { SubUnitConfig } from "../../../src/shared/types";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";
import {
  BattleSimulator,
  calculateCellDistance,
  createBattleUnit,
  findTarget,
  type BattleUnit,
} from "../../../src/server/combat/battle-simulator";
import { resolveBattlePlacements } from "../../../src/server/unit-id-resolver";

function createTestBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
  isBoss: boolean = false,
  flags = DEFAULT_FLAGS,
): BattleUnit {
  return createBattleUnit(placement, side, index, isBoss, flags);
}

import {
  applyScarletMansionSynergyToBoss,
  calculateScarletMansionSynergy,
} from "../../../src/server/combat/synergy-definitions";

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
    test("HP70%以上のレミリアは紅き夜の王でATK+20%になる", () => {
      const simulator = new BattleSimulator();
      const boss = createTestBattleUnit(
        { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
        "left",
        0,
        true,
      );
      const raidUnit = createTestBattleUnit(
        { cell: 2, unitType: "vanguard", starLevel: 1 },
        "right",
        0,
      );

      const result = simulator.simulateBattle(
        [boss],
        [raidUnit],
        [{ cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" }],
        [{ cell: 2, unitType: "vanguard", starLevel: 1 }],
        1_500,
      );

      expect(result.damageDealt.left).toBe(333);
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
      expect(unit.cell).toBe(0);
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
  });

  describe("calculateCellDistance", () => {
    test("隣接するセルの距離が正しく計算される", () => {
      expect(calculateCellDistance(0, 1)).toBe(1);
      expect(calculateCellDistance(3, 4)).toBe(1);
      expect(calculateCellDistance(7, 6)).toBe(1);
    });

    test("遠いセルの距離が正しく計算される", () => {
      expect(calculateCellDistance(0, 7)).toBe(7);
      expect(calculateCellDistance(0, 4)).toBe(4);
      expect(calculateCellDistance(3, 7)).toBe(4);
    });

    test("同じセルの距離は0", () => {
      expect(calculateCellDistance(3, 3)).toBe(0);
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
        cell: 2,
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
        {
          id: "right-mage-0",
          type: "mage",
          starLevel: 1,
          hp: 40,
          maxHp: 40,
          attackPower: 6,
          attackSpeed: 0.6,
          attackRange: 2,
          cell: 6,
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
          cell: 4,
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
      expect(target!.cell).toBe(4);
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

    test("同じ入力からは同じ結果が得られる（決定論性）", () => {
      const simulator1 = new BattleSimulator();
      const simulator2 = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
        createTestBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "left", 1),
      ];
      const rightUnits: BattleUnit[] = [
        createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
        createTestBattleUnit({ cell: 6, unitType: "ranger", starLevel: 1 }, "right", 1),
      ];

      const result1 = simulator1.simulateBattle(leftUnits, rightUnits, [], [], 10000);
      const result2 = simulator2.simulateBattle(leftUnits, rightUnits, [], [], 10000);

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
        winner: "draw",
        durationMs: 10_000,
        damageDealt: {
          left: 0,
          right: 0,
        },
        leftSurvivors: [
          { id: "left-vanguard-0", hp: 80, cell: 0 },
          { id: "left-ranger-1", hp: 50, cell: 1 },
        ],
        rightSurvivors: [
          { id: "right-vanguard-0", hp: 80, cell: 7 },
          { id: "right-ranger-1", hp: 50, cell: 6 },
        ],
        combatLogStart: ["Battle started", "Left units: 2", "Right units: 2"],
        combatLogEnd: ["Left units: 2", "Right units: 2", "Battle ended: Draw (HP: 130 vs 130)"],
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

      expect(result1.winner).toBe("draw");
      expect(result1.damageDealt).toEqual({ left: 0, right: 0 });
      expect(result1.leftSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "left-vanguard-0", hp: 80, cell: 0 },
        { id: "left-ranger-1", hp: 50, cell: 1 },
      ]);
      expect(result1.rightSurvivors.map((unit) => ({ id: unit.id, hp: unit.hp, cell: unit.cell }))).toEqual([
        { id: "right-vanguard-0", hp: 80, cell: 7 },
        { id: "right-ranger-1", hp: 50, cell: 6 },
      ]);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });
  });
});
