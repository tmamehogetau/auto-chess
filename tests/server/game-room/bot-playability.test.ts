import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  attachAutoFillHelperAutomationForTest,
  connectBossRoleSelectionRoom,
  createRoomWithForcedFlags,
  describeGameRoomIntegration,
  expect,
  test,
  waitForCondition,
} from "./helpers";
import { AUTO_FILL_HERO_IDS } from "../../../src/client/autofill-helper-automation.js";
import { HEROES } from "../../../src/data/heroes";
import { SCARLET_MANSION_UNITS } from "../../../src/data/scarlet-mansion-units";
import { TOUHOU_UNITS } from "../../../src/data/touhou-units";
import type { MatchLogger } from "../../../src/server/match-logger";
import type {
  AttackStartEvent,
  BattleEndEvent,
  BattleStartEvent,
  BattleTimelineEvent,
  BoardUnitPlacement,
  DamageAppliedEvent,
  MoveEvent,
  RoundStateMessage,
  UnitDeathEvent,
} from "../../../src/shared/room-messages";
import {
  resolveSharedBoardBossPresentation,
  resolveSharedBoardHeroPresentation,
  resolveSharedBoardUnitPresentation,
} from "../../../src/server/shared-board-unit-presentation";
import {
  createFastParityGameRoomOptions,
  DEFAULT_GAME_ROOM_OPTIONS,
} from "../../../src/server/rooms/game-room-config";
import { getMvpPhase1Boss } from "../../../src/shared/types";
import {
  buildBotOnlyBaselineAggregateReport as buildBotOnlyBaselineAggregateReportFromSummaries,
  type BotOnlyBaselineAggregateReport,
  type BotOnlyBaselineBattleEndReason,
  type BotOnlyBaselineBattleSummary,
  type BotOnlyBaselineFinalPlayer,
  type BotOnlyBaselineMatchSummary,
  type BotOnlyBaselineObservedShopOffer,
  type BotOnlyBaselinePurchase,
  type BotOnlyReportMetadata,
} from "./bot-balance-baseline-aggregate";
import {
  createBotBalanceBaselineHelperConfigs,
  createBotBalanceBaselineRoomTimings,
  resolveBotBalanceBaselineHelperPolicy,
  resolveBotBalanceBaselineRaidPolicies,
} from "./bot-balance-baseline-runner";

type BotOnlyServerRoom = Awaited<ReturnType<typeof createRoomWithForcedFlags>>;
type BotOnlyTestClient = {
  sessionId: string;
  state?: unknown;
  send: (type: string, message?: unknown) => void;
  onStateChange: (handler: (state: unknown) => void) => void;
  onMessage: (type: string, handler: (_message: unknown) => void) => void;
};

type BotOnlyMatchRoundReport = {
  metadata?: {
    mode: "real-play" | "fast-parity" | "custom";
    timeScale: number;
    timings: {
      readyAutoStartMs: number;
      prepDurationMs: number;
      battleDurationMs: number;
      settleDurationMs: number;
      eliminationDurationMs: number;
      selectionTimeoutMs: number;
    };
  };
  totalRounds: number;
  bossPlayerId: string;
  raidPlayerIds: string[];
  ranking: string[];
  playerLabels: Record<string, string>;
  finalPlayers: Array<{
    playerId: string;
    label: string;
    role: string;
    hp: number;
    gold?: number;
    remainingLives: number;
    eliminated: boolean;
    rank: number;
    selectedHeroId: string;
    selectedBossId: string;
    totalGoldEarned?: number;
    totalGoldSpent?: number;
    purchaseCount?: number;
    refreshCount?: number;
    sellCount?: number;
    boardUnits: ReportBoardUnit[];
  }>;
  rounds: Array<{
    roundIndex: number;
    phase: string;
    durationMs: number;
    battles: BotOnlyRoundBattleReport[];
    hpChanges: Array<{
      playerId: string;
      label: string;
      hpBefore: number;
      hpAfter: number;
      hpChange: number;
      reason: string;
    }>;
    purchases: Array<{
      playerId: string;
      label: string;
      actionType: "buy_unit" | "buy_boss_unit";
      unitType: string;
      goldBefore: number;
      goldAfter: number;
    }>;
    deploys: Array<{
      playerId: string;
      label: string;
      benchIndex: number | null;
      toCell: number | null;
    }>;
    phaseHpTarget: number;
    phaseDamageDealt: number;
    phaseResult: "pending" | "success" | "failed";
    phaseCompletionRate: number;
    playersAtBattleStart: Array<{
      playerId: string;
      label: string;
      role: string;
      hp: number;
      remainingLives: number;
      eliminated: boolean;
      boardUnits: ReportBoardUnit[];
      benchUnits: string[];
    }>;
    playerConsequences: Array<{
      playerId: string;
      label: string;
      role: string;
      battleStartUnitCount: number;
      playerWipedOut: boolean;
      remainingLivesBefore: number;
      remainingLivesAfter: number;
      eliminatedAfter: boolean;
    }>;
    playersAfterRound: Array<{
      playerId: string;
      label: string;
      role: string;
      hp: number;
      remainingLives: number;
      eliminated: boolean;
      boardUnits: ReportBoardUnit[];
      benchUnits: string[];
      lastBattle: {
        opponentId: string;
        opponentLabel: string;
        won: boolean;
        damageDealt: number;
        damageTaken: number;
        survivors: number;
        opponentSurvivors: number;
        survivorUnitTypes: string[];
      };
    }>;
    eliminations: string[];
  }>;
};

type BotOnlyRoundBattleReport = {
  battleIndex: number;
  leftPlayerId: string;
  leftLabel: string;
  rightPlayerId: string;
  rightLabel: string;
  battleDurationMs?: number;
  battleEndReason?: BotOnlyBaselineBattleEndReason;
  bossSurvivors?: number;
  raidSurvivors?: number;
  leftSpecialUnits: string[];
  rightSpecialUnits: string[];
  winner: "left" | "right" | "draw";
  leftDamageDealt: number;
  rightDamageDealt: number;
  leftSurvivors: number;
  rightSurvivors: number;
  unitDamageBreakdown: ReportUnitDamageContribution[];
  unitOutcomes: ReportUnitBattleOutcome[];
};

type ReportUnitDamageContribution = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
};

type ReportUnitBattleOutcome = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  unitType?: string;
  side: "boss" | "raid";
  totalDamage: number;
  phaseContributionDamage: number;
  finalHp: number;
  alive: boolean;
  unitLevel: number;
  subUnitName: string;
  isSpecialUnit: boolean;
  attackCount?: number;
  hitCount?: number;
  damageTaken?: number;
  moveCount?: number;
  firstMoveAtMs?: number | null;
  firstAttackAtMs?: number | null;
  repositionMoveCount?: number;
  lifetimeMs?: number;
  battleDurationMs?: number;
  initialNearestEnemyDistance?: number | null;
  bestNearestEnemyDistance?: number | null;
  moveTargetDiagnosticSampleCount?: number;
  suboptimalMoveTargetCount?: number;
  totalExcessApproachSteps?: number;
  outsideAttackRangeBeforeFirstAttackMs?: number;
  inAttackRangeBeforeFirstAttackMs?: number;
  afterFirstAttackMs?: number;
  firstReachedAttackRangeAtMs?: number | null;
  initialRow?: number | null;
  initialColumn?: number | null;
  sameColumnFrontAllyCount?: number;
  lateralLeftMoveCount?: number;
  lateralRightMoveCount?: number;
  firstLateralMoveDirection?: "left" | "right" | null;
  sharedPursuitMoveSampleCount?: number;
  contestedPursuitMoveSampleCount?: number;
  plannedApproachGroupMoveSampleCount?: number;
  totalPlannedApproachGroupCompetitorCount?: number;
  totalPlannedApproachGroupAssignedCount?: number;
  oversubscribedPlannedApproachGroupMoveCount?: number;
  plannedApproachMoveSampleCount?: number;
  plannedApproachStillOpenMoveCount?: number;
  usedPlannedApproachMoveCount?: number;
  plannedApproachPathBlockedMoveCount?: number;
  plannedApproachWithFirstAttackCount?: number;
  plannedApproachMatchedFirstAttackTargetCount?: number;
  plannedApproachReachedRangeWithoutAttackCount?: number;
  plannedApproachNoReachNoAttackCount?: number;
  plannedApproachNoAttackTargetDiedBeforeBattleEndCount?: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveCount?: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount?: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount?: number;
};

type BotOnlyRoundSnapshot = {
  roundIndex: number;
  phaseAfterRound: string;
  battlePhaseElapsedMs?: number;
  phaseProgress: {
    phaseHpTarget: number;
    phaseDamageDealt: number;
    phaseResult: "pending" | "success" | "failed";
    phaseCompletionRate: number;
  };
  playersAtBattleStart: Array<{
    playerId: string;
    role: string;
    hp: number;
    remainingLives: number;
    eliminated: boolean;
    boardUnits: ReportBoardUnit[];
    trackedBattleUnitIds: string[];
    benchUnits: string[];
    lastBattle: {
      battleId: string | null;
      opponentId: string;
      won: boolean;
      damageDealt: number;
      damageTaken: number;
      survivors: number;
      opponentSurvivors: number;
      survivorUnitTypes: string[];
      timeline: BattleTimelineEvent[];
    };
  }>;
  battleTimelines: Array<{
    playerId: string;
    battleId: string | null;
    timeline: BattleTimelineEvent[];
  }>;
  battles?: BotOnlyRoundBattleReport[];
  playerConsequences: Array<{
    playerId: string;
    role: string;
    battleStartUnitCount: number;
    playerWipedOut: boolean;
    remainingLivesBefore: number;
    remainingLivesAfter: number;
    eliminatedAfter: boolean;
  }>;
  playersAfterRound: Array<{
    playerId: string;
    role: string;
    hp: number;
    remainingLives: number;
    eliminated: boolean;
    boardUnits: ReportBoardUnit[];
    benchUnits: string[];
    lastBattle: {
      battleId: string | null;
      opponentId: string;
      won: boolean;
      damageDealt: number;
      damageTaken: number;
      survivors: number;
      opponentSurvivors: number;
      survivorUnitTypes: string[];
      timeline: BattleTimelineEvent[];
    };
  }>;
};

type PlayerBattleOutcomeSnapshot = {
  playerId: string;
  role: string;
  battleStartUnitCount: number;
  playerWipedOut: boolean;
};

type BoardPlacementReader = {
  getBoardPlacementsForPlayer: (playerId: string) => BoardUnitPlacement[];
};

type BotOnlyTestAccess = {
  battleInputSnapshotByPlayer: Map<string, BoardUnitPlacement[]>;
  battleResultsByPlayer: Map<string, {
    survivors: number;
    timeline?: BattleTimelineEvent[];
    rawTimeline?: BattleTimelineEvent[];
    survivorSnapshots?: Array<{
      unitId: string;
    }>;
  }>;
};

type ReportBoardUnit = {
  cell: number;
  unitName: string;
  unitType: string;
  unitId: string;
  unitLevel: number;
  subUnitName: string;
};

type BotOnlyMatchArtifacts = {
  serverRoom: BotOnlyServerRoom;
  clients: BotOnlyTestClient[];
  roundSnapshots: BotOnlyRoundSnapshot[];
};

type BotOnlyBaselineMatchArtifacts = {
  serverRoom: BotOnlyServerRoom;
  clients: BotOnlyTestClient[];
  battles: BotOnlyBaselineBattleSummary[];
  observedShopOffers: BotOnlyBaselineObservedShopOffer[];
};

type BotOnlyFinalPlayerEconomySnapshot = {
  totalGoldEarned: number;
  totalGoldSpent: number;
  purchaseCount: number;
  refreshCount: number;
  sellCount: number;
};

type BotOnlyRoomTimingSnapshot = BotOnlyReportMetadata["timings"] & {
  battleTimelineTimeScale: number;
};

type ReportUnitCombatProfile = {
  range: number;
};

const GENERIC_REPORT_UNIT_COMBAT_PROFILES = [
  { key: "vanguard", range: 1 },
  { key: "ranger", range: 3 },
  { key: "mage", range: 2 },
  { key: "assassin", range: 1 },
] as const;

const REPORT_UNIT_COMBAT_PROFILE_BY_ID = new Map<string, ReportUnitCombatProfile>([
  ...TOUHOU_UNITS.map((unit) => [unit.unitId, { range: unit.range }] as const),
  ...HEROES.map((hero) => [hero.id, { range: hero.range }] as const),
  ...SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, { range: unit.range }] as const),
  ["remilia", { range: getMvpPhase1Boss().range }],
  ...GENERIC_REPORT_UNIT_COMBAT_PROFILES.map((profile) => [profile.key, { range: profile.range }] as const),
]);

const REPORT_UNIT_COMBAT_PROFILE_BY_TYPE = new Map<string, ReportUnitCombatProfile>([
  ...TOUHOU_UNITS.map((unit) => [unit.unitId, { range: unit.range }] as const),
  ...HEROES.map((hero) => [hero.id, { range: hero.range }] as const),
  ...SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, { range: unit.range }] as const),
  ["remilia", { range: getMvpPhase1Boss().range }],
  ...GENERIC_REPORT_UNIT_COMBAT_PROFILES.map((profile) => [profile.key, { range: profile.range }] as const),
]);

const BOT_ONLY_PHASE_PRIORITY: Record<RoundStateMessage["phase"], number> = {
  Waiting: 0,
  Prep: 1,
  Battle: 2,
  Settle: 3,
  Elimination: 4,
  End: 5,
};

function getBotOnlyPhasePriority(phase: string): number {
  return BOT_ONLY_PHASE_PRIORITY[phase as RoundStateMessage["phase"]] ?? -1;
}

const getMatchLogger = (serverRoom: BotOnlyServerRoom): MatchLogger => {
  const matchLogger = (serverRoom as unknown as { matchLogger?: MatchLogger | null }).matchLogger;
  if (!matchLogger) {
    throw new Error("Expected match logger to be attached");
  }

  return matchLogger;
};

const getPlayerLabelMap = (clients: Array<{ sessionId: string }>): Map<string, string> =>
  new Map(clients.map((client, index) => [client.sessionId, `P${index + 1}`]));

const getPlayerLabel = (playerLabels: Map<string, string>, playerId: string): string =>
  playerLabels.get(playerId) ?? playerId;

const getBoardPlacementReader = (serverRoom: BotOnlyServerRoom): BoardPlacementReader | null => {
  const controller = (serverRoom as unknown as {
    controller?: BoardPlacementReader | null;
  }).controller;

  return controller ?? null;
};

const readBotOnlyRoomTimingSnapshot = (
  serverRoom: BotOnlyServerRoom,
): BotOnlyRoomTimingSnapshot | null => {
  const candidate = serverRoom as unknown as Partial<Record<keyof BotOnlyRoomTimingSnapshot, unknown>>;
  const readyAutoStartMs = candidate.readyAutoStartMs;
  const prepDurationMs = candidate.prepDurationMs;
  const battleDurationMs = candidate.battleDurationMs;
  const settleDurationMs = candidate.settleDurationMs;
  const eliminationDurationMs = candidate.eliminationDurationMs;
  const selectionTimeoutMs = candidate.selectionTimeoutMs;
  const battleTimelineTimeScale = candidate.battleTimelineTimeScale;

  if (
    !Number.isFinite(readyAutoStartMs)
    || !Number.isFinite(prepDurationMs)
    || !Number.isFinite(battleDurationMs)
    || !Number.isFinite(settleDurationMs)
    || !Number.isFinite(eliminationDurationMs)
    || !Number.isFinite(selectionTimeoutMs)
    || !Number.isFinite(battleTimelineTimeScale)
  ) {
    return null;
  }

  return {
    readyAutoStartMs: Number(readyAutoStartMs),
    prepDurationMs: Number(prepDurationMs),
    battleDurationMs: Number(battleDurationMs),
    settleDurationMs: Number(settleDurationMs),
    eliminationDurationMs: Number(eliminationDurationMs),
    selectionTimeoutMs: Number(selectionTimeoutMs),
    battleTimelineTimeScale: Number(battleTimelineTimeScale),
  };
};

const areBotOnlyTimingsEqual = (
  left: BotOnlyRoomTimingSnapshot,
  right: BotOnlyRoomTimingSnapshot,
): boolean =>
  left.readyAutoStartMs === right.readyAutoStartMs
  && left.prepDurationMs === right.prepDurationMs
  && left.battleDurationMs === right.battleDurationMs
  && left.settleDurationMs === right.settleDurationMs
  && left.eliminationDurationMs === right.eliminationDurationMs
  && left.selectionTimeoutMs === right.selectionTimeoutMs
  && left.battleTimelineTimeScale === right.battleTimelineTimeScale;

const resolveBotOnlyReportMetadata = (
  serverRoom: BotOnlyServerRoom,
): BotOnlyReportMetadata | undefined => {
  const timings = readBotOnlyRoomTimingSnapshot(serverRoom);
  if (!timings) {
    return undefined;
  }

  let mode: BotOnlyReportMetadata["mode"] = "custom";
  const defaultTimings: BotOnlyRoomTimingSnapshot = {
    ...DEFAULT_GAME_ROOM_OPTIONS,
  };
  if (areBotOnlyTimingsEqual(timings, defaultTimings)) {
    mode = "real-play";
  } else if (timings.battleTimelineTimeScale > 0) {
    const fastParityTimings: BotOnlyRoomTimingSnapshot = {
      ...createFastParityGameRoomOptions({
        timeScale: timings.battleTimelineTimeScale,
      }),
    };
    if (areBotOnlyTimingsEqual(timings, fastParityTimings)) {
      mode = "fast-parity";
    }
  }

  return {
    mode,
    timeScale: timings.battleTimelineTimeScale,
    timings: {
      readyAutoStartMs: timings.readyAutoStartMs,
      prepDurationMs: timings.prepDurationMs,
      battleDurationMs: timings.battleDurationMs,
      settleDurationMs: timings.settleDurationMs,
      eliminationDurationMs: timings.eliminationDurationMs,
      selectionTimeoutMs: timings.selectionTimeoutMs,
    },
  };
};

const toReportBoardUnit = (placement: BoardUnitPlacement): ReportBoardUnit => {
  const resolvedName = placement.unitType == null
    ? undefined
    : resolveSharedBoardUnitPresentation(
      placement.unitId,
      placement.unitType,
    )?.displayName;

  return {
    cell: placement.cell,
    unitName:
      resolvedName
      ?? placement.archetype
      ?? placement.unitId
      ?? placement.unitType,
    unitType: placement.unitType,
    unitId: placement.unitId ?? "",
    unitLevel: placement.unitLevel ?? 1,
    subUnitName:
      (placement.subUnit?.unitType == null
        ? undefined
        : resolveSharedBoardUnitPresentation(
          placement.subUnit?.unitId,
          placement.subUnit?.unitType,
        )?.displayName)
      ?? placement.subUnit?.archetype
      ?? placement.subUnit?.unitId
      ?? placement.subUnit?.unitType
      ?? "",
  };
};

const getReportBoardUnitsForPlayer = (
  serverRoom: BotOnlyServerRoom,
  playerId: string,
): ReportBoardUnit[] => {
  const reader = getBoardPlacementReader(serverRoom);
  if (!reader) {
    return [];
  }

  return reader.getBoardPlacementsForPlayer(playerId).map(toReportBoardUnit);
};

const getSpecialBattleUnitsForPlayers = (
  serverRoom: BotOnlyServerRoom,
  playerIds: string[],
): string[] => {
  const specialUnits: string[] = [];

  for (const playerId of playerIds) {
    const player = serverRoom.state.players.get(playerId);
    if (!player) {
      continue;
    }

    const heroName = resolveSharedBoardHeroPresentation(player.selectedHeroId)?.displayName;
    if (heroName) {
      specialUnits.push(heroName);
    }

    const bossName = resolveSharedBoardBossPresentation(player.selectedBossId)?.displayName;
    if (bossName) {
      specialUnits.push(bossName);
    }
  }

  return specialUnits;
};

const getBattleSidePlayerIds = (
  serverRoom: BotOnlyServerRoom,
  representativePlayerId: string,
): string[] => {
  const bossPlayerId = serverRoom.state.bossPlayerId;

  if (representativePlayerId === bossPlayerId) {
    return [representativePlayerId];
  }

  if (serverRoom.state.raidPlayerIds.includes(representativePlayerId)) {
    return Array.from(serverRoom.state.raidPlayerIds);
  }

  return [representativePlayerId];
};

const getTestAccess = (serverRoom: BotOnlyServerRoom): BotOnlyTestAccess | null => {
  const controller = (serverRoom as unknown as {
    controller?: { getTestAccess?: () => BotOnlyTestAccess } | null;
  }).controller;

  return controller?.getTestAccess?.() ?? null;
};

const getReportBattleStartUnitsForPlayer = (
  serverRoom: BotOnlyServerRoom,
  playerId: string,
): ReportBoardUnit[] => {
  const testAccess = getTestAccess(serverRoom);
  if (!testAccess) {
    return [];
  }

  return (testAccess.battleInputSnapshotByPlayer.get(playerId) ?? []).map(toReportBoardUnit);
};

const getTrackedBattleUnitIdsForPlayerAtBattleStart = (
  serverRoom: BotOnlyServerRoom,
  playerId: string,
): string[] => Array.from(buildTrackedBattleUnitIdsForPlayer(serverRoom, playerId));

const captureRoundPlayers = (
  serverRoom: BotOnlyServerRoom,
  clients: BotOnlyTestClient[],
  readBoardUnits: (room: BotOnlyServerRoom, playerId: string) => ReportBoardUnit[],
) =>
  clients.map((client) => {
    const playerId = client.sessionId;
    const player = serverRoom.state.players.get(playerId);
    if (!player) {
      throw new Error(`Expected player state for ${playerId}`);
    }
    const lastBattleResultWithTimeline = player.lastBattleResult as typeof player.lastBattleResult & {
      timeline?: BattleTimelineEvent[];
    };

    return {
      playerId,
      role: player.role,
      hp: player.hp,
      remainingLives: player.remainingLives,
      eliminated: player.eliminated,
      boardUnits: readBoardUnits(serverRoom, playerId),
      benchUnits: Array.from(player.benchUnits ?? []),
      lastBattle: {
        battleId: resolveBattleIdFromTimeline(lastBattleResultWithTimeline.timeline),
        opponentId: player.lastBattleResult.opponentId,
        won: player.lastBattleResult.won,
        damageDealt: player.lastBattleResult.damageDealt,
        damageTaken: player.lastBattleResult.damageTaken,
        survivors: player.lastBattleResult.survivors,
        opponentSurvivors: player.lastBattleResult.opponentSurvivors,
        survivorUnitTypes: Array.from(
          player.lastBattleResult.survivorSnapshots as Iterable<{ unitType: string }>,
        ).map(
          (snapshot) => snapshot.unitType,
        ),
        timeline: Array.isArray(lastBattleResultWithTimeline.timeline)
          ? [...lastBattleResultWithTimeline.timeline]
          : [],
      },
    };
  });

const buildRoundPhaseProgress = (
  phaseProgress:
    | {
      targetHp: number;
      damageDealt: number;
      result: "pending" | "success" | "failed";
      completionRate: number;
    }
    | undefined,
): BotOnlyRoundSnapshot["phaseProgress"] => ({
  phaseHpTarget: phaseProgress?.targetHp ?? 0,
  phaseDamageDealt: phaseProgress?.damageDealt ?? 0,
  phaseResult: phaseProgress?.result ?? "pending",
  phaseCompletionRate: phaseProgress?.completionRate ?? 0,
});

const getCurrentControllerPhaseProgress = (
  serverRoom: BotOnlyServerRoom,
): {
  targetHp: number;
  damageDealt: number;
  result: "pending" | "success" | "failed";
  completionRate: number;
} | undefined => {
  const controller = (serverRoom as unknown as {
    controller?: {
      getPhaseProgress?: () => {
        targetHp: number;
        damageDealt: number;
        result: "pending" | "success" | "failed";
        completionRate: number;
      };
    } | null;
  }).controller;

  return controller?.getPhaseProgress?.();
};

const buildTrackedBattleUnitIdsForPlayer = (
  serverRoom: BotOnlyServerRoom,
  playerId: string,
): Set<string> => {
  const trackedUnitIds = new Set<string>();
  const testAccess = getTestAccess(serverRoom);
  const battlePlacements = testAccess?.battleInputSnapshotByPlayer.get(playerId) ?? [];

  for (const placement of battlePlacements) {
    if (typeof placement.unitId !== "string") {
      continue;
    }

    const normalizedUnitId = placement.unitId.trim();
    if (normalizedUnitId.length > 0) {
      trackedUnitIds.add(normalizedUnitId);
    }
  }

  const selectedHeroId = serverRoom.state.players.get(playerId)?.selectedHeroId ?? "";
  if (selectedHeroId.length > 0) {
    trackedUnitIds.add(`hero-${playerId}`);
  }

  return trackedUnitIds;
};

const didPlayerLoseAllBattleUnitsForReport = (
  battleResult: BotOnlyTestAccess["battleResultsByPlayer"] extends Map<string, infer TValue>
    ? TValue | undefined
    : never,
  trackedUnitIds: string[],
): {
  battleStartUnitCount: number;
  playerWipedOut: boolean;
} => {
  if (!battleResult) {
    return {
      battleStartUnitCount: trackedUnitIds.length,
      playerWipedOut: false,
    };
  }

  if (trackedUnitIds.length === 0 || !Array.isArray(battleResult.survivorSnapshots)) {
    return {
      battleStartUnitCount: trackedUnitIds.length,
      playerWipedOut: battleResult.survivors <= 0,
    };
  }

  const survivingUnitIds = new Set(
    battleResult.survivorSnapshots
      .map((snapshot) => typeof snapshot.unitId === "string" ? snapshot.unitId.trim() : "")
      .filter((unitId) => unitId.length > 0),
  );

  for (const unitId of trackedUnitIds) {
    if (survivingUnitIds.has(unitId)) {
      return {
        battleStartUnitCount: trackedUnitIds.length,
        playerWipedOut: false,
      };
    }
  }

  return {
    battleStartUnitCount: trackedUnitIds.length,
    playerWipedOut: true,
  };
};

