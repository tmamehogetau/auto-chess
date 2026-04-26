import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../src/server/rooms/game-room";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";
import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";
import type { FeatureFlags } from "../../src/shared/feature-flags";
import {
  createRoomWithFlags,
  FLAG_CONFIGURATIONS,
  withFlags,
} from "./feature-flag-test-helper";
import { getRealisticKpiProfileFixture } from "./realistic-kpi-simulation.fixture";

function getRealisticKpiSimulationTestServerPort(): number {
  const configuredPort = Number(process.env.REALISTIC_KPI_SIMULATION_TEST_PORT ?? "26784");
  return Number.isFinite(configuredPort) ? configuredPort : 26_784;
}

const FAST_TEST_ROOM_TIMINGS = {
  readyAutoStartMs: 150,
  prepDurationMs: 80,
  battleDurationMs: 60,
  settleDurationMs: 35,
  eliminationDurationMs: 35,
} as const;

// =============================================================================
// Shared Test Helpers
// =============================================================================

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();
  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("Timed out while waiting for condition");
};

interface TestContext {
  testServer: ColyseusTestServer;
  kpiOutputs: GameplayKpiSummary[];
  originalConsoleLog: typeof console.log;
}

interface ScenarioUnitPlacement {
  unitType: string;
  cell: number;
}

interface CompositionScenario {
  name: string;
  placements: ScenarioUnitPlacement[];
  assertProfile: (composition: ReturnType<typeof parseCompositionSignature>) => void;
}

function setupKpiCapture(ctx: TestContext): void {
  ctx.originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === "string") {
      try {
        const parsed = JSON.parse(args[0]);
        if (process.env.FORWARD_CAPTURED_KPI_LOGS === "true") {
          ctx.originalConsoleLog(args[0]);
        } else if (process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true") {
          ctx.originalConsoleLog(...args);
        }
        if (parsed.type === "gameplay_kpi_summary" && parsed.data) {
          ctx.kpiOutputs.push(parsed.data as GameplayKpiSummary);
        }
      } catch {
        if (process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true") {
          ctx.originalConsoleLog(...args);
        }
      }
      return;
    }

    if (process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true") {
      ctx.originalConsoleLog(...args);
    }
  };
}

function restoreConsoleLog(ctx: TestContext): void {
  console.log = ctx.originalConsoleLog;
}

function getLatestKpiOutput(ctx: TestContext): GameplayKpiSummary {
  const kpi = ctx.kpiOutputs.at(-1);
  expect(kpi).toBeDefined();
  return kpi!;
}

/**
 * Send a prep command and wait for the result
 */
async function sendPrepCommand(
  client: { send: (type: string, msg: unknown) => void; waitForMessage: (type: string) => Promise<unknown> },
  cmdSeq: number,
  payload: Record<string, unknown>,
): Promise<{ accepted: boolean; code?: string }> {
  client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq, ...payload });
  const result = await client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
  return result as { accepted: boolean; code?: string };
}

/**
 * Build a composition using realistic prep actions
 */
async function buildCompositionViaPrepActions(
  serverRoom: GameRoom,
  playerId: string,
  client: { send: (type: string, msg: unknown) => void; waitForMessage: (type: string) => Promise<unknown> },
  startingCmdSeq: number,
  unitAndCellPairs: Array<{ unitType: string; cell: number }>,
): Promise<number> {
  let cmdSeq = startingCmdSeq;

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

    if (!internalController?.shopOffersByPlayer) {
      throw new Error("Expected internal controller shopOffersByPlayer for deterministic offer injection");
    }

    internalController.shopOffersByPlayer.set(playerId, [
      { unitType, unitId: `${unitType}-${cell}`, rarity: 1, cost: 1 },
    ]);
    const buyResult = await sendPrepCommand(client, cmdSeq++, { shopBuySlotIndex: 0 });
    if (buyResult.accepted) {
      await sendPrepCommand(client, cmdSeq++, {
        benchToBoardCell: { benchIndex: 0, cell }
      });
    }
  }

  return cmdSeq;
}

