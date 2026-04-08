export const AUTO_FILL_BOSS_ID = "remilia";
export const AUTO_FILL_HERO_IDS = [
  "reimu",
  "marisa",
  "okina",
  "keiki",
  "jyoon",
];
const AUTO_FILL_SPECIAL_UNIT_IDS = new Set([
  AUTO_FILL_BOSS_ID,
  ...AUTO_FILL_HERO_IDS,
]);
const AUTO_FILL_BOSS_DEPLOY_SEQUENCES = [
  [4, 10, 16, 3, 9, 15, 5, 11, 17, 1, 7, 13, 2, 8, 14, 0, 6, 12],
  [1, 7, 13, 0, 6, 12, 2, 8, 14, 3, 9, 15, 4, 10, 16, 5, 11, 17],
  [5, 11, 17, 4, 10, 16, 3, 9, 15, 2, 8, 14, 1, 7, 13, 0, 6, 12],
];
const AUTO_FILL_RAID_DEPLOY_SEQUENCES = [
  [31, 25, 19, 30, 24, 18, 32, 26, 20, 33, 27, 21, 34, 28, 22, 35, 29, 23],
  [33, 27, 21, 32, 26, 20, 34, 28, 22, 31, 25, 19, 35, 29, 23, 30, 24, 18],
  [35, 29, 23, 34, 28, 22, 33, 27, 21, 32, 26, 20, 31, 25, 19, 30, 24, 18],
];
const FRONTLINE_UNIT_TYPES = new Set(["vanguard"]);
const BACKLINE_UNIT_TYPES = new Set(["ranger", "mage"]);
const BOSS_OFFER_PRIORITY_BY_UNIT_ID = {
  patchouli: 300,
  sakuya: 200,
  meiling: 100,
};
const BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_ID = {
  hecatia: 280,
  byakuren: 270,
  junko: 250,
  utsuho: 240,
  chimata: 230,
  clownpiece: 210,
  nazrin: 190,
  yoshika: 185,
  rin: 180,
  wakasagihime: 175,
};
const BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_TYPE = {
  mage: 35,
  ranger: 30,
  vanguard: 20,
  assassin: 15,
};
const BOSS_DUPLICATE_OWNED_BONUS_PER_UNIT = 220;
const BOSS_DUPLICATE_OWNED_BONUS_CAP = 440;
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
const RAID_PREFERRED_MAIN_UNIT_COUNT_BEFORE_SUB = 1;
const FRONTLINE_DEFICIT_PRIORITY_BONUS = 480;
const BACKLINE_WITHOUT_FRONTLINE_PENALTY = 180;
const BACKLINE_WITHOUT_BACKLINE_PENALTY = 40;
const RAID_HIGH_COST_STRATEGY_COST_WEIGHT = 100;
const RAID_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT = 0.45;
const RAID_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT = 0.25;
const MAX_STANDARD_DEPLOY_SLOTS_BY_ROLE = {
  boss: 6,
  raid: 2,
};

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