const buildPlayerBattleOutcomes = (
  serverRoom: BotOnlyServerRoom,
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
): PlayerBattleOutcomeSnapshot[] =>
  playersAtBattleStart.map((playerAtBattleStart) => {
    const testAccess = getTestAccess(serverRoom);
    const battleOutcome = didPlayerLoseAllBattleUnitsForReport(
      testAccess?.battleResultsByPlayer.get(playerAtBattleStart.playerId),
      playerAtBattleStart.trackedBattleUnitIds,
    );

    return {
      playerId: playerAtBattleStart.playerId,
      role: playerAtBattleStart.role,
      battleStartUnitCount: battleOutcome.battleStartUnitCount,
      playerWipedOut: battleOutcome.playerWipedOut,
    };
  });

const buildPlayerConsequences = (
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
  playerBattleOutcomes: PlayerBattleOutcomeSnapshot[],
  playersAfterRound: BotOnlyRoundSnapshot["playersAfterRound"],
): BotOnlyRoundSnapshot["playerConsequences"] =>
  playersAtBattleStart.map((playerAtBattleStart) => {
    const playerAfterRound = playersAfterRound.find(
      (candidate) => candidate.playerId === playerAtBattleStart.playerId,
    );

    if (!playerAfterRound) {
      throw new Error(`Expected player after round for ${playerAtBattleStart.playerId}`);
    }

    const battleOutcome = playerBattleOutcomes.find(
      (candidate) => candidate.playerId === playerAtBattleStart.playerId,
    );

    if (!battleOutcome) {
      throw new Error(`Expected player battle outcome for ${playerAtBattleStart.playerId}`);
    }

    return {
      playerId: playerAtBattleStart.playerId,
      role: playerAtBattleStart.role,
      battleStartUnitCount: battleOutcome.battleStartUnitCount,
      playerWipedOut: battleOutcome.playerWipedOut,
      remainingLivesBefore: playerAtBattleStart.remainingLives,
      remainingLivesAfter: playerAfterRound.remainingLives,
      eliminatedAfter: playerAfterRound.eliminated,
    };
  });

const resolveBattleIdFromTimeline = (
  timeline: BattleTimelineEvent[] | undefined,
): string | null => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return null;
  }

  const firstEvent = timeline.find((event) => typeof event?.battleId === "string");
  return firstEvent?.battleId ?? null;
};

const buildTrackedUnitOwnerMap = (
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
): Map<string, string> => {
  const ownerByUnitId = new Map<string, string>();

  for (const player of playersAtBattleStart) {
    for (const trackedUnitId of player.trackedBattleUnitIds) {
      ownerByUnitId.set(trackedUnitId, player.playerId);
    }
  }

  return ownerByUnitId;
};

const resolvePlayerIdForBattleUnit = (
  ownerPlayerId: string | undefined,
  battleUnitId: string,
  sourceUnitId: string | undefined,
  ownerByTrackedUnitId: Map<string, string>,
): string | null => {
  if (typeof ownerPlayerId === "string" && ownerPlayerId.length > 0) {
    return ownerPlayerId;
  }

  if (typeof sourceUnitId === "string" && ownerByTrackedUnitId.has(sourceUnitId)) {
    return ownerByTrackedUnitId.get(sourceUnitId) ?? null;
  }

  if (ownerByTrackedUnitId.has(battleUnitId)) {
    return ownerByTrackedUnitId.get(battleUnitId) ?? null;
  }

  if (battleUnitId.startsWith("hero-")) {
    return battleUnitId.slice("hero-".length) || null;
  }

  if (battleUnitId.startsWith("boss-")) {
    return battleUnitId.slice("boss-".length) || null;
  }

  return null;
};

const buildUnitDamageBreakdownForBattle = (
  timeline: BattleTimelineEvent[] | undefined,
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
  playerLabels: Map<string, string>,
): ReportUnitDamageContribution[] => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return [];
  }

  const battleStartEvent = timeline.find((event): event is BattleStartEvent => event.type === "battleStart");
  if (!battleStartEvent) {
    return [];
  }

  const ownerByTrackedUnitId = buildTrackedUnitOwnerMap(playersAtBattleStart);
  const contributionsByBattleUnitId = new Map<string, {
    playerId: string;
    label: string;
    unitId: string;
    unitName: string;
    side: "boss" | "raid";
    totalDamage: number;
  }>();

  for (const unit of battleStartEvent.units) {
    const playerId = resolvePlayerIdForBattleUnit(
      unit.ownerPlayerId,
      unit.battleUnitId,
      unit.sourceUnitId,
      ownerByTrackedUnitId,
    );
    if (!playerId) {
      continue;
    }
    const ownerPlayer = playersAtBattleStart.find((player) => player.playerId === playerId);

    contributionsByBattleUnitId.set(unit.battleUnitId, {
      playerId,
      label: getPlayerLabel(playerLabels, playerId),
      unitId: unit.sourceUnitId ?? unit.battleUnitId,
      unitName: unit.displayName ?? unit.sourceUnitId ?? unit.battleUnitId,
      side: ownerPlayer?.role === "boss" ? "boss" : "raid",
      totalDamage: 0,
    });
  }

  for (const event of timeline) {
    if (event.type !== "damageApplied") {
      continue;
    }

    const contribution = contributionsByBattleUnitId.get(event.sourceBattleUnitId);
    if (!contribution) {
      continue;
    }

    contribution.totalDamage += event.amount;
  }

  return Array.from(contributionsByBattleUnitId.values())
    .filter((contribution) => contribution.totalDamage > 0)
    .sort((left, right) =>
      right.totalDamage - left.totalDamage
      || left.playerId.localeCompare(right.playerId)
      || left.unitId.localeCompare(right.unitId));
};

const buildBoardUnitMetadataMapForBattle = (
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
): Map<string, ReportBoardUnit[]> => {
  const metadataByPlayerAndUnitId = new Map<string, ReportBoardUnit[]>();

  for (const player of playersAtBattleStart) {
    for (const unit of player.boardUnits) {
      const key = `${player.playerId}::${unit.unitId}`;
      const existing = metadataByPlayerAndUnitId.get(key) ?? [];
      existing.push(unit);
      metadataByPlayerAndUnitId.set(key, existing);
    }
  }

  return metadataByPlayerAndUnitId;
};

const takeBoardUnitMetadataForBattleUnit = (
  metadataByPlayerAndUnitId: Map<string, ReportBoardUnit[]>,
  playerId: string,
  unitId: string,
): ReportBoardUnit | null => {
  const key = `${playerId}::${unitId}`;
  const metadataList = metadataByPlayerAndUnitId.get(key);
  if (!metadataList || metadataList.length === 0) {
    return null;
  }

  const metadata = metadataList.shift() ?? null;
  if (metadataList.length === 0) {
    metadataByPlayerAndUnitId.delete(key);
  }

  return metadata;
};

const distributeIntegerTotalByWeight = (
  total: number,
  weightedBattleUnitIds: Array<{ battleUnitId: string; weight: number }>,
): Map<string, number> => {
  const sanitizedEntries = weightedBattleUnitIds.filter((entry) => entry.weight > 0);
  if (total <= 0 || sanitizedEntries.length === 0) {
    return new Map();
  }

  const totalWeight = sanitizedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return new Map();
  }

  const shares = sanitizedEntries.map((entry) => {
    const exactShare = (total * entry.weight) / totalWeight;
    return {
      battleUnitId: entry.battleUnitId,
      floorShare: Math.floor(exactShare),
      remainder: exactShare - Math.floor(exactShare),
    };
  });

  let remaining = total - shares.reduce((sum, entry) => sum + entry.floorShare, 0);
  shares.sort((left, right) =>
    right.remainder - left.remainder
    || right.floorShare - left.floorShare
    || left.battleUnitId.localeCompare(right.battleUnitId));

  const distributed = new Map(
    shares.map((entry) => [entry.battleUnitId, entry.floorShare] as const),
  );

  for (const entry of shares) {
    if (remaining <= 0) {
      break;
    }

    distributed.set(entry.battleUnitId, (distributed.get(entry.battleUnitId) ?? 0) + 1);
    remaining -= 1;
  }

  return distributed;
};

const resolveReportUnitCombatProfile = (
  unitId: string,
  unitType: string,
): ReportUnitCombatProfile | null =>
  REPORT_UNIT_COMBAT_PROFILE_BY_ID.get(unitId)
  ?? REPORT_UNIT_COMBAT_PROFILE_BY_TYPE.get(unitType)
  ?? null;

