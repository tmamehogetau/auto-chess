import { describe, expect, it } from "vitest";

import {
  DEFAULT_SHARED_BOARD_CONFIG,
  sharedBoardCoordinateToIndex,
  sharedBoardIndexToCoordinate,
  getDeploymentZoneForRow,
  isDeploymentCellForSide,
} from "../../src/shared/shared-board-config";

describe("shared-board-config", () => {
  it("exposes the default 6x6 shared board config", () => {
    expect(DEFAULT_SHARED_BOARD_CONFIG).toEqual({
      width: 6,
      height: 6,
      deploymentRows: {
        boss: [0, 1, 2],
        raid: [3, 4, 5],
      },
    });
  });

  it("converts shared board coordinates to indexes and back", () => {
    expect(sharedBoardCoordinateToIndex({ x: 0, y: 0 })).toBe(0);
    expect(sharedBoardCoordinateToIndex({ x: 5, y: 5 })).toBe(35);
    expect(sharedBoardIndexToCoordinate(0)).toEqual({ x: 0, y: 0 });
    expect(sharedBoardIndexToCoordinate(35)).toEqual({ x: 5, y: 5 });
  });

  it("round-trips every coordinate on the default board", () => {
    for (let y = 0; y < DEFAULT_SHARED_BOARD_CONFIG.height; y += 1) {
      for (let x = 0; x < DEFAULT_SHARED_BOARD_CONFIG.width; x += 1) {
        const index = sharedBoardCoordinateToIndex({ x, y });
        expect(sharedBoardIndexToCoordinate(index)).toEqual({ x, y });
      }
    }
  });

  it("resolves deployment zones by row", () => {
    expect(getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, 0)).toBe("boss");
    expect(getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, 2)).toBe("boss");
    expect(getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, 3)).toBe("raid");
    expect(getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, 5)).toBe("raid");
    expect(getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, -1)).toBeNull();
    expect(getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, 6)).toBeNull();
  });

  it("detects deployment cells for each side", () => {
    expect(isDeploymentCellForSide(DEFAULT_SHARED_BOARD_CONFIG, { x: 0, y: 0 }, "boss")).toBe(true);
    expect(isDeploymentCellForSide(DEFAULT_SHARED_BOARD_CONFIG, { x: 4, y: 2 }, "boss")).toBe(true);
    expect(isDeploymentCellForSide(DEFAULT_SHARED_BOARD_CONFIG, { x: 1, y: 3 }, "boss")).toBe(false);
    expect(isDeploymentCellForSide(DEFAULT_SHARED_BOARD_CONFIG, { x: 1, y: 3 }, "raid")).toBe(true);
    expect(isDeploymentCellForSide(DEFAULT_SHARED_BOARD_CONFIG, { x: 5, y: 5 }, "raid")).toBe(true);
    expect(isDeploymentCellForSide(DEFAULT_SHARED_BOARD_CONFIG, { x: 5, y: 5 }, "boss")).toBe(false);
  });

  it("rejects overlapping deployment rows", () => {
    expect(() =>
      getDeploymentZoneForRow(
        {
          width: 6,
          height: 6,
          deploymentRows: {
            boss: [0, 1, 2],
            raid: [2, 3, 4],
          },
        },
        2,
      ),
    ).toThrow("deployment rows overlap");
  });

  it("rejects out-of-range deployment rows", () => {
    expect(() =>
      getDeploymentZoneForRow(
        {
          width: 6,
          height: 6,
          deploymentRows: {
            boss: [0, 1, 6],
            raid: [3, 4, 5],
          },
        },
        0,
      ),
    ).toThrow("boss deployment rows");
  });
});
