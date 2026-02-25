import { describe, expect, test } from "vitest";

import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import {
  BattleSimulator,
  calculateCellDistance,
  createBattleUnit,
  findTarget,
  type BattleUnit,
} from "../../../src/server/combat/battle-simulator";

describe("battle-simulator", () => {
  describe("createBattleUnit", () => {
    test("単一のユニットが正しく作成される", () => {
      const placement: BoardUnitPlacement = {
        cell: 0,
        unitType: "vanguard",
        starLevel: 1,
      };
      const unit = createBattleUnit(placement, "left", 0);
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

      const unit1 = createBattleUnit(placement1, "left", 0);
      const unit2 = createBattleUnit(placement2, "left", 1);
      const unit3 = createBattleUnit(placement3, "left", 2);

      expect(unit1.hp).toBeLessThan(unit2.hp);
      expect(unit2.hp).toBeLessThan(unit3.hp);
      expect(unit1.attackPower).toBeLessThan(unit2.attackPower);
      expect(unit2.attackPower).toBeLessThan(unit3.attackPower);
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
        },
      ];
      expect(findTarget(attacker, enemies)).toBeNull();
    });
  });

  describe("BattleSimulator", () => {
    test("単一の対決で正しく戦闘が進行する", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, 5000);

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
        createBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0),
        createBattleUnit({ cell: 1, unitType: "ranger", starLevel: 1 }, "left", 1),
      ];
      const rightUnits: BattleUnit[] = [
        createBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
        createBattleUnit({ cell: 6, unitType: "ranger", starLevel: 1 }, "right", 1),
      ];

      const result1 = simulator1.simulateBattle(leftUnits, rightUnits, 10000);
      const result2 = simulator2.simulateBattle(leftUnits, rightUnits, 10000);

      expect(result1.winner).toBe(result2.winner);
      expect(result1.leftSurvivors.length).toBe(result2.leftSurvivors.length);
      expect(result1.rightSurvivors.length).toBe(result2.rightSurvivors.length);
      expect(result1.combatLog).toEqual(result2.combatLog);
    });

    test("戦闘ログにダメージ情報が記録される", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createBattleUnit({ cell: 2, unitType: "ranger", starLevel: 1 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createBattleUnit({ cell: 4, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, 5000);

      const damageLogs = result.combatLog.filter((log) => log.includes("damage"));
      expect(damageLogs.length).toBeGreaterThan(0);
      expect(damageLogs[0]).toMatch(/attacks .* for \d+ damage \(HP: \d+\/\d+\)/);
    });

    test("時間制限に達した場合はHPで勝敗が決まる", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 3 }, "left", 0),
      ];
      const rightUnits: BattleUnit[] = [
        createBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, 100);

      expect(result.combatLog[result.combatLog.length - 1]).toMatch(/Battle ended: (Left|Right) wins \(HP:/);
    });

    test("全滅時に正しく勝者が判定される", () => {
      const simulator = new BattleSimulator();

      const leftUnits: BattleUnit[] = [
        createBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 3 }, "left", 0),
        createBattleUnit({ cell: 1, unitType: "vanguard", starLevel: 3 }, "left", 1),
      ];
      const rightUnits: BattleUnit[] = [
        createBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 1 }, "right", 0),
      ];

      const result = simulator.simulateBattle(leftUnits, rightUnits, 10000);

      expect(["left", "right", "draw"]).toContain(result.winner);
    });

    test("空のユニット配列では即座に戦闘が終了する", () => {
      const simulator = new BattleSimulator();

      const result = simulator.simulateBattle([], [], 10000);
      expect(result.winner).toBe("draw");
      expect(result.leftSurvivors).toEqual([]);
      expect(result.rightSurvivors).toEqual([]);
      expect(result.combatLog[result.combatLog.length - 1]).toContain("Draw (all units defeated)");
    });
  });
});