const buildUnitBattleOutcomesForBattle = (
  timeline: BattleTimelineEvent[] | undefined,
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
  playerLabels: Map<string, string>,
): ReportUnitBattleOutcome[] => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return [];
  }

  const battleStartEvent = timeline.find((event): event is BattleStartEvent => event.type === "battleStart");
  if (!battleStartEvent) {
    return [];
  }

  const ownerByTrackedUnitId = buildTrackedUnitOwnerMap(playersAtBattleStart);
  const metadataByPlayerAndUnitId = buildBoardUnitMetadataMapForBattle(playersAtBattleStart);
  const playerById = new Map(playersAtBattleStart.map((player) => [player.playerId, player] as const));
  const battleStartUnitByBattleUnitId = new Map(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, unit] as const),
  );
  const damageByBattleUnitId = new Map<string, number>();
  const phaseContributionByBattleUnitId = new Map<string, number>();
  const damageBySourceToTargetBattleUnitId = new Map<string, Map<string, number>>();
  const attackCountByBattleUnitId = new Map<string, number>();
  const hitCountByBattleUnitId = new Map<string, number>();
  const damageTakenByBattleUnitId = new Map<string, number>();
  const moveCountByBattleUnitId = new Map<string, number>();
  const firstMoveAtMsByBattleUnitId = new Map<string, number>();
  const repositionMoveCountByBattleUnitId = new Map<string, number>();
  const lateralLeftMoveCountByBattleUnitId = new Map<string, number>();
  const lateralRightMoveCountByBattleUnitId = new Map<string, number>();
  const firstLateralMoveDirectionByBattleUnitId = new Map<string, "left" | "right">();
  const sharedPursuitMoveSampleCountByBattleUnitId = new Map<string, number>();
  const contestedPursuitMoveSampleCountByBattleUnitId = new Map<string, number>();
  const plannedApproachGroupMoveSampleCountByBattleUnitId = new Map<string, number>();
  const totalPlannedApproachGroupCompetitorCountByBattleUnitId = new Map<string, number>();
  const totalPlannedApproachGroupAssignedCountByBattleUnitId = new Map<string, number>();
  const oversubscribedPlannedApproachGroupMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachMoveSampleCountByBattleUnitId = new Map<string, number>();
  const plannedApproachStillOpenMoveCountByBattleUnitId = new Map<string, number>();
  const usedPlannedApproachMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByAllyAdjacentMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByEnemyAdjacentMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByMixedAdjacentMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByRouteChokeMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByAllyFrontierChokeMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByEnemyFrontierChokeMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByMixedFrontierChokeMoveCountByBattleUnitId = new Map<string, number>();
  const plannedApproachPathBlockedByUnclassifiedFrontierChokeMoveCountByBattleUnitId = new Map<string, number>();
  const firstPlannedApproachTargetByBattleUnitId = new Map<string, string>();
  const moveTargetDiagnosticSampleCountByBattleUnitId = new Map<string, number>();
  const suboptimalMoveTargetCountByBattleUnitId = new Map<string, number>();
  const totalExcessApproachStepsByBattleUnitId = new Map<string, number>();
  const firstAttackAtMsByBattleUnitId = new Map<string, number>();
  const currentHpByBattleUnitId = new Map<string, number>();
  const deadUnitIds = new Set<string>();
  const deathAtMsByBattleUnitId = new Map<string, number>();
  const currentPositionByBattleUnitId = new Map(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, { x: unit.x, y: unit.y }] as const),
  );
  const initialNearestEnemyDistanceByBattleUnitId = new Map<string, number | null>();
  const bestNearestEnemyDistanceByBattleUnitId = new Map<string, number | null>();
  const latestDamageSourceByTargetBattleUnitId = new Map<string, string>();
  const outsideAttackRangeBeforeFirstAttackMsByBattleUnitId = new Map<string, number>();
  const inAttackRangeBeforeFirstAttackMsByBattleUnitId = new Map<string, number>();
  const afterFirstAttackMsByBattleUnitId = new Map<string, number>();
  const firstReachedAttackRangeAtMsByBattleUnitId = new Map<string, number | null>();
  const latestKeyframeByBattleUnitId = new Map<
    string,
    {
      currentHp: number;
      alive: boolean;
    }
  >();
  let maxTimelineAtMs = 0;
  let battleEndAtMs: number | null = null;
  const resolvePlayerRoleForBattleUnit = (
    battleUnitId: string,
  ): "boss" | "raid" | null => {
    const unit = battleStartUnitByBattleUnitId.get(battleUnitId);
    if (!unit) {
      return null;
    }

    const playerId = resolvePlayerIdForBattleUnit(
      unit.ownerPlayerId,
      unit.battleUnitId,
      unit.sourceUnitId,
      ownerByTrackedUnitId,
    );
    if (!playerId) {
      return null;
    }

    return playerById.get(playerId)?.role === "boss" ? "boss" : "raid";
  };

  const computeNearestEnemyDistance = (battleUnitId: string): number | null => {
    const currentPosition = currentPositionByBattleUnitId.get(battleUnitId);
    const currentUnit = battleStartUnitByBattleUnitId.get(battleUnitId);
    if (!currentPosition || !currentUnit || deadUnitIds.has(battleUnitId)) {
      return null;
    }

    let nearestDistance: number | null = null;
    for (const candidate of battleStartEvent.units) {
      if (candidate.side === currentUnit.side || deadUnitIds.has(candidate.battleUnitId)) {
        continue;
      }

      const candidatePosition = currentPositionByBattleUnitId.get(candidate.battleUnitId);
      if (!candidatePosition) {
        continue;
      }

      const distance = Math.abs(currentPosition.x - candidatePosition.x)
        + Math.abs(currentPosition.y - candidatePosition.y);
      nearestDistance = nearestDistance == null
        ? distance
        : Math.min(nearestDistance, distance);
    }

    return nearestDistance;
  };

  const refreshNearestEnemyDistances = (): void => {
    for (const unit of battleStartEvent.units) {
      const nearestDistance = computeNearestEnemyDistance(unit.battleUnitId);
      if (!initialNearestEnemyDistanceByBattleUnitId.has(unit.battleUnitId)) {
        initialNearestEnemyDistanceByBattleUnitId.set(unit.battleUnitId, nearestDistance);
      }
      if (nearestDistance == null) {
        continue;
      }

      const bestDistance = bestNearestEnemyDistanceByBattleUnitId.get(unit.battleUnitId);
      if (bestDistance == null || nearestDistance < bestDistance) {
        bestNearestEnemyDistanceByBattleUnitId.set(unit.battleUnitId, nearestDistance);
      }
    }
  };

  refreshNearestEnemyDistances();

  for (const event of timeline) {
    if ("atMs" in event && typeof event.atMs === "number") {
      maxTimelineAtMs = Math.max(maxTimelineAtMs, event.atMs);
    }

    if (event.type === "attackStart") {
      attackCountByBattleUnitId.set(
        event.sourceBattleUnitId,
        (attackCountByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + 1,
      );
      if (!firstAttackAtMsByBattleUnitId.has(event.sourceBattleUnitId)) {
        firstAttackAtMsByBattleUnitId.set(event.sourceBattleUnitId, event.atMs);
      }
      continue;
    }

    if (event.type === "move") {
      const lateralDeltaX = event.to.x - event.from.x;
      if (lateralDeltaX < 0) {
        lateralLeftMoveCountByBattleUnitId.set(
          event.battleUnitId,
          (lateralLeftMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
        );
        if (!firstLateralMoveDirectionByBattleUnitId.has(event.battleUnitId)) {
          firstLateralMoveDirectionByBattleUnitId.set(event.battleUnitId, "left");
        }
      } else if (lateralDeltaX > 0) {
        lateralRightMoveCountByBattleUnitId.set(
          event.battleUnitId,
          (lateralRightMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
        );
        if (!firstLateralMoveDirectionByBattleUnitId.has(event.battleUnitId)) {
          firstLateralMoveDirectionByBattleUnitId.set(event.battleUnitId, "right");
        }
      }
      currentPositionByBattleUnitId.set(event.battleUnitId, event.to);
      moveCountByBattleUnitId.set(
        event.battleUnitId,
        (moveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
      );
      if (
        typeof event.plannedApproachGroupTargetBattleUnitId === "string"
        && typeof event.plannedApproachGroupCompetitorCountBeforeMove === "number"
        && typeof event.plannedApproachGroupAssignedCountBeforeMove === "number"
      ) {
        plannedApproachGroupMoveSampleCountByBattleUnitId.set(
          event.battleUnitId,
          (plannedApproachGroupMoveSampleCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
        );
        totalPlannedApproachGroupCompetitorCountByBattleUnitId.set(
          event.battleUnitId,
          (totalPlannedApproachGroupCompetitorCountByBattleUnitId.get(event.battleUnitId) ?? 0)
            + event.plannedApproachGroupCompetitorCountBeforeMove,
        );
        totalPlannedApproachGroupAssignedCountByBattleUnitId.set(
          event.battleUnitId,
          (totalPlannedApproachGroupAssignedCountByBattleUnitId.get(event.battleUnitId) ?? 0)
            + event.plannedApproachGroupAssignedCountBeforeMove,
        );
        if (event.plannedApproachGroupCompetitorCountBeforeMove > event.plannedApproachGroupAssignedCountBeforeMove) {
          oversubscribedPlannedApproachGroupMoveCountByBattleUnitId.set(
            event.battleUnitId,
            (oversubscribedPlannedApproachGroupMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
          );
        }
      }
      if (typeof event.plannedApproachTargetBattleUnitId === "string") {
        plannedApproachMoveSampleCountByBattleUnitId.set(
          event.battleUnitId,
          (plannedApproachMoveSampleCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
        );
        if (!firstPlannedApproachTargetByBattleUnitId.has(event.battleUnitId)) {
          firstPlannedApproachTargetByBattleUnitId.set(
            event.battleUnitId,
            event.plannedApproachTargetBattleUnitId,
          );
        }
        if (event.plannedApproachDestinationStillOpenBeforeMove) {
          plannedApproachStillOpenMoveCountByBattleUnitId.set(
            event.battleUnitId,
            (plannedApproachStillOpenMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
          );
        }
        if (event.usedPlannedApproachDestination) {
          usedPlannedApproachMoveCountByBattleUnitId.set(
            event.battleUnitId,
            (usedPlannedApproachMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
          );
        }
        if (event.plannedApproachDestinationPathBlockedBeforeMove) {
          plannedApproachPathBlockedMoveCountByBattleUnitId.set(
            event.battleUnitId,
            (plannedApproachPathBlockedMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
          );
          switch (event.plannedApproachDestinationPathBlockerTypeBeforeMove) {
            case "ally_adjacent":
              plannedApproachPathBlockedByAllyAdjacentMoveCountByBattleUnitId.set(
                event.battleUnitId,
                (plannedApproachPathBlockedByAllyAdjacentMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
              );
              break;
            case "enemy_adjacent":
              plannedApproachPathBlockedByEnemyAdjacentMoveCountByBattleUnitId.set(
                event.battleUnitId,
                (plannedApproachPathBlockedByEnemyAdjacentMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
              );
              break;
            case "mixed_adjacent":
              plannedApproachPathBlockedByMixedAdjacentMoveCountByBattleUnitId.set(
                event.battleUnitId,
                (plannedApproachPathBlockedByMixedAdjacentMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
              );
              break;
            case "route_choke":
              plannedApproachPathBlockedByRouteChokeMoveCountByBattleUnitId.set(
                event.battleUnitId,
                (plannedApproachPathBlockedByRouteChokeMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
              );
              switch (event.plannedApproachDestinationRouteChokeTypeBeforeMove) {
                case "ally_frontier":
                  plannedApproachPathBlockedByAllyFrontierChokeMoveCountByBattleUnitId.set(
                    event.battleUnitId,
                    (plannedApproachPathBlockedByAllyFrontierChokeMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
                  );
                  break;
                case "enemy_frontier":
                  plannedApproachPathBlockedByEnemyFrontierChokeMoveCountByBattleUnitId.set(
                    event.battleUnitId,
                    (plannedApproachPathBlockedByEnemyFrontierChokeMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
                  );
                  break;
                case "mixed_frontier":
                  plannedApproachPathBlockedByMixedFrontierChokeMoveCountByBattleUnitId.set(
                    event.battleUnitId,
                    (plannedApproachPathBlockedByMixedFrontierChokeMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
                  );
                  break;
                case "unclassified":
                  plannedApproachPathBlockedByUnclassifiedFrontierChokeMoveCountByBattleUnitId.set(
                    event.battleUnitId,
                    (plannedApproachPathBlockedByUnclassifiedFrontierChokeMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
                  );
                  break;
                default:
                  break;
              }
              break;
            default:
              break;
          }
        }
      }
      if (!firstMoveAtMsByBattleUnitId.has(event.battleUnitId)) {
        firstMoveAtMsByBattleUnitId.set(event.battleUnitId, event.atMs);
      }
      if (firstAttackAtMsByBattleUnitId.has(event.battleUnitId)) {
        repositionMoveCountByBattleUnitId.set(
          event.battleUnitId,
          (repositionMoveCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
        );
      }
      if (
        typeof event.pursuedTargetBattleUnitId === "string"
        && typeof event.bestApproachTargetBattleUnitId === "string"
      ) {
        moveTargetDiagnosticSampleCountByBattleUnitId.set(
          event.battleUnitId,
          (moveTargetDiagnosticSampleCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
        );
        if (event.pursuedTargetBattleUnitId !== event.bestApproachTargetBattleUnitId) {
          suboptimalMoveTargetCountByBattleUnitId.set(
            event.battleUnitId,
            (suboptimalMoveTargetCountByBattleUnitId.get(event.battleUnitId) ?? 0) + 1,
          );
        }
      }
      if (
        typeof event.pursuedTargetRequiredStepsBeforeMove === "number"
        && typeof event.bestApproachTargetRequiredStepsBeforeMove === "number"
      ) {
        totalExcessApproachStepsByBattleUnitId.set(
          event.battleUnitId,
          (totalExcessApproachStepsByBattleUnitId.get(event.battleUnitId) ?? 0)
            + Math.max(
              0,
              event.pursuedTargetRequiredStepsBeforeMove - event.bestApproachTargetRequiredStepsBeforeMove,
            ),
        );
      }
      refreshNearestEnemyDistances();
      continue;
    }

    if (event.type === "damageApplied") {
      damageByBattleUnitId.set(
        event.sourceBattleUnitId,
        (damageByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + event.amount,
      );
      if (event.amount > 0) {
        hitCountByBattleUnitId.set(
          event.sourceBattleUnitId,
          (hitCountByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + 1,
        );
      }
      damageTakenByBattleUnitId.set(
        event.targetBattleUnitId,
        (damageTakenByBattleUnitId.get(event.targetBattleUnitId) ?? 0) + event.amount,
      );
      const sourceDamageByTarget = damageBySourceToTargetBattleUnitId.get(event.targetBattleUnitId)
        ?? new Map<string, number>();
      sourceDamageByTarget.set(
        event.sourceBattleUnitId,
        (sourceDamageByTarget.get(event.sourceBattleUnitId) ?? 0) + event.amount,
      );
      damageBySourceToTargetBattleUnitId.set(event.targetBattleUnitId, sourceDamageByTarget);
      latestDamageSourceByTargetBattleUnitId.set(event.targetBattleUnitId, event.sourceBattleUnitId);
      const targetUnit = battleStartUnitByBattleUnitId.get(event.targetBattleUnitId);
      if (
        targetUnit?.battleUnitId.startsWith("boss-")
        && resolvePlayerRoleForBattleUnit(event.sourceBattleUnitId) === "raid"
      ) {
        phaseContributionByBattleUnitId.set(
          event.sourceBattleUnitId,
          (phaseContributionByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + event.amount,
        );
      }
      currentHpByBattleUnitId.set(event.targetBattleUnitId, event.remainingHp);
      continue;
    }

    if (event.type === "unitDeath") {
      const defeatedUnit = battleStartUnitByBattleUnitId.get(event.battleUnitId);
      const defeatedUnitIsBossSide = defeatedUnit != null
        && resolvePlayerRoleForBattleUnit(event.battleUnitId) === "boss";
      const defeatedUnitIsMainBoss = defeatedUnit?.battleUnitId.startsWith("boss-") ?? false;
      if (defeatedUnitIsBossSide && !defeatedUnitIsMainBoss) {
        const escortDefeatBonus = typeof defeatedUnit?.maxHp === "number"
          ? Math.floor(defeatedUnit.maxHp / 2)
          : 0;
        const raidDamageContributors = Array.from(
          damageBySourceToTargetBattleUnitId.get(event.battleUnitId)?.entries() ?? [],
        )
          .filter(([battleUnitId, damage]) =>
            damage > 0 && resolvePlayerRoleForBattleUnit(battleUnitId) === "raid")
          .map(([battleUnitId, damage]) => ({ battleUnitId, weight: damage }));

        const distributedEscortBonus = distributeIntegerTotalByWeight(
          escortDefeatBonus,
          raidDamageContributors,
        );
        if (distributedEscortBonus.size > 0) {
          for (const [battleUnitId, bonus] of distributedEscortBonus) {
            phaseContributionByBattleUnitId.set(
              battleUnitId,
              (phaseContributionByBattleUnitId.get(battleUnitId) ?? 0) + bonus,
            );
          }
        } else {
          const killerBattleUnitId = latestDamageSourceByTargetBattleUnitId.get(event.battleUnitId);
          if (
            killerBattleUnitId
            && resolvePlayerRoleForBattleUnit(killerBattleUnitId) === "raid"
            && escortDefeatBonus > 0
          ) {
            phaseContributionByBattleUnitId.set(
              killerBattleUnitId,
              (phaseContributionByBattleUnitId.get(killerBattleUnitId) ?? 0) + escortDefeatBonus,
            );
          }
        }
      }
      deadUnitIds.add(event.battleUnitId);
      deathAtMsByBattleUnitId.set(
        event.battleUnitId,
        deathAtMsByBattleUnitId.get(event.battleUnitId) ?? event.atMs,
      );
      currentHpByBattleUnitId.set(event.battleUnitId, 0);
      latestKeyframeByBattleUnitId.set(event.battleUnitId, {
        currentHp: 0,
        alive: false,
      });
      refreshNearestEnemyDistances();
      continue;
    }

    if (event.type === "keyframe") {
      for (const unitState of event.units) {
        currentPositionByBattleUnitId.set(unitState.battleUnitId, {
          x: unitState.x,
          y: unitState.y,
        });
        latestKeyframeByBattleUnitId.set(unitState.battleUnitId, {
          currentHp: unitState.currentHp,
          alive: unitState.alive,
        });
        if (!unitState.alive && !deathAtMsByBattleUnitId.has(unitState.battleUnitId)) {
          deathAtMsByBattleUnitId.set(unitState.battleUnitId, event.atMs);
          deadUnitIds.add(unitState.battleUnitId);
        } else if (unitState.alive) {
          deadUnitIds.delete(unitState.battleUnitId);
        }
      }
      refreshNearestEnemyDistances();
      continue;
    }

    if (event.type === "battleEnd") {
      battleEndAtMs = event.atMs;
    }
  }

  const resolvedBattleDurationMs = battleEndAtMs ?? maxTimelineAtMs;
  const attackRangeByBattleUnitId = new Map<string, number>();
  const initialRowByBattleUnitId = new Map<string, number>();
  const initialColumnByBattleUnitId = new Map<string, number>();
  const sameColumnFrontAllyCountByBattleUnitId = new Map<string, number>();

  for (const unit of battleStartEvent.units) {
    const playerId = resolvePlayerIdForBattleUnit(
      unit.ownerPlayerId,
      unit.battleUnitId,
      unit.sourceUnitId,
      ownerByTrackedUnitId,
    );
    const sourceUnitId = unit.sourceUnitId ?? unit.battleUnitId;
    const metadataUnitType = playerId == null
      ? null
      : (metadataByPlayerAndUnitId.get(`${playerId}::${sourceUnitId}`)?.[0]?.unitType ?? null);
    const combatProfile = resolveReportUnitCombatProfile(
      sourceUnitId,
      metadataUnitType ?? sourceUnitId,
    );
    attackRangeByBattleUnitId.set(unit.battleUnitId, combatProfile?.range ?? 1);
    initialRowByBattleUnitId.set(unit.battleUnitId, unit.y);
    initialColumnByBattleUnitId.set(unit.battleUnitId, unit.x);
  }

  for (const unit of battleStartEvent.units) {
    const frontAllyCount = battleStartEvent.units.filter((candidate) => (
      candidate.battleUnitId !== unit.battleUnitId
      && candidate.side === unit.side
      && candidate.x === unit.x
      && (
        unit.side === "raid"
          ? candidate.y < unit.y
          : candidate.y > unit.y
      )
    )).length;
    sameColumnFrontAllyCountByBattleUnitId.set(unit.battleUnitId, frontAllyCount);
  }

  const timedEventsByAtMs = new Map<number, BattleTimelineEvent[]>();
  for (const event of timeline) {
    if (!("atMs" in event) || typeof event.atMs !== "number" || !Number.isFinite(event.atMs)) {
      continue;
    }

    const timedEvents = timedEventsByAtMs.get(event.atMs) ?? [];
    timedEvents.push(event);
    timedEventsByAtMs.set(event.atMs, timedEvents);
  }

  const intervalAliveByBattleUnitId = new Map<string, boolean>(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, true] as const),
  );
  const intervalPositionByBattleUnitId = new Map(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, { x: unit.x, y: unit.y }] as const),
  );
  const hasAttackedByBattleUnitId = new Map<string, boolean>(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, false] as const),
  );

  const computeNearestLivingEnemyDistanceAtInterval = (battleUnitId: string): number | null => {
    const currentUnit = battleStartUnitByBattleUnitId.get(battleUnitId);
    const currentPosition = intervalPositionByBattleUnitId.get(battleUnitId);
    if (!currentUnit || !currentPosition || !intervalAliveByBattleUnitId.get(battleUnitId)) {
      return null;
    }

    let nearestDistance: number | null = null;
    for (const candidate of battleStartEvent.units) {
      if (candidate.side === currentUnit.side || !intervalAliveByBattleUnitId.get(candidate.battleUnitId)) {
        continue;
      }

      const candidatePosition = intervalPositionByBattleUnitId.get(candidate.battleUnitId);
      if (!candidatePosition) {
        continue;
      }

      const distance = Math.abs(currentPosition.x - candidatePosition.x)
        + Math.abs(currentPosition.y - candidatePosition.y);
      nearestDistance = nearestDistance == null
        ? distance
        : Math.min(nearestDistance, distance);
    }

    return nearestDistance;
  };

  const intervalBoundaries = Array.from(new Set([0, resolvedBattleDurationMs, ...timedEventsByAtMs.keys()]))
    .filter((atMs) => atMs >= 0 && atMs <= resolvedBattleDurationMs)
    .sort((left, right) => left - right);

  for (let index = 0; index < intervalBoundaries.length - 1; index += 1) {
    const currentAtMs = intervalBoundaries[index] ?? 0;
    const nextAtMs = intervalBoundaries[index + 1] ?? currentAtMs;
    const timedEvents = timedEventsByAtMs.get(currentAtMs) ?? [];

    const moveEventsWithPursuedTarget = timedEvents.filter(
      (event): event is MoveEvent =>
        event.type === "move" && typeof event.pursuedTargetBattleUnitId === "string",
    );
    const moveEventsByPursuitKey = new Map<string, MoveEvent[]>();
    for (const moveEvent of moveEventsWithPursuedTarget) {
      const movingUnit = battleStartUnitByBattleUnitId.get(moveEvent.battleUnitId);
      if (!movingUnit || !moveEvent.pursuedTargetBattleUnitId) {
        continue;
      }

      const pursuitKey = `${currentAtMs}::${movingUnit.side}::${moveEvent.pursuedTargetBattleUnitId}`;
      const groupedMoveEvents = moveEventsByPursuitKey.get(pursuitKey) ?? [];
      groupedMoveEvents.push(moveEvent);
      moveEventsByPursuitKey.set(pursuitKey, groupedMoveEvents);
    }

    for (const groupedMoveEvents of moveEventsByPursuitKey.values()) {
      for (const moveEvent of groupedMoveEvents) {
        sharedPursuitMoveSampleCountByBattleUnitId.set(
          moveEvent.battleUnitId,
          (sharedPursuitMoveSampleCountByBattleUnitId.get(moveEvent.battleUnitId) ?? 0) + 1,
        );
        if (groupedMoveEvents.length > 1) {
          contestedPursuitMoveSampleCountByBattleUnitId.set(
            moveEvent.battleUnitId,
            (contestedPursuitMoveSampleCountByBattleUnitId.get(moveEvent.battleUnitId) ?? 0) + 1,
          );
        }
      }
    }

    for (const event of timedEvents) {
      if (event.type === "move") {
        intervalPositionByBattleUnitId.set(event.battleUnitId, event.to);
        continue;
      }

      if (event.type === "attackStart") {
        hasAttackedByBattleUnitId.set(event.sourceBattleUnitId, true);
        continue;
      }

      if (event.type === "unitDeath") {
        intervalAliveByBattleUnitId.set(event.battleUnitId, false);
      }
    }

    const intervalMs = Math.max(0, nextAtMs - currentAtMs);
    if (intervalMs <= 0) {
      continue;
    }

    for (const unit of battleStartEvent.units) {
      if (!intervalAliveByBattleUnitId.get(unit.battleUnitId)) {
        continue;
      }

      if (hasAttackedByBattleUnitId.get(unit.battleUnitId)) {
        afterFirstAttackMsByBattleUnitId.set(
          unit.battleUnitId,
          (afterFirstAttackMsByBattleUnitId.get(unit.battleUnitId) ?? 0) + intervalMs,
        );
        continue;
      }

      const nearestEnemyDistance = computeNearestLivingEnemyDistanceAtInterval(unit.battleUnitId);
      const attackRange = attackRangeByBattleUnitId.get(unit.battleUnitId) ?? 1;
      if (nearestEnemyDistance != null && nearestEnemyDistance <= attackRange) {
        if (!firstReachedAttackRangeAtMsByBattleUnitId.has(unit.battleUnitId)) {
          firstReachedAttackRangeAtMsByBattleUnitId.set(unit.battleUnitId, currentAtMs);
        }
        inAttackRangeBeforeFirstAttackMsByBattleUnitId.set(
          unit.battleUnitId,
          (inAttackRangeBeforeFirstAttackMsByBattleUnitId.get(unit.battleUnitId) ?? 0) + intervalMs,
        );
        continue;
      }

      outsideAttackRangeBeforeFirstAttackMsByBattleUnitId.set(
        unit.battleUnitId,
        (outsideAttackRangeBeforeFirstAttackMsByBattleUnitId.get(unit.battleUnitId) ?? 0) + intervalMs,
      );
    }
  }

  return battleStartEvent.units
    .map((unit): ReportUnitBattleOutcome | null => {
      const playerId = resolvePlayerIdForBattleUnit(
        unit.ownerPlayerId,
        unit.battleUnitId,
        unit.sourceUnitId,
        ownerByTrackedUnitId,
      );
      if (!playerId) {
        return null;
      }

      const ownerPlayer = playersAtBattleStart.find((player) => player.playerId === playerId);
      const sourceUnitId = unit.sourceUnitId ?? unit.battleUnitId;
      const metadata = takeBoardUnitMetadataForBattleUnit(
        metadataByPlayerAndUnitId,
        playerId,
        sourceUnitId,
      );
      const latestKeyframe = latestKeyframeByBattleUnitId.get(unit.battleUnitId);
      const finalHp = Math.max(
        0,
        latestKeyframe?.currentHp
          ?? currentHpByBattleUnitId.get(unit.battleUnitId)
          ?? unit.currentHp,
      );
      const alive = latestKeyframe?.alive
        ?? (!deadUnitIds.has(unit.battleUnitId) && finalHp > 0);
      const lifetimeMs = Math.max(
        0,
        Math.min(
          deathAtMsByBattleUnitId.get(unit.battleUnitId) ?? resolvedBattleDurationMs,
          resolvedBattleDurationMs,
        ),
      );

      const plannedApproachMoveSampleCount =
        plannedApproachMoveSampleCountByBattleUnitId.get(unit.battleUnitId) ?? 0;
      const firstAttackAtMs = firstAttackAtMsByBattleUnitId.get(unit.battleUnitId) ?? null;
      const attackCount = attackCountByBattleUnitId.get(unit.battleUnitId) ?? 0;
      const firstPlannedApproachTargetBattleUnitId =
        firstPlannedApproachTargetByBattleUnitId.get(unit.battleUnitId) ?? null;
      const firstAttackTargetBattleUnitId = firstAttackAtMs == null
        ? null
        : timeline.find(
          (event): event is AttackStartEvent =>
            event.type === "attackStart"
            && event.sourceBattleUnitId === unit.battleUnitId
            && event.atMs === firstAttackAtMs,
        )?.targetBattleUnitId ?? null;
      const plannedApproachTargetDeathAtMs = firstPlannedApproachTargetBattleUnitId == null
        ? null
        : deathAtMsByBattleUnitId.get(firstPlannedApproachTargetBattleUnitId) ?? null;
      const plannedApproachTargetAliveAtBattleEnd =
        firstPlannedApproachTargetBattleUnitId != null
        && (
          plannedApproachTargetDeathAtMs == null
          || plannedApproachTargetDeathAtMs > resolvedBattleDurationMs
        );
      const reachedAttackRange =
        (bestNearestEnemyDistanceByBattleUnitId.get(unit.battleUnitId) ?? Number.POSITIVE_INFINITY)
        <= (attackRangeByBattleUnitId.get(unit.battleUnitId) ?? 1);

      return {
        playerId,
        label: getPlayerLabel(playerLabels, playerId),
        unitId: sourceUnitId,
        unitName: unit.displayName ?? metadata?.unitName ?? sourceUnitId,
        side: ownerPlayer?.role === "boss" ? "boss" : "raid",
        totalDamage: damageByBattleUnitId.get(unit.battleUnitId) ?? 0,
        phaseContributionDamage: phaseContributionByBattleUnitId.get(unit.battleUnitId) ?? 0,
        finalHp,
        alive,
        unitLevel: metadata?.unitLevel ?? 1,
        subUnitName: metadata?.subUnitName ?? "",
        isSpecialUnit: metadata == null,
        attackCount,
        hitCount: hitCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        damageTaken: damageTakenByBattleUnitId.get(unit.battleUnitId) ?? 0,
        moveCount: moveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        firstMoveAtMs: firstMoveAtMsByBattleUnitId.get(unit.battleUnitId) ?? null,
        firstAttackAtMs,
        repositionMoveCount: repositionMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        lifetimeMs,
        battleDurationMs: resolvedBattleDurationMs,
        initialNearestEnemyDistance: initialNearestEnemyDistanceByBattleUnitId.get(unit.battleUnitId) ?? null,
        bestNearestEnemyDistance: bestNearestEnemyDistanceByBattleUnitId.get(unit.battleUnitId) ?? null,
        moveTargetDiagnosticSampleCount: moveTargetDiagnosticSampleCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        suboptimalMoveTargetCount: suboptimalMoveTargetCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        totalExcessApproachSteps: totalExcessApproachStepsByBattleUnitId.get(unit.battleUnitId) ?? 0,
        outsideAttackRangeBeforeFirstAttackMs:
          outsideAttackRangeBeforeFirstAttackMsByBattleUnitId.get(unit.battleUnitId) ?? 0,
        inAttackRangeBeforeFirstAttackMs:
          inAttackRangeBeforeFirstAttackMsByBattleUnitId.get(unit.battleUnitId) ?? 0,
        afterFirstAttackMs: afterFirstAttackMsByBattleUnitId.get(unit.battleUnitId) ?? 0,
        firstReachedAttackRangeAtMs:
          firstReachedAttackRangeAtMsByBattleUnitId.get(unit.battleUnitId) ?? null,
        initialRow: initialRowByBattleUnitId.get(unit.battleUnitId) ?? null,
        initialColumn: initialColumnByBattleUnitId.get(unit.battleUnitId) ?? null,
        sameColumnFrontAllyCount: sameColumnFrontAllyCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        lateralLeftMoveCount: lateralLeftMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        lateralRightMoveCount: lateralRightMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        firstLateralMoveDirection: firstLateralMoveDirectionByBattleUnitId.get(unit.battleUnitId) ?? null,
        sharedPursuitMoveSampleCount:
          sharedPursuitMoveSampleCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        contestedPursuitMoveSampleCount:
          contestedPursuitMoveSampleCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        plannedApproachGroupMoveSampleCount:
          plannedApproachGroupMoveSampleCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        totalPlannedApproachGroupCompetitorCount:
          totalPlannedApproachGroupCompetitorCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        totalPlannedApproachGroupAssignedCount:
          totalPlannedApproachGroupAssignedCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        oversubscribedPlannedApproachGroupMoveCount:
          oversubscribedPlannedApproachGroupMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        plannedApproachMoveSampleCount,
        plannedApproachStillOpenMoveCount:
          plannedApproachStillOpenMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        usedPlannedApproachMoveCount:
          usedPlannedApproachMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        plannedApproachPathBlockedMoveCount:
          plannedApproachPathBlockedMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0,
        plannedApproachWithFirstAttackCount:
          plannedApproachMoveSampleCount > 0 && firstAttackAtMs != null ? 1 : 0,
        plannedApproachMatchedFirstAttackTargetCount:
          plannedApproachMoveSampleCount > 0
            && firstAttackTargetBattleUnitId != null
            && firstAttackTargetBattleUnitId === firstPlannedApproachTargetBattleUnitId
            ? 1
            : 0,
        plannedApproachReachedRangeWithoutAttackCount:
          plannedApproachMoveSampleCount > 0 && attackCount <= 0 && reachedAttackRange ? 1 : 0,
        plannedApproachNoReachNoAttackCount:
          plannedApproachMoveSampleCount > 0 && attackCount <= 0 && !reachedAttackRange ? 1 : 0,
        plannedApproachNoAttackTargetDiedBeforeBattleEndCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && firstPlannedApproachTargetBattleUnitId != null
            && !plannedApproachTargetAliveAtBattleEnd
            ? 1
            : 0,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            ? 1
            : 0,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (usedPlannedApproachMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) <= 0
            ? 1
            : 0,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (usedPlannedApproachMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) <= 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByAllyAdjacentMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByEnemyAdjacentMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByMixedAdjacentMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByRouteChokeMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByAllyFrontierChokeMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByEnemyFrontierChokeMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByMixedFrontierChokeMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
        plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount:
          plannedApproachMoveSampleCount > 0
            && attackCount <= 0
            && !reachedAttackRange
            && plannedApproachTargetAliveAtBattleEnd
            && (plannedApproachPathBlockedByUnclassifiedFrontierChokeMoveCountByBattleUnitId.get(unit.battleUnitId) ?? 0) > 0
            ? 1
            : 0,
      };
    })
    .filter((unit): unit is ReportUnitBattleOutcome => unit !== null)
    .sort((left, right) =>
      left.side.localeCompare(right.side)
      || left.label.localeCompare(right.label)
      || right.totalDamage - left.totalDamage
      || left.unitName.localeCompare(right.unitName));
};

const resolveBattleDurationMsFromTimeline = (
  timeline: BattleTimelineEvent[] | undefined,
): number | undefined => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return undefined;
  }

  let maxAtMs: number | undefined;
  for (const event of timeline) {
    if ("atMs" in event && typeof event.atMs === "number" && Number.isFinite(event.atMs)) {
      maxAtMs = maxAtMs === undefined ? event.atMs : Math.max(maxAtMs, event.atMs);
    }
  }

  return maxAtMs;
};

const resolveBattleEndReasonFromTimeline = (
  timeline: BattleTimelineEvent[] | undefined,
): BotOnlyBaselineBattleEndReason | undefined => {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return undefined;
  }

  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const event = timeline[index];
    if (event?.type === "battleEnd") {
      return event.endReason as BotOnlyBaselineBattleEndReason | undefined;
    }
  }

  return undefined;
};

const resolveRemainingTimeFromDeadlineAtMs = (
  deadlineAtMs: number | null | undefined,
  nowMs: number = Date.now(),
): number | undefined => {
  if (!Number.isFinite(deadlineAtMs) || !Number.isFinite(nowMs)) {
    return undefined;
  }

  return Math.max(0, Math.round(Number(deadlineAtMs) - nowMs));
};

const resolveBattlePhaseElapsedMs = (
  remainingAtBattleStartMs: number | undefined,
  remainingAtCaptureMs: number | undefined,
): number | undefined => {
  if (
    !Number.isFinite(remainingAtBattleStartMs)
    || !Number.isFinite(remainingAtCaptureMs)
  ) {
    return undefined;
  }

  return Math.max(0, Math.round(Number(remainingAtBattleStartMs) - Number(remainingAtCaptureMs)));
};

const REAL_PLAY_BATTLE_DURATION_MS = 40_000;
const BOT_ONLY_BATTLE_DURATION_MS = 80;

const convertToRealPlayBattleDurationMs = (
  battleDurationMs: number | undefined,
): number | undefined => {
  if (
    !Number.isFinite(battleDurationMs)
    || Number(battleDurationMs) <= 0
    || Number(battleDurationMs) > BOT_ONLY_BATTLE_DURATION_MS
  ) {
    return undefined;
  }

  return Math.round(
    Number(battleDurationMs) * (REAL_PLAY_BATTLE_DURATION_MS / BOT_ONLY_BATTLE_DURATION_MS),
  );
};

const buildRoundBattleReport = (
  serverRoom: BotOnlyServerRoom,
  battle: {
    battleIndex: number;
    leftPlayerId: string;
    rightPlayerId: string;
    winner: "left" | "right" | "draw";
    leftDamageDealt: number;
    rightDamageDealt: number;
    leftSurvivors: number;
    rightSurvivors: number;
  },
  timeline: BattleTimelineEvent[],
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
  playerLabels: Map<string, string>,
  battleDurationOverrideMs?: number,
): BotOnlyRoundBattleReport => {
  const battleDurationMs = battleDurationOverrideMs ?? resolveBattleDurationMsFromTimeline(timeline);
  const battleEndReason = resolveBattleEndReasonFromTimeline(timeline);
  const bossIsLeft = battle.leftPlayerId === serverRoom.state.bossPlayerId;
  return {
    battleIndex: battle.battleIndex,
    leftPlayerId: battle.leftPlayerId,
    leftLabel: getPlayerLabel(playerLabels, battle.leftPlayerId),
    rightPlayerId: battle.rightPlayerId,
    rightLabel: getPlayerLabel(playerLabels, battle.rightPlayerId),
    ...(battleDurationMs !== undefined ? { battleDurationMs } : {}),
    ...(battleEndReason !== undefined ? { battleEndReason } : {}),
    bossSurvivors: bossIsLeft ? battle.leftSurvivors : battle.rightSurvivors,
    raidSurvivors: bossIsLeft ? battle.rightSurvivors : battle.leftSurvivors,
    leftSpecialUnits: getSpecialBattleUnitsForPlayers(
      serverRoom,
      getBattleSidePlayerIds(serverRoom, battle.leftPlayerId),
    ),
    rightSpecialUnits: getSpecialBattleUnitsForPlayers(
      serverRoom,
      getBattleSidePlayerIds(serverRoom, battle.rightPlayerId),
    ),
    winner: battle.winner,
    leftDamageDealt: battle.leftDamageDealt,
    rightDamageDealt: battle.rightDamageDealt,
    leftSurvivors: battle.leftSurvivors,
    rightSurvivors: battle.rightSurvivors,
    unitDamageBreakdown: buildUnitDamageBreakdownForBattle(
      timeline,
      playersAtBattleStart,
      playerLabels,
    ),
    unitOutcomes: buildUnitBattleOutcomesForBattle(
      timeline,
      playersAtBattleStart,
      playerLabels,
    ),
  };
};

const resolveBattleTimelineForReportBattle = (
  serverRoom: BotOnlyServerRoom,
  snapshot: BotOnlyRoundSnapshot | undefined,
  battle: {
    leftPlayerId: string;
    rightPlayerId: string;
  },
): BattleTimelineEvent[] => {
  if (snapshot) {
    for (const playerId of [battle.leftPlayerId, battle.rightPlayerId]) {
      const entry = snapshot.battleTimelines.find((candidate) => (
        candidate.playerId === playerId
        && Array.isArray(candidate.timeline)
        && candidate.timeline.length > 0
      ));
      if (entry) {
        return entry.timeline;
      }
    }

    const pairedPlayers = snapshot.playersAfterRound.filter((player) => (
      (player.playerId === battle.leftPlayerId && player.lastBattle.opponentId === battle.rightPlayerId)
      || (player.playerId === battle.rightPlayerId && player.lastBattle.opponentId === battle.leftPlayerId)
    ) && Array.isArray(player.lastBattle.timeline) && player.lastBattle.timeline.length > 0);

    const firstPairedPlayer = pairedPlayers[0];
    if (firstPairedPlayer) {
      return firstPairedPlayer.lastBattle.timeline;
    }

    const candidatePlayers = [
      battle.leftPlayerId,
      battle.rightPlayerId,
      ...snapshot.playersAfterRound.map((player) => player.playerId),
    ];
    const seen = new Set<string>();

    for (const playerId of candidatePlayers) {
      if (seen.has(playerId)) {
        continue;
      }
      seen.add(playerId);

      const player = snapshot.playersAfterRound.find((candidate) => candidate.playerId === playerId);
      if (!player || !Array.isArray(player.lastBattle.timeline) || player.lastBattle.timeline.length === 0) {
        continue;
      }

      return player.lastBattle.timeline;
    }
  }

  const testAccess = getTestAccess(serverRoom);
  for (const playerId of [battle.leftPlayerId, battle.rightPlayerId]) {
    const battleResult = testAccess?.battleResultsByPlayer.get(playerId);
    const timeline = battleResult?.rawTimeline ?? battleResult?.timeline;
    if (Array.isArray(timeline) && timeline.length > 0) {
      return timeline;
    }
  }

  return [];
};

const captureBattleTimelinesForRound = (
  serverRoom: BotOnlyServerRoom,
  clients: BotOnlyTestClient[],
): BotOnlyRoundSnapshot["battleTimelines"] => {
  const testAccess = getTestAccess(serverRoom);

  return clients
    .map((client) => {
      const battleResult = testAccess?.battleResultsByPlayer.get(client.sessionId);
      const timeline = battleResult?.rawTimeline ?? battleResult?.timeline;
      return {
        playerId: client.sessionId,
        battleId: resolveBattleIdFromTimeline(timeline),
        timeline: Array.isArray(timeline) ? [...timeline] : [],
      };
    })
    .filter((entry) => entry.timeline.length > 0);
};

const buildRoundBattleReportsFromCurrentState = (
  serverRoom: BotOnlyServerRoom,
  roundIndex: number,
  playersAtBattleStart: BotOnlyRoundSnapshot["playersAtBattleStart"],
  playerLabels: Map<string, string>,
  battleDurationOverrideMs?: number,
): BotOnlyRoundBattleReport[] => {
  const roundLog = getMatchLogger(serverRoom)
    .getRoundLogs()
    .find((candidate) => candidate.roundIndex === roundIndex);

  if (!roundLog) {
    return [];
  }

  return roundLog.battles.map((battle) => {
    const timeline = resolveBattleTimelineForReportBattle(serverRoom, undefined, battle);
    return buildRoundBattleReport(
      serverRoom,
      battle,
      timeline,
      playersAtBattleStart,
      playerLabels,
      battleDurationOverrideMs,
    );
  });
};

test("resolveBattleTimelineForReportBattle prefers the round snapshot over latest controller battle results", () => {
  const latestTimeline = [{
    type: "battleStart",
    battleId: "r2-p1-p2",
    round: 2,
    boardConfig: {
      width: 6,
      height: 6,
    },
    units: [],
  }] as unknown as BattleTimelineEvent[];
  const roundOneTimeline = [{
    type: "battleStart",
    battleId: "r1-p1-p2",
    round: 1,
    boardConfig: {
      width: 6,
      height: 6,
    },
    units: [],
  }] as unknown as BattleTimelineEvent[];

  const fakeRoom = {
    controller: {
      getBoardPlacementsForPlayer: () => [],
      getTestAccess: () => ({
        battleInputSnapshotByPlayer: new Map<string, BoardUnitPlacement[]>(),
        battleResultsByPlayer: new Map([
          ["p1", {
            survivors: 1,
            timeline: latestTimeline,
            survivorSnapshots: [],
          }],
          ["p2", {
            survivors: 0,
            timeline: latestTimeline,
            survivorSnapshots: [],
          }],
        ]),
      }),
    },
  } as unknown as BotOnlyServerRoom;

  const snapshot: BotOnlyRoundSnapshot = {
    roundIndex: 1,
    phaseAfterRound: "Elimination",
    phaseProgress: {
      phaseHpTarget: 600,
      phaseDamageDealt: 600,
      phaseResult: "failed",
      phaseCompletionRate: 1,
    },
    playersAtBattleStart: [],
    battleTimelines: [{
      playerId: "p1",
      battleId: "r1-p1-p2",
      timeline: roundOneTimeline,
    }, {
      playerId: "p2",
      battleId: "r1-p1-p2",
      timeline: roundOneTimeline,
    }],
    playerConsequences: [],
    playersAfterRound: [{
      playerId: "p1",
      role: "boss",
      hp: 100,
      remainingLives: 0,
      eliminated: false,
      boardUnits: [],
      benchUnits: [],
      lastBattle: {
        battleId: "r1-p1-p2",
        opponentId: "p2",
        won: true,
        damageDealt: 7,
        damageTaken: 0,
        survivors: 1,
        opponentSurvivors: 0,
        survivorUnitTypes: [],
        timeline: roundOneTimeline,
      },
    }, {
      playerId: "p2",
      role: "raid",
      hp: 100,
      remainingLives: 1,
      eliminated: false,
      boardUnits: [],
      benchUnits: [],
      lastBattle: {
        battleId: "r1-p1-p2",
        opponentId: "p1",
        won: false,
        damageDealt: 0,
        damageTaken: 7,
        survivors: 0,
        opponentSurvivors: 1,
        survivorUnitTypes: [],
        timeline: roundOneTimeline,
      },
    }],
  };

  expect(
    resolveBattleTimelineForReportBattle(fakeRoom, snapshot, {
      leftPlayerId: "p1",
      rightPlayerId: "p2",
    }),
  ).toBe(roundOneTimeline);
});

test("resolveBattleTimelineForReportBattle prefers rawTimeline from controller battle results", () => {
  const scaledTimeline = [{
    type: "battleStart",
    battleId: "r1-p1-p2-scaled",
    round: 1,
    boardConfig: {
      width: 6,
      height: 6,
    },
    units: [],
  }] as unknown as BattleTimelineEvent[];
  const rawTimeline = [{
    type: "battleStart",
    battleId: "r1-p1-p2-raw",
    round: 1,
    boardConfig: {
      width: 6,
      height: 6,
    },
    units: [],
  }] as unknown as BattleTimelineEvent[];

  const fakeRoom = {
    controller: {
      getBoardPlacementsForPlayer: () => [],
      getTestAccess: () => ({
        battleInputSnapshotByPlayer: new Map<string, BoardUnitPlacement[]>(),
        battleResultsByPlayer: new Map([
          ["p1", {
            survivors: 1,
            timeline: scaledTimeline,
            rawTimeline,
            survivorSnapshots: [],
          }],
          ["p2", {
            survivors: 0,
            timeline: scaledTimeline,
            rawTimeline,
            survivorSnapshots: [],
          }],
        ]),
      }),
    },
  } as unknown as BotOnlyServerRoom;

  expect(
    resolveBattleTimelineForReportBattle(fakeRoom, undefined, {
      leftPlayerId: "p1",
      rightPlayerId: "p2",
    }),
  ).toBe(rawTimeline);
});

test("captureBattleTimelinesForRound stores rawTimeline when available", () => {
  const scaledTimeline = [{
    type: "battleStart",
    battleId: "scaled",
    round: 1,
    boardConfig: {
      width: 6,
      height: 6,
    },
    units: [],
  }] as unknown as BattleTimelineEvent[];
  const rawTimeline = [{
    type: "battleStart",
    battleId: "raw",
    round: 1,
    boardConfig: {
      width: 6,
      height: 6,
    },
    units: [],
  }] as unknown as BattleTimelineEvent[];

  const fakeRoom = {
    controller: {
      getTestAccess: () => ({
        battleInputSnapshotByPlayer: new Map<string, BoardUnitPlacement[]>(),
        battleResultsByPlayer: new Map([
          ["p1", {
            survivors: 1,
            timeline: scaledTimeline,
            rawTimeline,
            survivorSnapshots: [],
          }],
        ]),
      }),
    },
  } as unknown as BotOnlyServerRoom;

  expect(captureBattleTimelinesForRound(fakeRoom, [{
    sessionId: "p1",
  }] as BotOnlyTestClient[])).toEqual([{
    playerId: "p1",
    battleId: "raw",
    timeline: rawTimeline,
  }]);
});

test("buildBotOnlyMatchRoundReport prefers captured round battle details over recomputing from latest state", () => {
  const fastParityTimings = createFastParityGameRoomOptions({ timeScale: 0.02 });
  const snapshotBattle: BotOnlyRoundBattleReport = {
    battleIndex: 0,
    leftPlayerId: "boss-1",
    leftLabel: "P1",
    rightPlayerId: "raid-1",
    rightLabel: "P2",
    leftSpecialUnits: ["レミリア"],
    rightSpecialUnits: ["霊夢"],
    winner: "left",
    leftDamageDealt: 7,
    rightDamageDealt: 0,
    leftSurvivors: 1,
    rightSurvivors: 0,
    unitDamageBreakdown: [],
    unitOutcomes: [{
      playerId: "boss-1",
      label: "P1",
      unitId: "round1-boss",
      unitName: "Round1Boss",
      side: "boss",
      totalDamage: 100,
      phaseContributionDamage: 0,
      finalHp: 50,
      alive: true,
      unitLevel: 1,
      subUnitName: "",
      isSpecialUnit: false,
    }],
  };

  const fakeRoom = {
    readyAutoStartMs: fastParityTimings.readyAutoStartMs,
    prepDurationMs: fastParityTimings.prepDurationMs,
    battleDurationMs: fastParityTimings.battleDurationMs,
    settleDurationMs: fastParityTimings.settleDurationMs,
    eliminationDurationMs: fastParityTimings.eliminationDurationMs,
    selectionTimeoutMs: fastParityTimings.selectionTimeoutMs,
    battleTimelineTimeScale: fastParityTimings.battleTimelineTimeScale,
    state: {
      roundIndex: 1,
      bossPlayerId: "boss-1",
      raidPlayerIds: ["raid-1", "raid-2", "raid-3"],
      ranking: ["boss-1", "raid-1", "raid-2", "raid-3"],
      players: new Map([
        ["boss-1", {
          role: "boss",
          hp: 100,
          remainingLives: 0,
          eliminated: false,
          selectedHeroId: "",
          selectedBossId: "remilia",
          benchUnits: [],
        }],
        ["raid-1", {
          role: "raid",
          hp: 100,
          remainingLives: 2,
          eliminated: false,
          selectedHeroId: "reimu",
          selectedBossId: "",
          benchUnits: [],
        }],
        ["raid-2", {
          role: "raid",
          hp: 100,
          remainingLives: 2,
          eliminated: false,
          selectedHeroId: "marisa",
          selectedBossId: "",
          benchUnits: [],
        }],
        ["raid-3", {
          role: "raid",
          hp: 100,
          remainingLives: 2,
          eliminated: false,
          selectedHeroId: "okina",
          selectedBossId: "",
          benchUnits: [],
        }],
      ]),
    },
    matchLogger: {
      getRoundLogs: () => [{
        matchId: "match-1",
        roundIndex: 1,
        phase: "Elimination",
        timestamp: Date.now(),
        durationMs: 100,
        battles: [{
          matchId: "match-1",
          roundIndex: 1,
          battleIndex: 0,
          leftPlayerId: "boss-1",
          rightPlayerId: "raid-1",
          winner: "left",
          leftDamageDealt: 7,
          rightDamageDealt: 0,
          leftSurvivors: 1,
          rightSurvivors: 0,
        }],
        eliminations: [],
      }],
      getHpChangeLogs: () => [],
      getActionLogs: () => [],
    },
    controller: {
      getBoardPlacementsForPlayer: () => [],
      getTestAccess: () => ({
        battleInputSnapshotByPlayer: new Map<string, BoardUnitPlacement[]>(),
        battleResultsByPlayer: new Map([
          ["boss-1", {
            survivors: 1,
            timeline: [{
              type: "battleStart",
              battleId: "r2-battle",
              round: 2,
              boardConfig: { width: 6, height: 6 },
              units: [],
            }] as unknown as BattleTimelineEvent[],
            survivorSnapshots: [],
          }],
        ]),
      }),
    },
  } as unknown as BotOnlyServerRoom;

  const report = buildBotOnlyMatchRoundReport({
    serverRoom: fakeRoom,
    clients: [
      { sessionId: "boss-1" },
      { sessionId: "raid-1" },
      { sessionId: "raid-2" },
      { sessionId: "raid-3" },
    ] as BotOnlyTestClient[],
    roundSnapshots: [{
      roundIndex: 1,
      phaseAfterRound: "Elimination",
      phaseProgress: {
        phaseHpTarget: 600,
        phaseDamageDealt: 350,
        phaseResult: "success",
        phaseCompletionRate: 0.58,
      },
      playersAtBattleStart: [],
      battleTimelines: [],
      battles: [snapshotBattle],
      playerConsequences: [],
      playersAfterRound: [],
    }],
  });

  expect(report.rounds[0]?.battles[0]?.unitOutcomes[0]?.unitName).toBe("Round1Boss");
  expect(report.metadata).toMatchObject({
    mode: "fast-parity",
    timeScale: 0.02,
  });
});

test("buildPlayerConsequences keeps battle-start tracked units after controller snapshots reset", () => {
  const battleResultsByPlayer = new Map([
    ["p1", {
      survivors: 0,
      survivorSnapshots: [],
    }],
  ]);
  const fakeRoom = {
    state: {
      players: new Map([
        ["p1", {
          selectedHeroId: "reimu",
          lastBattleResult: {
            opponentId: "boss",
            won: false,
            damageDealt: 0,
            damageTaken: 7,
            survivors: 0,
            opponentSurvivors: 1,
            survivorSnapshots: [],
          },
        }],
      ]),
    },
    controller: {
      getTestAccess: () => ({
        battleInputSnapshotByPlayer: new Map<string, BoardUnitPlacement[]>(),
        battleResultsByPlayer,
      }),
    },
  } as unknown as BotOnlyServerRoom;

  const result = buildPlayerConsequences(
    [{
      playerId: "p1",
      role: "raid",
      hp: 100,
      remainingLives: 2,
      eliminated: false,
      boardUnits: [{
        cell: 31,
        unitName: "ナズーリン",
        unitType: "ranger",
        unitId: "nazrin",
        unitLevel: 1,
        subUnitName: "",
      }],
      trackedBattleUnitIds: ["nazrin", "hero-p1"],
      benchUnits: [],
      lastBattle: {
        battleId: null,
        opponentId: "",
        won: false,
        damageDealt: 0,
        damageTaken: 0,
        survivors: 0,
        opponentSurvivors: 0,
        survivorUnitTypes: [],
        timeline: [],
      },
    }],
    buildPlayerBattleOutcomes(fakeRoom, [{
      playerId: "p1",
      role: "raid",
      hp: 100,
      remainingLives: 2,
      eliminated: false,
      boardUnits: [{
        cell: 31,
        unitName: "ナズーリン",
        unitType: "ranger",
        unitId: "nazrin",
        unitLevel: 1,
        subUnitName: "",
      }],
      trackedBattleUnitIds: ["nazrin", "hero-p1"],
      benchUnits: [],
      lastBattle: {
        battleId: null,
        opponentId: "",
        won: false,
        damageDealt: 0,
        damageTaken: 0,
        survivors: 0,
        opponentSurvivors: 0,
        survivorUnitTypes: [],
        timeline: [],
      },
    }]),
    [{
      playerId: "p1",
      role: "raid",
      hp: 100,
      remainingLives: 1,
      eliminated: false,
      boardUnits: [],
      benchUnits: [],
      lastBattle: {
        battleId: null,
        opponentId: "boss",
        won: false,
        damageDealt: 0,
        damageTaken: 7,
        survivors: 0,
        opponentSurvivors: 1,
        survivorUnitTypes: [],
        timeline: [],
      },
    }],
  );

  expect(result).toEqual([{
    playerId: "p1",
    role: "raid",
    battleStartUnitCount: 2,
    playerWipedOut: true,
    remainingLivesBefore: 2,
    remainingLivesAfter: 1,
    eliminatedAfter: false,
  }]);
});

test("buildUnitDamageBreakdownForBattle summarizes unit damage from battle timeline", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r1-1",
      round: 1,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 600,
          maxHp: 600,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          sourceUnitId: "nazrin-1",
          side: "raid",
          x: 1,
          y: 0,
          currentHp: 50,
          maxHp: 50,
          displayName: "ナズーリン",
        },
        {
          battleUnitId: "hero-p3",
          side: "raid",
          x: 2,
          y: 0,
          currentHp: 100,
          maxHp: 100,
          displayName: "摩多羅隠岐奈",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r1-1",
      atMs: 100,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "unit-p2-a",
      amount: 20,
      remainingHp: 30,
    } satisfies DamageAppliedEvent,
    {
      type: "damageApplied",
      battleId: "battle-r1-1",
      atMs: 120,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "boss-p1",
      amount: 11,
      remainingHp: 589,
    } satisfies DamageAppliedEvent,
    {
      type: "damageApplied",
      battleId: "battle-r1-1",
      atMs: 150,
      sourceBattleUnitId: "hero-p3",
      targetBattleUnitId: "boss-p1",
      amount: 17,
      remainingHp: 572,
    } satisfies DamageAppliedEvent,
    {
      type: "damageApplied",
      battleId: "battle-r1-1",
      atMs: 160,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "hero-p3",
      amount: 9,
      remainingHp: 91,
    } satisfies DamageAppliedEvent,
  ];
  const playerLabels = new Map([
    ["p1", "P1"],
    ["p2", "P2"],
    ["p3", "P3"],
  ]);

  const result = buildUnitDamageBreakdownForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 600,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r1-1",
          opponentId: "p2",
          won: true,
          damageDealt: 29,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["nazrin-1", "hero-p2"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r1-1",
          opponentId: "p1",
          won: false,
          damageDealt: 11,
          damageTaken: 20,
          survivors: 0,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p3",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["hero-p3"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r1-1",
          opponentId: "p1",
          won: false,
          damageDealt: 17,
          damageTaken: 9,
          survivors: 0,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    playerLabels,
  );

  expect(result).toEqual([
    {
      playerId: "p1",
      label: "P1",
      unitId: "remilia",
      unitName: "レミリア",
      side: "boss",
      totalDamage: 29,
    },
    {
      playerId: "p3",
      label: "P3",
      unitId: "hero-p3",
      unitName: "摩多羅隠岐奈",
      side: "raid",
      totalDamage: 17,
    },
    {
      playerId: "p2",
      label: "P2",
      unitId: "nazrin-1",
      unitName: "ナズーリン",
      side: "raid",
      totalDamage: 11,
    },
  ]);
});

test("buildUnitDamageBreakdownForBattle keeps same-unit damage split by owner player", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r2-1",
      round: 2,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "raid",
          x: 1,
          y: 0,
          currentHp: 50,
          maxHp: 50,
          displayName: "ナズーリン",
        },
        {
          battleUnitId: "unit-p3-a",
          ownerPlayerId: "p3",
          sourceUnitId: "nazrin",
          side: "raid",
          x: 2,
          y: 0,
          currentHp: 50,
          maxHp: 50,
          displayName: "ナズーリン",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r2-1",
      atMs: 100,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "boss-p1",
      amount: 11,
      remainingHp: 589,
    } satisfies DamageAppliedEvent,
    {
      type: "damageApplied",
      battleId: "battle-r2-1",
      atMs: 150,
      sourceBattleUnitId: "unit-p3-a",
      targetBattleUnitId: "boss-p1",
      amount: 17,
      remainingHp: 572,
    } satisfies DamageAppliedEvent,
  ];
  const playerLabels = new Map([
    ["p2", "P2"],
    ["p3", "P3"],
  ]);

  const result = buildUnitDamageBreakdownForBattle(
    timeline,
    [
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["nazrin", "hero-p2"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r2-1",
          opponentId: "p1",
          won: true,
          damageDealt: 11,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p3",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["nazrin", "hero-p3"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r2-1",
          opponentId: "p1",
          won: true,
          damageDealt: 17,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    playerLabels,
  );

  expect(result).toEqual([
    {
      playerId: "p3",
      label: "P3",
      unitId: "nazrin",
      unitName: "ナズーリン",
      side: "raid",
      totalDamage: 17,
    },
    {
      playerId: "p2",
      label: "P2",
      unitId: "nazrin",
      unitName: "ナズーリン",
      side: "raid",
      totalDamage: 11,
    },
  ]);
});

test("buildUnitBattleOutcomesForBattle prefers the final keyframe for alive state and hp", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-1",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "hero-p2",
          ownerPlayerId: "p2",
          sourceUnitId: "reimu",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 120,
          maxHp: 120,
          displayName: "霊夢",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r3-1",
      atMs: 100,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "hero-p2",
      amount: 40,
      remainingHp: 80,
    } satisfies DamageAppliedEvent,
    {
      type: "keyframe",
      battleId: "battle-r3-1",
      atMs: 200,
      units: [
        {
          battleUnitId: "boss-p1",
          x: 0,
          y: 0,
          currentHp: 700,
          maxHp: 900,
          alive: true,
          state: "idle",
        },
        {
          battleUnitId: "hero-p2",
          x: 0,
          y: 5,
          currentHp: 0,
          maxHp: 120,
          alive: false,
          state: "dead",
        },
      ],
    },
  ];
  const playerLabels = new Map([
    ["p1", "P1"],
    ["p2", "P2"],
  ]);

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-1",
          opponentId: "p2",
          won: true,
          damageDealt: 40,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["hero-p2"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-1",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 40,
          survivors: 0,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    playerLabels,
  );

  expect(result).toEqual([
    expect.objectContaining({
      playerId: "p1",
      unitName: "レミリア",
      alive: true,
      finalHp: 700,
      phaseContributionDamage: 0,
    }),
    expect.objectContaining({
      playerId: "p2",
      unitName: "霊夢",
      alive: false,
      finalHp: 0,
      phaseContributionDamage: 0,
    }),
  ]);
});

test("buildUnitBattleOutcomesForBattle tracks attack cadence and lifetime telemetry", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-telemetry",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "hero-p2",
          ownerPlayerId: "p2",
          sourceUnitId: "reimu",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 120,
          maxHp: 120,
          displayName: "霊夢",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "attackStart",
      battleId: "battle-r3-telemetry",
      atMs: 80,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "hero-p2",
    } satisfies AttackStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r3-telemetry",
      atMs: 90,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "hero-p2",
      amount: 30,
      remainingHp: 90,
    } satisfies DamageAppliedEvent,
    {
      type: "attackStart",
      battleId: "battle-r3-telemetry",
      atMs: 120,
      sourceBattleUnitId: "hero-p2",
      targetBattleUnitId: "boss-p1",
    } satisfies AttackStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r3-telemetry",
      atMs: 130,
      sourceBattleUnitId: "hero-p2",
      targetBattleUnitId: "boss-p1",
      amount: 40,
      remainingHp: 860,
    } satisfies DamageAppliedEvent,
    {
      type: "attackStart",
      battleId: "battle-r3-telemetry",
      atMs: 180,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "hero-p2",
    } satisfies AttackStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r3-telemetry",
      atMs: 190,
      sourceBattleUnitId: "boss-p1",
      targetBattleUnitId: "hero-p2",
      amount: 90,
      remainingHp: 0,
    } satisfies DamageAppliedEvent,
    {
      type: "unitDeath",
      battleId: "battle-r3-telemetry",
      atMs: 260,
      battleUnitId: "hero-p2",
    },
    {
      type: "battleEnd",
      battleId: "battle-r3-telemetry",
      atMs: 400,
      winner: "boss",
      endReason: "annihilation",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-telemetry",
          opponentId: "p2",
          won: true,
          damageDealt: 120,
          damageTaken: 40,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["hero-p2"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-telemetry",
          opponentId: "p1",
          won: false,
          damageDealt: 40,
          damageTaken: 120,
          survivors: 0,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual([
    expect.objectContaining({
      playerId: "p1",
      unitName: "レミリア",
      attackCount: 2,
      hitCount: 2,
      damageTaken: 40,
      firstAttackAtMs: 80,
      initialNearestEnemyDistance: 5,
      bestNearestEnemyDistance: 5,
      lifetimeMs: 400,
      battleDurationMs: 400,
    }),
    expect.objectContaining({
      playerId: "p2",
      unitName: "霊夢",
      attackCount: 1,
      hitCount: 1,
      damageTaken: 120,
      firstAttackAtMs: 120,
      initialNearestEnemyDistance: 5,
      bestNearestEnemyDistance: 5,
      lifetimeMs: 260,
      battleDurationMs: 400,
    }),
  ]);
});

test("buildUnitBattleOutcomesForBattle tracks pre-contact and post-contact time buckets", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r4-time-buckets",
      round: 4,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "raid-vanguard-0",
          ownerPlayerId: "p2",
          sourceUnitId: "vanguard",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 80,
          maxHp: 80,
          displayName: "前衛",
        },
        {
          battleUnitId: "boss-ranger-0",
          ownerPlayerId: "p1",
          sourceUnitId: "ranger",
          side: "boss",
          x: 0,
          y: 2,
          currentHp: 50,
          maxHp: 50,
          displayName: "後衛",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r4-time-buckets",
      atMs: 100,
      battleUnitId: "raid-vanguard-0",
      from: { x: 0, y: 5 },
      to: { x: 0, y: 4 },
    } satisfies MoveEvent,
    {
      type: "move",
      battleId: "battle-r4-time-buckets",
      atMs: 200,
      battleUnitId: "raid-vanguard-0",
      from: { x: 0, y: 4 },
      to: { x: 0, y: 3 },
    } satisfies MoveEvent,
    {
      type: "attackStart",
      battleId: "battle-r4-time-buckets",
      atMs: 500,
      sourceBattleUnitId: "raid-vanguard-0",
      targetBattleUnitId: "boss-ranger-0",
    } satisfies AttackStartEvent,
    {
      type: "battleEnd",
      battleId: "battle-r4-time-buckets",
      atMs: 1_000,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [{
          cell: 12,
          unitName: "後衛",
          unitType: "ranger",
          unitId: "ranger",
          unitLevel: 1,
          subUnitName: "",
        }],
        trackedBattleUnitIds: ["boss-ranger-0"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r4-time-buckets",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [{
          cell: 30,
          unitName: "前衛",
          unitType: "vanguard",
          unitId: "vanguard",
          unitLevel: 1,
          subUnitName: "",
        }],
        trackedBattleUnitIds: ["raid-vanguard-0"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r4-time-buckets",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      unitName: "前衛",
      outsideAttackRangeBeforeFirstAttackMs: 200,
      inAttackRangeBeforeFirstAttackMs: 300,
      afterFirstAttackMs: 500,
      firstReachedAttackRangeAtMs: 200,
      lifetimeMs: 1000,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle tracks initial and best nearest-enemy distance", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-distance",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "ナズーリン",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r3-distance",
      atMs: 20,
      battleUnitId: "unit-p2-a",
      from: { x: 0, y: 5 },
      to: { x: 0, y: 4 },
    } satisfies MoveEvent,
    {
      type: "move",
      battleId: "battle-r3-distance",
      atMs: 40,
      battleUnitId: "unit-p2-a",
      from: { x: 0, y: 4 },
      to: { x: 0, y: 3 },
    } satisfies MoveEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-distance",
      atMs: 80,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-distance",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-distance",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual([
    expect.objectContaining({
      playerId: "p1",
      unitName: "レミリア",
      initialNearestEnemyDistance: 5,
      bestNearestEnemyDistance: 3,
      attackCount: 0,
    }),
    expect.objectContaining({
      playerId: "p2",
      unitName: "ナズーリン",
      initialNearestEnemyDistance: 5,
      bestNearestEnemyDistance: 3,
      attackCount: 0,
    }),
  ]);
});

