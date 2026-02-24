const VALID_UNIT_TYPES = new Set(["vanguard", "ranger", "mage", "assassin"]);
const MAX_BOARD_UNITS = 8;
const MIN_CELL_INDEX = 0;
const MAX_CELL_INDEX = 7;
const DEFAULT_AUTO_DELAY_MS = 300;
const MAX_AUTO_DELAY_MS = 30_000;

export function parsePlacementsSpec(spec) {
  const trimmedSpec = String(spec ?? "").trim();

  if (!trimmedSpec) {
    return [];
  }

  const rawEntries = trimmedSpec
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (rawEntries.length > MAX_BOARD_UNITS) {
    throw new Error(`placements must be <= ${MAX_BOARD_UNITS}`);
  }

  const usedCells = new Set();
  const placements = [];

  for (const entry of rawEntries) {
    const parts = entry.split(":");

    if (parts.length !== 2) {
      throw new Error(`invalid placement entry: ${entry}`);
    }

    const cellText = parts[0].trim();
    const unitType = parts[1].trim();
    const cell = Number.parseInt(cellText, 10);

    if (!Number.isInteger(cell) || cell < MIN_CELL_INDEX || cell > MAX_CELL_INDEX) {
      throw new Error(`cell must be integer ${MIN_CELL_INDEX}-${MAX_CELL_INDEX}`);
    }

    if (!VALID_UNIT_TYPES.has(unitType)) {
      throw new Error(`invalid unitType: ${unitType}`);
    }

    if (usedCells.has(cell)) {
      throw new Error(`duplicate cell: ${cell}`);
    }

    usedCells.add(cell);
    placements.push({ cell, unitType });
  }

  placements.sort((left, right) => left.cell - right.cell);

  return placements;
}

export function parseAutoFlag(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true";
}

export function parseAutoDelayMs(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_AUTO_DELAY_MS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_AUTO_DELAY_MS;
  }

  if (parsed > MAX_AUTO_DELAY_MS) {
    return MAX_AUTO_DELAY_MS;
  }

  return parsed;
}
