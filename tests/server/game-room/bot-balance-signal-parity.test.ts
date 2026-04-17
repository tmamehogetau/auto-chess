import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  AUTO_FILL_BOSS_ID,
  AUTO_FILL_HERO_IDS,
  buildAutoFillHelperActions,
} from "../../../src/client/autofill-helper-automation.js";
import { BattleSimulator } from "../../../src/server/combat/battle-simulator";
import { createSeededBattleRng } from "../../../src/server/combat/battle-rng";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { MatchRoomController } from "../../../src/server/match-room-controller";
import {
  createFastParityGameRoomOptions,
  type GameRoomTimingOptions,
} from "../../../src/server/rooms/game-room-config";
import type { ControllerPlayerStatus } from "../../../src/server/types/player-state-types";
import type { FeatureFlags } from "../../../src/shared/feature-flags";
import { CLIENT_MESSAGE_TYPES } from "../../../src/shared/room-messages";
import {
  captureManagedFlagEnv,
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
  restoreManagedFlagEnv,
} from "../feature-flag-test-helper";
import { createBotBalanceBaselineRoomTimings } from "./bot-balance-baseline-runner";

const PLAYER_IDS = ["p1", "p2", "p3", "p4"] as const;
type PlayerId = typeof PLAYER_IDS[number];

const BOSS_PLAYER_ID: PlayerId = "p2";
const CREATED_AT_MS = 1_000;
const STARTED_AT_MS = 2_000;
const REAL_PLAY_TIME_SCALE = 1;
const FAST_PARITY_TIME_SCALE = 0.02;
const PARITY_TEST_TIMEOUT_MS = 15_000;
const PARITY_FEATURE_FLAGS: Partial<FeatureFlags> = {
  ...FLAG_CONFIGURATIONS.ALL_DISABLED,
  enableBossExclusiveShop: true,
  enableHeroSystem: true,
  enableSubUnitSystem: true,
  enableTouhouRoster: true,
};
const TEST_SEEDS = [101, 202, 303, 404] as const;

type HelperAction = {
  type: string;
  payload?: Record<string, unknown>;
};

type HelperPlayerState = ControllerPlayerStatus & {
  ready: boolean;
};

type HelperControllerState = {
  phase: string;
  lobbyStage: "started";
  playerPhase: string;
  playerPhaseDeadlineAtMs: number;
  featureFlagsEnableTouhouRoster: true;
  players: Record<PlayerId, HelperPlayerState>;
};

type AggregateSummary = {
  averagePlacementByPlayer: Record<PlayerId, number>;
  firstPlaceRateByPlayer: Record<PlayerId, number>;
  averageRemainingHpByPlayer: Record<PlayerId, number>;
  averageRemainingLivesByPlayer: Record<PlayerId, number>;
  finalUnitUsage: Record<string, number>;
};

const SELECTED_HERO_BY_PLAYER = new Map<string, string>([
  ["p1", AUTO_FILL_HERO_IDS[0] ?? "reimu"],
  ["p3", AUTO_FILL_HERO_IDS[2] ?? "okina"],
  ["p4", AUTO_FILL_HERO_IDS[3] ?? "keiki"],
]);

const SELECTED_BOSS_BY_PLAYER = new Map<string, string>([
  [BOSS_PLAYER_ID, AUTO_FILL_BOSS_ID],
]);

const buildHelperState = (
  controller: MatchRoomController,
  nowMs: number,
  readyByPlayer: ReadonlyMap<PlayerId, boolean>,
): HelperControllerState => {
  const playerFacingPhase = controller.getPlayerFacingPhaseState(nowMs);

  return {
    phase: controller.phase,
    lobbyStage: "started",
    playerPhase: playerFacingPhase.phase,
    playerPhaseDeadlineAtMs: playerFacingPhase.deadlineAtMs,
    featureFlagsEnableTouhouRoster: true,
    players: Object.fromEntries(
      PLAYER_IDS.map((playerId) => {
        const status = controller.getPlayerStatus(playerId);
        return [playerId, {
          ...status,
          ready: readyByPlayer.get(playerId) ?? false,
        }];
      }),
    ) as Record<PlayerId, HelperPlayerState>,
  };
};

const applyHelperAction = (
  controller: MatchRoomController,
  playerId: PlayerId,
  action: HelperAction,
  cmdSeqByPlayer: Map<PlayerId, number>,
  readyByPlayer: Map<PlayerId, boolean>,
  nowMs: number,
) => {
  if (action.type === CLIENT_MESSAGE_TYPES.READY) {
    const ready = (action.payload as { ready?: boolean } | undefined)?.ready === true;
    readyByPlayer.set(playerId, ready);
    return;
  }

  if (action.type === CLIENT_MESSAGE_TYPES.PREP_COMMAND) {
    const cmdSeq = cmdSeqByPlayer.get(playerId) ?? 1;
    const result = controller.submitPrepCommand(
      playerId,
      cmdSeq,
      nowMs,
      (action.payload ?? {}) as Record<string, unknown>,
    );

    expect(result).toEqual({ accepted: true });
    cmdSeqByPlayer.set(playerId, cmdSeq + 1);
    return;
  }

  throw new Error(`Unexpected helper action: ${action.type}`);
};

