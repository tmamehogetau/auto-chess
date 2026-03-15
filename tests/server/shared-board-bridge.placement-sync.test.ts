import { describe, expect, it } from "vitest";

import { validateRolePlacements } from "../../src/server/shared-board-bridge/placement-sync";

describe("shared-board-bridge placement-sync", () => {
  it("allows placements when no boss has been assigned yet", () => {
    expect(
      validateRolePlacements("p1", undefined, [{ cell: 6, unitType: "vanguard" }]),
    ).toBeNull();
  });

  it("rejects boss placements outside the top half", () => {
    expect(
      validateRolePlacements("boss", "boss", [{ cell: 4, unitType: "mage" }]),
    ).toBe("Boss placement must stay in top half: cell 4");
  });

  it("rejects raid placements inside the top half", () => {
    expect(
      validateRolePlacements("raid", "boss", [{ cell: 2, unitType: "ranger" }]),
    ).toBe("Raid placement must stay in bottom half: cell 2");
  });
});
