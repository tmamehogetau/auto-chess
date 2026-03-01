import { describe, it, expect, beforeEach } from 'vitest';
import { SharedPool } from '../../src/server/shared-pool';

describe('SharedPool Integration Tests', () => {
  let pool: SharedPool;

  beforeEach(() => {
    pool = new SharedPool();
  });

  describe('初期在庫', () => {
    it('全ユニットタイプの初期在庫が正しいこと', () => {
      expect(pool.getAvailable('vanguard')).toBe(18);
      expect(pool.getAvailable('ranger')).toBe(18);
      expect(pool.getAvailable('mage')).toBe(12);
      expect(pool.getAvailable('assassin')).toBe(10);
    });

    it('無効なユニットタイプに対しては0を返すこと', () => {
      expect(pool.getAvailable('invalid')).toBe(0);
      expect(pool.getAvailable('dragon')).toBe(0);
    });
  });

  describe('在庫の減算', () => {
    it('在庫が十分な場合は減算に成功すること', () => {
      expect(pool.decrease('vanguard')).toBe(true);
      expect(pool.getAvailable('vanguard')).toBe(17);
    });

    it('在庫が不足している場合は減算に失敗すること', () => {
      // vanguardを18回購入して枯渇させる
      for (let i = 0; i < 18; i++) {
        expect(pool.decrease('vanguard')).toBe(true);
      }
      expect(pool.decrease('vanguard')).toBe(false);
      expect(pool.getAvailable('vanguard')).toBe(0);
    });

    it('無効なユニットタイプに対しては減算に失敗すること', () => {
      expect(pool.decrease('invalid')).toBe(false);
      expect(pool.decrease('dragon')).toBe(false);
    });
  });

  describe('在庫の増加', () => {
    it('在庫を増加できること', () => {
      pool.increase('vanguard');
      expect(pool.getAvailable('vanguard')).toBe(19);
    });

    it('複数回増加できること', () => {
      for (let i = 0; i < 5; i++) {
        pool.increase('mage');
      }
      expect(pool.getAvailable('mage')).toBe(17);
    });

    it('無効なユニットタイプに対しても処理が失敗しないこと', () => {
      expect(() => pool.increase('invalid')).not.toThrow();
      expect(pool.increase('dragon')).toBeUndefined();
    });
  });

  describe('枯渇判定', () => {
    it('在庫が0の場合は枯渇していると判定されること', () => {
      // vanguardを18回購入して枯渇させる
      for (let i = 0; i < 18; i++) {
        pool.decrease('vanguard');
      }
      expect(pool.isDepleted('vanguard')).toBe(true);
    });

    it('在庫が0より大きい場合は枯渇していないと判定されること', () => {
      expect(pool.isDepleted('vanguard')).toBe(false);
      pool.decrease('vanguard');
      expect(pool.isDepleted('vanguard')).toBe(false); // 17残っている
    });

    it('無効なユニットタイプは枯渇していると判定されること', () => {
      expect(pool.isDepleted('invalid')).toBe(true);
      expect(pool.isDepleted('dragon')).toBe(true);
    });
  });

  describe('在庫変動の統合テスト', () => {
    it('購入と売却を繰り返しても在庫が正しく管理されること', () => {
      // 5個購入
      for (let i = 0; i < 5; i++) {
        pool.decrease('ranger');
      }
      expect(pool.getAvailable('ranger')).toBe(13);

      // 2個売却
      for (let i = 0; i < 2; i++) {
        pool.increase('ranger');
      }
      expect(pool.getAvailable('ranger')).toBe(15);

      // さらに10個購入
      for (let i = 0; i < 10; i++) {
        pool.decrease('ranger');
      }
      expect(pool.getAvailable('ranger')).toBe(5);
    });

    it('全ユニットタイプの在庫変動が独立していること', () => {
      pool.decrease('vanguard');
      pool.decrease('ranger');
      pool.decrease('mage');
      pool.decrease('assassin');

      expect(pool.getAvailable('vanguard')).toBe(17);
      expect(pool.getAvailable('ranger')).toBe(17);
      expect(pool.getAvailable('mage')).toBe(11);
      expect(pool.getAvailable('assassin')).toBe(9);
    });
  });

  describe('脱落時のプール返却テスト', () => {
    it('複数のユニットをプールへ戻せること', () => {
      // プレイヤーが持っていたと仮定するユニット
      const playerUnits = [
        { type: 'vanguard', count: 3 },
        { type: 'ranger', count: 2 },
        { type: 'mage', count: 1 },
      ];

      // まず枯渇させる
      for (let i = 0; i < 18; i++) pool.decrease('vanguard');
      for (let i = 0; i < 18; i++) pool.decrease('ranger');
      for (let i = 0; i < 12; i++) pool.decrease('mage');

      expect(pool.isDepleted('vanguard')).toBe(true);
      expect(pool.isDepleted('ranger')).toBe(true);
      expect(pool.isDepleted('mage')).toBe(true);

      // プレイヤー脱落時にユニットを返却
      for (const unit of playerUnits) {
        for (let i = 0; i < unit.count; i++) {
          pool.increase(unit.type);
        }
      }

      expect(pool.getAvailable('vanguard')).toBe(3);
      expect(pool.getAvailable('ranger')).toBe(2);
      expect(pool.getAvailable('mage')).toBe(1);
    });
  });

  describe('getAllInventory', () => {
    it('全ユニットタイプの在庫を取得できること', () => {
      const inventory = pool.getAllInventory();

      expect(inventory.get('vanguard')).toBe(18);
      expect(inventory.get('ranger')).toBe(18);
      expect(inventory.get('mage')).toBe(12);
      expect(inventory.get('assassin')).toBe(10);
    });

    it('取得したマップは読み取り専用であること（変更しても元の在庫に影響しない）', () => {
      const inventory = pool.getAllInventory();

      try {
        (inventory as Map<string, number>).set('vanguard', 999);
        // エラーにならないが、元のプールは変更されないはず
      } catch (e) {
        // マップが読み取り専用の場合はエラーになる可能性がある
      }

      expect(pool.getAvailable('vanguard')).toBe(18);
    });
  });
});
