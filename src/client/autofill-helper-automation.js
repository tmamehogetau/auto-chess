import { HERO_EXCLUSIVE_UNITS } from "../data/hero-exclusive-units";
import { HEROES } from "../data/heroes";
import { getScarletMansionUnitById } from "../data/scarlet-mansion-units";
import { getTouhouUnitById } from "../data/touhou-units";
import { BOSS_CHARACTERS } from "../shared/boss-characters";
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
const AUTO_FILL_OPTIMIZATION_VARIANT_FULL = "full";
const AUTO_FILL_OPTIMIZATION_VARIANTS = new Set([
  AUTO_FILL_OPTIMIZATION_VARIANT_FULL,
  "raid-optimization-off",
  "boss-optimization-off",
  "all-optimization-off",
  "board-refit-off",
  "raid-board-refit-off",
  "boss-board-refit-off",
  "future-shop-off",
  "okina-host-off",
]);
const SPECIAL_UNIT_PROGRESSION_BONUS_BY_ID = Object.fromEntries([
  ...HEROES.map((unit) => [unit.id, unit.progressionBonus]),
  ...HERO_EXCLUSIVE_UNITS.map((unit) => [unit.unitId, unit.progressionBonus]),
  ...BOSS_CHARACTERS.map((unit) => [unit.id, unit.progressionBonus]),
]);
const AUTO_FILL_BOSS_DEPLOY_SEQUENCES = [
  [4, 10, 16, 3, 9, 15, 5, 11, 17, 1, 7, 13, 2, 8, 14, 0, 6, 12],
  [1, 7, 13, 0, 6, 12, 2, 8, 14, 3, 9, 15, 4, 10, 16, 5, 11, 17],
  [5, 11, 17, 4, 10, 16, 3, 9, 15, 2, 8, 14, 1, 7, 13, 0, 6, 12],
];
const SHARED_BOARD_WIDTH = 6;
const DEFAULT_BOSS_BODY_CELL = 2;
const AUTO_FILL_RAID_DEPLOY_SEQUENCES = [
  [31, 25, 19, 30, 24, 18, 32, 26, 20, 33, 27, 21, 34, 28, 22, 35, 29, 23],
  [33, 27, 21, 32, 26, 20, 34, 28, 22, 31, 25, 19, 35, 29, 23, 30, 24, 18],
  [35, 29, 23, 34, 28, 22, 33, 27, 21, 32, 26, 20, 31, 25, 19, 30, 24, 18],
];
const RAID_FINAL_BATTLE_ROUND_INDEX = 12;
const RAID_FINAL_FRONTLINE_FOCUS_CELLS_BY_HELPER_INDEX = [
  [19, 20, 21, 18, 22, 23],
  [21, 20, 19, 22, 18, 23],
  [20, 22, 21, 19, 23, 18],
];
const FRONTLINE_UNIT_TYPES = new Set(["vanguard"]);
const BACKLINE_UNIT_TYPES = new Set(["ranger", "mage"]);
const BOSS_OFFER_PRIORITY_BY_UNIT_ID = {
  sakuya: 240,
  meiling: 230,
  patchouli: 220,
};
const BOSS_EXCLUSIVE_CORE_UNIT_IDS = new Set(["meiling", "sakuya", "patchouli"]);
const BOSS_EXCLUSIVE_CORE_TARGET_COUNT = 2;
const BOSS_EXCLUSIVE_CORE_COMPLETION_BONUS_BY_UNIT_ID = {
  meiling: 760,
  sakuya: 900,
  patchouli: 1_250,
};
const BOSS_EXCLUSIVE_CORE_COMPLETE_DUPLICATE_BONUS = 140;
const BOSS_OFFENSE_CORE_PATCHOULI_MIN_ROUND = 8;
const BOSS_OFFENSE_CORE_PATCHOULI_MIN_BOSS_LEVEL = 7;
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
const BOSS_ROSTER_WIDTH_PRIORITY_BONUS = 360;
const BOSS_FRONTLINE_SCREEN_PRIORITY_BONUS = 520;
const BOSS_BACKLINE_CORE_PRIORITY_BONUS = 120;
const BOSS_THIN_ROSTER_EXPENSIVE_OFFER_PENALTY = 160;
const BOSS_LOW_DURABILITY_ESCORT_PENALTY = 240;
const BOSS_EARLY_FRAGILE_THIRD_SLOT_PENALTY = 180;
const BOSS_FRONTLINE_SCREEN_REFIT_READINESS_BONUS = 320;
const BOSS_MATURE_CARRY_PROTECTION_BONUS = 680;
const BOSS_MIN_RESERVE_BUY_SCORE = 80;
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
const RAID_FACTION_THRESHOLDS_BY_FACTION_ID = {
  chireiden: [2, 4],
  myourenji: [2, 3, 5],
  shinreibyou: [2, 3, 5],
  grassroot_network: [2, 3],
  kou_ryuudou: [2, 4],
  kanjuden: [2, 3],
};
const RAID_FACTION_TIER_COMPLETION_BONUS_BY_FACTION_ID = {
  chireiden: [200, 280],
  myourenji: [180, 140, 340],
  shinreibyou: [190, 160, 360],
  grassroot_network: [150, 130],
  kou_ryuudou: [180, 280],
  kanjuden: [260, 240],
};
const RAID_FACTION_BENCH_TIER_PLANNING_BONUS_RATIO = 0.65;
const RAID_DUPLICATE_BENCH_BONUS_PER_UNIT = 30;
const RAID_DUPLICATE_BENCH_BONUS_CAP = 60;
const RAID_PAIR_RESERVE_OFFER_BONUS = 180;
const RAID_ARCHETYPE_CONSTRUCTION_PLANS = [
  {
    planId: "zanmu_factionless_carry",
    anchorUnitId: "zanmu",
    unitIds: new Set(["zanmu", "junko", "seiga", "megumu", "kagerou"]),
    constructionStyle: "factionless_carry",
    anchorPresentBonus: 260,
    partialPlanBonus: 160,
  },
  {
    planId: "myourenji_core",
    anchorUnitId: "byakuren",
    unitIds: new Set(["byakuren", "nazrin", "ichirin", "murasa", "shou"]),
    anchorPresentBonus: 180,
    partialPlanBonus: 120,
  },
  {
    planId: "chireiden_core",
    anchorUnitId: "utsuho",
    unitIds: new Set(["utsuho", "rin", "satori", "koishi"]),
    anchorPresentBonus: 220,
    partialPlanBonus: 140,
  },
  {
    planId: "shinreibyou_core",
    anchorUnitId: "miko",
    unitIds: new Set(["miko", "yoshika", "seiga", "tojiko", "futo"]),
    anchorPresentBonus: 180,
    partialPlanBonus: 120,
  },
  {
    planId: "kou_ryuudou_core",
    anchorUnitId: "megumu",
    unitIds: new Set(["megumu", "tsukasa", "chimata", "momoyo"]),
    anchorPresentBonus: 260,
    partialPlanBonus: 160,
  },
  {
    planId: "grassroot_core",
    anchorUnitId: "kagerou",
    unitIds: new Set(["kagerou", "wakasagihime", "sekibanki"]),
    anchorPresentBonus: 120,
    partialPlanBonus: 80,
  },
];
const RAID_ARCHETYPE_BENCH_ANCHOR_KEEP_BONUS = 1_000;
const RAID_ARCHETYPE_BENCH_PARTIAL_KEEP_BONUS = 700;
const RAID_ARCHETYPE_COMMIT_CANDIDATE_BONUS = 0;
const RAID_ARCHETYPE_NEAR_COMPLETE_BONUS = 90;
const RAID_ARCHETYPE_FULL_COMPLETION_BONUS = 140;
const RAID_ARCHETYPE_BENCH_COMMIT_KEEP_BONUS = 0;
const RAID_ARCHETYPE_BENCH_NEAR_COMPLETE_KEEP_BONUS = 0;
const RAID_FACTIONLESS_CARRY_READY_UNIQUE_FACTION_COUNT = 3;
const RAID_ARCHETYPE_GRASSROOT_TEMPO_PLAN_ID = "grassroot_core";
const RAID_ARCHETYPE_GRASSROOT_TEMPO_START_ROUND = 3;
const RAID_ARCHETYPE_GRASSROOT_TEMPO_END_ROUND = 7;
const RAID_ARCHETYPE_GRASSROOT_TEMPO_NEAR_COMPLETE_BONUS = 0;
const RAID_ARCHETYPE_GRASSROOT_TEMPO_FULL_COMPLETION_BONUS = 120;
const RAID_ARCHETYPE_GRASSROOT_HIGH_COST_OPPORTUNITY_PENALTY = 700;
function isCollectiveRaidArchetypeConstructionPlan(plan) {
  return plan?.constructionStyle !== "factionless_carry";
}
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
const RAID_PAIR_SUB_TARGETS_BY_SUB_UNIT_ID = {
  seiga: new Set(["yoshika"]),
  satori: new Set(["koishi"]),
  koishi: new Set(["satori"]),
  hecatia: new Set(["junko"]),
  junko: new Set(["hecatia"]),
  tsukasa: new Set(["megumu"]),
  nazrin: new Set(["shou"]),
  futo: new Set(["miko"]),
  tojiko: new Set(["miko"]),
  mayumi: new Set(["keiki"]),
  shion: new Set(["jyoon"]),
};
const HERO_EXCLUSIVE_FIRST_COPY_BONUS = 80;
const HERO_EXCLUSIVE_DUPLICATE_BONUS = 120;
const AUTO_FILL_BENCH_CAPACITY = 8;
const AUTO_FILL_SHOP_REFRESH_GOLD_COST = 2;
const AUTO_FILL_UPGRADE_REFRESH_GOLD_FLOOR = 2;
const AUTO_FILL_HIGH_COST_REFRESH_GOLD_FLOOR = 4;
const AUTO_FILL_RESERVE_SELL_SCORE_MARGIN = 80;
const BOSS_OPEN_SLOT_RESERVE_BUY_SCORE_FLOOR = 240;
const AUTO_FILL_UPGRADE_PIVOT_ROUND = 8;
const AUTO_FILL_UPGRADE_PIVOT_LEVEL = 5;
const AUTO_FILL_HIGH_COST_PIVOT_ROUND = 6;
const AUTO_FILL_HIGH_COST_PIVOT_LEVEL = 4;
const AUTO_FILL_PIVOT_HIGH_COST_PREMIUM = 260;
const AUTO_FILL_PIVOT_LOW_COST_PENALTY = 220;
const AUTO_FILL_BOARD_REFIT_BASE_MARGIN = 180;
const AUTO_FILL_BOARD_REFIT_LEVELED_LOW_COST_MARGIN = 120;
const AUTO_FILL_BOARD_REFIT_BENCH_CAPACITY = AUTO_FILL_BENCH_CAPACITY;
const AUTO_FILL_FUTURE_RESERVE_BENCH_PRESSURE_LIMIT = 0.625;
const AUTO_FILL_FUTURE_RESERVE_VALUE_FLOOR = 700;
const BOSS_FUTURE_RESERVE_BENCH_PRESSURE_LIMIT = 0.5;
const BOSS_FUTURE_RESERVE_VALUE_FLOOR = 820;
const BOSS_FUTURE_RESERVE_MIN_ROUND = AUTO_FILL_HIGH_COST_PIVOT_ROUND;
const BOSS_FUTURE_RESERVE_MIN_SPECIAL_LEVEL = AUTO_FILL_HIGH_COST_PIVOT_LEVEL;
const BOSS_BODY_GUARD_MOVE_MIN_ROUND = 10;

function normalizeAutoFillOptimizationVariant(value) {
  return typeof value === "string" && AUTO_FILL_OPTIMIZATION_VARIANTS.has(value)
    ? value
    : AUTO_FILL_OPTIMIZATION_VARIANT_FULL;
}

function isRoleOptimizationDisabled(role, optimizationVariant) {
  return optimizationVariant === "all-optimization-off"
    || (role === "raid" && optimizationVariant === "raid-optimization-off")
    || (role === "boss" && optimizationVariant === "boss-optimization-off");
}

function isBoardRefitOptimizationDisabled(role, optimizationVariant) {
  return isRoleOptimizationDisabled(role, optimizationVariant)
    || optimizationVariant === "board-refit-off"
    || (role === "raid" && optimizationVariant === "raid-board-refit-off")
    || (role === "boss" && optimizationVariant === "boss-board-refit-off");
}

function isFutureShopOptimizationDisabled(role, optimizationVariant) {
  return isRoleOptimizationDisabled(role, optimizationVariant)
    || optimizationVariant === "future-shop-off";
}

function isOkinaHostOptimizationDisabled(role, optimizationVariant) {
  return isRoleOptimizationDisabled(role, optimizationVariant)
    || optimizationVariant === "okina-host-off";
}
const AUTO_FILL_LATE_SPECIAL_UNIT_UPGRADE_SCORE_MARGIN = 30;
const AUTO_FILL_LATE_SPECIAL_UNIT_UPGRADE_VALUE_FLOOR = 7.5;
const RAID_SPECIAL_UNIT_UPGRADE_SCORE_WEIGHT = 36;
const BOSS_SPECIAL_UNIT_UPGRADE_SCORE_WEIGHT = 44;
const BOSS_SPECIAL_UNIT_UPGRADE_ESTABLISHED_ROSTER_BONUS = 80;
const BOSS_SPECIAL_UNIT_UPGRADE_EARLY_LEVEL_BONUS = 45;
const BOSS_SPECIAL_UNIT_UPGRADE_ROUND_BONUS_CAP = 36;
const OKINA_FRONT_SUPPORT_UPTIME_ESTIMATE = 1;
const OKINA_BACK_SUPPORT_UPTIME_ESTIMATE = 6 / 13;
const OKINA_BACK_FRONT_ADVANTAGE_RATIO = 1.15;
const OKINA_REHOST_ADVANTAGE_RATIO = 1.2;
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

function parseBenchUnitId(value, fallbackUnitId = "") {
  const unitId = value && typeof value === "object"
    ? value.unitId
    : fallbackUnitId;

  return normalizeUnitId(unitId);
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

function buildRaidFinalFrontlineFocusDeploySequence(deploySequence, helperIndex) {
  const preferredFrontlineCells = RAID_FINAL_FRONTLINE_FOCUS_CELLS_BY_HELPER_INDEX[
    helperIndex % RAID_FINAL_FRONTLINE_FOCUS_CELLS_BY_HELPER_INDEX.length
  ];
  const seenCells = new Set(preferredFrontlineCells);
  return [
    ...preferredFrontlineCells,
    ...buildFrontlinePreferredDeploySequence(deploySequence).filter((cell) => !seenCells.has(cell)),
  ];
}

function getBoardCellCoordinate(cell) {
  return {
    x: cell % SHARED_BOARD_WIDTH,
    y: Math.floor(cell / SHARED_BOARD_WIDTH),
  };
}

function resolveBossBodyCell(boardUnits, selectedBossId = "") {
  const normalizedSelectedBossId = normalizeUnitId(selectedBossId) || AUTO_FILL_BOSS_ID;
  const bossPlacement = toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)
    .find((placement) => normalizeUnitId(placement.unitId) === normalizedSelectedBossId);

  return bossPlacement?.cell ?? DEFAULT_BOSS_BODY_CELL;
}

function buildBossFrontlineGuardDeploySequence(deploySequence, boardUnits, selectedBossId = "") {
  const bossCell = resolveBossBodyCell(boardUnits, selectedBossId);
  const bossCoordinate = getBoardCellCoordinate(bossCell);
  const originalOrderByCell = new Map(deploySequence.map((cell, index) => [cell, index]));

  return [...deploySequence].sort((leftCell, rightCell) => {
    const scoreCell = (cell) => {
      const coordinate = getBoardCellCoordinate(cell);
      const forwardSteps = coordinate.y - bossCoordinate.y;
      const laneDistance = Math.abs(coordinate.x - bossCoordinate.x);
      const originalOrder = originalOrderByCell.get(cell) ?? deploySequence.length;

      if (forwardSteps <= 0) {
        return 10_000 + laneDistance * 100 + Math.abs(forwardSteps) * 10 + originalOrder;
      }

      return laneDistance * 100 + forwardSteps * 10 + originalOrder / 100;
    };

    return scoreCell(leftCell) - scoreCell(rightCell);
  });
}

function buildBossSakuyaFlankDeploySequence(deploySequence, boardUnits, selectedBossId = "") {
  const bossCell = resolveBossBodyCell(boardUnits, selectedBossId);
  const bossCoordinate = getBoardCellCoordinate(bossCell);
  const originalOrderByCell = new Map(deploySequence.map((cell, index) => [cell, index]));

  return [...deploySequence].sort((leftCell, rightCell) => {
    const scoreCell = (cell) => {
      const coordinate = getBoardCellCoordinate(cell);
      const forwardSteps = coordinate.y - bossCoordinate.y;
      const laneDistance = Math.abs(coordinate.x - bossCoordinate.x);
      const originalOrder = originalOrderByCell.get(cell) ?? deploySequence.length;

      if (forwardSteps === 1 && laneDistance === 1 && coordinate.x < bossCoordinate.x) {
        return originalOrder / 100;
      }

      if (forwardSteps === 1 && laneDistance === 0) {
        return 100 + originalOrder / 100;
      }

      if (forwardSteps === 2 && laneDistance === 1) {
        const rightSideBonus = coordinate.x > bossCoordinate.x ? 0 : 1;
        return 200 + rightSideBonus + originalOrder / 100;
      }

      if (forwardSteps === 1 && laneDistance === 1) {
        return 300 + coordinate.x + originalOrder / 100;
      }

      if (forwardSteps > 0) {
        return 1_000 + laneDistance * 100 + Math.abs(forwardSteps - 1) * 10 + originalOrder / 100;
      }

      return 10_000 + laneDistance * 100 + Math.abs(forwardSteps) * 10 + originalOrder;
    };

    return scoreCell(leftCell) - scoreCell(rightCell);
  });
}

