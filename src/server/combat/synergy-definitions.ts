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
  | 'faction.shinreibyou'
  | 'faction.grassroot_network'
  | 'faction.kou_ryuudou'
  | 'faction.kanjuden';

export interface TouhouFactionTierEffect {
  effectId: TouhouFactionEffectId;
  statModifiers?: {
    defense?: number;
    attackPower?: number;
    hpMultiplier?: number;
    attackSpeedMultiplier?: number;
  };
  special?: {
    reflectRatio?: number;
    factionDamageTakenMultiplier?: number;
    reflectPreventedDamage?: boolean;
    damageDealtMultiplier?: number;
    ultimateDamageMultiplier?: number;
    bonusDamageVsDebuffedTarget?: number;
    bonusDamageVsLowHpTarget?: number;
    shopCostReduction?: number;
    battleStartShieldMaxHpRatio?: number;
    firstFreeRefreshes?: number;
    battleEndGoldBonus?: number;
    initialManaBonus?: number;
    battleStartAttackSpeedMultiplier?: number;
    battleStartAttackSpeedDurationMs?: number;
    manaGainMultiplier?: number;
    debuffImmunityCategories?: string[];
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

export interface RemiliaBossPassiveValues {
  bossSideDamageTakenMultiplier: number;
  highHpAttackMultiplier: number;
  lifestealRatio: number;
}

export function resolveRemiliaBossPassiveValues(unitLevel: number = 1): RemiliaBossPassiveValues {
  if (unitLevel >= 7) {
    return {
      bossSideDamageTakenMultiplier: 0.78,
      highHpAttackMultiplier: 1.10,
      lifestealRatio: 0.10,
    };
  }

  if (unitLevel >= 4) {
    return {
      bossSideDamageTakenMultiplier: 0.84,
      highHpAttackMultiplier: 1.06,
      lifestealRatio: 0.06,
    };
  }

  return {
    bossSideDamageTakenMultiplier: 0.90,
    highHpAttackMultiplier: 1.03,
    lifestealRatio: 0.03,
  };
}

export const TOUHOU_FACTION_THRESHOLDS: Record<TouhouFactionId, readonly number[]> = {
  chireiden: [2, 4],
  myourenji: [2, 3, 5],
  shinreibyou: [2, 3, 5],
  grassroot_network: [2, 3],
  kou_ryuudou: [2, 4],
  kanjuden: [2, 3],
};

export const TOUHOU_FACTION_DEFINITIONS: Partial<Record<TouhouFactionId, SynergyDefinition>> = {
  chireiden: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.chireiden,
    effects: {},
  },
  myourenji: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.myourenji,
    effects: {
      hpMultiplier: [1.06, 1.1, 1.15],
    },
  },
  shinreibyou: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.shinreibyou,
    effects: {},
  },
  grassroot_network: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.grassroot_network,
    effects: {
      attackSpeedMultiplier: [1.1, 1.15],
    },
  },
  kou_ryuudou: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.kou_ryuudou,
    effects: {},
  },
  kanjuden: {
    thresholds: TOUHOU_FACTION_THRESHOLDS.kanjuden,
    effects: {},
  },
};

export const TOUHOU_FACTION_EFFECT_IDS: Partial<Record<TouhouFactionId, TouhouFactionEffectId>> = {
  chireiden: 'faction.chireiden',
  myourenji: 'faction.myourenji',
  shinreibyou: 'faction.shinreibyou',
  grassroot_network: 'faction.grassroot_network',
  kou_ryuudou: 'faction.kou_ryuudou',
  kanjuden: 'faction.kanjuden',
};

const TOUHOU_FACTION_SPECIAL_EFFECTS: Partial<Record<TouhouFactionId, Array<TouhouFactionTierEffect['special'] | undefined>>> = {
  chireiden: [
    { factionDamageTakenMultiplier: 0.94, reflectPreventedDamage: true },
    { factionDamageTakenMultiplier: 0.88, reflectPreventedDamage: true },
  ],
  myourenji: [
    { battleStartShieldMaxHpRatio: 0.06 },
    { battleStartShieldMaxHpRatio: 0.1 },
    { battleStartShieldMaxHpRatio: 0.14, shopCostReduction: 1 },
  ],
  shinreibyou: [
    { ultimateDamageMultiplier: 1.1, initialManaBonus: 10 },
    { ultimateDamageMultiplier: 1.18, initialManaBonus: 20, bonusDamageVsDebuffedTarget: 0.12 },
    { ultimateDamageMultiplier: 1.3, initialManaBonus: 35, bonusDamageVsDebuffedTarget: 0.18, manaGainMultiplier: 1.15 },
  ],
  grassroot_network: [
    undefined,
    { bonusDamageVsLowHpTarget: 0.2 },
  ],
  kou_ryuudou: [
    { battleEndGoldBonus: 1, initialManaBonus: 10 },
    {
      battleEndGoldBonus: 2,
      initialManaBonus: 20,
      battleStartAttackSpeedMultiplier: 1.15,
      battleStartAttackSpeedDurationMs: 6000,
    },
  ],
  kanjuden: [
    {
      damageDealtMultiplier: 1.12,
      initialManaBonus: 15,
      debuffImmunityCategories: ['crowd_control'],
    },
    {
      damageDealtMultiplier: 1.25,
      initialManaBonus: 35,
      debuffImmunityCategories: ['crowd_control', 'stat_down', 'dot'],
    },
  ],
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
  const special = TOUHOU_FACTION_SPECIAL_EFFECTS[factionId]?.[tierIndex];

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

  const result: TouhouFactionTierEffect = { effectId };

  if (Object.keys(statModifiers).length > 0) {
    result.statModifiers = statModifiers;
  }

  if (special) {
    result.special = special;
  }

  return result;
}

export function applyRemiliaBossPassiveToBoss(unit: BattleUnit): void {
  if (!unit.isBoss) {
    return;
  }

  if (unit.hp < unit.maxHp * 0.7) {
    return;
  }

  unit.buffModifiers.attackMultiplier *= resolveRemiliaBossPassiveValues(unit.unitLevel).highHpAttackMultiplier;
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
  heroSynergyBonusType: BoardUnitType | BoardUnitType[] | null = null,
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

  const heroSynergyBonusTypes = Array.isArray(heroSynergyBonusType)
    ? heroSynergyBonusType
    : heroSynergyBonusType
      ? [heroSynergyBonusType]
      : [];

  for (const bonusType of heroSynergyBonusTypes) {
    countsByType[bonusType] += 1;
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
