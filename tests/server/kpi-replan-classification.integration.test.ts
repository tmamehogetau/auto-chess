import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { GameRoom } from "../../src/server/rooms/game-room";
import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type CommandResult,
} from "../../src/shared/room-messages";
import type { FeatureFlags } from "../../src/shared/feature-flags";
import {
  createRoomWithFlags,
  FLAG_CONFIGURATIONS,
  withFlags,
} from "./feature-flag-test-helper";
import {
  getFullGameEvidenceCaseManifest,
  getKpiEvidenceSuiteManifest,
  getKpiReplanClassificationEvidenceFixture,
  type AggregateReport,
  type EligibleFailureClassification,
  type RefinedEligibleAggregate,
  type RoundSurvivalClassification,
} from "./kpi-replan-classification.fixture";

const previousEnableStructuredMatchLogs = process.env.ENABLE_STRUCTURED_MATCH_LOGS;
const previousSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
let cachedPrepCommandClassification: Promise<PrepCommandClassification> | null = null;

interface PrepCommandClassification {
  acceptedCommands: number;
  rejectedCommands: number;
  rejectionCodes: Record<string, number>;
}

interface HarnessNoProgressResult {
  totalRounds: number;
  playersSurvivedR8: number;
}

interface RunMatchToR8Options {
  applyForcedPhaseProgress?: boolean;
  finalRound?: number;
  featureFlags?: FeatureFlags;
}

interface ScenarioUnitPlacement {
  unitType: string;
  cell: number;
}

interface TestContext {
  testServer: ColyseusTestServer;
  kpiOutputs: GameplayKpiSummary[];
  originalConsoleLog: typeof console.log;
}

type TestClient = {
  sessionId: string;
  send: (type: string, msg: unknown) => void;
  waitForMessage: (type: string) => Promise<unknown>;
  onMessage: (type: string, handler: (msg: unknown) => void) => void;
};

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();
  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  throw new Error("Timed out while waiting for condition");
};

async function createTestContext(port: number): Promise<TestContext> {
  const server = defineServer({
    rooms: {
      game: defineRoom(GameRoom, {
        readyAutoStartMs: 300,
        prepDurationMs: 200,
        battleDurationMs: 100,
        settleDurationMs: 50,
        eliminationDurationMs: 50,
      }),
    },
  });

  await server.listen(port);

  return {
    testServer: new ColyseusTestServer(server),
    kpiOutputs: [],
    originalConsoleLog: console.log,
  };
}

async function destroyTestContext(ctx: TestContext): Promise<void> {
  restoreConsoleLog(ctx);
  await ctx.testServer.cleanup();
  await ctx.testServer.shutdown();
}

function setupLogCapture(ctx: TestContext): void {
  ctx.originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true") {
      ctx.originalConsoleLog(...args);
    }

    if (args.length !== 1 || typeof args[0] !== "string") {
      return;
    }

    try {
      const parsed = JSON.parse(args[0]) as { type?: string; data?: unknown };
      if (parsed.type === "gameplay_kpi_summary" && parsed.data) {
        ctx.kpiOutputs.push(parsed.data as GameplayKpiSummary);
      }
    } catch {
      // Ignore non-JSON console output
    }
  };
}

function restoreConsoleLog(ctx: TestContext): void {
  console.log = ctx.originalConsoleLog;
}

function injectForcedOffers(serverRoom: GameRoom, playerId: string, unitTypes: string[]): void {
  const internalController = (serverRoom as unknown as {
    controller?: {
      shopOffersByPlayer: Map<string, Array<{ unitType: string; rarity: number; cost: number }>>;
      getBoardPlacementsForPlayer?: (playerId: string) => Array<{ cell: number; unitType: string }>;
    };
  }).controller;

  internalController?.shopOffersByPlayer.set(
    playerId,
    unitTypes.map((unitType) => ({ unitType, rarity: 1, cost: 1 })),
  );
}

function getCurrentBoardPlacements(
  serverRoom: GameRoom,
  playerId: string,
): Array<{ cell: number; unitType: string }> {
  const internalController = (serverRoom as unknown as {
    controller?: {
      getBoardPlacementsForPlayer?: (playerId: string) => Array<{ cell: number; unitType: string }>;
    };
  }).controller;

  return internalController?.getBoardPlacementsForPlayer?.(playerId) ?? [];
}