function buildBossProtectedBacklineDeploySequence(deploySequence, boardUnits, selectedBossId = "") {
  const bossCell = resolveBossBodyCell(boardUnits, selectedBossId);
  const bossCoordinate = getBoardCellCoordinate(bossCell);
  const originalOrderByCell = new Map(deploySequence.map((cell, index) => [cell, index]));

  return [...deploySequence].sort((leftCell, rightCell) => {
    const scoreCell = (cell) => {
      const coordinate = getBoardCellCoordinate(cell);
      const forwardSteps = coordinate.y - bossCoordinate.y;
      const laneDistance = Math.abs(coordinate.x - bossCoordinate.x);
      const originalOrder = originalOrderByCell.get(cell) ?? deploySequence.length;

      if (forwardSteps === 0 && laneDistance === 1) {
        return originalOrder / 100;
      }

      if (forwardSteps === 1 && laneDistance === 1) {
        return 100 + originalOrder / 100;
      }

      if (forwardSteps === 0 && laneDistance === 2) {
        return 200 + originalOrder / 100;
      }

      if (forwardSteps > 0) {
        return 1_000 + laneDistance * 100 + forwardSteps * 10 + originalOrder / 100;
      }

      return 10_000 + laneDistance * 100 + Math.abs(forwardSteps) * 10 + originalOrder;
    };

    return scoreCell(leftCell) - scoreCell(rightCell);
  });
}

function sortDeployCellsForUnitType(
  role,
  helperIndex,
  unitType,
  unitId,
  deployCells,
  boardUnits = [],
  selectedBossId = "",
  roundIndex = null,
) {
  const deploySequence = getDeploySequence(role, helperIndex) ?? [];
  const availableCells = new Set(deployCells);
  const normalizedUnitType = normalizeUnitType(unitType);
  const normalizedUnitId = normalizeUnitId(unitId);
  const preferredSequence = role === "boss" && normalizedUnitId === "sakuya"
    ? buildBossSakuyaFlankDeploySequence(deploySequence, boardUnits, selectedBossId)
    : role === "boss" && isBacklineUnitType(normalizedUnitType)
    ? buildBossProtectedBacklineDeploySequence(deploySequence, boardUnits, selectedBossId)
    : role === "boss" && isFrontlineUnitType(normalizedUnitType)
    ? buildBossFrontlineGuardDeploySequence(deploySequence, boardUnits, selectedBossId)
    : role === "raid"
      && isFrontlineUnitType(normalizedUnitType)
      && roundIndex !== null
      && roundIndex >= RAID_FINAL_BATTLE_ROUND_INDEX
    ? buildRaidFinalFrontlineFocusDeploySequence(deploySequence, helperIndex)
    : isFrontlineUnitType(normalizedUnitType)
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

function getDeployEntryCombatValueScore(entry) {
  const unitId = normalizeUnitId(entry?.unitId);
  const unitType = getDeployEntryUnitType(entry);
  const knownUnit = getKnownCombatUnit(unitId);
  const cost = resolveOptimizationUnitCost(entry, knownUnit);
  const unitLevel = resolveOptimizationUnitLevel(entry?.unitLevel);
  return getBoardCurrentPowerScore(
    {
      unitId,
      unitType,
      cost,
      unitLevel,
    },
    {},
    knownUnit,
  ) + cost * 120 + Math.max(0, unitLevel - 1) * 60;
}

function getDeployEntryUnitType(entry) {
  const unitId = normalizeUnitId(entry?.unitId);
  const knownUnitType = normalizeUnitType(getKnownCombatUnit(unitId)?.unitType);
  return knownUnitType || normalizeUnitType(entry?.unitType);
}

function isFactionlessCarryAnchorUnitId(unitId) {
  const normalizedUnitId = normalizeUnitId(unitId);
  return RAID_ARCHETYPE_CONSTRUCTION_PLANS.some((plan) =>
    !isCollectiveRaidArchetypeConstructionPlan(plan)
    && plan.anchorUnitId === normalizedUnitId);
}

function getFactionlessCarryAnchorPlan(unitId) {
  const normalizedUnitId = normalizeUnitId(unitId);
  return RAID_ARCHETYPE_CONSTRUCTION_PLANS.find((plan) =>
    !isCollectiveRaidArchetypeConstructionPlan(plan)
    && plan.anchorUnitId === normalizedUnitId) ?? null;
}

function getKnownUnitFactionId(unitId, fallbackFactionId = "") {
  const knownFactionId = getKnownTouhouUnit(unitId)?.factionId;
  if (typeof knownFactionId === "string" && knownFactionId.length > 0) {
    return normalizeUnitId(knownFactionId);
  }

  return normalizeUnitId(fallbackFactionId);
}

function countFactionlessCarrySupportFactions(
  anchorUnitId,
  benchEntries = [],
  boardUnits = [],
  boardSubUnits = [],
  selectedHeroId = "",
  selectedBossId = "",
) {
  const normalizedAnchorUnitId = normalizeUnitId(anchorUnitId);
  if (!getFactionlessCarryAnchorPlan(normalizedAnchorUnitId)) {
    return 0;
  }

  const excludedUnitIds = new Set([
    normalizedAnchorUnitId,
    normalizeUnitId(selectedHeroId),
    normalizeUnitId(selectedBossId),
  ].filter(Boolean));
  const supportFactionIds = new Set();
  const addSupportFaction = (unitId, fallbackFactionId = "") => {
    const normalizedUnitId = normalizeUnitId(unitId);
    if (!normalizedUnitId || excludedUnitIds.has(normalizedUnitId)) {
      return;
    }

    const factionId = getKnownUnitFactionId(normalizedUnitId, fallbackFactionId);
    if (factionId) {
      supportFactionIds.add(factionId);
    }
  };

  for (const placement of toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)) {
    addSupportFaction(placement.unitId, placement.factionId);
  }

  for (const unitId of getAttachedBoardSubUnitIds(
    boardUnits,
    boardSubUnits,
    selectedHeroId,
    selectedBossId,
  )) {
    addSupportFaction(unitId);
  }

  for (const benchEntry of toArray(benchEntries)) {
    addSupportFaction(benchEntry?.unitId, benchEntry?.factionId);
  }

  return supportFactionIds.size;
}

function annotateFactionlessCarryDeployReadiness(
  benchEntries,
  boardUnits,
  boardSubUnits,
  selectedHeroId = "",
  selectedBossId = "",
) {
  return benchEntries.map((entry) => {
    if (!isFactionlessCarryAnchorUnitId(entry?.unitId)) {
      return entry;
    }

    const supportFactionCount = countFactionlessCarrySupportFactions(
      entry.unitId,
      benchEntries,
      boardUnits,
      boardSubUnits,
      selectedHeroId,
      selectedBossId,
    );
    return {
      ...entry,
      factionlessCarrySupportFactionCount: supportFactionCount,
      factionlessCarryReady:
        supportFactionCount >= RAID_FACTIONLESS_CARRY_READY_UNIQUE_FACTION_COUNT,
    };
  });
}

function getDeployEntryStrategicPriority(entry, role = "") {
  if (
    role === "raid"
    && isFactionlessCarryAnchorUnitId(entry?.unitId)
    && entry?.factionlessCarryReady === true
  ) {
    return -1;
  }

  return getDeployPriorityForUnitType(getDeployEntryUnitType(entry));
}

function compareDeployEntries(leftEntry, rightEntry, role = "") {
  return getDeployEntryStrategicPriority(leftEntry, role)
    - getDeployEntryStrategicPriority(rightEntry, role)
    || getDeployEntryCombatValueScore(rightEntry) - getDeployEntryCombatValueScore(leftEntry)
    || leftEntry.benchIndex - rightEntry.benchIndex;
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

function toFiniteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function resolveOptimizationUnitLevel(value) {
  return Math.max(1, Math.trunc(toFiniteNumber(value, 1)));
}

function resolveOptimizationUnitCost(entry, knownUnit = null) {
  const explicitCost = toFiniteNumber(entry?.cost, Number.NaN);
  if (Number.isFinite(explicitCost) && explicitCost > 0) {
    return explicitCost;
  }

  const knownCost = toFiniteNumber(knownUnit?.cost, Number.NaN);
  return Number.isFinite(knownCost) && knownCost > 0 ? knownCost : 0;
}

function getKnownUnitEffectiveHp(unit) {
  if (!unit || !Number.isFinite(unit.hp)) {
    return 0;
  }

  const damageReduction = Number.isFinite(unit.damageReduction)
    ? Math.max(0, Math.min(90, unit.damageReduction))
    : 0;
  return unit.hp / Math.max(0.1, 1 - damageReduction / 100);
}

export function getBoardCurrentPowerScore(entry, context = {}, knownUnit = null) {
  const unitType = normalizeUnitType(knownUnit?.unitType ?? entry?.unitType);
  const unitLevel = resolveOptimizationUnitLevel(entry?.unitLevel);
  const levelMultiplier = 1 + (unitLevel - 1) * 0.3;
  const attack = toFiniteNumber(knownUnit?.attack, unitType === "mage" || unitType === "ranger" ? 52 : 46);
  const attackSpeed = toFiniteNumber(knownUnit?.attackSpeed, 1);
  const critMultiplier = getOkinaHostExpectedCritMultiplier(knownUnit);
  const range = toFiniteNumber(
    knownUnit?.range,
    unitType === "vanguard" || unitType === "assassin" ? 1 : 3,
  );
  const rangeFactor = range >= 3 ? 1.12 : 1;
  const effectiveHp = getKnownUnitEffectiveHp(knownUnit);
  const durabilityValue = effectiveHp > 0 ? effectiveHp * 0.08 : 36;

  return Math.round((attack * attackSpeed * critMultiplier * rangeFactor * 5 + durabilityValue) * levelMultiplier);
}

export function getFutureValueScore(entry, context = {}, knownUnit = null) {
  const unitId = normalizeUnitId(entry?.unitId);
  const unitType = normalizeUnitType(knownUnit?.unitType ?? entry?.unitType);
  const unitCost = resolveOptimizationUnitCost(entry, knownUnit);
  const player = context?.player ?? null;
  const role = player?.role ?? context?.role ?? "";
  const strategy = normalizeAutoFillStrategy(context?.strategy);
  const offerLike = {
    unitId,
    unitType,
    cost: unitCost,
  };
  const existingScore = role === "boss"
    ? getBossOfferPriorityScore(
      offerLike,
      player?.boardUnits,
      player?.benchUnitIds,
      strategy,
      player?.benchUnits,
      context?.state,
      player,
    )
    : role === "raid"
    ? getRaidOfferPriorityScore(
      offerLike,
      player?.boardUnits,
      player?.benchUnitIds,
      strategy,
      player?.benchUnits,
      player?.boardSubUnits,
      context?.state,
    )
    : getLegacyBenchUnitPriorityScore(role, unitType, unitId, strategy);
  const highCostBonus = unitCost >= 4 ? 180 + (unitCost - 4) * 90 : 0;
  const heroExclusiveBonus = getKnownHeroExclusiveUnit(unitId) ? 220 : 0;
  const bossExclusiveBonus = BOSS_EXCLUSIVE_CORE_UNIT_IDS.has(unitId) ? 120 : 0;

  return Math.round(unitCost * 95 + existingScore * 0.35 + highCostBonus + heroExclusiveBonus + bossExclusiveBonus);
}

export function getTransitionReadinessScore(entry, context = {}, knownUnit = null) {
  const unitLevel = resolveOptimizationUnitLevel(entry?.unitLevel);
  const unitCost = resolveOptimizationUnitCost(entry, knownUnit);
  const roundIndex = getStateRoundIndex(context?.state);
  const roundBonus = roundIndex === null ? 0 : Math.min(Math.max(roundIndex - 4, 0) * 16, 96);
  const levelBonus = Math.max(0, unitLevel - 1) * 80;
  const highCostReadiness = unitCost >= 4
    ? unitLevel >= 4
      ? 260
      : unitLevel >= 2
      ? 120
      : 35
    : 0;

  return Math.round(
    levelBonus
      + highCostReadiness
      + roundBonus
      + getBossFrontlineScreenRefitReadinessBonus(entry, context, knownUnit),
  );
}

function getBossFrontlineScreenRefitReadinessBonus(entry, context = {}, knownUnit = null) {
  const player = context?.player ?? null;
  if (player?.role !== "boss" || entry?.source !== "bench") {
    return 0;
  }

  const unitType = normalizeUnitType(knownUnit?.unitType ?? entry?.unitType);
  if (!isFrontlineUnitType(unitType)) {
    return 0;
  }

  const boardFrontlineCount = toArray(player?.boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null && isFrontlineUnitType(placement.unitType))
    .length;
  const desiredFrontlineCount = getBossDesiredFrontlineCount(getStateRoundIndex(context?.state));

  return boardFrontlineCount < desiredFrontlineCount
    ? BOSS_FRONTLINE_SCREEN_REFIT_READINESS_BONUS
    : 0;
}

function getBoardSubUnitIdFromToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    return "";
  }

  const parts = token.split(":");
  if (parts.length >= 3) {
    return normalizeUnitId(parts[2]);
  }

  return normalizeUnitId(parts[1] ?? parts[0]);
}

function hasBoardSubUnitAtCell(boardSubUnits, cell) {
  return toArray(boardSubUnits).some((token) => parseBoardCell(token) === cell);
}

function getBoardSubUnitIdAtCell(boardSubUnits, cell) {
  const token = toArray(boardSubUnits).find((candidate) => parseBoardCell(candidate) === cell);
  return getBoardSubUnitIdFromToken(token);
}

function getRaidArchetypeConstructionProtectionDetail(unitId, player = null) {
  const normalizedUnitId = normalizeUnitId(unitId);
  if (player?.role !== "raid" || !normalizedUnitId) {
    return null;
  }

  const ownedUnitIds = new Set(getRaidOwnedUnitIdsForShopEvaluation(
    player?.boardUnits,
    player?.benchUnitIds,
    player?.boardSubUnits,
  ));
  if (!ownedUnitIds.has(normalizedUnitId)) {
    ownedUnitIds.add(normalizedUnitId);
  }

  let bestDetail = null;
  for (const plan of RAID_ARCHETYPE_CONSTRUCTION_PLANS) {
    if (!plan.unitIds.has(normalizedUnitId)) {
      continue;
    }

    const isCollectivePlan = isCollectiveRaidArchetypeConstructionPlan(plan);
    const ownedPlanUnitCount = [...ownedUnitIds]
      .filter((ownedUnitId) => plan.unitIds.has(ownedUnitId))
      .length;
    if (!isCollectivePlan && normalizedUnitId !== plan.anchorUnitId) {
      continue;
    }
    if (!isCollectivePlan && ownedUnitIds.has(plan.anchorUnitId)) {
      return {
        planId: plan.planId,
        anchorPresent: true,
        commitReady: false,
        nearComplete: false,
        ownedPlanUnitCount,
        missingPlanUnitCount: Math.max(0, plan.unitIds.size - ownedPlanUnitCount),
        priority: 2,
      };
    }
    if (ownedPlanUnitCount < 2) {
      continue;
    }

    const anchorPresent = ownedUnitIds.has(plan.anchorUnitId);
    const missingPlanUnitCount = Math.max(0, plan.unitIds.size - ownedPlanUnitCount);
    const commitReady = anchorPresent && ownedPlanUnitCount >= 3;
    const nearComplete = missingPlanUnitCount <= 1;
    const priority = nearComplete ? 4 : commitReady ? 3 : anchorPresent ? 2 : 1;
    if (bestDetail === null || priority > bestDetail.priority) {
      bestDetail = {
        planId: plan.planId,
        anchorPresent,
        commitReady,
        nearComplete,
        ownedPlanUnitCount,
        missingPlanUnitCount,
        priority,
      };
    }
  }

  return bestDetail;
}

