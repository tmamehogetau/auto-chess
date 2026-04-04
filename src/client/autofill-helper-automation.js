export const AUTO_FILL_BOSS_ID = "remilia";
export const AUTO_FILL_HERO_IDS = [
  "reimu",
  "marisa",
  "okina",
  "keiki",
  "jyoon",
];
const AUTO_FILL_BOSS_DEPLOY_SEQUENCES = [
  [4, 10, 16],
  [1, 7, 13],
  [5, 11, 17],
];
const AUTO_FILL_RAID_DEPLOY_SEQUENCES = [
  [31, 25, 19],
  [33, 27, 21],
  [35, 29, 23],
];
const BOSS_OFFER_PRIORITY_BY_UNIT_ID = {
  patchouli: 300,
  sakuya: 200,
  meiling: 100,
};
const RAID_OFFER_PRIORITY_BY_UNIT_ID = {
  nazrin: 220,
  yoshika: 210,
  rin: 200,
  wakasagihime: 190,
  momoyo: 150,
  tojiko: 145,
  kagerou: 140,
  tsukasa: 135,
  sekibanki: 130,
  koishi: 125,
  megumu: 120,
  seiga: 115,
  satori: 110,
  murasa: 105,
  clownpiece: 100,
  ichirin: 95,
  shou: 90,
  futo: 85,
  utsuho: 80,
  chimata: 75,
  junko: 70,
  byakuren: 65,
  hecatia: 60,
  miko: 55,
  zanmu: 50,
};
const RAID_OFFER_PRIORITY_BY_UNIT_TYPE = {
  ranger: 40,
  vanguard: 35,
  mage: 15,
  assassin: 10,
};
const RAID_ESTABLISHED_FACTION_THRESHOLD = 2;
const RAID_ESTABLISHED_FACTION_BONUS_PER_UNIT = 20;
const RAID_ESTABLISHED_FACTION_BONUS_CAP = 40;
const RAID_DUPLICATE_BENCH_BONUS_PER_UNIT = 30;
const RAID_DUPLICATE_BENCH_BONUS_CAP = 60;
const RAID_HIGH_COST_STRATEGY_COST_WEIGHT = 100;
const RAID_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT = 0.45;
const RAID_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT = 0.25;

function isTouhouAutoPickEnabled(state) {
  return state?.featureFlagsEnableTouhouRoster === true;
}

function toArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : Array.from(value);
}

function hasUnits(units) {
  return toArray(units).length > 0;
}

function hasOffers(offers) {
  return toArray(offers).length > 0;
}

function toFiniteTimestamp(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

export function resolveAutoFillHelperPlayerPhase(state, nowMs = Date.now()) {
  const playerPhase = typeof state?.playerPhase === "string"
    ? state.playerPhase
    : "";

  if (playerPhase !== "purchase") {
    return playerPhase;
  }

  const playerPhaseDeadlineAtMs = toFiniteTimestamp(state?.playerPhaseDeadlineAtMs);
  if (playerPhaseDeadlineAtMs !== null && nowMs >= playerPhaseDeadlineAtMs) {
    return "deploy";
  }

  return playerPhase;
}

function getBaseBoardUnitCount(role) {
  return role === "boss" || role === "raid" ? 1 : 0;
}

function getPlacedPurchasedUnitCount(role, boardUnits) {
  return Math.max(0, toArray(boardUnits).length - getBaseBoardUnitCount(role));
}

function getBossDeploySequence(helperIndex) {
  return AUTO_FILL_BOSS_DEPLOY_SEQUENCES[
    helperIndex % AUTO_FILL_BOSS_DEPLOY_SEQUENCES.length
  ];
}

function getRaidDeploySequence(helperIndex) {
  return AUTO_FILL_RAID_DEPLOY_SEQUENCES[
    helperIndex % AUTO_FILL_RAID_DEPLOY_SEQUENCES.length
  ];
}

function getDeploySequence(role, helperIndex) {
  if (role === "boss") {
    return getBossDeploySequence(helperIndex);
  }

  if (role === "raid") {
    return getRaidDeploySequence(helperIndex);
  }

  return null;
}

function parseBoardCell(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const [rawCell] = value.split(":");
    const parsedCell = Number(rawCell);
    return Number.isInteger(parsedCell) ? parsedCell : null;
  }

  if (value && typeof value === "object" && Number.isInteger(value.cell)) {
    return value.cell;
  }

  return null;
}