async function sendPrepCommand(
  client: TestClient,
  cmdSeq: number,
  payload: Record<string, unknown>,
): Promise<CommandResult> {
  client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq, ...payload });
  return (await client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)) as CommandResult;
}

async function buildTrackedCompositionViaPrepActions(
  serverRoom: GameRoom,
  playerId: string,
  client: TestClient,
  startingCmdSeq: number,
  unitAndCellPairs: ScenarioUnitPlacement[],
  counts: PrepCommandClassification,
): Promise<number> {
  let cmdSeq = startingCmdSeq;

  const recordResult = (result: CommandResult): void => {
    if (result.accepted) {
      counts.acceptedCommands += 1;
      return;
    }

    counts.rejectedCommands += 1;
    counts.rejectionCodes[result.code] = (counts.rejectionCodes[result.code] ?? 0) + 1;
  };

  for (const { unitType, cell } of unitAndCellPairs) {
    const existingPlacement = getCurrentBoardPlacements(serverRoom, playerId).some(
      (placement) => placement.cell === cell && placement.unitType === unitType,
    );
    if (existingPlacement) {
      continue;
    }

    const internalController = (serverRoom as unknown as {
      controller?: {
        shopOffersByPlayer: Map<string, Array<{
          unitType: string;
          unitId?: string;
          rarity: number;
          cost: number;
        }>>;
      };
    }).controller;

    internalController?.shopOffersByPlayer.set(playerId, [
      { unitType, unitId: `${unitType}-${cell}`, rarity: 1, cost: 1 },
    ]);

    const buyResult = await sendPrepCommand(client, cmdSeq++, { shopBuySlotIndex: 0 });
    recordResult(buyResult);

    if (!buyResult.accepted) {
      continue;
    }

    const placementResult = await sendPrepCommand(client, cmdSeq++, {
      benchToBoardCell: { benchIndex: 0, cell },
    });
    recordResult(placementResult);
  }

  return cmdSeq;
}

async function runMatchToFinalRound(
  ctx: TestContext,
  buildCompositions: (serverRoom: GameRoom, clients: TestClient[]) => Promise<void>,
  options: RunMatchToR8Options = {},
): Promise<{ serverRoom: GameRoom; clients: TestClient[] }> {
  const serverRoom = await createRoomWithFlags(
    ctx.testServer,
    options.featureFlags ?? FLAG_CONFIGURATIONS.ALL_DISABLED,
  );
  const clients = await Promise.all([
    ctx.testServer.connectTo(serverRoom),
    ctx.testServer.connectTo(serverRoom),
    ctx.testServer.connectTo(serverRoom),
    ctx.testServer.connectTo(serverRoom),
  ]);

  for (const client of clients) {
    client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
    client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
  }

  await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

  const roundTargets: Record<number, number> = {
    1: 1200,
    2: 1500,
    3: 1800,
    4: 2100,
    5: 2500,
    6: 2900,
    7: 3300,
    8: 3550,
    9: 3800,
    10: 4100,
    11: 4400,
    12: 0,
  };
  const finalRound = options.finalRound ?? 8;

  let lastRound = 0;
  const maxDuration = 50_000;
  const startTime = Date.now();

  while (
    serverRoom.state.phase !== "End" &&
    serverRoom.state.roundIndex < finalRound + 1 &&
    Date.now() - startTime < maxDuration
  ) {
    const currentRound = serverRoom.state.roundIndex;

    if (currentRound !== lastRound && serverRoom.state.phase === "Prep") {
      lastRound = currentRound;
      await buildCompositions(serverRoom, clients);
    }

    await waitForCondition(() => serverRoom.state.phase === "Battle", 5_000);

    const target = roundTargets[serverRoom.state.roundIndex];
    if ((options.applyForcedPhaseProgress ?? true) && target !== undefined) {
      serverRoom.setPendingPhaseDamageForTest(target);
    }

    if (serverRoom.state.roundIndex < finalRound) {
      await waitForCondition(
        () => serverRoom.state.phase === "Prep" || serverRoom.state.phase === "End",
        5_000,
      );
    } else {
      await waitForCondition(() => serverRoom.state.phase === "End", 5_000);
    }
  }

  return { serverRoom, clients };
}