export function getReplacementProtectionScore(entry, context = {}) {
  if (entry?.source !== "board") {
    return { score: 0, reasons: [] };
  }

  const player = context?.player ?? null;
  const placements = toArray(player?.boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null);
  const unitId = normalizeUnitId(entry?.unitId);
  const unitType = normalizeUnitType(entry?.unitType);
  const unitLevel = resolveOptimizationUnitLevel(entry?.unitLevel);
  const unitCost = resolveOptimizationUnitCost(entry, getKnownCombatUnit(unitId));
  const reasons = [];
  let score = 0;

  if (!unitId || unitId === normalizeUnitId(player?.selectedHeroId) || unitId === normalizeUnitId(player?.selectedBossId)) {
    reasons.push("special_unit");
    score += 10_000;
  }

  if (AUTO_FILL_SPECIAL_UNIT_IDS.has(unitId)) {
    reasons.push("special_unit");
    score += 10_000;
  }

  const canPivotFromMeilingToSakuyaPatchouli = player?.role === "boss"
    && unitId === "meiling"
    && hasSakuyaPatchouliCore(player);

  if (
    player?.role === "boss"
    && BOSS_EXCLUSIVE_CORE_UNIT_IDS.has(unitId)
    && !canPivotFromMeilingToSakuyaPatchouli
  ) {
    reasons.push("boss_exclusive_core");
    score += 800;
  }

  const attachedSubUnitId = normalizeUnitId(entry?.subUnit?.unitId ?? entry?.subUnit?.detail);
  const boardSubUnitId = getBoardSubUnitIdAtCell(player?.boardSubUnits, entry?.cell);
  const resolvedSubUnitId = attachedSubUnitId || boardSubUnitId;
  if (entry?.subUnit !== undefined || hasBoardSubUnitAtCell(player?.boardSubUnits, entry?.cell)) {
    reasons.push("sub_host");
    score += 600;
  }

  if (resolvedSubUnitId && getRaidPairSubAttachmentScore(unitId, resolvedSubUnitId) > 0) {
    reasons.push("pair_anchor");
    score += 500;
  }

  if (unitCost <= 2 && unitLevel >= 4) {
    reasons.push("leveled_low_cost");
    score += 260 + (unitLevel - 4) * 40;
  }

  if (player?.role === "boss" && isFrontlineUnitType(unitType)) {
    const frontlineCount = placements.filter((placement) => isFrontlineUnitType(placement.unitType)).length;
    if (frontlineCount <= getBossDesiredFrontlineCount(getStateRoundIndex(context?.state))) {
      reasons.push("frontline_anchor");
      score += 320;
    }
  }

  if (
    player?.role === "boss"
    && isBacklineUnitType(unitType)
    && unitCost >= 4
    && unitLevel >= 4
  ) {
    const roundIndex = getStateRoundIndex(context?.state);
    const frontlineCount = placements.filter((placement) => isFrontlineUnitType(placement.unitType)).length;
    if (
      roundIndex !== null
      && roundIndex >= 9
      && frontlineCount >= getBossDesiredFrontlineCount(roundIndex)
    ) {
      reasons.push("mature_boss_carry");
      score += BOSS_MATURE_CARRY_PROTECTION_BONUS;
    }
  }

  return {
    score,
    reasons: Array.from(new Set(reasons)),
  };
}

export function buildOptimizationCandidate(entry, context = {}) {
  const unitId = normalizeUnitId(entry?.unitId);
  const knownUnit = getKnownCombatUnit(unitId);
  const unitType = normalizeUnitType(knownUnit?.unitType ?? entry?.unitType);
  const unitLevel = resolveOptimizationUnitLevel(entry?.unitLevel);
  const unitCost = resolveOptimizationUnitCost(entry, knownUnit);
  const protection = getReplacementProtectionScore(
    {
      ...entry,
      unitId,
      unitType,
      unitLevel,
      cost: unitCost,
    },
    context,
  );

  return {
    source: entry?.source === "board" ? "board" : "bench",
    index: Number.isInteger(entry?.index) ? entry.index : null,
    cell: Number.isInteger(entry?.cell) ? entry.cell : null,
    unitId,
    unitType,
    unitName: knownUnit?.displayName ?? knownUnit?.name ?? unitId,
    cost: unitCost,
    unitLevel,
    currentPowerScore: getBoardCurrentPowerScore(entry, context, knownUnit),
    futureValueScore: getFutureValueScore(entry, context, knownUnit),
    transitionReadinessScore: getTransitionReadinessScore(entry, context, knownUnit),
    protectionScore: protection.score,
    protectionReasons: protection.reasons,
  };
}

function getBoardRefitRoundFutureWeight(state = null) {
  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null || roundIndex < 4) {
    return 0.15;
  }
  if (roundIndex < 8) {
    return 0.35;
  }
  return 0.55;
}

function getBoardRefitReplacementMargin(outgoingCandidate) {
  const leveledLowCostMargin = outgoingCandidate.cost <= 2 && outgoingCandidate.unitLevel >= 4
    ? AUTO_FILL_BOARD_REFIT_LEVELED_LOW_COST_MARGIN
    : 0;
  return AUTO_FILL_BOARD_REFIT_BASE_MARGIN + leveledLowCostMargin;
}

function buildBenchOptimizationCandidates(player, state = null, strategy = "upgrade") {
  const benchUnits = toArray(player?.benchUnits);
  const benchUnitIds = toArray(player?.benchUnitIds);

  return benchUnits
    .map((unit, index) => {
      const unitId = parseBenchUnitId(unit, benchUnitIds[index]);
      return buildOptimizationCandidate({
        source: "bench",
        index,
        unitId,
        unitType: parseBenchUnitType(unit),
        unitLevel: unit && typeof unit === "object" ? unit.unitLevel : undefined,
        cost: unit && typeof unit === "object" ? unit.cost : undefined,
      }, {
        player,
        state,
        strategy,
      });
    })
    .filter((candidate) => candidate.unitId || candidate.unitType);
}

function buildBoardOptimizationCandidates(player, state = null, strategy = "upgrade") {
  return toArray(player?.boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)
    .map((placement) => buildOptimizationCandidate({
      source: "board",
      cell: placement.cell,
      unitId: placement.unitId,
      unitType: placement.unitType,
      unitLevel: placement.unitLevel,
      subUnit: placement.subUnit,
    }, {
      player,
      state,
      strategy,
    }))
    .filter((candidate) => candidate.protectionScore < 10_000);
}

function scoreIncomingBoardRefitCandidate(candidate, futureWeight) {
  return candidate.currentPowerScore
    + candidate.transitionReadinessScore
    + candidate.futureValueScore * futureWeight;
}

function scoreOutgoingBoardRefitCandidate(candidate) {
  return candidate.currentPowerScore
    + candidate.protectionScore
    + candidate.futureValueScore * 0.2;
}

export function buildBoardRefitDecision(player, state = null, options = {}) {
  const strategy = normalizeAutoFillStrategy(options?.strategy ?? player?.helperStrategy);
  const boardUnitCount = getPlacedStandardBoardUnitCount(
    player?.role,
    player?.boardUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  );
  const maxBoardUnitCount = getMaxStandardDeploySlotsForRole(player?.role);
  const benchUnitCount = toArray(player?.benchUnits).length;
  const boardAtCapacity = maxBoardUnitCount > 0 && boardUnitCount >= maxBoardUnitCount;
  const benchPressure = benchUnitCount / AUTO_FILL_BOARD_REFIT_BENCH_CAPACITY;
  const base = {
    roundIndex: getStateRoundIndex(state),
    role: player?.role === "boss" ? "boss" : player?.role === "raid" ? "raid" : "",
    boardAtCapacity,
    boardUnitCount,
    benchUnitCount,
    benchPressure,
    candidateCount: 0,
    outgoingCandidateCount: 0,
    incomingCandidate: null,
    outgoingCandidate: null,
    replacementScore: null,
    committed: false,
  };

  if (player?.role !== "boss" && player?.role !== "raid") {
    return {
      ...base,
      decision: "no_candidate",
      reason: "unsupported_role",
    };
  }

  if (!boardAtCapacity) {
    return {
      ...base,
      decision: "no_candidate",
      reason: "open_slot_available",
    };
  }

  const futureWeight = getBoardRefitRoundFutureWeight(state);
  const incomingCandidates = buildBenchOptimizationCandidates(player, state, strategy);
  const outgoingCandidates = buildBoardOptimizationCandidates(player, state, strategy);
  const bestIncoming = incomingCandidates
    .sort((left, right) =>
      scoreIncomingBoardRefitCandidate(right, futureWeight) - scoreIncomingBoardRefitCandidate(left, futureWeight)
      || right.futureValueScore - left.futureValueScore
      || left.index - right.index)[0] ?? null;
  const weakestOutgoing = outgoingCandidates
    .sort((left, right) =>
      scoreOutgoingBoardRefitCandidate(left) - scoreOutgoingBoardRefitCandidate(right)
      || left.currentPowerScore - right.currentPowerScore
      || (left.cell ?? 0) - (right.cell ?? 0))[0] ?? null;

  const withCandidates = {
    ...base,
    candidateCount: incomingCandidates.length,
    outgoingCandidateCount: outgoingCandidates.length,
    incomingCandidate: bestIncoming,
    outgoingCandidate: weakestOutgoing,
  };

  if (!bestIncoming) {
    return {
      ...withCandidates,
      decision: "no_candidate",
      reason: "no_incoming_candidate",
    };
  }

  if (!weakestOutgoing) {
    return {
      ...withCandidates,
      decision: "no_candidate",
      reason: "no_outgoing_candidate",
    };
  }

  const replacementScore = Math.round(
    scoreIncomingBoardRefitCandidate(bestIncoming, futureWeight)
      - weakestOutgoing.currentPowerScore
      - weakestOutgoing.protectionScore
      - getBoardRefitReplacementMargin(weakestOutgoing),
  );

  if (replacementScore > 0) {
    return {
      ...withCandidates,
      replacementScore,
      decision: "replace",
      reason: "replacement_ready",
    };
  }

  return {
    ...withCandidates,
    replacementScore,
    decision: "hold",
    reason: "insufficient_margin",
  };
}

function buildConservativeBoardRefitAction(player, state = null, playerPhase = "") {
  if (playerPhase === "purchase") {
    return null;
  }

  const roundIndex = getStateRoundIndex(state);
  if (
    roundIndex !== null
    && Number.isFinite(player?.lastBoardRefitRoundIndex)
    && Math.trunc(player.lastBoardRefitRoundIndex) === roundIndex
  ) {
    return null;
  }

  const diagnostic = buildBoardRefitDecision(player, state);
  const outgoingCell = diagnostic.outgoingCandidate?.cell;
  if (diagnostic.decision !== "replace" || !Number.isInteger(outgoingCell)) {
    return null;
  }

  return {
    type: "prep_command",
    payload: { boardSellIndex: outgoingCell },
  };
}

function buildBoardRefitFollowUpDeployAction(player, state = null, helperIndex = 0, strategy = "upgrade") {
  const roundIndex = getStateRoundIndex(state);
  if (
    roundIndex === null
    || !Number.isFinite(player?.lastBoardRefitRoundIndex)
    || Math.trunc(player.lastBoardRefitRoundIndex) !== roundIndex
    || !hasUnits(player?.benchUnits)
  ) {
    return null;
  }

  const existingMainUnitCount = getNonSpecialBoardUnitCount(
    player?.boardUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  );
  const remainingMainDeploySlots = Math.max(
    0,
    getMaxStandardDeploySlotsForRole(player?.role) - existingMainUnitCount,
  );
  const availableDeployCells = getAvailableDeployCells(player?.role, helperIndex, player?.boardUnits);
  if (remainingMainDeploySlots <= 0 || availableDeployCells.length <= 0) {
    return null;
  }

  const incomingCandidate = buildBenchOptimizationCandidates(player, state, strategy)
    .sort((leftCandidate, rightCandidate) =>
      rightCandidate.totalScore - leftCandidate.totalScore
      || rightCandidate.transitionReadinessScore - leftCandidate.transitionReadinessScore
      || leftCandidate.index - rightCandidate.index)[0];
  if (!incomingCandidate) {
    return null;
  }

  const preferredCells = sortDeployCellsForUnitType(
    player?.role,
    helperIndex,
    incomingCandidate.unitType,
    incomingCandidate.unitId,
    availableDeployCells,
    player?.boardUnits,
    player?.selectedBossId,
  );
  const targetCell = preferredCells[0];
  if (!Number.isInteger(targetCell)) {
    return null;
  }

  return {
    type: "prep_command",
    payload: {
      benchToBoardCell: {
        benchIndex: incomingCandidate.index,
        cell: targetCell,
      },
    },
  };
}

function isOkinaHeroSubToken(token) {
  if (typeof token === "string" && token.length > 0) {
    const parts = token.split(":");
    const unitType = parts.length >= 3 ? parts[1] : parts[0];
    const unitId = parts.length >= 3 ? parts[2] : parts[1];
    return normalizeUnitType(unitType) === "hero"
      && normalizeUnitId(unitId) === "okina";
  }

  if (token && typeof token === "object") {
    const unitType = token.unitType ?? token.type;
    const unitId = token.unitId ?? token.detail ?? token.id;
    return normalizeUnitType(unitType) === "hero"
      && normalizeUnitId(unitId) === "okina";
  }

  return false;
}

function getOkinaAttachedHostCell(boardSubUnits, boardUnits = []) {
  for (const token of toArray(boardSubUnits)) {
    if (!isOkinaHeroSubToken(token)) {
      continue;
    }

    const cell = parseBoardCell(token);
    if (cell !== null) {
      return cell;
    }
  }

  for (const placement of toArray(boardUnits).map((unit) => parseBoardPlacement(unit))) {
    if (placement && isOkinaHeroSubToken(placement.subUnit)) {
      return placement.cell;
    }
  }

  return null;
}

function getOkinaSpecialUnitStage(player) {
  const currentLevel = getClientSpecialUnitLevel(player);
  return currentLevel >= 7
    ? 7
    : currentLevel >= 4
    ? 4
    : 1;
}

function getOkinaFrontAttackMultiplier(stage) {
  if (stage >= 7) {
    return 1.3;
  }

  if (stage >= 4) {
    return 1.2;
  }

  return 1.1;
}

function getOkinaBackAttackMultiplier(stage) {
  if (stage >= 7) {
    return 1.85;
  }

  if (stage >= 4) {
    return 1.55;
  }

  return 1.3;
}

function getOkinaEquipmentBonus(stage) {
  if (stage >= 7) {
    return { attackBonus: 56, skillDamageMultiplier: 1.28 };
  }

  if (stage >= 4) {
    return { attackBonus: 34, skillDamageMultiplier: 1.17 };
  }

  return { attackBonus: 18, skillDamageMultiplier: 1.1 };
}

function getOkinaHostExpectedCritMultiplier(unit) {
  const critRate = Number.isFinite(unit?.critRate) ? Math.max(0, unit.critRate) : 0;
  const critDamageMultiplier = Number.isFinite(unit?.critDamageMultiplier)
    ? Math.max(1, unit.critDamageMultiplier)
    : 1.5;
  return 1 + critRate * (critDamageMultiplier - 1);
}

function getOkinaHostEffectiveHp(unit) {
  if (!unit || !Number.isFinite(unit.hp)) {
    return 0;
  }

  const damageReduction = Number.isFinite(unit.damageReduction)
    ? Math.max(0, Math.min(90, unit.damageReduction))
    : 0;
  return unit.hp / Math.max(0.1, 1 - damageReduction / 100);
}

function getOkinaHostStats(placement) {
  const unitId = normalizeUnitId(placement?.unitId);
  const knownUnit = getKnownCombatUnit(unitId);
  const unitType = normalizeUnitType(knownUnit?.unitType ?? placement?.unitType);
  const unitLevel = Number.isFinite(placement?.unitLevel)
    ? Math.max(1, Number(placement.unitLevel))
    : 1;
  const levelMultiplier = 1 + (unitLevel - 1) * 0.18;
  const attack = Number.isFinite(knownUnit?.attack)
    ? knownUnit.attack * levelMultiplier
    : 40 * levelMultiplier;
  const attackSpeed = Number.isFinite(knownUnit?.attackSpeed) ? knownUnit.attackSpeed : 1;
  const range = Number.isFinite(knownUnit?.range)
    ? knownUnit.range
    : unitType === "vanguard" || unitType === "assassin"
    ? 1
    : 3;

  return {
    attack,
    attackSpeed,
    critMultiplier: getOkinaHostExpectedCritMultiplier(knownUnit),
    knownUnit,
    range,
    unitLevel,
    unitType,
  };
}

function getOkinaPlacementDps(placement) {
  const stats = getOkinaHostStats(placement);
  return stats.attack * stats.attackSpeed * stats.critMultiplier;
}

function getOkinaFrontEquivalentValue(player, placements) {
  const stage = getOkinaSpecialUnitStage(player);
  const okinaBaseDps = 40 * 0.7;
  const alliedDps = placements.reduce((sum, placement) =>
    sum + getOkinaPlacementDps(placement), 0);
  const frontBuffValue = (alliedDps + okinaBaseDps)
    * Math.max(0, getOkinaFrontAttackMultiplier(stage) - 1)
    * OKINA_FRONT_SUPPORT_UPTIME_ESTIMATE;

  return okinaBaseDps + frontBuffValue;
}

function getOkinaBackHostGain(player, placement) {
  const stage = getOkinaSpecialUnitStage(player);
  const stats = getOkinaHostStats(placement);
  const equipmentBonus = getOkinaEquipmentBonus(stage);
  const attackAfterEquipment = stats.attack + equipmentBonus.attackBonus;
  const equipmentDpsGain = equipmentBonus.attackBonus * stats.attackSpeed * stats.critMultiplier;
  const backBuffDpsGain = attackAfterEquipment
    * stats.attackSpeed
    * stats.critMultiplier
    * Math.max(0, getOkinaBackAttackMultiplier(stage) - 1)
    * OKINA_BACK_SUPPORT_UPTIME_ESTIMATE;
  const skillMultiplierGain = getOkinaPlacementDps(placement)
    * Math.max(0, equipmentBonus.skillDamageMultiplier - 1)
    * 0.8;

  return equipmentDpsGain + backBuffDpsGain + skillMultiplierGain;
}

