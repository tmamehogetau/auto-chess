import { join } from "node:path";

import { availableParallelism as getAvailableParallelism, cpus } from "node:os";
import {
  createFastParityGameRoomOptions,
  type GameRoomTimingOptions,
} from "../../../src/server/rooms/game-room-config";
import { AUTO_FILL_HERO_IDS } from "../../../src/client/autofill-helper-automation.js";

const BOT_BALANCE_BASELINE_AUTO_PARALLELISM_MIN = 4;
const BOT_BALANCE_BASELINE_AUTO_PARALLELISM_MAX = 16;
export const DEFAULT_BOT_BALANCE_BASELINE_PARALLELISM = 12;
export const BOT_BALANCE_BASELINE_PORT_OFFSET_STRIDE = 500;
export const DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE = 10_000;
export const DEFAULT_BOT_BALANCE_BASELINE_HELPER_POLICY = "strength";
export const DEFAULT_BOT_BALANCE_BASELINE_OPTIMIZATION_VARIANT = "full";
export const DEFAULT_BOT_BALANCE_BASELINE_BATTLE_SEED_BASE = 20_260_504;
const BOT_BALANCE_BASELINE_TEST_SERVER_PORT_BASE = 2_570;
const BOT_BALANCE_BASELINE_TEST_SERVER_PORT_HASH_RANGE = 200;
const BOT_BALANCE_BASELINE_TEST_SERVER_PORT_MAX = 65_535;
const BOT_BALANCE_BASELINE_READY_AUTO_START_MS = 200;
const BOT_BALANCE_BASELINE_SETTLE_DURATION_MS = 20;
const BOT_BALANCE_BASELINE_ELIMINATION_DURATION_MS = 10;
const BOT_BALANCE_BASELINE_SELECTION_TIMEOUT_MS = 200;
const BOT_BALANCE_BASELINE_BATTLE_TIMELINE_TIME_SCALE = 0.01;

export type BotBalanceBaselineHelperPolicy = "strength" | "growth";
export type BotBalanceBaselineOptimizationVariant =
  | "full"
  | "raid-optimization-off"
  | "boss-optimization-off"
  | "all-optimization-off"
  | "board-refit-off"
  | "raid-board-refit-off"
  | "boss-board-refit-off"
  | "future-shop-off"
  | "okina-host-off";
export type BotBalanceBaselineHelperConfig = {
  wantsBoss: boolean;
  policy: BotBalanceBaselineHelperPolicy;
  heroId?: string;
  optimizationVariant?: BotBalanceBaselineOptimizationVariant;
};

export type BotBalanceBaselineRaidHeroIds = [string, string, string];

export type BaselineChunkDefinition = {
  chunkIndex: number;
  matchStartIndex: number;
  requestedMatchCount: number;
  chunkJsonPath: string;
  logPath: string;
};

export type BaselineChunkConfigSnapshot = {
  requestedMatchCount: number;
  bossPolicy: BotBalanceBaselineHelperPolicy;
  raidPolicies: [
    BotBalanceBaselineHelperPolicy,
    BotBalanceBaselineHelperPolicy,
    BotBalanceBaselineHelperPolicy,
  ];
  raidHeroIds: BotBalanceBaselineRaidHeroIds | null;
  optimizationVariant: BotBalanceBaselineOptimizationVariant;
  bossExtraPrepIncome: number;
  bossExtraTotalPrepIncome: number;
  battleSeedBase: number;
};

export function resolveBotBalanceBaselineHelperPolicy(
  rawValue: string | undefined | null,
): BotBalanceBaselineHelperPolicy {
  return rawValue === "growth" || rawValue === "strength"
    ? rawValue
    : DEFAULT_BOT_BALANCE_BASELINE_HELPER_POLICY;
}

export function resolveBotBalanceBaselineRaidPolicies(
  rawValue: string | undefined | null,
): BotBalanceBaselineHelperPolicy[] {
  const parsedPolicies = String(rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 3)
    .map((value) => resolveBotBalanceBaselineHelperPolicy(value));

  return Array.from({ length: 3 }, (_, index) =>
    parsedPolicies[index] ?? DEFAULT_BOT_BALANCE_BASELINE_HELPER_POLICY);
}