test("buildUnitBattleOutcomesForBattle tracks move target mismatch diagnostics", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-move-diagnostics",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "ナズーリン",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r3-move-diagnostics",
      atMs: 20,
      battleUnitId: "unit-p2-a",
      from: { x: 0, y: 5 },
      to: { x: 0, y: 4 },
      pursuedTargetBattleUnitId: "boss-p1",
      bestApproachTargetBattleUnitId: "boss-p1-alt",
      pursuedTargetRequiredStepsBeforeMove: 6,
      bestApproachTargetRequiredStepsBeforeMove: 4,
    } satisfies MoveEvent,
    {
      type: "move",
      battleId: "battle-r3-move-diagnostics",
      atMs: 40,
      battleUnitId: "unit-p2-a",
      from: { x: 0, y: 4 },
      to: { x: 0, y: 3 },
      pursuedTargetBattleUnitId: "boss-p1",
      bestApproachTargetBattleUnitId: "boss-p1",
      pursuedTargetRequiredStepsBeforeMove: 5,
      bestApproachTargetRequiredStepsBeforeMove: 5,
    } satisfies MoveEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-move-diagnostics",
      atMs: 80,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-move-diagnostics",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-move-diagnostics",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual([
    expect.objectContaining({
      playerId: "p1",
      moveTargetDiagnosticSampleCount: 0,
      suboptimalMoveTargetCount: 0,
      totalExcessApproachSteps: 0,
      sameColumnFrontAllyCount: 0,
    }),
    expect.objectContaining({
      playerId: "p2",
      moveTargetDiagnosticSampleCount: 2,
      suboptimalMoveTargetCount: 1,
      totalExcessApproachSteps: 2,
      sameColumnFrontAllyCount: 0,
    }),
  ]);
});

