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
    battles: Array<{
      battleIndex: number;
      leftPlayerId: string;
      leftLabel: string;
      rightPlayerId: string;
      rightLabel: string;
      leftSpecialUnits: string[];
      rightSpecialUnits: string[];
      winner: "left" | "right" | "draw";
      leftDamageDealt: number;
      rightDamageDealt: number;
      leftSurvivors: number;
      rightSurvivors: number;
      unitDamageBreakdown: ReportUnitDamageContribution[];
    }>;
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

type ReportUnitDamageContribution = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
};

type BotOnlyRoundSnapshot = {
  roundIndex: number;
  phaseAfterRound: string;
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
  const resolvedName = resolveSharedBoardUnitPresentation(
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
  roundState: Pick<
    RoundStateMessage,
    "phaseHpTarget" | "phaseDamageDealt" | "phaseResult" | "phaseCompletionRate"
  > | undefined,
): BotOnlyRoundSnapshot["phaseProgress"] => ({
  phaseHpTarget: roundState?.phaseHpTarget ?? 0,
  phaseDamageDealt: roundState?.phaseDamageDealt ?? 0,
  phaseResult: roundState?.phaseResult ?? "pending",
  phaseCompletionRate: roundState?.phaseCompletionRate ?? 0,
});

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

const resolveBattleTimelineForReportBattle = (
  serverRoom: BotOnlyServerRoom,
  snapshot: BotOnlyRoundSnapshot | undefined,
  battle: {
    leftPlayerId: string;
    rightPlayerId: string;
  },
): BattleTimelineEvent[] => {
  const testAccess = getTestAccess(serverRoom);
  for (const playerId of [battle.leftPlayerId, battle.rightPlayerId]) {
    const timeline = testAccess?.battleResultsByPlayer.get(playerId)?.timeline;
    if (Array.isArray(timeline) && timeline.length > 0) {
      return timeline;
    }
  }

  if (!snapshot) {
    return [];
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

  return [];
};

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

const runBotOnlyHelperMatch = async (
  connectClient: (serverRoom: BotOnlyServerRoom) => Promise<BotOnlyTestClient>,
  createRoom: () => Promise<BotOnlyServerRoom>,
  damageTargets: Record<number, number>,
): Promise<BotOnlyMatchArtifacts> => {
  const serverRoom = await createRoom();
  const clients = await Promise.all([
    connectClient(serverRoom),
    connectClient(serverRoom),
    connectClient(serverRoom),
    connectClient(serverRoom),
  ]);
  const roundSnapshots: BotOnlyRoundSnapshot[] = [];
  const phaseProgressByRound = new Map<
    number,
    {
      phase: RoundStateMessage["phase"];
      phaseHpTarget: number;
      phaseDamageDealt: number;
      phaseResult: "pending" | "success" | "failed";
      phaseCompletionRate: number;
    }
  >();

  for (const client of clients) {
    client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
  }

  clients[0]?.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message: unknown) => {
    const roundState = message as RoundStateMessage;
    const existing = phaseProgressByRound.get(roundState.roundIndex);

    if (
      existing
      && BOT_ONLY_PHASE_PRIORITY[existing.phase] > BOT_ONLY_PHASE_PRIORITY[roundState.phase]
    ) {
      return;
    }

    phaseProgressByRound.set(roundState.roundIndex, {
      phase: roundState.phase,
      phaseHpTarget: roundState.phaseHpTarget ?? 0,
      phaseDamageDealt: roundState.phaseDamageDealt ?? 0,
      phaseResult: roundState.phaseResult ?? "pending",
      phaseCompletionRate: roundState.phaseCompletionRate ?? 0,
    });
  });

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

    const phaseDamage = damageTargets[serverRoom.state.roundIndex];
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
      phaseProgress: buildRoundPhaseProgress(phaseProgressByRound.get(battleRoundIndex)),
      playersAtBattleStart,
      playerConsequences: buildPlayerConsequences(
        playersAtBattleStart,
        playerBattleOutcomes,
        playersAfterRound,
      ),
      playersAfterRound,
    };

    if (process.env.DEBUG_BOT_PLAYABILITY_REPORT === "true") {
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

      return {
        roundIndex: roundLog.roundIndex,
        phase: roundLog.phase,
        durationMs: roundLog.durationMs,
        battles: roundLog.battles.map((battle) => {
          const timeline = resolveBattleTimelineForReportBattle(
            artifacts.serverRoom,
            snapshot,
            battle,
          );
          return {
            battleIndex: battle.battleIndex,
            leftPlayerId: battle.leftPlayerId,
            leftLabel: getPlayerLabel(playerLabels, battle.leftPlayerId),
            rightPlayerId: battle.rightPlayerId,
            rightLabel: getPlayerLabel(playerLabels, battle.rightPlayerId),
            leftSpecialUnits: getSpecialBattleUnitsForPlayers(
              artifacts.serverRoom,
              getBattleSidePlayerIds(artifacts.serverRoom, battle.leftPlayerId),
            ),
            rightSpecialUnits: getSpecialBattleUnitsForPlayers(
              artifacts.serverRoom,
              getBattleSidePlayerIds(artifacts.serverRoom, battle.rightPlayerId),
            ),
            winner: battle.winner,
            leftDamageDealt: battle.leftDamageDealt,
            rightDamageDealt: battle.rightDamageDealt,
            leftSurvivors: battle.leftSurvivors,
            rightSurvivors: battle.rightSurvivors,
            unitDamageBreakdown: buildUnitDamageBreakdownForBattle(
              timeline,
              snapshot?.playersAtBattleStart ?? [],
              playerLabels,
            ),
          };
        }),
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
    }),
  };
};

