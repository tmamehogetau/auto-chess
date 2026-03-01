import { describe, expect, test } from "vitest";

import {
  BOSS_BOARD_HEIGHT,
  BOSS_BOARD_WIDTH,
  COMBAT_CELL_MAX_INDEX,
  COMBAT_CELL_MIN_INDEX,
  RAID_BOARD_HEIGHT,
  RAID_BOARD_WIDTH,
  bossBoardIndexToCombatCell,
  combatCellToBossBoardIndex,
  combatCellToCanonicalCoordinate,
  combatCellToRaidBoardIndex,
  raidBoardIndexToCombatCell,
} from "../../src/shared/board-geometry";

describe("board geometry", () => {
  test("combat cell range is fixed to 0-7", () => {
    expect(COMBAT_CELL_MIN_INDEX).toBe(0);
    expect(COMBAT_CELL_MAX_INDEX).toBe(7);
  });

  test("board dimensions match spec anchors", () => {
    expect(RAID_BOARD_WIDTH).toBe(6);
    expect(RAID_BOARD_HEIGHT).toBe(4);
    expect(BOSS_BOARD_WIDTH).toBe(7);
    expect(BOSS_BOARD_HEIGHT).toBe(4);
  });

  test("all combat cells map to unique canonical coordinates", () => {
    const visited = new Set<string>();

    for (let cell = COMBAT_CELL_MIN_INDEX; cell <= COMBAT_CELL_MAX_INDEX; cell += 1) {
      const coordinate = combatCellToCanonicalCoordinate(cell);
      visited.add(`${coordinate.x},${coordinate.y}`);
    }

    expect(visited.size).toBe(8);
  });

  test("raid board mapping is reversible for all combat cells", () => {
    for (let cell = COMBAT_CELL_MIN_INDEX; cell <= COMBAT_CELL_MAX_INDEX; cell += 1) {
      const raidIndex = combatCellToRaidBoardIndex(cell);
      expect(raidBoardIndexToCombatCell(raidIndex)).toBe(cell);
    }
  });

  test("boss board mapping is reversible for all combat cells", () => {
    for (let cell = COMBAT_CELL_MIN_INDEX; cell <= COMBAT_CELL_MAX_INDEX; cell += 1) {
      const bossIndex = combatCellToBossBoardIndex(cell);
      expect(bossBoardIndexToCombatCell(bossIndex)).toBe(cell);
    }
  });

  test("non-mapped raid/boss board indices return null", () => {
    expect(raidBoardIndexToCombatCell(0)).toBeNull();
    expect(bossBoardIndexToCombatCell(0)).toBeNull();
  });

  test("invalid combat cell indices throw explicit error", () => {
    expect(() => combatCellToRaidBoardIndex(-1)).toThrow(
      "combat cell index must be integer 0-7",
    );
    expect(() => combatCellToBossBoardIndex(8)).toThrow(
      "combat cell index must be integer 0-7",
    );
  });
});