function getOccupiedBoardCells(boardUnits) {
  const occupiedCells = new Set();

  for (const unit of toArray(boardUnits)) {
    const cell = parseBoardCell(unit);
    if (cell !== null) {
      occupiedCells.add(cell);
    }
  }

  return occupiedCells;
}

function getNextDeployCell(role, helperIndex, boardUnits) {
  const occupiedCells = getOccupiedBoardCells(boardUnits);
  const deploySequence = getDeploySequence(role, helperIndex);

  if (!deploySequence) {
    return null;
  }

  return deploySequence.find((cell) => !occupiedCells.has(cell)) ?? null;
}

function getAvailableDeployCells(role, helperIndex, boardUnits) {
  const occupiedCells = getOccupiedBoardCells(boardUnits);
  const deploySequence = getDeploySequence(role, helperIndex);

  if (!deploySequence) {
    return [];
  }

  return deploySequence.filter((cell) => !occupiedCells.has(cell));
}

function getBoardSubUnitHostCells(boardSubUnits) {
  const hostCells = new Set();

  for (const token of toArray(boardSubUnits)) {
    if (typeof token !== "string" || token.length === 0) {
      continue;
    }

    const [cellText] = token.split(":");
    const cellIndex = Number.parseInt(cellText, 10);
    if (Number.isInteger(cellIndex)) {
      hostCells.add(cellIndex);
    }
  }

  return hostCells;
}

function getAvailableSubDeployCells(
  role,
  boardUnits,
  boardSubUnits,
  selectedHeroId,
  selectedBossId,
) {
  if (role !== "raid") {
    return [];
  }

  const occupiedSubHostCells = getBoardSubUnitHostCells(boardSubUnits);
  const specialUnitIds = new Set(
    [selectedHeroId, selectedBossId].filter(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );

  const placements = toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null);
  const heroPlacement = placements.find((placement) => placement.unitId === selectedHeroId);
  const availableCells = [];

  for (const placement of placements) {
    if (specialUnitIds.has(placement.unitId)) {
      continue;
    }

    if (placement.subUnit !== undefined || occupiedSubHostCells.has(placement.cell)) {
      continue;
    }

    availableCells.push(placement.cell);
  }

  if (heroPlacement && !occupiedSubHostCells.has(heroPlacement.cell)) {
    availableCells.push(heroPlacement.cell);
  }

  return availableCells;
}

function buildDeployActions(
  role,
  helperIndex,
  boardUnits,
  boardSubUnits,
  benchUnits,
  selectedHeroId = "",
  selectedBossId = "",
) {
  const availableDeployCells = getAvailableDeployCells(role, helperIndex, boardUnits);
  const benchUnitList = toArray(benchUnits);
  const mainDeployCount = Math.min(availableDeployCells.length, benchUnitList.length);
  const actions = [];

  for (let benchIndex = 0; benchIndex < mainDeployCount; benchIndex += 1) {
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex,
          cell: availableDeployCells[benchIndex],
        },
      },
    });
  }

  const remainingBenchCount = benchUnitList.length - mainDeployCount;
  if (remainingBenchCount <= 0) {
    return actions;
  }

  const availableSubDeployCells = getAvailableSubDeployCells(
    role,
    boardUnits,
    boardSubUnits,
    selectedHeroId,
    selectedBossId,
  );
  const subDeployCount = Math.min(remainingBenchCount, availableSubDeployCells.length);

  for (let subIndex = 0; subIndex < subDeployCount; subIndex += 1) {
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex: mainDeployCount + subIndex,
          cell: availableSubDeployCells[subIndex],
          slot: "sub",
        },
      },
    });
  }

  return actions;
}

function getOfferCost(offer) {
  return offer && typeof offer === "object" && Number.isFinite(offer.cost)
    ? offer.cost
    : null;
}

function normalizeOfferUnitId(offer) {
  return offer && typeof offer === "object" && typeof offer.unitId === "string"
    ? offer.unitId.trim().toLowerCase()
    : "";
}

function normalizeOfferUnitType(offer) {
  return offer && typeof offer === "object" && typeof offer.unitType === "string"
    ? offer.unitType.trim().toLowerCase()
    : "";
}

function normalizeOfferFactionId(offer) {
  return offer && typeof offer === "object" && typeof offer.factionId === "string"
    ? offer.factionId.trim().toLowerCase()
    : "";
}

