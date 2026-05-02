import type { GameLoopState } from "../../domain/game-loop-state";
import type {
  AttachedSubUnitPlacement,
  BoardUnitPlacement,
  BoardUnitType,
} from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";
import { SharedPool } from "../shared-pool";
import {
  initializeShopsForPrep,
  refreshShopByCount,
  refreshShopsForPrep,
} from "./prep-economy";
import { isHeroExclusiveUnitId } from "../../data/hero-exclusive-units";
import { calculateDiscountedShopOfferCost } from "./shop-cost-reduction";
import { resolveBattlePlacements, resolveSharedPoolCost } from "../unit-id-resolver";
import { calculateSynergyDetails, getTouhouFactionTierEffect } from "../combat/synergy-definitions";
import { getTouhouLevelUpGoldBonuses } from "../touhou-economy-effects";
import {
  calculateSellValue,
  getMinimumPurchaseCountForUnitLevel,
  getUnitLevelForPurchaseCount,
  UNIT_LEVEL_MIN,
  UNIT_SELL_VALUE_BY_TYPE,
} from "../unit-level-config";

export interface ShopManagerShopOffer {
  unitType: BoardUnitType;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  unitLevel?: number;
}

export interface ShopManagerBenchUnit {
  unitType: BoardUnitType;
  unitId?: string;
  cost: number;
  unitLevel?: number;
  unitCount: number;
}

export interface ShopManagerOwnedUnits {
  vanguard: number;
  ranger: number;
  mage: number;
  assassin: number;
}

export type TouhouLevelUpGoldBonusClaimKey = string;

