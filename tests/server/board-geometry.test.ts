import { describe, expect, test } from "vitest";

import { DEFAULT_SHARED_BOARD_CONFIG } from "../../src/shared/shared-board-config";
import {
  sharedBoardCoordinateToIndex,
  sharedBoardIndexToCoordinate,
  sharedBoardManhattanDistance,
} from "../../src/shared/board-geometry";

describe("board geometry", () => {
  test("shared board coordinates round-trip on the default 6x6 board", () => {
    const index = sharedBoardCoordinateToIndex({ x: 5, y: 5 }, DEFAULT_SHARED_BOARD_CONFIG);

    expect(index).toBe(35);
    expect(sharedBoardIndexToCoordinate(35, DEFAULT_SHARED_BOARD_CONFIG)).toEqual({ x: 5, y: 5 });
  });

  test("shared board coordinate conversion covers the full default board", () => {
    const visited = new Set<number>();

    for (let y = 0; y < DEFAULT_SHARED_BOARD_CONFIG.height; y += 1) {
      for (let x = 0; x < DEFAULT_SHARED_BOARD_CONFIG.width; x += 1) {
        const index = sharedBoardCoordinateToIndex({ x, y }, DEFAULT_SHARED_BOARD_CONFIG);
        visited.add(index);
        expect(sharedBoardIndexToCoordinate(index, DEFAULT_SHARED_BOARD_CONFIG)).toEqual({ x, y });
      }
    }

    expect(visited.size).toBe(36);
  });

  test("shared board Manhattan distance uses full-board coordinates", () => {
    expect(sharedBoardManhattanDistance({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(10);
    expect(sharedBoardManhattanDistance({ x: 1, y: 4 }, { x: 4, y: 2 })).toBe(5);
  });

  test("out-of-range shared board coordinates throw explicit errors", () => {
    expect(() =>
      sharedBoardCoordinateToIndex({ x: DEFAULT_SHARED_BOARD_CONFIG.width, y: 0 }, DEFAULT_SHARED_BOARD_CONFIG),
    ).toThrow("coordinate out of board range");
    expect(() =>
      sharedBoardIndexToCoordinate(DEFAULT_SHARED_BOARD_CONFIG.width * DEFAULT_SHARED_BOARD_CONFIG.height, DEFAULT_SHARED_BOARD_CONFIG),
    ).toThrow("board index must be integer 0-35");
  });
});