test("buildUnitBattleOutcomesForBattle tracks planned approach destination diagnostics", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-planned-approach",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-target",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 2,
          y: 2,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "yoshika",
          side: "raid",
          x: 2,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "宮古芳香",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r3-planned-approach",
      atMs: 0,
      battleUnitId: "unit-p2-a",
      from: { x: 2, y: 5 },
      to: { x: 3, y: 5 },
      pursuedTargetBattleUnitId: "boss-target",
      bestApproachTargetBattleUnitId: "boss-target",
      plannedApproachGroupTargetBattleUnitId: "boss-target",
      plannedApproachGroupCompetitorCountBeforeMove: 3,
      plannedApproachGroupAssignedCountBeforeMove: 2,
      plannedApproachTargetBattleUnitId: "boss-target",
      plannedApproachDestinationStillOpenBeforeMove: true,
      usedPlannedApproachDestination: true,
      plannedApproachDestinationPathBlockedBeforeMove: false,
    } satisfies MoveEvent,
    {
      type: "move",
      battleId: "battle-r3-planned-approach",
      atMs: 20,
      battleUnitId: "unit-p2-a",
      from: { x: 3, y: 5 },
      to: { x: 3, y: 4 },
      pursuedTargetBattleUnitId: "boss-target",
      bestApproachTargetBattleUnitId: "boss-target",
      plannedApproachGroupTargetBattleUnitId: "boss-target",
      plannedApproachGroupCompetitorCountBeforeMove: 3,
      plannedApproachGroupAssignedCountBeforeMove: 2,
      plannedApproachTargetBattleUnitId: "boss-target",
      plannedApproachDestinationStillOpenBeforeMove: true,
      usedPlannedApproachDestination: true,
      plannedApproachDestinationPathBlockedBeforeMove: true,
      plannedApproachDestinationPathBlockerTypeBeforeMove: "ally_adjacent",
    } satisfies MoveEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-planned-approach",
      atMs: 80,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-target"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-planned-approach",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-planned-approach",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      plannedApproachGroupMoveSampleCount: 2,
      totalPlannedApproachGroupCompetitorCount: 6,
      totalPlannedApproachGroupAssignedCount: 4,
      oversubscribedPlannedApproachGroupMoveCount: 2,
      plannedApproachMoveSampleCount: 2,
      plannedApproachStillOpenMoveCount: 2,
      usedPlannedApproachMoveCount: 2,
      plannedApproachPathBlockedMoveCount: 1,
      plannedApproachNoAttackTargetDiedBeforeBattleEndCount: 0,
      plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveCount: 1,
      plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: 0,
      plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount: 1,
      plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount: 1,
      plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount: 0,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle tracks planned approach route choke subtypes", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-planned-approach-route-choke",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-target",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 2,
          y: 2,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "yoshika",
          side: "raid",
          x: 2,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "宮古芳香",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r3-planned-approach-route-choke",
      atMs: 0,
      battleUnitId: "unit-p2-a",
      from: { x: 2, y: 5 },
      to: { x: 3, y: 5 },
      pursuedTargetBattleUnitId: "boss-target",
      bestApproachTargetBattleUnitId: "boss-target",
      plannedApproachTargetBattleUnitId: "boss-target",
      plannedApproachDestinationStillOpenBeforeMove: true,
      usedPlannedApproachDestination: true,
      plannedApproachDestinationPathBlockedBeforeMove: true,
      plannedApproachDestinationPathBlockerTypeBeforeMove: "route_choke",
      plannedApproachDestinationRouteChokeTypeBeforeMove: "ally_frontier",
    } satisfies MoveEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-planned-approach-route-choke",
      atMs: 80,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-target"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-planned-approach-route-choke",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-planned-approach-route-choke",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      plannedApproachNoReachNoAttackWhileTargetAliveCount: 1,
      plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount: 1,
      plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount: 1,
      plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount: 1,
      plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount: 0,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle tracks planned approach target death before no-attack battle end", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-planned-approach-target-death",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-target",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 2,
          y: 2,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "yoshika",
          side: "raid",
          x: 2,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "宮古芳香",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r3-planned-approach-target-death",
      atMs: 0,
      battleUnitId: "unit-p2-a",
      from: { x: 2, y: 5 },
      to: { x: 3, y: 5 },
      plannedApproachTargetBattleUnitId: "boss-target",
      plannedApproachDestinationStillOpenBeforeMove: true,
      usedPlannedApproachDestination: true,
    } satisfies MoveEvent,
    {
      type: "damageApplied",
      battleId: "battle-r3-planned-approach-target-death",
      atMs: 30,
      sourceBattleUnitId: "ally-finisher",
      targetBattleUnitId: "boss-target",
      amount: 900,
      remainingHp: 0,
    } satisfies DamageAppliedEvent,
    {
      type: "unitDeath",
      battleId: "battle-r3-planned-approach-target-death",
      atMs: 30,
      battleUnitId: "boss-target",
    } satisfies UnitDeathEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-planned-approach-target-death",
      atMs: 80,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-target"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-planned-approach-target-death",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 0,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-planned-approach-target-death",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      plannedApproachMoveSampleCount: 1,
      plannedApproachNoAttackTargetDiedBeforeBattleEndCount: 1,
      plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveCount: 0,
      plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: 0,
      plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount: 0,
      plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount: 0,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle tracks same-column front ally count", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-front-ally-count",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "raid-front",
          ownerPlayerId: "p2",
          sourceUnitId: "yoshika",
          side: "raid",
          x: 0,
          y: 3,
          currentHp: 450,
          maxHp: 450,
          displayName: "宮古芳香",
        },
        {
          battleUnitId: "raid-back",
          ownerPlayerId: "p2",
          sourceUnitId: "rin",
          side: "raid",
          x: 0,
          y: 4,
          currentHp: 450,
          maxHp: 450,
          displayName: "火焔猫燐",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-front-ally-count",
      atMs: 100,
      winner: "draw",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-front-ally-count",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 2,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["raid-front", "raid-back"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-front-ally-count",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 2,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      unitId: "yoshika",
      initialRow: 3,
      initialColumn: 0,
      sameColumnFrontAllyCount: 0,
    }),
    expect.objectContaining({
      unitId: "rin",
      initialRow: 4,
      initialColumn: 0,
      sameColumnFrontAllyCount: 1,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle tracks lateral drift and shared pursuit contention", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r3-lateral-contention",
      round: 3,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-target",
          ownerPlayerId: "p1",
          sourceUnitId: "yoshika",
          side: "boss",
          x: 2,
          y: 2,
          currentHp: 550,
          maxHp: 550,
          displayName: "宮古芳香",
        },
        {
          battleUnitId: "raid-front",
          ownerPlayerId: "p2",
          sourceUnitId: "yoshika",
          side: "raid",
          x: 2,
          y: 4,
          currentHp: 550,
          maxHp: 550,
          displayName: "宮古芳香",
        },
        {
          battleUnitId: "raid-back",
          ownerPlayerId: "p2",
          sourceUnitId: "rin",
          side: "raid",
          x: 2,
          y: 5,
          currentHp: 620,
          maxHp: 620,
          displayName: "火焔猫燐",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "move",
      battleId: "battle-r3-lateral-contention",
      atMs: 0,
      battleUnitId: "raid-front",
      from: { x: 2, y: 4 },
      to: { x: 1, y: 4 },
      pursuedTargetBattleUnitId: "boss-target",
      bestApproachTargetBattleUnitId: "boss-target",
    } satisfies MoveEvent,
    {
      type: "move",
      battleId: "battle-r3-lateral-contention",
      atMs: 0,
      battleUnitId: "raid-back",
      from: { x: 2, y: 5 },
      to: { x: 1, y: 5 },
      pursuedTargetBattleUnitId: "boss-target",
      bestApproachTargetBattleUnitId: "boss-target",
    } satisfies MoveEvent,
    {
      type: "battleEnd",
      battleId: "battle-r3-lateral-contention",
      atMs: 30,
      winner: "boss",
      endReason: "forced",
    } satisfies BattleEndEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-target"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-lateral-contention",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 2,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["raid-front", "raid-back"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r3-lateral-contention",
          opponentId: "p1",
          won: false,
          damageDealt: 0,
          damageTaken: 0,
          survivors: 2,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      unitId: "yoshika",
      lateralLeftMoveCount: 1,
      lateralRightMoveCount: 0,
      firstLateralMoveDirection: "left",
      sharedPursuitMoveSampleCount: 1,
      contestedPursuitMoveSampleCount: 1,
    }),
    expect.objectContaining({
      unitId: "rin",
      lateralLeftMoveCount: 1,
      lateralRightMoveCount: 0,
      firstLateralMoveDirection: "left",
      sharedPursuitMoveSampleCount: 1,
      contestedPursuitMoveSampleCount: 1,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle tracks per-unit phase contribution damage", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r4-1",
      round: 4,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "boss",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "guard-p1-a",
          ownerPlayerId: "p1",
          sourceUnitId: "sakuya",
          side: "boss",
          x: 1,
          y: 0,
          currentHp: 720,
          maxHp: 720,
          displayName: "十六夜咲夜",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "ナズーリン",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r4-1",
      atMs: 100,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "boss-p1",
      amount: 120,
      remainingHp: 780,
    } satisfies DamageAppliedEvent,
    {
      type: "damageApplied",
      battleId: "battle-r4-1",
      atMs: 140,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "guard-p1-a",
      amount: 800,
      remainingHp: 0,
    } satisfies DamageAppliedEvent,
    {
      type: "unitDeath",
      battleId: "battle-r4-1",
      atMs: 150,
      battleUnitId: "guard-p1-a",
    },
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1", "guard-p1-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r4-1",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 920,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r4-1",
          opponentId: "p1",
          won: true,
          damageDealt: 920,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      unitName: "ナズーリン",
      totalDamage: 920,
      phaseContributionDamage: 480,
    }),
    expect.objectContaining({
      playerId: "p1",
      unitName: "レミリア",
      phaseContributionDamage: 0,
    }),
    expect.objectContaining({
      playerId: "p1",
      unitName: "十六夜咲夜",
      phaseContributionDamage: 0,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle uses owner player role instead of timeline side for phase contribution", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r5-1",
      round: 5,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "boss-p1",
          ownerPlayerId: "p1",
          sourceUnitId: "remilia",
          side: "raid",
          x: 0,
          y: 0,
          currentHp: 900,
          maxHp: 900,
          displayName: "レミリア",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "boss",
          x: 0,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "ナズーリン",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r5-1",
      atMs: 100,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "boss-p1",
      amount: 250,
      remainingHp: 650,
    } satisfies DamageAppliedEvent,
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["boss-p1"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r5-1",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 250,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r5-1",
          opponentId: "p1",
          won: true,
          damageDealt: 250,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      unitName: "ナズーリン",
      phaseContributionDamage: 250,
    }),
    expect.objectContaining({
      playerId: "p1",
      unitName: "レミリア",
      phaseContributionDamage: 0,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle uses owner player role for boss-side escort defeat bonus", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r6-1",
      round: 6,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "guard-p1-a",
          ownerPlayerId: "p1",
          sourceUnitId: "meiling",
          side: "raid",
          x: 1,
          y: 0,
          currentHp: 850,
          maxHp: 850,
          displayName: "紅美鈴",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "boss",
          x: 0,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "ナズーリン",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r6-1",
      atMs: 100,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "guard-p1-a",
      amount: 900,
      remainingHp: 0,
    } satisfies DamageAppliedEvent,
    {
      type: "unitDeath",
      battleId: "battle-r6-1",
      atMs: 120,
      battleUnitId: "guard-p1-a",
    },
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["guard-p1-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r6-1",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 900,
          survivors: 0,
          opponentSurvivors: 1,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r6-1",
          opponentId: "p1",
          won: true,
          damageDealt: 900,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      unitName: "ナズーリン",
      phaseContributionDamage: Math.floor(850 / 2),
    }),
    expect.objectContaining({
      playerId: "p1",
      unitName: "紅美鈴",
      phaseContributionDamage: 0,
    }),
  ]));
});

test("buildUnitBattleOutcomesForBattle distributes boss-side escort defeat bonus across raid contributors", () => {
  const timeline: BattleTimelineEvent[] = [
    {
      type: "battleStart",
      battleId: "battle-r6-2",
      round: 6,
      boardConfig: { width: 6, height: 6 },
      units: [
        {
          battleUnitId: "guard-p1-a",
          ownerPlayerId: "p1",
          sourceUnitId: "meiling",
          side: "boss",
          x: 1,
          y: 0,
          currentHp: 800,
          maxHp: 800,
          displayName: "紅美鈴",
        },
        {
          battleUnitId: "unit-p2-a",
          ownerPlayerId: "p2",
          sourceUnitId: "nazrin",
          side: "raid",
          x: 0,
          y: 5,
          currentHp: 450,
          maxHp: 450,
          displayName: "ナズーリン",
        },
        {
          battleUnitId: "unit-p3-a",
          ownerPlayerId: "p3",
          sourceUnitId: "rin",
          side: "raid",
          x: 2,
          y: 5,
          currentHp: 420,
          maxHp: 420,
          displayName: "火焔猫燐",
        },
      ],
    } satisfies BattleStartEvent,
    {
      type: "damageApplied",
      battleId: "battle-r6-2",
      atMs: 100,
      sourceBattleUnitId: "unit-p2-a",
      targetBattleUnitId: "guard-p1-a",
      amount: 300,
      remainingHp: 500,
    } satisfies DamageAppliedEvent,
    {
      type: "damageApplied",
      battleId: "battle-r6-2",
      atMs: 180,
      sourceBattleUnitId: "unit-p3-a",
      targetBattleUnitId: "guard-p1-a",
      amount: 500,
      remainingHp: 0,
    } satisfies DamageAppliedEvent,
    {
      type: "unitDeath",
      battleId: "battle-r6-2",
      atMs: 200,
      battleUnitId: "guard-p1-a",
    },
  ];

  const result = buildUnitBattleOutcomesForBattle(
    timeline,
    [
      {
        playerId: "p1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["guard-p1-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r6-2",
          opponentId: "p2",
          won: false,
          damageDealt: 0,
          damageTaken: 800,
          survivors: 0,
          opponentSurvivors: 2,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p2",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p2-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r6-2",
          opponentId: "p1",
          won: true,
          damageDealt: 300,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
      {
        playerId: "p3",
        role: "raid",
        hp: 100,
        remainingLives: 2,
        eliminated: false,
        boardUnits: [],
        trackedBattleUnitIds: ["unit-p3-a"],
        benchUnits: [],
        lastBattle: {
          battleId: "battle-r6-2",
          opponentId: "p1",
          won: true,
          damageDealt: 500,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorUnitTypes: [],
          timeline,
        },
      },
    ],
    new Map([
      ["p1", "P1"],
      ["p2", "P2"],
      ["p3", "P3"],
    ]),
  );

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      playerId: "p2",
      unitName: "ナズーリン",
      phaseContributionDamage: 150,
    }),
    expect.objectContaining({
      playerId: "p3",
      unitName: "火焔猫燐",
      phaseContributionDamage: 250,
    }),
  ]));
});

const runBotOnlyHelperMatch = async (
  connectClient: (serverRoom: BotOnlyServerRoom) => Promise<BotOnlyTestClient>,
  createRoom: () => Promise<BotOnlyServerRoom>,
  damageTargets?: Record<number, number>,
  helperConfigs?: Array<{ wantsBoss: boolean; policy: "strength" | "growth" }>,
): Promise<BotOnlyMatchArtifacts> => {
  const serverRoom = await createRoom();
  const clients = await Promise.all([
    connectClient(serverRoom),
    connectClient(serverRoom),
    connectClient(serverRoom),
    connectClient(serverRoom),
  ]);
  const playerLabels = getPlayerLabelMap(clients);
  const roundSnapshots: BotOnlyRoundSnapshot[] = [];

    clients.forEach((client, helperIndex) => {
      attachAutoFillHelperAutomationForTest(client, helperIndex);
    });

  await waitForCondition(() => serverRoom.state.phase === "Prep", 2_000, {
    timeoutMessage: `Timed out while waiting for initial Prep phase (phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex})`,
  });

  const startTime = Date.now();
  const maxDurationMs = 20_000;
  let lastCapturedRoundIndex = 0;

  while (serverRoom.state.phase !== "End" && Date.now() - startTime < maxDurationMs) {
    await waitForCondition(() => serverRoom.state.phase === "Battle", 2_000, {
      timeoutMessage: `Timed out while waiting for Battle phase (phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex})`,
    });
    const battleRoundIndex = serverRoom.state.roundIndex;
    const battlePhaseDeadlineAtMs = Number.isFinite(serverRoom.state.phaseDeadlineAtMs)
      ? serverRoom.state.phaseDeadlineAtMs
      : null;
    const battlePhaseRemainingAtStartMs = resolveRemainingTimeFromDeadlineAtMs(battlePhaseDeadlineAtMs);
    const playersAtBattleStart = captureRoundPlayers(
      serverRoom,
      clients,
      getReportBattleStartUnitsForPlayer,
    ).map((player) => ({
      ...player,
      trackedBattleUnitIds: getTrackedBattleUnitIdsForPlayerAtBattleStart(
        serverRoom,
        player.playerId,
      ),
    }));

    const phaseDamage = damageTargets?.[serverRoom.state.roundIndex];
    if (typeof phaseDamage === "number") {
      serverRoom.setPendingPhaseDamageForTest(phaseDamage);
    }

    await waitForCondition(
      () =>
        getBotOnlyPhasePriority(serverRoom.state.phase) >= BOT_ONLY_PHASE_PRIORITY.Settle
        || serverRoom.state.roundIndex > battleRoundIndex,
      maxDurationMs,
      {
        timeoutMessage:
          `Timed out while waiting for Settle or later `
          + `(phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex}, battleRound=${battleRoundIndex})`,
      },
    );
    const playerBattleOutcomes = buildPlayerBattleOutcomes(serverRoom, playersAtBattleStart);
    const battleTimelines = captureBattleTimelinesForRound(serverRoom, clients);
    const battlePhaseRemainingAtCaptureMs = resolveRemainingTimeFromDeadlineAtMs(battlePhaseDeadlineAtMs);
    const battlePhaseElapsedMs = resolveBattlePhaseElapsedMs(
      battlePhaseRemainingAtStartMs,
      battlePhaseRemainingAtCaptureMs,
    );
    const battles = buildRoundBattleReportsFromCurrentState(
      serverRoom,
      battleRoundIndex,
      playersAtBattleStart,
      playerLabels,
      battlePhaseElapsedMs,
    );
    const phaseProgress = buildRoundPhaseProgress(getCurrentControllerPhaseProgress(serverRoom));

    await waitForCondition(
      () =>
        serverRoom.state.phase === "Prep"
        || serverRoom.state.phase === "End"
        || serverRoom.state.roundIndex > battleRoundIndex,
      maxDurationMs,
      {
        timeoutMessage:
          `Timed out while waiting for next Prep/End `
          + `(phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex}, battleRound=${battleRoundIndex})`,
      },
    );
    const playersAfterRound = captureRoundPlayers(
      serverRoom,
      clients,
      getReportBoardUnitsForPlayer,
    );

    const snapshot: BotOnlyRoundSnapshot = {
      roundIndex: battleRoundIndex,
      phaseAfterRound: serverRoom.state.phase,
      ...(battlePhaseElapsedMs !== undefined ? { battlePhaseElapsedMs } : {}),
      phaseProgress,
      playersAtBattleStart,
      battleTimelines,
      battles,
      playerConsequences: buildPlayerConsequences(
        playersAtBattleStart,
        playerBattleOutcomes,
        playersAfterRound,
      ),
      playersAfterRound,
    };

    if (shouldLogBotOnlyJsonReport()) {
      console.log(JSON.stringify({
        type: "bot_only_round_snapshot",
        data: snapshot,
      }));
    }

    if (snapshot.roundIndex > lastCapturedRoundIndex) {
      roundSnapshots.push(snapshot);
      lastCapturedRoundIndex = snapshot.roundIndex;
    }
  }

  return {
    serverRoom,
    clients,
    roundSnapshots,
  };
};

const buildBotOnlyFinalPlayers = (
  serverRoom: BotOnlyServerRoom,
  clients: BotOnlyTestClient[],
  playerLabels: Map<string, string>,
): BotOnlyBaselineFinalPlayer[] => {
  const ranking = Array.from(serverRoom.state.ranking) as string[];
  const finalPlayerEconomyByPlayer = buildBotOnlyFinalPlayerEconomyByPlayer(serverRoom);

  return clients.map((client) => {
    const player = serverRoom.state.players.get(client.sessionId);
    if (!player) {
      throw new Error(`Expected final player state for ${client.sessionId}`);
    }
    const economy = finalPlayerEconomyByPlayer.get(client.sessionId) ?? {
      totalGoldEarned: 0,
      totalGoldSpent: 0,
      purchaseCount: 0,
      refreshCount: 0,
      sellCount: 0,
    };

    return {
      playerId: client.sessionId,
      label: getPlayerLabel(playerLabels, client.sessionId),
      role: player.role,
      hp: player.hp,
      gold: player.gold,
      remainingLives: player.remainingLives,
      eliminated: player.eliminated,
      rank: ranking.indexOf(client.sessionId) + 1,
      selectedHeroId: player.selectedHeroId,
      selectedBossId: player.selectedBossId,
      totalGoldEarned: economy.totalGoldEarned,
      totalGoldSpent: economy.totalGoldSpent,
      purchaseCount: economy.purchaseCount,
      refreshCount: economy.refreshCount,
      sellCount: economy.sellCount,
      boardUnits: getReportBoardUnitsForPlayer(serverRoom, client.sessionId),
    };
  });
};

const buildBotOnlyFinalPlayerEconomyByPlayer = (
  serverRoom: BotOnlyServerRoom,
): Map<string, BotOnlyFinalPlayerEconomySnapshot> => {
  const economyByPlayer = new Map<string, BotOnlyFinalPlayerEconomySnapshot>();

  for (const actionLog of getMatchLogger(serverRoom).getActionLogs()) {
    const current = economyByPlayer.get(actionLog.playerId) ?? {
      totalGoldEarned: 0,
      totalGoldSpent: 0,
      purchaseCount: 0,
      refreshCount: 0,
      sellCount: 0,
    };

    if (actionLog.details.goldAfter > actionLog.details.goldBefore) {
      current.totalGoldEarned += actionLog.details.goldAfter - actionLog.details.goldBefore;
    } else if (actionLog.details.goldAfter < actionLog.details.goldBefore) {
      current.totalGoldSpent += actionLog.details.goldBefore - actionLog.details.goldAfter;
    }

    switch (actionLog.actionType) {
      case "buy_unit":
      case "buy_boss_unit":
        current.purchaseCount += 1;
        break;
      case "shop_refresh":
        current.refreshCount += 1;
        break;
      case "sell_unit":
      case "board_sell":
        current.sellCount += 1;
        break;
      default:
        break;
    }

    economyByPlayer.set(actionLog.playerId, current);
  }

  return economyByPlayer;
};

const buildBotOnlyBaselinePurchases = (
  serverRoom: BotOnlyServerRoom,
  playerLabels: Map<string, string>,
): BotOnlyBaselinePurchase[] => {
  const purchases: BotOnlyBaselinePurchase[] = [];

  for (const actionLog of getMatchLogger(serverRoom).getActionLogs()) {
    if (actionLog.actionType !== "buy_unit" && actionLog.actionType !== "buy_boss_unit") {
      continue;
    }

    purchases.push({
      playerId: actionLog.playerId,
      label: getPlayerLabel(playerLabels, actionLog.playerId),
      actionType: actionLog.actionType,
      unitType: typeof actionLog.details.unitType === "string" ? actionLog.details.unitType : "",
      cost: typeof actionLog.details.cost === "number" ? actionLog.details.cost : 0,
    });
  }

  return purchases;
};

const runBotOnlyHelperMatchForBaseline = async (
  connectClient: (serverRoom: BotOnlyServerRoom) => Promise<BotOnlyTestClient>,
  createRoom: () => Promise<BotOnlyServerRoom>,
  damageTargets?: Record<number, number>,
  helperConfigs?: Array<{ wantsBoss: boolean; policy: "strength" | "growth" }>,
  matchIndex = 0,
): Promise<BotOnlyBaselineMatchArtifacts> => {
  const serverRoom = await createRoom();
  const clients = await Promise.all([
    connectClient(serverRoom),
    connectClient(serverRoom),
    connectClient(serverRoom),
    connectClient(serverRoom),
  ]);
  const playerLabels = getPlayerLabelMap(clients);
  const battles: BotOnlyBaselineBattleSummary[] = [];
  const observedOfferKeySet = new Set<string>();
  const observedOffersByKey = new Map<string, BotOnlyBaselineObservedShopOffer>();

  const recordObservedOffer = (
    client: BotOnlyTestClient,
    state: unknown,
    source: "shop" | "bossShop",
    offers: Iterable<{
      unitId?: string;
      displayName?: string;
      unitType?: string;
      cost?: number;
    }>,
  ) => {
    const typedState = state as {
      roundIndex?: number;
      players?: { get?: (key: string) => unknown };
    } | null;
    const player = typedState?.players?.get?.(client.sessionId) as {
      role?: string;
    } | null;
    const role = player?.role === "boss" ? "boss" : player?.role === "raid" ? "raid" : null;
    if (role === null) {
      return;
    }

    let slotIndex = 0;
    for (const offer of offers) {
      const unitId = typeof offer?.unitId === "string" ? offer.unitId : "";
      const unitType = typeof offer?.unitType === "string" ? offer.unitType : "";
      const cost = typeof offer?.cost === "number" ? offer.cost : 0;
      if (!unitId || !unitType || cost <= 0) {
        slotIndex += 1;
        continue;
      }

      const observationKey = [
        typedState?.roundIndex ?? 0,
        client.sessionId,
        source,
        slotIndex,
        unitId,
        cost,
      ].join(":");
      slotIndex += 1;
      if (observedOfferKeySet.has(observationKey)) {
        continue;
      }
      observedOfferKeySet.add(observationKey);

      const aggregateKey = `${role}:${source}:${unitId}:${cost}`;
      const existing = observedOffersByKey.get(aggregateKey) ?? {
        playerId: client.sessionId,
        label: getPlayerLabel(playerLabels, client.sessionId),
        role,
        source,
        unitId,
        unitName: typeof offer?.displayName === "string" && offer.displayName.length > 0
          ? offer.displayName
          : unitId,
        unitType,
        cost,
        observationCount: 0,
      };
      existing.observationCount += 1;
      observedOffersByKey.set(aggregateKey, existing);
    }
  };

  for (const client of clients) {
    client.onStateChange((state) => {
      const typedState = state as {
        players?: { get?: (key: string) => unknown };
      } | null;
      const player = typedState?.players?.get?.(client.sessionId) as {
        shopOffers?: Iterable<{ unitId?: string; displayName?: string; unitType?: string; cost?: number }>;
        bossShopOffers?: Iterable<{ unitId?: string; displayName?: string; unitType?: string; cost?: number }>;
      } | null;
      if (!player) {
        return;
      }

      recordObservedOffer(client, state, "shop", player.shopOffers ?? []);
      recordObservedOffer(client, state, "bossShop", player.bossShopOffers ?? []);
    });
  }

    clients.forEach((client, helperIndex) => {
      const heroId = AUTO_FILL_HERO_IDS[
        (helperIndex + Math.max(0, Math.trunc(matchIndex))) % AUTO_FILL_HERO_IDS.length
      ];
      attachAutoFillHelperAutomationForTest(client, helperIndex, {
        ...(heroId ? { heroId } : {}),
      });
    });

  await waitForCondition(() => serverRoom.state.phase === "Prep", 2_000, {
    timeoutMessage: `Timed out while waiting for initial Prep phase (phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex})`,
  });

  const startTime = Date.now();
  const maxDurationMs = 20_000;

  while (serverRoom.state.phase !== "End" && Date.now() - startTime < maxDurationMs) {
    await waitForCondition(() => serverRoom.state.phase === "Battle", 2_000, {
      timeoutMessage: `Timed out while waiting for Battle phase (phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex})`,
    });
    const battleRoundIndex = serverRoom.state.roundIndex;
    const playersAtBattleStart = captureRoundPlayers(
      serverRoom,
      clients,
      getReportBattleStartUnitsForPlayer,
    ).map((player) => ({
      ...player,
      trackedBattleUnitIds: getTrackedBattleUnitIdsForPlayerAtBattleStart(
        serverRoom,
        player.playerId,
      ),
    }));

    const phaseDamage = damageTargets?.[serverRoom.state.roundIndex];
    if (typeof phaseDamage === "number") {
      serverRoom.setPendingPhaseDamageForTest(phaseDamage);
    }

    await waitForCondition(
      () =>
        getBotOnlyPhasePriority(serverRoom.state.phase) >= BOT_ONLY_PHASE_PRIORITY.Settle
        || serverRoom.state.roundIndex > battleRoundIndex,
      maxDurationMs,
      {
        timeoutMessage:
          `Timed out while waiting for Settle or later `
          + `(phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex}, battleRound=${battleRoundIndex})`,
      },
    );

    const roundBattles = buildRoundBattleReportsFromCurrentState(
      serverRoom,
      battleRoundIndex,
      playersAtBattleStart,
      playerLabels,
    );
    for (const battle of roundBattles) {
      battles.push({
        leftPlayerId: battle.leftPlayerId,
        rightPlayerId: battle.rightPlayerId,
        winner: battle.winner,
        ...(battle.battleEndReason !== undefined ? { battleEndReason: battle.battleEndReason } : {}),
        ...(typeof battle.bossSurvivors === "number" ? { bossSurvivors: battle.bossSurvivors } : {}),
        ...(typeof battle.raidSurvivors === "number" ? { raidSurvivors: battle.raidSurvivors } : {}),
        unitDamageBreakdown: battle.unitDamageBreakdown.map((unit) => ({ ...unit })),
        unitOutcomes: battle.unitOutcomes.map((unit) => ({ ...unit })),
      });
    }

    await waitForCondition(
      () =>
        serverRoom.state.phase === "Prep"
        || serverRoom.state.phase === "End"
        || serverRoom.state.roundIndex > battleRoundIndex,
      maxDurationMs,
      {
        timeoutMessage:
          `Timed out while waiting for next Prep/End `
          + `(phase=${serverRoom.state.phase}, round=${serverRoom.state.roundIndex}, battleRound=${battleRoundIndex})`,
      },
    );
  }

  return {
    serverRoom,
    clients,
    battles,
    observedShopOffers: Array.from(observedOffersByKey.values()),
  };
};