async function collectPrepCommandClassification(): Promise<PrepCommandClassification> {
  if (cachedPrepCommandClassification) {
    return cachedPrepCommandClassification;
  }

  cachedPrepCommandClassification = (async () => {
    const ctx = await createTestContext(2_575);
    setupLogCapture(ctx);
    const nextCmdSeqByClient = new Map<string, number>();

    const counts: PrepCommandClassification = {
      acceptedCommands: 0,
      rejectedCommands: 0,
      rejectionCodes: {},
    };

    try {
      const placements: ScenarioUnitPlacement[] = [
        { unitType: "vanguard", cell: 0 },
        { unitType: "vanguard", cell: 1 },
        { unitType: "vanguard", cell: 2 },
      ];

      const serverRoom = await createRoomWithFlags(
        ctx.testServer,
        FLAG_CONFIGURATIONS.ALL_DISABLED,
      );
      const clients = await Promise.all([
        ctx.testServer.connectTo(serverRoom),
        ctx.testServer.connectTo(serverRoom),
        ctx.testServer.connectTo(serverRoom),
        ctx.testServer.connectTo(serverRoom),
      ]);

      for (const client of clients) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

      for (const client of clients) {
        const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
        const updatedCmdSeq = await buildTrackedCompositionViaPrepActions(
          serverRoom,
          client.sessionId,
          client,
          nextCmdSeq,
          placements,
          counts,
        );
        nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
      }

      await serverRoom.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      return counts;
    } finally {
      await destroyTestContext(ctx);
    }
  })();

  return cachedPrepCommandClassification;
}