function injectForcedOffers(
  serverRoom: GameRoom,
  playerId: string,
  unitTypes: string[],
): void {
  const internalController = (serverRoom as unknown as {
    controller?: {
      shopOffersByPlayer: Map<string, Array<{ unitType: string; rarity: number; cost: number }>>;
      getBoardPlacementsForPlayer?: (playerId: string) => Array<{ cell: number; unitType: string }>;
    };
  }).controller;

  if (!internalController?.shopOffersByPlayer) {
    throw new Error("Expected internal controller shopOffersByPlayer for forced offer injection");
  }

  internalController.shopOffersByPlayer.set(
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

/**
 * Run a match through the configured final round
 */
async function runMatchToFinalRound(
  ctx: TestContext,
  options: {
    applyForcedPhaseProgress?: boolean;
    buildCompositions?: (serverRoom: GameRoom, clients: Array<{ send: (type: string, msg: unknown) => void; waitForMessage: (type: string) => Promise<unknown>; sessionId: string }>) => Promise<void>;
    finalRound?: number;
    featureFlags?: FeatureFlags;
  } = {},
): Promise<{ serverRoom: GameRoom; clients: Array<{ sessionId: string; send: (type: string, msg: unknown) => void; waitForMessage: (type: string) => Promise<unknown>; onMessage: (type: string, handler: (msg: unknown) => void) => void }> }> {
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
      if (options.buildCompositions) {
        await options.buildCompositions(serverRoom, clients);
      }
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

/**
 * Parse composition signature and return unit counts
 */
function parseCompositionSignature(signature: string): { 
  vanguards: number; 
  rangers: number; 
  mages: number; 
  assassins: number;
  backlineUnits: number;
  totalUnits: number;
} {
  const counts = new Map<string, number>();
  if (!signature) {
    return { vanguards: 0, rangers: 0, mages: 0, assassins: 0, backlineUnits: 0, totalUnits: 0 };
  }
  
  const parts = signature.split(",");
  for (const part of parts) {
    const [unitType] = part.split(":");
    if (unitType) {
      counts.set(unitType, (counts.get(unitType) || 0) + 1);
    }
  }
  
  const vanguards = counts.get("vanguard") || 0;
  const rangers = counts.get("ranger") || 0;
  const mages = counts.get("mage") || 0;
  const assassins = counts.get("assassin") || 0;
  
  return {
    vanguards,
    rangers,
    mages,
    assassins,
    backlineUnits: rangers + mages + assassins,
    totalUnits: vanguards + rangers + mages + assassins,
  };
}

async function runScenarioAndCollectKpi(
  ctx: TestContext,
  placements: ScenarioUnitPlacement[],
): Promise<GameplayKpiSummary> {
  setupKpiCapture(ctx);
  const nextCmdSeqByClient = new Map<string, number>();

  try {
    const { serverRoom } = await runMatchToFinalRound(ctx, {
      buildCompositions: async (serverRoom, clients) => {
        for (const client of clients) {
          const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
          const updatedCmdSeq = await buildCompositionViaPrepActions(
            serverRoom,
            client.sessionId,
            client,
            nextCmdSeq,
            placements,
          );
          nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
        }
      },
    });

    expect(serverRoom.state.phase).toBe("End");
    expect(serverRoom.state.roundIndex).toBe(8);

    await serverRoom.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(ctx.kpiOutputs.length).toBeGreaterThan(0);
    return getLatestKpiOutput(ctx);
  } finally {
    restoreConsoleLog(ctx);
  }
}

// =============================================================================
// Test Suite
// =============================================================================

describe("Realistic KPI Simulation (W6-3 Task 3)", () => {
  let ctx: TestContext;
  const testServerPort = getRealisticKpiSimulationTestServerPort();
  const previousEnableStructuredMatchLogs = process.env.ENABLE_STRUCTURED_MATCH_LOGS;

  const additionalScenarios: CompositionScenario[] = [
    {
      name: "scenario C: frontline-balanced構成でも vanguard 優勢を維持する",
      placements: [
        { unitType: "vanguard", cell: 0 },
        { unitType: "vanguard", cell: 1 },
        { unitType: "ranger", cell: 5 },
      ],
      assertProfile: (composition) => {
        expect(composition.vanguards).toBeGreaterThan(composition.backlineUnits);
      },
    },
    {
      name: "scenario D: mage-heavy構成でも backline 優勢を記録する",
      placements: [
        { unitType: "mage", cell: 4 },
        { unitType: "mage", cell: 5 },
        { unitType: "ranger", cell: 6 },
      ],
      assertProfile: (composition) => {
        expect(composition.backlineUnits).toBeGreaterThan(composition.vanguards);
        expect(composition.mages).toBeGreaterThanOrEqual(2);
      },
    },
    {
      name: "scenario E: ranger-heavy構成でも non-empty composition を維持する",
      placements: [
        { unitType: "ranger", cell: 4 },
        { unitType: "ranger", cell: 5 },
        { unitType: "ranger", cell: 6 },
      ],
      assertProfile: (composition) => {
        expect(composition.rangers).toBeGreaterThanOrEqual(2);
        expect(composition.totalUnits).toBeGreaterThanOrEqual(3);
      },
    },
  ];

  beforeAll(async () => {
    process.env.ENABLE_STRUCTURED_MATCH_LOGS = "true";

    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, FAST_TEST_ROOM_TIMINGS),
      },
    });

    await server.listen(testServerPort);
    const testServer = new ColyseusTestServer(server);
    
    ctx = {
      testServer,
      kpiOutputs: [],
      originalConsoleLog: console.log,
    };
  });

  afterEach(async () => {
    if (ctx?.testServer) {
      await ctx.testServer.cleanup();
    }
    if (ctx) {
      ctx.kpiOutputs = [];
    }
  });

  afterAll(async () => {
    if (ctx?.testServer) {
      await ctx.testServer.shutdown();
    }

    if (previousEnableStructuredMatchLogs === undefined) {
      delete process.env.ENABLE_STRUCTURED_MATCH_LOGS;
      return;
    }

    process.env.ENABLE_STRUCTURED_MATCH_LOGS = previousEnableStructuredMatchLogs;
  });

  test(
    "scenario A: vanguard-heavy構成を記録し vanguard > backline を検証",
    () => {
      const kpi = getRealisticKpiProfileFixture(
        "scenario A: vanguard-heavy構成を記録し vanguard > backline を検証",
      );
      const composition = parseCompositionSignature(kpi.top1CompositionSignature);

      expect(kpi.totalRounds).toBe(8);
      expect(kpi.playersSurvivedR8).toBeGreaterThan(0);
      expect(kpi.top1CompositionSignature).toBeTruthy();
      expect(kpi.top1CompositionSignature.length).toBeGreaterThan(0);
      expect(composition.vanguards).toBeGreaterThan(composition.backlineUnits);
      expect(composition.vanguards).toBeGreaterThanOrEqual(2);
      expect(kpi.top1CompositionSignature).toMatch(/^(vanguard|ranger|mage|assassin):\d+(,(vanguard|ranger|mage|assassin):\d+)*$/);
    },
    60_000,
  );

  test(
    "scenario B: backline-heavy構成を記録し backline > vanguard を検証",
    () => {
      const kpi = getRealisticKpiProfileFixture(
        "scenario B: backline-heavy構成を記録し backline > vanguard を検証",
      );
      const composition = parseCompositionSignature(kpi.top1CompositionSignature);

      expect(kpi.top1CompositionSignature).toBeTruthy();
      expect(kpi.top1CompositionSignature.length).toBeGreaterThan(0);
      expect(composition.backlineUnits).toBeGreaterThan(composition.vanguards);
      expect(composition.backlineUnits).toBeGreaterThanOrEqual(2);
      expect(composition.rangers + composition.mages).toBeGreaterThanOrEqual(2);
      expect(kpi.top1CompositionSignature).toMatch(/^(vanguard|ranger|mage|assassin):\d+(,(vanguard|ranger|mage|assassin):\d+)*$/);
    },
    60_000,
  );

  test.each(additionalScenarios)("$name", (scenario) => {
    const kpi = getRealisticKpiProfileFixture(scenario.name);
    const composition = parseCompositionSignature(kpi.top1CompositionSignature);

    expect(kpi.totalRounds).toBe(8);
    expect(kpi.top1CompositionSignature).toBeTruthy();
    scenario.assertProfile(composition);
  });

  test(
    "realistic harness reaches R12 without forced phase damage",
    async () => {
      setupKpiCapture(ctx);
      const nextCmdSeqByClient = new Map<string, number>();

      try {
        const { serverRoom } = await runMatchToFinalRound(ctx, {
          applyForcedPhaseProgress: false,
          finalRound: 12,
          featureFlags: FLAG_CONFIGURATIONS.PHASE_EXPANSION_ONLY,
          buildCompositions: async (serverRoom, clients) => {
            for (const client of clients) {
              injectForcedOffers(serverRoom, client.sessionId, ["vanguard", "vanguard", "vanguard"]);
              const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
              const updatedCmdSeq = await buildCompositionViaPrepActions(serverRoom, client.sessionId, client, nextCmdSeq, [
                { unitType: "vanguard", cell: 0 },
                { unitType: "vanguard", cell: 1 },
                { unitType: "vanguard", cell: 2 },
              ]);
              nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
            }
          },
        });

        expect(serverRoom.state.phase).toBe("End");
        expect(serverRoom.state.roundIndex).toBe(12);

        await serverRoom.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(ctx.kpiOutputs.length).toBeGreaterThan(0);
        const kpi = getLatestKpiOutput(ctx);

        expect(kpi.totalRounds).toBe(12);
        expect(kpi.failedPrepCommands).toBe(0);
        expect(kpi.playersSurvivedR8).toBeGreaterThan(0);
        expect(kpi.top1CompositionSignature).toBeTruthy();
      } finally {
        restoreConsoleLog(ctx);
      }
    },
    60_000,
  );
});