const advanceToNextPhaseWindow = (
  controller: MatchRoomController,
  nowMs: number,
): number => {
  if (controller.phase === "Prep") {
    const { deadlineAtMs } = controller.getPlayerFacingPhaseState(nowMs);
    const nextNowMs = Math.max(nowMs + 1, deadlineAtMs + 1);
    controller.advanceByTime(nextNowMs);
    return nextNowMs;
  }

  const phaseDeadlineAtMs = controller.phaseDeadlineAtMs;
  if (phaseDeadlineAtMs === null) {
    throw new Error(`Expected phase deadline while phase=${controller.phase}`);
  }

  const coarseAdvanceMs = controller.phase === "Battle" ? 1_000 : 50;
  const nextNowMs = Math.max(
    nowMs + (nowMs > phaseDeadlineAtMs ? coarseAdvanceMs : 1),
    phaseDeadlineAtMs + 1,
  );
  controller.advanceByTime(nextNowMs);
  return nextNowMs;
};

const runBotOnlyMatchSummaryWithTimings = (
  timings: GameRoomTimingOptions,
  battleSeed: number,
) => {
  const controller = new MatchRoomController(
    [...PLAYER_IDS],
    CREATED_AT_MS,
    {
      readyAutoStartMs: timings.readyAutoStartMs,
      prepDurationMs: timings.prepDurationMs,
      battleDurationMs: timings.battleDurationMs,
      settleDurationMs: timings.settleDurationMs,
      eliminationDurationMs: timings.eliminationDurationMs,
      battleTimelineTimeScale: timings.battleTimelineTimeScale,
      battleSimulator: new BattleSimulator({ rng: createSeededBattleRng(battleSeed) }),
      featureFlags: PARITY_FEATURE_FLAGS,
    },
  );

  const started = controller.startWithResolvedRoles(
    STARTED_AT_MS,
    [...PLAYER_IDS],
    {
      bossPlayerId: BOSS_PLAYER_ID,
      selectedHeroByPlayer: SELECTED_HERO_BY_PLAYER,
      selectedBossByPlayer: SELECTED_BOSS_BY_PLAYER,
    },
  );
  expect(started).toBe(true);

  const readyByPlayer = new Map<PlayerId, boolean>(PLAYER_IDS.map((playerId) => [playerId, false]));
  const cmdSeqByPlayer = new Map<PlayerId, number>(PLAYER_IDS.map((playerId) => [playerId, 1]));

  let nowMs = STARTED_AT_MS;
  let activePrepRoundIndex = controller.roundIndex;
  let iterationCount = 0;

  while (controller.phase !== "End") {
    iterationCount += 1;
    if (iterationCount > 10_000) {
      throw new Error(`Bot-only balance loop exceeded iteration limit at phase=${controller.phase}`);
    }

    if (controller.phase === "Prep" && controller.roundIndex !== activePrepRoundIndex) {
      activePrepRoundIndex = controller.roundIndex;
      for (const playerId of PLAYER_IDS) {
        readyByPlayer.set(playerId, false);
      }
    }

    let appliedAction = false;
    if (controller.phase === "Prep") {
      for (const [helperIndex, playerId] of PLAYER_IDS.entries()) {
        const helperState = buildHelperState(controller, nowMs, readyByPlayer);
        const helperPlayer = helperState.players[playerId];
        const [nextAction] = buildAutoFillHelperActions({
          helperIndex,
          player: helperPlayer,
          sessionId: playerId,
          state: helperState,
        }) as HelperAction[];

        if (!nextAction) {
          continue;
        }

        applyHelperAction(
          controller,
          playerId,
          nextAction,
          cmdSeqByPlayer,
          readyByPlayer,
          nowMs,
        );
        appliedAction = true;
      }
    }

    if (appliedAction) {
      continue;
    }

    nowMs = advanceToNextPhaseWindow(controller, nowMs);
  }

  const finalPlayers = PLAYER_IDS.map((playerId) => ({
    playerId,
    ...controller.getPlayerStatus(playerId),
  }));

  return {
    ranking: [...controller.rankingTopToBottom] as PlayerId[],
    finalPlayers,
  };
};

const runBotOnlyMatchSummary = (
  timeScale: number,
  battleSeed: number,
) => runBotOnlyMatchSummaryWithTimings(
  createFastParityGameRoomOptions({ timeScale }),
  battleSeed,
);