function normalizeUnitId(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function normalizeAutoFillStrategy(value) {
  return value === "highCost" || value === "upgrade"
    ? value
    : "upgrade";
}

function getStatePlayerEntries(state) {
  const players = state?.players;
  if (!players || typeof players !== "object") {
    return [];
  }

  if (typeof players.entries === "function") {
    return Array.from(players.entries());
  }

  if (typeof players.forEach === "function") {
    const entries = [];
    players.forEach((value, key) => {
      entries.push([key, value]);
    });
    return entries;
  }

  return Object.entries(players);
}

export function resolveAutoFillHelperStrategy({
  helperIndex = 0,
  player,
  state,
  sessionId,
  strategy,
}) {
  if (strategy === "highCost" || strategy === "upgrade") {
    return strategy;
  }

  if (player?.role !== "raid") {
    return "upgrade";
  }

  if (typeof sessionId === "string" && sessionId.length > 0) {
    const raidPlayerIds = getStatePlayerEntries(state)
      .filter(([, candidatePlayer]) => candidatePlayer?.role === "raid")
      .map(([playerId]) => playerId);

    const raidIndex = raidPlayerIds.findIndex((playerId) => playerId === sessionId);
    if (raidIndex >= 0) {
      return raidIndex === raidPlayerIds.length - 1
        ? "highCost"
        : "upgrade";
    }
  }

  return "upgrade";
}

function getBossOfferPriorityScore(offer) {
  return BOSS_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
}

function getFactionCounts(boardUnits) {
  const factionCounts = new Map();

  for (const placement of toArray(boardUnits)) {
    const parsedPlacement = parseBoardPlacement(placement);
    const factionId = parsedPlacement?.factionId?.trim().toLowerCase() ?? "";
    if (!factionId) {
      continue;
    }

    factionCounts.set(factionId, (factionCounts.get(factionId) ?? 0) + 1);
  }

  return factionCounts;
}

function getUnitIdCounts(unitIds) {
  const unitIdCounts = new Map();

  for (const value of toArray(unitIds)) {
    const unitId = normalizeUnitId(value);
    if (!unitId) {
      continue;
    }

    unitIdCounts.set(unitId, (unitIdCounts.get(unitId) ?? 0) + 1);
  }

  return unitIdCounts;
}

function getRaidOfferFactionBonus(offer, boardUnits) {
  const offerFactionId = normalizeOfferFactionId(offer);
  if (!offerFactionId) {
    return 0;
  }

  const existingFactionCount = getFactionCounts(boardUnits).get(offerFactionId) ?? 0;
  if (existingFactionCount < RAID_ESTABLISHED_FACTION_THRESHOLD) {
    return 0;
  }

  return Math.min(
    existingFactionCount * RAID_ESTABLISHED_FACTION_BONUS_PER_UNIT,
    RAID_ESTABLISHED_FACTION_BONUS_CAP,
  );
}

function getRaidOfferDuplicateBenchBonus(offer, benchUnitIds) {
  const offerUnitId = normalizeOfferUnitId(offer);
  if (!offerUnitId) {
    return 0;
  }

  const duplicateCount = getUnitIdCounts(benchUnitIds).get(offerUnitId) ?? 0;
  if (duplicateCount <= 0) {
    return 0;
  }

  return Math.min(
    duplicateCount * RAID_DUPLICATE_BENCH_BONUS_PER_UNIT,
    RAID_DUPLICATE_BENCH_BONUS_CAP,
  );
}

function getRaidUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  const factionBonus = getRaidOfferFactionBonus(offer, boardUnits);
  const duplicateBenchBonus = getRaidOfferDuplicateBenchBonus(offer, benchUnitIds);
  return unitIdPriority + unitTypePriority + factionBonus + duplicateBenchBonus - offerCost * 3;
}

function getRaidHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  const factionBonus = getRaidOfferFactionBonus(offer, boardUnits);
  const duplicateBenchBonus = getRaidOfferDuplicateBenchBonus(offer, benchUnitIds);
  const baseScore = unitIdPriority + unitTypePriority + factionBonus;

  return offerCost * RAID_HIGH_COST_STRATEGY_COST_WEIGHT
    + baseScore * RAID_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT
    + duplicateBenchBonus * RAID_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT;
}

function getRaidOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy) {
  if (strategy === "highCost") {
    return getRaidHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds);
  }

  return getRaidUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds);
}

function getOfferPriorityScore(role, offer, boardUnits, benchUnitIds, strategy) {
  if (role === "boss") {
    return getBossOfferPriorityScore(offer);
  }

  if (role === "raid") {
    return getRaidOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy);
  }

  return 0;
}

function pickAffordableOfferIndex(
  offers,
  gold,
  role = "",
  boardUnits = [],
  benchUnitIds = [],
  strategy = "upgrade",
) {
  const offerList = toArray(offers);

  if (offerList.length === 0) {
    return null;
  }

  if (!Number.isFinite(gold)) {
    return null;
  }

  let bestOfferIndex = null;
  let bestOfferScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < offerList.length; index += 1) {
    const offerCost = getOfferCost(offerList[index]);
    if (offerCost !== null && offerCost <= gold) {
      const offerScore = getOfferPriorityScore(
        role,
        offerList[index],
        boardUnits,
        benchUnitIds,
        strategy,
      );
      if (bestOfferIndex === null || offerScore > bestOfferScore) {
        bestOfferIndex = index;
        bestOfferScore = offerScore;
      }
    }
  }

  return bestOfferIndex;
}

function buildReserveBuyAction(player, strategy) {
  if (player?.role === "boss" && hasOffers(player.bossShopOffers)) {
    const affordableBossSlotIndex = pickAffordableOfferIndex(
      player.bossShopOffers,
      player.gold,
      player.role,
      player.boardUnits,
      player.benchUnitIds,
      strategy,
    );
    if (affordableBossSlotIndex !== null) {
      return {
        type: "prep_command",
        payload: { bossShopBuySlotIndex: affordableBossSlotIndex },
      };
    }
  }

  if (player?.role === "raid" && hasOffers(player.shopOffers)) {
    const affordableShopSlotIndex = pickAffordableOfferIndex(
      player.shopOffers,
      player.gold,
      player.role,
      player.boardUnits,
      player.benchUnitIds,
      strategy,
    );
    if (affordableShopSlotIndex !== null) {
      return {
        type: "prep_command",
        payload: { shopBuySlotIndex: affordableShopSlotIndex },
      };
    }
  }

  return null;
}

function parseBoardPlacement(value) {
  const cell = parseBoardCell(value);
  if (cell === null) {
    return null;
  }

  if (value && typeof value === "object") {
    return {
      cell,
      factionId: typeof value.factionId === "string" ? value.factionId : "",
      unitId: typeof value.unitId === "string" ? value.unitId : "",
      subUnit: value.subUnit,
    };
  }

  if (typeof value === "string") {
    const [, rawUnitId = ""] = value.split(":");
    return {
      cell,
      factionId: "",
      unitId: rawUnitId,
      subUnit: undefined,
    };
  }

  return {
    cell,
    factionId: "",
    unitId: "",
    subUnit: undefined,
  };
}

function getReserveOffers(player) {
  if (player?.role === "boss") {
    return player.bossShopOffers;
  }

  if (player?.role === "raid") {
    return player.shopOffers;
  }

  return [];
}

function shouldPrioritizeReserveBuyBeforeDeploy(player, reserveBuyAction, playerPhase, strategy) {
  if (
    player?.role !== "raid"
    || playerPhase !== "purchase"
    || !reserveBuyAction
    || !hasUnits(player.benchUnits)
  ) {
    return false;
  }

  const shopBuySlotIndex = reserveBuyAction.payload?.shopBuySlotIndex;
  if (!Number.isInteger(shopBuySlotIndex)) {
    return false;
  }

  const targetOffer = toArray(player.shopOffers)[shopBuySlotIndex];
  if (strategy === "highCost") {
    return (getOfferCost(targetOffer) ?? 0) >= 3;
  }

  return getRaidOfferDuplicateBenchBonus(targetOffer, player.benchUnitIds) > 0;
}

