import type { BoardUnitType } from "../../shared/room-messages";
import type { RumorUnit } from "../../data/rumor-units";
import type { ScarletMansionUnit } from "../../data/scarlet-mansion-units";
import { ROSTER_KIND_TOUHOU, type RosterUnit } from "../roster/roster-provider";

type UnitRarity = 1 | 2 | 3 | 4 | 5;
type LegacyRarity = 1 | 2 | 3;
type TouhouCost = 1 | 2 | 3 | 4 | 5;

interface ShopOffer {
  unitType: BoardUnitType;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  rarity: UnitRarity;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  starLevel?: number;
}

const SHOP_SIZE = 5;
const BOSS_SHOP_SIZE = 2;
const MAX_LEVEL = 6;

const UNIT_TYPE_TO_COST: Readonly<Record<BoardUnitType, number>> = {
  vanguard: 1,
  ranger: 1,
  mage: 2,
  assassin: 3,
};

const SHOP_UNIT_POOL_BY_RARITY: Readonly<Record<LegacyRarity, readonly BoardUnitType[]>> = {
  1: ["vanguard", "ranger"],
  2: ["mage", "assassin"],
  3: ["assassin", "mage"],
};

const SHOP_ODDS_BY_LEVEL: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [1, 0, 0],
  2: [0.8, 0.2, 0],
  3: [0.6, 0.35, 0.05],
  4: [0.45, 0.4, 0.15],
  5: [0.3, 0.45, 0.25],
  6: [0.2, 0.45, 0.35],
};

const TOUHOU_SHOP_ODDS_BY_LEVEL: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  1: [1, 0, 0, 0, 0],
  2: [0.75, 0.25, 0, 0, 0],
  3: [0.5, 0.35, 0.15, 0, 0],
  4: [0.35, 0.3, 0.2, 0.15, 0],
  5: [0.2, 0.3, 0.25, 0.15, 0.1],
  6: [0.15, 0.25, 0.25, 0.2, 0.15],
};

const TOUHOU_SHOP_ODDS_BY_ROUND: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  1: [0.8, 0.2, 0, 0, 0],
  2: [0.55, 0.3, 0.15, 0, 0],
  3: [0.55, 0.3, 0.15, 0, 0],
  4: [0.3, 0.3, 0.25, 0.15, 0],
  5: [0.3, 0.3, 0.25, 0.15, 0],
  6: [0.2, 0.25, 0.3, 0.2, 0.05],
  7: [0.2, 0.25, 0.3, 0.2, 0.05],
  8: [0.1, 0.2, 0.3, 0.25, 0.15],
  9: [0.1, 0.2, 0.3, 0.25, 0.15],
  10: [0.05, 0.15, 0.3, 0.3, 0.2],
  11: [0.05, 0.15, 0.3, 0.3, 0.2],
  12: [0.05, 0.15, 0.3, 0.3, 0.2],
};

/**
 * Dependencies required by ShopOfferBuilder
 * Allows for dependency injection and testing
 */
export interface ShopOfferBuilderDependencies {
  /** Get rumor unit for a specific round */
  getRumorUnitForRound: (roundIndex: number) => RumorUnit | null;
  /** Get random scarlet mansion unit for boss shop */
  getRandomScarletMansionUnit: () => ScarletMansionUnit;
  /** Hash function for deterministic seed generation */
  hashToUint32: (text: string) => number;
  /** Convert seed to unit float [0, 1) */
  seedToUnitFloat: (seed: number) => number;
  /** Pick rarity based on odds and roll */
  pickRarity: (odds: readonly [number, number, number], roll: number) => LegacyRarity;
  /** Get player level for rarity calculation */
  getPlayerLevel: (playerId: string) => number;
  /** Check if shared pool system is enabled */
  isSharedPoolEnabled: () => boolean;
  /** Check if a specific pool cost is depleted */
  isPoolDepleted: (cost: number) => boolean;
  /** Check if per-unit pool migration is enabled */
  isPerUnitPoolEnabled: () => boolean;
  /** Check if a specific unitId pool is depleted */
  isUnitIdPoolDepleted: (unitId: string, cost: number) => boolean;
  /** Whether rumor influence feature is enabled */
  isRumorInfluenceEnabled: () => boolean;
  /** Set ID for seed generation */
  setId: string;
  /** Random function used by shop generation */
  random: () => number;
  /** Get active roster kind from provider (for boundary validation) */
  getActiveRosterKind: () => string;
  /** Get Touhou draft roster units for active Touhou shop generation */
  getTouhouDraftRosterUnits: () => RosterUnit[];
}