const buildBotOnlyBaselineMatchSummary = (
  artifacts: BotOnlyBaselineMatchArtifacts,
): BotOnlyBaselineMatchSummary => {
  const playerLabels = getPlayerLabelMap(artifacts.clients);
  const metadata = resolveBotOnlyReportMetadata(artifacts.serverRoom);

  return {
    ...(metadata ? { metadata } : {}),
    totalRounds: artifacts.serverRoom.state.roundIndex,
    bossPlayerId: artifacts.serverRoom.state.bossPlayerId,
    ranking: Array.from(artifacts.serverRoom.state.ranking) as string[],
    playerLabels: Object.fromEntries(playerLabels),
    purchases: buildBotOnlyBaselinePurchases(artifacts.serverRoom, playerLabels),
    observedShopOffers: artifacts.observedShopOffers.map((offer) => ({ ...offer })),
    finalPlayers: buildBotOnlyFinalPlayers(
      artifacts.serverRoom,
      artifacts.clients,
      playerLabels,
    ),
    battles: artifacts.battles.map((battle) => ({
      ...battle,
      unitDamageBreakdown: battle.unitDamageBreakdown.map((unit) => ({ ...unit })),
      unitOutcomes: battle.unitOutcomes.map((unit) => ({ ...unit })),
    })),
  };
};

const buildBotOnlyMatchRoundReport = (
  artifacts: BotOnlyMatchArtifacts,
): BotOnlyMatchRoundReport => {
  const matchLogger = getMatchLogger(artifacts.serverRoom);
  const playerLabels = getPlayerLabelMap(artifacts.clients);
  const metadata = resolveBotOnlyReportMetadata(artifacts.serverRoom);
  const roundLogs = matchLogger.getRoundLogs().sort((left, right) => left.roundIndex - right.roundIndex);
  const hpChangesByRound = new Map<number, ReturnType<MatchLogger["getHpChangeLogs"]>>();
  const purchaseLogsByRound = new Map<number, Array<{
    playerId: string;
    actionType: "buy_unit" | "buy_boss_unit";
    unitType: string;
    goldBefore: number;
    goldAfter: number;
  }>>();
  const deployLogsByRound = new Map<number, Array<{
    playerId: string;
    benchIndex: number | null;
    toCell: number | null;
  }>>();

  for (const hpChange of matchLogger.getHpChangeLogs()) {
    const existing = hpChangesByRound.get(hpChange.roundIndex) ?? [];
    existing.push(hpChange);
    hpChangesByRound.set(hpChange.roundIndex, existing);
  }

  for (const actionLog of matchLogger.getActionLogs()) {
    if (actionLog.actionType !== "buy_unit" && actionLog.actionType !== "buy_boss_unit") {
      if (actionLog.actionType === "deploy") {
        const existing = deployLogsByRound.get(actionLog.roundIndex) ?? [];
        existing.push({
          playerId: actionLog.playerId,
          benchIndex: typeof actionLog.details.benchIndex === "number"
            ? actionLog.details.benchIndex
            : null,
          toCell: typeof actionLog.details.toCell === "number"
            ? actionLog.details.toCell
            : null,
        });
        deployLogsByRound.set(actionLog.roundIndex, existing);
      }
      continue;
    }

    const unitType = typeof actionLog.details.unitType === "string"
      ? actionLog.details.unitType
      : "";
    const existing = purchaseLogsByRound.get(actionLog.roundIndex) ?? [];
    existing.push({
      playerId: actionLog.playerId,
      actionType: actionLog.actionType,
      unitType,
      goldBefore: actionLog.details.goldBefore,
      goldAfter: actionLog.details.goldAfter,
    });
    purchaseLogsByRound.set(actionLog.roundIndex, existing);
  }

  const snapshotsByRound = new Map(
    artifacts.roundSnapshots.map((snapshot) => [snapshot.roundIndex, snapshot]),
  );
  const ranking = Array.from(artifacts.serverRoom.state.ranking) as string[];
  const finalPlayers = buildBotOnlyFinalPlayers(
    artifacts.serverRoom,
    artifacts.clients,
    playerLabels,
  );

  return {
    ...(metadata ? { metadata } : {}),
    totalRounds: artifacts.serverRoom.state.roundIndex,
    bossPlayerId: artifacts.serverRoom.state.bossPlayerId,
    raidPlayerIds: Array.from(artifacts.serverRoom.state.raidPlayerIds),
    ranking,
    playerLabels: Object.fromEntries(playerLabels),
    finalPlayers,
    rounds: roundLogs.map((roundLog) => {
      const snapshot = snapshotsByRound.get(roundLog.roundIndex);
      const battles = snapshot?.battles?.length
        ? snapshot.battles.map((battle) => ({
          ...battle,
          leftSpecialUnits: [...battle.leftSpecialUnits],
          rightSpecialUnits: [...battle.rightSpecialUnits],
          unitDamageBreakdown: battle.unitDamageBreakdown.map((unit) => ({ ...unit })),
          unitOutcomes: battle.unitOutcomes.map((unit) => ({ ...unit })),
        }))
        : roundLog.battles.map((battle) => {
          const timeline = resolveBattleTimelineForReportBattle(
            artifacts.serverRoom,
            snapshot,
            battle,
          );
          return buildRoundBattleReport(
            artifacts.serverRoom,
            battle,
            timeline,
            snapshot?.playersAtBattleStart ?? [],
            playerLabels,
            snapshot?.battlePhaseElapsedMs,
          );
        });

      return {
        roundIndex: roundLog.roundIndex,
        phase: roundLog.phase,
        durationMs: roundLog.durationMs,
        battles,
        hpChanges: (hpChangesByRound.get(roundLog.roundIndex) ?? []).map((hpChange) => ({
          playerId: hpChange.playerId,
          label: getPlayerLabel(playerLabels, hpChange.playerId),
          hpBefore: hpChange.hpBefore,
          hpAfter: hpChange.hpAfter,
          hpChange: hpChange.hpChange,
          reason: hpChange.reason,
        })),
        purchases: (purchaseLogsByRound.get(roundLog.roundIndex) ?? []).map((purchase) => ({
          playerId: purchase.playerId,
          label: getPlayerLabel(playerLabels, purchase.playerId),
          actionType: purchase.actionType,
          unitType: purchase.unitType,
          goldBefore: purchase.goldBefore,
          goldAfter: purchase.goldAfter,
        })),
        deploys: (deployLogsByRound.get(roundLog.roundIndex) ?? []).map((deploy) => ({
          playerId: deploy.playerId,
          label: getPlayerLabel(playerLabels, deploy.playerId),
          benchIndex: deploy.benchIndex,
          toCell: deploy.toCell,
        })),
        phaseHpTarget: snapshot?.phaseProgress.phaseHpTarget ?? 0,
        phaseDamageDealt: snapshot?.phaseProgress.phaseDamageDealt ?? 0,
        phaseResult: snapshot?.phaseProgress.phaseResult ?? "pending",
        phaseCompletionRate: snapshot?.phaseProgress.phaseCompletionRate ?? 0,
        playersAtBattleStart: (snapshot?.playersAtBattleStart ?? []).map((player) => ({
          playerId: player.playerId,
          label: getPlayerLabel(playerLabels, player.playerId),
          role: player.role,
          hp: player.hp,
          remainingLives: player.remainingLives,
          eliminated: player.eliminated,
          boardUnits: player.boardUnits.map((unit) => ({ ...unit })),
          benchUnits: [...player.benchUnits],
        })),
        playerConsequences: (snapshot?.playerConsequences ?? []).map((player) => ({
          playerId: player.playerId,
          label: getPlayerLabel(playerLabels, player.playerId),
          role: player.role,
          battleStartUnitCount: player.battleStartUnitCount,
          playerWipedOut: player.playerWipedOut,
          remainingLivesBefore: player.remainingLivesBefore,
          remainingLivesAfter: player.remainingLivesAfter,
          eliminatedAfter: player.eliminatedAfter,
        })),
        playersAfterRound: (snapshot?.playersAfterRound ?? []).map((player) => ({
          playerId: player.playerId,
          label: getPlayerLabel(playerLabels, player.playerId),
          role: player.role,
          hp: player.hp,
          remainingLives: player.remainingLives,
          eliminated: player.eliminated,
          boardUnits: player.boardUnits.map((unit) => ({ ...unit })),
          benchUnits: [...player.benchUnits],
          lastBattle: {
            opponentId: player.lastBattle.opponentId,
            opponentLabel: getPlayerLabel(playerLabels, player.lastBattle.opponentId),
            won: player.lastBattle.won,
            damageDealt: player.lastBattle.damageDealt,
            damageTaken: player.lastBattle.damageTaken,
            survivors: player.lastBattle.survivors,
            opponentSurvivors: player.lastBattle.opponentSurvivors,
            survivorUnitTypes: [...player.lastBattle.survivorUnitTypes],
          },
        })),
        eliminations: [...roundLog.eliminations],
      };
    }).map((round) => normalizeRoundPhaseContributionDamage(round)),
  };
};

const formatPlayerOutcomeLabel = (
  playerConsequence: BotOnlyMatchRoundReport["rounds"][number]["playerConsequences"][number],
  unitOutcomes: ReportUnitBattleOutcome[],
): string => {
  if (playerConsequence.playerWipedOut) {
    return "撃破";
  }

  if (unitOutcomes.length > 0) {
    return "生存";
  }

  return playerConsequence.remainingLivesAfter > 0 ? "生存" : "撃破";
};

const normalizeRoundPhaseContributionDamage = (
  round: BotOnlyMatchRoundReport["rounds"][number],
): BotOnlyMatchRoundReport["rounds"][number] => {
  const weightedEntries = round.battles.flatMap((battle, battleIndex) =>
    battle.unitOutcomes.flatMap((unit, unitIndex) => (
      unit.side === "raid" && (unit.totalDamage > 0 || unit.phaseContributionDamage > 0)
        ? [{
          battleUnitId: `${battleIndex}::${unitIndex}`,
          weight: Math.max(unit.phaseContributionDamage, unit.totalDamage, 0),
        }]
        : []
    )));

  const distributed = distributeIntegerTotalByWeight(
    Math.max(0, Math.round(round.phaseDamageDealt)),
    weightedEntries,
  );

  return {
    ...round,
    battles: round.battles.map((battle, battleIndex) => ({
      ...battle,
      unitOutcomes: battle.unitOutcomes.map((unit, unitIndex) => {
        if (unit.side !== "raid") {
          return {
            ...unit,
            phaseContributionDamage: 0,
          };
        }

        const key = `${battleIndex}::${unitIndex}`;
        return {
          ...unit,
          phaseContributionDamage: distributed.get(key) ?? 0,
        };
      }),
    })),
  };
};

const formatRoundCompletionLabel = (
  phaseResult: BotOnlyMatchRoundReport["rounds"][number]["phaseResult"],
): string => {
  if (phaseResult === "success") {
    return "ラウンドクリア";
  }

  if (phaseResult === "failed") {
    return "ラウンド失敗";
  }

  return "ラウンド保留";
};

const resolveHumanReadableRoundResultLines = (
  round: BotOnlyMatchRoundReport["rounds"][number],
): string[] => {
  const lines = [`フェーズHP ${round.phaseDamageDealt}/${round.phaseHpTarget}`];
  const raidPlayers = round.playerConsequences.filter((player) => player.role === "raid");
  const allRaidPlayersWipedOut = raidPlayers.length > 0 && raidPlayers.every((player) => player.playerWipedOut);

  if (
    round.phaseResult === "failed"
    && round.phaseDamageDealt >= round.phaseHpTarget
    && allRaidPlayersWipedOut
  ) {
    lines.push("全滅によりラウンド失敗");
    return lines;
  }

  lines.push(formatRoundCompletionLabel(round.phaseResult));
  return lines;
};

const resolveHumanReadableRoundEliminationLabels = (
  report: BotOnlyMatchRoundReport,
  round: BotOnlyMatchRoundReport["rounds"][number],
): string[] => {
  const labels = new Set<string>();

  for (const eliminatedPlayerId of round.eliminations) {
    labels.add(report.playerLabels[eliminatedPlayerId] ?? eliminatedPlayerId);
  }

  for (const player of round.playerConsequences) {
    if (player.eliminatedAfter && player.remainingLivesBefore > 0) {
      labels.add(player.label);
    }
  }

  return [...labels].sort((left, right) => left.localeCompare(right));
};

const shouldLogBotOnlyHumanReport = (): boolean =>
  process.env.DEBUG_BOT_PLAYABILITY_REPORT === "true";

const shouldLogBotOnlyJsonReport = (): boolean =>
  process.env.DEBUG_BOT_PLAYABILITY_JSON === "true";

const getBotOnlyHumanReportOutputPath = (): string | null => {
  const outputPath = process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH?.trim();
  return outputPath && outputPath.length > 0 ? outputPath : null;
};

const isFinalJudgmentRoundForHumanReport = (
  report: BotOnlyMatchRoundReport,
  roundIndex: number,
): boolean => roundIndex === report.totalRounds && report.totalRounds >= 12;

const resolveHumanReadableFinalResultReason = (
  report: BotOnlyMatchRoundReport,
): string => {
  if (report.ranking[0] !== report.bossPlayerId) {
    return `R${report.totalRounds}でボス撃破`;
  }

  const survivingRaidPlayers = report.finalPlayers.filter(
    (player) => player.role === "raid" && !player.eliminated,
  );
  if (survivingRaidPlayers.length === 0) {
    return `R${report.totalRounds}でレイド側全滅`;
  }

  const failedRounds = report.rounds.filter((round) => round.phaseResult === "failed").length;
  if (report.totalRounds < 12 && failedRounds >= 5) {
    return `R${report.totalRounds}で規定回数失敗`;
  }

  if (report.totalRounds >= 12) {
    return `R${report.totalRounds}最終判定でボス勝利`;
  }

  return `R${report.totalRounds}でボス勝利`;
};

