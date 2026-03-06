import type { BoardUnitPlacement, BoardUnitType } from "../../shared/room-messages";
import {
  VALID_UNIT_TYPES,
  getUnitEffectTable,
  type UnitEffectRule,
  type UnitEffectSetId,
  type UnitSkillRule,
} from "./unit-effect-definitions";
import { getStarCombatMultiplier } from "../star-level-config";
import {
  COMBAT_CELL_COUNT,
  COMBAT_CELL_MAX_INDEX,
  COMBAT_CELL_MIN_INDEX,
} from "../../shared/board-geometry";

const MAX_BOARD_UNITS = COMBAT_CELL_COUNT;

interface UnitEffectOptions {
  setId?: UnitEffectSetId;
}

export type PlacementValidationErrorCode =
  | "INVALID_ARRAY"
  | "INVALID_PLACEMENT"
  | "INVALID_CELL"
  | "INVALID_UNIT_TYPE"
  | "INVALID_STAR_LEVEL"
  | "INVALID_SELL_VALUE"
  | "INVALID_UNIT_COUNT"
  | "DUPLICATE_CELL";

export interface PlacementValidationResult {
  normalized: BoardUnitPlacement[] | null;
  errorCode?: PlacementValidationErrorCode;
}

export function normalizeBoardPlacements(
  boardPlacements: BoardUnitPlacement[],
): PlacementValidationResult {
  if (!Array.isArray(boardPlacements)) {
    return { normalized: null, errorCode: "INVALID_ARRAY" };
  }

  if (boardPlacements.length > MAX_BOARD_UNITS) {
    return { normalized: null, errorCode: "INVALID_ARRAY" };
  }

  const usedCells = new Set<number>();
  const normalized: BoardUnitPlacement[] = [];

  for (const placement of boardPlacements) {
    if (!placement) {
      return { normalized: null, errorCode: "INVALID_PLACEMENT" };
    }

    if (
      !Number.isInteger(placement.cell) ||
      placement.cell < COMBAT_CELL_MIN_INDEX ||
      placement.cell > COMBAT_CELL_MAX_INDEX
    ) {
      return { normalized: null, errorCode: "INVALID_CELL" };
    }

    if (!VALID_UNIT_TYPES.has(placement.unitType)) {
      return { normalized: null, errorCode: "INVALID_UNIT_TYPE" };
    }

    const starLevel = placement.starLevel ?? 1;

    if (!Number.isInteger(starLevel) || starLevel < 1 || starLevel > 3) {
      return { normalized: null, errorCode: "INVALID_STAR_LEVEL" };
    }

    if (
      placement.sellValue !== undefined &&
      (!Number.isInteger(placement.sellValue) || placement.sellValue < 1)
    ) {
      return { normalized: null, errorCode: "INVALID_SELL_VALUE" };
    }

    if (
      placement.unitCount !== undefined &&
      (!Number.isInteger(placement.unitCount) || placement.unitCount < 1)
    ) {
      return { normalized: null, errorCode: "INVALID_UNIT_COUNT" };
    }

    if (usedCells.has(placement.cell)) {
      return { normalized: null, errorCode: "DUPLICATE_CELL" };
    }

    usedCells.add(placement.cell);
    const normalizedPlacement: BoardUnitPlacement = {
      cell: placement.cell,
      unitType: placement.unitType,
      starLevel,
    };

    if (placement.sellValue !== undefined) {
      normalizedPlacement.sellValue = placement.sellValue;
    }

    if (placement.unitCount !== undefined) {
      normalizedPlacement.unitCount = placement.unitCount;
    }

    if (placement.archetype !== undefined) {
      normalizedPlacement.archetype = placement.archetype;
    }

    normalized.push(normalizedPlacement);
  }

  normalized.sort((left, right) => left.cell - right.cell);
  return { normalized };
}

export function resolveUnitCountFromState(
  boardPlacements: BoardUnitPlacement[] | undefined,
  fallbackUnitCount: number,
): number {
  if (boardPlacements && boardPlacements.length > 0) {
    return boardPlacements.length;
  }

  return fallbackUnitCount;
}