export function buildAutoFillHelperActions({
  state,
  player,
  helperIndex = 0,
  strategy,
  sessionId,
}) {
  if (!state || !player || player.isSpectator === true) {
    return [];
  }

  const helperStrategy = normalizeAutoFillStrategy(resolveAutoFillHelperStrategy({
    helperIndex,
    player,
    sessionId,
    state,
    strategy,
  }));

  const phase = typeof state.phase === "string" ? state.phase : "";
  const lobbyStage = typeof state.lobbyStage === "string" ? state.lobbyStage : "";

  if (phase === "Waiting" && lobbyStage === "preference") {
    return player.ready !== true
      ? [
          {
            type: "ready",
            payload: { ready: true },
          },
        ]
      : [];
  }

  if (phase === "Waiting" && lobbyStage === "selection") {
    if (!isTouhouAutoPickEnabled(state)) {
      return [];
    }

    if (player.role === "boss" && !player.selectedBossId) {
      return [
        {
          type: "boss_select",
          payload: { bossId: AUTO_FILL_BOSS_ID },
        },
      ];
    }

    if (player.role === "raid" && !player.selectedHeroId) {
      return [
        {
          type: "HERO_SELECT",
          payload: {
            heroId: AUTO_FILL_HERO_IDS[helperIndex % AUTO_FILL_HERO_IDS.length],
          },
        },
      ];
    }

    return [];
  }

  if (phase === "Prep") {
    if (player.role !== "boss" && player.role !== "raid") {
      return [];
    }

    const playerPhase = resolveAutoFillHelperPlayerPhase(state);
    const nextDeployCell = getNextDeployCell(player.role, helperIndex, player.boardUnits);
    const placedPurchasedUnitCount = getPlacedPurchasedUnitCount(
      player.role,
      player.boardUnits,
    );
    const reserveOffers = getReserveOffers(player);
    const reserveBuyAction = nextDeployCell !== null
      ? buildReserveBuyAction(player, helperStrategy)
      : null;
    const deployActions = hasUnits(player.benchUnits)
      ? buildDeployActions(
        player.role,
        helperIndex,
        player.boardUnits,
        player.boardSubUnits,
        player.benchUnits,
        player.selectedHeroId,
        player.selectedBossId,
      )
      : [];

    if (shouldPrioritizeReserveBuyBeforeDeploy(player, reserveBuyAction, playerPhase, helperStrategy)) {
      return [reserveBuyAction];
    }

    if (deployActions.length > 0) {
      return deployActions;
    }

    if (playerPhase === "purchase") {
      if (reserveBuyAction) {
        return [reserveBuyAction];
      }

      if (
        placedPurchasedUnitCount === 0
        && !Number.isFinite(player.gold)
      ) {
        if (player.role === "boss" && hasOffers(player.bossShopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { bossShopBuySlotIndex: 0 },
            },
          ];
        }

        if (player.role === "raid" && hasOffers(player.shopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { shopBuySlotIndex: 0 },
            },
          ];
        }
      }

      return [];
    }

    if (playerPhase === "deploy") {
      if (hasUnits(player.benchUnits)) {
        if (deployActions.length === 0) {
          return player.ready !== true
            ? [
                {
                  type: "ready",
                  payload: { ready: true },
                },
              ]
            : [];
        }

        return deployActions;
      }

      if (
        placedPurchasedUnitCount === 0
        && !hasUnits(player.benchUnits)
        && !hasOffers(reserveOffers)
      ) {
        return [];
      }

      return player.ready !== true
        ? [
            {
              type: "ready",
              payload: { ready: true },
            },
          ]
        : [];
    }

    if (hasUnits(player.benchUnits)) {
      if (deployActions.length === 0) {
        return player.ready !== true
          ? [
              {
                type: "ready",
                payload: { ready: true },
              },
          ]
          : [];
      }

      return deployActions;
    }

    if (nextDeployCell !== null) {
      if (reserveBuyAction) {
        return [reserveBuyAction];
      }
    }

    if (
      placedPurchasedUnitCount === 0
      && !Number.isFinite(player.gold)
    ) {
      if (player.role === "boss" && hasOffers(player.bossShopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { bossShopBuySlotIndex: 0 },
          },
        ];
      }

      if (player.role === "raid" && hasOffers(player.shopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { shopBuySlotIndex: 0 },
          },
        ];
      }
    }

    if (!Number.isFinite(player.gold) && placedPurchasedUnitCount > 0) {
      return [];
    }

    if (
      placedPurchasedUnitCount === 0
      && !hasUnits(player.benchUnits)
      && !hasOffers(reserveOffers)
    ) {
      return [];
    }

    if (player.ready !== true) {
      return [
        {
          type: "ready",
          payload: { ready: true },
        },
      ];
    }

    return [];
  }

  return [];
}