/**
 * Builds shop offers for match room controller
 * Extracted to separate module for better testability and separation of concerns
 */
export class ShopOfferBuilder {
  constructor(private readonly deps: ShopOfferBuilderDependencies) {}

  /**
   * Build normal unit shop offers for a player
   * @param playerId Player ID for seed generation
   * @param roundIndex Current round index
   * @param refreshCount Number of shop refreshes
   * @param purchaseCount Number of purchases made
   * @param isRumorEligible Whether player is eligible for rumor unit
   * @returns Array of shop offers
   */
  buildShopOffers(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
    isRumorEligible: boolean,
  ): ShopOffer[] {
    const offers: ShopOffer[] = [];

    // 噂勢力: eligibleプレイヤーの最初のスロットに確定ユニットを設定
    if (this.deps.isRumorInfluenceEnabled() && isRumorEligible) {
      const rumorUnit = this.deps.getRumorUnitForRound(roundIndex);
      if (rumorUnit) {
        offers.push({
          unitType: rumorUnit.unitType,
          unitId: rumorUnit.unitId,
          displayName: rumorUnit.displayName,
          rarity: rumorUnit.rarity,
          cost: rumorUnit.rarity,
          isRumorUnit: true,
        });
      }
    }

    // 残りのスロットを通常生成
    const remainingSlots = SHOP_SIZE - offers.length;
    for (let slotIndex = 0; slotIndex < remainingSlots; slotIndex += 1) {
      offers.push(
        this.buildSingleShopOffer(
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount + slotIndex,
        ),
      );
    }

    return offers;
  }

  /**
   * Build boss exclusive shop offers
   * Returns scarlet mansion units (always 2 slots)
   * @returns Array of shop offers for boss
   */
  buildBossShopOffers(): ShopOffer[] {
    const offers: ShopOffer[] = [];

    for (let slotIndex = 0; slotIndex < BOSS_SHOP_SIZE; slotIndex += 1) {
      const unit = this.deps.getRandomScarletMansionUnit();
      offers.push({
        unitType: unit.unitType,
        unitId: unit.unitId,
        displayName: unit.displayName,
        rarity: unit.cost as UnitRarity,
        cost: unit.cost,
      });
    }

    return offers;
  }

  /**
   * Build a replacement offer after a purchase
   * Used to fill a slot after a player buys an offer
   * @param playerId Player ID
   * @param roundIndex Current round index
   * @param refreshCount Number of shop refreshes
   * @param purchaseCount Number of purchases (used as nonce for seed)
   * @returns Single shop offer
   */
  buildReplacementOffer(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
  ): ShopOffer {
    return this.buildSingleShopOffer(
      playerId,
      roundIndex,
      refreshCount,
      5 + purchaseCount, // 5 is SHOP_SIZE, offset by purchase count
    );
  }

  /**
   * Build a single shop offer
   * Uses roster provider boundary for validation.
   * - MVP roster: uses hardcoded pools (byte-for-byte compatible)
   * - Touhou roster: uses unitId-based 25-unit draft pools
   * @private
   */
  private buildSingleShopOffer(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    nonce: number,
  ): ShopOffer {
    const rosterKind = this.deps.getActiveRosterKind();
    if (rosterKind === ROSTER_KIND_TOUHOU) {
      return this.buildTouhouShopOffer(playerId, roundIndex, refreshCount, nonce);
    }

    return this.buildMvpShopOffer(playerId, roundIndex, refreshCount, nonce);
  }

