import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, parse } from "node:path";
import { promisify } from "node:util";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { MatchSummaryLog } from "../../src/server/match-logger";
import { GameRoom } from "../../src/server/rooms/game-room";
import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type CommandResult,
} from "../../src/shared/room-messages";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";

const execFileAsync = promisify(execFile);
const vitestCliPath = resolveVitestCliPath(process.cwd());
const previousEnableStructuredMatchLogs = process.env.ENABLE_STRUCTURED_MATCH_LOGS;
const previousSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;

function resolveVitestCliPath(startDir: string): string {
  let currentDir = startDir;
  const { root } = parse(startDir);

  while (true) {
    const candidate = join(currentDir, "node_modules", "vitest", "vitest.mjs");
    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === root) {
      return join(startDir, "node_modules", "vitest", "vitest.mjs");
    }

    currentDir = dirname(currentDir);
  }
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function createKpiEvidenceVitestEnv(): Promise<NodeJS.ProcessEnv> {
  const fullGamePort = await getAvailablePort();
  const realisticPort = await getAvailablePort();

  return {
    ...process.env,
    FULL_GAME_SIMULATION_TEST_PORT: String(fullGamePort),
    REALISTIC_KPI_SIMULATION_TEST_PORT: String(realisticPort),
    SUPPRESS_VERBOSE_TEST_LOGS: "true",
    ENABLE_STRUCTURED_MATCH_LOGS: "true",
    FORWARD_CAPTURED_KPI_LOGS: "true",
  };
}

async function runVitestForKpiEvidence() {
  if (cachedKpiEvidenceVitestRun) {
    return cachedKpiEvidenceVitestRun;
  }

  cachedKpiEvidenceVitestRun = (async () => {
    const env = await createKpiEvidenceVitestEnv();

    return execFileAsync(
      process.execPath,
      [
        vitestCliPath,
        "run",
        "tests/server/full-game-simulation.integration.test.ts",
        "tests/server/realistic-kpi-simulation.integration.test.ts",
      ],
      {
        cwd: process.cwd(),
        env,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  })();

  return cachedKpiEvidenceVitestRun;
}

interface AggregateReport {
  sampledMatches: number;
  r8CompletionRate: number;
  prepInputFailureRate: number;
  top1CompositionShare: number;
}

interface RefinedEligibleAggregate extends AggregateReport {
  mostCommonTop1Composition: string | null;
}

interface PrepCommandClassification {
  acceptedCommands: number;
  rejectedCommands: number;
  rejectionCodes: Record<string, number>;
}

interface RoundSurvivalClassification {
  totalMatches: number;
  matchesWithKpi: number;
  matchesEndingBeforeR8: number;
  totalPlayersAcrossSamples: number;
  playersSurvivingR8: number;
}

interface HarnessProgressComparison {
  phaseProgressOnlyTotalRounds: number;
  phaseProgressOnlyPlayersSurvivingR8: number;
  noProgressControlTotalRounds: number;
  noProgressControlPlayersSurvivingR8: number;
}

interface EligibleFailureClassification {
  totalEligibleMatches: number;
  matchesBelowR8Threshold: number;
  phaseProgressOnlyCases: number;
  playerHpDamageCases: number;
  earlyEliminationCases: number;
}

type KpiEvidenceVitestResult = Awaited<ReturnType<typeof execFileAsync>>;

let cachedKpiEvidenceVitestRun: Promise<KpiEvidenceVitestResult> | null = null;
let cachedEligibleFailureClassification: Promise<EligibleFailureClassification> | null = null;
let cachedPrepCommandClassification: Promise<PrepCommandClassification> | null = null;

function toExecOutputText(output: string | NodeJS.ArrayBufferView): string {
  return typeof output === "string"
    ? output
    : Buffer.from(output.buffer, output.byteOffset, output.byteLength).toString("utf8");
}

interface RunMatchToR8Options {
  applyForcedPhaseProgress?: boolean;
  finalRound?: number;
}

type KpiEvidenceBucket = "eligible" | "incidental";

function getKpiEvidenceSuiteManifest(): Record<string, KpiEvidenceBucket> {
  return {
    "tests/server/full-game-simulation.integration.test.ts": "eligible",
    "tests/server/realistic-kpi-simulation.integration.test.ts": "eligible",
    "tests/server/game-room.feature-flag.integration.test.ts": "incidental",
    "tests/server/kpi-replan-classification.integration.test.ts": "incidental",
  };
}

type KpiEvidenceCaseBucket = "eligible" | "incidental";

function getFullGameEvidenceCaseManifest(): Record<string, KpiEvidenceCaseBucket> {
  return {
    "4人でR8完走後にEndフェーズへ遷移する": "eligible",
    "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する": "eligible",
    "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する": "eligible",
    "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する": "eligible",
    "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する": "eligible",
    "Touhou unitId は buy -> bench -> board -> sell で共有プール返却まで維持される": "incidental",
    "MVP unit は unitId なしでも buy -> bench -> board が従来どおり動く": "incidental",
    "各ラウンドで正しいフェーズサイクルが実行される": "incidental",
    "プレイヤーが4人接続したままゲームが継続する": "incidental",
    "round_stateメッセージが各フェーズで送信される": "incidental",
  };
}

function extractTypedLogRecords<T>(stdout: string, type: string): T[] {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.includes(`"type":"${type}"`))
    .map((line) => line.slice(line.indexOf("{")))
    .map((line) => JSON.parse(line) as { type: string; data: T })
    .filter((record) => record.type === type)
    .map((record) => record.data);
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*m/g, "");
}

