import type { BoardUnitType } from "../shared/types";

/**
 * 共有プールの在庫管理クラス
 * Feature Flag: enableSharedPool が true の場合のみ有効化される
 */
export class SharedPool {
  private readonly inventory: Map<BoardUnitType, number>;

  constructor() {
    this.inventory = new Map<BoardUnitType, number>([
      ['vanguard', 18],
      ['ranger', 18],
      ['mage', 12],
      ['assassin', 10],
    ]);
  }

  /**
   * 指定されたユニットタイプの在庫を減らす
   * 在庫が足りない場合は false を返す
   */
  public decrease(unitType: string): boolean {
    if (!this.isValidUnitType(unitType)) {
      return false;
    }

    const current = this.inventory.get(unitType as BoardUnitType) ?? 0;

    if (current <= 0) {
      return false;
    }

    this.inventory.set(unitType as BoardUnitType, current - 1);
    return true;
  }

  /**
   * 指定されたユニットタイプの在庫を増やす
   * （売却や脱落時に使用）
   */
  public increase(unitType: string): void {
    if (!this.isValidUnitType(unitType)) {
      return;
    }

    const current = this.inventory.get(unitType as BoardUnitType) ?? 0;
    this.inventory.set(unitType as BoardUnitType, current + 1);
  }

  /**
   * 指定されたユニットタイプの現在の在庫数を取得
   */
  public getAvailable(unitType: string): number {
    if (!this.isValidUnitType(unitType)) {
      return 0;
    }

    return this.inventory.get(unitType as BoardUnitType) ?? 0;
  }

  /**
   * 指定されたユニットタイプが枯渇しているか判定
   */
  public isDepleted(unitType: string): boolean {
    return this.getAvailable(unitType) <= 0;
  }

  /**
   * 有効なユニットタイプか判定
   */
  private isValidUnitType(unitType: string): boolean {
    const validTypes: BoardUnitType[] = ['vanguard', 'ranger', 'mage', 'assassin'];
    return validTypes.includes(unitType as BoardUnitType);
  }

  /**
   * 全ユニットタイプの在庫を取得（テスト用）
   */
  public getAllInventory(): ReadonlyMap<BoardUnitType, number> {
    return new Map(this.inventory);
  }
}