const buildBotOnlyHumanReadableRoundReport = (
  report: BotOnlyMatchRoundReport,
): string => {
  const lines: string[] = [];

  if (report.metadata) {
    lines.push(`実行条件 mode=${report.metadata.mode} timeScale=${report.metadata.timeScale}`);
    lines.push(
      `timings ready=${report.metadata.timings.readyAutoStartMs}ms`
      + ` selection=${report.metadata.timings.selectionTimeoutMs}ms`
      + ` prep=${report.metadata.timings.prepDurationMs}ms`
      + ` battle=${report.metadata.timings.battleDurationMs}ms`
      + ` settle=${report.metadata.timings.settleDurationMs}ms`
      + ` elimination=${report.metadata.timings.eliminationDurationMs}ms`,
    );
    lines.push("");
  }

  for (const round of report.rounds) {
    const isFinalJudgmentRound = isFinalJudgmentRoundForHumanReport(report, round.roundIndex);
    const primaryBattle = round.battles[0];
    lines.push(`Round ${round.roundIndex}`);

    if (primaryBattle) {
      const bossUnits = primaryBattle.unitOutcomes.filter((unit) => unit.side === "boss");
      const raidUnitsByPlayer = new Map<string, ReportUnitBattleOutcome[]>();
      const realPlayBattleDurationMs = convertToRealPlayBattleDurationMs(
        primaryBattle.battleDurationMs ?? round.durationMs,
      );

      for (const unit of primaryBattle.unitOutcomes.filter((candidate) => candidate.side === "raid")) {
        const existing = raidUnitsByPlayer.get(unit.playerId) ?? [];
        existing.push(unit);
        raidUnitsByPlayer.set(unit.playerId, existing);
      }

      lines.push("Boss");
      if (realPlayBattleDurationMs !== undefined) {
        lines.push(`バトル時間(実プレイ換算) ${realPlayBattleDurationMs}ms`);
      }
      for (const unit of bossUnits) {
        const subUnitSuffix = unit.subUnitName ? ` サブユニット${unit.subUnitName}` : "";
        lines.push(
          `${unit.unitName} Lv${unit.unitLevel}${subUnitSuffix} 与ダメージ${unit.totalDamage} フェーズ貢献ダメージ${unit.phaseContributionDamage} 最終HP${unit.finalHp}`,
        );
      }

      lines.push("");
      lines.push("raid");
      for (const playerConsequence of round.playerConsequences.filter((player) => player.role === "raid")) {
        const unitOutcomes = raidUnitsByPlayer.get(playerConsequence.playerId) ?? [];
        lines.push(`${playerConsequence.label} ${formatPlayerOutcomeLabel(playerConsequence, unitOutcomes)}`);
        for (const unit of unitOutcomes) {
          const subUnitSuffix = unit.subUnitName ? ` サブユニット${unit.subUnitName}` : "";
          lines.push(
            `${unit.unitName} Lv${unit.unitLevel}${subUnitSuffix} 与ダメージ${unit.totalDamage} フェーズ貢献ダメージ${unit.phaseContributionDamage} 最終HP${unit.finalHp}`,
          );
        }
      }
    }

    lines.push("");
    lines.push(`R${round.roundIndex}リザルト`);
    if (isFinalJudgmentRound) {
      lines.push("最終判定ラウンド");
    } else {
      lines.push(...resolveHumanReadableRoundResultLines(round));
    }
    const eliminationLabels = resolveHumanReadableRoundEliminationLabels(report, round);
    if (eliminationLabels.length > 0) {
      lines.push(`脱落: ${eliminationLabels.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("最終リザルト");
  lines.push(resolveHumanReadableFinalResultReason(report));
  lines.push(report.ranking[0] === report.bossPlayerId ? "ボス勝利" : "レイド勝利");

  return lines.join("\n");
};

test("buildRoundBattleReport records battle end reason and role-based survivor counts", () => {
  const fakeRoom = {
    state: {
      bossPlayerId: "boss-1",
      raidPlayerIds: ["raid-1", "raid-2", "raid-3"],
      players: new Map([
        ["boss-1", { selectedHeroId: "", selectedBossId: "remilia" }],
        ["raid-1", { selectedHeroId: "reimu", selectedBossId: "" }],
        ["raid-2", { selectedHeroId: "", selectedBossId: "" }],
        ["raid-3", { selectedHeroId: "", selectedBossId: "" }],
      ]),
    },
  } as unknown as BotOnlyServerRoom;

  const report = buildRoundBattleReport(
    fakeRoom,
    {
      battleIndex: 0,
      leftPlayerId: "raid-1",
      rightPlayerId: "boss-1",
      winner: "right",
      leftDamageDealt: 100,
      rightDamageDealt: 250,
      leftSurvivors: 2,
      rightSurvivors: 1,
    },
    [{
      type: "battleStart",
      battleId: "battle-1",
      round: 1,
      boardConfig: { width: 6, height: 6 },
      units: [],
    }, {
      type: "battleEnd",
      battleId: "battle-1",
      atMs: 800,
      winner: "boss",
      endReason: "timeout_hp_lead",
    }],
    [],
    new Map([
      ["boss-1", "P1"],
      ["raid-1", "P2"],
    ]),
  );

  expect(report.battleEndReason).toBe("timeout_hp_lead");
  expect(report.bossSurvivors).toBe(1);
  expect(report.raidSurvivors).toBe(2);
});

test("buildBotOnlyHumanReadableRoundReport omits phase hp only on the R12 final judgment round", () => {
  const text = buildBotOnlyHumanReadableRoundReport({
    metadata: {
      mode: "fast-parity",
      timeScale: 0.02,
      timings: {
        readyAutoStartMs: 1_200,
        prepDurationMs: 900,
        battleDurationMs: 800,
        settleDurationMs: 100,
        eliminationDurationMs: 40,
        selectionTimeoutMs: 600,
      },
    },
    totalRounds: 2,
    bossPlayerId: "boss-1",
    raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
    ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
    playerLabels: {
      "boss-1": "P1",
      "raid-a": "P2",
      "raid-b": "P3",
      "raid-c": "P4",
    },
    finalPlayers: [],
    rounds: [{
      roundIndex: 1,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 600,
      phaseDamageDealt: 350,
      phaseResult: "success",
      phaseCompletionRate: 0.58,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    }, {
      roundIndex: 2,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 750,
      phaseDamageDealt: 720,
      phaseResult: "failed",
      phaseCompletionRate: 0.96,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    }],
  });

  expect(text).toContain("実行条件 mode=fast-parity timeScale=0.02");
  expect(text).toContain("R1リザルト\nフェーズHP 350/600\nラウンドクリア");
  expect(text).toContain("R2リザルト\nフェーズHP 720/750\nラウンド失敗");

  const finalJudgmentText = buildBotOnlyHumanReadableRoundReport({
    totalRounds: 12,
    bossPlayerId: "boss-1",
    raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
    ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
    playerLabels: {
      "boss-1": "P1",
      "raid-a": "P2",
      "raid-b": "P3",
      "raid-c": "P4",
    },
    finalPlayers: [],
    rounds: Array.from({ length: 12 }, (_, index) => ({
      roundIndex: index + 1,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 600 + index * 50,
      phaseDamageDealt: 350 + index * 50,
      phaseResult: index === 11 ? "failed" : "success",
      phaseCompletionRate: 1,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    })),
  });

  expect(finalJudgmentText).toContain("R12リザルト\n最終判定ラウンド");
  expect(finalJudgmentText).not.toContain("R12リザルト\nフェーズHP 900/1150");
});

test("buildBotOnlyHumanReadableRoundReport prefers player wipe status for raid outcome labels", () => {
  const text = buildBotOnlyHumanReadableRoundReport({
    totalRounds: 2,
    bossPlayerId: "boss-1",
    raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
    ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
    playerLabels: {
      "boss-1": "P1",
      "raid-a": "P2",
      "raid-b": "P3",
      "raid-c": "P4",
    },
    finalPlayers: [],
    rounds: [{
      roundIndex: 1,
      phase: "Elimination",
      durationMs: 100,
      battles: [{
        battleIndex: 0,
        leftPlayerId: "boss-1",
        leftLabel: "P1",
        rightPlayerId: "raid-a",
        rightLabel: "P2",
        battleDurationMs: 1234,
        leftSpecialUnits: ["レミリア"],
        rightSpecialUnits: ["霊夢"],
        winner: "left",
        leftDamageDealt: 7,
        rightDamageDealt: 0,
        leftSurvivors: 1,
        rightSurvivors: 0,
        unitDamageBreakdown: [],
        unitOutcomes: [{
          playerId: "raid-a",
          label: "P2",
          unitId: "reimu",
          unitName: "霊夢",
          side: "raid",
          totalDamage: 0,
          phaseContributionDamage: 0,
          finalHp: 120,
          alive: true,
          unitLevel: 1,
          subUnitName: "",
          isSpecialUnit: true,
        }],
      }],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 600,
      phaseDamageDealt: 350,
      phaseResult: "success",
      phaseCompletionRate: 0.58,
      playersAtBattleStart: [],
      playerConsequences: [{
        playerId: "raid-a",
        label: "P2",
        role: "raid",
        battleStartUnitCount: 1,
        playerWipedOut: true,
        remainingLivesBefore: 2,
        remainingLivesAfter: 0,
        eliminatedAfter: true,
      }],
      playersAfterRound: [],
      eliminations: [],
    }, {
      roundIndex: 2,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 750,
      phaseDamageDealt: 720,
      phaseResult: "failed",
      phaseCompletionRate: 0.96,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    }],
  });

  expect(text).toContain("Boss");
  expect(text).not.toContain("617000ms");
  expect(text).toContain("P2 撃破");
  expect(text).toContain("霊夢 Lv1 与ダメージ0 フェーズ貢献ダメージ0 最終HP120");
  expect(text).toContain("R1リザルト\nフェーズHP 350/600\nラウンドクリア\n脱落: P2");
});

test("convertToRealPlayBattleDurationMs converts bot battle duration to real-play scale", () => {
  expect(convertToRealPlayBattleDurationMs(80)).toBe(40_000);
  expect(convertToRealPlayBattleDurationMs(57)).toBe(28_500);
  expect(convertToRealPlayBattleDurationMs(undefined)).toBeUndefined();
  expect(convertToRealPlayBattleDurationMs(0)).toBeUndefined();
  expect(convertToRealPlayBattleDurationMs(81)).toBeUndefined();
});

test("buildBotOnlyHumanReadableRoundReport describes domination losses without claiming a wipe", () => {
  const text = buildBotOnlyHumanReadableRoundReport({
    totalRounds: 5,
    bossPlayerId: "boss-1",
    raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
    ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
    playerLabels: {
      "boss-1": "P1",
      "raid-a": "P2",
      "raid-b": "P3",
      "raid-c": "P4",
    },
    finalPlayers: [
      {
        playerId: "boss-1",
        label: "P1",
        role: "boss",
        hp: 100,
        remainingLives: 0,
        eliminated: false,
        rank: 1,
        selectedHeroId: "",
        selectedBossId: "remilia",
        boardUnits: [],
      },
      {
        playerId: "raid-a",
        label: "P2",
        role: "raid",
        hp: 100,
        remainingLives: 1,
        eliminated: false,
        rank: 2,
        selectedHeroId: "reimu",
        selectedBossId: "",
        boardUnits: [],
      },
    ],
    rounds: Array.from({ length: 5 }, (_, index) => ({
      roundIndex: index + 1,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 600 + index * 150,
      phaseDamageDealt: 300,
      phaseResult: "failed" as const,
      phaseCompletionRate: 0.5,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    })),
  });

  expect(text).toContain("R5で規定回数失敗");
  expect(text).not.toContain("R5でレイド側全滅");
});

test("resolveBattlePhaseElapsedMs derives elapsed time from battle phase remaining time", () => {
  expect(resolveBattlePhaseElapsedMs(80, 23)).toBe(57);
  expect(resolveBattlePhaseElapsedMs(80, 0)).toBe(80);
  expect(resolveBattlePhaseElapsedMs(undefined, 0)).toBeUndefined();
});

test("normalizeRoundPhaseContributionDamage aligns raid contribution totals to phase damage", () => {
  const normalizedRound = normalizeRoundPhaseContributionDamage({
    roundIndex: 1,
    phase: "Elimination",
    durationMs: 100,
    battles: [{
      battleIndex: 0,
      leftPlayerId: "boss-1",
      leftLabel: "P1",
      rightPlayerId: "raid-a",
      rightLabel: "P2",
      battleDurationMs: 1234,
      leftSpecialUnits: [],
      rightSpecialUnits: [],
      winner: "right",
      leftDamageDealt: 0,
      rightDamageDealt: 0,
      leftSurvivors: 0,
      rightSurvivors: 2,
      unitDamageBreakdown: [],
      unitOutcomes: [
        {
          playerId: "boss-1",
          label: "P1",
          unitId: "boss-escort",
          unitName: "紅美鈴",
          side: "boss",
          totalDamage: 80,
          phaseContributionDamage: 50,
          finalHp: 0,
          alive: false,
          unitLevel: 1,
          subUnitName: "",
          isSpecialUnit: false,
        },
        {
          playerId: "raid-a",
          label: "P2",
          unitId: "marisa",
          unitName: "魔理沙",
          side: "raid",
          totalDamage: 200,
          phaseContributionDamage: 80,
          finalHp: 100,
          alive: true,
          unitLevel: 1,
          subUnitName: "",
          isSpecialUnit: true,
        },
        {
          playerId: "raid-b",
          label: "P3",
          unitId: "nazrin",
          unitName: "ナズーリン",
          side: "raid",
          totalDamage: 100,
          phaseContributionDamage: 20,
          finalHp: 120,
          alive: true,
          unitLevel: 1,
          subUnitName: "",
          isSpecialUnit: false,
        },
      ],
    }],
    hpChanges: [],
    purchases: [],
    deploys: [],
    phaseHpTarget: 750,
    phaseDamageDealt: 300,
    phaseResult: "success",
    phaseCompletionRate: 0.4,
    playersAtBattleStart: [],
    playerConsequences: [],
    playersAfterRound: [],
    eliminations: [],
  });

  const normalizedRaidContribution = normalizedRound.battles[0]?.unitOutcomes
    .filter((unit) => unit.side === "raid")
    .reduce((sum, unit) => sum + unit.phaseContributionDamage, 0);
  const normalizedBossContribution = normalizedRound.battles[0]?.unitOutcomes
    .filter((unit) => unit.side === "boss")
    .reduce((sum, unit) => sum + unit.phaseContributionDamage, 0);

  expect(normalizedRaidContribution).toBe(300);
  expect(normalizedBossContribution).toBe(0);
});

test("normalizeRoundPhaseContributionDamage keeps duplicate raid units distinct", () => {
  const normalizedRound = normalizeRoundPhaseContributionDamage({
    roundIndex: 1,
    phase: "Elimination",
    durationMs: 100,
    battles: [{
      battleIndex: 0,
      leftPlayerId: "boss-1",
      leftLabel: "P1",
      rightPlayerId: "raid-a",
      rightLabel: "P2",
      battleDurationMs: 1234,
      leftSpecialUnits: [],
      rightSpecialUnits: [],
      winner: "right",
      leftDamageDealt: 0,
      rightDamageDealt: 0,
      leftSurvivors: 0,
      rightSurvivors: 2,
      unitDamageBreakdown: [],
      unitOutcomes: [
        {
          playerId: "raid-a",
          label: "P2",
          unitId: "nazrin",
          unitName: "ナズーリン",
          side: "raid",
          totalDamage: 200,
          phaseContributionDamage: 120,
          finalHp: 90,
          alive: true,
          unitLevel: 1,
          subUnitName: "",
          isSpecialUnit: false,
        },
        {
          playerId: "raid-a",
          label: "P2",
          unitId: "nazrin",
          unitName: "ナズーリン",
          side: "raid",
          totalDamage: 100,
          phaseContributionDamage: 80,
          finalHp: 60,
          alive: true,
          unitLevel: 1,
          subUnitName: "",
          isSpecialUnit: false,
        },
      ],
    }],
    hpChanges: [],
    purchases: [],
    deploys: [],
    phaseHpTarget: 500,
    phaseDamageDealt: 300,
    phaseResult: "success",
    phaseCompletionRate: 0.6,
    playersAtBattleStart: [],
    playerConsequences: [],
    playersAfterRound: [],
    eliminations: [],
  });

  expect(normalizedRound.battles[0]?.unitOutcomes).toEqual([
    expect.objectContaining({
      unitId: "nazrin",
      phaseContributionDamage: 200,
    }),
    expect.objectContaining({
      unitId: "nazrin",
      phaseContributionDamage: 100,
    }),
  ]);
});

test("buildBotOnlyHumanReadableRoundReport explains wipe failures when phase hp was fully depleted", () => {
  const text = buildBotOnlyHumanReadableRoundReport({
    totalRounds: 3,
    bossPlayerId: "boss-1",
    raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
    ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
    playerLabels: {
      "boss-1": "P1",
      "raid-a": "P2",
      "raid-b": "P3",
      "raid-c": "P4",
    },
    finalPlayers: [],
    rounds: [{
      roundIndex: 1,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 600,
      phaseDamageDealt: 600,
      phaseResult: "failed",
      phaseCompletionRate: 1,
      playersAtBattleStart: [],
      playerConsequences: [
        {
          playerId: "raid-a",
          label: "P2",
          role: "raid",
          battleStartUnitCount: 2,
          playerWipedOut: true,
          remainingLivesBefore: 2,
          remainingLivesAfter: 1,
          eliminatedAfter: false,
        },
        {
          playerId: "raid-b",
          label: "P3",
          role: "raid",
          battleStartUnitCount: 2,
          playerWipedOut: true,
          remainingLivesBefore: 2,
          remainingLivesAfter: 1,
          eliminatedAfter: false,
        },
        {
          playerId: "raid-c",
          label: "P4",
          role: "raid",
          battleStartUnitCount: 2,
          playerWipedOut: true,
          remainingLivesBefore: 2,
          remainingLivesAfter: 1,
          eliminatedAfter: false,
        },
      ],
      playersAfterRound: [],
      eliminations: [],
    }, {
      roundIndex: 2,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 750,
      phaseDamageDealt: 700,
      phaseResult: "failed",
      phaseCompletionRate: 0.93,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    }, {
      roundIndex: 3,
      phase: "Elimination",
      durationMs: 100,
      battles: [],
      hpChanges: [],
      purchases: [],
      deploys: [],
      phaseHpTarget: 900,
      phaseDamageDealt: 900,
      phaseResult: "success",
      phaseCompletionRate: 1,
      playersAtBattleStart: [],
      playerConsequences: [],
      playersAfterRound: [],
      eliminations: [],
    }],
  });

  expect(text).toContain("R1リザルト\nフェーズHP 600/600\n全滅によりラウンド失敗");
  expect(text).toContain("R2リザルト\nフェーズHP 700/750\nラウンド失敗");
});

test("maybeLogBotOnlyMatchRoundReport prints only the human report for DEBUG_BOT_PLAYABILITY_REPORT", () => {
  const originalHumanFlag = process.env.DEBUG_BOT_PLAYABILITY_REPORT;
  const originalJsonFlag = process.env.DEBUG_BOT_PLAYABILITY_JSON;
  const originalHumanPath = process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH;
  process.env.DEBUG_BOT_PLAYABILITY_REPORT = "true";
  delete process.env.DEBUG_BOT_PLAYABILITY_JSON;
  delete process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH;

  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  try {
    maybeLogBotOnlyMatchRoundReport({
      totalRounds: 1,
      bossPlayerId: "boss-1",
      raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
      ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
      playerLabels: {},
      finalPlayers: [],
      rounds: [{
        roundIndex: 1,
        phase: "Elimination",
        durationMs: 100,
        battles: [],
        hpChanges: [],
        purchases: [],
        deploys: [],
        phaseHpTarget: 600,
        phaseDamageDealt: 350,
        phaseResult: "success",
        phaseCompletionRate: 1,
        playersAtBattleStart: [],
        playerConsequences: [],
        playersAfterRound: [],
        eliminations: [],
      }],
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[0]).toContain("Round 1");
    expect(consoleSpy.mock.calls[0]?.[0]).not.toContain("\"type\":\"bot_only_round_report\"");
  } finally {
    consoleSpy.mockRestore();
    if (originalHumanFlag === undefined) {
      delete process.env.DEBUG_BOT_PLAYABILITY_REPORT;
    } else {
      process.env.DEBUG_BOT_PLAYABILITY_REPORT = originalHumanFlag;
    }

    if (originalJsonFlag === undefined) {
      delete process.env.DEBUG_BOT_PLAYABILITY_JSON;
    } else {
      process.env.DEBUG_BOT_PLAYABILITY_JSON = originalJsonFlag;
    }

    if (originalHumanPath === undefined) {
      delete process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH;
    } else {
      process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH = originalHumanPath;
    }
  }
});

test("maybeLogBotOnlyMatchRoundReport writes the human report to a dedicated file when configured", () => {
  const originalHumanFlag = process.env.DEBUG_BOT_PLAYABILITY_REPORT;
  const originalJsonFlag = process.env.DEBUG_BOT_PLAYABILITY_JSON;
  const originalHumanPath = process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH;
  const outputPath = "C:\\Users\\kou-1\\Dev_Workspace\\00_Source_Codes\\auto-chess-mvp\\.tmp\\bot-playability-human-report-test.log";
  process.env.DEBUG_BOT_PLAYABILITY_REPORT = "true";
  delete process.env.DEBUG_BOT_PLAYABILITY_JSON;
  process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH = outputPath;

  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  try {
    maybeLogBotOnlyMatchRoundReport({
      totalRounds: 1,
      bossPlayerId: "boss-1",
      raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
      ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
      playerLabels: {},
      finalPlayers: [],
      rounds: [{
        roundIndex: 1,
        phase: "Elimination",
        durationMs: 100,
        battles: [],
        hpChanges: [],
        purchases: [],
        deploys: [],
        phaseHpTarget: 600,
        phaseDamageDealt: 350,
        phaseResult: "success",
        phaseCompletionRate: 1,
        playersAtBattleStart: [],
        playerConsequences: [],
        playersAfterRound: [],
        eliminations: [],
      }],
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(readFileSync(outputPath, "utf8")).toContain("Round 1");
  } finally {
    consoleSpy.mockRestore();
    if (originalHumanFlag === undefined) {
      delete process.env.DEBUG_BOT_PLAYABILITY_REPORT;
    } else {
      process.env.DEBUG_BOT_PLAYABILITY_REPORT = originalHumanFlag;
    }

    if (originalJsonFlag === undefined) {
      delete process.env.DEBUG_BOT_PLAYABILITY_JSON;
    } else {
      process.env.DEBUG_BOT_PLAYABILITY_JSON = originalJsonFlag;
    }

    if (originalHumanPath === undefined) {
      delete process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH;
    } else {
      process.env.BOT_PLAYABILITY_HUMAN_REPORT_PATH = originalHumanPath;
    }
  }
});

const maybeLogBotOnlyMatchRoundReport = (report: BotOnlyMatchRoundReport): void => {
  if (!shouldLogBotOnlyHumanReport() && !shouldLogBotOnlyJsonReport()) {
    return;
  }

  if (shouldLogBotOnlyJsonReport()) {
    console.log(JSON.stringify({
      type: "bot_only_round_report",
      data: report,
    }));
  }

  if (shouldLogBotOnlyHumanReport()) {
    const text = buildBotOnlyHumanReadableRoundReport(report);
    const outputPath = getBotOnlyHumanReportOutputPath();
    if (outputPath) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${text}\n`, "utf8");
    } else {
      console.log(text);
    }
  }
};

const buildBotOnlyBaselineAggregateReport = (
  reports: BotOnlyMatchRoundReport[],
  requestedMatchCount = reports.length,
): BotOnlyBaselineAggregateReport => {
  return buildBotOnlyBaselineAggregateReportFromSummaries(
    reports.map((report) => ({
      ...(report.metadata == null ? {} : { metadata: report.metadata }),
      totalRounds: report.totalRounds,
      bossPlayerId: report.bossPlayerId,
      ranking: report.ranking,
      playerLabels: report.playerLabels,
      finalPlayers: report.finalPlayers.map((player) => ({
        playerId: player.playerId,
        label: player.label,
        role: player.role,
        hp: player.hp,
        gold: player.gold ?? 0,
        remainingLives: player.remainingLives,
        eliminated: player.eliminated,
        rank: player.rank,
        selectedHeroId: player.selectedHeroId,
        selectedBossId: player.selectedBossId,
        totalGoldEarned: player.totalGoldEarned ?? 0,
        totalGoldSpent: player.totalGoldSpent ?? 0,
        purchaseCount: player.purchaseCount ?? 0,
        refreshCount: player.refreshCount ?? 0,
        sellCount: player.sellCount ?? 0,
        boardUnits: player.boardUnits,
      })),
      battles: report.rounds.flatMap((round) =>
        round.battles.map((battle) => {
          const bossIsLeft = battle.leftPlayerId === report.bossPlayerId;
          const bossSurvivors = bossIsLeft ? battle.leftSurvivors : battle.rightSurvivors;
          const raidSurvivors = bossIsLeft ? battle.rightSurvivors : battle.leftSurvivors;
          const battleEndReason = battle.battleEndReason
            ?? (bossSurvivors === 0 && raidSurvivors === 0
              ? "mutual_annihilation"
              : bossSurvivors === 0 || raidSurvivors === 0
                ? "annihilation"
                : battle.winner === "draw"
                  ? "timeout_hp_tie"
                  : "timeout_hp_lead");
          return {
            ...battle,
            battleEndReason,
            bossSurvivors,
            raidSurvivors,
          };
        })),
    })),
    requestedMatchCount,
  );
};

