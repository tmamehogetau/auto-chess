import { BoardUnitType } from '../../shared/types';

export type SynergyTier = 0 | 1 | 2 | 3;

export interface SynergyEffects {
  defense?: number[];           // [tier1, tier2, tier3]
  attackPower?: number[];       // [tier1, tier2, tier3]
  hpMultiplier?: number[];      // [tier1, tier2, tier3] - 1.0 = no change
  attackSpeedMultiplier?: number[]; // [tier1, tier2, tier3] - 1.0 = no change
  critRate?: number[];          // [tier1, tier2, tier3] - 0.0-1.0
  critDamageMultiplier?: number[]; // [tier1, tier2, tier3] - 1.5 = 150% damage
}

export interface SynergyDefinition {
  thresholds: [number, number, number]; // [3, 6, 9]
  effects: SynergyEffects;
}

export const SYNERGY_THRESHOLDS: [number, number, number] = [3, 6, 9];

// Synergy name to unit type mapping for MVP Phase 1
export const SYNERGY_TO_UNIT_TYPE: Record<string, BoardUnitType> = {
  warrior: 'vanguard',
  archer: 'ranger',
};

// Unit type to synergy names mapping (reverse mapping)
export const UNIT_TYPE_TO_SYNERGY_NAMES: Record<BoardUnitType, string[]> = {
  vanguard: ['warrior'],
  ranger: ['archer'],
  mage: [],
  assassin: [],
};

export const SYNERGY_DEFINITIONS: Record<BoardUnitType, SynergyDefinition> = {
  vanguard: {
    thresholds: SYNERGY_THRESHOLDS,
    effects: {
      defense: [1, 3, 6],
      hpMultiplier: [1.0, 1.1, 1.2],
    },
  },
  ranger: {
    thresholds: SYNERGY_THRESHOLDS,
    effects: {
      attackPower: [1, 2, 4],
      attackSpeedMultiplier: [1.0, 1.05, 1.1],
    },
  },
  mage: {
    thresholds: SYNERGY_THRESHOLDS,
    effects: {
      attackSpeedMultiplier: [1.05, 1.1, 1.15],
      attackPower: [0, 1, 2],
    },
  },
  assassin: {
    thresholds: SYNERGY_THRESHOLDS,
    effects: {
      critRate: [0.1, 0.2, 0.3],
      critDamageMultiplier: [1.5, 1.75, 2.0],
    },
  },
};

/**
 * Get the synergy tier based on unit count
 */
export function getSynergyTier(count: number, thresholds: [number, number, number]): SynergyTier {
  if (count >= thresholds[2]) return 3;
  if (count >= thresholds[1]) return 2;
  if (count >= thresholds[0]) return 1;
  return 0;
}

/**
 * Calculate synergy details for a board
 */
export interface SynergyDetails {
  countsByType: Record<BoardUnitType, number>;
  activeTiers: Record<BoardUnitType, SynergyTier>;
}

export function calculateSynergyDetails(
  boardPlacements: Array<{ unitType: BoardUnitType }>,
  heroSynergyBonusType: BoardUnitType | null = null,
): SynergyDetails {
  const countsByType: Record<BoardUnitType, number> = {
    vanguard: 0,
    ranger: 0,
    mage: 0,
    assassin: 0,
  };

  for (const placement of boardPlacements) {
    const unitType = placement.unitType;

    // Check if this unit type has associated synergies
    const synergyNames = UNIT_TYPE_TO_SYNERGY_NAMES[unitType];

    if (synergyNames && synergyNames.length > 0) {
      // Map each synergy name to its unit type and count
      for (const synergyName of synergyNames) {
        const mappedType = SYNERGY_TO_UNIT_TYPE[synergyName];
        if (mappedType) {
          countsByType[mappedType]++;
        }
      }
    } else {
      // If no specific synergies, count by unit type directly
      countsByType[unitType]++;
    }
  }

  if (heroSynergyBonusType) {
    countsByType[heroSynergyBonusType] += 1;
  }

  const activeTiers: Record<BoardUnitType, SynergyTier> = {
    vanguard: 0,
    ranger: 0,
    mage: 0,
    assassin: 0,
  };

  for (const unitType of Object.keys(countsByType) as BoardUnitType[]) {
    const def = SYNERGY_DEFINITIONS[unitType];
    activeTiers[unitType] = getSynergyTier(countsByType[unitType], def.thresholds);
  }

  return { countsByType, activeTiers };
}