const buildAggregateSummary = (runs: ReturnType<typeof runBotOnlyMatchSummary>[]): AggregateSummary => {
  const placementTotal = Object.fromEntries(PLAYER_IDS.map((playerId) => [playerId, 0])) as Record<PlayerId, number>;
  const firstPlaceCount = Object.fromEntries(PLAYER_IDS.map((playerId) => [playerId, 0])) as Record<PlayerId, number>;
  const hpTotal = Object.fromEntries(PLAYER_IDS.map((playerId) => [playerId, 0])) as Record<PlayerId, number>;
  const livesTotal = Object.fromEntries(PLAYER_IDS.map((playerId) => [playerId, 0])) as Record<PlayerId, number>;
  const unitUsage = new Map<string, number>();

  for (const run of runs) {
    run.ranking.forEach((playerId, index) => {
      placementTotal[playerId] += index + 1;
      if (index === 0) {
        firstPlaceCount[playerId] += 1;
      }
    });

    for (const player of run.finalPlayers) {
      hpTotal[player.playerId] += player.hp;
      livesTotal[player.playerId] += player.remainingLives;
      for (const unitId of [...(player.boardUnits ?? []), ...(player.benchUnitIds ?? [])]) {
        unitUsage.set(unitId, (unitUsage.get(unitId) ?? 0) + 1);
      }
    }
  }

  const runCount = runs.length;
  return {
    averagePlacementByPlayer: Object.fromEntries(
      PLAYER_IDS.map((playerId) => [playerId, placementTotal[playerId] / runCount]),
    ) as Record<PlayerId, number>,
    firstPlaceRateByPlayer: Object.fromEntries(
      PLAYER_IDS.map((playerId) => [playerId, firstPlaceCount[playerId] / runCount]),
    ) as Record<PlayerId, number>,
    averageRemainingHpByPlayer: Object.fromEntries(
      PLAYER_IDS.map((playerId) => [playerId, hpTotal[playerId] / runCount]),
    ) as Record<PlayerId, number>,
    averageRemainingLivesByPlayer: Object.fromEntries(
      PLAYER_IDS.map((playerId) => [playerId, livesTotal[playerId] / runCount]),
    ) as Record<PlayerId, number>,
    finalUnitUsage: Object.fromEntries([...unitUsage.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
};

const expectAggregateSummariesClose = (
  actual: AggregateSummary,
  expected: AggregateSummary,
  tolerance: number,
) => {
  for (const playerId of PLAYER_IDS) {
    expect(actual.averagePlacementByPlayer[playerId]).toBeCloseTo(expected.averagePlacementByPlayer[playerId], tolerance);
    expect(actual.firstPlaceRateByPlayer[playerId]).toBeCloseTo(expected.firstPlaceRateByPlayer[playerId], tolerance);
    expect(actual.averageRemainingHpByPlayer[playerId]).toBeCloseTo(expected.averageRemainingHpByPlayer[playerId], tolerance);
    expect(actual.averageRemainingLivesByPlayer[playerId]).toBeCloseTo(expected.averageRemainingLivesByPlayer[playerId], tolerance);
  }

  expect(actual.finalUnitUsage).toEqual(expected.finalUnitUsage);
};

describe("bot-only balance signal parity", () => {
  let originalEnv = captureManagedFlagEnv();
  let originalSuppressVerboseLogs: string | undefined;

  beforeEach(() => {
    originalEnv = captureManagedFlagEnv();
    originalSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(
        FLAG_CONFIGURATIONS.ALL_DISABLED[flagName as keyof typeof FLAG_CONFIGURATIONS.ALL_DISABLED],
      );
    }
    process.env.SUPPRESS_VERBOSE_TEST_LOGS = "true";
    FeatureFlagService.resetForTests();
  });

  afterEach(() => {
    restoreManagedFlagEnv(originalEnv);
    if (originalSuppressVerboseLogs === undefined) {
      delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    } else {
      process.env.SUPPRESS_VERBOSE_TEST_LOGS = originalSuppressVerboseLogs;
    }
    FeatureFlagService.resetForTests();
  });

  test("fast parity preserves aggregate balance signals across a fixed seed set", () => {
    const realSpeedRuns = TEST_SEEDS.map((seed) => runBotOnlyMatchSummary(REAL_PLAY_TIME_SCALE, seed));
    const fastParityRuns = TEST_SEEDS.map((seed) => runBotOnlyMatchSummary(FAST_PARITY_TIME_SCALE, seed));

    const realSpeedSummary = buildAggregateSummary(realSpeedRuns);
    const fastParitySummary = buildAggregateSummary(fastParityRuns);

    expectAggregateSummariesClose(fastParitySummary, realSpeedSummary, 5);
  }, PARITY_TEST_TIMEOUT_MS);

  test("baseline-only timing compression preserves fast parity aggregate signals", () => {
    const fastParityRuns = TEST_SEEDS.map((seed) => runBotOnlyMatchSummary(FAST_PARITY_TIME_SCALE, seed));
    const baselineRuns = TEST_SEEDS.map((seed) =>
      runBotOnlyMatchSummaryWithTimings(createBotBalanceBaselineRoomTimings(FAST_PARITY_TIME_SCALE), seed));

    const fastParitySummary = buildAggregateSummary(fastParityRuns);
    const baselineSummary = buildAggregateSummary(baselineRuns);

    expectAggregateSummariesClose(baselineSummary, fastParitySummary, 5);
  }, PARITY_TEST_TIMEOUT_MS);
});
