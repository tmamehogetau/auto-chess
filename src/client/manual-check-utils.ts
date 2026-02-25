const VALID_UNIT_TYPES = new Set(["vanguard", "ranger", "mage", "assassin"]);
const MAX_BOARD_UNITS = 8;
const MIN_CELL_INDEX = 0;
const MAX_CELL_INDEX = 7;
const DEFAULT_AUTO_DELAY_MS = 300;
const MAX_AUTO_DELAY_MS = 30_000;
const MIN_AUTO_FILL_BOTS = 0;
const MAX_AUTO_FILL_BOTS = 3;

export interface BoardUnitPlacement {
  cell: number;
  unitType: string;
  starLevel?: number;
}

export interface BattleResult {
  winner: "left" | "right" | "draw";
  leftSurvivors: Array<{ id: string; type: string; hp: number; maxHp: number }>;
  rightSurvivors: Array<{ id: string; type: string; hp: number; maxHp: number }>;
  combatLog: string[];
  durationMs: number;
}

export interface SynergyDetails {
  countsByType: Record<string, number>;
  activeTiers: Record<string, number>;
}

export function parsePlacementsSpec(spec: string | undefined | null): BoardUnitPlacement[] {
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

  const usedCells = new Set<number>();
  const placements: BoardUnitPlacement[] = [];

  for (const entry of rawEntries) {
    const parts = entry.split(":");

    if (parts.length !== 2) {
      throw new Error(`invalid placement entry: ${entry}`);
    }

    const cellText = parts[0]?.trim();
    const unitType = parts[1]?.trim();

    if (!cellText || !unitType) {
      throw new Error(`invalid placement entry: ${entry}`);
    }

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

export function parseAutoFlag(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true";
}

export function parseAutoDelayMs(value: unknown): number {
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

export function parseAutoFillBots(value: unknown): number {
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
 * @param combatLog 戦闘ログ配列
 * @returns 改行で結合された文字列
 */
export function formatCombatLogForDisplay(combatLog: string[]): string {
  return combatLog.join('\n');
}

/**
 * シナジー情報を表示用にフォーマット
 * @param synergyDetails シナジー詳細情報
 * @returns 改行で結合された文字列
 */
export function formatSynergyDisplay(
  synergyDetails: SynergyDetails
): string {
  const lines: string[] = [];
  
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
 * @param result 戦闘結果
 * @returns フォーマットされた戦闘結果文字列
 */
export function displayBattleResult(result: BattleResult): string {
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
 * @param placements ユニット配置配列
 * @returns シナジー情報の文字列
 */
export function displaySynergies(
  placements: Array<{ unitType: string }>
): string {
  const counts: Record<string, number> = {};
  for (const p of placements) {
    counts[p.unitType] = (counts[p.unitType] || 0) + 1;
  }
  
  const lines: string[] = ['Active Synergies:'];
  
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
