import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  AUTO_FILL_BOSS_ID,
  AUTO_FILL_HERO_IDS,
  buildAutoFillHelperActions,
} from "../../../src/client/autofill-helper-automation.js";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { MatchRoomController } from "../../../src/server/match-room-controller";
import { BattleSimulator } from "../../../src/server/combat/battle-simulator";
import { createSeededBattleRng } from "../../../src/server/combat/battle-rng";
import { createFastParityGameRoomOptions } from "../../../src/server/rooms/game-room-config";
import type { ControllerPlayerStatus } from "../../../src/server/types/player-state-types";
import type { FeatureFlags } from "../../../src/shared/feature-flags";
import { CLIENT_MESSAGE_TYPES } from "../../../src/shared/room-messages";
import {
  captureManagedFlagEnv,
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
  restoreManagedFlagEnv,
} from "../feature-flag-test-helper";

const PLAYER_IDS = ["p1", "p2", "p3", "p4"] as const;
type PlayerId = typeof PLAYER_IDS[number];

const BOSS_PLAYER_ID: PlayerId = "p2";
const REAL_PLAY_TIME_SCALE = 1;
const FAST_PARITY_TIME_SCALE = 0.02;
const CREATED_AT_MS = 1_000;
const STARTED_AT_MS = 2_000;
const PARITY_BATTLE_SEED = 424242;

const PARITY_FEATURE_FLAGS: Partial<FeatureFlags> = {
  ...FLAG_CONFIGURATIONS.ALL_DISABLED,
  enableBossExclusiveShop: true,
  enableHeroSystem: true,
  enableSubUnitSystem: true,
  enableTouhouRoster: true,
};

type HelperAction = {
  type: string;
  payload?: Record<string, unknown>;
};

type HelperPlayerState = ControllerPlayerStatus & {
  ready: boolean;
};

type NormalizedHelperAction = {
  playerId: PlayerId;
  type: "ready" | "prep_command";
  payload: unknown;
};

type NormalizedRoundSummary = {
  roundIndex: number;
  actions: NormalizedHelperAction[];
  phaseHpTarget: number;
  phaseDamageDealt: number;
  phaseResult: "pending" | "success" | "failed";
  pairings: Array<{
    leftPlayerId: string;
    rightPlayerId: string | null;
  }>;
  playersAtBattleStart: Array<{
    playerId: PlayerId;
    role: string;
    hp: number;
    remainingLives: number;
    eliminated: boolean;
    boardUnits: string[];
    boardSubUnits: string[];
    benchUnits: string[];
    benchUnitIds: string[];
    selectedHeroId: string;
    selectedBossId: string;
  }>;
  playersAfterBattle: Array<{
    playerId: PlayerId;
    role: string;
    hp: number;
    remainingLives: number;
    eliminated: boolean;
    lastBattleResult: {
      opponentId: string;
      won: boolean;
      damageDealt: number;
      damageTaken: number;
      survivors: number;
      opponentSurvivors: number;
      survivorUnitIds: string[];
    } | null;
  }>;
};

type NormalizedMatchSummary = {
  totalRounds: number;
  ranking: string[];
  finalPlayers: Array<{
    playerId: PlayerId;
    role: string;
    hp: number;
    remainingLives: number;
    eliminated: boolean;
    selectedHeroId: string;
    selectedBossId: string;
    boardUnits: string[];
    boardSubUnits: string[];
    benchUnits: string[];
    benchUnitIds: string[];
  }>;
  rounds: NormalizedRoundSummary[];
};

type HelperControllerState = {
  phase: string;
  lobbyStage: "started";
  playerPhase: string;
  playerPhaseDeadlineAtMs: number;
  featureFlagsEnableTouhouRoster: true;
  players: Record<PlayerId, HelperPlayerState>;
};

