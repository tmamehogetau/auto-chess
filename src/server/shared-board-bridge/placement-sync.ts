import type { BoardUnitPlacement } from "../../shared/room-messages";

export function validateRolePlacements(
  playerId: string,
  bossPlayerId: string | undefined,
  placements: BoardUnitPlacement[],
): string | null {
  if (!bossPlayerId || placements.length === 0) {
    return null;
  }

  const invalidPlacement = placements.find((placement) => {
    if (bossPlayerId === playerId) {
      return placement.cell >= 4;
    }

    return placement.cell < 4;
  });

  if (!invalidPlacement) {
    return null;
  }

  if (bossPlayerId === playerId) {
    return `Boss placement must stay in top half: cell ${invalidPlacement.cell}`;
  }

  return `Raid placement must stay in bottom half: cell ${invalidPlacement.cell}`;
}