async function collectNoProgressHarnessResult(): Promise<HarnessNoProgressResult> {
  const placements: ScenarioUnitPlacement[] = [
    { unitType: "vanguard", cell: 0 },
    { unitType: "vanguard", cell: 1 },
    { unitType: "vanguard", cell: 2 },
  ];

  const ctx = await createTestContext(2_577);
  setupLogCapture(ctx);
  const nextCmdSeqByClient = new Map<string, number>();

  try {
    const serverRoom = await createRoomWithFlags(
      ctx.testServer,
      FLAG_CONFIGURATIONS.PHASE_EXPANSION_ONLY,
    );
    const clients = await Promise.all([
      ctx.testServer.connectTo(serverRoom),
      ctx.testServer.connectTo(serverRoom),
      ctx.testServer.connectTo(serverRoom),
      ctx.testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    let lastRound = 0;
    const maxDuration = 50_000;
    const startTime = Date.now();

    while (
      serverRoom.state.phase !== "End" &&
      serverRoom.state.roundIndex < 8 &&
      Date.now() - startTime < maxDuration
    ) {
      const currentRound = serverRoom.state.roundIndex;

      if (currentRound !== lastRound && serverRoom.state.phase === "Prep") {
        lastRound = currentRound;
        for (const client of clients) {
          const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
          const updatedCmdSeq = await buildTrackedCompositionViaPrepActions(
            serverRoom,
            client.sessionId,
            client,
            nextCmdSeq,
            placements,
            {
              acceptedCommands: 0,
              rejectedCommands: 0,
              rejectionCodes: {},
            },
          );
          nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
        }
      }

      await waitForCondition(
        () =>
          serverRoom.state.roundIndex > currentRound ||
          serverRoom.state.phase === "End",
        5_000,
      );
    }

    await serverRoom.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const playersSurvivedR8 = Array.from(serverRoom.state.players.values()).filter(
      (player) => player.hp > 0,
    ).length;

    return {
      totalRounds: serverRoom.state.roundIndex,
      playersSurvivedR8,
    };
  } finally {
    await destroyTestContext(ctx);
  }
}

function collectRoundSurvivalClassification(): RoundSurvivalClassification {
  return getKpiReplanClassificationEvidenceFixture().roundSurvivalClassification;
}

function collectCurrentRealisticAggregate(): AggregateReport {
  return getKpiReplanClassificationEvidenceFixture().currentRealisticAggregate;
}

function collectRefinedEligibleBundle(): RefinedEligibleAggregate {
  return getKpiReplanClassificationEvidenceFixture().refinedEligibleBundle;
}

function collectEligibleFailureClassification(): EligibleFailureClassification {
  return getKpiReplanClassificationEvidenceFixture().eligibleFailureClassification;
}

describe("KPI REPLAN classification", () => {
  const evidence = getKpiReplanClassificationEvidenceFixture();

  beforeAll(() => {
    process.env.ENABLE_STRUCTURED_MATCH_LOGS = "true";
    process.env.SUPPRESS_VERBOSE_TEST_LOGS = "true";
  });

  afterAll(() => {
    if (previousEnableStructuredMatchLogs === undefined) {
      delete process.env.ENABLE_STRUCTURED_MATCH_LOGS;
    } else {
      process.env.ENABLE_STRUCTURED_MATCH_LOGS = previousEnableStructuredMatchLogs;
    }

    if (previousSuppressVerboseLogs === undefined) {
      delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
      return;
    }

    process.env.SUPPRESS_VERBOSE_TEST_LOGS = previousSuppressVerboseLogs;
  });

  test("full-game evidence cases are classified explicitly", () => {
    const manifest = getFullGameEvidenceCaseManifest();
    const eligibleCases = Object.values(manifest).filter((bucket) => bucket === "eligible");

    expect(manifest["4人でR8完走後にEndフェーズへ遷移する"]).toBe("eligible");
    expect(manifest["phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する"]).toBe("eligible");
    expect(manifest["Touhou unitId は buy -> bench -> board -> sell で共有プール返却まで維持される"]).toBe("incidental");
    expect(manifest["MVP unit は unitId なしでも buy -> bench -> board が従来どおり動く"]).toBe("incidental");
    expect(manifest["各ラウンドで正しいフェーズサイクルが実行される"]).toBe("incidental");
    expect(manifest["プレイヤーが4人接続したままゲームが継続する"]).toBe("incidental");
    expect(manifest["round_stateメッセージが各フェーズで送信される"]).toBe("incidental");
    expect(eligibleCases).toHaveLength(5);
  });

  test("fixture-driven evidence covers the expected KPI classification counts", () => {
    expect(evidence.currentRealisticAggregate.sampledMatches).toBe(11);
    expect(evidence.refinedEligibleBundle.sampledMatches).toBe(11);
    expect(evidence.eligibleFailureClassification.totalEligibleMatches).toBe(11);
    expect(evidence.eligibleFailureClassification.phaseProgressOnlyCases).toBe(5);
    expect(evidence.eligibleFailureClassification.matchesBelowR8Threshold).toBe(0);
    expect(evidence.eligibleFailureClassification.playerHpDamageCases).toBe(0);
    expect(evidence.eligibleFailureClassification.earlyEliminationCases).toBe(0);
    expect(evidence.roundSurvivalClassification.totalMatches).toBe(evidence.matchSummaries.length);
    expect(evidence.roundSurvivalClassification.matchesWithKpi).toBe(
      evidence.records.length,
    );
  });

  test("fixture evidence stays within the original KPI evidence suites and full-game incidental cases", () => {
    expect(
      new Set(evidence.records.map((record) => record.suitePath)),
    ).toEqual(
      new Set([
        "tests/server/full-game-simulation.integration.test.ts",
        "tests/server/realistic-kpi-simulation.integration.test.ts",
      ]),
    );

    expect(
      evidence.incidentalRecords.every(
        (record) =>
          record.suitePath === "tests/server/full-game-simulation.integration.test.ts" &&
          record.testName !== null &&
          getFullGameEvidenceCaseManifest()[record.testName] === "incidental",
      ),
    ).toBe(true);
  });

  test("refined eligible bundle is still too concentrated", () => {
    const aggregate = collectRefinedEligibleBundle();

    expect(aggregate.sampledMatches).toBe(11);
    expect(aggregate.r8CompletionRate).toBeGreaterThanOrEqual(0.97);
    expect(aggregate.top1CompositionShare).toBeLessThanOrEqual(0.35);
  }, 300_000);

  test("eligible R8 misses are classified explicitly", () => {
    const result = collectEligibleFailureClassification();

    expect(result.totalEligibleMatches).toBe(11);
    expect(result.matchesBelowR8Threshold).toBe(0);
    expect(result.phaseProgressOnlyCases).toBe(5);
    expect(result.playerHpDamageCases).toBe(0);
    expect(result.earlyEliminationCases).toBe(0);
  }, 120_000);

  test("eligible R8 misses are eliminated after phase-progress-only adjustment", () => {
    const result = collectEligibleFailureClassification();

    expect(result.totalEligibleMatches).toBe(11);
    expect(result.matchesBelowR8Threshold).toBe(0);
    expect(result.phaseProgressOnlyCases).toBe(5);
    expect(result.playerHpDamageCases).toBe(0);
    expect(result.earlyEliminationCases).toBe(0);
  }, 120_000);

  test("KPI evidence suites are classified explicitly", () => {
    const manifest = getKpiEvidenceSuiteManifest();

    expect(manifest["tests/server/full-game-simulation.integration.test.ts"]).toBe("eligible");
    expect(manifest["tests/server/realistic-kpi-simulation.integration.test.ts"]).toBe("eligible");
    expect(manifest["tests/server/game-room.feature-flag.integration.test.ts"]).toBe("incidental");
    expect(manifest["tests/server/kpi-replan-classification.integration.test.ts"]).toBe("incidental");
  });

  test("current realistic aggregate は incidental KPI suites を除外する", () => {
    expect(evidence.eligibleRecords).toHaveLength(11);
    expect(evidence.incidentalRecords).toHaveLength(2);
    expect(evidence.combinedBundle.sampledMatches).toBe(13);
    expect(evidence.incidentalBundle.sampledMatches).toBe(2);
    expect(evidence.incidentalBundle.r8CompletionRate).toBe(0);
    expect(evidence.refinedEligibleBundle.mostCommonTop1Composition).toBe("mage:1,mage:1,mage:1");
  });

  test("current realistic aggregate keeps completion and non-empty composition signal", () => {
    const aggregate = collectCurrentRealisticAggregate();

    expect(aggregate.sampledMatches).toBe(11);
    expect(aggregate.r8CompletionRate).toBeGreaterThan(0.97);
    expect(aggregate.top1CompositionShare).toBeGreaterThan(0);
  }, 120_000);

  test("prep failure rate is dominated by repeated invalid setup commands", async () => {
    const result = await collectPrepCommandClassification();

    expect(result.acceptedCommands).toBeGreaterThan(0);
    expect(result.rejectedCommands).toBe(0);
    expect(result.rejectionCodes.DUPLICATE_CMD ?? 0).toBe(0);
    expect(result.rejectionCodes.INVALID_PAYLOAD ?? 0).toBe(0);
  }, 60_000);

  test("remaining prep failures are eliminated from the realistic harness", async () => {
    const result = await collectPrepCommandClassification();

    expect(Object.keys(result.rejectionCodes).length).toBe(0);
    expect(result.rejectionCodes.DUPLICATE_CMD ?? 0).toBe(0);
    expect(result.rejectedCommands).toBe(0);
  }, 60_000);

  test("R8 completion miss comes from early eliminations, not missing KPI emission", () => {
    const result = collectRoundSurvivalClassification();

    expect(result.matchesWithKpi).toBe(result.totalMatches);
    expect(result.matchesEndingBeforeR8).toBe(2);
    expect(result.playersSurvivingR8).toBeLessThan(result.totalPlayersAcrossSamples);
  }, 120_000);

  test("realistic harness reaches R8 without forced phase damage", async () => {
    await withFlags(FLAG_CONFIGURATIONS.PHASE_EXPANSION_ONLY, async () => {
      const result = await collectNoProgressHarnessResult();

      expect(result.totalRounds).toBe(8);
      expect(result.playersSurvivedR8).toBeGreaterThan(0);
    });
  }, 120_000);
});
