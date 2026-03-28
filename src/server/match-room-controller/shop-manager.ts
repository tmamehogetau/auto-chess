import type { GameLoopState } from "../../domain/game-loop-state";
import type { BoardUnitPlacement, BoardUnitType } from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";
import { SharedPool } from "../shared-pool";
import {
  initializeShopsForPrep,
  refreshShopByCount,
  refreshShopsForPrep,
} from "./prep-economy";
import { calculateDiscountedShopOfferCost } from "./shop-cost-reduction";
import { resolveBattlePlacements, resolveSharedPoolCost } from "../unit-id-resolver";
import { calculateSynergyDetails, getTouhouFactionTierEffect } from "../combat/synergy-definitions";
import {
  STAR_LEVEL_MAX,
  STAR_LEVEL_MIN,
  STAR_MERGE_THRESHOLD,
  UNIT_SELL_VALUE_BY_TYPE,
} from "../star-level-config";

export interface ShopManagerShopOffer {
  unitType: BoardUnitType;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  starLevel?: number;
}

export interface ShopManagerBenchUnit {
  unitType: BoardUnitType;
  unitId?: string;
  cost: number;
  starLevel: number;
  unitCount: number;
}

export interface ShopManagerOwnedUnits {
  vanguard: number;
  ranger: number;
  mage: number;
  assassin: number;
}

export interface ShopManagerDeps<TBattleResult = unknown> {
  ensureStarted(): GameLoopState;
  buildShopOffers(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
    isRumorEligible: boolean,
  ): ShopManagerShopOffer[];
  buildBossShopOffers(): ShopManagerShopOffer[];
  buildReplacementOffer(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
  ): ShopManagerShopOffer;
  shopRefreshCountByPlayer: Map<string, number>;
  shopPurchaseCountByPlayer: Map<string, number>;
  shopLockedByPlayer: Map<string, boolean>;
  kouRyuudouFreeRefreshConsumedByPlayer: Map<string, boolean>;
  rumorInfluenceEligibleByPlayer: Map<string, boolean>;
  shopOffersByPlayer: Map<string, ShopManagerShopOffer[]>;
  bossShopOffersByPlayer: Map<string, ShopManagerShopOffer[]>;
  battleResultsByPlayer: Map<string, TBattleResult>;
  benchUnitsByPlayer: Map<string, ShopManagerBenchUnit[]>;
  boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
  boardUnitCountByPlayer: Map<string, number>;
  ownedUnitsByPlayer: Map<string, ShopManagerOwnedUnits>;
  goldByPlayer: Map<string, number>;
  enableRumorInfluence: boolean;
  enableBossExclusiveShop: boolean;
  enableSharedPool: boolean;
  sharedPool: SharedPool | null;
  rosterFlags: FeatureFlags;
  initialGold: number;
  maxBenchSize: number;
}

export class ShopManager<TBattleResult = unknown> {
  public constructor(
    private readonly deps: ShopManagerDeps<TBattleResult>,
  ) {}

  public initializeShopsForPrep(): void {
    const state = this.deps.ensureStarted();
    initializeShopsForPrep({
      playerIds: state.playerIds,
      roundIndex: state.roundIndex,
      isBossPlayer: (playerId) => state.isBoss(playerId),
      buildShopOffers: this.deps.buildShopOffers,
      buildBossShopOffers: this.deps.buildBossShopOffers,
      shopRefreshCountByPlayer: this.deps.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.deps.shopPurchaseCountByPlayer,
      shopLockedByPlayer: this.deps.shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.deps.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.deps.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.deps.shopOffersByPlayer,
      bossShopOffersByPlayer: this.deps.bossShopOffersByPlayer,
      enableRumorInfluence: this.deps.enableRumorInfluence,
      enableBossExclusiveShop: this.deps.enableBossExclusiveShop,
    });
  }

  public refreshShopsForPrep(): void {
    const state = this.deps.ensureStarted();
    refreshShopsForPrep({
      alivePlayerIds: state.alivePlayerIds,
      roundIndex: state.roundIndex,
      isBossPlayer: (playerId) => state.isBoss(playerId),
      buildShopOffers: this.deps.buildShopOffers,
      buildBossShopOffers: this.deps.buildBossShopOffers,
      shopRefreshCountByPlayer: this.deps.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.deps.shopPurchaseCountByPlayer,
      shopLockedByPlayer: this.deps.shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.deps.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.deps.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.deps.shopOffersByPlayer,
      bossShopOffersByPlayer: this.deps.bossShopOffersByPlayer,
      battleResultsByPlayer: this.deps.battleResultsByPlayer,
      enableRumorInfluence: this.deps.enableRumorInfluence,
      enableBossExclusiveShop: this.deps.enableBossExclusiveShop,
    });
  }

