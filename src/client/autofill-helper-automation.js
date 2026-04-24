import { getTouhouUnitById } from "../data/touhou-units";
import {
  getClientSpecialUnitLevel,
  getClientSpecialUnitUpgradeCost,
  getClientSpecialUnitUpgradeValueScore,
} from "./special-unit-progression.js";

export const AUTO_FILL_BOSS_ID = "remilia";
export const AUTO_FILL_HERO_IDS = [
  "reimu",
  "marisa",
  "okina",
  "keiki",
  "jyoon",
  "yuiman",
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
  sakuya: 240,
  meiling: 230,
  patchouli: 220,
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
const BOSS_HIGH_COST_STRATEGY_COST_WEIGHT = 100;
const BOSS_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT = 0.45;
const BOSS_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT = 0.25;
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
const HERO_EXCLUSIVE_OFFER_PRIORITY_BY_UNIT_ID = {
  mayumi: 280,
  shion: 310,
  ariya: 295,
};
const HERO_EXCLUSIVE_FIRST_COPY_BONUS = 80;
const HERO_EXCLUSIVE_DUPLICATE_BONUS = 120;
const AUTO_FILL_BENCH_CAPACITY = 8;
const AUTO_FILL_SHOP_REFRESH_GOLD_COST = 2;
const AUTO_FILL_UPGRADE_REFRESH_GOLD_FLOOR = 2;
const AUTO_FILL_HIGH_COST_REFRESH_GOLD_FLOOR = 4;
const AUTO_FILL_RESERVE_SELL_SCORE_MARGIN = 80;
const AUTO_FILL_UPGRADE_PIVOT_ROUND = 8;
const AUTO_FILL_UPGRADE_PIVOT_LEVEL = 5;
const AUTO_FILL_HIGH_COST_PIVOT_ROUND = 6;
const AUTO_FILL_HIGH_COST_PIVOT_LEVEL = 4;
const AUTO_FILL_PIVOT_HIGH_COST_PREMIUM = 260;
const AUTO_FILL_PIVOT_LOW_COST_PENALTY = 220;
const AUTO_FILL_LATE_SPECIAL_UNIT_UPGRADE_SCORE_MARGIN = 80;
const AUTO_FILL_LATE_SPECIAL_UNIT_UPGRADE_VALUE_FLOOR = 9.5;
const BOSS_SPECIAL_UNIT_UPGRADE_SCORE_WEIGHT = 44;
const BOSS_SPECIAL_UNIT_UPGRADE_ESTABLISHED_ROSTER_BONUS = 80;
const BOSS_SPECIAL_UNIT_UPGRADE_EARLY_LEVEL_BONUS = 45;
const BOSS_SPECIAL_UNIT_UPGRADE_ROUND_BONUS_CAP = 36;
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
  const unitType = value && typeof value === "object"
    ? value.unitType
    : value;

  if (typeof unitType === "string") {
    return normalizeUnitType(unitType.replace(/:\d+$/, ""));
  }

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

function getKnownTouhouUnit(unitId) {
  const normalizedUnitId = normalizeUnitId(unitId);
  return normalizedUnitId
    ? getTouhouUnitById(normalizedUnitId)
    : null;
}

function buildOwnedUnitSnapshot(unitType, unitId, factionId = "") {
  const knownUnit = getKnownTouhouUnit(unitId);
  return {
    unitType: normalizeUnitType(knownUnit?.unitType ?? unitType),
    unitId: normalizeUnitId(unitId),
    factionId: normalizeUnitId(knownUnit?.factionId ?? factionId),
    cost: knownUnit?.cost ?? 0,
  };
}

function normalizeAutoFillStrategy(value) {
  return value === "highCost" || value === "upgrade"
    ? value
    : "upgrade";
}

export function normalizeAutoFillHelperPolicy(value) {
  return value === "growth" || value === "strength"
    ? value
    : "strength";
}

export function resolveAutoFillHelperPolicyStrategy(policy) {
  return normalizeAutoFillHelperPolicy(policy) === "growth"
    ? "highCost"
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
  policy,
}) {
  if (strategy === "highCost" || strategy === "upgrade") {
    return strategy;
  }

  if (policy === "growth" || policy === "strength") {
    return resolveAutoFillHelperPolicyStrategy(policy);
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

function getBossUpgradeOfferPriorityScore(offer, boardUnits = [], benchUnitIds = [], benchUnits = []) {
  const unitId = normalizeOfferUnitId(offer);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
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

function getBossHighCostOfferPriorityScore(offer, boardUnits = [], benchUnitIds = [], benchUnits = []) {
  const unitId = normalizeOfferUnitId(offer);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  const duplicateOwnedBonus = getBossOfferDuplicateOwnedBonus(
    offer,
    boardUnits,
    benchUnitIds,
  );
  const bossExclusiveScore = BOSS_OFFER_PRIORITY_BY_UNIT_ID[unitId];
  const commonOfferScore = BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_ID[unitId];
  const unitTypeScore =
    BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const baseScore = bossExclusiveScore
    ?? commonOfferScore
    ?? unitTypeScore;
  const cost = getOfferCost(offer) ?? 0;

  return cost * BOSS_HIGH_COST_STRATEGY_COST_WEIGHT
    + (baseScore + formationBalanceBonus) * BOSS_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT
    + duplicateOwnedBonus * BOSS_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT;
}

function getBossOfferPriorityScore(
  offer,
  boardUnits = [],
  benchUnitIds = [],
  strategy = "upgrade",
  benchUnits = [],
) {
  if (strategy === "highCost") {
    return getBossHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits);
  }

  return getBossUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits);
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
    return getBossOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy, benchUnits);
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
  state = null,
  player = null,
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
      ) + getMidgamePivotOfferAdjustment(
        offerList[index],
        player,
        state,
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

function buildBossShopReserveBuyAction(player) {
  const affordableBossSlotIndex = pickAffordableOfferIndex(
    player?.bossShopOffers,
    player?.gold,
    "boss",
    player?.boardUnits,
    player?.benchUnitIds,
    player?.helperStrategy ?? "upgrade",
    player?.benchUnits,
    null,
    player,
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
    score: getBossOfferPriorityScore(
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      player?.helperStrategy ?? "upgrade",
      player?.benchUnits,
    ),
  };
}

function buildBossNormalReserveBuyAction(player) {
  const affordableShopSlotIndex = pickAffordableOfferIndex(
    player?.shopOffers,
    player?.gold,
    "boss",
    player?.boardUnits,
    player?.benchUnitIds,
    player?.helperStrategy ?? "upgrade",
    player?.benchUnits,
    null,
    player,
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
    score: getBossOfferPriorityScore(
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      player?.helperStrategy ?? "upgrade",
      player?.benchUnits,
    ),
  };
}

function getHeroExclusiveOfferPriorityScore(offer, player, strategy = "upgrade", state = null) {
  const unitId = normalizeOfferUnitId(offer);
  const basePriority = HERO_EXCLUSIVE_OFFER_PRIORITY_BY_UNIT_ID[unitId] ?? 200;
  const formationBalanceBonus = getFormationBalanceBonus(
    offer,
    player?.boardUnits,
    player?.benchUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  );
  const duplicateBonus = canReserveOfferStackIntoOwnedUnit(player, offer)
    ? HERO_EXCLUSIVE_DUPLICATE_BONUS
    : HERO_EXCLUSIVE_FIRST_COPY_BONUS;

  return basePriority
    + formationBalanceBonus
    + duplicateBonus
    + getMidgamePivotOfferAdjustment(offer, player, state, strategy);
}

function isHeroExclusiveOffer(offer) {
  const unitId = normalizeOfferUnitId(offer);
  return unitId.length > 0
    && HERO_EXCLUSIVE_OFFER_PRIORITY_BY_UNIT_ID[unitId] !== undefined;
}

function getReserveTargetOfferScore(targetOffer, player, strategy = "upgrade", state = null) {
  if (isHeroExclusiveOffer(targetOffer)) {
    return getHeroExclusiveOfferPriorityScore(
      targetOffer,
      player,
      strategy,
      state,
    );
  }

  return getOfferPriorityScore(
    player?.role,
    targetOffer,
    player?.boardUnits,
    player?.benchUnitIds,
    strategy,
    player?.benchUnits,
  ) + getMidgamePivotOfferAdjustment(
    targetOffer,
    player,
    state,
    strategy,
  );
}

function buildRaidNormalReserveBuyAction(player, strategy, state = null) {
  const affordableShopSlotIndex = pickAffordableOfferIndex(
    player?.shopOffers,
    player?.gold,
    player?.role,
    player?.boardUnits,
    player?.benchUnitIds,
    strategy,
    player?.benchUnits,
    state,
    player,
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
    score: getRaidOfferPriorityScore(
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      strategy,
      player?.benchUnits,
    ) + getMidgamePivotOfferAdjustment(
      offer,
      player,
      state,
      strategy,
    ),
  };
}

function buildRaidHeroExclusiveReserveBuyAction(player, strategy, state = null) {
  const offers = toArray(player?.heroExclusiveShopOffers);
  if (offers.length === 0 || !Number.isFinite(player?.gold)) {
    return null;
  }

  let bestOfferIndex = null;
  let bestOfferScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < offers.length; index += 1) {
    const offer = offers[index];
    const cost = getOfferCost(offer);
    if (offer?.purchased === true || cost === null || cost > player.gold) {
      continue;
    }

    const offerScore = getHeroExclusiveOfferPriorityScore(
      offer,
      player,
      strategy,
      state,
    );
    if (bestOfferIndex === null || offerScore > bestOfferScore) {
      bestOfferIndex = index;
      bestOfferScore = offerScore;
    }
  }

  if (bestOfferIndex === null) {
    return null;
  }

  return {
    action: {
      type: "prep_command",
      payload: { heroExclusiveShopBuySlotIndex: bestOfferIndex },
    },
    score: bestOfferScore,
  };
}