function normalizeUnitType(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function parseBenchUnitType(value) {
  if (value && typeof value === "object") {
    return normalizeUnitType(value.unitType);
  }

  return normalizeUnitType(value);
}

function isFrontlineUnitType(unitType) {
  return FRONTLINE_UNIT_TYPES.has(normalizeUnitType(unitType));
}

function isBacklineUnitType(unitType) {
  return BACKLINE_UNIT_TYPES.has(normalizeUnitType(unitType));
}

function buildFrontlinePreferredDeploySequence(deploySequence) {
  const chunks = [];
  const preferredSequence = [];
  const chunkSize = 3;

  for (let index = 0; index < deploySequence.length; index += chunkSize) {
    chunks.push(deploySequence.slice(index, index + chunkSize));
  }

  for (let rowIndex = chunkSize - 1; rowIndex >= 0; rowIndex -= 1) {
    for (const chunk of chunks) {
      const cell = chunk[rowIndex];
      if (cell !== undefined) {
        preferredSequence.push(cell);
      }
    }
  }

  return preferredSequence;
}

function sortDeployCellsForUnitType(role, helperIndex, unitType, deployCells) {
  const deploySequence = getDeploySequence(role, helperIndex) ?? [];
  const availableCells = new Set(deployCells);
  const normalizedUnitType = normalizeUnitType(unitType);
  const preferredSequence = isFrontlineUnitType(normalizedUnitType)
    ? buildFrontlinePreferredDeploySequence(deploySequence)
    : deploySequence;

  return preferredSequence.filter((cell) => availableCells.has(cell));
}

function getDeployPriorityForUnitType(unitType) {
  if (isFrontlineUnitType(unitType)) {
    return 0;
  }

  if (isBacklineUnitType(unitType)) {
    return 1;
  }

  return 2;
}

function getMaxStandardDeploySlotsForRole(role) {
  return MAX_STANDARD_DEPLOY_SLOTS_BY_ROLE[role] ?? 0;
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

  if (
    heroPlacement
    && heroPlacement.subUnit === undefined
    && !occupiedSubHostCells.has(heroPlacement.cell)
  ) {
    availableCells.push(heroPlacement.cell);
  }

  return availableCells;
}

function getNonSpecialBoardUnitCount(boardUnits, selectedHeroId = "", selectedBossId = "") {
  const specialUnitIds = new Set(AUTO_FILL_SPECIAL_UNIT_IDS);

  for (const value of [selectedHeroId, selectedBossId]) {
    if (typeof value === "string" && value.length > 0) {
      specialUnitIds.add(value);
    }
  }

  let count = 0;
  for (const placement of toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)) {
    if (specialUnitIds.has(placement.unitId)) {
      continue;
    }
    count += 1;
  }

  return count;
}

function getPlacedStandardBoardUnitCount(
  role,
  boardUnits,
  selectedHeroId = "",
  selectedBossId = "",
) {
  if (role !== "boss" && role !== "raid") {
    return getNonSpecialBoardUnitCount(boardUnits, selectedHeroId, selectedBossId);
  }

  return getNonSpecialBoardUnitCount(boardUnits, selectedHeroId, selectedBossId);
}

function getFormationTypeCounts(
  boardUnits,
  benchUnits,
  selectedHeroId = "",
  selectedBossId = "",
) {
  const specialUnitIds = new Set(
    [selectedHeroId, selectedBossId].filter(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );
  let frontlineCount = 0;
  let backlineCount = 0;

  for (const placement of toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)) {
    if (specialUnitIds.has(placement.unitId)) {
      continue;
    }

    if (isFrontlineUnitType(placement.unitType)) {
      frontlineCount += 1;
      continue;
    }

    if (isBacklineUnitType(placement.unitType)) {
      backlineCount += 1;
    }
  }

  for (const benchUnit of toArray(benchUnits)) {
    const unitType = parseBenchUnitType(benchUnit);
    if (isFrontlineUnitType(unitType)) {
      frontlineCount += 1;
      continue;
    }

    if (isBacklineUnitType(unitType)) {
      backlineCount += 1;
    }
  }

  return {
    frontlineCount,
    backlineCount,
  };
}

