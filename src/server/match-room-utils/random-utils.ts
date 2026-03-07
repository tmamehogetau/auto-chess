/**
 * 決定論的ハッシュ関数
 * FNV-1aアルゴリズムを使用して文字列からuint32ハッシュ値を生成
 * @param text ハッシュ化する文字列
 * @returns 0から2^32-1の範囲のハッシュ値
 */
export function hashToUint32(text: string): number {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * シード値から[0, 1)範囲の浮動小数点数を生成
 * Xorshiftアルゴリズムを使用した擬似乱数生成
 * @param seed 乱数生成のシード値
 * @returns 0以上1未満の浮動小数点数
 */
export function seedToUnitFloat(seed: number): number {
  let x = seed >>> 0;

  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;

  return (x >>> 0) / 4294967296;
}

/**
 * ユニットのレアリティ（1-3）
 */
export type UnitRarity = 1 | 2 | 3;

/**
 * 確率分布に基づいてレアリティを選択
 * @param odds レアリティ1, 2, 3の確率配列（合計1.0）
 * @param roll 0以上1未満の乱数値
 * @returns 選択されたレアリティ（1, 2, または 3）
 */
export function pickRarity(
  odds: readonly [number, number, number],
  roll: number,
): UnitRarity {
  const [oneCostRate, twoCostRate] = odds;

  if (roll < oneCostRate) {
    return 1;
  }

  if (roll < oneCostRate + twoCostRate) {
    return 2;
  }

  return 3;
}
