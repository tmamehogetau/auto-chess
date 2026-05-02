export interface ComparableShopOffer {
  unitType: string;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  rarity: number;
  cost: number;
}

export interface ApplyPrepIncomeParams {
  alivePlayerIds: readonly string[];
  goldByPlayer: Map<string, number>;
  baseIncome?: number;
  getBaseIncome?: (playerId: string) => number;
  initialGold: number;
  onIncomeApplied?: (
    playerId: string,
    amount: number,
    goldBefore: number,
    goldAfter: number,
  ) => void;
}

export interface InitializePrepShopsParams<TShopOffer, TBossOffer> {
  playerIds: readonly string[];
  roundIndex: number;
  isBossPlayer: (playerId: string) => boolean;
  buildShopOffers: (
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
    isRumorEligible: boolean,
  ) => TShopOffer[];
  buildBossShopOffers: () => TBossOffer[];
  shopRefreshCountByPlayer: Map<string, number>;
  shopPurchaseCountByPlayer: Map<string, number>;
  shopLockedByPlayer: Map<string, boolean>;
  kouRyuudouFreeRefreshConsumedByPlayer: Map<string, boolean>;
  rumorInfluenceEligibleByPlayer: Map<string, boolean>;
  shopOffersByPlayer: Map<string, TShopOffer[]>;
  bossShopOffersByPlayer: Map<string, TBossOffer[]>;
  enableRumorInfluence: boolean;
  enableBossExclusiveShop: boolean;
}

export interface RefreshPrepShopsParams<TShopOffer, TBossOffer, TBattleResult> {
  alivePlayerIds: readonly string[];
  roundIndex: number;
  isBossPlayer: (playerId: string) => boolean;
  buildShopOffers: (
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
    isRumorEligible: boolean,
  ) => TShopOffer[];
  buildBossShopOffers: () => TBossOffer[];
  shopRefreshCountByPlayer: Map<string, number>;
  shopPurchaseCountByPlayer: Map<string, number>;
  shopLockedByPlayer: Map<string, boolean>;
  kouRyuudouFreeRefreshConsumedByPlayer: Map<string, boolean>;
  rumorInfluenceEligibleByPlayer: Map<string, boolean>;
  shopOffersByPlayer: Map<string, TShopOffer[]>;
  bossShopOffersByPlayer: Map<string, TBossOffer[]>;
  battleResultsByPlayer: Map<string, TBattleResult>;
  enableRumorInfluence: boolean;
  enableBossExclusiveShop: boolean;
}

export interface RefreshShopByCountParams<TShopOffer extends ComparableShopOffer> {
  playerId: string;
  roundIndex: number;
  refreshCount: number;
  buildShopOffers: (
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
    isRumorEligible: boolean,
  ) => TShopOffer[];
  shopRefreshCountByPlayer: Map<string, number>;
  shopPurchaseCountByPlayer: Map<string, number>;
  kouRyuudouFreeRefreshConsumedByPlayer: Map<string, boolean>;
  rumorInfluenceEligibleByPlayer: Map<string, boolean>;
  shopOffersByPlayer: Map<string, TShopOffer[]>;
  enableRumorInfluence: boolean;
  getAvailableFreeRefreshes: (playerId: string) => number;
  consumeFreeRefreshes?: (playerId: string, refreshCount: number) => void;
}

export function applyPrepIncomeToPlayers(params: ApplyPrepIncomeParams): void {
  for (const playerId of params.alivePlayerIds) {
    const currentGold = params.goldByPlayer.get(playerId) ?? params.initialGold;
    const incomeAmount = params.getBaseIncome?.(playerId) ?? params.baseIncome ?? 0;
    const nextGold = currentGold + incomeAmount;
    params.goldByPlayer.set(playerId, nextGold);
    params.onIncomeApplied?.(playerId, incomeAmount, currentGold, nextGold);
  }
}

