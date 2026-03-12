import { describe, it, expect, beforeEach } from 'vitest';
import { SharedPool } from '../../src/server/shared-pool';
import { TOUHOU_UNITS } from '../../src/data/touhou-units';

describe('SharedPool Integration Tests', () => {
  let pool: SharedPool;

  beforeEach(() => {
    pool = new SharedPool();
  });

  describe('初期在庫', () => {
    it('全コストの初期在庫が正しいこと', () => {
      expect(pool.getAvailable(1)).toBe(18);
      expect(pool.getAvailable(2)).toBe(14);
      expect(pool.getAvailable(3)).toBe(11);
      expect(pool.getAvailable(4)).toBe(8);
      expect(pool.getAvailable(5)).toBe(6);
    });

    it('無効なコストに対しては0を返すこと', () => {
      expect(pool.getAvailable(0)).toBe(0);
      expect(pool.getAvailable(6)).toBe(0);
      expect(pool.getAvailable(10)).toBe(0);
      expect(pool.getAvailable(-1)).toBe(0);
      expect(pool.getAvailable(1.5)).toBe(0);
    });
  });

  describe('在庫の減算', () => {
    it('在庫が十分な場合は減算に成功すること', () => {
      expect(pool.decrease(1)).toBe(true);
      expect(pool.getAvailable(1)).toBe(17);
    });

    it('在庫が不足している場合は減算に失敗すること', () => {
      // 1Gユニットを18回購入して枯渇させる
      for (let i = 0; i < 18; i++) {
        expect(pool.decrease(1)).toBe(true);
      }
      expect(pool.decrease(1)).toBe(false);
      expect(pool.getAvailable(1)).toBe(0);
    });

    it('無効なコストに対しては減算に失敗すること', () => {
      expect(pool.decrease(0)).toBe(false);
      expect(pool.decrease(6)).toBe(false);
      expect(pool.decrease(-1)).toBe(false);
    });
  });

  describe('在庫の増加', () => {
    it('在庫を増加できること', () => {
      pool.increase(1);
      expect(pool.getAvailable(1)).toBe(19);
    });

    it('複数回増加できること', () => {
      for (let i = 0; i < 5; i++) {
        pool.increase(3);
      }
      expect(pool.getAvailable(3)).toBe(16);
    });

    it('無効なコストに対しても処理が失敗しないこと', () => {
      expect(() => pool.increase(0)).not.toThrow();
      expect(() => pool.increase(6)).not.toThrow();
      expect(pool.increase(10)).toBeUndefined();
    });
  });

  describe('枯渇判定', () => {
    it('在庫が0の場合は枯渇していると判定されること', () => {
      // 1Gユニットを18回購入して枯渇させる
      for (let i = 0; i < 18; i++) {
        pool.decrease(1);
      }
      expect(pool.isDepleted(1)).toBe(true);
    });

    it('在庫が0より大きい場合は枯渇していないと判定されること', () => {
      expect(pool.isDepleted(1)).toBe(false);
      pool.decrease(1);
      expect(pool.isDepleted(1)).toBe(false); // 17残っている
    });

    it('無効なコストは枯渇していると判定されること', () => {
      expect(pool.isDepleted(0)).toBe(true);
      expect(pool.isDepleted(6)).toBe(true);
    });
  });

  describe('在庫変動の統合テスト', () => {
    it('購入と売却を繰り返しても在庫が正しく管理されること', () => {
      // 5個購入
      for (let i = 0; i < 5; i++) {
        pool.decrease(2);
      }
      expect(pool.getAvailable(2)).toBe(9);

      // 2個売却
      for (let i = 0; i < 2; i++) {
        pool.increase(2);
      }
      expect(pool.getAvailable(2)).toBe(11);

      // さらに10個購入
      for (let i = 0; i < 10; i++) {
        pool.decrease(2);
      }
      expect(pool.getAvailable(2)).toBe(1);
    });

    it('全コストの在庫変動が独立していること', () => {
      pool.decrease(1);
      pool.decrease(2);
      pool.decrease(3);
      pool.decrease(4);
      pool.decrease(5);

      expect(pool.getAvailable(1)).toBe(17);
      expect(pool.getAvailable(2)).toBe(13);
      expect(pool.getAvailable(3)).toBe(10);
      expect(pool.getAvailable(4)).toBe(7);
      expect(pool.getAvailable(5)).toBe(5);
    });
  });

  describe('脱落時のプール返却テスト', () => {
    it('複数のユニットをプールへ戻せること', () => {
      // プレイヤーが持っていたと仮定するユニット
      const playerUnits = [
        { cost: 1, count: 3 },
        { cost: 2, count: 2 },
        { cost: 3, count: 1 },
      ];

      // まず枯渇させる
      for (let i = 0; i < 18; i++) pool.decrease(1);
      for (let i = 0; i < 14; i++) pool.decrease(2);
      for (let i = 0; i < 11; i++) pool.decrease(3);

      expect(pool.isDepleted(1)).toBe(true);
      expect(pool.isDepleted(2)).toBe(true);
      expect(pool.isDepleted(3)).toBe(true);

      // プレイヤー脱落時にユニットを返却
      for (const unit of playerUnits) {
        for (let i = 0; i < unit.count; i++) {
          pool.increase(unit.cost);
        }
      }

      expect(pool.getAvailable(1)).toBe(3);
      expect(pool.getAvailable(2)).toBe(2);
      expect(pool.getAvailable(3)).toBe(1);
    });
  });

  describe('getAllInventory', () => {
    it('全コストの在庫を取得できること', () => {
      const inventory = pool.getAllInventory();

      expect(inventory.get(1)).toBe(18);
      expect(inventory.get(2)).toBe(14);
      expect(inventory.get(3)).toBe(11);
      expect(inventory.get(4)).toBe(8);
      expect(inventory.get(5)).toBe(6);
    });

    it('取得したマップは読み取り専用であること（変更しても元の在庫に影響しない）', () => {
      const inventory = pool.getAllInventory();

      try {
        (inventory as Map<number, number>).set(1, 999);
        // エラーにならないが、元のプールは変更されないはず
      } catch (e) {
        // マップが読み取り専用の場合はエラーになる可能性がある
      }

      expect(pool.getAvailable(1)).toBe(18);
    });
  });

  describe('per-unit inventory', () => {
    it('Touhou unitId ごとの初期在庫を cost ベース枚数で持てること', () => {
      const rin = TOUHOU_UNITS.find((unit) => unit.unitId === 'rin');
      const byakuren = TOUHOU_UNITS.find((unit) => unit.unitId === 'byakuren');

      expect(rin).toBeDefined();
      expect(byakuren).toBeDefined();
      expect(pool.getAvailableByUnitId('rin', rin!.cost)).toBe(5);
      expect(pool.getAvailableByUnitId('byakuren', byakuren!.cost)).toBe(2);
    });

    it('unitId ベースで減算と枯渇判定ができること', () => {
      for (let i = 0; i < 5; i++) {
        expect(pool.decreaseByUnitId('rin', 1)).toBe(true);
      }

      expect(pool.decreaseByUnitId('rin', 1)).toBe(false);
      expect(pool.isDepletedByUnitId('rin', 1)).toBe(true);
      expect(pool.getAvailableByUnitId('rin', 1)).toBe(0);
      expect(pool.getAvailableByUnitId('nazrin', 1)).toBe(5);
      expect(pool.getAvailable(1)).toBe(13);
    });

    it('同コスト unitId 在庫の合計は cost 在庫総量を超えないこと', () => {
      const cost1Units = TOUHOU_UNITS.filter((unit) => unit.cost === 1);
      const totalAvailable = cost1Units.reduce(
        (sum, unit) => sum + pool.getAvailableByUnitId(unit.unitId, unit.cost),
        0,
      );

      expect(totalAvailable).toBe(pool.getAvailable(1));
    });

    it('1つの unitId が枯渇しても sibling は残り、cost bucket と per-unit total が崩れないこと', () => {
      const targetUnitId = 'rin';
      const targetCost = 1;
      const siblingUnitId = 'nazrin';
      const cost1Units = TOUHOU_UNITS.filter((unit) => unit.cost === targetCost);

      while (pool.decreaseByUnitId(targetUnitId, targetCost)) {
        // target unitId を枯渇させる
      }

      expect(pool.getAvailableByUnitId(targetUnitId, targetCost)).toBe(0);
      expect(pool.getAvailableByUnitId(siblingUnitId, targetCost)).toBeGreaterThan(0);

      const totalAfterDeplete = cost1Units.reduce(
        (sum, unit) => sum + pool.getAvailableByUnitId(unit.unitId, targetCost),
        0,
      );
      expect(totalAfterDeplete).toBe(pool.getAvailable(targetCost));

      const cost5BeforeInvalidIncrease = pool.getAvailable(5);
      pool.increaseByUnitId(targetUnitId, 5);

      expect(pool.getAvailableByUnitId(targetUnitId, targetCost)).toBe(0);
      expect(pool.getAvailable(5)).toBe(cost5BeforeInvalidIncrease);

      const totalAfterInvalidIncrease = cost1Units.reduce(
        (sum, unit) => sum + pool.getAvailableByUnitId(unit.unitId, targetCost),
        0,
      );
      expect(totalAfterInvalidIncrease).toBe(pool.getAvailable(targetCost));
    });

    it('wrong-cost decrease は拒否され在庫が不変であること', () => {
      const targetUnitId = 'rin';
      const targetCost = 1;
      const wrongCost = 2;
      const siblingUnitId = 'nazrin';
      const targetCostUnits = TOUHOU_UNITS.filter((unit) => unit.cost === targetCost);

      expect(pool.getAvailableByUnitId(targetUnitId, targetCost)).toBeGreaterThan(0);

      const targetBefore = pool.getAvailableByUnitId(targetUnitId, targetCost);
      const siblingBefore = pool.getAvailableByUnitId(siblingUnitId, targetCost);
      const targetBucketBefore = pool.getAvailable(targetCost);
      const wrongBucketBefore = pool.getAvailable(wrongCost);
      const perUnitTotalBefore = targetCostUnits.reduce(
        (sum, unit) => sum + pool.getAvailableByUnitId(unit.unitId, targetCost),
        0,
      );

      const decreased = pool.decreaseByUnitId(targetUnitId, wrongCost);

      expect(decreased).toBe(false);
      expect(pool.getAvailableByUnitId(targetUnitId, targetCost)).toBe(targetBefore);
      expect(pool.getAvailableByUnitId(siblingUnitId, targetCost)).toBe(siblingBefore);

      const perUnitTotalAfterWrongCostDecrease = targetCostUnits.reduce(
        (sum, unit) => sum + pool.getAvailableByUnitId(unit.unitId, targetCost),
        0,
      );

      expect(pool.getAvailable(targetCost)).toBe(targetBucketBefore);
      expect(pool.getAvailable(wrongCost)).toBe(wrongBucketBefore);
      expect(perUnitTotalAfterWrongCostDecrease).toBe(perUnitTotalBefore);
      expect(pool.getAvailable(targetCost)).toBe(perUnitTotalAfterWrongCostDecrease);
    });
  });

  describe('コスト別の枯渇テスト', () => {
    it('5Gユニットは6個しか購入できないこと', () => {
      for (let i = 0; i < 6; i++) {
        expect(pool.decrease(5)).toBe(true);
      }
      expect(pool.decrease(5)).toBe(false);
      expect(pool.getAvailable(5)).toBe(0);
    });

    it('4Gユニットは8個しか購入できないこと', () => {
      for (let i = 0; i < 8; i++) {
        expect(pool.decrease(4)).toBe(true);
      }
      expect(pool.decrease(4)).toBe(false);
      expect(pool.getAvailable(4)).toBe(0);
    });
  });
});
