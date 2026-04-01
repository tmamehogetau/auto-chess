export const MAX_BENCH_SIZE = 8;
export const MAX_RAID_BOARD_UNITS = 2;
export const MAX_BOSS_BOARD_UNITS = 6;
export const MAX_STANDARD_BOARD_UNITS = 8;

export function getMaxBoardUnitsForPlayerRole(isBossPlayer: boolean): number {
  return isBossPlayer ? MAX_BOSS_BOARD_UNITS : MAX_RAID_BOARD_UNITS;
}