export function initializeShopsForPrep<TShopOffer, TBossOffer>(
  params: InitializePrepShopsParams<TShopOffer, TBossOffer>,
): void {
  for (const playerId of params.playerIds) {
    params.shopRefreshCountByPlayer.set(playerId, 0);
    params.shopPurchaseCountByPlayer.set(playerId, 0);
    params.shopLockedByPlayer.set(playerId, false);
    params.kouRyuudouFreeRefreshConsumedByPlayer.set(playerId, false);
    const isRumorEligible = params.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;
    params.shopOffersByPlayer.set(
      playerId,
      params.buildShopOffers(playerId, params.roundIndex, 0, 0, isRumorEligible),
    );

    if (params.enableRumorInfluence) {
      params.rumorInfluenceEligibleByPlayer.set(playerId, false);
    }

    if (params.enableBossExclusiveShop && params.isBossPlayer(playerId)) {
      params.bossShopOffersByPlayer.set(playerId, params.buildBossShopOffers());
    }
  }
}

export function refreshShopsForPrep<TShopOffer, TBossOffer, TBattleResult>(
  params: RefreshPrepShopsParams<TShopOffer, TBossOffer, TBattleResult>,
): void {
  for (const playerId of params.alivePlayerIds) {
    const locked = params.shopLockedByPlayer.get(playerId) ?? false;
    if (locked) {
      continue;
    }

    params.shopRefreshCountByPlayer.set(playerId, 0);
    params.shopPurchaseCountByPlayer.set(playerId, 0);
    params.kouRyuudouFreeRefreshConsumedByPlayer.set(playerId, false);
    const isRumorEligible = params.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;
    params.shopOffersByPlayer.set(
      playerId,
      params.buildShopOffers(playerId, params.roundIndex, 0, 0, isRumorEligible),
    );

    if (params.enableRumorInfluence && isRumorEligible) {
      params.rumorInfluenceEligibleByPlayer.set(playerId, false);
    }

    if (params.enableBossExclusiveShop && params.isBossPlayer(playerId)) {
      params.bossShopOffersByPlayer.set(playerId, params.buildBossShopOffers());
    }
  }

  params.battleResultsByPlayer.clear();
}

export function refreshShopByCount<TShopOffer extends ComparableShopOffer>(
  params: RefreshShopByCountParams<TShopOffer>,
): void {
  const previousOffers = params.shopOffersByPlayer.get(params.playerId) ?? [];
  const currentCount = params.shopRefreshCountByPlayer.get(params.playerId) ?? 0;
  const nextCount = currentCount + params.refreshCount;
  const isRumorEligible = params.rumorInfluenceEligibleByPlayer.get(params.playerId) ?? false;
  let nextOffers = params.buildShopOffers(
    params.playerId,
    params.roundIndex,
    nextCount,
    0,
    isRumorEligible,
  );

  if (areShopOffersEqual(previousOffers, nextOffers)) {
    nextOffers = params.buildShopOffers(
      params.playerId,
      params.roundIndex,
      nextCount,
      1,
      isRumorEligible,
    );
  }

  params.shopRefreshCountByPlayer.set(params.playerId, nextCount);
  params.shopPurchaseCountByPlayer.set(params.playerId, 0);
  params.shopOffersByPlayer.set(params.playerId, nextOffers);

  if (
    params.refreshCount > 0 &&
    params.getAvailableFreeRefreshes(params.playerId) > 0
  ) {
    if (params.consumeFreeRefreshes) {
      params.consumeFreeRefreshes(params.playerId, params.refreshCount);
    } else {
      params.kouRyuudouFreeRefreshConsumedByPlayer.set(params.playerId, true);
    }
  }

  if (params.enableRumorInfluence && isRumorEligible) {
    params.rumorInfluenceEligibleByPlayer.set(params.playerId, false);
  }
}

export function areShopOffersEqual<TShopOffer extends ComparableShopOffer>(
  left: readonly TShopOffer[],
  right: readonly TShopOffer[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftOffer = left[index];
    const rightOffer = right[index];

    if (!leftOffer || !rightOffer) {
      return false;
    }

    const leftKey = `${leftOffer.unitId ?? leftOffer.unitType}:${leftOffer.displayName ?? ""}:${leftOffer.factionId ?? ""}:${leftOffer.rarity}:${leftOffer.cost}`;
    const rightKey = `${rightOffer.unitId ?? rightOffer.unitType}:${rightOffer.displayName ?? ""}:${rightOffer.factionId ?? ""}:${rightOffer.rarity}:${rightOffer.cost}`;

    if (leftKey !== rightKey) {
      return false;
    }
  }

  return true;
}
