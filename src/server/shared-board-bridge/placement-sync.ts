import type { BoardUnitPlacement } from "../../shared/room-messages";
import {
  DEFAULT_SHARED_BOARD_CONFIG,
  getDeploymentZoneForRow,
  sharedBoardIndexToCoordinate,
} from "../../shared/shared-board-config";

export function validateRolePlacements(
  playerId: string,
  bossPlayerId: string | undefined,
  placements: BoardUnitPlacement[],
): string | null {
  if (!bossPlayerId || placements.length === 0) {
    return null;
  }

  const invalidPlacement = placements.find((placement) => {
    let zone = null;

    try {
      const coordinate = sharedBoardIndexToCoordinate(
        placement.cell,
        DEFAULT_SHARED_BOARD_CONFIG,
      );
      zone = getDeploymentZoneForRow(DEFAULT_SHARED_BOARD_CONFIG, coordinate.y);
    } catch {
      return true;
    }

    if (bossPlayerId === playerId) {
      return zone !== "boss";
    }

    return zone !== "raid";
  });

  if (!invalidPlacement) {
    return null;
  }

  if (bossPlayerId === playerId) {
    return `Boss placement must stay in top half: cell ${invalidPlacement.cell}`;
  }

  return `Raid placement must stay in bottom half: cell ${invalidPlacement.cell}`;
}