export function resolveBotBalanceBaselineRaidHeroIds(
  rawValue: string | undefined | null,
): BotBalanceBaselineRaidHeroIds | null {
  const parsedHeroIds = String(rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parsedHeroIds.length === 0) {
    return null;
  }
  if (parsedHeroIds.length !== 3) {
    throw new Error("Fixed raid hero baseline requires exactly 3 hero ids");
  }

  for (const heroId of parsedHeroIds) {
    if (!AUTO_FILL_HERO_IDS.includes(heroId)) {
      throw new Error(`Unknown raid hero for baseline: ${heroId}`);
    }
  }

  return [
    parsedHeroIds[0]!,
    parsedHeroIds[1]!,
    parsedHeroIds[2]!,
  ];
}

export function resolveBotBalanceBaselineOptimizationVariant(
  rawValue: string | undefined | null,
): BotBalanceBaselineOptimizationVariant {
  return rawValue === "raid-optimization-off"
    || rawValue === "boss-optimization-off"
    || rawValue === "all-optimization-off"
    || rawValue === "board-refit-off"
    || rawValue === "raid-board-refit-off"
    || rawValue === "boss-board-refit-off"
    || rawValue === "future-shop-off"
    || rawValue === "okina-host-off"
    || rawValue === "full"
    ? rawValue
    : DEFAULT_BOT_BALANCE_BASELINE_OPTIMIZATION_VARIANT;
}

export function resolveBotBalanceBaselineBossExtraPrepIncome(
  rawValue: string | number | undefined | null,
): number {
  const parsedValue = typeof rawValue === "number"
    ? rawValue
    : Number.parseInt(String(rawValue ?? ""), 10);
  return Number.isFinite(parsedValue)
    ? Math.max(0, Math.trunc(parsedValue))
    : 0;
}

export function resolveBotBalanceBaselineBossExtraTotalPrepIncome(
  rawValue: string | number | undefined | null,
): number {
  const parsedValue = typeof rawValue === "number"
    ? rawValue
    : Number.parseInt(String(rawValue ?? ""), 10);
  return Number.isFinite(parsedValue)
    ? Math.max(0, Math.trunc(parsedValue))
    : 0;
}

export function resolveBotBalanceBaselineBattleSeedBase(
  rawValue: string | number | undefined | null,
): number {
  const parsedValue = typeof rawValue === "number"
    ? rawValue
    : Number.parseInt(String(rawValue ?? ""), 10);
  return Number.isFinite(parsedValue)
    ? Math.max(0, Math.trunc(parsedValue))
    : DEFAULT_BOT_BALANCE_BASELINE_BATTLE_SEED_BASE;
}

export function createBotBalanceBaselineHelperConfigs(options: {
  bossPolicy?: BotBalanceBaselineHelperPolicy;
  raidPolicies?: BotBalanceBaselineHelperPolicy[];
  raidHeroIds?: BotBalanceBaselineRaidHeroIds | null;
  optimizationVariant?: BotBalanceBaselineOptimizationVariant;
} = {}): BotBalanceBaselineHelperConfig[] {
  const bossPolicy = resolveBotBalanceBaselineHelperPolicy(options.bossPolicy);
  const raidPolicies = Array.from({ length: 3 }, (_, index) =>
    resolveBotBalanceBaselineHelperPolicy(
      options.raidPolicies?.[index] ?? DEFAULT_BOT_BALANCE_BASELINE_HELPER_POLICY,
    ));
  const optimizationVariant = resolveBotBalanceBaselineOptimizationVariant(options.optimizationVariant);
  const optimizationVariantPatch = optimizationVariant === DEFAULT_BOT_BALANCE_BASELINE_OPTIMIZATION_VARIANT
    ? {}
    : { optimizationVariant };

  return [
    { wantsBoss: true, policy: bossPolicy, ...optimizationVariantPatch },
    ...raidPolicies.map((policy, index) => ({
      wantsBoss: false,
      policy,
      ...(options.raidHeroIds?.[index] ? { heroId: options.raidHeroIds[index] } : {}),
      ...optimizationVariantPatch,
    })),
  ];
}