  private buildMvpShopOffer(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    nonce: number,
  ): ShopOffer {
    const level = this.deps.getPlayerLevel(playerId);
    const odds = SHOP_ODDS_BY_LEVEL[level] ?? SHOP_ODDS_BY_LEVEL[MAX_LEVEL] ?? [1, 0, 0];
    const seedBase = this.deps.hashToUint32(
      `${playerId}:${roundIndex}:${refreshCount}:${nonce}:${this.deps.setId}`,
    );
    const rarityRoll = this.deps.seedToUnitFloat(seedBase + 1);
    const rarity = this.deps.pickRarity(odds, rarityRoll) as LegacyRarity;

    // Use hardcoded pool for byte-for-byte MVP compatibility
    let unitPool = [...SHOP_UNIT_POOL_BY_RARITY[rarity]];

    // 共有プールが有効な場合、枯渇したユニットを除外
    if (this.deps.isSharedPoolEnabled()) {
      unitPool = unitPool.filter(
        (unitType) => !this.deps.isPoolDepleted(UNIT_TYPE_TO_COST[unitType]),
      );

      // すべてのユニットが枯渇している場合は、代わりに低レアリティを試行
      if (unitPool.length === 0 && rarity > 1) {
        const lowerRarity = (rarity - 1) as LegacyRarity;
        unitPool = [...SHOP_UNIT_POOL_BY_RARITY[lowerRarity]].filter(
          (unitType) => !this.deps.isPoolDepleted(UNIT_TYPE_TO_COST[unitType]),
        );
      }
    }

    const unitRoll = this.deps.seedToUnitFloat(seedBase + 2);
    const unitType =
      unitPool.length > 0
        ? unitPool[Math.floor(unitRoll * unitPool.length) % unitPool.length] ??
          unitPool[0] ??
          "vanguard"
        : "vanguard";

    return {
      unitType,
      rarity,
      cost: rarity,
    };
  }

  private buildTouhouShopOffer(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    nonce: number,
  ): ShopOffer {
    const odds = this.resolveTouhouOddsForRound(roundIndex);
    const costSeed = this.deps.hashToUint32(
      `${playerId}:${roundIndex}:${refreshCount}:${nonce}:${this.deps.setId}:touhou:cost`,
    );
    const unitSeed = this.deps.hashToUint32(
      `${playerId}:${roundIndex}:${refreshCount}:${nonce}:${this.deps.setId}:touhou:unit`,
    );
    const costRoll = this.deps.seedToUnitFloat(costSeed);
    const unitRoll = this.deps.seedToUnitFloat(unitSeed);
    const rosterUnits = this.deps.getTouhouDraftRosterUnits();
    const isSharedPoolEnabled = this.deps.isSharedPoolEnabled();
    const isPerUnitPoolEnabled = this.deps.isPerUnitPoolEnabled();

    const selectedCost = this.pickTouhouCost(odds, costRoll);
    let costPool = this.getTouhouCostPool(rosterUnits, selectedCost);

    if (isSharedPoolEnabled) {
      costPool = this.resolveTouhouSharedCostPool(rosterUnits, selectedCost, isPerUnitPoolEnabled);
    }

    if (costPool.length === 0) {
      const fallback = rosterUnits[0];
      if (!fallback) {
        return { unitType: "vanguard", rarity: 1, cost: 1 };
      }

      return {
        unitType: fallback.type,
        unitId: fallback.unitId,
        displayName: fallback.name,
        factionId: fallback.factionId ?? "",
        rarity: fallback.cost as UnitRarity,
        cost: fallback.cost,
      };
    }

    const selectedUnit =
      costPool[Math.floor(unitRoll * costPool.length) % costPool.length] ?? costPool[0]!;

    return {
      unitType: selectedUnit.type,
      unitId: selectedUnit.unitId,
      displayName: selectedUnit.name,
      factionId: selectedUnit.factionId ?? "",
      rarity: selectedUnit.cost as UnitRarity,
      cost: selectedUnit.cost,
    };
  }