  public refreshShopByCount(playerId: string, refreshCount: number): void {
    const state = this.deps.ensureStarted();
    refreshShopByCount({
      playerId,
      roundIndex: state.roundIndex,
      refreshCount,
      buildShopOffers: this.deps.buildShopOffers,
      shopRefreshCountByPlayer: this.deps.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.deps.shopPurchaseCountByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.deps.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.deps.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.deps.shopOffersByPlayer,
      enableRumorInfluence: this.deps.enableRumorInfluence,
      getAvailableFreeRefreshes: (targetPlayerId) =>
        this.getAvailableKouRyuudouFreeRefreshes(targetPlayerId),
    });
  }

  public buyShopOfferBySlot(playerId: string, slotIndex: number): void {
    const state = this.deps.ensureStarted();
    const offers = [...(this.deps.shopOffersByPlayer.get(playerId) ?? [])];
    const refreshCount = this.deps.shopRefreshCountByPlayer.get(playerId) ?? 0;
    const purchaseCount = (this.deps.shopPurchaseCountByPlayer.get(playerId) ?? 0) + 1;
    const ownedUnits = this.deps.ownedUnitsByPlayer.get(playerId);

    if (!offers[slotIndex] || !ownedUnits) {
      return;
    }

    const boughtOffer = offers[slotIndex];
    if (!boughtOffer) {
      return;
    }

    this.decreaseSharedPoolForOffer(boughtOffer);

    offers.splice(slotIndex, 1);
    offers.push(
      this.deps.buildReplacementOffer(
        playerId,
        state.roundIndex,
        refreshCount,
        purchaseCount,
      ),
    );

    this.deps.shopPurchaseCountByPlayer.set(playerId, purchaseCount);
    this.deps.shopOffersByPlayer.set(playerId, offers);

    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = this.deps.boardPlacementsByPlayer.get(playerId) ?? [];
    const purchasedUnitCost = calculateDiscountedShopOfferCost(
      boughtOffer,
      boardPlacements,
      this.deps.rosterFlags,
    );

    const purchasedBenchUnit: ShopManagerBenchUnit = {
      unitType: boughtOffer.unitType,
      cost: purchasedUnitCost,
      starLevel: STAR_LEVEL_MIN,
      unitCount: 1,
    };

    if (boughtOffer.unitId !== undefined) {
      purchasedBenchUnit.unitId = boughtOffer.unitId;
    }

    benchUnits.push(purchasedBenchUnit);
    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    this.tryMergeBenchUnits(playerId);

    const nextOwnedUnits: ShopManagerOwnedUnits = {
      vanguard: ownedUnits.vanguard,
      ranger: ownedUnits.ranger,
      mage: ownedUnits.mage,
      assassin: ownedUnits.assassin,
    };
    nextOwnedUnits[boughtOffer.unitType] += 1;
    this.deps.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
  }

  public buyBossShopOffer(playerId: string, slotIndex: number): void {
    const bossOffers = this.deps.bossShopOffersByPlayer.get(playerId) ?? [];
    const benchUnits = this.deps.benchUnitsByPlayer.get(playerId) ?? [];
    if (slotIndex >= bossOffers.length) {
      return;
    }

    const bossOffer = bossOffers[slotIndex];
    if (!bossOffer || bossOffer.purchased) {
      return;
    }

    const benchUnit: ShopManagerBenchUnit = {
      unitType: bossOffer.unitType,
      cost: bossOffer.cost,
      starLevel: bossOffer.starLevel ?? STAR_LEVEL_MIN,
      unitCount: 1,
    };
    if (bossOffer.unitId !== undefined) {
      benchUnit.unitId = bossOffer.unitId;
    }

    benchUnits.push(benchUnit);
    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    bossOffer.purchased = true;
  }

  public deployBenchUnitToBoard(playerId: string, benchIndex: number, cell: number): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
    const benchUnit = benchUnits[benchIndex];

    if (!benchUnit || boardPlacements.length >= 8) {
      return;
    }

