import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../src/server/rooms/game-room";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";
import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";

function getRealisticKpiSimulationTestServerPort(): number {
  const configuredPort = Number(process.env.REALISTIC_KPI_SIMULATION_TEST_PORT ?? "2574");
  return Number.isFinite(configuredPort) ? configuredPort : 2_574;
}

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
    ctx.originalConsoleLog(...args);
    if (args.length === 1 && typeof args[0] === "string") {
      try {
        const parsed = JSON.parse(args[0]);
        if (parsed.type === "gameplay_kpi_summary" && parsed.data) {
          ctx.kpiOutputs.push(parsed.data as GameplayKpiSummary);
        }
      } catch {
        // Not JSON, ignore
      }
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

    injectForcedOffers(serverRoom, playerId, [unitType]);
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

/**
 * Run a match from R1 to R8
 */
async function runMatchToR8(
  ctx: TestContext,
  options: {
    buildCompositions?: (serverRoom: GameRoom, clients: Array<{ send: (type: string, msg: unknown) => void; waitForMessage: (type: string) => Promise<unknown>; sessionId: string }>) => Promise<void>;
  } = {},
): Promise<{ serverRoom: GameRoom; clients: Array<{ sessionId: string; send: (type: string, msg: unknown) => void; waitForMessage: (type: string) => Promise<unknown>; onMessage: (type: string, handler: (msg: unknown) => void) => void }> }> {
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
    1: 600, 2: 750, 3: 900, 4: 1050, 5: 1250, 6: 1450, 7: 1650, 8: 1850,
  };

  let lastRound = 0;
  const maxDuration = 50_000;
  const startTime = Date.now();

  while (
    serverRoom.state.phase !== "End" &&
    serverRoom.state.roundIndex < 9 &&
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
    if (target !== undefined) {
      serverRoom.setPendingPhaseDamageForTest(target);
    }

    if (serverRoom.state.roundIndex < 8) {
      await waitForCondition(() => serverRoom.state.phase === "Prep", 5_000);
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
    const { serverRoom } = await runMatchToR8(ctx, {
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
  });

  test(
    "scenario A: vanguard-heavy構成を記録し vanguard > backline を検証",
    async () => {
      setupKpiCapture(ctx);
      const nextCmdSeqByClient = new Map<string, number>();

      try {
        const { serverRoom } = await runMatchToR8(ctx, {
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
          }
        });

        expect(serverRoom.state.phase).toBe("End");
        expect(serverRoom.state.roundIndex).toBe(8);

        await serverRoom.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(ctx.kpiOutputs.length).toBeGreaterThan(0);
        const kpi = getLatestKpiOutput(ctx);

        // 基本検証
        expect(kpi.totalRounds).toBe(8);
        expect(kpi.playersSurvivedR8).toBeGreaterThan(0);
        expect(kpi.top1CompositionSignature).toBeTruthy();
        expect(kpi.top1CompositionSignature.length).toBeGreaterThan(0);

        // SCENARIO A: 勝者の構成を解析
        const composition = parseCompositionSignature(kpi.top1CompositionSignature);
        
        ctx.originalConsoleLog(`[Scenario A] Winner: ${kpi.top1CompositionSignature}`);
        ctx.originalConsoleLog(`[Scenario A] Vanguards: ${composition.vanguards}, Backline: ${composition.backlineUnits}`);
        
        // 強化された検証: vanguard-heavy構成
        expect(composition.vanguards).toBeGreaterThan(composition.backlineUnits);
        expect(composition.vanguards).toBeGreaterThanOrEqual(2);
        
        // フォーマット検証
        expect(kpi.top1CompositionSignature).toMatch(/^(vanguard|ranger|mage|assassin):\d+(,(vanguard|ranger|mage|assassin):\d+)*$/);
      } finally {
        restoreConsoleLog(ctx);
      }
    },
    60_000,
  );

  test(
    "scenario B: backline-heavy構成を記録し backline > vanguard を検証",
    async () => {
      setupKpiCapture(ctx);
      const nextCmdSeqByClient = new Map<string, number>();

      try {
        const { serverRoom } = await runMatchToR8(ctx, {
          buildCompositions: async (serverRoom, clients) => {
            for (const client of clients) {
              const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
              const updatedCmdSeq = await buildCompositionViaPrepActions(serverRoom, client.sessionId, client, nextCmdSeq, [
                { unitType: "ranger", cell: 4 },
                { unitType: "mage", cell: 5 },
                { unitType: "ranger", cell: 6 },
              ]);
              nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
            }
          }
        });

        expect(serverRoom.state.phase).toBe("End");
        expect(serverRoom.state.roundIndex).toBe(8);

        await serverRoom.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(ctx.kpiOutputs.length).toBeGreaterThan(0);
        const kpi = getLatestKpiOutput(ctx);

        // 基本検証
        expect(kpi.top1CompositionSignature).toBeTruthy();
        expect(kpi.top1CompositionSignature.length).toBeGreaterThan(0);

        // SCENARIO B: 勝者の構成を解析
        const composition = parseCompositionSignature(kpi.top1CompositionSignature);
        
        ctx.originalConsoleLog(`[Scenario B] Winner: ${kpi.top1CompositionSignature}`);
        ctx.originalConsoleLog(`[Scenario B] Vanguards: ${composition.vanguards}, Rangers: ${composition.rangers}, Total backline: ${composition.backlineUnits}`);
        
        // 強化された検証: backline-heavy構成
        expect(composition.backlineUnits).toBeGreaterThan(composition.vanguards);
        expect(composition.backlineUnits).toBeGreaterThanOrEqual(2);
        
        // ranger/mage 系の構成であることを検証
        expect(composition.rangers + composition.mages).toBeGreaterThanOrEqual(2);
        
        // フォーマット検証
        expect(kpi.top1CompositionSignature).toMatch(/^(vanguard|ranger|mage|assassin):\d+(,(vanguard|ranger|mage|assassin):\d+)*$/);
      } finally {
        restoreConsoleLog(ctx);
      }
    },
    60_000,
  );

  test.each(additionalScenarios)("$name", async (scenario) => {
    const kpi = await runScenarioAndCollectKpi(ctx, scenario.placements);
    const composition = parseCompositionSignature(kpi.top1CompositionSignature);

    expect(kpi.totalRounds).toBe(8);
    expect(kpi.top1CompositionSignature).toBeTruthy();
    scenario.assertProfile(composition);
  });
});