const SELECTED_HERO_BY_PLAYER = new Map<string, string>([
  ["p1", AUTO_FILL_HERO_IDS[0] ?? "reimu"],
  ["p3", AUTO_FILL_HERO_IDS[2] ?? "okina"],
  ["p4", AUTO_FILL_HERO_IDS[3] ?? "keiki"],
]);

const SELECTED_BOSS_BY_PLAYER = new Map<string, string>([
  [BOSS_PLAYER_ID, AUTO_FILL_BOSS_ID],
]);

const cloneStringArray = (values: readonly string[] | undefined): string[] => [...(values ?? [])];

const sortJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, sortJsonValue(entryValue)]),
    );
  }

  return value;
};

const normalizeLastBattleResult = (status: ControllerPlayerStatus) => {
  const battleResult = status.lastBattleResult;
  if (!battleResult) {
    return null;
  }

  return {
    opponentId: battleResult.opponentId,
    won: battleResult.won,
    damageDealt: battleResult.damageDealt,
    damageTaken: battleResult.damageTaken,
    survivors: battleResult.survivors,
    opponentSurvivors: battleResult.opponentSurvivors,
    survivorUnitIds: (battleResult.survivorSnapshots ?? [])
      .map((snapshot) => snapshot.unitId)
      .sort((left, right) => left.localeCompare(right)),
  };
};

const captureBattleStartPlayerState = (
  playerId: PlayerId,
  status: ControllerPlayerStatus,
) => ({
  playerId,
  role: status.role,
  hp: status.hp,
  remainingLives: status.remainingLives,
  eliminated: status.eliminated,
  boardUnits: cloneStringArray(status.boardUnits),
  boardSubUnits: cloneStringArray(status.boardSubUnits),
  benchUnits: cloneStringArray(status.benchUnits),
  benchUnitIds: cloneStringArray(status.benchUnitIds),
  selectedHeroId: status.selectedHeroId,
  selectedBossId: status.selectedBossId,
});