interface InventoryUpgradeResult {
  previousUnitLevel: number;
  nextUnitLevel: number;
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
  touhouBonusFreeRefreshCountByPlayer: Map<string, number>;
  touhouLevelUpGoldBonusClaimKeysByPlayer: Map<string, Set<TouhouLevelUpGoldBonusClaimKey>>;
  rumorInfluenceEligibleByPlayer: Map<string, boolean>;
  shopOffersByPlayer: Map<string, ShopManagerShopOffer[]>;
  bossShopOffersByPlayer: Map<string, ShopManagerShopOffer[]>;
  heroExclusiveShopOffersByPlayer: Map<string, ShopManagerShopOffer[]>;
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
  getMaxBoardUnitCount(playerId: string): number;
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
      consumeFreeRefreshes: (targetPlayerId, refreshCount) =>
        this.consumeAvailableKouRyuudouFreeRefreshes(targetPlayerId, refreshCount),
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
      unitLevel: UNIT_LEVEL_MIN,
      unitCount: 1,
    };

    if (boughtOffer.unitId !== undefined) {
      purchasedBenchUnit.unitId = boughtOffer.unitId;
    }

    if (
      benchUnits.length >= this.deps.maxBenchSize
      && !this.wouldPurchasedUnitMergeIntoInventory(playerId, purchasedBenchUnit)
    ) {
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

    const upgradeResult = this.addPurchasedUnitToInventory(playerId, purchasedBenchUnit);
    this.grantTouhouEconomyGoldBonuses(playerId, boughtOffer.unitId, upgradeResult);

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
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
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
      unitLevel: bossOffer.unitLevel ?? UNIT_LEVEL_MIN,
      unitCount: 1,
    };
    if (bossOffer.unitId !== undefined) {
      benchUnit.unitId = bossOffer.unitId;
    }

    if (
      benchUnits.length >= this.deps.maxBenchSize
      && !this.wouldPurchasedUnitMergeIntoInventory(playerId, benchUnit)
    ) {
      return;
    }

    this.addPurchasedUnitToInventory(playerId, benchUnit);
    bossOffers[slotIndex] = normalizePurchasedOffer(bossOffer, true);
    this.deps.bossShopOffersByPlayer.set(playerId, bossOffers);
  }

  public buyHeroExclusiveShopOffer(playerId: string, slotIndex: number): void {
    const heroExclusiveOffers = this.deps.heroExclusiveShopOffersByPlayer.get(playerId) ?? [];
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    if (slotIndex >= heroExclusiveOffers.length) {
      return;
    }

    const heroExclusiveOffer = heroExclusiveOffers[slotIndex];
    if (!heroExclusiveOffer || heroExclusiveOffer.purchased) {
      return;
    }

    const benchUnit: ShopManagerBenchUnit = {
      unitType: heroExclusiveOffer.unitType,
      cost: heroExclusiveOffer.cost,
      unitLevel: heroExclusiveOffer.unitLevel ?? UNIT_LEVEL_MIN,
      unitCount: 1,
    };
    if (heroExclusiveOffer.unitId !== undefined) {
      benchUnit.unitId = heroExclusiveOffer.unitId;
    }

    if (
      benchUnits.length >= this.deps.maxBenchSize
      && !this.wouldPurchasedUnitMergeIntoInventory(playerId, benchUnit)
    ) {
      return;
    }

    this.addPurchasedUnitToInventory(playerId, benchUnit);
    heroExclusiveOffers[slotIndex] = normalizePurchasedOffer(heroExclusiveOffer, true);
    this.deps.heroExclusiveShopOffersByPlayer.set(playerId, heroExclusiveOffers);
  }

  public deployBenchUnitToBoard(playerId: string, benchIndex: number, cell: number, slot: "main" | "sub" = "main"): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
    const benchUnit = benchUnits[benchIndex];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);
    const maxBoardUnitCount = this.deps.getMaxBoardUnitCount(playerId);

    if (!benchUnit || (boardPlacements.length >= maxBoardUnitCount && targetIndex < 0)) {
      return;
    }

    if (slot === "sub") {
      const hostPlacement = targetIndex >= 0 ? boardPlacements[targetIndex] : null;
      if (!hostPlacement) {
        return;
      }

      const attachedSubUnit: NonNullable<BoardUnitPlacement["subUnit"]> = {
        unitType: benchUnit.unitType,
        unitLevel: benchUnit.unitLevel ?? UNIT_LEVEL_MIN,
        sellValue: benchUnit.cost,
        unitCount: benchUnit.unitCount,
      };
      if (benchUnit.unitId !== undefined) {
        attachedSubUnit.unitId = benchUnit.unitId;
      }

      benchUnits.splice(benchIndex, 1);

      if (hostPlacement.subUnit) {
        const replacedSubUnit: ShopManagerBenchUnit = {
          unitType: hostPlacement.subUnit.unitType,
          cost: hostPlacement.subUnit.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[hostPlacement.subUnit.unitType] ?? 1,
          unitLevel: hostPlacement.subUnit.unitLevel ?? UNIT_LEVEL_MIN,
          unitCount: this.getTrackedPurchaseCount(
            hostPlacement.subUnit.unitLevel,
            hostPlacement.subUnit.unitCount,
          ),
        };
        if (hostPlacement.subUnit.unitId !== undefined) {
          replacedSubUnit.unitId = hostPlacement.subUnit.unitId;
        }
        benchUnits.push(replacedSubUnit);
      }

      hostPlacement.subUnit = attachedSubUnit;
      this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
      this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
      this.deps.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
      return;
    }

    const boardPlacement: BoardUnitPlacement = {
      cell,
      unitType: benchUnit.unitType,
      unitLevel: benchUnit.unitLevel ?? UNIT_LEVEL_MIN,
      sellValue: benchUnit.cost,
      unitCount: benchUnit.unitCount,
    };
    if (benchUnit.unitId !== undefined) {
      boardPlacement.unitId = benchUnit.unitId;
    }

    if (targetIndex >= 0) {
      const replacedPlacement = boardPlacements[targetIndex];
      if (!replacedPlacement || replacedPlacement.subUnit) {
        return;
      }

      benchUnits.splice(benchIndex, 1);

      const swappedBenchUnit: ShopManagerBenchUnit = {
        unitType: replacedPlacement.unitType,
        cost: replacedPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[replacedPlacement.unitType] ?? 1,
        unitLevel: replacedPlacement.unitLevel ?? UNIT_LEVEL_MIN,
        unitCount: this.getTrackedPurchaseCount(
          replacedPlacement.unitLevel,
          replacedPlacement.unitCount,
        ),
      };
      if (replacedPlacement.unitId !== undefined) {
        swappedBenchUnit.unitId = replacedPlacement.unitId;
      }

      boardPlacements[targetIndex] = boardPlacement;
      benchUnits.push(swappedBenchUnit);
    } else {
      benchUnits.splice(benchIndex, 1);
      boardPlacements.push(boardPlacement);
    }
    boardPlacements.sort((left, right) => left.cell - right.cell);

    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.deps.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
  }

  public returnBoardUnitToBench(playerId: string, cell: number): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);

    const requiredBenchSlots = boardPlacements[targetIndex]?.subUnit ? 2 : 1;

    if (targetIndex < 0 || benchUnits.length + requiredBenchSlots > this.deps.maxBenchSize) {
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
      unitLevel: returnedPlacement.unitLevel ?? UNIT_LEVEL_MIN,
      unitCount: this.getTrackedPurchaseCount(returnedPlacement.unitLevel, returnedPlacement.unitCount),
    };
    if (returnedPlacement.unitId !== undefined) {
      benchUnit.unitId = returnedPlacement.unitId;
    }

    benchUnits.push(benchUnit);

    if (returnedPlacement.subUnit) {
      const detachedSubUnit: ShopManagerBenchUnit = {
        unitType: returnedPlacement.subUnit.unitType,
        cost: returnedPlacement.subUnit.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[returnedPlacement.subUnit.unitType] ?? 1,
        unitLevel: returnedPlacement.subUnit.unitLevel ?? UNIT_LEVEL_MIN,
        unitCount: this.getTrackedPurchaseCount(
          returnedPlacement.subUnit.unitLevel,
          returnedPlacement.subUnit.unitCount,
        ),
      };

      if (returnedPlacement.subUnit.unitId !== undefined) {
        detachedSubUnit.unitId = returnedPlacement.subUnit.unitId;
      }

      benchUnits.push(detachedSubUnit);
    }

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
    const sellValue = calculateSellValue(
      benchUnit.cost,
      benchUnit.unitType,
      benchUnit.unitLevel,
      benchUnit.unitCount,
    );
    this.deps.goldByPlayer.set(playerId, currentGold + sellValue);
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

    const soldSettlements = [
      this.buildPlacementSettlement(soldPlacement),
      ...(soldPlacement.subUnit ? [this.buildPlacementSettlement(soldPlacement.subUnit)] : []),
    ];

    for (const settlement of soldSettlements) {
      nextOwnedUnits[settlement.unitType] = Math.max(
        0,
        nextOwnedUnits[settlement.unitType] - settlement.unitCount,
      );
    }

    const sellValue = soldSettlements.reduce((total, settlement) => total + settlement.sellValue, 0);

    this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.deps.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
    this.deps.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
    this.deps.goldByPlayer.set(playerId, currentGold + sellValue);
    for (const settlement of soldSettlements) {
      this.increaseSharedPoolForUnit(settlement.unitId, settlement.paidCost, settlement.unitCount);
    }
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
      const mainSettlement = this.buildPlacementSettlement(placement);
      this.increaseSharedPoolForUnit(mainSettlement.unitId, mainSettlement.paidCost, mainSettlement.unitCount);
      if (placement.subUnit) {
        const subSettlement = this.buildPlacementSettlement(placement.subUnit);
        this.increaseSharedPoolForUnit(subSettlement.unitId, subSettlement.paidCost, subSettlement.unitCount);
      }
    }

    for (const benchUnit of benchUnits) {
      this.increaseSharedPoolForUnit(benchUnit.unitId, benchUnit.cost, benchUnit.unitCount);
    }
  }

  private addPurchasedUnitToInventory(
    playerId: string,
    purchasedUnit: ShopManagerBenchUnit,
  ): InventoryUpgradeResult {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];

    const matchingBenchIndex = this.findUpgradeableBenchUnitIndex(benchUnits, purchasedUnit);
    if (matchingBenchIndex >= 0) {
      const targetBenchUnit = benchUnits[matchingBenchIndex];
      if (targetBenchUnit) {
        const upgradeResult = this.applyPurchasedUnitToBenchUnit(targetBenchUnit, purchasedUnit);
        this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
        return upgradeResult;
      }
      return { previousUnitLevel: UNIT_LEVEL_MIN, nextUnitLevel: UNIT_LEVEL_MIN };
    }

    const matchingBoardIndex = this.findUpgradeableBoardPlacementIndex(boardPlacements, purchasedUnit);
    if (matchingBoardIndex >= 0) {
      const targetPlacement = boardPlacements[matchingBoardIndex];
      if (targetPlacement) {
        const upgradeResult = this.applyPurchasedUnitToBoardPlacement(targetPlacement, purchasedUnit);
        this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
        return upgradeResult;
      }
      return { previousUnitLevel: UNIT_LEVEL_MIN, nextUnitLevel: UNIT_LEVEL_MIN };
    }

    const matchingSubUnitLocation = this.findUpgradeableAttachedSubUnitLocation(boardPlacements, purchasedUnit);
    if (matchingSubUnitLocation) {
      const upgradeResult = this.applyPurchasedUnitToAttachedSubUnit(matchingSubUnitLocation, purchasedUnit);
      this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
      return upgradeResult;
    }

    benchUnits.push(purchasedUnit);
    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
    return {
      previousUnitLevel: 0,
      nextUnitLevel: purchasedUnit.unitLevel ?? UNIT_LEVEL_MIN,
    };
  }

  private wouldPurchasedUnitMergeIntoInventory(playerId: string, purchasedUnit: ShopManagerBenchUnit): boolean {
    const benchUnits = this.deps.benchUnitsByPlayer.get(playerId) ?? [];
    const boardPlacements = this.deps.boardPlacementsByPlayer.get(playerId) ?? [];

    return this.findUpgradeableBenchUnitIndex(benchUnits, purchasedUnit) >= 0
      || this.findUpgradeableBoardPlacementIndex(boardPlacements, purchasedUnit) >= 0
      || this.findUpgradeableAttachedSubUnitLocation(boardPlacements, purchasedUnit) !== null;
  }

  private findUpgradeableBenchUnitIndex(
    benchUnits: ShopManagerBenchUnit[],
    purchasedUnit: ShopManagerBenchUnit,
  ): number {
    return benchUnits.findIndex((unit) => this.isSameUpgradeTrack(unit, purchasedUnit));
  }

  private findUpgradeableBoardPlacementIndex(
    boardPlacements: BoardUnitPlacement[],
    purchasedUnit: ShopManagerBenchUnit,
  ): number {
    return boardPlacements.findIndex((placement) => this.isSameUpgradeTrack(placement, purchasedUnit));
  }

  private findUpgradeableAttachedSubUnitLocation(
    boardPlacements: BoardUnitPlacement[],
    purchasedUnit: ShopManagerBenchUnit,
  ): AttachedSubUnitPlacement | null {
    for (const placement of boardPlacements) {
      if (placement.subUnit && this.isSameUpgradeTrack(placement.subUnit, purchasedUnit)) {
        return placement.subUnit;
      }
    }

    return null;
  }

  private isSameUpgradeTrack(
    unit: Pick<ShopManagerBenchUnit, "unitType" | "unitId"> | Pick<BoardUnitPlacement, "unitType" | "unitId">,
    purchasedUnit: Pick<ShopManagerBenchUnit, "unitType" | "unitId">,
  ): boolean {
    return unit.unitType === purchasedUnit.unitType && (unit.unitId ?? "") === (purchasedUnit.unitId ?? "");
  }

  private applyPurchasedUnitToBenchUnit(
    targetUnit: ShopManagerBenchUnit,
    purchasedUnit: ShopManagerBenchUnit,
  ): InventoryUpgradeResult {
    const previousUnitLevel = targetUnit.unitLevel ?? UNIT_LEVEL_MIN;
    const nextPurchaseCount = this.getTrackedPurchaseCount(targetUnit.unitLevel, targetUnit.unitCount) + purchasedUnit.unitCount;
    targetUnit.cost += purchasedUnit.cost;
    targetUnit.unitCount = nextPurchaseCount;
    targetUnit.unitLevel = getUnitLevelForPurchaseCount(nextPurchaseCount);
    return { previousUnitLevel, nextUnitLevel: targetUnit.unitLevel };
  }

  private applyPurchasedUnitToBoardPlacement(
    targetPlacement: BoardUnitPlacement,
    purchasedUnit: ShopManagerBenchUnit,
  ): InventoryUpgradeResult {
    const previousUnitLevel = targetPlacement.unitLevel ?? UNIT_LEVEL_MIN;
    const nextPurchaseCount = this.getTrackedPurchaseCount(targetPlacement.unitLevel, targetPlacement.unitCount) + purchasedUnit.unitCount;
    const currentSellValue = targetPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[targetPlacement.unitType] ?? 1;
    targetPlacement.sellValue = currentSellValue + purchasedUnit.cost;
    targetPlacement.unitCount = nextPurchaseCount;
    targetPlacement.unitLevel = getUnitLevelForPurchaseCount(nextPurchaseCount);
    return { previousUnitLevel, nextUnitLevel: targetPlacement.unitLevel };
  }

  private applyPurchasedUnitToAttachedSubUnit(
    targetSubUnit: AttachedSubUnitPlacement,
    purchasedUnit: ShopManagerBenchUnit,
  ): InventoryUpgradeResult {
    const previousUnitLevel = targetSubUnit.unitLevel ?? UNIT_LEVEL_MIN;
    const nextPurchaseCount = this.getTrackedPurchaseCount(targetSubUnit.unitLevel, targetSubUnit.unitCount) + purchasedUnit.unitCount;
    const currentSellValue = targetSubUnit.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[targetSubUnit.unitType] ?? 1;
    targetSubUnit.sellValue = currentSellValue + purchasedUnit.cost;
    targetSubUnit.unitCount = nextPurchaseCount;
    targetSubUnit.unitLevel = getUnitLevelForPurchaseCount(nextPurchaseCount);
    return { previousUnitLevel, nextUnitLevel: targetSubUnit.unitLevel };
  }

  private grantTouhouEconomyGoldBonuses(
    playerId: string,
    unitId: string | undefined,
    upgradeResult: InventoryUpgradeResult,
  ): void {
    const totalGoldBonus = this.claimTouhouLevelUpGoldBonus(playerId, unitId, upgradeResult);
    if (totalGoldBonus <= 0) {
      return;
    }

    const currentGold = this.deps.goldByPlayer.get(playerId) ?? this.deps.initialGold;
    this.deps.goldByPlayer.set(playerId, currentGold + totalGoldBonus);
  }

  private claimTouhouLevelUpGoldBonus(
    playerId: string,
    unitId: string | undefined,
    upgradeResult: InventoryUpgradeResult,
  ): number {
    const bonuses = getTouhouLevelUpGoldBonuses(
      unitId,
      upgradeResult.previousUnitLevel,
      upgradeResult.nextUnitLevel,
      this.deps.rosterFlags,
    );
    if (unitId === undefined || bonuses.length === 0) {
      return 0;
    }

    const claimedKeys = this.getTouhouLevelUpGoldBonusClaimKeys(playerId);
    let totalGoldBonus = 0;
    for (const bonus of bonuses) {
      const claimKey = `${unitId}:${bonus.unitLevel}`;
      if (claimedKeys.has(claimKey)) {
        continue;
      }

      claimedKeys.add(claimKey);
      totalGoldBonus += bonus.gold;
      this.addTouhouBonusFreeRefreshes(playerId, bonus.freeRefreshes);
    }

    return totalGoldBonus;
  }

  private getTouhouLevelUpGoldBonusClaimKeys(playerId: string): Set<TouhouLevelUpGoldBonusClaimKey> {
    const existing = this.deps.touhouLevelUpGoldBonusClaimKeysByPlayer.get(playerId);
    if (existing) {
      return existing;
    }

    const claimKeys = new Set<TouhouLevelUpGoldBonusClaimKey>();
    this.deps.touhouLevelUpGoldBonusClaimKeysByPlayer.set(playerId, claimKeys);
    return claimKeys;
  }

  private addTouhouBonusFreeRefreshes(playerId: string, freeRefreshes: number): void {
    if (freeRefreshes <= 0) {
      return;
    }

    const currentCount = this.deps.touhouBonusFreeRefreshCountByPlayer.get(playerId) ?? 0;
    this.deps.touhouBonusFreeRefreshCountByPlayer.set(playerId, currentCount + freeRefreshes);
  }

  private getTrackedPurchaseCount(unitLevel: number | undefined, unitCount: number | undefined): number {
    if (unitCount !== undefined && Number.isInteger(unitCount) && unitCount > 0) {
      return unitCount;
    }

    return getMinimumPurchaseCountForUnitLevel(unitLevel ?? UNIT_LEVEL_MIN);
  }

  private buildPlacementSettlement(
    placement: Pick<BoardUnitPlacement, "unitType" | "unitId" | "sellValue" | "unitLevel" | "unitCount">
      | Pick<AttachedSubUnitPlacement, "unitType" | "unitId" | "sellValue" | "unitLevel" | "unitCount">,
  ): { unitType: BoardUnitType; unitId?: string; unitCount: number; paidCost: number; sellValue: number } {
    const unitCount = this.getTrackedPurchaseCount(placement.unitLevel, placement.unitCount);
    const paidCost = placement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[placement.unitType] ?? 1;

    return {
      unitType: placement.unitType,
      unitCount,
      paidCost,
      sellValue: calculateSellValue(
        paidCost,
        placement.unitType,
        placement.unitLevel ?? UNIT_LEVEL_MIN,
        unitCount,
      ),
      ...(placement.unitId !== undefined ? { unitId: placement.unitId } : {}),
    };
  }

  private decreaseSharedPoolForOffer(offer: ShopManagerShopOffer): void {
    if (!this.deps.enableSharedPool || !this.deps.sharedPool) {
      return;
    }

    if (offer.unitId && isHeroExclusiveUnitId(offer.unitId)) {
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

    if (unitId && isHeroExclusiveUnitId(unitId)) {
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
    const bonusFreeRefreshes = this.deps.touhouBonusFreeRefreshCountByPlayer.get(playerId) ?? 0;
    if (!this.deps.rosterFlags.enableTouhouFactions) {
      return bonusFreeRefreshes;
    }

    if (this.deps.kouRyuudouFreeRefreshConsumedByPlayer.get(playerId)) {
      return bonusFreeRefreshes;
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
    return bonusFreeRefreshes + (factionEffect?.special?.firstFreeRefreshes ?? 0);
  }

  private consumeAvailableKouRyuudouFreeRefreshes(playerId: string, refreshCount: number): void {
    let remainingRefreshes = Math.max(0, refreshCount);
    const bonusFreeRefreshes = this.deps.touhouBonusFreeRefreshCountByPlayer.get(playerId) ?? 0;
    const consumedBonusRefreshes = Math.min(bonusFreeRefreshes, remainingRefreshes);
    if (consumedBonusRefreshes > 0) {
      this.deps.touhouBonusFreeRefreshCountByPlayer.set(
        playerId,
        bonusFreeRefreshes - consumedBonusRefreshes,
      );
      remainingRefreshes -= consumedBonusRefreshes;
    }

    if (remainingRefreshes > 0 && this.hasAvailableFactionFreeRefresh(playerId)) {
      this.deps.kouRyuudouFreeRefreshConsumedByPlayer.set(playerId, true);
    }
  }

  private hasAvailableFactionFreeRefresh(playerId: string): boolean {
    if (!this.deps.rosterFlags.enableTouhouFactions) {
      return false;
    }

    if (this.deps.kouRyuudouFreeRefreshConsumedByPlayer.get(playerId)) {
      return false;
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
    return (factionEffect?.special?.firstFreeRefreshes ?? 0) > 0;
  }
}

function normalizePurchasedOffer(
  offer: ShopManagerShopOffer,
  purchased: boolean,
): ShopManagerShopOffer {
  return {
    unitType: offer.unitType,
    rarity: offer.rarity,
    cost: offer.cost,
    unitLevel: offer.unitLevel ?? UNIT_LEVEL_MIN,
    purchased,
    ...(offer.unitId !== undefined ? { unitId: offer.unitId } : {}),
    ...(offer.displayName !== undefined ? { displayName: offer.displayName } : {}),
    ...(offer.factionId !== undefined ? { factionId: offer.factionId } : {}),
    ...(offer.isRumorUnit !== undefined ? { isRumorUnit: offer.isRumorUnit } : {}),
  };
}