function buildBossReserveBuyDecision(player) {
  const bossShopBuy = buildBossShopReserveBuyAction(player);
  const normalShopBuy = buildBossNormalReserveBuyAction(player);

  if (bossShopBuy && normalShopBuy) {
    return normalShopBuy.score > bossShopBuy.score
      ? normalShopBuy
      : bossShopBuy;
  }

  return bossShopBuy ?? normalShopBuy ?? null;
}

function buildRaidReserveBuyDecision(player, strategy, state = null) {
  const heroExclusiveBuy = buildRaidHeroExclusiveReserveBuyAction(player, strategy, state);
  const normalShopBuy = buildRaidNormalReserveBuyAction(player, strategy, state);

  if (heroExclusiveBuy && normalShopBuy) {
    return heroExclusiveBuy.score >= normalShopBuy.score
      ? heroExclusiveBuy
      : normalShopBuy;
  }

  return heroExclusiveBuy ?? normalShopBuy ?? null;
}

function buildReserveBuyDecision(player, strategy, state = null) {
  if (player?.role === "boss") {
    return buildBossReserveBuyDecision(player);
  }

  if (player?.role === "raid") {
    return buildRaidReserveBuyDecision(player, strategy, state);
  }

  return null;
}

function buildReserveBuyAction(player, strategy, state = null) {
  return buildReserveBuyDecision(player, strategy, state)?.action ?? null;
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
    return [
      ...toArray(player.heroExclusiveShopOffers),
      ...toArray(player.shopOffers),
    ];
  }

  return [];
}