const capturePostBattlePlayerState = (
  playerId: PlayerId,
  status: ControllerPlayerStatus,
) => ({
  playerId,
  role: status.role,
  hp: status.hp,
  remainingLives: status.remainingLives,
  eliminated: status.eliminated,
  lastBattleResult: normalizeLastBattleResult(status),
});

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
): NormalizedHelperAction => {
  if (action.type === CLIENT_MESSAGE_TYPES.READY) {
    const ready = (action.payload as { ready?: boolean } | undefined)?.ready === true;
    readyByPlayer.set(playerId, ready);
    return {
      playerId,
      type: "ready",
      payload: sortJsonValue(action.payload ?? {}),
    };
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

    return {
      playerId,
      type: "prep_command",
      payload: sortJsonValue(action.payload ?? {}),
    };
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

  const nextNowMs = Math.max(nowMs + 1, phaseDeadlineAtMs + 1);
  controller.advanceByTime(nextNowMs);
  return nextNowMs;
};

const runBotOnlyParityMatch = (timeScale: number): NormalizedMatchSummary => {
  const timings = createFastParityGameRoomOptions({ timeScale });
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
      battleSimulator: new BattleSimulator({ rng: createSeededBattleRng(PARITY_BATTLE_SEED) }),
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
  const roundActions = new Map<number, NormalizedHelperAction[]>();
  const roundBattleStarts = new Map<number, NormalizedRoundSummary["playersAtBattleStart"]>();
  const roundSummaries = new Map<number, Omit<NormalizedRoundSummary, "actions" | "playersAtBattleStart">>();

  let nowMs = STARTED_AT_MS;
  let activePrepRoundIndex = controller.roundIndex;
  let iterationCount = 0;

  while (controller.phase !== "End") {
    iterationCount += 1;
    if (iterationCount > 10_000) {
      throw new Error(`Bot-only parity controller loop exceeded iteration limit at phase=${controller.phase}`);
    }

    if (controller.phase === "Prep" && controller.roundIndex !== activePrepRoundIndex) {
      activePrepRoundIndex = controller.roundIndex;
      for (const playerId of PLAYER_IDS) {
        readyByPlayer.set(playerId, false);
      }
    }

    if (controller.phase === "Battle" && !roundBattleStarts.has(controller.roundIndex)) {
      roundBattleStarts.set(
        controller.roundIndex,
        PLAYER_IDS.map((playerId) => captureBattleStartPlayerState(
          playerId,
          controller.getPlayerStatus(playerId),
        )),
      );
    }

    if (controller.phase === "Settle" && !roundSummaries.has(controller.roundIndex)) {
      const phaseProgress = controller.getPhaseProgress();
      roundSummaries.set(controller.roundIndex, {
        roundIndex: controller.roundIndex,
        phaseHpTarget: phaseProgress.targetHp,
        phaseDamageDealt: phaseProgress.damageDealt,
        phaseResult: phaseProgress.result,
        pairings: controller.roundPairings.map((pairing) => ({
          leftPlayerId: pairing.leftPlayerId,
          rightPlayerId: pairing.rightPlayerId,
        })),
        playersAfterBattle: PLAYER_IDS.map((playerId) => capturePostBattlePlayerState(
          playerId,
          controller.getPlayerStatus(playerId),
        )),
      });
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

        const normalizedAction = applyHelperAction(
          controller,
          playerId,
          nextAction,
          cmdSeqByPlayer,
          readyByPlayer,
          nowMs,
        );
        const actions = roundActions.get(controller.roundIndex) ?? [];
        actions.push(normalizedAction);
        roundActions.set(controller.roundIndex, actions);
        appliedAction = true;
      }
    }

    if (appliedAction) {
      continue;
    }

    nowMs = advanceToNextPhaseWindow(controller, nowMs);
  }

  return {
    totalRounds: controller.roundIndex,
    ranking: [...controller.rankingTopToBottom],
    finalPlayers: PLAYER_IDS.map((playerId) => {
      const status = controller.getPlayerStatus(playerId);
      return {
        playerId,
        role: status.role,
        hp: status.hp,
        remainingLives: status.remainingLives,
        eliminated: status.eliminated,
        selectedHeroId: status.selectedHeroId,
        selectedBossId: status.selectedBossId,
        boardUnits: cloneStringArray(status.boardUnits),
        boardSubUnits: cloneStringArray(status.boardSubUnits),
        benchUnits: cloneStringArray(status.benchUnits),
        benchUnitIds: cloneStringArray(status.benchUnitIds),
      };
    }),
    rounds: [...roundSummaries.values()]
      .sort((left, right) => left.roundIndex - right.roundIndex)
      .map((round) => ({
        ...round,
        actions: roundActions.get(round.roundIndex) ?? [],
        playersAtBattleStart: roundBattleStarts.get(round.roundIndex) ?? [],
      })),
  };
};

describe("bot-only fast parity controller simulation", () => {
  let originalEnv = captureManagedFlagEnv();

  beforeEach(() => {
    originalEnv = captureManagedFlagEnv();
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
    FeatureFlagService.resetForTests();
  });

  test("fast parity helper matches preserve equal gameplay results against real-play timings", () => {
    const realPlayResult = runBotOnlyParityMatch(REAL_PLAY_TIME_SCALE);
    const fastParityResult = runBotOnlyParityMatch(FAST_PARITY_TIME_SCALE);

    expect(fastParityResult).toEqual(realPlayResult);
    expect(fastParityResult.totalRounds).toBeGreaterThanOrEqual(2);
    expect(fastParityResult.totalRounds).toBeLessThanOrEqual(12);
    expect(fastParityResult.rounds).toHaveLength(fastParityResult.totalRounds);
    expect(
      fastParityResult.rounds.some((round) =>
        round.playersAfterBattle.some((player) => player.lastBattleResult !== null)),
    ).toBe(true);
  });
});
