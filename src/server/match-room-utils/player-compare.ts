/**
 * プレイヤーIDを辞書順で比較
 * 配列のsortメソッドで使用可能な比較関数
 * @param left 比較対象のプレイヤーID
 * @param right 比較対象のプレイヤーID
 * @returns left < rightなら-1、left > rightなら1、等しければ0
 */
export function comparePlayerIds(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