function getRefreshableReserveOffers(player) {
  return toArray(player?.shopOffers);
}

function getRemainingGoldAfterRefresh(gold) {
  if (!Number.isFinite(gold)) {
    return null;
  }

  return gold - AUTO_FILL_SHOP_REFRESH_GOLD_COST;
}

function getRefreshGoldFloor(strategy = "upgrade") {
  return strategy === "highCost"
    ? AUTO_FILL_HIGH_COST_REFRESH_GOLD_FLOOR
    : AUTO_FILL_UPGRADE_REFRESH_GOLD_FLOOR;
}

function canRefreshReserveShop(player, strategy = "upgrade") {
  const remainingGold = getRemainingGoldAfterRefresh(player?.gold);
  if (remainingGold === null) {
    return false;
  }

  return remainingGold >= getRefreshGoldFloor(strategy)
    && hasOffers(getRefreshableReserveOffers(player));
}

function getOfferFromReserveBuyAction(player, reserveBuyAction) {
  const shopBuySlotIndex = reserveBuyAction?.payload?.shopBuySlotIndex;
  if (Number.isInteger(shopBuySlotIndex)) {
    return toArray(player?.shopOffers)[shopBuySlotIndex] ?? null;
  }

  const bossShopBuySlotIndex = reserveBuyAction?.payload?.bossShopBuySlotIndex;
  if (Number.isInteger(bossShopBuySlotIndex)) {
    return toArray(player?.bossShopOffers)[bossShopBuySlotIndex] ?? null;
  }

  const heroExclusiveShopBuySlotIndex = reserveBuyAction?.payload?.heroExclusiveShopBuySlotIndex;
  if (Number.isInteger(heroExclusiveShopBuySlotIndex)) {
    return toArray(player?.heroExclusiveShopOffers)[heroExclusiveShopBuySlotIndex] ?? null;
  }

  return null;
}