  private resolveTouhouOddsForRound(
    roundIndex: number,
  ): readonly [number, number, number, number, number] {
    if (TOUHOU_SHOP_ODDS_BY_ROUND[roundIndex]) {
      return TOUHOU_SHOP_ODDS_BY_ROUND[roundIndex]!;
    }

    if (roundIndex <= 1) {
      return TOUHOU_SHOP_ODDS_BY_ROUND[1]!;
    }

    return TOUHOU_SHOP_ODDS_BY_ROUND[12]
      ?? TOUHOU_SHOP_ODDS_BY_LEVEL[MAX_LEVEL]
      ?? [1, 0, 0, 0, 0];
  }

  private pickTouhouCost(
    odds: readonly [number, number, number, number, number],
    roll: number,
  ): TouhouCost {
    let cumulative = 0;
    let highestWeightedCost: TouhouCost = 1;
    for (let index = 0; index < odds.length; index += 1) {
      const weight = odds[index] ?? 0;
      if (weight > 0) {
        highestWeightedCost = (index + 1) as TouhouCost;
      }

      cumulative += weight;
      if (roll < cumulative) {
        return (index + 1) as TouhouCost;
      }
    }

    return highestWeightedCost;
  }

  private getTouhouCostPool(rosterUnits: RosterUnit[], cost: TouhouCost): RosterUnit[] {
    return rosterUnits.filter((unit) => unit.cost === cost);
  }

  private resolveTouhouSharedCostPool(
    rosterUnits: RosterUnit[],
    selectedCost: TouhouCost,
    isPerUnitPoolEnabled: boolean,
  ): RosterUnit[] {
    if (!isPerUnitPoolEnabled) {
      return this.resolveTouhouSharedOnlyLowerCostPool(rosterUnits, selectedCost);
    }

    const costSearchOrder = this.getTouhouCostSearchOrder(selectedCost);

    for (const cost of costSearchOrder) {
      const availablePool = this.getTouhouAvailableCostPool(rosterUnits, cost, isPerUnitPoolEnabled);
      if (availablePool.length > 0) {
        return availablePool;
      }
    }

    return [];
  }

  private resolveTouhouSharedOnlyLowerCostPool(
    rosterUnits: RosterUnit[],
    selectedCost: TouhouCost,
  ): RosterUnit[] {
    let resolvedCost = selectedCost;
    let costPool = this.getTouhouCostPool(rosterUnits, resolvedCost);

    while (
      resolvedCost > 1
      && (costPool.length === 0 || this.deps.isPoolDepleted(resolvedCost))
    ) {
      resolvedCost = (resolvedCost - 1) as TouhouCost;
      costPool = this.getTouhouCostPool(rosterUnits, resolvedCost);
    }

    return costPool;
  }

  private getTouhouAvailableCostPool(
    rosterUnits: RosterUnit[],
    cost: TouhouCost,
    isPerUnitPoolEnabled: boolean,
  ): RosterUnit[] {
    const costPool = this.getTouhouCostPool(rosterUnits, cost);

    if (isPerUnitPoolEnabled) {
      return costPool.filter((unit) => !this.deps.isUnitIdPoolDepleted(unit.unitId, unit.cost));
    }

    if (this.deps.isPoolDepleted(cost)) {
      return [];
    }

    return costPool;
  }

  private getTouhouCostSearchOrder(selectedCost: TouhouCost): TouhouCost[] {
    const order: TouhouCost[] = [selectedCost];

    for (let distance = 1; distance <= 4; distance += 1) {
      const lowerCost = selectedCost - distance;
      if (lowerCost >= 1) {
        order.push(lowerCost as TouhouCost);
      }

      const higherCost = selectedCost + distance;
      if (higherCost <= 5) {
        order.push(higherCost as TouhouCost);
      }
    }

    return order;
  }
}