function getOkinaHeroSubHostPriorityScore(placement) {
  const unitId = normalizeUnitId(placement?.unitId);
  const knownUnit = getKnownCombatUnit(unitId);
  const unitType = normalizeUnitType(knownUnit?.unitType ?? placement?.unitType);
  const attack = Number.isFinite(knownUnit?.attack) ? knownUnit.attack : 40;
  const attackSpeed = Number.isFinite(knownUnit?.attackSpeed) ? knownUnit.attackSpeed : 1;
  const range = Number.isFinite(knownUnit?.range)
    ? knownUnit.range
    : unitType === "vanguard" || unitType === "assassin"
    ? 1
    : 3;
  const unitLevel = Number.isFinite(placement?.unitLevel)
    ? Math.max(1, Number(placement.unitLevel))
    : 1;
  const baseDps = attack * attackSpeed * getOkinaHostExpectedCritMultiplier(knownUnit);
  const heroExclusiveBonus = getKnownHeroExclusiveUnit(unitId) ? 420 : 0;
  const rangeBonus = range >= 3 ? 90 : 0;
  const classBonus = unitType === "mage"
    ? 140
    : unitType === "ranger"
    ? 120
    : unitType === "assassin"
    ? 80
    : 0;

  return baseDps * 8
    + getOkinaHostEffectiveHp(knownUnit) * 0.08
    + unitLevel * 120
    + rangeBonus
    + classBonus
    + heroExclusiveBonus;
}

function buildOkinaHeroSubHostCandidate(player, placement) {
  const optimizationCandidate = buildOptimizationCandidate(
    {
      ...placement,
      source: "board",
    },
    {
      player,
      role: "raid",
      strategy: player?.helperStrategy ?? "upgrade",
    },
  );

  return {
    placement,
    optimizationCandidate,
    hostPriorityScore: getOkinaHeroSubHostPriorityScore(placement)
      + optimizationCandidate.currentPowerScore * 0.05
      + optimizationCandidate.futureValueScore * 0.02
      + optimizationCandidate.transitionReadinessScore * 0.02,
  };
}

function isOkinaBackCarryHost(hostUnitId, hostUnitType, hostUnitLevel) {
  const isCarryClass = hostUnitType === "mage"
    || hostUnitType === "ranger"
    || getKnownHeroExclusiveUnit(hostUnitId) !== null;
  return isCarryClass && hostUnitLevel >= 4;
}

export function buildOkinaHeroSubDecisionDiagnostic(player) {
  if (
    player?.role !== "raid"
    || normalizeUnitId(player?.selectedHeroId) !== "okina"
  ) {
    return null;
  }

  const occupiedSubHostCells = getBoardSubUnitHostCells(player?.boardSubUnits);
  const okinaHostCell = getOkinaAttachedHostCell(player?.boardSubUnits, player?.boardUnits);
  const specialUnitIds = new Set(AUTO_FILL_SPECIAL_UNIT_IDS);
  for (const value of [player?.selectedHeroId, player?.selectedBossId]) {
    const normalizedValue = normalizeUnitId(value);
    if (normalizedValue) {
      specialUnitIds.add(normalizedValue);
    }
  }

  const placements = toArray(player?.boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null);
  const nonSpecialPlacements = placements.filter((placement) =>
    !specialUnitIds.has(normalizeUnitId(placement.unitId)));
  const currentHostPlacement = okinaHostCell === null
    ? null
    : nonSpecialPlacements.find((placement) => placement.cell === okinaHostCell) ?? null;
  const hostCandidates = nonSpecialPlacements
    .filter((placement) =>
      placement.cell !== okinaHostCell
      && placement.subUnit === undefined
      && !occupiedSubHostCells.has(placement.cell))
    .map((placement) => buildOkinaHeroSubHostCandidate(player, placement))
    .sort((left, right) =>
      right.hostPriorityScore - left.hostPriorityScore
      || left.placement.cell - right.placement.cell);
  const hostCandidate = hostCandidates[0] ?? null;
  const hostPlacement = hostCandidate?.placement ?? null;
  const frontEquivalentValue = getOkinaFrontEquivalentValue(player, nonSpecialPlacements);
  const currentHostGain = currentHostPlacement ? getOkinaBackHostGain(player, currentHostPlacement) : null;

  if (!hostPlacement) {
    return {
      specialUnitStage: getOkinaSpecialUnitStage(player),
      candidateCount: 0,
      attachedHostCell: okinaHostCell,
      currentHostUnitId: currentHostPlacement ? normalizeUnitId(currentHostPlacement.unitId) : null,
      currentHostGain,
      bestHostCell: null,
      bestHostUnitId: null,
      bestHostUnitType: null,
      bestHostUnitName: null,
      bestHostLevel: null,
      bestHostOptimizationCandidate: null,
      bestHostGain: null,
      frontEquivalentValue,
      bestToFrontRatio: null,
      bestToCurrentRatio: null,
      decision: currentHostPlacement ? "keep_current" : "keep_front",
      reason: currentHostPlacement ? "current_host_only" : "no_candidate",
    };
  }

  const hostGain = getOkinaBackHostGain(player, hostPlacement);
  const bestToFrontRatio = frontEquivalentValue > 0 ? hostGain / frontEquivalentValue : null;
  const bestToCurrentRatio = currentHostGain !== null && currentHostGain > 0
    ? hostGain / currentHostGain
    : null;
  const hostUnitId = normalizeUnitId(hostPlacement.unitId);
  const knownUnit = getKnownCombatUnit(hostUnitId);
  const hostUnitType = normalizeUnitType(knownUnit?.unitType ?? hostPlacement.unitType);
  const hostUnitName = knownUnit?.displayName ?? knownUnit?.name ?? hostUnitId;
  const hostStats = getOkinaHostStats(hostPlacement);

  if (!isOkinaBackCarryHost(hostUnitId, hostUnitType, hostStats.unitLevel)) {
    return {
      specialUnitStage: getOkinaSpecialUnitStage(player),
      candidateCount: hostCandidates.length,
      attachedHostCell: okinaHostCell,
      currentHostUnitId: currentHostPlacement ? normalizeUnitId(currentHostPlacement.unitId) : null,
      currentHostGain,
      bestHostCell: hostPlacement.cell,
      bestHostUnitId: hostUnitId,
      bestHostUnitType: hostUnitType,
      bestHostUnitName: hostUnitName,
      bestHostLevel: hostStats.unitLevel,
      bestHostOptimizationCandidate: hostCandidate.optimizationCandidate,
      bestHostGain: hostGain,
      frontEquivalentValue,
      bestToFrontRatio,
      bestToCurrentRatio,
      decision: currentHostPlacement ? "keep_current" : "keep_front",
      reason: "front_value_preferred",
    };
  }

  if (hostGain < frontEquivalentValue * OKINA_BACK_FRONT_ADVANTAGE_RATIO) {
    return {
      specialUnitStage: getOkinaSpecialUnitStage(player),
      candidateCount: hostCandidates.length,
      attachedHostCell: okinaHostCell,
      currentHostUnitId: currentHostPlacement ? normalizeUnitId(currentHostPlacement.unitId) : null,
      currentHostGain,
      bestHostCell: hostPlacement.cell,
      bestHostUnitId: hostUnitId,
      bestHostUnitType: hostUnitType,
      bestHostUnitName: hostUnitName,
      bestHostLevel: hostStats.unitLevel,
      bestHostOptimizationCandidate: hostCandidate.optimizationCandidate,
      bestHostGain: hostGain,
      frontEquivalentValue,
      bestToFrontRatio,
      bestToCurrentRatio,
      decision: currentHostPlacement ? "keep_current" : "keep_front",
      reason: "front_value_preferred",
    };
  }

  if (currentHostPlacement && hostGain < currentHostGain * OKINA_REHOST_ADVANTAGE_RATIO) {
    return {
      specialUnitStage: getOkinaSpecialUnitStage(player),
      candidateCount: hostCandidates.length,
      attachedHostCell: okinaHostCell,
      currentHostUnitId: normalizeUnitId(currentHostPlacement.unitId),
      currentHostGain,
      bestHostCell: hostPlacement.cell,
      bestHostUnitId: hostUnitId,
      bestHostUnitType: hostUnitType,
      bestHostUnitName: hostUnitName,
      bestHostLevel: hostStats.unitLevel,
      bestHostOptimizationCandidate: hostCandidate.optimizationCandidate,
      bestHostGain: hostGain,
      frontEquivalentValue,
      bestToFrontRatio,
      bestToCurrentRatio,
      decision: "keep_current",
      reason: "current_host_margin_preferred",
    };
  }

  return {
    specialUnitStage: getOkinaSpecialUnitStage(player),
    candidateCount: hostCandidates.length,
    attachedHostCell: okinaHostCell,
    currentHostUnitId: currentHostPlacement ? normalizeUnitId(currentHostPlacement.unitId) : null,
    currentHostGain,
    bestHostCell: hostPlacement.cell,
    bestHostUnitId: hostUnitId,
    bestHostUnitType: hostUnitType,
    bestHostUnitName: hostUnitName,
    bestHostLevel: hostStats.unitLevel,
    bestHostOptimizationCandidate: hostCandidate.optimizationCandidate,
    bestHostGain: hostGain,
    frontEquivalentValue,
    bestToFrontRatio,
    bestToCurrentRatio,
    decision: currentHostPlacement ? "reattach" : "attach",
    reason: currentHostPlacement ? "reattach_stronger_host" : "attach_best_host",
  };
}

function buildOkinaHeroSubDeployAction(player) {
  const diagnostic = buildOkinaHeroSubDecisionDiagnostic(player);
  if (!diagnostic || (diagnostic.decision !== "attach" && diagnostic.decision !== "reattach")) {
    return null;
  }

  return {
    type: "prep_command",
    payload: { heroPlacementCell: diagnostic.bestHostCell },
  };
}

function getNonSpecialBoardUnitCount(boardUnits, selectedHeroId = "", selectedBossId = "") {
  return getNonSpecialUnitCount(boardUnits, selectedHeroId, selectedBossId);
}

function resolveSpecialCheckUnitId(unit) {
  const placement = parseBoardPlacement(unit);
  if (placement) {
    return placement.unitId;
  }

  if (typeof unit === "string") {
    return unit;
  }

  if (unit && typeof unit === "object") {
    return unit.unitId ?? unit.id ?? unit.sourceUnitId ?? "";
  }

  return "";
}

