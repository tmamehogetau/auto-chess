export type SharedBoardSide = "boss" | "raid";

export interface SharedBoardCoordinate {
  x: number;
  y: number;
}

export interface SharedBoardConfig {
  width: number;
  height: number;
  deploymentRows: Record<SharedBoardSide, number[]>;
}

export const DEFAULT_SHARED_BOARD_CONFIG: SharedBoardConfig = {
  width: 6,
  height: 6,
  deploymentRows: {
    boss: [0, 1, 2],
    raid: [3, 4, 5],
  },
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function isCoordinateWithinBoard(
  coordinate: SharedBoardCoordinate,
  config: SharedBoardConfig,
): boolean {
  return (
    Number.isInteger(coordinate.x) &&
    Number.isInteger(coordinate.y) &&
    coordinate.x >= 0 &&
    coordinate.y >= 0 &&
    coordinate.x < config.width &&
    coordinate.y < config.height
  );
}

function assertCoordinateWithinBoard(
  coordinate: SharedBoardCoordinate,
  config: SharedBoardConfig,
): void {
  if (!isCoordinateWithinBoard(coordinate, config)) {
    throw new Error("shared board coordinate out of range");
  }
}

export function sharedBoardCoordinateToIndex(
  coordinate: SharedBoardCoordinate,
  config: SharedBoardConfig = DEFAULT_SHARED_BOARD_CONFIG,
): number {
  assertCoordinateWithinBoard(coordinate, config);
  return coordinate.y * config.width + coordinate.x;
}

export function sharedBoardIndexToCoordinate(
  index: number,
  config: SharedBoardConfig = DEFAULT_SHARED_BOARD_CONFIG,
): SharedBoardCoordinate {
  const maxIndex = config.width * config.height - 1;

  assertPositiveInteger(index, "shared board index");

  if (index > maxIndex) {
    throw new Error(`shared board index must be in range 0-${maxIndex}`);
  }

  return {
    x: index % config.width,
    y: Math.floor(index / config.width),
  };
}

export function getDeploymentZoneForRow(
  config: SharedBoardConfig = DEFAULT_SHARED_BOARD_CONFIG,
  row: number,
): SharedBoardSide | null {
  if (!Number.isInteger(row) || row < 0 || row >= config.height) {
    return null;
  }

  if (config.deploymentRows.boss.includes(row)) {
    return "boss";
  }

  if (config.deploymentRows.raid.includes(row)) {
    return "raid";
  }

  return null;
}

export function isDeploymentCellForSide(
  config: SharedBoardConfig = DEFAULT_SHARED_BOARD_CONFIG,
  coordinate: SharedBoardCoordinate,
  side: SharedBoardSide,
): boolean {
  if (!isCoordinateWithinBoard(coordinate, config)) {
    return false;
  }

  return getDeploymentZoneForRow(config, coordinate.y) === side;
}
