/**
 * 共有プールの在庫管理クラス
 * Feature Flag: enableSharedPool が true の場合のみ有効化される
 *
 * 在庫はユニットのコスト（1G-5G）ごとに管理される
 */
export class SharedPool {
  private readonly inventory: Map<number, number>;

  constructor() {
    // コスト別の初期在庫: 1G:18, 2G:14, 3G:11, 4G:8, 5G:6
    this.inventory = new Map<number, number>([
      [1, 18],
      [2, 14],
      [3, 11],
      [4, 8],
      [5, 6],
    ]);
  }

  /**
   * 指定されたコストのユニットの在庫を減らす
   * 在庫が足りない場合は false を返す
   */
  public decrease(cost: number): boolean {
    if (!this.isValidCost(cost)) {
      return false;
    }

    const current = this.inventory.get(cost) ?? 0;

    if (current <= 0) {
      return false;
    }

    this.inventory.set(cost, current - 1);
    return true;
  }

  /**
   * 指定されたコストのユニットの在庫を増やす
   * （売却や脱落時に使用）
   */
  public increase(cost: number): void {
    if (!this.isValidCost(cost)) {
      return;
    }

    const current = this.inventory.get(cost) ?? 0;
    this.inventory.set(cost, current + 1);
  }

  /**
   * 指定されたコストのユニットの現在の在庫数を取得
   */
  public getAvailable(cost: number): number {
    if (!this.isValidCost(cost)) {
      return 0;
    }

    return this.inventory.get(cost) ?? 0;
  }

  /**
   * 指定されたコストのユニットが枯渇しているか判定
   */
  public isDepleted(cost: number): boolean {
    return this.getAvailable(cost) <= 0;
  }

  /**
   * 有効なコスト（1-5）か判定
   */
  private isValidCost(cost: number): boolean {
    return Number.isInteger(cost) && cost >= 1 && cost <= 5;
  }

  /**
   * 全コストの在庫を取得（テスト用）
   */
  public getAllInventory(): ReadonlyMap<number, number> {
    return new Map(this.inventory);
  }
}