function getNonSpecialUnitCount(units, selectedHeroId = "", selectedBossId = "") {
  const specialUnitIds = new Set(AUTO_FILL_SPECIAL_UNIT_IDS);

  for (const value of [selectedHeroId, selectedBossId]) {
    if (typeof value === "string" && value.length > 0) {
      specialUnitIds.add(value);
    }
  }

  let count = 0;
  for (const unit of toArray(units)) {
    const unitId = resolveSpecialCheckUnitId(unit);
    if (unitId && specialUnitIds.has(unitId)) {
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

function getBossDesiredStandardUnitCount(roundIndex) {
  if (!Number.isFinite(roundIndex)) {
    return 3;
  }

  if (roundIndex >= 9) {
    return 5;
  }

  if (roundIndex >= 6) {
    return 4;
  }

  if (roundIndex >= 3) {
    return 3;
  }

  return 3;
}

function getBossDesiredFrontlineCount(roundIndex) {
  if (!Number.isFinite(roundIndex) || roundIndex < 3) {
    return 2;
  }

  return getBossDesiredStandardUnitCount(roundIndex) >= 4 ? 2 : 1;
}

function getBossFormationPlanBonus(
  offer,
  player = null,
  state = null,
) {
  if (player?.role !== "boss") {
    return 0;
  }

  const roundIndex = getStateRoundIndex(state);
  const ownedStandardUnitCount = getNonSpecialBoardUnitCount(
    player?.boardUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  ) + toArray(player?.benchUnits).length;
  const desiredStandardUnitCount = getBossDesiredStandardUnitCount(roundIndex);
  const offerCost = getOfferCost(offer) ?? 0;
  const offerUnitType = normalizeOfferUnitType(offer);
  const { frontlineCount, backlineCount } = getFormationTypeCounts(
    player?.boardUnits,
    player?.benchUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  );
  const desiredFrontlineCount = getBossDesiredFrontlineCount(roundIndex);
  const effectiveHp = getOfferEffectiveHp(offer);
  const durableEscort = effectiveHp === null || effectiveHp >= 700;
  let bonus = 0;

  if (ownedStandardUnitCount < desiredStandardUnitCount) {
    if (durableEscort || ownedStandardUnitCount === 0) {
      bonus += BOSS_ROSTER_WIDTH_PRIORITY_BONUS - Math.min(offerCost, 5) * 45;
    } else {
      bonus -= BOSS_LOW_DURABILITY_ESCORT_PENALTY;
    }
  }

  if (isFrontlineUnitType(offerUnitType) && frontlineCount < desiredFrontlineCount) {
    bonus += BOSS_FRONTLINE_SCREEN_PRIORITY_BONUS
      - Math.max(0, frontlineCount) * 120
      - Math.min(offerCost, 5) * 30;
  }

  if (effectiveHp !== null && effectiveHp >= 850) {
    bonus += 180;
  } else if (effectiveHp !== null && effectiveHp >= 700) {
    bonus += 100;
  } else if (effectiveHp !== null && effectiveHp < 550) {
    bonus -= 140;
  }

  if (
    isBacklineUnitType(offerUnitType)
    && frontlineCount >= desiredFrontlineCount
    && backlineCount === 0
  ) {
    bonus += BOSS_BACKLINE_CORE_PRIORITY_BONUS;
  }

  if (
    ownedStandardUnitCount < desiredStandardUnitCount
    && offerCost >= 3
    && !isFrontlineUnitType(offerUnitType)
  ) {
    bonus -= BOSS_THIN_ROSTER_EXPENSIVE_OFFER_PENALTY;
  }

  if (
    Number.isFinite(roundIndex)
    && roundIndex < 3
    && ownedStandardUnitCount >= 2
    && ownedStandardUnitCount < desiredStandardUnitCount
    && !isFrontlineUnitType(offerUnitType)
    && effectiveHp !== null
    && effectiveHp < 700
  ) {
    bonus -= BOSS_EARLY_FRAGILE_THIRD_SLOT_PENALTY;
  }

  return bonus;
}

function getBossExclusiveCoreBonus(offer, player = null, state = null) {
  if (player?.role !== "boss") {
    return 0;
  }

  const unitId = normalizeOfferUnitId(offer);
  if (!BOSS_EXCLUSIVE_CORE_UNIT_IDS.has(unitId)) {
    return 0;
  }

  const ownedUnitIdCounts = getOwnedReserveAndBoardUnitIdCounts(player);
  const hasMeiling = (ownedUnitIdCounts.get("meiling") ?? 0) > 0;
  const hasSakuya = (ownedUnitIdCounts.get("sakuya") ?? 0) > 0;
  const hasPatchouli = (ownedUnitIdCounts.get("patchouli") ?? 0) > 0;
  const isOwned = (ownedUnitIdCounts.get(unitId) ?? 0) > 0;
  const ownedCoreCount = [hasMeiling, hasSakuya, hasPatchouli].filter(Boolean).length;

  if (
    unitId === "patchouli"
    && shouldCompleteBossOffenseCoreWithPatchouli(
      player,
      state,
      { hasMeiling, hasSakuya, hasPatchouli },
    )
  ) {
    return BOSS_EXCLUSIVE_CORE_COMPLETION_BONUS_BY_UNIT_ID.patchouli;
  }

  if (isOwned) {
    if (ownedCoreCount < BOSS_EXCLUSIVE_CORE_TARGET_COUNT) {
      return 0;
    }

    return BOSS_EXCLUSIVE_CORE_COMPLETE_DUPLICATE_BONUS;
  }

  if (ownedCoreCount >= BOSS_EXCLUSIVE_CORE_TARGET_COUNT) {
    return 0;
  }

  if (unitId === "meiling" && !hasMeiling) {
    return BOSS_EXCLUSIVE_CORE_COMPLETION_BONUS_BY_UNIT_ID.meiling;
  }

  if (unitId === "sakuya" && hasMeiling && !hasSakuya) {
    return BOSS_EXCLUSIVE_CORE_COMPLETION_BONUS_BY_UNIT_ID.sakuya;
  }

  if (unitId === "patchouli" && hasMeiling && hasSakuya && !hasPatchouli) {
    return BOSS_EXCLUSIVE_CORE_COMPLETION_BONUS_BY_UNIT_ID.patchouli;
  }

  return 0;
}

function shouldCompleteBossOffenseCoreWithPatchouli(
  player,
  state,
  coreState,
) {
  const roundIndex = getStateRoundIndex(state);
  if (
    roundIndex === null
    || roundIndex < BOSS_OFFENSE_CORE_PATCHOULI_MIN_ROUND
    || getClientSpecialUnitLevel(player) < BOSS_OFFENSE_CORE_PATCHOULI_MIN_BOSS_LEVEL
  ) {
    return false;
  }

  return coreState.hasMeiling && coreState.hasSakuya && !coreState.hasPatchouli;
}

function getOwnedBossExclusiveCoreCount(player = null) {
  if (player?.role !== "boss") {
    return 0;
  }

  const ownedUnitIdCounts = getOwnedReserveAndBoardUnitIdCounts(player);
  return [...BOSS_EXCLUSIVE_CORE_UNIT_IDS].filter(
    (unitId) => (ownedUnitIdCounts.get(unitId) ?? 0) > 0,
  ).length;
}

function hasEstablishedBossExclusiveCore(player = null) {
  return getOwnedBossExclusiveCoreCount(player) >= BOSS_EXCLUSIVE_CORE_TARGET_COUNT;
}

function hasSakuyaPatchouliCore(player = null) {
  if (player?.role !== "boss") {
    return false;
  }

  const ownedUnitIdCounts = getOwnedReserveAndBoardUnitIdCounts(player);
  return (ownedUnitIdCounts.get("sakuya") ?? 0) > 0
    && (ownedUnitIdCounts.get("patchouli") ?? 0) > 0;
}

function getRaidPairSubAttachmentScore(mainUnitId, subUnitId) {
  const normalizedMainUnitId = normalizeUnitId(mainUnitId);
  const normalizedSubUnitId = normalizeUnitId(subUnitId);
  const targetMainUnitIds = RAID_PAIR_SUB_TARGETS_BY_SUB_UNIT_ID[normalizedSubUnitId];

  return targetMainUnitIds?.has(normalizedMainUnitId) ? 1_000 : 0;
}

function getRaidArchetypeSubDeployScore(benchEntry, benchEntries, boardUnits) {
  const benchUnitId = normalizeUnitId(benchEntry?.unitId);
  if (!benchUnitId) {
    return 0;
  }

  const placedUnitIds = new Set(getPlacedUnitIdsIncludingSubUnits(boardUnits));
  const availableUnitIds = new Set([
    ...placedUnitIds,
    ...benchEntries
      .map((entry) => normalizeUnitId(entry?.unitId))
      .filter((unitId) => unitId.length > 0),
  ]);

  let bestScore = 0;
  for (const plan of RAID_ARCHETYPE_CONSTRUCTION_PLANS) {
    if (!isCollectiveRaidArchetypeConstructionPlan(plan)) {
      continue;
    }

    if (!plan.unitIds.has(benchUnitId)) {
      continue;
    }

    const availablePlanUnitCount = [...availableUnitIds]
      .filter((unitId) => plan.unitIds.has(unitId))
      .length;
    const placedPlanUnitCount = [...placedUnitIds]
      .filter((unitId) => plan.unitIds.has(unitId))
      .length;
    const anchorPlaced = placedUnitIds.has(plan.anchorUnitId);
    const score = availablePlanUnitCount >= plan.unitIds.size && anchorPlaced
      ? 700
      : anchorPlaced && availablePlanUnitCount >= 2
        ? 300
        : placedPlanUnitCount > 0
          ? 120
          : 0;
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

function buildSubDeployAssignments(benchEntries, availableSubDeployCells, boardUnits, role = "") {
  const hostByCell = new Map(
    toArray(boardUnits)
      .map((unit) => parseBoardPlacement(unit))
      .filter((placement) => placement !== null)
      .map((placement) => [placement.cell, placement]),
  );
  const remainingBenchEntries = [...benchEntries].sort((leftEntry, rightEntry) =>
    compareDeployEntries(leftEntry, rightEntry, role));
  const remainingCells = [...availableSubDeployCells];
  const assignments = [];
  const maxAssignmentCount = Math.min(remainingBenchEntries.length, remainingCells.length);

  while (assignments.length < maxAssignmentCount) {
    let bestCandidate = null;

    for (const benchEntry of remainingBenchEntries) {
      for (const cell of remainingCells) {
        const hostPlacement = hostByCell.get(cell);
        const score = getRaidPairSubAttachmentScore(hostPlacement?.unitId, benchEntry.unitId)
          + getRaidArchetypeSubDeployScore(benchEntry, remainingBenchEntries, boardUnits);
        if (score <= 0) {
          continue;
        }

        if (
          bestCandidate === null
          || score > bestCandidate.score
          || (
            score === bestCandidate.score
            && availableSubDeployCells.indexOf(cell) < availableSubDeployCells.indexOf(bestCandidate.cell)
          )
          || (
            score === bestCandidate.score
            && cell === bestCandidate.cell
            && compareDeployEntries(benchEntry, bestCandidate.benchEntry, role) < 0
          )
        ) {
          bestCandidate = {
            benchEntry,
            cell,
            score,
          };
        }
      }
    }

    if (bestCandidate === null) {
      break;
    }

    assignments.push({
      benchEntry: bestCandidate.benchEntry,
      cell: bestCandidate.cell,
    });
    remainingBenchEntries.splice(remainingBenchEntries.indexOf(bestCandidate.benchEntry), 1);
    remainingCells.splice(remainingCells.indexOf(bestCandidate.cell), 1);
  }

  while (assignments.length < maxAssignmentCount) {
    const benchEntry = remainingBenchEntries.shift();
    const cell = remainingCells.shift();
    if (!benchEntry || cell === undefined) {
      break;
    }

    assignments.push({ benchEntry, cell });
  }

  return assignments;
}

function buildDeployActions(
  role,
  helperIndex,
  boardUnits,
  boardSubUnits,
  benchUnits,
  benchUnitIds = [],
  selectedHeroId = "",
  selectedBossId = "",
  roundIndex = null,
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
  const baseBenchEntries = benchUnitList.map((unit, index) => ({
    benchIndex: index,
    unitType: parseBenchUnitType(unit),
    unitId: parseBenchUnitId(unit, toArray(benchUnitIds)[index]),
    factionId: unit && typeof unit === "object" ? unit.factionId : undefined,
    cost: unit && typeof unit === "object" ? unit.cost : undefined,
    unitLevel: unit && typeof unit === "object" ? unit.unitLevel : undefined,
  }));
  const benchEntries = role === "raid"
    ? annotateFactionlessCarryDeployReadiness(
      baseBenchEntries,
      boardUnits,
      boardSubUnits,
      selectedHeroId,
      selectedBossId,
    )
    : baseBenchEntries;
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
    compareDeployEntries(leftEntry, rightEntry, role));
  const mainDeployEntries = prioritizedBenchEntries.slice(0, mainDeployCount);
  const usedDeployCells = new Set();

  for (const deployEntry of mainDeployEntries) {
    const preferredCells = sortDeployCellsForUnitType(
      role,
      helperIndex,
      getDeployEntryUnitType(deployEntry),
      deployEntry.unitId,
      availableDeployCells,
      boardUnits,
      selectedBossId,
      roundIndex,
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

  const subDeployAssignments = buildSubDeployAssignments(
    remainingBenchEntries,
    availableSubDeployCells,
    boardUnits,
    role,
  );

  for (const subDeployAssignment of subDeployAssignments) {
    const subDeployEntry = subDeployAssignment.benchEntry;
    if (!subDeployEntry) {
      continue;
    }
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex: subDeployEntry.benchIndex,
          cell: subDeployAssignment.cell,
          slot: "sub",
        },
      },
    });
  }

  const remainingMainDeployCells = availableDeployCells.filter((cell) => !usedDeployCells.has(cell));
  const remainingBenchAfterSubDeploy = remainingBenchCount - subDeployAssignments.length;
  const remainingMainSlotsAfterInitialDeploy = Math.max(0, remainingMainDeploySlots - mainDeployEntries.length);
  const extraMainDeployCount = Math.min(
    remainingBenchAfterSubDeploy,
    remainingMainDeployCells.length,
    remainingMainSlotsAfterInitialDeploy,
  );
  const assignedSubBenchIndexes = new Set(
    subDeployAssignments.map((assignment) => assignment.benchEntry.benchIndex),
  );
  const extraMainEntries = remainingBenchEntries
    .filter((entry) => !assignedSubBenchIndexes.has(entry.benchIndex))
    .sort((leftEntry, rightEntry) => compareDeployEntries(leftEntry, rightEntry, role));

  for (let extraMainIndex = 0; extraMainIndex < extraMainDeployCount; extraMainIndex += 1) {
    const extraMainEntry = extraMainEntries[extraMainIndex];
    if (!extraMainEntry) {
      continue;
    }
    const preferredCells = sortDeployCellsForUnitType(
      role,
      helperIndex,
      getDeployEntryUnitType(extraMainEntry),
      extraMainEntry.unitId,
      remainingMainDeployCells,
      boardUnits,
      selectedBossId,
      roundIndex,
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

function getPlacementAtCell(placements, cell) {
  return placements.find((placement) => placement.cell === cell) ?? null;
}

function getGuardStrengthScore(unit) {
  if (!unit || !isFrontlineUnitType(unit.unitType)) {
    return Number.NEGATIVE_INFINITY;
  }

  const unitLevel = Number.isFinite(unit.unitLevel)
    ? Math.max(1, Number(unit.unitLevel))
    : 1;
  const knownUnit = getKnownCombatUnit(unit.unitId);
  const effectiveHp = getKnownUnitEffectiveHp(knownUnit);
  const durabilityScore = effectiveHp > 0 ? effectiveHp * 0.28 : 0;
  const costScore = resolveOptimizationUnitCost(unit, knownUnit) * 30;
  return unitLevel * 100 + durabilityScore + costScore;
}

function buildBenchGuardEntries(player) {
  const benchUnitIds = toArray(player?.benchUnitIds);

  return toArray(player?.benchUnits)
    .map((unit, index) => ({
      index,
      unitId: parseBenchUnitId(unit, benchUnitIds[index]),
      unitType: parseBenchUnitType(unit),
      unitLevel: unit && typeof unit === "object" && Number.isFinite(unit.unitLevel)
        ? Number(unit.unitLevel)
        : undefined,
    }))
    .filter((entry) => isFrontlineUnitType(entry.unitType));
}

function getStrongestGuardPlacement(placements, excludedCells = new Set()) {
  return placements
    .filter((placement) =>
      !excludedCells.has(placement.cell) && isFrontlineUnitType(placement.unitType))
    .sort((leftPlacement, rightPlacement) =>
      getGuardStrengthScore(rightPlacement) - getGuardStrengthScore(leftPlacement)
      || leftPlacement.cell - rightPlacement.cell)[0] ?? null;
}

function getBossRelativeCell(bossCell, dx = 0, dy = 0) {
  const bossCoordinate = getBoardCellCoordinate(bossCell);
  const x = bossCoordinate.x + dx;
  const y = bossCoordinate.y + dy;

  if (x < 0 || x >= SHARED_BOARD_WIDTH || y < 0 || y >= SHARED_BOARD_WIDTH) {
    return null;
  }

  return y * SHARED_BOARD_WIDTH + x;
}

function resolvePlacementUnitName(placement) {
  if (!placement || !placement.unitId) {
    return null;
  }

  const knownUnit = getKnownCombatUnit(placement.unitId);
  return placement.unitName
    ?? knownUnit?.displayName
    ?? knownUnit?.name
    ?? placement.unitId;
}

function buildBossBodyGuardDecisionBase({
  bossCell,
  directGuardCell,
  directGuard,
  strongestGuard,
  benchFrontlineCount,
  decision = "none",
  reason = "direct_guard_best_available",
  actionFromCell = null,
  actionToCell = null,
}) {
  return {
    decision,
    reason,
    bossCell,
    directGuardCell,
    directGuardUnitId: directGuard?.unitId || null,
    directGuardUnitName: resolvePlacementUnitName(directGuard),
    directGuardUnitType: directGuard?.unitType ?? null,
    directGuardLevel: Number.isFinite(directGuard?.unitLevel) ? Number(directGuard.unitLevel) : null,
    strongestGuardCell: strongestGuard?.cell ?? null,
    strongestGuardUnitId: strongestGuard?.unitId || null,
    strongestGuardUnitName: resolvePlacementUnitName(strongestGuard),
    strongestGuardUnitType: strongestGuard?.unitType ?? null,
    strongestGuardLevel: Number.isFinite(strongestGuard?.unitLevel) ? Number(strongestGuard.unitLevel) : null,
    benchFrontlineCount,
    directEmpty: directGuard === null,
    strongerOffDirect:
      directGuard !== null && getGuardStrengthScore(strongestGuard) > getGuardStrengthScore(directGuard),
    actionFromCell,
    actionToCell,
  };
}

export function buildBossBodyGuardDecisionDiagnostic(player, options = {}) {
  if (player?.role !== "boss") {
    return null;
  }

  const diagnosticOptions = options ?? {};
  const playerPhase = diagnosticOptions.playerPhase ?? "";
  if (playerPhase !== "deploy") {
    return null;
  }

  const roundIndex = Number.isInteger(diagnosticOptions.roundIndex)
    ? diagnosticOptions.roundIndex
    : getStateRoundIndex(diagnosticOptions.state ?? null);
  if (roundIndex === null || roundIndex < BOSS_BODY_GUARD_MOVE_MIN_ROUND) {
    return null;
  }

  const placements = toArray(player?.boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null);
  const bossCell = resolveBossBodyCell(player?.boardUnits, player?.selectedBossId);
  const directGuardCell = getBossRelativeCell(bossCell, 0, 1);
  const deeperDirectGuardCell = getBossRelativeCell(bossCell, 0, 2);

  if (directGuardCell === null || deeperDirectGuardCell === null) {
    return null;
  }

  const directGuard = getPlacementAtCell(placements, directGuardCell);
  const benchFrontlineCount = buildBenchGuardEntries(player).length;
  if (!directGuard) {
    const strongestBoardGuard = benchFrontlineCount > 0
      ? null
      : getStrongestGuardPlacement(placements, new Set([bossCell, directGuardCell]));
    if (!strongestBoardGuard) {
      return buildBossBodyGuardDecisionBase({
        bossCell,
        directGuardCell,
        directGuard: null,
        strongestGuard: null,
        benchFrontlineCount,
        reason: benchFrontlineCount > 0 ? "bench_frontline_pending" : "no_direct_guard_candidate",
      });
    }

    return buildBossBodyGuardDecisionBase({
      bossCell,
      directGuardCell,
      directGuard: null,
      strongestGuard: strongestBoardGuard,
      benchFrontlineCount,
      decision: "direct_fill",
      reason: "direct_guard_empty",
      actionFromCell: strongestBoardGuard.cell,
      actionToCell: directGuardCell,
    });
  }

  const strongerBoardGuard = getStrongestGuardPlacement(placements, new Set([bossCell, directGuardCell]));
  if (getGuardStrengthScore(strongerBoardGuard) > getGuardStrengthScore(directGuard)) {
    return buildBossBodyGuardDecisionBase({
      bossCell,
      directGuardCell,
      directGuard,
      strongestGuard: strongerBoardGuard,
      benchFrontlineCount,
      decision: "direct_swap",
      reason: "stronger_board_guard",
      actionFromCell: strongerBoardGuard.cell,
      actionToCell: directGuardCell,
    });
  }

  const deeperDirectGuard = getPlacementAtCell(placements, deeperDirectGuardCell);
  if (!deeperDirectGuard && strongerBoardGuard) {
    return buildBossBodyGuardDecisionBase({
      bossCell,
      directGuardCell,
      directGuard,
      strongestGuard: strongerBoardGuard,
      benchFrontlineCount,
      decision: "direct_lane_fill",
      reason: "second_direct_guard_missing",
      actionFromCell: strongerBoardGuard.cell,
      actionToCell: deeperDirectGuardCell,
    });
  }

  if (
    !isFrontlineUnitType(directGuard.unitType)
    || !deeperDirectGuard
    || !isFrontlineUnitType(deeperDirectGuard.unitType)
  ) {
    return buildBossBodyGuardDecisionBase({
      bossCell,
      directGuardCell,
      directGuard,
      strongestGuard: strongerBoardGuard,
      benchFrontlineCount,
      reason: "insufficient_direct_lane",
    });
  }

  const sideBacklineCells = [
    { backlineCell: getBossRelativeCell(bossCell, 1, 0), flankCell: getBossRelativeCell(bossCell, 1, 1) },
    { backlineCell: getBossRelativeCell(bossCell, -1, 0), flankCell: getBossRelativeCell(bossCell, -1, 1) },
  ];
  const target = sideBacklineCells.find(({ backlineCell, flankCell }) => {
    if (
      backlineCell === null
      || flankCell === null
      || getPlacementAtCell(placements, flankCell)
    ) {
      return false;
    }

    const backlinePlacement = getPlacementAtCell(placements, backlineCell);
    return backlinePlacement !== null && isBacklineUnitType(backlinePlacement.unitType);
  });

  if (!target || target.flankCell === null) {
    return buildBossBodyGuardDecisionBase({
      bossCell,
      directGuardCell,
      directGuard,
      strongestGuard: strongerBoardGuard,
      benchFrontlineCount,
      reason: "side_backline_guarded",
    });
  }

  const sideCoverageReservedCells = new Set([
    bossCell,
    directGuardCell,
    deeperDirectGuardCell,
  ]);
  for (const { backlineCell, flankCell } of sideBacklineCells) {
    if (backlineCell !== null) {
      sideCoverageReservedCells.add(backlineCell);
    }
    if (flankCell !== null) {
      sideCoverageReservedCells.add(flankCell);
    }
  }
  const sideFlankGuard = getStrongestGuardPlacement(
    placements,
    sideCoverageReservedCells,
  );
  if (!sideFlankGuard) {
    return buildBossBodyGuardDecisionBase({
      bossCell,
      directGuardCell,
      directGuard,
      strongestGuard: strongerBoardGuard,
      benchFrontlineCount,
      reason: "side_backline_exposed_direct_lane_reserved",
    });
  }

  return buildBossBodyGuardDecisionBase({
    bossCell,
    directGuardCell,
    directGuard,
    strongestGuard: sideFlankGuard,
    benchFrontlineCount,
    decision: "side_flank_move",
    reason: "side_backline_exposed",
    actionFromCell: sideFlankGuard.cell,
    actionToCell: target.flankCell,
  });
}

function buildBossBodyGuardMoveAction(player, state = null, playerPhase = "") {
  const diagnostic = buildBossBodyGuardDecisionDiagnostic(player, {
    state,
    playerPhase,
  });
  if (!diagnostic || diagnostic.actionFromCell === null || diagnostic.actionToCell === null) {
    return null;
  }

  if (diagnostic.decision === "direct_swap") {
    return {
      type: "prep_command",
      payload: {
        boardUnitSwap: {
          fromCell: diagnostic.actionFromCell,
          toCell: diagnostic.actionToCell,
        },
      },
    };
  }

  return {
    type: "prep_command",
    payload: {
      boardUnitMove: {
        fromCell: diagnostic.actionFromCell,
        toCell: diagnostic.actionToCell,
      },
    },
  };
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
  const knownFactionId = getKnownTouhouUnit(normalizeOfferUnitId(offer))?.factionId;
  if (typeof knownFactionId === "string" && knownFactionId.length > 0) {
    return knownFactionId.trim().toLowerCase();
  }

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

function getKnownHeroExclusiveUnit(unitId) {
  const normalizedUnitId = normalizeUnitId(unitId);
  return normalizedUnitId
    ? HERO_EXCLUSIVE_UNITS.find((unit) => normalizeUnitId(unit.unitId) === normalizedUnitId)
      ?? HERO_EXCLUSIVE_UNITS.find((unit) => normalizeUnitId(unit.id) === normalizedUnitId)
      ?? null
    : null;
}

function getKnownCombatUnit(unitId) {
  const normalizedUnitId = normalizeUnitId(unitId);
  return normalizedUnitId
    ? getScarletMansionUnitById(normalizedUnitId)
      ?? getKnownTouhouUnit(normalizedUnitId)
      ?? getKnownHeroExclusiveUnit(normalizedUnitId)
    : null;
}

function getKnownOfferCombatStats(offer) {
  const unitId = normalizeOfferUnitId(offer);
  if (!unitId) {
    return null;
  }

  return getKnownCombatUnit(unitId);
}

function getOfferEffectiveHp(offer) {
  const knownUnit = getKnownOfferCombatStats(offer);
  if (!knownUnit || !Number.isFinite(knownUnit.hp)) {
    return null;
  }

  const damageReduction = Number.isFinite(knownUnit.damageReduction)
    ? Math.max(0, Math.min(90, knownUnit.damageReduction))
    : 0;
  return knownUnit.hp / Math.max(0.1, 1 - damageReduction / 100);
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

function getAttachedBoardSubUnitIds(boardUnits, boardSubUnits = [], selectedHeroId = "", selectedBossId = "") {
  const specialUnitIds = new Set(
    [selectedHeroId, selectedBossId].filter(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );
  const attachedUnitIds = [];
  const seenAttachedSubUnits = new Set();

  for (const placement of toArray(boardUnits)
    .map((value) => parseBoardPlacement(value))
    .filter((value) => value !== null)) {
    const subUnitId = normalizeUnitId(placement.subUnit?.unitId ?? placement.subUnit?.detail);
    if (!subUnitId || specialUnitIds.has(subUnitId)) {
      continue;
    }

    const key = `${placement.cell}:${subUnitId}`;
    seenAttachedSubUnits.add(key);
    attachedUnitIds.push(subUnitId);
  }

  for (const token of toArray(boardSubUnits)) {
    const cell = parseBoardCell(token);
    const subUnitId = getBoardSubUnitIdFromToken(token);
    if (!subUnitId || specialUnitIds.has(subUnitId)) {
      continue;
    }

    const key = `${cell ?? ""}:${subUnitId}`;
    if (seenAttachedSubUnits.has(key)) {
      continue;
    }

    seenAttachedSubUnits.add(key);
    attachedUnitIds.push(subUnitId);
  }

  return attachedUnitIds;
}

function getPlacedUnitIdsIncludingSubUnits(
  boardUnits,
  boardSubUnits = [],
  selectedHeroId = "",
  selectedBossId = "",
) {
  return [
    ...getPlacedUnitIds(boardUnits, selectedHeroId, selectedBossId),
    ...getAttachedBoardSubUnitIds(boardUnits, boardSubUnits, selectedHeroId, selectedBossId),
  ];
}

function getRaidOwnedUnitIdsForShopEvaluation(
  boardUnits,
  benchUnitIds = [],
  boardSubUnits = [],
) {
  return [
    ...getPlacedUnitIdsIncludingSubUnits(boardUnits, boardSubUnits),
    ...toArray(benchUnitIds).map((unitId) => normalizeUnitId(unitId)).filter(Boolean),
  ];
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

function getBossUpgradeOfferPriorityScore(
  offer,
  boardUnits = [],
  benchUnitIds = [],
  benchUnits = [],
  state = null,
  player = null,
) {
  const unitId = normalizeOfferUnitId(offer);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  const formationPlanBonus = getBossFormationPlanBonus(offer, player, state);
  const exclusiveCoreBonus = getBossExclusiveCoreBonus(offer, player, state);
  const duplicateOwnedBonus = getBossOfferDuplicateOwnedBonus(
    offer,
    boardUnits,
    benchUnitIds,
  );
  const bossExclusiveScore = BOSS_OFFER_PRIORITY_BY_UNIT_ID[unitId];
  if (bossExclusiveScore !== undefined) {
    return bossExclusiveScore
      + duplicateOwnedBonus
      + formationBalanceBonus
      + formationPlanBonus
      + exclusiveCoreBonus;
  }

  const commonOfferScore = BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_ID[unitId];
  if (commonOfferScore !== undefined) {
    return commonOfferScore
      + duplicateOwnedBonus
      + formationBalanceBonus
      + formationPlanBonus
      + exclusiveCoreBonus;
  }

  const cost = getOfferCost(offer) ?? 0;
  const typeScore =
    BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  return cost * 40
    + typeScore
    + duplicateOwnedBonus
    + formationBalanceBonus
    + formationPlanBonus;
}

function getBossHighCostOfferPriorityScore(
  offer,
  boardUnits = [],
  benchUnitIds = [],
  benchUnits = [],
  state = null,
  player = null,
) {
  const unitId = normalizeOfferUnitId(offer);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  const formationPlanBonus = getBossFormationPlanBonus(offer, player, state);
  const exclusiveCoreBonus = getBossExclusiveCoreBonus(offer, player, state);
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
    + (
      baseScore
      + formationBalanceBonus
      + formationPlanBonus
      + exclusiveCoreBonus
    )
      * BOSS_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT
    + duplicateOwnedBonus * BOSS_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT;
}

function getBossOfferPriorityScore(
  offer,
  boardUnits = [],
  benchUnitIds = [],
  strategy = "upgrade",
  benchUnits = [],
  state = null,
  player = null,
) {
  if (strategy === "highCost") {
    return getBossHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits, state, player);
  }

  return getBossUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits, state, player);
}

function getFactionCounts(boardUnits, benchUnitIds = [], boardSubUnits = []) {
  const factionCounts = new Map();
  const addFactionCount = (factionId) => {
    const normalizedFactionId = normalizeUnitId(factionId);
    if (!normalizedFactionId) {
      return;
    }

    factionCounts.set(
      normalizedFactionId,
      (factionCounts.get(normalizedFactionId) ?? 0) + 1,
    );
  };

  for (const placement of toArray(boardUnits)) {
    const parsedPlacement = parseBoardPlacement(placement);
    const factionId = normalizeUnitId(
      parsedPlacement?.factionId
        || getKnownTouhouUnit(parsedPlacement?.unitId)?.factionId
        || "",
    );
    if (!factionId) {
      continue;
    }

    addFactionCount(factionId);
  }

  for (const unitId of getAttachedBoardSubUnitIds(boardUnits, boardSubUnits)) {
    addFactionCount(getKnownTouhouUnit(unitId)?.factionId ?? "");
  }

  for (const unitId of toArray(benchUnitIds)) {
    addFactionCount(getKnownTouhouUnit(unitId)?.factionId ?? "");
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

function getRaidFactionTierCompletionBonus(factionId, existingFactionCount) {
  const thresholds = RAID_FACTION_THRESHOLDS_BY_FACTION_ID[factionId] ?? [];
  if (thresholds.length === 0) {
    return 0;
  }

  const nextThresholdIndex = thresholds.findIndex(
    (threshold) => existingFactionCount < threshold && existingFactionCount + 1 >= threshold,
  );
  if (nextThresholdIndex < 0) {
    return 0;
  }

  return RAID_FACTION_TIER_COMPLETION_BONUS_BY_FACTION_ID[factionId]?.[nextThresholdIndex] ?? 0;
}

function getRaidBenchFactionTierPlanningBonus(
  factionId,
  boardFactionCount,
  boardAndBenchFactionCount,
  benchUnitIds,
) {
  if (toArray(benchUnitIds).length <= 0 || toArray(benchUnitIds).length >= AUTO_FILL_BENCH_CAPACITY) {
    return 0;
  }

  if (boardAndBenchFactionCount <= boardFactionCount) {
    return 0;
  }

  const boardOnlyCompletionBonus = getRaidFactionTierCompletionBonus(
    factionId,
    boardFactionCount,
  );
  if (boardOnlyCompletionBonus > 0) {
    return 0;
  }

  const benchInclusiveCompletionBonus = getRaidFactionTierCompletionBonus(
    factionId,
    boardAndBenchFactionCount,
  );
  return Math.floor(
    benchInclusiveCompletionBonus * RAID_FACTION_BENCH_TIER_PLANNING_BONUS_RATIO,
  );
}

function getRaidOfferFactionBonus(offer, boardUnits, benchUnitIds = [], boardSubUnits = []) {
  const offerFactionId = normalizeOfferFactionId(offer);
  if (!offerFactionId) {
    return 0;
  }

  const offerUnitId = normalizeOfferUnitId(offer);
  const ownedUnitIdCounts = getUnitIdCounts(getRaidOwnedUnitIdsForShopEvaluation(
    boardUnits,
    benchUnitIds,
    boardSubUnits,
  ));
  const ownedOfferUnitCount = offerUnitId
    ? ownedUnitIdCounts.get(offerUnitId) ?? 0
    : 0;
  const boardFactionCount = getFactionCounts(boardUnits, [], boardSubUnits).get(offerFactionId) ?? 0;
  const boardAndBenchFactionCount = getFactionCounts(boardUnits, benchUnitIds, boardSubUnits).get(offerFactionId) ?? 0;
  if (ownedOfferUnitCount <= 0) {
    const tierCompletionBonus = getRaidFactionTierCompletionBonus(
      offerFactionId,
      boardFactionCount,
    );
    if (tierCompletionBonus > 0) {
      return tierCompletionBonus;
    }

    const benchPlanningBonus = getRaidBenchFactionTierPlanningBonus(
      offerFactionId,
      boardFactionCount,
      boardAndBenchFactionCount,
      benchUnitIds,
    );
    if (benchPlanningBonus > 0) {
      return benchPlanningBonus;
    }
  }

  if (boardFactionCount < RAID_ESTABLISHED_FACTION_THRESHOLD) {
    return 0;
  }

  return Math.min(
    boardFactionCount * RAID_ESTABLISHED_FACTION_BONUS_PER_UNIT,
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

function getRaidPairReserveOfferBonus(offer, boardUnits) {
  const offerUnitId = normalizeOfferUnitId(offer);
  if (!offerUnitId) {
    return 0;
  }

  for (const placement of toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)) {
    if (getRaidPairSubAttachmentScore(placement.unitId, offerUnitId) > 0) {
      return RAID_PAIR_RESERVE_OFFER_BONUS;
    }
  }

  return 0;
}

function getRaidArchetypeConstructionDetail(offer, boardUnits, benchUnitIds = [], boardSubUnits = [], state = null) {
  const offerUnitId = normalizeOfferUnitId(offer);
  if (!offerUnitId) {
    return null;
  }

  const ownedUnitIds = new Set(getRaidOwnedUnitIdsForShopEvaluation(
    boardUnits,
    benchUnitIds,
    boardSubUnits,
  ));
  if (ownedUnitIds.has(offerUnitId)) {
    return null;
  }

  let bestDetail = null;
  for (const plan of RAID_ARCHETYPE_CONSTRUCTION_PLANS) {
    if (!plan.unitIds.has(offerUnitId)) {
      continue;
    }

    const ownedPlanUnitCount = [...ownedUnitIds]
      .filter((unitId) => plan.unitIds.has(unitId))
      .length;
    if (ownedPlanUnitCount <= 0) {
      continue;
    }

    const anchorPresentAfterBuy = ownedUnitIds.has(plan.anchorUnitId)
      || offerUnitId === plan.anchorUnitId;
    const nextOwnedPlanUnitCount = ownedPlanUnitCount + 1;
    const missingAfterBuy = Math.max(0, plan.unitIds.size - nextOwnedPlanUnitCount);
    const isCollectivePlan = isCollectiveRaidArchetypeConstructionPlan(plan);
    const commitCandidateBonus = isCollectivePlan && anchorPresentAfterBuy && nextOwnedPlanUnitCount >= 3
      ? RAID_ARCHETYPE_COMMIT_CANDIDATE_BONUS
      : 0;
    const nearCompleteBonus = isCollectivePlan && missingAfterBuy === 1
      ? RAID_ARCHETYPE_NEAR_COMPLETE_BONUS
      : 0;
      const fullCompletionBonus = isCollectivePlan && missingAfterBuy === 0
        ? RAID_ARCHETYPE_FULL_COMPLETION_BONUS
        : 0;
      const midgameTempoBonus = getRaidArchetypeMidgameTempoBonus(
        plan,
        offer,
        boardUnits,
        benchUnitIds,
        boardSubUnits,
        missingAfterBuy,
        state,
      );
      const bonus = (ownedUnitIds.has(plan.anchorUnitId)
        ? plan.anchorPresentBonus
        : plan.partialPlanBonus)
        + commitCandidateBonus
        + nearCompleteBonus
        + fullCompletionBonus
        + midgameTempoBonus;
    if (bestDetail === null || bonus > bestDetail.bonus) {
      bestDetail = {
        reason: "raid_archetype_construction",
        planId: plan.planId,
        anchorUnitId: plan.anchorUnitId,
        bonus,
        ownedPlanUnitCount,
        nextOwnedPlanUnitCount,
        missingAfterBuy,
      };
    }
  }

  return bestDetail;
}

function isGrassrootMidgameCompletionWindow(plan, missingAfterBuy, state = null) {
  const roundIndex = getStateRoundIndex(state);
  return plan?.planId === RAID_ARCHETYPE_GRASSROOT_TEMPO_PLAN_ID
    && missingAfterBuy === 0
    && roundIndex !== null
    && roundIndex >= RAID_ARCHETYPE_GRASSROOT_TEMPO_START_ROUND
    && roundIndex <= RAID_ARCHETYPE_GRASSROOT_TEMPO_END_ROUND;
}

function canImmediatelyFieldCompletedRaidArchetype(
  plan,
  offer,
  boardUnits,
  benchUnitIds = [],
  boardSubUnits = [],
) {
  return buildRaidArchetypeFieldingReadiness(
    plan,
    offer,
    boardUnits,
    benchUnitIds,
    boardSubUnits,
  ).canField;
}

function buildRaidArchetypeFieldingReadiness(
  plan,
  offer,
  boardUnits,
  benchUnitIds = [],
  boardSubUnits = [],
) {
  const offerUnitId = normalizeOfferUnitId(offer);
  if (!plan || !offerUnitId) {
    return {
      canField: false,
      blocker: "missing_candidate",
      combatPlanUnitCount: 0,
      reservePlanUnitCount: 0,
      availableMainSlots: 0,
      availableSubSlots: 0,
    };
  }

  const combatPlanUnitIds = new Set(getPlacedUnitIdsIncludingSubUnits(
    boardUnits,
    boardSubUnits,
  ).filter((unitId) => plan.unitIds.has(unitId)));
  const reservePlanUnitIds = new Set([
    ...toArray(benchUnitIds),
    offerUnitId,
  ].map((unitId) => normalizeUnitId(unitId))
    .filter((unitId) => unitId && plan.unitIds.has(unitId) && !combatPlanUnitIds.has(unitId)));
  const availableMainSlots = Math.min(
    getAvailableDeployCells("raid", 0, boardUnits).length,
    Math.max(0, getMaxStandardDeploySlotsForRole("raid") - getNonSpecialBoardUnitCount(boardUnits)),
  );
  const availableSubSlots = getAvailableSubDeployCells(
    "raid",
    boardUnits,
    boardSubUnits,
  ).length;
  const stagedSubSlotsFromMainDeploys = availableMainSlots;
  const deployableReservePlanUnitCount = Math.min(
    reservePlanUnitIds.size,
    availableMainSlots + availableSubSlots + stagedSubSlotsFromMainDeploys,
  );
  const neededReservePlanUnitCount = Math.max(0, plan.unitIds.size - combatPlanUnitIds.size);
  const availableDeploySlots = availableMainSlots + availableSubSlots + stagedSubSlotsFromMainDeploys;
  const canField = combatPlanUnitIds.size + deployableReservePlanUnitCount >= plan.unitIds.size;
  let blocker = "none";
  if (!canField) {
    if (reservePlanUnitIds.size < neededReservePlanUnitCount) {
      blocker = "reserve_units_short";
    } else if (availableDeploySlots <= 0) {
      blocker = "all_deploy_slots_full";
    } else if (availableDeploySlots < neededReservePlanUnitCount) {
      blocker = "deploy_slots_short";
    } else if (availableSubSlots <= 0 && availableMainSlots < neededReservePlanUnitCount) {
      blocker = "sub_slots_full";
    } else {
      blocker = "fielding_short";
    }
  }

  return {
    canField,
    blocker,
    combatPlanUnitCount: combatPlanUnitIds.size,
    reservePlanUnitCount: reservePlanUnitIds.size,
    availableMainSlots,
    availableSubSlots,
  };
}

function getRaidArchetypeMidgameTempoBonus(
  plan,
  offer,
  boardUnits,
  benchUnitIds = [],
  boardSubUnits = [],
  missingAfterBuy,
  state = null,
) {
  if (!isGrassrootMidgameCompletionWindow(plan, missingAfterBuy, state)) {
    return missingAfterBuy === 1 && plan?.planId === RAID_ARCHETYPE_GRASSROOT_TEMPO_PLAN_ID
      ? RAID_ARCHETYPE_GRASSROOT_TEMPO_NEAR_COMPLETE_BONUS
      : 0;
  }

  return canImmediatelyFieldCompletedRaidArchetype(
    plan,
    offer,
    boardUnits,
    benchUnitIds,
    boardSubUnits,
  )
    ? RAID_ARCHETYPE_GRASSROOT_TEMPO_FULL_COMPLETION_BONUS
    : 0;
}

function hasAffordableHighCostAlternativeOffer(offer, offerList, gold) {
  if (!Number.isFinite(gold)) {
    return false;
  }

  return toArray(offerList).some((candidate) =>
    candidate !== offer
    && candidate?.purchased !== true
    && (getOfferCost(candidate) ?? Number.POSITIVE_INFINITY) <= gold
    && (getOfferCost(candidate) ?? 0) >= 4);
}

function getRaidArchetypeShopContextAdjustment(offer, offerList, gold, player = null, state = null) {
  if (player?.role !== "raid") {
    return 0;
  }

  const detail = getRaidArchetypeConstructionDetail(
    offer,
    player?.boardUnits,
    player?.benchUnitIds,
    player?.boardSubUnits,
    state,
  );
  if (detail?.planId !== RAID_ARCHETYPE_GRASSROOT_TEMPO_PLAN_ID || detail.missingAfterBuy !== 0) {
    return 0;
  }

  const plan = RAID_ARCHETYPE_CONSTRUCTION_PLANS.find((candidate) =>
    candidate.planId === detail.planId);
  if (!isGrassrootMidgameCompletionWindow(plan, detail.missingAfterBuy, state)) {
    return 0;
  }

  if (
    !canImmediatelyFieldCompletedRaidArchetype(
      plan,
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      player?.boardSubUnits,
    )
    || hasAffordableHighCostAlternativeOffer(offer, offerList, gold)
  ) {
    return -RAID_ARCHETYPE_GRASSROOT_HIGH_COST_OPPORTUNITY_PENALTY;
  }

  return 0;
}

function buildRaidArchetypeShopDecisionDiagnostic(player, selectedOffer, selectedOfferIndex, state = null) {
  if (player?.role !== "raid") {
    return null;
  }

  const offerList = toArray(player?.shopOffers);
  const gold = player?.gold;
  if (!Number.isFinite(gold) || selectedOfferIndex === null || selectedOffer === undefined) {
    return null;
  }

  let completionCandidate = null;
  for (let index = 0; index < offerList.length; index += 1) {
    const offer = offerList[index];
    const candidateCost = getOfferCost(offer);
    if (offer?.purchased === true || candidateCost === null || candidateCost > gold) {
      continue;
    }

    const detail = getRaidArchetypeConstructionDetail(
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      player?.boardSubUnits,
      state,
    );
    if (
      detail?.planId !== RAID_ARCHETYPE_GRASSROOT_TEMPO_PLAN_ID
      || detail.missingAfterBuy !== 0
    ) {
      continue;
    }

    const plan = RAID_ARCHETYPE_CONSTRUCTION_PLANS.find((candidate) =>
      candidate.planId === detail.planId);
    if (!isGrassrootMidgameCompletionWindow(plan, detail.missingAfterBuy, state)) {
      continue;
    }

    const candidateUnitId = normalizeOfferUnitId(offer);
    if (candidateUnitId.length === 0) {
      continue;
    }

    completionCandidate = {
      offer,
      index,
      plan,
      planId: detail.planId,
      candidateUnitId,
      candidateCost,
    };
    break;
  }

  if (completionCandidate === null) {
    return null;
  }

  const selectedOfferCost = getOfferCost(selectedOffer) ?? 0;
  const fieldingReadiness = buildRaidArchetypeFieldingReadiness(
    completionCandidate.plan,
    completionCandidate.offer,
    player?.boardUnits,
    player?.benchUnitIds,
    player?.boardSubUnits,
  );
  const botArchetypeDecision = selectedOfferIndex === completionCandidate.index
    ? "completed_and_bought"
    : !fieldingReadiness.canField
      ? "completed_but_not_immediately_fieldable"
      : selectedOfferCost >= 4
        ? "completed_but_high_cost_skipped"
        : "completed_but_other_skipped";

  return {
    botArchetypeDecision,
    botArchetypeDecisionPlanId: completionCandidate.planId,
    botArchetypeDecisionCandidateUnitId: completionCandidate.candidateUnitId,
    botArchetypeDecisionCandidateCost: completionCandidate.candidateCost,
    ...(!fieldingReadiness.canField && {
      botArchetypeDecisionBlocker: fieldingReadiness.blocker,
      botArchetypeDecisionCombatPlanUnitCount: fieldingReadiness.combatPlanUnitCount,
      botArchetypeDecisionReservePlanUnitCount: fieldingReadiness.reservePlanUnitCount,
      botArchetypeDecisionAvailableMainSlots: fieldingReadiness.availableMainSlots,
      botArchetypeDecisionAvailableSubSlots: fieldingReadiness.availableSubSlots,
    }),
  };
}

function getRaidArchetypeConstructionBonus(offer, boardUnits, benchUnitIds = [], boardSubUnits = [], state = null) {
  return getRaidArchetypeConstructionDetail(offer, boardUnits, benchUnitIds, boardSubUnits, state)?.bonus ?? 0;
}

function getRaidUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits = [], boardSubUnits = [], state = null) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  const factionBonus = getRaidOfferFactionBonus(offer, boardUnits, benchUnitIds, boardSubUnits);
  const duplicateBenchBonus = getRaidOfferDuplicateBenchBonus(offer, benchUnitIds);
  const pairReserveBonus = getRaidPairReserveOfferBonus(offer, boardUnits);
  const archetypeConstructionBonus = getRaidArchetypeConstructionBonus(offer, boardUnits, benchUnitIds, boardSubUnits, state);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  return unitIdPriority
    + unitTypePriority
    + factionBonus
    + duplicateBenchBonus
    + pairReserveBonus
    + archetypeConstructionBonus
    + formationBalanceBonus
    - offerCost * 3;
}

function getRaidHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits = [], boardSubUnits = [], state = null) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  const factionBonus = getRaidOfferFactionBonus(offer, boardUnits, benchUnitIds, boardSubUnits);
  const duplicateBenchBonus = getRaidOfferDuplicateBenchBonus(offer, benchUnitIds);
  const pairReserveBonus = getRaidPairReserveOfferBonus(offer, boardUnits);
  const archetypeConstructionBonus = getRaidArchetypeConstructionBonus(offer, boardUnits, benchUnitIds, boardSubUnits, state);
  const formationBalanceBonus = getFormationBalanceBonus(offer, boardUnits, benchUnits);
  const baseScore = unitIdPriority
    + unitTypePriority
    + factionBonus
    + pairReserveBonus
    + archetypeConstructionBonus;

  return offerCost * RAID_HIGH_COST_STRATEGY_COST_WEIGHT
    + (baseScore + formationBalanceBonus) * RAID_HIGH_COST_STRATEGY_BASE_SCORE_WEIGHT
    + duplicateBenchBonus * RAID_HIGH_COST_STRATEGY_DUPLICATE_WEIGHT;
}

function getRaidOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy, benchUnits = [], boardSubUnits = [], state = null) {
  if (strategy === "highCost") {
    return getRaidHighCostOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits, boardSubUnits, state);
  }

  return getRaidUpgradeOfferPriorityScore(offer, boardUnits, benchUnitIds, benchUnits, boardSubUnits, state);
}

function getOfferPriorityScore(
  role,
  offer,
  boardUnits,
  benchUnitIds,
  strategy,
  benchUnits = [],
  state = null,
  player = null,
) {
  if (role === "boss") {
    return getBossOfferPriorityScore(offer, boardUnits, benchUnitIds, strategy, benchUnits, state, player);
  }

  if (role === "raid") {
    return getRaidOfferPriorityScore(
      offer,
      boardUnits,
      benchUnitIds,
    strategy,
    benchUnits,
    player?.boardSubUnits,
    state,
  );
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
    if (offerList[index]?.purchased === true) {
      continue;
    }

    const offerCost = getOfferCost(offerList[index]);
    if (offerCost !== null && offerCost <= gold) {
      const offerScore = getOfferPriorityScore(
        role,
        offerList[index],
        boardUnits,
        benchUnitIds,
        strategy,
        benchUnits,
        state,
        player,
      ) + getMidgamePivotOfferAdjustment(
        offerList[index],
        player,
        state,
        strategy,
      ) + getRaidArchetypeShopContextAdjustment(
        offerList[index],
        offerList,
        gold,
        player,
        state,
      );
      if (bestOfferIndex === null || offerScore > bestOfferScore) {
        bestOfferIndex = index;
        bestOfferScore = offerScore;
      }
    }
  }

  return bestOfferIndex;
}

function buildBossShopReserveBuyAction(player, state = null) {
  const affordableBossSlotIndex = pickAffordableOfferIndex(
    player?.bossShopOffers,
    player?.gold,
    "boss",
    player?.boardUnits,
    player?.benchUnitIds,
    player?.helperStrategy ?? "upgrade",
    player?.benchUnits,
    state,
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
      state,
      player,
    ),
  };
}

function buildBossNormalReserveBuyAction(player, state = null) {
  const affordableShopSlotIndex = pickAffordableOfferIndex(
    player?.shopOffers,
    player?.gold,
    "boss",
    player?.boardUnits,
    player?.benchUnitIds,
    player?.helperStrategy ?? "upgrade",
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
    score: getBossOfferPriorityScore(
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      player?.helperStrategy ?? "upgrade",
      player?.benchUnits,
      state,
      player,
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
    state,
    player,
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
  const constructionDetail = getRaidArchetypeConstructionDetail(
    offer,
    player?.boardUnits,
    player?.benchUnitIds,
    player?.boardSubUnits,
    state,
  );
  const archetypeShopDecision = buildRaidArchetypeShopDecisionDiagnostic(
    player,
    offer,
    affordableShopSlotIndex,
    state,
  );
  return {
    action: {
      type: "prep_command",
      payload: {
        shopBuySlotIndex: affordableShopSlotIndex,
        ...(constructionDetail !== null && {
          botPurchaseReason: constructionDetail.reason,
          botPurchasePlanId: constructionDetail.planId,
          botPurchasePlanAnchorUnitId: constructionDetail.anchorUnitId,
          botPurchasePlanBonus: constructionDetail.bonus,
        }),
        ...(archetypeShopDecision !== null && archetypeShopDecision),
      },
    },
    score: getRaidOfferPriorityScore(
      offer,
      player?.boardUnits,
      player?.benchUnitIds,
      strategy,
      player?.benchUnits,
      player?.boardSubUnits,
      state,
    ) + getMidgamePivotOfferAdjustment(
      offer,
      player,
      state,
      strategy,
    ) + getRaidArchetypeShopContextAdjustment(
      offer,
      player?.shopOffers,
      player?.gold,
      player,
      state,
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

function buildBossReserveBuyDecision(player, state = null) {
  const bossShopBuy = buildBossShopReserveBuyAction(player, state);
  const normalShopBuy = buildBossNormalReserveBuyAction(player, state);
  const bestDecision = (() => {
    if (bossShopBuy && normalShopBuy) {
      return normalShopBuy.score > bossShopBuy.score
        ? normalShopBuy
        : bossShopBuy;
    }

    return bossShopBuy ?? normalShopBuy ?? null;
  })();

  if (!bestDecision || bestDecision.score < BOSS_MIN_RESERVE_BUY_SCORE) {
    return null;
  }

  return bestDecision;
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
    return buildBossReserveBuyDecision(player, state);
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
    const attachedSubUnit = value.subUnit ?? (
      value.attachedSubUnitId || value.attachedSubUnitType
        ? {
          unitId: value.attachedSubUnitId,
          unitType: value.attachedSubUnitType,
          detail: value.attachedSubUnitId,
        }
        : undefined
    );

    return {
      cell,
      factionId: typeof value.factionId === "string" ? value.factionId : "",
      unitId: typeof value.unitId === "string" ? value.unitId : "",
      unitType: normalizeUnitType(value.unitType),
      unitLevel: Number.isFinite(value.unitLevel) ? Number(value.unitLevel) : undefined,
      subUnit: attachedSubUnit,
    };
  }

  if (typeof value === "string") {
    const [, rawUnitId = "", rawUnitLevel = ""] = value.split(":");
    const normalizedUnitId = normalizeUnitId(rawUnitId);
    const knownUnit = getKnownCombatUnit(normalizedUnitId);
    const normalizedUnitType = normalizeUnitType(knownUnit?.unitType ?? rawUnitId);
    const unitLevel = Number(rawUnitLevel);
    return {
      cell,
      factionId: knownUnit?.factionId ?? "",
      unitId: rawUnitId,
      unitType: normalizedUnitType,
      unitLevel: Number.isInteger(unitLevel) && unitLevel > 0 ? unitLevel : undefined,
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

  if (player?.role === "boss" && !hasDeployedSpecialUnit(player)) {
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

function getAutoFillSpecialUnitUpgradeValueScore(player) {
  return getClientSpecialUnitUpgradeValueScore(player, SPECIAL_UNIT_PROGRESSION_BONUS_BY_ID);
}

function getRaidSpecialUnitUpgradePriorityScore(player, strategy = "upgrade", state = null) {
  if (player?.role !== "raid") {
    return Number.NEGATIVE_INFINITY;
  }

  const currentLevel = getClientSpecialUnitLevel(player);
  const upgradeValueScore =
    getAutoFillSpecialUnitUpgradeValueScore(player) * RAID_SPECIAL_UNIT_UPGRADE_SCORE_WEIGHT;
  if (upgradeValueScore <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const roundIndex = getStateRoundIndex(state);
  const ownedRaidUnitCount = getOwnedRaidUnitCount(player);
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
    getAutoFillSpecialUnitUpgradeValueScore(player) * BOSS_SPECIAL_UNIT_UPGRADE_SCORE_WEIGHT;
  if (upgradeValueScore <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const roundIndex = getStateRoundIndex(state);
  const ownedBossUnitCount = getOwnedBossUnitCount(player);
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

  const ownedRaidUnitCount = getOwnedRaidUnitCount(player);

  if (currentLevel <= 4) {
    return ownedRaidUnitCount >= 2 && roundIndex >= 5;
  }

  return currentLevel <= 6
    && ownedRaidUnitCount >= 3
    && roundIndex >= 8;
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
  const ownedRaidUnitCount = getOwnedRaidUnitCount(player);

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
  if (currentLevel > 4) {
    return false;
  }

  const ownedRaidUnitCount = getOwnedRaidUnitCount(player);
  if (currentLevel <= 2) {
    return ownedRaidUnitCount >= 2;
  }

  return roundIndex >= 7 && ownedRaidUnitCount >= 3;
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

  if (!hasEstablishedBossExclusiveCore(player)) {
    return false;
  }

  const ownedBossUnitCount = getOwnedBossUnitCount(player);
  return ownedBossUnitCount >= 3;
}

function buildSpecialUnitUpgradeDecision(player, playerPhase, strategy = "upgrade", state = null) {
  const action = buildSpecialUnitUpgradeAction(player, playerPhase);
  if (!action) {
    return null;
  }

  const valueScore = getAutoFillSpecialUnitUpgradeValueScore(player);
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

  if (player.role === "raid") {
    return specialUnitId
      ? HEROES.some((hero) => hero.id === specialUnitId)
      : toArray(player?.boardUnits).some((unit) =>
        HEROES.some((hero) => hero.id === normalizeUnitId(resolveSpecialCheckUnitId(unit))));
  }

  if (player.role === "boss") {
    return specialUnitId
      ? BOSS_CHARACTERS.some((boss) => boss.id === specialUnitId)
      : toArray(player?.boardUnits).some((unit) =>
        BOSS_CHARACTERS.some((boss) => boss.id === normalizeUnitId(resolveSpecialCheckUnitId(unit))));
  }

  // Real room state does not serialize the selected hero/boss into boardUnits tokens.
  // Once a special unit is selected, it already participates in combat and can be upgraded.
  return true;
}

function getOwnedRaidUnitCount(player) {
  return getNonSpecialBoardUnitCount(
    player?.boardUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  )
    + getNonSpecialUnitCount(
      player?.benchUnits,
      player?.selectedHeroId,
      player?.selectedBossId,
    )
    + (hasDeployedSpecialUnit(player) ? 1 : 0);
}

function getOwnedBossUnitCount(player) {
  return getNonSpecialBoardUnitCount(
    player?.boardUnits,
    player?.selectedHeroId,
    player?.selectedBossId,
  )
    + getNonSpecialUnitCount(
      player?.benchUnits,
      player?.selectedHeroId,
      player?.selectedBossId,
    )
    + (hasDeployedSpecialUnit(player) ? 1 : 0);
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
  if (shouldBossRefreshUnownedHighCostAfterCarrySeeds(player, targetOffer, state)) {
    return true;
  }

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

function getOwnedNormalHighCostUnitIds(player) {
  const unitIds = new Set();
  for (const unitId of getOwnedReserveAndBoardUnitIdCounts(player).keys()) {
    const knownUnit = getKnownTouhouUnit(unitId);
    if ((knownUnit?.cost ?? 0) >= 4) {
      unitIds.add(unitId);
    }
  }
  return unitIds;
}

function shouldBossRefreshUnownedHighCostAfterCarrySeeds(player, targetOffer, state = null) {
  if (player?.role !== "boss" || !targetOffer) {
    return false;
  }

  const offerCost = getOfferCost(targetOffer) ?? 0;
  if (offerCost < 4 || canReserveOfferStackIntoOwnedUnit(player, targetOffer)) {
    return false;
  }

  const targetUnitId = normalizeOfferUnitId(targetOffer);
  if (
    BOSS_OFFER_PRIORITY_BY_UNIT_ID[targetUnitId] !== undefined
    || BOSS_COMMON_OFFER_PRIORITY_BY_UNIT_ID[targetUnitId] !== undefined
  ) {
    return false;
  }

  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null || roundIndex < BOSS_FUTURE_RESERVE_MIN_ROUND) {
    return false;
  }

  if (getClientSpecialUnitLevel(player) < BOSS_FUTURE_RESERVE_MIN_SPECIAL_LEVEL) {
    return false;
  }

  if (!hasEstablishedBossExclusiveCore(player)) {
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

  return getOwnedNormalHighCostUnitIds(player).size >= 2;
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

function getBenchUnitArchetypeConstructionKeepBonus(player, benchIndex, targetOffer = null) {
  if (isHeroExclusiveOffer(targetOffer)) {
    return 0;
  }

  const benchUnitId = normalizeUnitId(toArray(player?.benchUnitIds)[benchIndex]);
  const protectionDetail = getRaidArchetypeConstructionProtectionDetail(benchUnitId, player);
  if (protectionDetail === null) {
    return 0;
  }

  const baseBonus = protectionDetail.anchorPresent
    ? RAID_ARCHETYPE_BENCH_ANCHOR_KEEP_BONUS
    : RAID_ARCHETYPE_BENCH_PARTIAL_KEEP_BONUS;
  const commitBonus = protectionDetail.commitReady
    ? RAID_ARCHETYPE_BENCH_COMMIT_KEEP_BONUS
    : 0;
  const nearCompleteBonus = protectionDetail.nearComplete
    ? RAID_ARCHETYPE_BENCH_NEAR_COMPLETE_KEEP_BONUS
    : 0;
  return baseBonus + commitBonus + nearCompleteBonus;
}

function shouldRefreshInsteadOfBreakingRaidArchetypeBench(player, targetOffer) {
  if (player?.role !== "raid" || !targetOffer || isHeroExclusiveOffer(targetOffer)) {
    return false;
  }

  if (toArray(player?.benchUnits).length < AUTO_FILL_BENCH_CAPACITY) {
    return false;
  }

  const targetUnitId = normalizeOfferUnitId(targetOffer);
  const protectedPlanDetails = toArray(player?.benchUnitIds)
    .map((unitId) => getRaidArchetypeConstructionProtectionDetail(unitId, player))
    .filter((detail) => detail !== null && detail.nearComplete);
  if (protectedPlanDetails.length === 0) {
    return false;
  }

  return !protectedPlanDetails.some((detail) => {
    const plan = RAID_ARCHETYPE_CONSTRUCTION_PLANS.find((candidate) =>
      candidate.planId === detail.planId);
    return plan?.unitIds.has(targetUnitId) === true;
  });
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
    ) + getBenchUnitDuplicateKeepBonus(player, benchIndex)
      + getBenchUnitArchetypeConstructionKeepBonus(player, benchIndex, targetOffer);

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

function isProtectedBossBoardSellPlacement(player, placement, placements, state = null) {
  if (player?.role !== "boss" || !placement) {
    return true;
  }

  const unitId = normalizeUnitId(placement.unitId);
  if (!unitId) {
    return true;
  }

  if (unitId === normalizeUnitId(player?.selectedBossId) || AUTO_FILL_SPECIAL_UNIT_IDS.has(unitId)) {
    return true;
  }

  const canPivotFromMeilingToSakuyaPatchouli = unitId === "meiling" && hasSakuyaPatchouliCore(player);

  if (BOSS_EXCLUSIVE_CORE_UNIT_IDS.has(unitId) && !canPivotFromMeilingToSakuyaPatchouli) {
    return true;
  }

  if (
    Number.isFinite(placement.unitLevel)
    && placement.unitLevel >= 4
    && !(canPivotFromMeilingToSakuyaPatchouli && placement.unitLevel < 7)
  ) {
    return true;
  }

  if (isFrontlineUnitType(placement.unitType)) {
    const frontlineCount = placements.filter((candidate) =>
      isFrontlineUnitType(candidate.unitType)
    ).length;
    const desiredFrontlineCount = getBossDesiredFrontlineCount(getStateRoundIndex(state));
    if (frontlineCount <= desiredFrontlineCount) {
      return true;
    }
  }

  return false;
}

function getBoardUnitSellPriorityScore(player, placement, strategy = "upgrade") {
  return getLegacyBenchUnitPriorityScore(
    player?.role,
    placement?.unitType,
    placement?.unitId,
    strategy,
  );
}

function getBoardSellCandidate(player, targetOffer, strategy = "upgrade", state = null) {
  if (player?.role !== "boss" || !targetOffer) {
    return null;
  }

  const placedStandardBoardUnitCount = getPlacedStandardBoardUnitCount(
    player.role,
    player.boardUnits,
    player.selectedHeroId,
    player.selectedBossId,
  );
  if (placedStandardBoardUnitCount < getMaxStandardDeploySlotsForRole(player.role)) {
    return null;
  }

  const placements = toArray(player?.boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null);
  if (placements.length === 0) {
    return null;
  }

  const targetScore = getReserveTargetOfferScore(
    targetOffer,
    player,
    strategy,
    state,
  );
  let weakestPlacement = null;
  let weakestScore = Number.POSITIVE_INFINITY;

  for (const placement of placements) {
    if (isProtectedBossBoardSellPlacement(player, placement, placements, state)) {
      continue;
    }

    const placementScore = getBoardUnitSellPriorityScore(player, placement, strategy);
    if (placementScore < weakestScore) {
      weakestScore = placementScore;
      weakestPlacement = placement;
    }
  }

  if (weakestPlacement === null) {
    return null;
  }

  return targetScore >= weakestScore + AUTO_FILL_RESERVE_SELL_SCORE_MARGIN
    ? weakestPlacement.cell
    : null;
}

function canBossUseReserveDecisionWithoutDeploySlot(player, reserveBuyDecision, strategy = "upgrade", state = null) {
  if (player?.role !== "boss" || !reserveBuyDecision) {
    return false;
  }

  const targetOffer = getOfferFromReserveBuyAction(player, reserveBuyDecision.action);
  if (!targetOffer) {
    return false;
  }

  if (canReserveOfferStackIntoOwnedUnit(player, targetOffer)) {
    return true;
  }

  return getBenchSellCandidate(player, targetOffer, strategy, state) !== null
    || getBoardSellCandidate(player, targetOffer, strategy, state) !== null
    || canBossUseFutureReserveDecisionWithoutDeploySlot(player, targetOffer, strategy, state);
}

function getOfferFutureReserveValueScore(offer, player, strategy = "upgrade", state = null) {
  const knownUnit = getKnownOfferCombatStats(offer);
  return getFutureValueScore(
    {
      source: "bench",
      unitId: normalizeOfferUnitId(offer),
      unitType: normalizeOfferUnitType(offer),
      cost: getOfferCost(offer),
    },
    {
      player,
      role: player?.role,
      state,
      strategy,
    },
    knownUnit,
  );
}

function canBossUseFutureReserveDecisionWithoutDeploySlot(player, targetOffer, strategy = "upgrade", state = null) {
  if (player?.role !== "boss" || !targetOffer) {
    return false;
  }

  const roundIndex = getStateRoundIndex(state);
  if (roundIndex === null || roundIndex < BOSS_FUTURE_RESERVE_MIN_ROUND) {
    return false;
  }

  if (getClientSpecialUnitLevel(player) < BOSS_FUTURE_RESERVE_MIN_SPECIAL_LEVEL) {
    return false;
  }

  if (!hasEstablishedBossExclusiveCore(player)) {
    return false;
  }

  const benchPressure = toArray(player?.benchUnits).length / AUTO_FILL_BENCH_CAPACITY;
  if (benchPressure > BOSS_FUTURE_RESERVE_BENCH_PRESSURE_LIMIT) {
    return false;
  }

  return getOfferFutureReserveValueScore(targetOffer, player, strategy, state)
    >= BOSS_FUTURE_RESERVE_VALUE_FLOOR;
}

function canRaidUseFutureReserveDecisionWithoutDeploySlot(player, reserveBuyDecision, strategy = "upgrade", state = null) {
  if (player?.role !== "raid" || !reserveBuyDecision) {
    return false;
  }

  const benchPressure = toArray(player?.benchUnits).length / AUTO_FILL_BENCH_CAPACITY;
  if (benchPressure > AUTO_FILL_FUTURE_RESERVE_BENCH_PRESSURE_LIMIT) {
    return false;
  }

  const targetOffer = getOfferFromReserveBuyAction(player, reserveBuyDecision.action);
  if (!targetOffer) {
    return false;
  }

  return getOfferFutureReserveValueScore(targetOffer, player, strategy, state)
    >= AUTO_FILL_FUTURE_RESERVE_VALUE_FLOOR;
}

function shouldBossFillOpenSlotWithReserveBuy(player, reserveBuyDecision, nextDeployCell, strategy = "upgrade", state = null) {
  if (player?.role !== "boss" || nextDeployCell === null || !reserveBuyDecision) {
    return false;
  }

  const targetOffer = getOfferFromReserveBuyAction(player, reserveBuyDecision.action);
  if (!targetOffer) {
    return false;
  }

  if (canReserveOfferStackIntoOwnedUnit(player, targetOffer)) {
    return true;
  }

  return getReserveTargetOfferScore(
    targetOffer,
    player,
    strategy,
    state,
  ) >= BOSS_OPEN_SLOT_RESERVE_BUY_SCORE_FLOOR;
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

    const boardSellIndex = getBoardSellCandidate(player, targetOffer, strategy, state);
    if (boardSellIndex !== null) {
      return {
        type: "prep_command",
        payload: { boardSellIndex },
      };
    }

    if (
      shouldRefreshInsteadOfBreakingRaidArchetypeBench(player, targetOffer)
      && canRefreshReserveShop(player, strategy)
    ) {
      return {
        type: "prep_command",
        payload: { shopRefreshCount: 1 },
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
  optimizationVariant,
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
    const helperOptimizationVariant = normalizeAutoFillOptimizationVariant(optimizationVariant);
    const helperRoleOptimizationDisabled = isRoleOptimizationDisabled(
      helperPlayer.role,
      helperOptimizationVariant,
    );
    const helperBoardRefitOptimizationDisabled = isBoardRefitOptimizationDisabled(
      helperPlayer.role,
      helperOptimizationVariant,
    );
    const helperFutureShopOptimizationDisabled = isFutureShopOptimizationDisabled(
      helperPlayer.role,
      helperOptimizationVariant,
    );
    const helperOkinaHostOptimizationDisabled = isOkinaHostOptimizationDisabled(
      helperPlayer.role,
      helperOptimizationVariant,
    );

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
    const reserveBuyDecision = (() => {
      if (nextDeployCell !== null || hasSubDeployCapacity) {
        return buildReserveBuyDecision(helperPlayer, helperStrategy, state);
      }

      const candidateDecision = (helperPlayer.role === "boss" || helperPlayer.role === "raid") && playerPhase === "purchase"
        ? buildReserveBuyDecision(helperPlayer, helperStrategy, state)
        : null;
      if (!helperFutureShopOptimizationDisabled && canBossUseReserveDecisionWithoutDeploySlot(
        helperPlayer,
        candidateDecision,
        helperStrategy,
        state,
      )) {
        return candidateDecision;
      }

      return !helperFutureShopOptimizationDisabled && canRaidUseFutureReserveDecisionWithoutDeploySlot(
        helperPlayer,
        candidateDecision,
        helperStrategy,
        state,
      )
        ? candidateDecision
        : null;
    })();
    const reserveBuyAction = reserveBuyDecision?.action ?? null;
    const specialUnitUpgradeDecision = buildSpecialUnitUpgradeDecision(
      helperPlayer,
      playerPhase,
      helperStrategy,
      state,
    );
    const bossReserveBuyUsesRosterManagement = helperPlayer.role === "boss"
      && reserveBuyDecision !== null
      && nextDeployCell === null
      && !helperFutureShopOptimizationDisabled
      && canBossUseReserveDecisionWithoutDeploySlot(
        helperPlayer,
        reserveBuyDecision,
        helperStrategy,
        state,
      );
    const bossReserveBuyFillsOpenSlot = shouldBossFillOpenSlotWithReserveBuy(
      helperPlayer,
      reserveBuyDecision,
      nextDeployCell,
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
        (
          shouldLockInBossSpecialUnitUpgrade(helperPlayer, state)
          && !(nextDeployCell !== null && reserveBuyDecision !== null)
          && !bossReserveBuyUsesRosterManagement
          && !bossReserveBuyFillsOpenSlot
        )
        || (
          reserveBuyDecision !== null
          && !bossReserveBuyUsesRosterManagement
          && !bossReserveBuyFillsOpenSlot
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
        helperPlayer.benchUnitIds,
        helperPlayer.selectedHeroId,
        helperPlayer.selectedBossId,
        getStateRoundIndex(state),
      )
      : [];
    const okinaHeroSubDeployAction = helperOkinaHostOptimizationDisabled
      ? null
      : buildOkinaHeroSubDeployAction(helperPlayer);
    const boardRefitAction = helperBoardRefitOptimizationDisabled
      ? null
      : buildConservativeBoardRefitAction(helperPlayer, state, playerPhase);
    const boardRefitFollowUpDeployAction = helperBoardRefitOptimizationDisabled
      ? null
      : buildBoardRefitFollowUpDeployAction(
        helperPlayer,
        state,
        helperIndex,
        helperStrategy,
      );
    const bossBodyGuardMoveAction = helperBoardRefitOptimizationDisabled
      ? null
      : buildBossBodyGuardMoveAction(helperPlayer, state, playerPhase);

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

      if (okinaHeroSubDeployAction) {
        return [okinaHeroSubDeployAction];
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
      if (boardRefitFollowUpDeployAction) {
        return [boardRefitFollowUpDeployAction];
      }

      if (okinaHeroSubDeployAction) {
        return [okinaHeroSubDeployAction];
      }

      if (bossBodyGuardMoveAction) {
        return [bossBodyGuardMoveAction];
      }

      if (boardRefitAction) {
        return [boardRefitAction];
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

    if (boardRefitFollowUpDeployAction) {
      return [boardRefitFollowUpDeployAction];
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

    if (bossBodyGuardMoveAction) {
      return [bossBodyGuardMoveAction];
    }

    if (boardRefitAction) {
      return [boardRefitAction];
    }

    if (reserveBuyAction) {
      return [reserveBuyAction];
    }

    if (specialUnitUpgradeDecision) {
      return [specialUnitUpgradeDecision.action];
    }

    if (okinaHeroSubDeployAction) {
      return [okinaHeroSubDeployAction];
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