    benchUnits.splice(benchIndex, 1);
    const boardPlacement: BoardUnitPlacement = {
      cell,
      unitType: benchUnit.unitType,
      starLevel: benchUnit.starLevel,
      sellValue: benchUnit.cost,
      unitCount: benchUnit.unitCount,
    };
    if (benchUnit.unitId !== undefined) {
      boardPlacement.unitId = benchUnit.unitId;
    }

    boardPlacements.push(boardPlacement);
    boardPlacements.sort((left, right) => left.cell - right.cell);

    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.deps.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
  }

  public returnBoardUnitToBench(playerId: string, cell: number): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);

    if (targetIndex < 0 || benchUnits.length >= this.deps.maxBenchSize) {
      return;
    }

    const returnedPlacement = boardPlacements[targetIndex];
    if (!returnedPlacement) {
      return;
    }

    boardPlacements.splice(targetIndex, 1);
    const benchUnit: ShopManagerBenchUnit = {
      unitType: returnedPlacement.unitType,
      cost: returnedPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[returnedPlacement.unitType] ?? 1,
      starLevel: returnedPlacement.starLevel ?? STAR_LEVEL_MIN,
      unitCount: returnedPlacement.unitCount ?? returnedPlacement.starLevel ?? 1,
    };
    if (returnedPlacement.unitId !== undefined) {
      benchUnit.unitId = returnedPlacement.unitId;
    }

    benchUnits.push(benchUnit);
    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.deps.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
  }

  public sellBenchUnit(playerId: string, benchIndex: number): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const benchUnit = benchUnits[benchIndex];
    const currentGold = this.deps.goldByPlayer.get(playerId) ?? this.deps.initialGold;
    const ownedUnits = this.deps.ownedUnitsByPlayer.get(playerId);

    if (!benchUnit || !ownedUnits) {
      return;
    }

    benchUnits.splice(benchIndex, 1);

    const nextOwnedUnits: ShopManagerOwnedUnits = {
      vanguard: ownedUnits.vanguard,
      ranger: ownedUnits.ranger,
      mage: ownedUnits.mage,
      assassin: ownedUnits.assassin,
    };
    nextOwnedUnits[benchUnit.unitType] = Math.max(
      0,
      nextOwnedUnits[benchUnit.unitType] - benchUnit.unitCount,
    );

    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    this.deps.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
    this.deps.goldByPlayer.set(playerId, currentGold + benchUnit.cost);
    this.increaseSharedPoolForUnit(benchUnit.unitId, benchUnit.cost, benchUnit.unitCount);
  }

  public sellBoardUnit(playerId: string, cell: number): void {
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);
    const currentGold = this.deps.goldByPlayer.get(playerId) ?? this.deps.initialGold;
    const ownedUnits = this.deps.ownedUnitsByPlayer.get(playerId);

    if (targetIndex < 0 || !ownedUnits) {
      return;
    }

    const soldPlacement = boardPlacements[targetIndex];
    if (!soldPlacement) {
      return;
    }

    boardPlacements.splice(targetIndex, 1);
    const nextOwnedUnits: ShopManagerOwnedUnits = {
      vanguard: ownedUnits.vanguard,
      ranger: ownedUnits.ranger,
      mage: ownedUnits.mage,
      assassin: ownedUnits.assassin,
    };

    const unitCount = soldPlacement.unitCount ?? soldPlacement.starLevel ?? 1;
    nextOwnedUnits[soldPlacement.unitType] = Math.max(
      0,
      nextOwnedUnits[soldPlacement.unitType] - unitCount,
    );

    const sellValue = soldPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[soldPlacement.unitType] ?? 1;

    this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.deps.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
    this.deps.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
    this.deps.goldByPlayer.set(playerId, currentGold + sellValue);
    this.increaseSharedPoolForUnit(soldPlacement.unitId, sellValue, unitCount);
  }

  public getShopRefreshGoldCost(playerId: string, refreshCount: number): number {
    if (refreshCount <= 0) {
      return 0;
    }

    const freeRefreshes = this.getAvailableKouRyuudouFreeRefreshes(playerId);
    const paidRefreshCount = Math.max(0, refreshCount - freeRefreshes);
    return paidRefreshCount * 2;
  }

  public releasePlayerInventoryToSharedPool(playerId: string): void {
    const boardPlacements = this.deps.boardPlacementsByPlayer.get(playerId) ?? [];
    const benchUnits = this.deps.benchUnitsByPlayer.get(playerId) ?? [];

    if (!this.deps.enableSharedPool || !this.deps.sharedPool) {
      return;
    }

    for (const placement of boardPlacements) {
      const unitCost = placement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[placement.unitType] ?? 1;
      const unitCount = placement.unitCount ?? placement.starLevel ?? 1;
      this.increaseSharedPoolForUnit(placement.unitId, unitCost, unitCount);
    }

    for (const benchUnit of benchUnits) {
      this.increaseSharedPoolForUnit(benchUnit.unitId, benchUnit.cost, benchUnit.unitCount);
    }
  }

  private tryMergeBenchUnits(playerId: string): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    let mergedAny = true;

    while (mergedAny) {
      mergedAny = false;

      for (const unitType of ["vanguard", "ranger", "mage", "assassin"] as const) {
        for (const starLevel of [STAR_LEVEL_MIN, STAR_LEVEL_MAX - 1] as const) {
          const mergeKeys = new Set(
            benchUnits
              .filter((unit) => unit.unitType === unitType && unit.starLevel === starLevel)
              .map((unit) => unit.unitId ?? ""),
          );

          for (const mergeUnitId of mergeKeys) {
            const mergeCandidates: number[] = [];

            for (let index = 0; index < benchUnits.length; index += 1) {
              const unit = benchUnits[index];
              if (
                !unit ||
                unit.unitType !== unitType ||
                unit.starLevel !== starLevel ||
                (unit.unitId ?? "") !== mergeUnitId
              ) {
                continue;
              }
              mergeCandidates.push(index);
            }

            if (mergeCandidates.length < STAR_MERGE_THRESHOLD) {
              continue;
            }

            const consumedIndexes = mergeCandidates
              .slice(0, STAR_MERGE_THRESHOLD)
              .sort((left, right) => right - left);
            let mergedCost = 0;
            let mergedCount = 0;

            for (const index of consumedIndexes) {
              const unit = benchUnits[index];
              if (!unit) {
                continue;
              }
              mergedCost += unit.cost;
              mergedCount += unit.unitCount;
              benchUnits.splice(index, 1);
            }

            const mergedBenchUnit: ShopManagerBenchUnit = {
              unitType,
              cost: mergedCost,
              starLevel: starLevel + 1,
              unitCount: mergedCount,
            };
            if (mergeUnitId !== "") {
              mergedBenchUnit.unitId = mergeUnitId;
            }

            benchUnits.push(mergedBenchUnit);
            mergedAny = true;
          }
        }
      }
    }

    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
  }

  private decreaseSharedPoolForOffer(offer: ShopManagerShopOffer): void {
    if (!this.deps.enableSharedPool || !this.deps.sharedPool) {
      return;
    }

    if (this.deps.rosterFlags.enablePerUnitSharedPool && offer.unitId) {
      this.deps.sharedPool.decreaseByUnitId(offer.unitId, offer.cost);
      return;
    }

    this.deps.sharedPool.decrease(offer.cost);
  }

  private increaseSharedPoolForUnit(unitId: string | undefined, cost: number, count: number): void {
    if (!this.deps.enableSharedPool || !this.deps.sharedPool) {
      return;
    }

    const resolvedPoolCost = resolveSharedPoolCost(unitId, cost, this.deps.rosterFlags);
    for (let index = 0; index < count; index += 1) {
      if (this.deps.rosterFlags.enablePerUnitSharedPool && unitId) {
        this.deps.sharedPool.increaseByUnitId(unitId, resolvedPoolCost);
      } else {
        this.deps.sharedPool.increase(resolvedPoolCost);
      }
    }
  }

  private getAvailableKouRyuudouFreeRefreshes(playerId: string): number {
    if (!this.deps.rosterFlags.enableTouhouFactions) {
      return 0;
    }

    if (this.deps.kouRyuudouFreeRefreshConsumedByPlayer.get(playerId)) {
      return 0;
    }

    const placements = this.deps.boardPlacementsByPlayer.get(playerId) ?? [];
    const resolvedPlacements = resolveBattlePlacements(placements, this.deps.rosterFlags);
    const synergyDetails = calculateSynergyDetails(
      resolvedPlacements,
      null,
      { enableTouhouFactions: true },
    );
    const tier = synergyDetails.factionActiveTiers.kou_ryuudou ?? 0;
    const factionEffect = getTouhouFactionTierEffect("kou_ryuudou", tier);
    return factionEffect?.special?.firstFreeRefreshes ?? 0;
  }
}
