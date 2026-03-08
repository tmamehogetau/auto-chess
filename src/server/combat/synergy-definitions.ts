import type { BoardUnitPlacement } from '../../shared/room-messages';
import { BoardUnitType } from '../../shared/types';
import type { TouhouFactionId } from '../../data/touhou-units';
import type { BattleUnit } from './battle-simulator';

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
  thresholds: readonly number[];
  effects: SynergyEffects;
}

export type TouhouFactionEffectId =
  | 'faction.chireiden'
  | 'faction.myourenji'
  | 'faction.grassroot_network'
  | 'faction.kanjuden';

export interface TouhouFactionTierEffect {
  effectId: TouhouFactionEffectId;
  statModifiers?: {
    defense?: number;
    attackPower?: number;
    hpMultiplier?: number;
    attackSpeedMultiplier?: number;
  };
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

export const SCARLET_MANSION_ARCHETYPES = ["meiling", "sakuya", "patchouli"] as const;

export const TOUHOU_FACTION_THRESHOLDS: Record<TouhouFactionId, readonly number[]> = {
  chireiden: [2, 4],
  myourenji: [2, 3, 5],
  shinreibyou: [2, 3, 5],
  grassroot_network: [2, 3],
  niji_ryuudou: [2, 4],
  kanjuden: [2, 3],
};

export const TOUHOU_FACTION_DEFINITIONS: Partial<Record<TouhouFactionId, SynergyDefinition>> = {
  chireiden: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.chireiden,
    effects: {
      defense: [1, 2],
    },
  },
  myourenji: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.myourenji,
    effects: {
      hpMultiplier: [1.05, 1.1, 1.15],
      attackPower: [0, 1, 2],
    },
  },
  grassroot_network: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.grassroot_network,
    effects: {
      attackPower: [1, 2],
    },
  },
  kanjuden: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.kanjuden,
    effects: {
      attackPower: [1, 2],
    },
  },
};

export const TOUHOU_FACTION_EFFECT_IDS: Partial<Record<TouhouFactionId, TouhouFactionEffectId>> = {
  chireiden: 'faction.chireiden',
  myourenji: 'faction.myourenji',
  grassroot_network: 'faction.grassroot_network',
  kanjuden: 'faction.kanjuden',
};

export function getTouhouFactionTierEffect(
  factionId: TouhouFactionId,
  tier: SynergyTier,
): TouhouFactionTierEffect | null {
  if (tier <= 0) {
    return null;
  }

  const definition = TOUHOU_FACTION_DEFINITIONS[factionId];
  const effectId = TOUHOU_FACTION_EFFECT_IDS[factionId as keyof typeof TOUHOU_FACTION_EFFECT_IDS];

  if (!definition || !effectId) {
    return null;
  }

  const tierIndex = tier - 1;
  const statModifiers: TouhouFactionTierEffect['statModifiers'] = {};

  if (definition.effects.defense?.[tierIndex] !== undefined) {
    statModifiers.defense = definition.effects.defense[tierIndex];
  }
  if (definition.effects.attackPower?.[tierIndex] !== undefined) {
    statModifiers.attackPower = definition.effects.attackPower[tierIndex];
  }
  if (definition.effects.hpMultiplier?.[tierIndex] !== undefined) {
    statModifiers.hpMultiplier = definition.effects.hpMultiplier[tierIndex];
  }
  if (definition.effects.attackSpeedMultiplier?.[tierIndex] !== undefined) {
    statModifiers.attackSpeedMultiplier = definition.effects.attackSpeedMultiplier[tierIndex];
  }

  return {
    effectId,
    statModifiers,
  };
}

export function calculateScarletMansionSynergy(
  boardPlacements: BoardUnitPlacement[],
): boolean {
  const scarletCount = boardPlacements.filter((placement) =>
    placement.archetype !== undefined
    && (SCARLET_MANSION_ARCHETYPES as readonly string[]).includes(placement.archetype),
  ).length;

  return scarletCount >= 2;
}

export function applyScarletMansionSynergyToBoss(
  unit: BattleUnit,
  synergyActive: boolean,
): void {
  if (!synergyActive || !unit.isBoss) {
    return;
  }

  if (unit.hp < unit.maxHp * 0.7) {
    return;
  }

  unit.buffModifiers.attackMultiplier *= 1.1;
}

export function hasScarletMansionBossLifesteal(
  boardPlacements: BoardUnitPlacement[],
): boolean {
  return calculateScarletMansionSynergy(boardPlacements)
    && boardPlacements.some((placement) => placement.archetype === "remilia");
}

/**
 * Get the synergy tier based on unit count
 */
export function getSynergyTier(count: number, thresholds: readonly number[]): SynergyTier {
  if (thresholds[2] !== undefined && count >= thresholds[2]) return 3;
  if (thresholds[1] !== undefined && count >= thresholds[1]) return 2;
  if (thresholds[0] !== undefined && count >= thresholds[0]) return 1;
  return 0;
}

/**
 * Calculate synergy details for a board
 */
export interface SynergyDetails {
  countsByType: Record<BoardUnitType, number>;
  activeTiers: Record<BoardUnitType, SynergyTier>;
  factionCounts: Partial<Record<TouhouFactionId, number>>;
  factionActiveTiers: Partial<Record<TouhouFactionId, SynergyTier>>;
}

export interface SynergyCalculationOptions {
  enableTouhouFactions?: boolean;
}

export function calculateSynergyDetails(
  boardPlacements: Array<{ unitType: BoardUnitType; factionId?: TouhouFactionId | null }>,
  heroSynergyBonusType: BoardUnitType | null = null,
  options: SynergyCalculationOptions = {},
): SynergyDetails {
  const countsByType: Record<BoardUnitType, number> = {
    vanguard: 0,
    ranger: 0,
    mage: 0,
    assassin: 0,
  };
  const factionCounts: Partial<Record<TouhouFactionId, number>> = {};

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

    if (options.enableTouhouFactions && placement.factionId) {
      factionCounts[placement.factionId] = (factionCounts[placement.factionId] ?? 0) + 1;
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

  const factionActiveTiers: Partial<Record<TouhouFactionId, SynergyTier>> = {};

  if (options.enableTouhouFactions) {
    for (const factionId of Object.keys(TOUHOU_FACTION_THRESHOLDS) as TouhouFactionId[]) {
      factionActiveTiers[factionId] = getSynergyTier(
        factionCounts[factionId] ?? 0,
        TOUHOU_FACTION_THRESHOLDS[factionId],
      );
    }
  }

  return { countsByType, activeTiers, factionCounts, factionActiveTiers };
}