export function createBaselineChunkConfigSnapshot(options: {
  requestedMatchCount: number;
  bossPolicy: BotBalanceBaselineHelperPolicy;
  raidPolicies: BotBalanceBaselineHelperPolicy[];
  raidHeroIds?: BotBalanceBaselineRaidHeroIds | null;
  optimizationVariant?: BotBalanceBaselineOptimizationVariant;
  bossExtraPrepIncome?: number;
  bossExtraTotalPrepIncome?: number;
  battleSeedBase?: number;
}): BaselineChunkConfigSnapshot {
  return {
    requestedMatchCount: Math.max(0, Math.trunc(options.requestedMatchCount)),
    bossPolicy: resolveBotBalanceBaselineHelperPolicy(options.bossPolicy),
    raidPolicies: [
      resolveBotBalanceBaselineHelperPolicy(options.raidPolicies[0]),
      resolveBotBalanceBaselineHelperPolicy(options.raidPolicies[1]),
      resolveBotBalanceBaselineHelperPolicy(options.raidPolicies[2]),
    ],
    raidHeroIds: options.raidHeroIds ?? null,
    optimizationVariant: resolveBotBalanceBaselineOptimizationVariant(options.optimizationVariant),
    bossExtraPrepIncome: resolveBotBalanceBaselineBossExtraPrepIncome(options.bossExtraPrepIncome),
    bossExtraTotalPrepIncome: resolveBotBalanceBaselineBossExtraTotalPrepIncome(options.bossExtraTotalPrepIncome),
    battleSeedBase: resolveBotBalanceBaselineBattleSeedBase(options.battleSeedBase),
  };
}

export function baselineChunkConfigMatches(
  actual: BaselineChunkConfigSnapshot | undefined,
  expected: BaselineChunkConfigSnapshot,
): boolean {
  if (!actual) {
    return false;
  }

  return actual.requestedMatchCount === expected.requestedMatchCount
    && actual.bossPolicy === expected.bossPolicy
    && actual.raidPolicies.length === expected.raidPolicies.length
    && actual.raidPolicies.every((policy, index) => policy === expected.raidPolicies[index])
    && JSON.stringify(actual.raidHeroIds ?? null) === JSON.stringify(expected.raidHeroIds ?? null)
    && resolveBotBalanceBaselineOptimizationVariant(actual.optimizationVariant)
      === resolveBotBalanceBaselineOptimizationVariant(expected.optimizationVariant)
    && resolveBotBalanceBaselineBossExtraPrepIncome(actual.bossExtraPrepIncome)
      === resolveBotBalanceBaselineBossExtraPrepIncome(expected.bossExtraPrepIncome)
    && resolveBotBalanceBaselineBossExtraTotalPrepIncome(actual.bossExtraTotalPrepIncome)
      === resolveBotBalanceBaselineBossExtraTotalPrepIncome(expected.bossExtraTotalPrepIncome)
    && resolveBotBalanceBaselineBattleSeedBase(actual.battleSeedBase)
      === resolveBotBalanceBaselineBattleSeedBase(expected.battleSeedBase);
}

function resolveRuntimeAvailableParallelism(): number {
  try {
    return getAvailableParallelism();
  } catch {
    return cpus().length;
  }
}

export function createBaselineChunkDefinitions(
  matchCount: number,
  chunkSize: number,
  outputDir: string,
): BaselineChunkDefinition[] {
  const normalizedMatchCount = Math.trunc(matchCount);
  if (normalizedMatchCount <= 0) {
    return [];
  }
  const normalizedChunkSize = Math.max(1, Math.trunc(chunkSize));
  const definitions: BaselineChunkDefinition[] = [];

  for (
    let chunkIndex = 0, matchStartIndex = 0;
    matchStartIndex < normalizedMatchCount;
    chunkIndex += 1, matchStartIndex += normalizedChunkSize
  ) {
    definitions.push({
      chunkIndex,
      matchStartIndex,
      requestedMatchCount: Math.min(
        normalizedChunkSize,
        normalizedMatchCount - matchStartIndex,
      ),
      chunkJsonPath: join(outputDir, `chunk-${String(chunkIndex + 1).padStart(3, "0")}.json`),
      logPath: join(outputDir, `chunk-${String(chunkIndex + 1).padStart(3, "0")}.log`),
    });
  }

  return definitions;
}