const runBotOnlyBaselineMatches = async (
  requestedMatchCount: number,
  runMatch: (matchIndex: number) => Promise<BotOnlyBaselineMatchSummary>,
  cleanupAfterMatch: () => Promise<void>,
): Promise<{
  reports: BotOnlyBaselineMatchSummary[];
  failures: Array<{ matchIndex: number; message: string }>;
}> => {
  const reports: BotOnlyBaselineMatchSummary[] = [];
  const failures: Array<{ matchIndex: number; message: string }> = [];

  for (let matchIndex = 0; matchIndex < requestedMatchCount; matchIndex += 1) {
    try {
      reports.push(await runMatch(matchIndex));
    } catch (error) {
      failures.push({
        matchIndex,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await cleanupAfterMatch();
    }
  }

  return {
    reports,
    failures,
  };
};

test("buildBotOnlyBaselineAggregateReport summarizes bot-only match results", () => {
  const aggregate = buildBotOnlyBaselineAggregateReport([
    {
      metadata: {
        mode: "fast-parity",
        timeScale: 0.02,
        timings: {
          readyAutoStartMs: 500,
          prepDurationMs: 900,
          battleDurationMs: 800,
          settleDurationMs: 200,
          eliminationDurationMs: 150,
          selectionTimeoutMs: 400,
        },
      },
      totalRounds: 3,
      bossPlayerId: "boss-1",
      raidPlayerIds: ["raid-a", "raid-b", "raid-c"],
      ranking: ["boss-1", "raid-a", "raid-b", "raid-c"],
      playerLabels: {},
      finalPlayers: [
        {
          playerId: "boss-1",
          label: "P1",
          role: "boss",
          hp: 100,
          remainingLives: 0,
          eliminated: false,
          rank: 1,
          selectedHeroId: "",
          selectedBossId: "remilia",
          boardUnits: [{
            cell: 0,
            unitName: "レミリア",
            unitType: "remilia",
            unitId: "unit-remilia-1",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
        {
          playerId: "raid-a",
          label: "P2",
          role: "raid",
          hp: 100,
          remainingLives: 0,
          eliminated: true,
          rank: 2,
          selectedHeroId: "reimu",
          selectedBossId: "",
          boardUnits: [{
            cell: 1,
            unitName: "博麗霊夢",
            unitType: "reimu",
            unitId: "unit-reimu-1",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
        {
          playerId: "raid-b",
          label: "P3",
          role: "raid",
          hp: 100,
          remainingLives: 0,
          eliminated: true,
          rank: 3,
          selectedHeroId: "marisa",
          selectedBossId: "",
          boardUnits: [{
            cell: 2,
            unitName: "霧雨魔理沙",
            unitType: "marisa",
            unitId: "unit-marisa-1",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
        {
          playerId: "raid-c",
          label: "P4",
          role: "raid",
          hp: 100,
          remainingLives: 0,
          eliminated: true,
          rank: 4,
          selectedHeroId: "okina",
          selectedBossId: "",
          boardUnits: [{
            cell: 3,
            unitName: "摩多羅隠岐奈",
            unitType: "okina",
            unitId: "unit-okina-1",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
      ],
      rounds: [{
        roundIndex: 1,
        phase: "Settle",
        durationMs: 100,
        battles: [{
          battleIndex: 0,
          leftPlayerId: "boss-1",
          leftLabel: "P1",
          rightPlayerId: "raid-a",
          rightLabel: "P2",
          leftSpecialUnits: [],
          rightSpecialUnits: [],
          winner: "left",
          leftDamageDealt: 7,
          rightDamageDealt: 0,
          leftSurvivors: 1,
          rightSurvivors: 0,
          unitDamageBreakdown: [{
            playerId: "boss-1",
            label: "P1",
            unitId: "remilia",
            unitName: "レミリア",
            side: "boss",
            totalDamage: 33,
          }],
          unitOutcomes: [
            {
              playerId: "boss-1",
              label: "P1",
              unitId: "remilia",
              unitName: "レミリア",
              unitType: "remilia",
              side: "boss",
              totalDamage: 33,
              phaseContributionDamage: 33,
              finalHp: 500,
              alive: true,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
            {
              playerId: "raid-a",
              label: "P2",
              unitId: "reimu",
              unitName: "博麗霊夢",
              unitType: "reimu",
              side: "raid",
              totalDamage: 0,
              phaseContributionDamage: 0,
              finalHp: 0,
              alive: false,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
            {
              playerId: "raid-b",
              label: "P3",
              unitId: "marisa",
              unitName: "霧雨魔理沙",
              unitType: "marisa",
              side: "raid",
              totalDamage: 0,
              phaseContributionDamage: 0,
              finalHp: 0,
              alive: false,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
            {
              playerId: "raid-c",
              label: "P4",
              unitId: "okina",
              unitName: "摩多羅隠岐奈",
              unitType: "okina",
              side: "raid",
              totalDamage: 0,
              phaseContributionDamage: 0,
              finalHp: 0,
              alive: false,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
          ],
        }],
        hpChanges: [],
        purchases: [],
        deploys: [],
        phaseHpTarget: 600,
        phaseDamageDealt: 300,
        phaseResult: "failed",
        phaseCompletionRate: 0.5,
        playersAtBattleStart: [],
        playerConsequences: [],
        playersAfterRound: [],
        eliminations: [],
      }],
    },
    {
      metadata: {
        mode: "fast-parity",
        timeScale: 0.02,
        timings: {
          readyAutoStartMs: 500,
          prepDurationMs: 900,
          battleDurationMs: 800,
          settleDurationMs: 200,
          eliminationDurationMs: 150,
          selectionTimeoutMs: 400,
        },
      },
      totalRounds: 6,
      bossPlayerId: "boss-2",
      raidPlayerIds: ["raid-d", "raid-e", "raid-f"],
      ranking: ["raid-d", "boss-2", "raid-e", "raid-f"],
      playerLabels: {},
      finalPlayers: [
        {
          playerId: "boss-2",
          label: "P1",
          role: "boss",
          hp: 100,
          remainingLives: 0,
          eliminated: false,
          rank: 2,
          selectedHeroId: "",
          selectedBossId: "remilia",
          boardUnits: [{
            cell: 0,
            unitName: "レミリア",
            unitType: "remilia",
            unitId: "unit-remilia-2",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
        {
          playerId: "raid-d",
          label: "P2",
          role: "raid",
          hp: 100,
          remainingLives: 1,
          eliminated: false,
          rank: 1,
          selectedHeroId: "reimu",
          selectedBossId: "",
          boardUnits: [{
            cell: 1,
            unitName: "博麗霊夢",
            unitType: "reimu",
            unitId: "unit-reimu-2",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
        {
          playerId: "raid-e",
          label: "P3",
          role: "raid",
          hp: 100,
          remainingLives: 0,
          eliminated: true,
          rank: 3,
          selectedHeroId: "marisa",
          selectedBossId: "",
          boardUnits: [{
            cell: 2,
            unitName: "霧雨魔理沙",
            unitType: "marisa",
            unitId: "unit-marisa-2",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
        {
          playerId: "raid-f",
          label: "P4",
          role: "raid",
          hp: 100,
          remainingLives: 1,
          eliminated: false,
          rank: 4,
          selectedHeroId: "okina",
          selectedBossId: "",
          boardUnits: [{
            cell: 3,
            unitName: "十六夜咲夜",
            unitType: "sakuya",
            unitId: "unit-sakuya-1",
            unitLevel: 1,
            subUnitName: "",
          }],
        },
      ],
      rounds: [{
        roundIndex: 1,
        phase: "Settle",
        durationMs: 100,
        battles: [{
          battleIndex: 0,
          leftPlayerId: "boss-2",
          leftLabel: "P1",
          rightPlayerId: "raid-d",
          rightLabel: "P2",
          leftSpecialUnits: [],
          rightSpecialUnits: [],
          winner: "right",
          leftDamageDealt: 0,
          rightDamageDealt: 7,
          leftSurvivors: 0,
          rightSurvivors: 1,
          unitDamageBreakdown: [
            {
              playerId: "raid-d",
              label: "P2",
              unitId: "reimu-shot",
              unitName: "博麗霊夢",
              side: "raid",
              totalDamage: 22,
            },
            {
              playerId: "raid-f",
              label: "P4",
              unitId: "okina-shot",
              unitName: "摩多羅隠岐奈",
              side: "raid",
              totalDamage: 14,
            },
          ],
          unitOutcomes: [
            {
              playerId: "boss-2",
              label: "P1",
              unitId: "remilia",
              unitName: "レミリア",
              unitType: "remilia",
              side: "boss",
              totalDamage: 0,
              phaseContributionDamage: 0,
              finalHp: 0,
              alive: false,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
            {
              playerId: "raid-d",
              label: "P2",
              unitId: "reimu",
              unitName: "博麗霊夢",
              unitType: "reimu",
              side: "raid",
              totalDamage: 22,
              phaseContributionDamage: 22,
              finalHp: 240,
              alive: true,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
            {
              playerId: "raid-e",
              label: "P3",
              unitId: "marisa",
              unitName: "霧雨魔理沙",
              unitType: "marisa",
              side: "raid",
              totalDamage: 0,
              phaseContributionDamage: 0,
              finalHp: 0,
              alive: false,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
            {
              playerId: "raid-f",
              label: "P4",
              unitId: "okina",
              unitName: "摩多羅隠岐奈",
              unitType: "okina",
              side: "raid",
              totalDamage: 14,
              phaseContributionDamage: 14,
              finalHp: 180,
              alive: true,
              unitLevel: 1,
              subUnitName: "",
              isSpecialUnit: false,
            },
          ],
        }],
        hpChanges: [],
        purchases: [],
        deploys: [],
        phaseHpTarget: 600,
        phaseDamageDealt: 600,
        phaseResult: "success",
        phaseCompletionRate: 1,
        playersAtBattleStart: [],
        playerConsequences: [],
        playersAfterRound: [],
        eliminations: [],
      }],
    },
  ]);

  expect(aggregate).toEqual({
    metadata: {
      mode: "fast-parity",
      timeScale: 0.02,
      timings: {
        readyAutoStartMs: 500,
        prepDurationMs: 900,
        battleDurationMs: 800,
        settleDurationMs: 200,
        eliminationDurationMs: 150,
        selectionTimeoutMs: 400,
      },
    },
    requestedMatchCount: 2,
    completedMatches: 2,
    abortedMatches: 0,
    bossWins: 1,
    raidWins: 1,
    bossWinRate: 0.5,
    raidWinRate: 0.5,
    averageRounds: 4.5,
    minRounds: 3,
    maxRounds: 6,
    averageRemainingRaidPlayers: 1,
    battleMetrics: {
      totalBattles: 2,
      averageBossSurvivorsAtBattleEnd: 0.5,
      averageRaidSurvivorsAtBattleEnd: 0.5,
      bothSidesSurvivedRate: 0,
      bossWipedRate: 0.5,
      raidWipedRate: 0.5,
      endReasonCounts: {
        annihilation: 2,
        mutual_annihilation: 0,
        timeout_hp_lead: 0,
        timeout_hp_tie: 0,
        forced: 0,
        unexpected: 0,
      },
    },
    roundHistogram: {
      "3": 1,
      "6": 1,
    },
    playerMetrics: {
      P1: {
        averagePlacement: 1.5,
        firstPlaceRate: 0.5,
        averageRemainingHp: 100,
        averageRemainingLives: 0,
        averageFinalGold: 0,
        averageGoldEarned: 0,
        averageGoldSpent: 0,
        averagePurchaseCount: 0,
        averageRefreshCount: 0,
        averageSellCount: 0,
      },
      P2: {
        averagePlacement: 1.5,
        firstPlaceRate: 0.5,
        averageRemainingHp: 100,
        averageRemainingLives: 0.5,
        averageFinalGold: 0,
        averageGoldEarned: 0,
        averageGoldSpent: 0,
        averagePurchaseCount: 0,
        averageRefreshCount: 0,
        averageSellCount: 0,
      },
      P3: {
        averagePlacement: 3,
        firstPlaceRate: 0,
        averageRemainingHp: 100,
        averageRemainingLives: 0,
        averageFinalGold: 0,
        averageGoldEarned: 0,
        averageGoldSpent: 0,
        averagePurchaseCount: 0,
        averageRefreshCount: 0,
        averageSellCount: 0,
      },
      P4: {
        averagePlacement: 4,
        firstPlaceRate: 0,
        averageRemainingHp: 100,
        averageRemainingLives: 0.5,
        averageFinalGold: 0,
        averageGoldEarned: 0,
        averageGoldSpent: 0,
        averagePurchaseCount: 0,
        averageRefreshCount: 0,
        averageSellCount: 0,
      },
    },
    bossBattleUnitMetrics: [
      {
        unitId: "remilia",
        unitType: "remilia",
        unitName: "レミリア",
        battleAppearances: 2,
        matchesPresent: 2,
        averageunitLevel: 1,
        averageDamagePerBattle: 16.5,
        averageDamagePerMatch: 16.5,
        activeBattleRate: 0,
        averageAttackCountPerBattle: 0,
        averageHitCountPerBattle: 0,
        averageDamageTakenPerBattle: 0,
        averageFirstAttackMs: null,
        averageLifetimeMs: 0,
        zeroDamageBattleRate: 0.5,
        survivalRate: 0.5,
        ownerWinRate: 0.5,
        adoptionRate: 1,
      },
    ],
    raidBattleUnitMetrics: [
      {
        unitId: "reimu",
        unitType: "reimu",
        unitName: "博麗霊夢",
        battleAppearances: 2,
        matchesPresent: 2,
        averageunitLevel: 1,
        averageDamagePerBattle: 11,
        averageDamagePerMatch: 11,
        activeBattleRate: 0,
        averageAttackCountPerBattle: 0,
        averageHitCountPerBattle: 0,
        averageDamageTakenPerBattle: 0,
        averageFirstAttackMs: null,
        averageLifetimeMs: 0,
        zeroDamageBattleRate: 0.5,
        survivalRate: 0.5,
        ownerWinRate: 0.5,
        adoptionRate: 1,
        subUnitBattleAppearances: 0,
        subUnitMatchesPresent: 0,
        subUnitAdoptionRate: 0,
      },
      {
        unitId: "okina",
        unitType: "okina",
        unitName: "摩多羅隠岐奈",
        battleAppearances: 2,
        matchesPresent: 2,
        averageunitLevel: 1,
        averageDamagePerBattle: 7,
        averageDamagePerMatch: 7,
        activeBattleRate: 0,
        averageAttackCountPerBattle: 0,
        averageHitCountPerBattle: 0,
        averageDamageTakenPerBattle: 0,
        averageFirstAttackMs: null,
        averageLifetimeMs: 0,
        zeroDamageBattleRate: 0.5,
        survivalRate: 0.5,
        ownerWinRate: 0,
        adoptionRate: 1,
        subUnitBattleAppearances: 0,
        subUnitMatchesPresent: 0,
        subUnitAdoptionRate: 0,
      },
      {
        unitId: "marisa",
        unitType: "marisa",
        unitName: "霧雨魔理沙",
        battleAppearances: 2,
        matchesPresent: 2,
        averageunitLevel: 1,
        averageDamagePerBattle: 0,
        averageDamagePerMatch: 0,
        activeBattleRate: 0,
        averageAttackCountPerBattle: 0,
        averageHitCountPerBattle: 0,
        averageDamageTakenPerBattle: 0,
        averageFirstAttackMs: null,
        averageLifetimeMs: 0,
        zeroDamageBattleRate: 1,
        survivalRate: 0,
        ownerWinRate: 0,
        adoptionRate: 1,
        subUnitBattleAppearances: 0,
        subUnitMatchesPresent: 0,
        subUnitAdoptionRate: 0,
      },
    ],
    finalBoardUnitMetrics: [
      {
        unitId: "unit-marisa-1",
        unitType: "marisa",
        unitName: "霧雨魔理沙",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-marisa-2",
        unitType: "marisa",
        unitName: "霧雨魔理沙",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-okina-1",
        unitType: "okina",
        unitName: "摩多羅隠岐奈",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-reimu-1",
        unitType: "reimu",
        unitName: "博麗霊夢",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-reimu-2",
        unitType: "reimu",
        unitName: "博麗霊夢",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-remilia-1",
        unitType: "remilia",
        unitName: "レミリア",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-remilia-2",
        unitType: "remilia",
        unitName: "レミリア",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
      {
        unitId: "unit-sakuya-1",
        unitType: "sakuya",
        unitName: "十六夜咲夜",
        totalCopies: 1,
        matchesPresent: 1,
        averageCopiesPerMatch: 0.5,
        adoptionRate: 0.5,
      },
    ],
    topDamageUnits: [
      {
        unitId: "remilia",
        unitName: "レミリア",
        side: "boss",
        totalDamage: 33,
        appearances: 1,
        averageDamagePerMatch: 16.5,
      },
      {
        unitId: "reimu-shot",
        unitName: "博麗霊夢",
        side: "raid",
        totalDamage: 22,
        appearances: 1,
        averageDamagePerMatch: 11,
      },
      {
        unitId: "okina-shot",
        unitName: "摩多羅隠岐奈",
        side: "raid",
        totalDamage: 14,
        appearances: 1,
        averageDamagePerMatch: 7,
      },
    ],
    highCostSummary: {
      offerObservationCount: 0,
      offerMatchCount: 0,
      purchaseCount: 0,
      purchaseMatchCount: 0,
      finalBoardCopies: 0,
      finalBoardMatchCount: 0,
      finalBoardAdoptionRate: 0,
    },
    highCostOfferMetrics: [],
    rangeDamageEfficiencyMetrics: [
      {
        side: "boss",
        rangeBand: "range_2_plus",
        battleAppearances: 2,
        totalDamage: 33,
        totalTheoreticalBaseDamage: 0,
        normalizedDamageEfficiency: 0,
        totalAttackCount: 0,
        totalTheoreticalAttackCount: 0,
        attackOpportunityUtilization: null,
        averageDamagePerBattle: 16.5,
        averageFirstAttackMs: null,
        firstAttackSamples: 0,
        zeroDamageBattleRate: 0.5,
      },
      {
        side: "raid",
        rangeBand: "range_2_plus",
        battleAppearances: 6,
        totalDamage: 36,
        totalTheoreticalBaseDamage: 0,
        normalizedDamageEfficiency: 0,
        totalAttackCount: 0,
        totalTheoreticalAttackCount: 0,
        attackOpportunityUtilization: null,
        averageDamagePerBattle: 6,
        averageFirstAttackMs: null,
        firstAttackSamples: 0,
        zeroDamageBattleRate: 0.6666666666666666,
      },
    ],
    rangeActionDiagnosticsMetrics: [
      {
        side: "boss",
        rangeBand: "range_2_plus",
        battleAppearances: 2,
        movedBattleRate: 0,
        averageMoveCountPerBattle: 0,
        averageFirstMoveMs: null,
        firstMoveSamples: 0,
        averageMoveToFirstAttackMs: null,
        moveToFirstAttackSamples: 0,
        repositionBattleRate: 0,
        averageRepositionMoveCountPerBattle: 0,
        reachedAttackRangeBattleRate: 0,
        noAttackDespiteReachingRangeBattleRate: 0,
        noAttackWithoutReachingRangeBattleRate: 1,
        lateSingleAttackBattleRate: 0,
        averageInitialNearestEnemyDistance: null,
        averageBestNearestEnemyDistance: null,
        averageDistanceClosed: null,
        noAttackBattleRate: 1,
        movedNoAttackBattleRate: 0,
        attackedNoHitBattleRate: 0,
        moveTargetDiagnosticSampleCount: 0,
        suboptimalMoveTargetRate: null,
        averageExcessApproachSteps: null,
        averageOutsideAttackRangeBeforeFirstAttackMs: 0,
        averageInAttackRangeBeforeFirstAttackMs: 0,
        averageAfterFirstAttackMs: 0,
        averageFirstReachedAttackRangeAtMs: null,
        firstReachedAttackRangeSamples: 0,
        averageLeftLateralMovesPerBattle: 0,
        averageRightLateralMovesPerBattle: 0,
        firstLateralMoveLeftRate: null,
        firstLateralMoveRightRate: null,
        firstLateralMoveSamples: 0,
        sharedPursuitMoveSampleCount: 0,
        contestedPursuitMoveRate: null,
        plannedApproachGroupMoveSampleCount: 0,
        averagePlannedApproachGroupCompetitorCount: null,
        averagePlannedApproachGroupAssignedCount: null,
        oversubscribedPlannedApproachGroupRate: null,
        plannedApproachBattleCount: 0,
        plannedApproachMoveSampleCount: 0,
        plannedApproachStillOpenRate: null,
        usedPlannedApproachRate: null,
        plannedApproachPathBlockedRate: null,
        plannedApproachFirstAttackRate: null,
        plannedApproachMatchedFirstAttackTargetRate: null,
        plannedApproachReachedRangeWithoutAttackRate: null,
        plannedApproachNoReachNoAttackRate: null,
        plannedApproachNoAttackTargetDiedBeforeBattleEndRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate: null,
      },
      {
        side: "raid",
        rangeBand: "range_2_plus",
        battleAppearances: 6,
        movedBattleRate: 0,
        averageMoveCountPerBattle: 0,
        averageFirstMoveMs: null,
        firstMoveSamples: 0,
        averageMoveToFirstAttackMs: null,
        moveToFirstAttackSamples: 0,
        repositionBattleRate: 0,
        averageRepositionMoveCountPerBattle: 0,
        reachedAttackRangeBattleRate: 0,
        noAttackDespiteReachingRangeBattleRate: 0,
        noAttackWithoutReachingRangeBattleRate: 1,
        lateSingleAttackBattleRate: 0,
        averageInitialNearestEnemyDistance: null,
        averageBestNearestEnemyDistance: null,
        averageDistanceClosed: null,
        noAttackBattleRate: 1,
        movedNoAttackBattleRate: 0,
        attackedNoHitBattleRate: 0,
        moveTargetDiagnosticSampleCount: 0,
        suboptimalMoveTargetRate: null,
        averageExcessApproachSteps: null,
        averageOutsideAttackRangeBeforeFirstAttackMs: 0,
        averageInAttackRangeBeforeFirstAttackMs: 0,
        averageAfterFirstAttackMs: 0,
        averageFirstReachedAttackRangeAtMs: null,
        firstReachedAttackRangeSamples: 0,
        averageLeftLateralMovesPerBattle: 0,
        averageRightLateralMovesPerBattle: 0,
        firstLateralMoveLeftRate: null,
        firstLateralMoveRightRate: null,
        firstLateralMoveSamples: 0,
        sharedPursuitMoveSampleCount: 0,
        contestedPursuitMoveRate: null,
        plannedApproachGroupMoveSampleCount: 0,
        averagePlannedApproachGroupCompetitorCount: null,
        averagePlannedApproachGroupAssignedCount: null,
        oversubscribedPlannedApproachGroupRate: null,
        plannedApproachBattleCount: 0,
        plannedApproachMoveSampleCount: 0,
        plannedApproachStillOpenRate: null,
        usedPlannedApproachRate: null,
        plannedApproachPathBlockedRate: null,
        plannedApproachFirstAttackRate: null,
        plannedApproachMatchedFirstAttackTargetRate: null,
        plannedApproachReachedRangeWithoutAttackRate: null,
        plannedApproachNoReachNoAttackRate: null,
        plannedApproachNoAttackTargetDiedBeforeBattleEndRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate: null,
      },
    ],
    rangeFormationDiagnosticsMetrics: [
      {
        side: "boss",
        rangeBand: "range_2_plus",
        battleAppearances: 2,
        frontAllyBlockedBattleRate: 0,
        averageFrontAllyCount: 0,
        averageInitialRow: null,
        averageInitialColumn: null,
        zeroDamageBattleRateWithFrontAlly: null,
        zeroDamageBattleRateWithoutFrontAlly: 0.5,
        noAttackBattleRateWithFrontAlly: null,
        noAttackBattleRateWithoutFrontAlly: 1,
      },
      {
        side: "raid",
        rangeBand: "range_2_plus",
        battleAppearances: 6,
        frontAllyBlockedBattleRate: 0,
        averageFrontAllyCount: 0,
        averageInitialRow: null,
        averageInitialColumn: null,
        zeroDamageBattleRateWithFrontAlly: null,
        zeroDamageBattleRateWithoutFrontAlly: 0.6666666666666666,
        noAttackBattleRateWithFrontAlly: null,
        noAttackBattleRateWithoutFrontAlly: 1,
      },
    ],
    raidMeleeCohortMetrics: [],
    raidSpecialMeleeUnitDiagnostics: [],
  });
});

test("runBotOnlyBaselineMatches cleans up after every match attempt", async () => {
  const cleanupAfterMatch = vi.fn(async () => {});

  const { reports, failures } = await runBotOnlyBaselineMatches(
    3,
    async (matchIndex) => {
      if (matchIndex === 1) {
        throw new Error("expected failure");
      }

      return {
        totalRounds: matchIndex + 2,
        bossPlayerId: "boss",
        ranking: ["boss", "raid-1", "raid-2", "raid-3"],
        playerLabels: {
          boss: "Boss",
          "raid-1": "Raid 1",
          "raid-2": "Raid 2",
          "raid-3": "Raid 3",
        },
        finalPlayers: [],
        battles: [],
      };
    },
    cleanupAfterMatch,
  );

  expect(reports).toHaveLength(2);
  expect(failures).toEqual([{ matchIndex: 1, message: "expected failure" }]);
  expect(cleanupAfterMatch).toHaveBeenCalledTimes(3);
});

describeGameRoomIntegration("GameRoom integration / bot playability", (context) => {
  const getTestServer = () => context.testServer;
  const runBotBalanceBaseline = process.env.RUN_BOT_BALANCE_BASELINE === "true";
  const baselineMatchCount = Math.max(
    1,
    Number.parseInt(process.env.BOT_BASELINE_MATCH_COUNT ?? "10", 10) || 10,
  );
  const baselineTimeoutMs = Math.max(
    30_000,
    Number.parseInt(process.env.BOT_BASELINE_TIMEOUT_MS ?? "120000", 10) || 120_000,
  );
  const baselineBossPolicy = resolveBotBalanceBaselineHelperPolicy(
    process.env.BOT_BASELINE_BOSS_POLICY,
  );
  const baselineRaidPolicies = resolveBotBalanceBaselineRaidPolicies(
    process.env.BOT_BASELINE_RAID_POLICIES,
  );
  const baselineHelperConfigs = createBotBalanceBaselineHelperConfigs({
    bossPolicy: baselineBossPolicy,
    raidPolicies: baselineRaidPolicies,
  });
  const baselineTest = runBotBalanceBaseline ? test : test.skip;
  const BOT_ONLY_FAST_PARITY_ROOM_TIMINGS = createFastParityGameRoomOptions({
    timeScale: 0.02,
  });
  const BOT_ONLY_MANUAL_ROOM_TIMINGS = {
    prepDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.prepDurationMs,
    battleDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.battleDurationMs,
    settleDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.settleDurationMs,
    eliminationDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.eliminationDurationMs,
    selectionTimeoutMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.selectionTimeoutMs,
    battleTimelineTimeScale: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.battleTimelineTimeScale,
  } as const;
  const BOT_ONLY_HELPER_ROOM_TIMINGS = {
    readyAutoStartMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.readyAutoStartMs,
    prepDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.prepDurationMs,
    battleDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.battleDurationMs,
    settleDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.settleDurationMs,
    eliminationDurationMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.eliminationDurationMs,
    selectionTimeoutMs: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.selectionTimeoutMs,
    battleTimelineTimeScale: BOT_ONLY_FAST_PARITY_ROOM_TIMINGS.battleTimelineTimeScale,
  } as const;
  const BOT_ONLY_BASELINE_ROOM_TIMINGS: Record<string, unknown> = {
    ...createBotBalanceBaselineRoomTimings(0.02),
  };
  const BOT_ONLY_DAMAGE_TARGETS: Record<number, number> = {
    1: 600,
    2: 750,
    3: 900,
    4: 1_050,
    5: 1_250,
    6: 1_450,
    7: 1_650,
    8: 1_850,
  };
  const BOT_ONLY_HUMAN_REPORT_DAMAGE_TARGETS: Record<number, number> = {};

  test("manual role picks and minimal prep actions can complete the first battle loop", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(
      getTestServer(),
      BOT_ONLY_MANUAL_ROOM_TIMINGS,
    );

    clients[0]!.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);

    clients[0]!.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });
    clients[1]!.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    clients[2]!.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    clients[3]!.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    clients[1]!.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 24, unitType: "vanguard" }],
    });

    await expect(clients[1]!.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).resolves.toEqual({
      accepted: true,
    });

    await waitForCondition(() => serverRoom.state.phase === "Battle", 2_000);
    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      2_000,
    );

    expect(serverRoom.state.roundIndex).toBe(2);
  });

  test("four helper bots can self-start and reach the second prep round", async () => {
    const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
      enableBossExclusiveShop: true,
      enableHeroSystem: true,
      enableSubUnitSystem: true,
      enableTouhouRoster: true,
    }, BOT_ONLY_MANUAL_ROOM_TIMINGS);
    const clients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    clients.forEach((client, helperIndex) => {
      attachAutoFillHelperAutomationForTest(client, helperIndex);
    });

    await waitForCondition(() => clients.every((client) => serverRoom.state.players.get(client.sessionId)?.ready === true), 1_000);

    await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Battle", 2_000);
    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      2_000,
    );

    expect(serverRoom.state.roundIndex).toBe(2);
    expect(serverRoom.state.bossPlayerId).not.toBe("");
    expect(Array.from(serverRoom.state.raidPlayerIds)).toHaveLength(3);
  });

  test(
    "four helper bots can self-start and finish a bot-only match",
    async () => {
      const artifacts = await runBotOnlyHelperMatch(
        (room) => getTestServer().connectTo(room) as unknown as Promise<BotOnlyTestClient>,
        () => createRoomWithForcedFlags(getTestServer(), {
          enableBossExclusiveShop: true,
          enableHeroSystem: true,
          enableSubUnitSystem: true,
          enableTouhouRoster: true,
        }, BOT_ONLY_HELPER_ROOM_TIMINGS),
        BOT_ONLY_HUMAN_REPORT_DAMAGE_TARGETS,
      );
      const { serverRoom } = artifacts;
      const report = buildBotOnlyMatchRoundReport(artifacts);

      expect(serverRoom.state.phase).toBe("End");
      expect(serverRoom.state.roundIndex).toBeGreaterThanOrEqual(2);
      expect(serverRoom.state.roundIndex).toBeLessThanOrEqual(12);
      expect(serverRoom.state.ranking).toHaveLength(4);
      expect(
        report.rounds.every((round) => {
          const raidPlayers = round.playerConsequences.filter((player) => player.role === "raid");
          const allRaidPlayersWipedOut =
            raidPlayers.length > 0 && raidPlayers.every((player) => player.playerWipedOut);

          return (
            round.phaseDamageDealt < round.phaseHpTarget
            || round.phaseResult === "success"
            || (round.phaseResult === "failed" && allRaidPlayersWipedOut)
          );
        }),
      ).toBe(true);
    },
    30_000,
  );

  test(
    "short bot-only matches expose round-by-round result details",
    async () => {
      const artifacts = await runBotOnlyHelperMatch(
        (room) => getTestServer().connectTo(room) as unknown as Promise<BotOnlyTestClient>,
        () => createRoomWithForcedFlags(getTestServer(), {
          enableBossExclusiveShop: true,
          enableHeroSystem: true,
          enableSubUnitSystem: true,
          enableTouhouRoster: true,
        }, BOT_ONLY_HELPER_ROOM_TIMINGS),
        BOT_ONLY_HUMAN_REPORT_DAMAGE_TARGETS,
      );
      const report = buildBotOnlyMatchRoundReport(artifacts);
      maybeLogBotOnlyMatchRoundReport(report);

      expect(artifacts.serverRoom.state.phase).toBe("End");
      expect(report.totalRounds).toBeGreaterThanOrEqual(2);
      expect(report.rounds.length).toBeGreaterThan(0);
      expect(report.ranking).toHaveLength(4);
      expect(report.rounds.some((round) => round.battles.length > 0)).toBe(true);
      expect(
        report.rounds.some((round) =>
          round.battles.some((battle) =>
            battle.leftSpecialUnits.length > 0 || battle.rightSpecialUnits.length > 0)),
      ).toBe(true);
      expect(
        report.rounds.some((round) =>
          round.playerConsequences.some((player) =>
            player.role === "raid"
            && Number.isFinite(player.remainingLivesBefore)
            && Number.isFinite(player.remainingLivesAfter)
            && typeof player.playerWipedOut === "boolean")),
      ).toBe(true);
      expect(report.rounds.every((round) => Number.isFinite(round.phaseHpTarget))).toBe(true);
      expect(report.rounds.every((round) => Number.isFinite(round.phaseDamageDealt))).toBe(true);
      expect(
        report.rounds.every((round) =>
          round.phaseResult === "pending"
          || round.phaseResult === "success"
          || round.phaseResult === "failed"),
      ).toBe(true);
      expect(report.rounds.every((round) => round.playerConsequences.length === 4)).toBe(true);
      expect(
        report.rounds.some((round) =>
          round.playerConsequences.some((player) =>
            player.role === "raid"
            && player.battleStartUnitCount > 0)),
      ).toBe(true);
      expect(
        report.rounds.some((round) =>
          round.playersAtBattleStart.some((player) =>
            player.boardUnits.some((unit) => unit.unitName.length > 0))),
      ).toBe(true);
      expect(
        report.rounds
          .filter((round) => round.roundIndex < report.totalRounds)
          .some((round) => round.battles.some((battle) => battle.unitOutcomes.length > 0)),
      ).toBe(true);
    },
    25_000,
  );

  test(
    "bot-only helpers deploy standard units before the first battle",
    async () => {
      const artifacts = await runBotOnlyHelperMatch(
        (room) => getTestServer().connectTo(room) as unknown as Promise<BotOnlyTestClient>,
        () => createRoomWithForcedFlags(getTestServer(), {
          enableBossExclusiveShop: true,
          enableHeroSystem: true,
          enableSubUnitSystem: true,
          enableTouhouRoster: true,
        }, BOT_ONLY_HELPER_ROOM_TIMINGS),
        BOT_ONLY_HUMAN_REPORT_DAMAGE_TARGETS,
      );
      const report = buildBotOnlyMatchRoundReport(artifacts);
      const firstRound = report.rounds[0];

      expect(firstRound).toBeDefined();
      expect((firstRound?.purchases.length ?? 0)).toBeGreaterThan(0);
      expect((firstRound?.deploys.length ?? 0)).toBeGreaterThan(0);
      expect(
        firstRound?.playersAtBattleStart.some((player) => player.boardUnits.length > 0),
      ).toBe(true);
    },
    25_000,
  );

  baselineTest(
    "bot-only baseline report aggregates multiple helper matches",
    async () => {
      const { reports, failures } = await runBotOnlyBaselineMatches(
        baselineMatchCount,
        async (matchIndex) => {
          const artifacts = await runBotOnlyHelperMatchForBaseline(
            (room) => getTestServer().connectTo(room) as unknown as Promise<BotOnlyTestClient>,
            () => createRoomWithForcedFlags(getTestServer(), {
              enableBossExclusiveShop: true,
              enableHeroSystem: true,
              enableSubUnitSystem: true,
              enableTouhouRoster: true,
            }, BOT_ONLY_BASELINE_ROOM_TIMINGS),
            BOT_ONLY_HUMAN_REPORT_DAMAGE_TARGETS,
            baselineHelperConfigs,
            matchIndex,
          );
          return buildBotOnlyBaselineMatchSummary(artifacts);
        },
        async () => {
          await getTestServer().cleanup();
        },
      );

      const aggregate = buildBotOnlyBaselineAggregateReportFromSummaries(reports, baselineMatchCount);
      console.log(JSON.stringify({
        type: "bot_balance_baseline",
        data: {
          ...aggregate,
          failures,
        },
      }));

      expect(aggregate.requestedMatchCount).toBe(baselineMatchCount);
      expect(aggregate.completedMatches + aggregate.abortedMatches).toBe(baselineMatchCount);
      expect(aggregate.completedMatches).toBeGreaterThan(0);
      expect(aggregate.bossWins + aggregate.raidWins).toBe(aggregate.completedMatches);
      if (aggregate.completedMatches > 0) {
        expect(aggregate.averageRounds).toBeGreaterThanOrEqual(2);
      }
    },
    baselineTimeoutMs,
  );
});