function getFormationBalanceBonus(
  offer,
  boardUnits,
  benchUnits,
  selectedHeroId = "",
  selectedBossId = "",
) {
  const offerUnitType = normalizeOfferUnitType(offer);
  const { frontlineCount, backlineCount } = getFormationTypeCounts(
    boardUnits,
    benchUnits,
    selectedHeroId,
    selectedBossId,
  );

  if (isFrontlineUnitType(offerUnitType)) {
    if (frontlineCount === 0 && backlineCount > 0) {
      return FRONTLINE_DEFICIT_PRIORITY_BONUS;
    }

    if (frontlineCount > 0 && frontlineCount < backlineCount) {
      return FRONTLINE_DEFICIT_PRIORITY_BONUS / 2;
    }

    return 0;
  }

  if (isBacklineUnitType(offerUnitType)) {
    if (frontlineCount === 0 && backlineCount > 0) {
      return -BACKLINE_WITHOUT_FRONTLINE_PENALTY;
    }

    if (frontlineCount > 0 && backlineCount === 0) {
      return BACKLINE_WITHOUT_BACKLINE_PENALTY;
    }
  }

  return 0;
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
  const availableSubDeployCells = getAvailableSubDeployCells(
    role,
    boardUnits,
    boardSubUnits,
    selectedHeroId,
    selectedBossId,
  );
  const benchUnitList = toArray(benchUnits);
  const benchEntries = benchUnitList.map((unit, index) => ({
    benchIndex: index,
    unitType: parseBenchUnitType(unit),
  }));
  const actions = [];
  const existingMainUnitCount = getNonSpecialBoardUnitCount(
    boardUnits,
    selectedHeroId,
    selectedBossId,
  );
  const remainingMainDeploySlots = Math.max(
    0,
    getMaxStandardDeploySlotsForRole(role) - existingMainUnitCount,
  );
  let mainDeployCount = Math.min(
    availableDeployCells.length,
    benchUnitList.length,
    remainingMainDeploySlots,
  );

  if (role === "raid" && availableSubDeployCells.length > 0) {
    const minimumMainDeployCount = Math.min(
      mainDeployCount,
      Math.max(0, RAID_PREFERRED_MAIN_UNIT_COUNT_BEFORE_SUB - existingMainUnitCount),
    );
    mainDeployCount = minimumMainDeployCount;
  }

  const prioritizedBenchEntries = [...benchEntries].sort((leftEntry, rightEntry) =>
    getDeployPriorityForUnitType(leftEntry.unitType) - getDeployPriorityForUnitType(rightEntry.unitType)
    || leftEntry.benchIndex - rightEntry.benchIndex);
  const mainDeployEntries = prioritizedBenchEntries.slice(0, mainDeployCount);
  const usedDeployCells = new Set();

  for (const deployEntry of mainDeployEntries) {
    const preferredCells = sortDeployCellsForUnitType(
      role,
      helperIndex,
      deployEntry.unitType,
      availableDeployCells,
    );
    const targetCell = preferredCells.find((cell) => !usedDeployCells.has(cell));
    if (targetCell === undefined) {
      continue;
    }

    usedDeployCells.add(targetCell);
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex: deployEntry.benchIndex,
          cell: targetCell,
        },
      },
    });
  }

  const remainingBenchEntries = benchEntries.filter((entry) =>
    !mainDeployEntries.some((mainDeployEntry) => mainDeployEntry.benchIndex === entry.benchIndex));
  const remainingBenchCount = remainingBenchEntries.length;
  if (remainingBenchCount <= 0) {
    return actions;
  }

  const subDeployCount = Math.min(remainingBenchCount, availableSubDeployCells.length);

  for (let subIndex = 0; subIndex < subDeployCount; subIndex += 1) {
    const subDeployEntry = remainingBenchEntries[subIndex];
    if (!subDeployEntry) {
      continue;
    }
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex: subDeployEntry.benchIndex,
          cell: availableSubDeployCells[subIndex],
          slot: "sub",
        },
      },
      });
  }

  const remainingMainDeployCells = availableDeployCells.filter((cell) => !usedDeployCells.has(cell));
  const remainingBenchAfterSubDeploy = remainingBenchCount - subDeployCount;
  const remainingMainSlotsAfterInitialDeploy = Math.max(0, remainingMainDeploySlots - mainDeployEntries.length);
  const extraMainDeployCount = Math.min(
    remainingBenchAfterSubDeploy,
    remainingMainDeployCells.length,
    remainingMainSlotsAfterInitialDeploy,
  );

  for (let extraMainIndex = 0; extraMainIndex < extraMainDeployCount; extraMainIndex += 1) {
    const extraMainEntry = remainingBenchEntries[subDeployCount + extraMainIndex];
    if (!extraMainEntry) {
      continue;
    }
    const preferredCells = sortDeployCellsForUnitType(
      role,
      helperIndex,
      extraMainEntry.unitType,
      remainingMainDeployCells,
    );
    const targetCell = preferredCells[0];
    if (targetCell === undefined) {
      continue;
    }
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex: extraMainEntry.benchIndex,
          cell: targetCell,
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

function getPlacedUnitIds(boardUnits, selectedHeroId = "", selectedBossId = "") {
  const specialUnitIds = new Set(
    [selectedHeroId, selectedBossId].filter(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );

  return toArray(boardUnits)
    .map((value) => parseBoardPlacement(value))
    .filter((placement) => placement !== null)
    .map((placement) => placement.unitId)
    .filter((unitId) => unitId && !specialUnitIds.has(unitId));
}

function getBossOfferDuplicateOwnedBonus(offer, boardUnits, benchUnitIds) {
  const offerUnitId = normalizeOfferUnitId(offer);
  if (!offerUnitId) {
    return 0;
  }

  const ownedUnitIdCounts = getUnitIdCounts([
    ...toArray(benchUnitIds),
    ...getPlacedUnitIds(boardUnits),
  ]);
  const ownedCount = ownedUnitIdCounts.get(offerUnitId) ?? 0;
  if (ownedCount <= 0) {
    return 0;
  }

  return Math.min(
    ownedCount * BOSS_DUPLICATE_OWNED_BONUS_PER_UNIT,
    BOSS_DUPLICATE_OWNED_BONUS_CAP,
  );
}

function getBossOfferPriorityScore(offer, boardUnits = [], benchUnitIds = []) {
  const unitId = normalizeOfferUnitId(offer);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, []);
  const duplicateOwnedBonus = getBossOfferDuplicateOwnedBonus(
    offer,
    boardUnits,
    benchUnitIds,
  );
  const bossExclusiveScore = BOSS_OFFER_PRIORITY_BY_UNIT_ID[unitId];
  if (bossExclusiveScore !== undefined) {
    return bossExclusiveScore + duplicateOwnedBonus + formationBalanceBonus;
  }

  const commonOfferScore = BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_ID[unitId];
  if (commonOfferScore !== undefined) {
    return commonOfferScore + duplicateOwnedBonus + formationBalanceBonus;
  }

  const cost = getOfferCost(offer) ?? 0;
  const typeScore =
    BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  return cost * 40 + typeScore + duplicateOwnedBonus + formationBalanceBonus;
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

function getRaidUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits = []) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  const factionBonus = getRaidOfferFactionBonus(offer, boardUnits);
  const duplicateBenchBonus = getRaidOfferDuplicateBenchBonus(offer, benchUnitIds);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  return unitIdPriority
    + unitTypePriority
    + factionBonus
    + duplicateBenchBonus
    + formationBalanceBonus
    - offerCost * 3;
}

function getRaidHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits = []) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  const factionBonus = getRaidOfferFactionBonus(offer, boardUnits);
  const duplicateBenchBonus = getRaidOfferDuplicateBenchBonus(offer, benchUnitIds);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  const baseScore = unitIdPriority + unitTypePriority + factionBonus;

  return offerCost * RAID_HIGH_COST_STRATEGY_COST_WEIGHT
    + (baseScore + formationBalanceBonus) * RAID_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT
    + duplicateBenchBonus * RAID_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT;
}

function getRaidOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy, benchUnits = []) {
  if (strategy === "highCost") {
    return getRaidHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits);
  }

  return getRaidUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits);
}

function getOfferPriorityScore(role, offer, boardUnits, benchUnitIds, strategy, benchUnits = []) {
  if (role === "boss") {
    return getBossOfferPriorityScore(offer, boardUnits, benchUnitIds);
  }

  if (role === "raid") {
    return getRaidOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy, benchUnits);
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
  benchUnits = [],
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
        benchUnits,
      );
      if (bestOfferIndex === null || offerScore > bestOfferScore) {
        bestOfferIndex = index;
        bestOfferScore = offerScore;
      }
    }
  }

  return bestOfferIndex;
}

function buildBossShopReserveBuyAction(player) {
  const affordableBossSlotIndex = pickAffordableOfferIndex(
    player?.bossShopOffers,
    player?.gold,
    "boss",
    player?.boardUnits,
    player?.benchUnitIds,
    "upgrade",
    player?.benchUnits,
  );
  if (affordableBossSlotIndex === null) {
    return null;
  }

  const offer = toArray(player?.bossShopOffers)[affordableBossSlotIndex];
  return {
    action: {
      type: "prep_command",
      payload: { bossShopBuySlotIndex: affordableBossSlotIndex },
    },
    score: getBossOfferPriorityScore(offer, player?.boardUnits, player?.benchUnitIds),
  };
}

function buildBossNormalReserveBuyAction(player) {
  const affordableShopSlotIndex = pickAffordableOfferIndex(
    player?.shopOffers,
    player?.gold,
    "boss",
    player?.boardUnits,
    player?.benchUnitIds,
    "upgrade",
    player?.benchUnits,
  );
  if (affordableShopSlotIndex === null) {
    return null;
  }

  const offer = toArray(player?.shopOffers)[affordableShopSlotIndex];
  return {
    action: {
      type: "prep_command",
      payload: { shopBuySlotIndex: affordableShopSlotIndex },
    },
    score: getBossOfferPriorityScore(offer, player?.boardUnits, player?.benchUnitIds),
  };
}

