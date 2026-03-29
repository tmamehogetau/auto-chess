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
import { calculateDiscountedShopOfferCost } from "./shop-cost-reduction";
import { resolveBattlePlacements, resolveSharedPoolCost } from "../unit-id-resolver";
import { calculateSynergyDetails, getTouhouFactionTierEffect } from "../combat/synergy-definitions";
import {
  calculateSellValue,
  getMinimumPurchaseCountForTier,
  getUpgradeTierForPurchaseCount,
  STAR_LEVEL_MIN,
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

    this.addPurchasedUnitToInventory(playerId, purchasedBenchUnit);

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
      starLevel: bossOffer.starLevel ?? STAR_LEVEL_MIN,
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
    bossOffer.purchased = true;
  }

  public deployBenchUnitToBoard(playerId: string, benchIndex: number, cell: number, slot: "main" | "sub" = "main"): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
    const benchUnit = benchUnits[benchIndex];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);

    if (!benchUnit || (boardPlacements.length >= 8 && targetIndex < 0)) {
      return;
    }

    if (slot === "sub") {
      const hostPlacement = targetIndex >= 0 ? boardPlacements[targetIndex] : null;
      if (!hostPlacement) {
        return;
      }

      const attachedSubUnit: NonNullable<BoardUnitPlacement["subUnit"]> = {
        unitType: benchUnit.unitType,
        starLevel: benchUnit.starLevel,
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
          starLevel: hostPlacement.subUnit.starLevel ?? STAR_LEVEL_MIN,
          unitCount: this.getTrackedPurchaseCount(
            hostPlacement.subUnit.starLevel,
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
      starLevel: benchUnit.starLevel,
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
        starLevel: replacedPlacement.starLevel ?? STAR_LEVEL_MIN,
        unitCount: this.getTrackedPurchaseCount(
          replacedPlacement.starLevel,
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
      starLevel: returnedPlacement.starLevel ?? STAR_LEVEL_MIN,
      unitCount: this.getTrackedPurchaseCount(returnedPlacement.starLevel, returnedPlacement.unitCount),
    };
    if (returnedPlacement.unitId !== undefined) {
      benchUnit.unitId = returnedPlacement.unitId;
    }

    benchUnits.push(benchUnit);

    if (returnedPlacement.subUnit) {
      const detachedSubUnit: ShopManagerBenchUnit = {
        unitType: returnedPlacement.subUnit.unitType,
        cost: returnedPlacement.subUnit.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[returnedPlacement.subUnit.unitType] ?? 1,
        starLevel: returnedPlacement.subUnit.starLevel ?? STAR_LEVEL_MIN,
        unitCount: this.getTrackedPurchaseCount(
          returnedPlacement.subUnit.starLevel,
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
      benchUnit.starLevel,
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

  private addPurchasedUnitToInventory(playerId: string, purchasedUnit: ShopManagerBenchUnit): void {
    const benchUnits = [...(this.deps.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];

    const matchingBenchIndex = this.findUpgradeableBenchUnitIndex(benchUnits, purchasedUnit);
    if (matchingBenchIndex >= 0) {
      const targetBenchUnit = benchUnits[matchingBenchIndex];
      if (targetBenchUnit) {
        this.applyPurchasedUnitToBenchUnit(targetBenchUnit, purchasedUnit);
        this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
      }
      return;
    }

    const matchingBoardIndex = this.findUpgradeableBoardPlacementIndex(boardPlacements, purchasedUnit);
    if (matchingBoardIndex >= 0) {
      const targetPlacement = boardPlacements[matchingBoardIndex];
      if (targetPlacement) {
        this.applyPurchasedUnitToBoardPlacement(targetPlacement, purchasedUnit);
        this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
      }
      return;
    }

    const matchingSubUnitLocation = this.findUpgradeableAttachedSubUnitLocation(boardPlacements, purchasedUnit);
    if (matchingSubUnitLocation) {
      this.applyPurchasedUnitToAttachedSubUnit(matchingSubUnitLocation, purchasedUnit);
      this.deps.boardPlacementsByPlayer.set(playerId, boardPlacements);
      return;
    }

    benchUnits.push(purchasedUnit);
    this.deps.benchUnitsByPlayer.set(playerId, benchUnits);
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
  ): void {
    const nextPurchaseCount = this.getTrackedPurchaseCount(targetUnit.starLevel, targetUnit.unitCount) + purchasedUnit.unitCount;
    targetUnit.cost += purchasedUnit.cost;
    targetUnit.unitCount = nextPurchaseCount;
    targetUnit.starLevel = getUpgradeTierForPurchaseCount(nextPurchaseCount);
  }

  private applyPurchasedUnitToBoardPlacement(
    targetPlacement: BoardUnitPlacement,
    purchasedUnit: ShopManagerBenchUnit,
  ): void {
    const nextPurchaseCount = this.getTrackedPurchaseCount(targetPlacement.starLevel, targetPlacement.unitCount) + purchasedUnit.unitCount;
    const currentSellValue = targetPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[targetPlacement.unitType] ?? 1;
    targetPlacement.sellValue = currentSellValue + purchasedUnit.cost;
    targetPlacement.unitCount = nextPurchaseCount;
    targetPlacement.starLevel = getUpgradeTierForPurchaseCount(nextPurchaseCount);
  }

  private applyPurchasedUnitToAttachedSubUnit(
    targetSubUnit: AttachedSubUnitPlacement,
    purchasedUnit: ShopManagerBenchUnit,
  ): void {
    const nextPurchaseCount = this.getTrackedPurchaseCount(targetSubUnit.starLevel, targetSubUnit.unitCount) + purchasedUnit.unitCount;
    const currentSellValue = targetSubUnit.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[targetSubUnit.unitType] ?? 1;
    targetSubUnit.sellValue = currentSellValue + purchasedUnit.cost;
    targetSubUnit.unitCount = nextPurchaseCount;
    targetSubUnit.starLevel = getUpgradeTierForPurchaseCount(nextPurchaseCount);
  }

  private getTrackedPurchaseCount(starLevel: number | undefined, unitCount: number | undefined): number {
    if (unitCount !== undefined && Number.isInteger(unitCount) && unitCount > 0) {
      return unitCount;
    }

    return getMinimumPurchaseCountForTier(starLevel ?? STAR_LEVEL_MIN);
  }

  private buildPlacementSettlement(
    placement: Pick<BoardUnitPlacement, "unitType" | "unitId" | "sellValue" | "starLevel" | "unitCount">
      | Pick<AttachedSubUnitPlacement, "unitType" | "unitId" | "sellValue" | "starLevel" | "unitCount">,
  ): { unitType: BoardUnitType; unitId?: string; unitCount: number; paidCost: number; sellValue: number } {
    const unitCount = this.getTrackedPurchaseCount(placement.starLevel, placement.unitCount);
    const paidCost = placement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[placement.unitType] ?? 1;

    return {
      unitType: placement.unitType,
      unitCount,
      paidCost,
      sellValue: calculateSellValue(
        paidCost,
        placement.unitType,
        placement.starLevel ?? STAR_LEVEL_MIN,
        unitCount,
      ),
      ...(placement.unitId !== undefined ? { unitId: placement.unitId } : {}),
    };
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
