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

const validatedDeploymentConfigs = new WeakSet<SharedBoardConfig>();

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

function validateDeploymentRows(
  config: SharedBoardConfig,
): void {
  if (validatedDeploymentConfigs.has(config)) {
    return;
  }

  const bossRows = new Set<number>();
  const raidRows = new Set<number>();

  for (const row of config.deploymentRows.boss) {
    if (!Number.isInteger(row) || row < 0 || row >= config.height) {
      throw new Error(
        `boss deployment rows must be integers in range 0-${config.height - 1}: ${JSON.stringify(config.deploymentRows.boss)}`,
      );
    }
    bossRows.add(row);
  }

  for (const row of config.deploymentRows.raid) {
    if (!Number.isInteger(row) || row < 0 || row >= config.height) {
      throw new Error(
        `raid deployment rows must be integers in range 0-${config.height - 1}: ${JSON.stringify(config.deploymentRows.raid)}`,
      );
    }
    raidRows.add(row);
  }

  const overlappingRows = [...bossRows].filter((row) => raidRows.has(row));
  if (overlappingRows.length > 0) {
    throw new Error(
      `deployment rows overlap for boss/raid: ${overlappingRows.join(", ")}`,
    );
  }

  validatedDeploymentConfigs.add(config);
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
  validateDeploymentRows(config);

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
