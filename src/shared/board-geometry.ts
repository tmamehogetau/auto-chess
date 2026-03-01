export interface BoardCoordinate {
  x: number;
  y: number;
}

export const COMBAT_CELL_MIN_INDEX = 0;
export const COMBAT_CELL_MAX_INDEX = 7;
export const COMBAT_CELL_COUNT = COMBAT_CELL_MAX_INDEX - COMBAT_CELL_MIN_INDEX + 1;
export const COMBAT_ROW_SIZE = 4;

export const RAID_BOARD_WIDTH = 6;
export const RAID_BOARD_HEIGHT = 4;
export const BOSS_BOARD_WIDTH = 7;
export const BOSS_BOARD_HEIGHT = 4;

const COMBAT_CELL_TO_CANONICAL_COORDINATE: readonly BoardCoordinate[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
];

const RAID_BOARD_EMBED_OFFSET = { x: 1, y: 1 } as const;
const BOSS_BOARD_EMBED_OFFSET = { x: 1, y: 1 } as const;

function assertCombatCellIndex(cellIndex: number): void {
  if (
    !Number.isInteger(cellIndex) ||
    cellIndex < COMBAT_CELL_MIN_INDEX ||
    cellIndex > COMBAT_CELL_MAX_INDEX
  ) {
    throw new Error(
      `combat cell index must be integer ${COMBAT_CELL_MIN_INDEX}-${COMBAT_CELL_MAX_INDEX}`,
    );
  }
}

function toBoardIndex(
  coordinate: BoardCoordinate,
  width: number,
  height: number,
): number {
  if (
    !Number.isInteger(coordinate.x) ||
    !Number.isInteger(coordinate.y) ||
    coordinate.x < 0 ||
    coordinate.y < 0 ||
    coordinate.x >= width ||
    coordinate.y >= height
  ) {
    throw new Error("coordinate out of board range");
  }

  return coordinate.y * width + coordinate.x;
}

function fromBoardIndex(index: number, width: number, height: number): BoardCoordinate {
  const maxIndex = width * height - 1;

  if (!Number.isInteger(index) || index < 0 || index > maxIndex) {
    throw new Error(`board index must be integer 0-${maxIndex}`);
  }

  return {
    x: index % width,
    y: Math.floor(index / width),
  };
}

export function combatCellToCanonicalCoordinate(cellIndex: number): BoardCoordinate {
  assertCombatCellIndex(cellIndex);
  return COMBAT_CELL_TO_CANONICAL_COORDINATE[cellIndex] as BoardCoordinate;
}

export function canonicalCoordinateToCombatCell(coordinate: BoardCoordinate): number | null {
  const foundIndex = COMBAT_CELL_TO_CANONICAL_COORDINATE.findIndex(
    (candidate) => candidate.x === coordinate.x && candidate.y === coordinate.y,
  );

  return foundIndex >= 0 ? foundIndex : null;
}

export function combatCellToRaidBoardIndex(cellIndex: number): number {
  const coordinate = combatCellToCanonicalCoordinate(cellIndex);
  return toBoardIndex(
    {
      x: coordinate.x + RAID_BOARD_EMBED_OFFSET.x,
      y: coordinate.y + RAID_BOARD_EMBED_OFFSET.y,
    },
    RAID_BOARD_WIDTH,
    RAID_BOARD_HEIGHT,
  );
}

export function raidBoardIndexToCombatCell(raidBoardIndex: number): number | null {
  const coordinate = fromBoardIndex(raidBoardIndex, RAID_BOARD_WIDTH, RAID_BOARD_HEIGHT);
  return canonicalCoordinateToCombatCell({
    x: coordinate.x - RAID_BOARD_EMBED_OFFSET.x,
    y: coordinate.y - RAID_BOARD_EMBED_OFFSET.y,
  });
}

export function combatCellToBossBoardIndex(cellIndex: number): number {
  const coordinate = combatCellToCanonicalCoordinate(cellIndex);
  return toBoardIndex(
    {
      x: coordinate.x + BOSS_BOARD_EMBED_OFFSET.x,
      y: coordinate.y + BOSS_BOARD_EMBED_OFFSET.y,
    },
    BOSS_BOARD_WIDTH,
    BOSS_BOARD_HEIGHT,
  );
}

export function bossBoardIndexToCombatCell(bossBoardIndex: number): number | null {
  const coordinate = fromBoardIndex(bossBoardIndex, BOSS_BOARD_WIDTH, BOSS_BOARD_HEIGHT);
  return canonicalCoordinateToCombatCell({
    x: coordinate.x - BOSS_BOARD_EMBED_OFFSET.x,
    y: coordinate.y - BOSS_BOARD_EMBED_OFFSET.y,
  });
}