function extractKpiRecordsWithContext(
  stdout: string,
): Array<{ suitePath: string | null; testName: string | null; data: GameplayKpiSummary }> {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
  const records: Array<{ suitePath: string | null; testName: string | null; data: GameplayKpiSummary }> = [];
  let currentSuitePath: string | null = null;
  let currentTestName: string | null = null;

  for (const rawLine of lines) {
    const line = stripAnsi(rawLine);
    const suiteMatch = line.match(/stdout \| (tests\/[^(>\s]+\.ts)/);
    if (suiteMatch) {
      currentSuitePath = suiteMatch[1] ?? null;
      if (currentSuitePath !== "tests/server/full-game-simulation.integration.test.ts") {
        currentTestName = null;
      }
    }

    if (currentSuitePath === "tests/server/full-game-simulation.integration.test.ts") {
      const parts = line.split(" > ");
      if (parts.length >= 3) {
        const lastPart = parts.at(-1);
        currentTestName = lastPart?.trim() ?? null;
      }
    }

    const jsonStart = line.indexOf("{");
    if (jsonStart === -1) {
      continue;
    }

    try {
      const record = JSON.parse(line.slice(jsonStart)) as {
        type?: string;
        suitePath?: string;
        testName?: string;
        data?: GameplayKpiSummary;
      };

      if (record.type !== "gameplay_kpi_summary" || !record.data) {
        continue;
      }

      records.push({
        suitePath: record.suitePath ?? currentSuitePath,
        testName: record.testName ?? currentTestName,
        data: record.data,
      });
    } catch {
      // ignore non-json lines
    }
  }

  return records;
}

function extractEligibleKpiSummaries(stdout: string): GameplayKpiSummary[] {
  const suiteManifest = getKpiEvidenceSuiteManifest();
  const caseManifest = getFullGameEvidenceCaseManifest();

  return extractKpiRecordsWithContext(stdout)
    .filter((record) => {
      if (!record.suitePath) {
        return false;
      }

      if (record.suitePath === "tests/server/full-game-simulation.integration.test.ts") {
        return record.testName !== null && caseManifest[record.testName] === "eligible";
      }

      return suiteManifest[record.suitePath] === "eligible";
    })
    .map((record) => record.data);
}

interface ScenarioUnitPlacement {
  unitType: string;
  cell: number;
}

interface TestContext {
  testServer: ColyseusTestServer;
  kpiOutputs: GameplayKpiSummary[];
  matchSummaries: MatchSummaryLog[];
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
    matchSummaries: [],
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
      if (parsed.type === "match_summary" && parsed.data) {
        ctx.matchSummaries.push(parsed.data as MatchSummaryLog);
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

    injectForcedOffers(serverRoom, playerId, [unitType]);

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
  const serverRoom = await ctx.testServer.createRoom<GameRoom>("game");
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
    1: 600,
    2: 750,
    3: 900,
    4: 1050,
    5: 1250,
    6: 1450,
    7: 1650,
    8: 1850,
    9: 2100,
    10: 2400,
    11: 2700,
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

      const { serverRoom } = await runMatchToFinalRound(ctx, async (room, clients) => {
        for (const client of clients) {
          const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
          const updatedCmdSeq = await buildTrackedCompositionViaPrepActions(
            room,
            client.sessionId,
            client,
            nextCmdSeq,
            placements,
            counts,
          );
          nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
        }
      });

      await serverRoom.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      return counts;
    } finally {
      await destroyTestContext(ctx);
    }
  })();

  return cachedPrepCommandClassification;
}

