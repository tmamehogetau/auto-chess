const VALID_UNIT_TYPES = new Set(["vanguard", "ranger", "mage", "assassin"]);
const MAX_BOARD_UNITS = 8;
const MIN_CELL_INDEX = 0;
const MAX_CELL_INDEX = 7;
const DEFAULT_AUTO_DELAY_MS = 300;
const MAX_AUTO_DELAY_MS = 30_000;
const MIN_AUTO_FILL_BOTS = 0;
const MAX_AUTO_FILL_BOTS = 3;

export function parsePlacementsSpec(spec) {
  const trimmedSpec = String(spec ?? "").trim();

  if (!trimmedSpec) {
    return [];
  }

  const rawEntries = trimmedSpec
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (rawEntries.length > MAX_BOARD_UNITS) {
    throw new Error(`placements must be <= ${MAX_BOARD_UNITS}`);
  }

  const usedCells = new Set();
  const placements = [];

  for (const entry of rawEntries) {
    const parts = entry.split(":");

    if (parts.length !== 2) {
      throw new Error(`invalid placement entry: ${entry}`);
    }

    const cellText = parts[0].trim();
    const unitType = parts[1].trim();
    const cell = Number.parseInt(cellText, 10);

    if (!Number.isInteger(cell) || cell < MIN_CELL_INDEX || cell > MAX_CELL_INDEX) {
      throw new Error(`cell must be integer ${MIN_CELL_INDEX}-${MAX_CELL_INDEX}`);
    }

    if (!VALID_UNIT_TYPES.has(unitType)) {
      throw new Error(`invalid unitType: ${unitType}`);
    }

    if (usedCells.has(cell)) {
      throw new Error(`duplicate cell: ${cell}`);
    }

    usedCells.add(cell);
    placements.push({ cell, unitType });
  }

  placements.sort((left, right) => left.cell - right.cell);

  return placements;
}

export function parseBoardUnitToken(token) {
  const trimmedToken = String(token ?? "").trim();

  if (!trimmedToken) {
    return null;
  }

  const match = trimmedToken.match(/^(\d+):([^:]+?)(?::(\d+))?$/);

  if (!match) {
    return null;
  }

  const cell = Number.parseInt(match[1], 10);

  if (!Number.isInteger(cell) || cell < MIN_CELL_INDEX || cell > MAX_CELL_INDEX) {
    return null;
  }

  const unitType = match[2]?.trim();

  if (!unitType) {
    return null;
  }

  const parsedStarLevel = match[3] ? Number.parseInt(match[3], 10) : 1;

  if (!Number.isInteger(parsedStarLevel) || parsedStarLevel < 1) {
    return null;
  }

  return {
    cell,
    unitType,
    starLevel: parsedStarLevel,
  };
}

export function parseAutoFlag(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true";
}

export function parseAutoDelayMs(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_AUTO_DELAY_MS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_AUTO_DELAY_MS;
  }

  if (parsed > MAX_AUTO_DELAY_MS) {
    return MAX_AUTO_DELAY_MS;
  }

  return parsed;
}

export function parseAutoFillBots(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return MIN_AUTO_FILL_BOTS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < MIN_AUTO_FILL_BOTS) {
    return MIN_AUTO_FILL_BOTS;
  }

  if (parsed > MAX_AUTO_FILL_BOTS) {
    return MAX_AUTO_FILL_BOTS;
  }

  return parsed;
}

/**
 * 戦闘ログを表示用にフォーマット
 * @param {string[]} combatLog 戦闘ログ配列
 * @returns {string} 改行で結合された文字列
 */
export function formatCombatLogForDisplay(combatLog) {
  return combatLog.join('\n');
}

/**
 * シナジー情報を表示用にフォーマット
 * @param {Object} synergyDetails シナジー詳細情報
 * @returns {string} 改行で結合された文字列
 */
export function formatSynergyDisplay(synergyDetails) {
  const lines = [];

  for (const [unitType, count] of Object.entries(synergyDetails.countsByType)) {
    if (count > 0) {
      const tier = synergyDetails.activeTiers[unitType] ?? 0;
      const tierStars = '★'.repeat(tier);
      lines.push(`${unitType}: ${count}体 ${tierStars}`);
    }
  }

  return lines.join('\n');
}

/**
 * 戦闘結果を表示用にフォーマット
 * @param {Object} result 戦闘結果
 * @returns {string} フォーマットされた戦闘結果文字列
 */
export function displayBattleResult(result) {
  const lines = [
    `=== Battle Result ===`,
    `Winner: ${result.winner}`,
    `Survivors: ${result.leftSurvivors.length} vs ${result.rightSurvivors.length}`,
    ``,
    `=== Combat Log ===`,
    ...result.combatLog.slice(-20), // Last 20 lines
  ];
  return lines.join('\n');
}

/**
 * 配置からシナジー情報を表示用にフォーマット
 * @param {Array<{unitType: string}>} placements ユニット配置配列
 * @returns {string} シナジー情報の文字列
 */
export function displaySynergies(placements) {
  const counts = {};
  for (const p of placements) {
    counts[p.unitType] = (counts[p.unitType] || 0) + 1;
  }

  const lines = ['Active Synergies:'];

  for (const [type, count] of Object.entries(counts)) {
    let tier = 0;
    if (count >= 9) tier = 3;
    else if (count >= 6) tier = 2;
    else if (count >= 3) tier = 1;

    if (tier > 0) {
      lines.push(`  ${type}: ${count}体 ${'★'.repeat(tier)}`);
    }
  }

  return lines.join('\n');
}
