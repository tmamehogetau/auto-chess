/**
 * 敗者へのダメージを計算
 * 新しいダメージ計算式: ベースダメージ + 勝者の生存ユニット数 × 2
 * @param winnerUnitCount 勝者の生存ユニット数
 * @param loserUnitCount 敗者の生存ユニット数（現在未使用、互換性のため保持）
 * @returns 敗者が受けるダメージ値
 */
export function buildLoserDamage(
  winnerUnitCount: number,
  _loserUnitCount: number,
): number {
  const baseDamage = 5;
  // 新しいダメージ計算式: ベースダメージ + 勝者の生存ユニット数 × 2
  return baseDamage + winnerUnitCount * 2;
}