export function resolveBoardPowerFromState(
  boardPlacements: BoardUnitPlacement[] | undefined,
  fallbackUnitCount: number,
  options?: UnitEffectOptions,
): number {
  if (boardPlacements && boardPlacements.length > 0) {
    return calculateBoardPower(boardPlacements, options);
  }

  return fallbackUnitCount * 6;
}

export function calculateBoardPower(
  boardPlacements: BoardUnitPlacement[],
  options?: UnitEffectOptions,
): number {
  const effectTable = getUnitEffectTable(options?.setId);
  let totalPower = 0;

  for (const placement of boardPlacements) {
    totalPower += calculatePlacementPower(placement, effectTable);
  }

  const synergyBonus = calculateSynergyBonus(boardPlacements);
  const skillBonus = calculateSkillBonus(boardPlacements, effectTable);

  return totalPower + synergyBonus + skillBonus;
}

function calculatePlacementPower(
  placement: BoardUnitPlacement,
  effectTable: Readonly<Record<BoardUnitType, UnitEffectRule>>,
): number {
  const effectRule = effectTable[placement.unitType];
  const inFrontRow = isFrontRowCell(placement.cell);

  return (
    (effectRule.basePower + (inFrontRow ? effectRule.frontRowBonus : effectRule.backRowBonus)) *
    getStarCombatMultiplier(placement.starLevel)
  );
}

function calculateSynergyBonus(boardPlacements: BoardUnitPlacement[]): number {
  const countsByType = {
    vanguard: 0,
    ranger: 0,
    mage: 0,
    assassin: 0,
  } as Record<BoardUnitType, number>;

  for (const placement of boardPlacements) {
    countsByType[placement.unitType] += 1;
  }

  let totalBonus = 0;

  for (const unitType of Object.keys(countsByType) as BoardUnitType[]) {
    if (countsByType[unitType] >= 2) {
      totalBonus += 2;
    }
  }

  return totalBonus;
}

function calculateSkillBonus(
  boardPlacements: BoardUnitPlacement[],
  effectTable: Readonly<Record<BoardUnitType, UnitEffectRule>>,
): number {
  const placementsByType = groupPlacementsByType(boardPlacements);
  let totalBonus = 0;

  for (const unitType of Object.keys(placementsByType) as BoardUnitType[]) {
    const effectRule = effectTable[unitType];

    if (!effectRule.skill) {
      continue;
    }

    const activated = isUnitSkillActivated(
      unitType,
      effectRule.skill,
      placementsByType,
      boardPlacements,
    );

    if (!activated) {
      continue;
    }

    totalBonus += effectRule.skill.bonus;
  }

  return totalBonus;
}

function isUnitSkillActivated(
  unitType: BoardUnitType,
  skillRule: UnitSkillRule,
  placementsByType: Record<BoardUnitType, BoardUnitPlacement[]>,
  boardPlacements: BoardUnitPlacement[],
): boolean {
  const placements = placementsByType[unitType];

  if (placements.length < skillRule.minimumCount) {
    return false;
  }

  switch (skillRule.activation) {
    case "all-back":
      return placements.every((placement) => isBackRowCell(placement.cell));
    case "all-front":
      return placements.every((placement) => isFrontRowCell(placement.cell));
    case "all-back-with-mage-spotter": {
      if (!placements.every((placement) => isBackRowCell(placement.cell))) {
        return false;
      }

      const hasMageSpotter = boardPlacements.some(
        (placement) => placement.unitType === "mage" && isFrontRowCell(placement.cell),
      );

      if (!hasMageSpotter) {
        return false;
      }

      for (const placement of boardPlacements) {
        if (placement.unitType === unitType) {
          continue;
        }

        if (isBackRowCell(placement.cell)) {
          return false;
        }
      }

      return true;
    }
    default:
      return false;
  }
}

function groupPlacementsByType(
  boardPlacements: BoardUnitPlacement[],
): Record<BoardUnitType, BoardUnitPlacement[]> {
  const placementsByType = {
    vanguard: [],
    ranger: [],
    mage: [],
    assassin: [],
  } as Record<BoardUnitType, BoardUnitPlacement[]>;

  for (const placement of boardPlacements) {
    placementsByType[placement.unitType].push(placement);
  }

  return placementsByType;
}

function isBackRowCell(cell: number): boolean {
  return cell >= 4;
}

function isFrontRowCell(cell: number): boolean {
  return cell <= 3;
}