const maybeLogBotOnlyMatchRoundReport = (report: BotOnlyMatchRoundReport): void => {
  if (process.env.DEBUG_BOT_PLAYABILITY_REPORT !== "true") {
    return;
  }

  console.log(JSON.stringify({
    type: "bot_only_round_report",
    data: report,
  }));
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
      const { serverRoom } = await runBotOnlyHelperMatch(
        (room) => getTestServer().connectTo(room) as unknown as Promise<BotOnlyTestClient>,
        () => createRoomWithForcedFlags(getTestServer(), {
          enableBossExclusiveShop: true,
          enableHeroSystem: true,
          enableTouhouRoster: true,
        }, BOT_ONLY_HELPER_ROOM_TIMINGS),
        BOT_ONLY_DAMAGE_TARGETS,
      );

      expect(serverRoom.state.phase).toBe("End");
      expect(serverRoom.state.roundIndex).toBeGreaterThanOrEqual(2);
      expect(serverRoom.state.roundIndex).toBeLessThanOrEqual(12);
      expect(serverRoom.state.ranking).toHaveLength(4);
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
          enableTouhouRoster: true,
        }, BOT_ONLY_HELPER_ROOM_TIMINGS),
        BOT_ONLY_DAMAGE_TARGETS,
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
          round.playersAfterRound.some((player) =>
            player.role === "raid" && (player.remainingLives < 2 || player.eliminated))),
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
            player.remainingLivesAfter < player.remainingLivesBefore
            && player.playerWipedOut)),
      ).toBe(true);
      expect(
        report.rounds.some((round) =>
          round.playersAtBattleStart.some((player) =>
            player.boardUnits.some((unit) => unit.unitName.length > 0))),
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
          enableTouhouRoster: true,
        }, BOT_ONLY_HELPER_ROOM_TIMINGS),
        BOT_ONLY_DAMAGE_TARGETS,
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
              enableTouhouRoster: true,
            }, BOT_ONLY_HELPER_ROOM_TIMINGS),
            BOT_ONLY_DAMAGE_TARGETS,
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
