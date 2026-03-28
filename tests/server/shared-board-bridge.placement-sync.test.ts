import { describe, expect, it } from "vitest";

import { validateRolePlacements } from "../../src/server/shared-board-bridge/placement-sync";
import { sharedBoardCoordinateToIndex } from "../../src/shared/shared-board-config";

describe("shared-board-bridge placement-sync", () => {
  it("allows placements when no boss has been assigned yet", () => {
    expect(
      validateRolePlacements("p1", undefined, [{ cell: 6, unitType: "vanguard" }]),
    ).toBeNull();
  });

  it("rejects boss placements outside the top half", () => {
    expect(
      validateRolePlacements("boss", "boss", [{ cell: 18, unitType: "mage" }]),
    ).toBe("Boss placement must stay in top half: cell 18");
  });

  it("rejects raid placements inside the top half", () => {
    expect(
      validateRolePlacements("raid", "boss", [{ cell: 2, unitType: "ranger" }]),
    ).toBe("Raid placement must stay in bottom half: cell 2");
  });

  it("rejects raid placements anywhere in the 6x6 boss half, not just the first row", () => {
    const bossHalfCell = sharedBoardCoordinateToIndex({ x: 5, y: 2 });

    expect(
      validateRolePlacements("raid", "boss", [{ cell: bossHalfCell, unitType: "ranger" }]),
    ).toBe(`Raid placement must stay in bottom half: cell ${bossHalfCell}`);
  });

  it("keeps malformed cells in the validation path instead of throwing", () => {
    expect(
      validateRolePlacements("raid", "boss", [{ cell: -1, unitType: "ranger" }]),
    ).toBe("Raid placement must stay in bottom half: cell -1");
  });
});
