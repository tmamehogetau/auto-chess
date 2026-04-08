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
import type { MatchLogger } from "../../../src/server/match-logger";
import type {
  BattleStartEvent,
  BattleTimelineEvent,
  BoardUnitPlacement,
  DamageAppliedEvent,
  RoundStateMessage,
} from "../../../src/shared/room-messages";
import {
  resolveSharedBoardBossPresentation,
  resolveSharedBoardHeroPresentation,
  resolveSharedBoardUnitPresentation,
} from "../../../src/server/shared-board-unit-presentation";

type BotOnlyServerRoom = Awaited<ReturnType<typeof createRoomWithForcedFlags>>;
type BotOnlyTestClient = {
  sessionId: string;
  state?: unknown;
  send: (type: string, message?: unknown) => void;
  onStateChange: (handler: (state: unknown) => void) => void;
  onMessage: (type: string, handler: (_message: unknown) => void) => void;
};

type BotOnlyMatchRoundReport = {
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
    remainingLives: number;
    eliminated: boolean;
    rank: number;
    selectedHeroId: string;
    selectedBossId: string;
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

type BotOnlyBaselineAggregateReport = {
  requestedMatchCount: number;
  completedMatches: number;
  abortedMatches: number;
  bossWins: number;
  raidWins: number;
  bossWinRate: number;
  raidWinRate: number;
  averageRounds: number;
  minRounds: number;
  maxRounds: number;
  averageRemainingRaidPlayers: number;
  roundHistogram: Record<string, number>;
  topDamageUnits: Array<{
    unitId: string;
    unitName: string;
    side: "boss" | "raid";
    totalDamage: number;
    appearances: number;
    averageDamagePerMatch: number;
  }>;
};

type BotOnlyRoundBattleReport = {
  battleIndex: number;
  leftPlayerId: string;
  leftLabel: string;
  rightPlayerId: string;
  rightLabel: string;
  battleDurationMs?: number;
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
  side: "boss" | "raid";
  totalDamage: number;
  phaseContributionDamage: number;
  finalHp: number;
  alive: boolean;
  starLevel: number;
  subUnitName: string;
  isSpecialUnit: boolean;
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
  starLevel: number;
  subUnitName: string;
};

type BotOnlyMatchArtifacts = {
  serverRoom: BotOnlyServerRoom;
  clients: BotOnlyTestClient[];
  roundSnapshots: BotOnlyRoundSnapshot[];
};

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
    starLevel: placement.starLevel ?? 1,
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
  const damageByBattleUnitId = new Map<string, number>();
  const phaseContributionByBattleUnitId = new Map<string, number>();
  const damageBySourceToTargetBattleUnitId = new Map<string, Map<string, number>>();
  const currentHpByBattleUnitId = new Map<string, number>();
  const deadUnitIds = new Set<string>();
  const battleStartUnitByBattleUnitId = new Map(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, unit] as const),
  );
  const latestDamageSourceByTargetBattleUnitId = new Map<string, string>();
  const latestKeyframeByBattleUnitId = new Map<
    string,
    {
      currentHp: number;
      alive: boolean;
    }
  >();
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

  for (const event of timeline) {
    if (event.type === "damageApplied") {
      damageByBattleUnitId.set(
        event.sourceBattleUnitId,
        (damageByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + event.amount,
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
      currentHpByBattleUnitId.set(event.battleUnitId, 0);
      latestKeyframeByBattleUnitId.set(event.battleUnitId, {
        currentHp: 0,
        alive: false,
      });
      continue;
    }

    if (event.type === "keyframe") {
      for (const unitState of event.units) {
        latestKeyframeByBattleUnitId.set(unitState.battleUnitId, {
          currentHp: unitState.currentHp,
          alive: unitState.alive,
        });
      }
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
        starLevel: metadata?.starLevel ?? 1,
        subUnitName: metadata?.subUnitName ?? "",
        isSpecialUnit: metadata == null,
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
  return {
    battleIndex: battle.battleIndex,
    leftPlayerId: battle.leftPlayerId,
    leftLabel: getPlayerLabel(playerLabels, battle.leftPlayerId),
    rightPlayerId: battle.rightPlayerId,
    rightLabel: getPlayerLabel(playerLabels, battle.rightPlayerId),
    ...(battleDurationMs !== undefined ? { battleDurationMs } : {}),
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
    const timeline = testAccess?.battleResultsByPlayer.get(playerId)?.timeline;
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
      const timeline = testAccess?.battleResultsByPlayer.get(client.sessionId)?.timeline;
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

test("buildBotOnlyMatchRoundReport prefers captured round battle details over recomputing from latest state", () => {
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
      starLevel: 1,
      subUnitName: "",
      isSpecialUnit: false,
    }],
  };

  const fakeRoom = {
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
        starLevel: 1,
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
        starLevel: 1,
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

const buildBotOnlyMatchRoundReport = (
  artifacts: BotOnlyMatchArtifacts,
): BotOnlyMatchRoundReport => {
  const matchLogger = getMatchLogger(artifacts.serverRoom);
  const playerLabels = getPlayerLabelMap(artifacts.clients);
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
  const finalPlayers = artifacts.clients.map((client) => {
    const player = artifacts.serverRoom.state.players.get(client.sessionId);
    if (!player) {
      throw new Error(`Expected final player state for ${client.sessionId}`);
    }

    return {
      playerId: client.sessionId,
      label: getPlayerLabel(playerLabels, client.sessionId),
      role: player.role,
      hp: player.hp,
      remainingLives: player.remainingLives,
      eliminated: player.eliminated,
      rank: ranking.indexOf(client.sessionId) + 1,
      selectedHeroId: player.selectedHeroId,
      selectedBossId: player.selectedBossId,
      boardUnits: getReportBoardUnitsForPlayer(artifacts.serverRoom, client.sessionId),
    };
  });

  return {
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
          `${unit.unitName} Lv${unit.starLevel}${subUnitSuffix} 与ダメージ${unit.totalDamage} フェーズ貢献ダメージ${unit.phaseContributionDamage} 最終HP${unit.finalHp}`,
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
            `${unit.unitName} Lv${unit.starLevel}${subUnitSuffix} 与ダメージ${unit.totalDamage} フェーズ貢献ダメージ${unit.phaseContributionDamage} 最終HP${unit.finalHp}`,
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

test("buildBotOnlyHumanReadableRoundReport omits phase hp only on the R12 final judgment round", () => {
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
          starLevel: 1,
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
          starLevel: 1,
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
          starLevel: 1,
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
          starLevel: 1,
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
          starLevel: 1,
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
          starLevel: 1,
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
  const completedMatches = reports.length;
  if (completedMatches === 0) {
    return {
      requestedMatchCount,
      completedMatches: 0,
      abortedMatches: requestedMatchCount,
      bossWins: 0,
      raidWins: 0,
      bossWinRate: 0,
      raidWinRate: 0,
      averageRounds: 0,
      minRounds: 0,
      maxRounds: 0,
      averageRemainingRaidPlayers: 0,
      roundHistogram: {},
      topDamageUnits: [],
    };
  }

  let bossWins = 0;
  let totalRounds = 0;
  let totalRemainingRaidPlayers = 0;
  let minRounds = Number.POSITIVE_INFINITY;
  let maxRounds = 0;
  const roundHistogram = new Map<number, number>();
  const damageByUnit = new Map<string, {
    unitId: string;
    unitName: string;
    side: "boss" | "raid";
    totalDamage: number;
    appearances: number;
  }>();

  for (const report of reports) {
    if (report.ranking[0] === report.bossPlayerId) {
      bossWins += 1;
    }

    totalRounds += report.totalRounds;
    minRounds = Math.min(minRounds, report.totalRounds);
    maxRounds = Math.max(maxRounds, report.totalRounds);
    roundHistogram.set(
      report.totalRounds,
      (roundHistogram.get(report.totalRounds) ?? 0) + 1,
    );

    const remainingRaidPlayers = report.finalPlayers.filter(
      (player) => player.role === "raid" && player.eliminated !== true,
    ).length;
    totalRemainingRaidPlayers += remainingRaidPlayers;

    const seenUnitKeysInMatch = new Set<string>();
    for (const round of report.rounds) {
      for (const battle of round.battles) {
        for (const contribution of battle.unitDamageBreakdown) {
          const key = `${contribution.side}::${contribution.unitId}`;
          const existing = damageByUnit.get(key) ?? {
            unitId: contribution.unitId,
            unitName: contribution.unitName,
            side: contribution.side,
            totalDamage: 0,
            appearances: 0,
          };
          existing.totalDamage += contribution.totalDamage;
          if (!seenUnitKeysInMatch.has(key)) {
            existing.appearances += 1;
            seenUnitKeysInMatch.add(key);
          }
          damageByUnit.set(key, existing);
        }
      }
    }
  }

  const raidWins = completedMatches - bossWins;

  return {
    requestedMatchCount,
    completedMatches,
    abortedMatches: Math.max(0, requestedMatchCount - completedMatches),
    bossWins,
    raidWins,
    bossWinRate: bossWins / completedMatches,
    raidWinRate: raidWins / completedMatches,
    averageRounds: totalRounds / completedMatches,
    minRounds,
    maxRounds,
    averageRemainingRaidPlayers: totalRemainingRaidPlayers / completedMatches,
    roundHistogram: Object.fromEntries(
      Array.from(roundHistogram.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([rounds, count]) => [String(rounds), count]),
    ),
    topDamageUnits: Array.from(damageByUnit.values())
      .sort((left, right) =>
        right.totalDamage - left.totalDamage
        || right.appearances - left.appearances
        || left.unitId.localeCompare(right.unitId))
      .slice(0, 10)
      .map((contribution) => ({
        ...contribution,
        averageDamagePerMatch: contribution.totalDamage / completedMatches,
      })),
  };
};

const runBotOnlyBaselineMatches = async (
  requestedMatchCount: number,
  runMatch: (matchIndex: number) => Promise<BotOnlyMatchRoundReport>,
  cleanupAfterMatch: () => Promise<void>,
): Promise<{
  reports: BotOnlyMatchRoundReport[];
  failures: Array<{ matchIndex: number; message: string }>;
}> => {
  const reports: BotOnlyMatchRoundReport[] = [];
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
          boardUnits: [],
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
          boardUnits: [],
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
          boardUnits: [],
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
          boardUnits: [],
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
          unitOutcomes: [],
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
          boardUnits: [],
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
          boardUnits: [],
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
          boardUnits: [],
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
          boardUnits: [],
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
          unitOutcomes: [],
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
    roundHistogram: {
      "3": 1,
      "6": 1,
    },
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
        raidPlayerIds: ["raid-1", "raid-2", "raid-3"],
        ranking: ["boss", "raid-1", "raid-2", "raid-3"],
        playerLabels: {
          boss: "Boss",
          "raid-1": "Raid 1",
          "raid-2": "Raid 2",
          "raid-3": "Raid 3",
        },
        finalPlayers: [],
        rounds: [],
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
  const baselineTest = runBotBalanceBaseline ? test : test.skip;
  const BOT_ONLY_MANUAL_ROOM_TIMINGS = {
    prepDurationMs: 240,
    battleDurationMs: 80,
    settleDurationMs: 50,
    eliminationDurationMs: 50,
  } as const;
  const BOT_ONLY_HELPER_ROOM_TIMINGS = {
    readyAutoStartMs: 100,
    prepDurationMs: 240,
    battleDurationMs: 80,
    settleDurationMs: 50,
    eliminationDurationMs: 50,
  } as const;
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

    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
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
    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
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
          return buildBotOnlyMatchRoundReport(artifacts);
        },
        async () => {
          await getTestServer().cleanup();
        },
      );

      const aggregate = buildBotOnlyBaselineAggregateReport(reports, baselineMatchCount);
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
    120_000,
  );
});