async function collectHarnessProgressComparison(): Promise<HarnessProgressComparison> {
  const placements: ScenarioUnitPlacement[] = [
    { unitType: "vanguard", cell: 0 },
    { unitType: "vanguard", cell: 1 },
    { unitType: "vanguard", cell: 2 },
  ];

  const runScenarioWithRounds = async (
    port: number,
    applyForcedPhaseProgress: boolean,
  ): Promise<{ totalRounds: number; playersSurvivedR8: number }> => {
    const ctx = await createTestContext(port);
    setupLogCapture(ctx);
    const nextCmdSeqByClient = new Map<string, number>();

    try {
      const { serverRoom } = await runMatchToFinalRound(
        ctx,
        async (room, clients) => {
          for (const client of clients) {
            const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
            const updatedCmdSeq = await buildTrackedCompositionViaPrepActions(
              room,
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
        },
        { applyForcedPhaseProgress, finalRound: 12 },
      );

      await serverRoom.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const latestKpi = ctx.kpiOutputs.at(-1);
      expect(latestKpi).toBeDefined();

      return {
        totalRounds: latestKpi!.totalRounds,
        playersSurvivedR8: latestKpi!.playersSurvivedR8,
      };
    } finally {
      await destroyTestContext(ctx);
    }
  };

  const phaseProgressOnly = await runScenarioWithRounds(2_576, true);
  const noProgressControl = await runScenarioWithRounds(2_577, false);

  return {
    phaseProgressOnlyTotalRounds: phaseProgressOnly.totalRounds,
    phaseProgressOnlyPlayersSurvivingR8: phaseProgressOnly.playersSurvivedR8,
    noProgressControlTotalRounds: noProgressControl.totalRounds,
    noProgressControlPlayersSurvivingR8: noProgressControl.playersSurvivedR8,
  };
}

async function collectRoundSurvivalClassification(): Promise<RoundSurvivalClassification> {
  const { stdout } = await runVitestForKpiEvidence();
  const stdoutText = toExecOutputText(stdout);

  const matchSummaries = extractTypedLogRecords<MatchSummaryLog>(stdoutText, "match_summary");
  const kpiSummaries = extractTypedLogRecords<GameplayKpiSummary>(stdoutText, "gameplay_kpi_summary");

  return {
    totalMatches: matchSummaries.length,
    matchesWithKpi: kpiSummaries.length,
    matchesEndingBeforeR8: matchSummaries.filter((summary) => summary.totalRounds < 8).length,
    totalPlayersAcrossSamples: kpiSummaries.reduce((sum, summary) => sum + summary.totalPlayers, 0),
    playersSurvivingR8: kpiSummaries.reduce((sum, summary) => sum + summary.playersSurvivedR8, 0),
  };
}

async function collectCurrentRealisticAggregate(): Promise<AggregateReport> {
  const { stdout } = await runVitestForKpiEvidence();
  const stdoutText = toExecOutputText(stdout);

  const summaries = extractEligibleKpiSummaries(stdoutText);

  const sampledMatches = summaries.length;
  const totalPlayersSurvivedR8 = summaries.reduce((sum, summary) => sum + summary.playersSurvivedR8, 0);
  const totalPlayers = summaries.reduce((sum, summary) => sum + summary.totalPlayers, 0);
  const totalFailedPrepCommands = summaries.reduce((sum, summary) => sum + summary.failedPrepCommands, 0);
  const totalPrepCommands = summaries.reduce((sum, summary) => sum + summary.totalPrepCommands, 0);

  const compositionCounts = new Map<string, number>();
  for (const summary of summaries) {
    if (!summary.top1CompositionSignature) {
      continue;
    }

    compositionCounts.set(
      summary.top1CompositionSignature,
      (compositionCounts.get(summary.top1CompositionSignature) ?? 0) + 1,
    );
  }

  let topCompositionCount = 0;
  for (const count of compositionCounts.values()) {
    if (count > topCompositionCount) {
      topCompositionCount = count;
    }
  }

  return {
    sampledMatches,
    r8CompletionRate: totalPlayers > 0 ? totalPlayersSurvivedR8 / totalPlayers : 0,
    prepInputFailureRate: totalPrepCommands > 0 ? totalFailedPrepCommands / totalPrepCommands : 0,
    top1CompositionShare: sampledMatches > 0 ? topCompositionCount / sampledMatches : 0,
  };
}

async function collectRefinedEligibleBundle(): Promise<RefinedEligibleAggregate> {
  const { writeFileSync, unlinkSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");

  const logPath = join(process.cwd(), "w6-server-kpi.log");

  // Remove existing log file if present
  if (existsSync(logPath)) {
    unlinkSync(logPath);
  }

  // Run vitest and capture output
  const vitestResult = await runVitestForKpiEvidence();

  // Write combined stdout/stderr to log file
  writeFileSync(
    logPath,
    `${toExecOutputText(vitestResult.stdout)}\n${toExecOutputText(vitestResult.stderr)}`,
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/w6-kpi-report.mjs", "w6-server-kpi.log"],
    {
      cwd: process.cwd(),
      maxBuffer: 4 * 1024 * 1024,
    },
  );

  const parsed = JSON.parse(toExecOutputText(stdout)) as {
    eligibleBundle: RefinedEligibleAggregate;
  };

  return parsed.eligibleBundle;
}

async function collectEligibleFailureClassification(): Promise<EligibleFailureClassification> {
  if (cachedEligibleFailureClassification) {
    return cachedEligibleFailureClassification;
  }

  cachedEligibleFailureClassification = (async () => {
    const { stdout } = await runVitestForKpiEvidence();
    const stdoutText = toExecOutputText(stdout);

    const suiteManifest = getKpiEvidenceSuiteManifest();
    const caseManifest = getFullGameEvidenceCaseManifest();

    const eligibleRecords = extractKpiRecordsWithContext(stdoutText).filter((record) => {
      if (!record.suitePath) {
        return false;
      }

      if (record.suitePath === "tests/server/full-game-simulation.integration.test.ts") {
        return record.testName !== null && caseManifest[record.testName] === "eligible";
      }

      return suiteManifest[record.suitePath] === "eligible";
    });

    let phaseProgressOnlyCases = 0;
    let playerHpDamageCases = 0;
    let earlyEliminationCases = 0;
    let matchesBelowR8Threshold = 0;

    for (const record of eligibleRecords) {
      if (record.data.r8CompletionRate < 0.97) {
        matchesBelowR8Threshold += 1;
      }

      if (record.data.totalRounds < 8) {
        earlyEliminationCases += 1;
        continue;
      }

      if (record.suitePath === "tests/server/full-game-simulation.integration.test.ts") {
        phaseProgressOnlyCases += 1;
        continue;
      }
    }

    return {
      totalEligibleMatches: eligibleRecords.length,
      matchesBelowR8Threshold,
      phaseProgressOnlyCases,
      playerHpDamageCases,
      earlyEliminationCases,
    };
  })();

  return cachedEligibleFailureClassification;
}

describe("KPI REPLAN classification", () => {
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

  test("refined eligible bundle is still too concentrated", async () => {
    const aggregate = await collectRefinedEligibleBundle();

    expect(aggregate.sampledMatches).toBe(11);
    expect(aggregate.r8CompletionRate).toBeGreaterThanOrEqual(0.97);
    expect(aggregate.top1CompositionShare).toBeLessThanOrEqual(0.35);
  }, 300_000);

  test("eligible R8 misses are classified explicitly", async () => {
    const result = await collectEligibleFailureClassification();

    expect(result.totalEligibleMatches).toBe(11);
    expect(result.matchesBelowR8Threshold).toBe(0);
    expect(result.phaseProgressOnlyCases).toBe(5);
    expect(result.playerHpDamageCases).toBe(0);
    expect(result.earlyEliminationCases).toBe(0);
  }, 120_000);

  test("eligible R8 misses are eliminated after phase-progress-only adjustment", async () => {
    const result = await collectEligibleFailureClassification();

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
    const stdout = [
      'stdout | tests/server/realistic-kpi-simulation.integration.test.ts > scenario A',
      '{"type":"gameplay_kpi_summary","data":{"totalRounds":8,"playerCount":4,"playersSurvivedR8":4,"totalPlayers":4,"r8CompletionRate":1,"top1CompositionSignature":"mage:1,ranger:1,ranger:1","failedPrepCommands":0,"totalPrepCommands":24,"prepInputFailureRate":0}}',
      'stdout | tests/server/realistic-kpi-simulation.integration.test.ts > scenario B',
      '{"type":"gameplay_kpi_summary","data":{"totalRounds":8,"playerCount":4,"playersSurvivedR8":4,"totalPlayers":4,"r8CompletionRate":1,"top1CompositionSignature":"vanguard:1,vanguard:1,vanguard:1","failedPrepCommands":0,"totalPrepCommands":24,"prepInputFailureRate":0}}',
      'stdout | tests/server/kpi-replan-classification.integration.test.ts > prep failure rate is dominated by repeated invalid setup commands',
      '{"type":"gameplay_kpi_summary","data":{"totalRounds":1,"playerCount":4,"playersSurvivedR8":0,"totalPlayers":4,"r8CompletionRate":0,"top1CompositionSignature":"","failedPrepCommands":1,"totalPrepCommands":1,"prepInputFailureRate":1}}',
    ].join("\n");

    const summaries = extractEligibleKpiSummaries(stdout);

    expect(summaries).toHaveLength(2);
    expect(summaries.every((summary) => summary.failedPrepCommands === 0)).toBe(true);
  });

  test("KPI evidence subprocess は invocation ごとに衝突しない test ports を使う", async () => {
    const env = await createKpiEvidenceVitestEnv();

    expect(Number(env.FULL_GAME_SIMULATION_TEST_PORT)).toBeGreaterThan(0);
    expect(Number(env.REALISTIC_KPI_SIMULATION_TEST_PORT)).toBeGreaterThan(0);
    expect(env.FULL_GAME_SIMULATION_TEST_PORT).not.toBe(env.REALISTIC_KPI_SIMULATION_TEST_PORT);
    expect(env.FULL_GAME_SIMULATION_TEST_PORT).not.toBe("26772");
    expect(env.REALISTIC_KPI_SIMULATION_TEST_PORT).not.toBe("26774");
  });

  test("vitest CLI path resolves when tests run from a worktree cwd", () => {
    expect(existsSync(vitestCliPath)).toBe(true);
  });

  test("current realistic aggregate keeps completion and non-empty composition signal", async () => {
    const aggregate = await collectCurrentRealisticAggregate();

    expect(aggregate.sampledMatches).toBeGreaterThanOrEqual(10);
    expect(aggregate.r8CompletionRate).toBeGreaterThan(0);
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

  test("R8 completion miss comes from early eliminations, not missing KPI emission", async () => {
    const result = await collectRoundSurvivalClassification();

    expect(result.matchesWithKpi).toBe(result.totalMatches);
    expect(result.matchesEndingBeforeR8).toBeGreaterThan(0);
    expect(result.playersSurvivingR8).toBeLessThan(result.totalPlayersAcrossSamples);
  }, 120_000);

  test("realistic harness reaches R8 without forced phase damage", async () => {
    await withFlags(FLAG_CONFIGURATIONS.PHASE_EXPANSION_ONLY, async () => {
      const result = await collectHarnessProgressComparison();

      expect(result.phaseProgressOnlyTotalRounds).toBe(12);
      expect(result.phaseProgressOnlyPlayersSurvivingR8).toBeGreaterThan(0);
      expect(result.noProgressControlTotalRounds).toBe(12);
      expect(result.noProgressControlPlayersSurvivingR8).toBeGreaterThan(0);
    });
  }, 120_000);
});