function buildSpecialUnitUpgradeAction(player, playerPhase) {
  if (
    playerPhase !== "purchase"
    || (player?.role !== "boss" && player?.role !== "raid")
  ) {
    return null;
  }

  if (player?.role === "boss" && hasUnits(player?.benchUnits)) {
    return null;
  }

  if (player?.role === "raid" && !hasDeployedSpecialUnit(player)) {
    return null;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  const nextUpgradeCost = getClientSpecialUnitUpgradeCost({
    ...player,
    specialUnitLevel: currentLevel,
  });
  if (
    nextUpgradeCost === null
    || !Number.isFinite(player?.gold)
    || player.gold < nextUpgradeCost
  ) {
    return null;
  }

  return {
    type: "prep_command",
    payload: { specialUnitUpgradeCount: 1 },
  };
}

function getRaidSpecialUnitUpgradePriorityScore(player, strategy = "upgrade", state = null) {
  if (player?.role !== "raid") {
    return Number.NEGATIVE_INFINITY;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  const upgradeValueScore = getClientSpecialUnitUpgradeValueScore(player) * 24;
  if (upgradeValueScore <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const roundIndex = getStateRoundIndex(state);
  const ownedRaidUnitCount =
    getPlacedPurchasedUnitCount("raid", player?.boardUnits) + toArray(player?.benchUnits).length;
  const rosterBonus = ownedRaidUnitCount >= 2
    ? 18
    : ownedRaidUnitCount >= 1
      ? 8
      : 0;
  const roundBonus = roundIndex !== null
    ? Math.min(Math.max(roundIndex - 3, 0) * 4, 24)
    : 0;
  const urgencyBonus = currentLevel <= 2 ? 18 : 0;
  const catchUpBonus = roundIndex !== null && roundIndex >= 6 && currentLevel <= 2 ? 24 : 0;
  const strategyPenalty = strategy === "highCost" ? 12 : 0;
  return upgradeValueScore + rosterBonus + roundBonus + urgencyBonus + catchUpBonus - strategyPenalty;
}

function getBossSpecialUnitUpgradePriorityScore(player, strategy = "upgrade", state = null) {
  if (player?.role !== "boss") {
    return Number.NEGATIVE_INFINITY;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  const upgradeValueScore =
    getClientSpecialUnitUpgradeValueScore(player) * BOSS_SPECIAL_UNIT_UPGRADE_SCORE_WEIGHT;
  if (upgradeValueScore <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const roundIndex = getStateRoundIndex(state);
  const ownedBossUnitCount =
    getPlacedPurchasedUnitCount("boss", player?.boardUnits) + toArray(player?.benchUnits).length;
  const rosterBonus = ownedBossUnitCount >= 3
    ? BOSS_SPECIAL_UNIT_UPGRADE_ESTABLISHED_ROSTER_BONUS
    : ownedBossUnitCount >= 2
      ? BOSS_SPECIAL_UNIT_UPGRADE_ESTABLISHED_ROSTER_BONUS / 2
      : 0;
  const roundBonus = roundIndex !== null
    ? Math.min(Math.max(roundIndex - 3, 0) * 6, BOSS_SPECIAL_UNIT_UPGRADE_ROUND_BONUS_CAP)
    : 0;
  const urgencyBonus = currentLevel <= 2 ? BOSS_SPECIAL_UNIT_UPGRADE_EARLY_LEVEL_BONUS : 0;
  const strategyPenalty = strategy === "highCost" ? 20 : 0;

  return upgradeValueScore + rosterBonus + roundBonus + urgencyBonus - strategyPenalty;
}

function shouldPreferRaidSpecialUnitUpgradeOverRefresh(player, state = null) {
  if (player?.role !== "raid") {
    return false;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null) {
    return false;
  }

  if (currentLevel <= 2) {
    return roundIndex >= 4;
  }

  const ownedRaidUnitCount =
    getPlacedPurchasedUnitCount("raid", player?.boardUnits) + toArray(player?.benchUnits).length;

  return currentLevel <= 4
    && ownedRaidUnitCount >= 2
    && roundIndex >= 5;
}

function shouldForceRaidSpecialUnitUpgradeProgression(player, reserveBuyDecision, state = null) {
  if (player?.role !== "raid" || !reserveBuyDecision) {
    return false;
  }

  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null || roundIndex < 5) {
    return false;
  }

  if (getClientSpecialUnitLevel(player) > 2) {
    return false;
  }

  const targetOffer = getOfferFromReserveBuyAction(player, reserveBuyDecision?.action);
  if (!targetOffer || isHeroExclusiveOffer(targetOffer)) {
    return false;
  }

  const offerCost = getOfferCost(targetOffer) ?? 0;
  return offerCost <= 1 && !canReserveOfferStackIntoOwnedUnit(player, targetOffer);
}

function canPreferRaidSpecialUnitUpgradeWithBenchBacklog(player, state = null) {
  if (player?.role !== "raid" || !hasUnits(player?.benchUnits)) {
    return true;
  }

  const roundIndex = getStateRoundIndex(state);
  const ownedRaidUnitCount =
    getPlacedPurchasedUnitCount("raid", player?.boardUnits) + toArray(player?.benchUnits).length;

  return roundIndex !== null
    && roundIndex >= 5
    && ownedRaidUnitCount >= 3;
}

function shouldLockInRaidSpecialUnitUpgrade(player, state = null) {
  if (player?.role !== "raid") {
    return false;
  }

  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null || roundIndex < 5) {
    return false;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  if (currentLevel > 2) {
    return false;
  }

  const ownedRaidUnitCount =
    getPlacedPurchasedUnitCount("raid", player?.boardUnits) + toArray(player?.benchUnits).length;
  return ownedRaidUnitCount >= 2;
}

function shouldLockInBossSpecialUnitUpgrade(player, state = null) {
  if (player?.role !== "boss") {
    return false;
  }

  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null || roundIndex < 5) {
    return false;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  if (currentLevel > 2) {
    return false;
  }

  const ownedBossUnitCount =
    getPlacedPurchasedUnitCount("boss", player?.boardUnits) + toArray(player?.benchUnits).length;
  return ownedBossUnitCount >= 3;
}

function buildSpecialUnitUpgradeDecision(player, playerPhase, strategy = "upgrade", state = null) {
  const action = buildSpecialUnitUpgradeAction(player, playerPhase);
  if (!action) {
    return null;
  }

  const valueScore = getClientSpecialUnitUpgradeValueScore(player);
  return {
    action,
    valueScore,
    score: player?.role === "boss"
      ? getBossSpecialUnitUpgradePriorityScore(player, strategy, state)
      : getRaidSpecialUnitUpgradePriorityScore(player, strategy, state),
  };
}

function doesSpecialUnitUpgradeOutrankReserveBuy(currentLevel, upgradeScore, reserveBuyScore, upgradeValueScore) {
  if (!Number.isFinite(upgradeScore) || !Number.isFinite(reserveBuyScore)) {
    return false;
  }

  if (currentLevel <= 4) {
    return upgradeScore > reserveBuyScore;
  }

  if (!Number.isFinite(upgradeValueScore) || upgradeValueScore < AUTO_FILL_LATE_SPECIAL_UNIT_UPGRADE_VALUE_FLOOR) {
    return false;
  }

  return upgradeScore > reserveBuyScore + AUTO_FILL_LATE_SPECIAL_UNIT_UPGRADE_SCORE_MARGIN;
}

function hasDeployedSpecialUnit(player) {
  const specialUnitId = player.role === "raid"
    ? player.selectedHeroId
    : player.role === "boss"
      ? player.selectedBossId
      : "";
  if (!specialUnitId) {
    return false;
  }

  // Real room state does not serialize the selected hero/boss into boardUnits tokens.
  // Once a special unit is selected, it already participates in combat and can be upgraded.
  return true;
}

function getStateRoundIndex(state) {
  return Number.isFinite(state?.roundIndex) ? Number(state.roundIndex) : null;
}

function isMidgameHighCostPivotPhase(player, state, strategy = "upgrade") {
  if (player?.role !== "raid") {
    return false;
  }

  const roundIndex = getStateRoundIndex(state);
  const level = Number.isFinite(player?.specialUnitLevel)
    ? Number(player.specialUnitLevel)
    : Number.isFinite(player?.level)
      ? Number(player.level)
      : null;
  const pivotRound = strategy === "highCost"
    ? AUTO_FILL_HIGH_COST_PIVOT_ROUND
    : AUTO_FILL_UPGRADE_PIVOT_ROUND;
  const pivotLevel = strategy === "highCost"
    ? AUTO_FILL_HIGH_COST_PIVOT_LEVEL
    : AUTO_FILL_UPGRADE_PIVOT_LEVEL;

  return (roundIndex !== null && roundIndex >= pivotRound)
    || (level !== null && level >= pivotLevel);
}

function getMidgamePivotOfferAdjustment(offer, player, state, strategy = "upgrade") {
  if (!isMidgameHighCostPivotPhase(player, state, strategy)) {
    return 0;
  }

  const offerCost = getOfferCost(offer) ?? 0;
  if (offerCost >= 4) {
    return AUTO_FILL_PIVOT_HIGH_COST_PREMIUM;
  }

  if (canReserveOfferStackIntoOwnedUnit(player, offer)) {
    return 0;
  }

  if (offerCost <= 1) {
    return -AUTO_FILL_PIVOT_LOW_COST_PENALTY;
  }

  return offerCost <= 2
    ? -Math.floor(AUTO_FILL_PIVOT_LOW_COST_PENALTY / 2)
    : 0;
}

function shouldRefreshInsteadOfBuyingOffer(player, targetOffer, state, strategy = "upgrade") {
  if (!targetOffer || !isMidgameHighCostPivotPhase(player, state, strategy)) {
    return false;
  }

  const offerCost = getOfferCost(targetOffer) ?? 0;
  if (offerCost >= 4 || canReserveOfferStackIntoOwnedUnit(player, targetOffer)) {
    return false;
  }

  const formationBalanceBonus = getFormationBalanceBonus(
    targetOffer,
    player?.boardUnits,
    player?.benchUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  );
  if (formationBalanceBonus >= FRONTLINE_DEFICIT_PRIORITY_BONUS) {
    return false;
  }

  if (offerCost <= 1) {
    return true;
  }

  return player?.role === "raid"
    && offerCost <= 2
    && getPlacedPurchasedUnitCount("raid", player?.boardUnits) + toArray(player?.benchUnits).length >= 3;
}

function getOwnedReserveAndBoardUnitIdCounts(player) {
  return getUnitIdCounts([
    ...toArray(player?.benchUnitIds),
    ...getPlacedUnitIds(
      player?.boardUnits,
      player?.selectedHeroId,
      player?.selectedBossId,
    ),
  ]);
}

function canReserveOfferStackIntoOwnedUnit(player, offer) {
  const offerUnitId = normalizeOfferUnitId(offer);
  if (!offerUnitId) {
    return false;
  }

  return (getOwnedReserveAndBoardUnitIdCounts(player).get(offerUnitId) ?? 0) > 0;
}

function getLegacyBenchUnitPriorityScore(role, unitType, unitId, strategy = "upgrade") {
  const normalizedRole = typeof role === "string" ? role : "";
  const normalizedUnitType = normalizeUnitType(unitType);
  const normalizedUnitId = normalizeUnitId(unitId);

  if (normalizedRole === "boss") {
    return getBossOfferPriorityScore({
      unitType: normalizedUnitType,
      unitId: normalizedUnitId,
      cost: 0,
    }, [], [], strategy, []);
  }

  if (normalizedRole === "raid") {
    return getRaidOfferPriorityScore({
      unitType: normalizedUnitType,
      unitId: normalizedUnitId,
      cost: 0,
    }, [], [], strategy, []);
  }

  return 0;
}

function getBenchUnitPriorityScore(player, benchIndex, strategy = "upgrade", state = null) {
  const benchUnits = toArray(player?.benchUnits);
  const benchUnitIds = toArray(player?.benchUnitIds);
  const benchUnitType = parseBenchUnitType(benchUnits[benchIndex]);
  const benchUnitId = benchUnitIds[benchIndex];

  if (
    player?.role !== "raid"
    || !isMidgameHighCostPivotPhase(player, state, strategy)
  ) {
    return getLegacyBenchUnitPriorityScore(
      player?.role,
      benchUnitType,
      benchUnitId,
      strategy,
    );
  }

  const ownedUnit = buildOwnedUnitSnapshot(
    benchUnitType,
    benchUnitId,
  );

  return getOfferPriorityScore(
    player?.role,
    ownedUnit,
    player?.boardUnits,
    player?.benchUnitIds,
    strategy,
    player?.benchUnits,
  ) + getMidgamePivotOfferAdjustment(
    ownedUnit,
    player,
    state,
    strategy,
  );
}

function getBenchUnitDuplicateKeepBonus(player, benchIndex) {
  const benchUnitIds = toArray(player?.benchUnitIds);
  const benchUnitId = normalizeUnitId(benchUnitIds[benchIndex]);
  if (!benchUnitId) {
    return 0;
  }

  const duplicateCount = getOwnedReserveAndBoardUnitIdCounts(player).get(benchUnitId) ?? 0;
  return duplicateCount > 1 ? Math.min((duplicateCount - 1) * 40, 120) : 0;
}

function getBenchSellCandidate(player, targetOffer, strategy = "upgrade", state = null) {
  const benchUnits = toArray(player?.benchUnits);
  if (benchUnits.length < AUTO_FILL_BENCH_CAPACITY || !targetOffer) {
    return null;
  }

  const targetScore = getReserveTargetOfferScore(
    targetOffer,
    player,
    strategy,
    state,
  );
  const benchUnitIds = toArray(player?.benchUnitIds);
  let weakestBenchIndex = null;
  let weakestBenchScore = Number.POSITIVE_INFINITY;

  for (let benchIndex = 0; benchIndex < benchUnits.length; benchIndex += 1) {
    const benchScore = getBenchUnitPriorityScore(
      player,
      benchIndex,
      strategy,
      state,
    ) + getBenchUnitDuplicateKeepBonus(player, benchIndex);

    if (benchScore < weakestBenchScore) {
      weakestBenchScore = benchScore;
      weakestBenchIndex = benchIndex;
    }
  }

  if (weakestBenchIndex === null) {
    return null;
  }

  return targetScore >= weakestBenchScore + AUTO_FILL_RESERVE_SELL_SCORE_MARGIN
    ? weakestBenchIndex
    : null;
}

function buildReserveManagementAction(player, reserveBuyAction, strategy, playerPhase, state = null) {
  if (playerPhase !== "purchase") {
    return null;
  }

  const targetOffer = getOfferFromReserveBuyAction(player, reserveBuyAction);
  if (
    targetOffer
    && shouldRefreshInsteadOfBuyingOffer(player, targetOffer, state, strategy)
    && canRefreshReserveShop(player, strategy)
  ) {
    return {
      type: "prep_command",
      payload: { shopRefreshCount: 1 },
    };
  }

  if (targetOffer && !canReserveOfferStackIntoOwnedUnit(player, targetOffer)) {
    const benchSellIndex = getBenchSellCandidate(player, targetOffer, strategy, state);
    if (benchSellIndex !== null) {
      return {
        type: "prep_command",
        payload: { benchSellIndex },
      };
    }
  }

  if (!reserveBuyAction && canRefreshReserveShop(player, strategy)) {
    return {
      type: "prep_command",
      payload: { shopRefreshCount: 1 },
    };
  }

  return null;
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
  const heroExclusiveShopBuySlotIndex = reserveBuyAction.payload?.heroExclusiveShopBuySlotIndex;
  const targetOffer = Number.isInteger(shopBuySlotIndex)
    ? toArray(player.shopOffers)[shopBuySlotIndex]
    : Number.isInteger(bossShopBuySlotIndex)
      ? toArray(player.bossShopOffers)[bossShopBuySlotIndex]
      : Number.isInteger(heroExclusiveShopBuySlotIndex)
        ? toArray(player.heroExclusiveShopOffers)[heroExclusiveShopBuySlotIndex]
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

function resolveAutoFillHeroId(helperIndex = 0, heroId) {
  if (typeof heroId === "string" && heroId.length > 0) {
    return heroId;
  }

  return AUTO_FILL_HERO_IDS[helperIndex % AUTO_FILL_HERO_IDS.length]
    ?? AUTO_FILL_HERO_IDS[0]
    ?? "reimu";
}

export function buildAutoFillHelperActions({
  state,
  player,
  helperIndex = 0,
  strategy,
  policy,
  sessionId,
  wantsBoss,
  heroId,
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
    policy,
  }));
  const helperWantsBoss = typeof wantsBoss === "boolean"
    ? wantsBoss
    : null;

  const phase = typeof state.phase === "string" ? state.phase : "";
  const lobbyStage = typeof state.lobbyStage === "string" ? state.lobbyStage : "";

  if (phase === "Waiting" && lobbyStage === "preference") {
    if (helperWantsBoss !== null && player.wantsBoss !== helperWantsBoss) {
      return [
        {
          type: "boss_preference",
          payload: { wantsBoss: helperWantsBoss },
        },
      ];
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
            heroId: resolveAutoFillHeroId(helperIndex, heroId),
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
    const helperPlayer = {
      ...player,
      helperStrategy,
    };

    const playerPhase = resolveAutoFillHelperPlayerPhase(state);
    const placedStandardBoardUnitCount = getPlacedStandardBoardUnitCount(
      helperPlayer.role,
      helperPlayer.boardUnits,
      helperPlayer.selectedHeroId,
      helperPlayer.selectedBossId,
    );
    const mainBoardAtCapacity = placedStandardBoardUnitCount >= getMaxStandardDeploySlotsForRole(helperPlayer.role);
    const nextDeployCell = mainBoardAtCapacity
      ? null
      : getNextDeployCell(helperPlayer.role, helperIndex, helperPlayer.boardUnits);
    const placedPurchasedUnitCount = getPlacedPurchasedUnitCount(
      helperPlayer.role,
      helperPlayer.boardUnits,
    );
    const reserveOffers = getReserveOffers(helperPlayer);
    const hasSubDeployCapacity = getAvailableSubDeployCells(
      helperPlayer.role,
      helperPlayer.boardUnits,
      helperPlayer.boardSubUnits,
      helperPlayer.selectedHeroId,
      helperPlayer.selectedBossId,
    ).length > 0;
    const reserveBuyDecision = (nextDeployCell !== null || hasSubDeployCapacity)
      ? buildReserveBuyDecision(helperPlayer, helperStrategy, state)
      : null;
    const reserveBuyAction = reserveBuyDecision?.action ?? null;
    const specialUnitUpgradeDecision = buildSpecialUnitUpgradeDecision(
      helperPlayer,
      playerPhase,
      helperStrategy,
      state,
    );
    const currentSpecialUnitLevel = getClientSpecialUnitLevel(helperPlayer);
    const deployedSpecialUnit = hasDeployedSpecialUnit(helperPlayer);
    const shouldPreferBossSpecialUnitUpgrade = playerPhase === "purchase"
      && helperPlayer.role === "boss"
      && deployedSpecialUnit
      && specialUnitUpgradeDecision !== null
      && (
        shouldLockInBossSpecialUnitUpgrade(helperPlayer, state)
        || (
          reserveBuyDecision !== null
          && specialUnitUpgradeDecision.score > reserveBuyDecision.score
        )
      );
    const shouldPreferSpecialUnitUpgrade = playerPhase === "purchase"
      && deployedSpecialUnit
      && specialUnitUpgradeDecision !== null
      && helperPlayer.role === "raid"
      && canPreferRaidSpecialUnitUpgradeWithBenchBacklog(helperPlayer, state)
      && (
        shouldLockInRaidSpecialUnitUpgrade(helperPlayer, state)
        || (
        (
          reserveBuyDecision !== null
          && (
            shouldForceRaidSpecialUnitUpgradeProgression(helperPlayer, reserveBuyDecision, state)
            || doesSpecialUnitUpgradeOutrankReserveBuy(
              currentSpecialUnitLevel,
              specialUnitUpgradeDecision.score,
              reserveBuyDecision.score,
              specialUnitUpgradeDecision.valueScore,
            )
          )
        )
        || (
          reserveBuyDecision === null
          && (
            !canRefreshReserveShop(helperPlayer, helperStrategy)
            || shouldPreferRaidSpecialUnitUpgradeOverRefresh(helperPlayer, state)
          )
        )
        )
      );
    const reserveManagementAction = buildReserveManagementAction(
      helperPlayer,
      reserveBuyAction,
      helperStrategy,
      playerPhase,
      state,
    );
    const deployActions = hasUnits(helperPlayer.benchUnits)
      ? buildDeployActions(
        helperPlayer.role,
        helperIndex,
        helperPlayer.boardUnits,
        helperPlayer.boardSubUnits,
        helperPlayer.benchUnits,
        helperPlayer.selectedHeroId,
        helperPlayer.selectedBossId,
      )
      : [];

    if (shouldPreferBossSpecialUnitUpgrade || shouldPreferSpecialUnitUpgrade) {
      return [specialUnitUpgradeDecision.action];
    }

    if (reserveManagementAction) {
      return [reserveManagementAction];
    }

    if (shouldPrioritizeReserveBuyBeforeDeploy(helperPlayer, reserveBuyAction, playerPhase, helperStrategy)) {
      return [reserveBuyAction];
    }

    if (playerPhase === "purchase") {
      if (reserveBuyAction) {
        return [reserveBuyAction];
      }

      if (specialUnitUpgradeDecision) {
        return [specialUnitUpgradeDecision.action];
      }

      if (
        placedPurchasedUnitCount === 0
        && !Number.isFinite(helperPlayer.gold)
      ) {
        if (helperPlayer.role === "boss" && hasOffers(helperPlayer.bossShopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { bossShopBuySlotIndex: 0 },
            },
          ];
        }

        if (helperPlayer.role === "boss" && hasOffers(helperPlayer.shopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { shopBuySlotIndex: 0 },
            },
          ];
        }

        if (helperPlayer.role === "raid" && hasOffers(helperPlayer.shopOffers)) {
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
      if (hasUnits(helperPlayer.benchUnits)) {
        if (deployActions.length === 0) {
          return helperPlayer.ready !== true
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
        && !hasUnits(helperPlayer.benchUnits)
        && !hasOffers(reserveOffers)
      ) {
        return [];
      }

      return helperPlayer.ready !== true
        ? [
            {
              type: "ready",
              payload: { ready: true },
            },
          ]
        : [];
    }

    if (hasUnits(helperPlayer.benchUnits)) {
      if (deployActions.length === 0) {
        return helperPlayer.ready !== true
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

    if (reserveBuyAction) {
      return [reserveBuyAction];
    }

    if (specialUnitUpgradeDecision) {
      return [specialUnitUpgradeDecision.action];
    }

    if (
      placedPurchasedUnitCount === 0
      && !Number.isFinite(helperPlayer.gold)
    ) {
      if (helperPlayer.role === "boss" && hasOffers(helperPlayer.bossShopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { bossShopBuySlotIndex: 0 },
          },
        ];
      }

      if (helperPlayer.role === "boss" && hasOffers(helperPlayer.shopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { shopBuySlotIndex: 0 },
          },
        ];
      }

      if (helperPlayer.role === "raid" && hasOffers(helperPlayer.shopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { shopBuySlotIndex: 0 },
          },
        ];
      }
    }

    if (!Number.isFinite(helperPlayer.gold) && placedPurchasedUnitCount > 0) {
      return [];
    }

    if (
      placedPurchasedUnitCount === 0
      && !hasUnits(helperPlayer.benchUnits)
      && !hasOffers(reserveOffers)
    ) {
      return [];
    }

    if (helperPlayer.ready !== true) {
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