function buildReserveBuyAction(player, strategy) {
  if (player?.role === "boss") {
    const bossShopBuy = buildBossShopReserveBuyAction(player);
    const normalShopBuy = buildBossNormalReserveBuyAction(player);

    if (bossShopBuy && normalShopBuy) {
      return normalShopBuy.score > bossShopBuy.score
        ? normalShopBuy.action
        : bossShopBuy.action;
    }

    return bossShopBuy?.action ?? normalShopBuy?.action ?? null;
  }

  if (player?.role === "raid" && hasOffers(player.shopOffers)) {
    const affordableShopSlotIndex = pickAffordableOfferIndex(
      player.shopOffers,
      player.gold,
      player.role,
      player.boardUnits,
      player.benchUnitIds,
      strategy,
      player.benchUnits,
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
      unitType: normalizeUnitType(value.unitType),
      subUnit: value.subUnit,
    };
  }

  if (typeof value === "string") {
    const [, rawUnitId = ""] = value.split(":");
    const normalizedUnitType = normalizeUnitType(rawUnitId);
    return {
      cell,
      factionId: "",
      unitId: rawUnitId,
      unitType: normalizedUnitType,
      subUnit: undefined,
    };
  }

  return {
    cell,
    factionId: "",
    unitId: "",
    unitType: "",
    subUnit: undefined,
  };
}

function getReserveOffers(player) {
  if (player?.role === "boss") {
    return [
      ...toArray(player.bossShopOffers),
      ...toArray(player.shopOffers),
    ];
  }

  if (player?.role === "raid") {
    return player.shopOffers;
  }

  return [];
}

function shouldPrioritizeReserveBuyBeforeDeploy(player, reserveBuyAction, playerPhase, strategy) {
  if (
    (player?.role !== "raid" && player?.role !== "boss")
    || playerPhase === "deploy"
    || !reserveBuyAction
    || !hasUnits(player.benchUnits)
  ) {
    return false;
  }

  const shopBuySlotIndex = reserveBuyAction.payload?.shopBuySlotIndex;
  const bossShopBuySlotIndex = reserveBuyAction.payload?.bossShopBuySlotIndex;
  const targetOffer = Number.isInteger(shopBuySlotIndex)
    ? toArray(player.shopOffers)[shopBuySlotIndex]
    : Number.isInteger(bossShopBuySlotIndex)
      ? toArray(player.bossShopOffers)[bossShopBuySlotIndex]
      : null;
  if (!targetOffer) {
    return false;
  }

  const formationBalanceBonus = getFormationBalanceBonus(
    targetOffer,
    player.boardUnits,
    player.benchUnits,
    player.selectedHeroId,
    player.selectedBossId,
  );
  if (formationBalanceBonus >= FRONTLINE_DEFICIT_PRIORITY_BONUS) {
    return true;
  }

  if (player?.role !== "raid" || playerPhase !== "purchase") {
    return false;
  }

  const raidReserveUnitCount =
    getPlacedPurchasedUnitCount("raid", player.boardUnits) + toArray(player.benchUnits).length;
  if (raidReserveUnitCount < 2) {
    return true;
  }

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
    const placedStandardBoardUnitCount = getPlacedStandardBoardUnitCount(
      player.role,
      player.boardUnits,
      player.selectedHeroId,
      player.selectedBossId,
    );
    const mainBoardAtCapacity = placedStandardBoardUnitCount >= getMaxStandardDeploySlotsForRole(player.role);
    const nextDeployCell = mainBoardAtCapacity
      ? null
      : getNextDeployCell(player.role, helperIndex, player.boardUnits);
    const placedPurchasedUnitCount = getPlacedPurchasedUnitCount(
      player.role,
      player.boardUnits,
    );
    const reserveOffers = getReserveOffers(player);
      const hasSubDeployCapacity = getAvailableSubDeployCells(
        player.role,
        player.boardUnits,
        player.boardSubUnits,
        player.selectedHeroId,
        player.selectedBossId,
      ).length > 0;
      const reserveBuyAction = (nextDeployCell !== null || hasSubDeployCapacity)
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

        if (player.role === "boss" && hasOffers(player.shopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { shopBuySlotIndex: 0 },
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

      if (player.role === "boss" && hasOffers(player.shopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { shopBuySlotIndex: 0 },
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