export function resolveBotBalanceBaselineAutoParallelism(
  availableParallelism: number | undefined,
): number {
  const normalizedAvailableParallelism = Number.isFinite(availableParallelism)
    ? Math.max(1, Math.trunc(availableParallelism ?? 1))
    : resolveRuntimeAvailableParallelism();
  const recommendedParallelism = normalizedAvailableParallelism <= 8
    ? Math.floor(normalizedAvailableParallelism / 2)
    : Math.floor(normalizedAvailableParallelism * 0.75);

  return Math.min(
    BOT_BALANCE_BASELINE_AUTO_PARALLELISM_MAX,
    Math.max(BOT_BALANCE_BASELINE_AUTO_PARALLELISM_MIN, recommendedParallelism),
  );
}

export function resolveBotBalanceBaselineParallelism(
  rawValue: number | undefined,
  availableParallelism?: number,
): number {
  if (!Number.isFinite(rawValue) || rawValue == null) {
    return resolveBotBalanceBaselineAutoParallelism(availableParallelism);
  }

  return Math.max(1, Math.trunc(rawValue));
}

export function resolveBotBalanceBaselinePortOffsetBase(
  rawValue: number | undefined,
  workerCount = 1,
): number {
  const normalizedWorkerCount = Math.max(1, Math.trunc(workerCount));
  const maxOffsetBase = BOT_BALANCE_BASELINE_TEST_SERVER_PORT_MAX
    - BOT_BALANCE_BASELINE_TEST_SERVER_PORT_BASE
    - (BOT_BALANCE_BASELINE_TEST_SERVER_PORT_HASH_RANGE - 1)
    - BOT_BALANCE_BASELINE_PORT_OFFSET_STRIDE * (normalizedWorkerCount - 1);

  if (!Number.isFinite(rawValue) || rawValue == null) {
    return DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE;
  }

  return Math.min(maxOffsetBase, Math.max(0, Math.trunc(rawValue)));
}

export function resolveBotBalanceBaselineWorkerPortOffset(
  workerIndex: number,
  portOffsetBase = DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE,
): number {
  return resolveBotBalanceBaselinePortOffsetBase(portOffsetBase)
    + Math.max(0, Math.trunc(workerIndex)) * BOT_BALANCE_BASELINE_PORT_OFFSET_STRIDE;
}

export function createBotBalanceBaselineRoomTimings(
  timeScale: number,
): GameRoomTimingOptions {
  const fastParityTimings = createFastParityGameRoomOptions({ timeScale });

  return {
    ...fastParityTimings,
    battleTimelineTimeScale: Math.min(
      fastParityTimings.battleTimelineTimeScale,
      BOT_BALANCE_BASELINE_BATTLE_TIMELINE_TIME_SCALE,
    ),
    readyAutoStartMs: Math.min(
      fastParityTimings.readyAutoStartMs,
      BOT_BALANCE_BASELINE_READY_AUTO_START_MS,
    ),
    settleDurationMs: Math.min(
      fastParityTimings.settleDurationMs,
      BOT_BALANCE_BASELINE_SETTLE_DURATION_MS,
    ),
    eliminationDurationMs: Math.min(
      fastParityTimings.eliminationDurationMs,
      BOT_BALANCE_BASELINE_ELIMINATION_DURATION_MS,
    ),
    selectionTimeoutMs: Math.min(
      fastParityTimings.selectionTimeoutMs,
      BOT_BALANCE_BASELINE_SELECTION_TIMEOUT_MS,
    ),
  };
}
