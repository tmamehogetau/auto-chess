import type { BoardUnitType } from "../../shared/room-messages";
import type { ShopItemOffer } from "../../shared/room-messages";
import type { ItemType } from "../combat/item-definitions";
import type { RumorUnit } from "../../data/rumor-units";
import type { ScarletMansionUnit } from "../../data/scarlet-mansion-units";

type UnitRarity = 1 | 2 | 3;

interface ShopOffer {
  unitType: BoardUnitType;
  rarity: UnitRarity;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  starLevel?: number;
}

const SHOP_SIZE = 5;
const BOSS_SHOP_SIZE = 2;
const ITEM_SHOP_SIZE = 5;
const MAX_LEVEL = 6;

const UNIT_TYPE_TO_COST: Readonly<Record<BoardUnitType, number>> = {
  vanguard: 1,
  ranger: 1,
  mage: 2,
  assassin: 3,
};

const SHOP_UNIT_POOL_BY_RARITY: Readonly<Record<UnitRarity, readonly BoardUnitType[]>> = {
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
  pickRarity: (odds: readonly [number, number, number], roll: number) => UnitRarity;
  /** Get player level for rarity calculation */
  getPlayerLevel: (playerId: string) => number;
  /** Check if shared pool system is enabled */
  isSharedPoolEnabled: () => boolean;
  /** Check if a specific pool cost is depleted */
  isPoolDepleted: (cost: number) => boolean;
  /** Whether rumor influence feature is enabled */
  isRumorInfluenceEnabled: () => boolean;
  /** Set ID for seed generation */
  setId: string;
  /** Random function for item shop (returns 0-1) */
  random: () => number;
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
        rarity: unit.cost as UnitRarity,
        cost: unit.cost,
      });
    }

    return offers;
  }

  /**
   * Build item shop offers
   * @param itemTypes Available item types
   * @param itemDefinitions Item definitions with costs
   * @returns Array of item shop offers
   */
  buildItemShopOffers(
    itemTypes: readonly ItemType[],
    itemDefinitions: Readonly<Record<ItemType, { cost: number }>>,
  ): ShopItemOffer[] {
    const offers: ShopItemOffer[] = [];

    for (let i = 0; i < ITEM_SHOP_SIZE; i++) {
      const randomIndex = Math.floor(this.deps.random() * itemTypes.length);
      const randomItem = itemTypes[randomIndex];

      if (!randomItem) {
        continue;
      }

      const itemDef = itemDefinitions[randomItem];
      offers.push({
        itemType: randomItem,
        cost: itemDef.cost,
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
   * @private
   */
  private buildSingleShopOffer(
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
    const rarity = this.deps.pickRarity(odds, rarityRoll);
    let unitPool = SHOP_UNIT_POOL_BY_RARITY[rarity];

    // 共有プールが有効な場合、枯渇したユニットを除外
    if (this.deps.isSharedPoolEnabled()) {
      unitPool = unitPool.filter(
        (unitType) => !this.deps.isPoolDepleted(UNIT_TYPE_TO_COST[unitType]),
      );

      // すべてのユニットが枯渇している場合は、代わりに低レアリティを試行
      if (unitPool.length === 0 && rarity > 1) {
        const lowerRarity = (rarity - 1) as UnitRarity;
        unitPool = SHOP_UNIT_POOL_BY_RARITY[lowerRarity].filter(
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
}
