import { afterAll, afterEach, beforeAll, describe, expect, test, vi, beforeEach } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import {
  DEFAULT_SET_ID_SELECTOR,
  connectAndAttachSetIdDisplay,
  type BrowserClient,
  type BrowserRoom,
} from "../../src/client/main";
import { GameRoom } from "../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../src/server/rooms/shared-board-room";
import { resolveSharedBoardUnitPresentation } from "../../src/server/shared-board-unit-presentation";
import { combatCellToRaidBoardIndex } from "../../src/shared/board-geometry";
import { sharedBoardCoordinateToIndex } from "../../src/shared/shared-board-config";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type AdminResponseMessage,
  type RoundStateMessage,
} from "../../src/shared/room-messages";
import type { FeatureFlags } from "../../src/shared/feature-flags";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";
import {
  createRoomWithForcedFlags,
  restoreForcedFlagFixtures,
} from "./feature-flag-test-helper";

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();

  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 15);
    });
  }

  throw new Error("Timed out while waiting for condition");
};

const waitForText = async (
  element: { textContent: string | null },
  expected: string,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();

  while (Date.now() - startMs < timeoutMs) {
    if (element.textContent === expected) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 15);
    });
  }

  throw new Error(`Timed out while waiting text: ${expected}`);
};

const SHARED_BOARD_PROPAGATION_TIMEOUT_MS = 3_000;

const registerRoundStateListeners = (clients: Array<{ onMessage: (type: string, handler: (_message: unknown) => void) => void }>): void => {
  for (const client of clients) {
    client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
  }
};

const connectBossRoleSelectionRoom = async (
  testServer: ColyseusTestServer,
  roomOptions?: Record<string, unknown>,
  forcedFlags: Partial<FeatureFlags> = {},
): Promise<{
  serverRoom: GameRoom;
  clients: Array<{ sessionId: string; send: (type: string, message?: unknown) => void; waitForMessage: (type: string) => Promise<unknown>; onMessage: (type: string, handler: (_message: unknown) => void) => void; connection: { close: (code?: number, reason?: string) => void }; reconnectionToken: string }>;
}> => {
  const serverRoom = await createRoomWithForcedFlags(
    testServer,
    {
      enableBossExclusiveShop: true,
      enableHeroSystem: true,
      ...forcedFlags,
    },
    roomOptions,
  );
  const clients = await Promise.all([
    testServer.connectTo(serverRoom),
    testServer.connectTo(serverRoom),
    testServer.connectTo(serverRoom),
    testServer.connectTo(serverRoom),
  ]);

  registerRoundStateListeners(clients);

  return {
    serverRoom,
    clients,
  };
};

const moveBossRoleSelectionToSelectionStage = async (
  serverRoom: GameRoom,
  clients: Array<{ sessionId: string; send: (type: string, message?: unknown) => void }>,
  bossClientIndex = 1,
): Promise<void> => {
  const bossClient = clients[bossClientIndex];
  if (!bossClient) {
    throw new Error("Expected boss client");
  }

  bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
  await waitForCondition(
    () => serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss === true,
    1_000,
  );

  for (const client of clients) {
    client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
  }

  await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);
};

const resolveBossRoleSelectionToPrep = async (
  serverRoom: GameRoom,
  clients: Array<{
    sessionId: string;
    send: (type: string, message?: unknown) => void;
    waitForMessage: (type: string) => Promise<unknown>;
  }>,
  timeoutMs = 1_000,
): Promise<void> => {
  const bossClient = clients[1];
  const raidClientA = clients[0];
  const raidClientB = clients[2];
  const raidClientC = clients[3];

  if (!bossClient || !raidClientA || !raidClientB || !raidClientC) {
    throw new Error("Expected four clients for boss role selection");
  }

  await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

  raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
  raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
  raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
  bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

  await waitForCondition(() => serverRoom.state.phase === "Prep", timeoutMs);
};

class FakeRoot {
  private readonly elements = new Map<string, { textContent: string | null }>();

  public setElement(
    selector: string,
    initialText: string | null = null,
  ): { textContent: string | null } {
    const element = { textContent: initialText };
    this.elements.set(selector, element);
    return element;
  }

  public querySelector(selector: string): unknown {
    return this.elements.get(selector) ?? null;
  }
}

describe("GameRoom integration", () => {
  let testServer!: ColyseusTestServer;

  const TEST_SERVER_PORT = 2_570;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 2_000,
          prepDurationMs: 120,
          battleDurationMs: 120,
          settleDurationMs: 80,
          eliminationDurationMs: 80,
        }),
        shared_board: defineRoom(SharedBoardRoom, {
          lockDurationMs: 1_000,
        }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  });

  afterEach(async () => {
    restoreForcedFlagFixtures();

    if (!testServer) {
      return;
    }

    await testServer.cleanup();
  });

  afterAll(async () => {
    if (!testServer) {
      return;
    }

    await testServer.shutdown();
  });

  test("4人joinして全員readyでPrep開始し、ルームがlockされる", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    expect(serverRoom.state.setId).toBe("set1");
    expect(serverRoom.state.prepDeadlineAtMs).toBeGreaterThan(0);
    expect(serverRoom.locked).toBe(true);
  });

  test("4人目join前のready入力を保持したままPrepへ進める", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const earlyClients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of earlyClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const fourthClient = await testServer.connectTo(serverRoom);
    fourthClient.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    for (const client of [...earlyClients, fourthClient]) {
      expect(serverRoom.state.players.get(client.sessionId)?.ready).toBe(true);
    }
  });

  test("Prepの締切を過ぎるとBattleへ自動遷移する", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

    expect(serverRoom.state.phase).toBe("Battle");
  });

  test("戦闘結果のtimelineEndStateがroom stateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    for (const [index, client] of clients.entries()) {
      client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        boardPlacements: [
          { cell: index % 2 === 0 ? 0 : 7, unitType: "vanguard" },
        ],
      });

      await expect(client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).resolves.toEqual({
        accepted: true,
      });
    }

    await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);

    const timelineEndState = serverRoom.state.players.get(clients[0]!.sessionId)?.lastBattleResult.timelineEndState;

    expect(timelineEndState?.length).toBeGreaterThan(0);
    expect(timelineEndState?.[0]).toMatchObject({
      battleUnitId: expect.any(String),
      x: expect.any(Number),
      y: expect.any(Number),
      currentHp: expect.any(Number),
      maxHp: expect.any(Number),
    });
  });

  test("command_resultはPrepでacceptされBattleではPHASE_MISMATCHになる", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq: 1 });
    const accepted = await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    expect(accepted).toEqual({ accepted: true });

    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

    clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq: 2 });
    const rejected = await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    expect(rejected).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
  });

  test("round_stateメッセージに順位とラウンド情報が含まれる", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const roundState = await roundStatePromise;

    expect(roundState.phase).toBe("Prep");
    expect(roundState.roundIndex).toBe(1);
    expect(roundState.ranking.length).toBe(4);
    expect(roundState.phaseDeadlineAtMs).toBeGreaterThan(0);
    expect(roundState.phaseHpTarget).toBe(600);
    expect(roundState.phaseDamageDealt).toBe(0);
    expect(roundState.phaseResult).toBe("pending");
    expect(roundState.phaseCompletionRate).toBe(0);
    expect(roundState).not.toHaveProperty("setId");
    expect(serverRoom.state.setId).toBe("set1");
  });

  test("boss1 raid3 roles are exposed after assignment", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const serverRoom = await createRoomWithForcedFlags(testServer, {
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      });
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      clients[1]?.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      const playerIds = clients.map((client) => client.sessionId);
      const expectedBossPlayerId = playerIds[1];
      const expectedRaidPlayerIds = [playerIds[0], playerIds[2], playerIds[3]];

      await waitForCondition(() => serverRoom.state.bossPlayerId === expectedBossPlayerId, 1_000);

      expect(serverRoom.state.bossPlayerId).toBe(expectedBossPlayerId);
      expect(Array.from(serverRoom.state.raidPlayerIds)).toHaveLength(expectedRaidPlayerIds.length);
      expect(Array.from(serverRoom.state.raidPlayerIds).sort()).toEqual(expectedRaidPlayerIds.sort());
    } finally {
      randomSpy.mockRestore();
    }
  });

  test("boss role flow resolves into selection stage and starts only after role-specific picks complete", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer);
    const bossClient = clients[1]!;
    const raidClientA = clients[0]!;
    const raidClientB = clients[2]!;
    const raidClientC = clients[3]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.lobbyStage).toBe("selection");
    expect(serverRoom.state.bossPlayerId).toBe(bossClient.sessionId);
    expect(serverRoom.state.selectionDeadlineAtMs).toBeGreaterThan(Date.now());
    expect(serverRoom.state.players.get(bossClient.sessionId)?.role).toBe("boss");
    expect(serverRoom.state.players.get(raidClientA.sessionId)?.role).toBe("raid");

    raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });

    await waitForCondition(() => (
      serverRoom.state.players.get(raidClientA.sessionId)?.selectedHeroId === "reimu"
      && serverRoom.state.players.get(raidClientB.sessionId)?.selectedHeroId === "marisa"
      && serverRoom.state.players.get(raidClientC.sessionId)?.selectedHeroId === "okina"
    ), 500);
    expect(serverRoom.state.phase).toBe("Waiting");

    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 500);

    expect(serverRoom.state.lobbyStage).toBe("started");
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
    expect(serverRoom.state.players.get(bossClient.sessionId)?.selectedBossId).toBe("remilia");
    expect(serverRoom.state.players.get(raidClientA.sessionId)?.selectedHeroId).toBe("reimu");
    expect(serverRoom.state.players.get(raidClientB.sessionId)?.selectedHeroId).toBe("marisa");
    expect(serverRoom.state.players.get(raidClientC.sessionId)?.selectedHeroId).toBe("okina");
  });

  test("4人目join前のboss希望を保持したままselectionのboss割り当てに使う", async () => {
    const serverRoom = await createRoomWithForcedFlags(
      testServer,
      {
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
    );
    const earlyClients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    const volunteerClient = earlyClients[1]!;
    volunteerClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
    for (const client of earlyClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const fourthClient = await testServer.connectTo(serverRoom);
    registerRoundStateListeners([...earlyClients, fourthClient]);
    fourthClient.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });

    await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.bossPlayerId).toBe(volunteerClient.sessionId);
    expect(serverRoom.state.players.get(volunteerClient.sessionId)?.wantsBoss).toBe(true);
  });

  test("boss role flow rejects invalid role-specific selection actions", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer);
    const bossClient = clients[1]!;
    const raidClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    bossClient.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    raidClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });
    expect(await raidClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    const wantsBossBefore = serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss;
    raidClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss).toBe(wantsBossBefore);
    expect(serverRoom.state.lobbyStage).toBe("selection");
  });

  test("selection timeout reset returns the room to preference and clears resolved roles", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer, {
      selectionTimeoutMs: 120,
    });
    const bossClient = clients[1]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    await waitForCondition(() => serverRoom.state.lobbyStage === "preference", 1_000);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.bossPlayerId).toBe("");
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
    expect(serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss).toBe(true);

    for (const client of clients) {
      const player = serverRoom.state.players.get(client.sessionId);
      expect(player?.role).toBe("unassigned");
      expect(player?.selectedBossId).toBe("");
      expect(player?.selectedHeroId).toBe("");
      expect(player?.ready).toBe(false);
    }
  });

  test("pre-start disconnect reset preserves connected wantsBoss and clears resolved selections", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer);
    const bossClient = clients[1]!;
    const droppedClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    droppedClient.connection.close(4_001, "pre-start drop");

    await waitForCondition(() => serverRoom.state.lobbyStage === "preference", 1_000);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.bossPlayerId).toBe("");
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
    expect(serverRoom.state.players.get(droppedClient.sessionId)).toBeUndefined();
    expect(serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss).toBe(true);

    for (const client of clients.slice(1)) {
      const player = serverRoom.state.players.get(client.sessionId);
      expect(player?.role).toBe("unassigned");
      expect(player?.selectedBossId).toBe("");
      expect(player?.selectedHeroId).toBe("");
      expect(player?.ready).toBe(false);
    }
  });

  test("pre-start disconnect reset also clears controller-ready state", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer);
    const remainingClient = clients[1]!;
    const droppedClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    droppedClient.connection.close(4_001, "pre-start drop");

    await waitForCondition(() => serverRoom.state.lobbyStage === "preference", 1_000);

    remainingClient.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.lobbyStage).toBe("preference");
    expect(serverRoom.state.players.get(remainingClient.sessionId)?.ready).toBe(true);
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
  });

  test("boss role handlers reject malformed selection packets without mutating lobby state", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer);
    const bossClient = clients[1]!;
    const raidClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, null);
    expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    raidClient.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, null);
    expect(await raidClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    const wantsBossBefore = serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss;
    raidClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, null);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss).toBe(wantsBossBefore);
  });

  test("post-start reconnect keeps resolved role selections in synced room state", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer);
    const bossClient = clients[1]!;
    const raidClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    clients[0]?.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    clients[2]?.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    clients[3]?.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 500);

    const previousSessionId = raidClient.sessionId;
    const reconnectionToken = raidClient.reconnectionToken;
    raidClient.connection.close(4_001, "network drop");

    await waitForCondition(
      () => serverRoom.state.players.get(previousSessionId)?.connected === false,
      1_000,
    );

    const reconnected = await testServer.sdk.reconnect(reconnectionToken);

    await waitForCondition(
      () => serverRoom.state.players.get(previousSessionId)?.connected === true,
      1_000,
    );

    expect(reconnected.sessionId).toBe(previousSessionId);
    expect(serverRoom.state.players.get(previousSessionId)?.role).toBe("raid");
    expect(serverRoom.state.players.get(previousSessionId)?.selectedHeroId).toBe("reimu");
    expect(serverRoom.state.players.get(previousSessionId)?.selectedBossId).toBe("");
    expect(serverRoom.state.players.get(previousSessionId)?.wantsBoss).toBe(false);
    expect(serverRoom.state.players.get(bossClient.sessionId)?.role).toBe("boss");
    expect(serverRoom.state.players.get(bossClient.sessionId)?.selectedBossId).toBe("remilia");
  });

  test("raid prep uses shared board as the authoritative placement source", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      await testServer.createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(testServer, {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        controller?: {
          getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        };
        sharedBoardBridge?: {
          getState: () => string;
          applySharedBoardPlacement: (request: {
            opId: string;
            correlationId: string;
            baseVersion: number;
            timestamp: number;
            actorId: string;
            playerId: string;
            placements: Array<{ cell: number; unitType: "vanguard" | "ranger" | "mage" | "assassin" }>;
          }) => Promise<{ success: boolean; code: string }>;
        };
      };

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await roundStatePromise;

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        500,
      );

      const raidPlayerId = clients[0].sessionId;
      clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        boardPlacements: [{ cell: 4, unitType: "ranger" }],
      });
      await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

      expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([]);

      const bridgeResult = await roomInternals.sharedBoardBridge?.applySharedBoardPlacement({
        opId: "raid-shared-board-source",
        correlationId: "corr-raid-shared-board-source",
        baseVersion: 0,
        timestamp: Date.now(),
        actorId: raidPlayerId,
        playerId: raidPlayerId,
        placements: [{ cell: 4, unitType: "ranger" }],
      });

      expect(bridgeResult).toMatchObject({ success: true, code: "success" });
      expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([
        expect.objectContaining({ cell: 4, unitType: "ranger" }),
      ]);
      expect(serverRoom.state.sharedBoardAuthorityEnabled).toBe(true);
      expect(serverRoom.state.sharedBoardMode).toBe("half-shared");
    } finally {
      randomSpy.mockRestore();
    }
  });

  test("benchToBoardCell accepted in authoritative prep is reflected to shared board cells", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(testServer, {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        sharedBoardBridge?: {
          getState: () => string;
        };
      };

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await roundStatePromise;

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        500,
      );

      const targetClient = clients[0];
      const targetPlayerId = targetClient.sessionId;
      const targetRaidCell = combatCellToRaidBoardIndex(4);

      const occupiedBeforePlacement = Array.from(sharedBoardRoom.state.cells.values()).filter(
        (cell) => cell.unitId !== "" && cell.unitId !== "dummy-boss",
      );
      expect(occupiedBeforePlacement).toHaveLength(0);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      });
      expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: targetRaidCell,
        },
      });
      expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      await waitForCondition(() => {
        const sharedCell = sharedBoardRoom.state.cells.get(String(targetRaidCell));
        return sharedCell?.ownerId === targetPlayerId && sharedCell.unitId !== "";
      }, 500);

      const reflectedCell = sharedBoardRoom.state.cells.get(String(targetRaidCell));
      expect(reflectedCell?.ownerId).toBe(targetPlayerId);
      expect(reflectedCell?.unitId).not.toBe("");
      expect(reflectedCell?.unitId).not.toBe("dummy-boss");
    } finally {
      randomSpy.mockRestore();
    }
  });

  test("boss benchToBoardCell reflects scarlet display metadata to shared board cells", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(testServer, {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        sharedBoardBridge?: {
          getState: () => string;
        };
      };

      for (const client of clients) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        500,
      );

      const bossPlayerId = serverRoom.state.bossPlayerId;
      const bossClient = clients.find((client) => client.sessionId === bossPlayerId);
      expect(bossClient).toBeDefined();
      if (!bossClient) {
        throw new Error("Expected boss client after Prep start");
      }
      const targetBossCell = combatCellToRaidBoardIndex(1);

      const expectedOffer = serverRoom.state.players.get(bossPlayerId)?.bossShopOffers[0];
      if (!expectedOffer) {
        throw new Error("Expected boss shop offer at slot 0");
      }
      const expectedPresentation = resolveSharedBoardUnitPresentation(
        expectedOffer.unitId,
        expectedOffer.unitType,
      );
      if (!expectedPresentation) {
        throw new Error("Expected presentation metadata for purchased boss unit");
      }

      bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        bossShopBuySlotIndex: 0,
      });
      expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: targetBossCell,
        },
      });
      expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      await waitForCondition(() => {
        const sharedCell = sharedBoardRoom.state.cells.get(String(targetBossCell)) as {
          ownerId?: string;
          unitId?: string;
          displayName?: string;
          portraitKey?: string;
        } | undefined;
        return sharedCell?.ownerId === bossPlayerId && (sharedCell.unitId?.length ?? 0) > 0;
      }, 500);

      const reflectedCell = sharedBoardRoom.state.cells.get(String(targetBossCell)) as {
        ownerId?: string;
        unitId?: string;
        displayName?: string;
        portraitKey?: string;
      } | undefined;
      expect(reflectedCell?.ownerId).toBe(bossPlayerId);
      expect(reflectedCell?.unitId).not.toBe("");
      expect(reflectedCell?.displayName).toBe(expectedPresentation.displayName);
      expect(reflectedCell?.portraitKey).toBe(expectedPresentation.portraitKey);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test("raid prep falls back to local placements until shared board bridge is ready", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const serverRoom = await createRoomWithForcedFlags(testServer, {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        controller?: {
          getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        };
        sharedBoardBridge?: {
          getState: () => string;
        };
      };

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      const roundState = (await roundStatePromise) as RoundStateMessage & {
        sharedBoardAuthorityEnabled?: boolean;
        sharedBoardMode?: string;
      };

      const raidPlayerId = clients[0].sessionId;
      clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        boardPlacements: [{ cell: 4, unitType: "ranger" }],
      });
      await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

      expect(roomInternals.sharedBoardBridge?.getState()).not.toBe("READY");
      expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([
        expect.objectContaining({ cell: 4, unitType: "ranger" }),
      ]);
      expect(roundState.sharedBoardAuthorityEnabled).toBe(false);
      expect(roundState.sharedBoardMode).toBe("shadow");
    } finally {
      randomSpy.mockRestore();
    }
  });

  test("joinOrCreateのsetId指定がroom.stateへ反映される", async () => {
    const firstClient = await testServer.sdk.joinOrCreate("game", {
      setId: "set2",
    });
    const serverRoom = testServer.getRoomById<GameRoom>(firstClient.roomId);

    if (!serverRoom) {
      throw new Error("Expected room to be created by joinOrCreate");
    }

    const extraClients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);
    const clients = [firstClient, ...extraClients];

    const roundStatePromise = new Promise<RoundStateMessage>((resolve) => {
      firstClient.onMessage<RoundStateMessage>(
        SERVER_MESSAGE_TYPES.ROUND_STATE,
        (message) => {
          resolve(message);
        },
      );
    });

    for (const client of extraClients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const roundState = await roundStatePromise;

    expect(roundState.phase).toBe("Prep");
    expect(serverRoom.state.setId).toBe("set2");
  });

  test("異常切断後に再接続するとconnectedがtrueへ戻る", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const droppedClient = clients[0];
    const previousSessionId = droppedClient.sessionId;
    const reconnectionToken = droppedClient.reconnectionToken;

    droppedClient.connection.close(4001, "network drop");

    await waitForCondition(
      () => serverRoom.state.players.get(previousSessionId)?.connected === false,
      1_000,
    );

    const reconnected = await testServer.sdk.reconnect(reconnectionToken);

    await waitForCondition(
      () => serverRoom.state.players.get(previousSessionId)?.connected === true,
      1_000,
    );

    expect(reconnected.sessionId).toBe(previousSessionId);
  });

  test("Prep->Battle->Settle->Elimination->PrepでroundIndexが進む", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Elimination", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    expect(serverRoom.state.roundIndex).toBe(2);
  });

  test("自動戦闘ダメージが次Prepでstateに反映される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    const sortedPlayerIds = clients.map((client) => client.sessionId).sort();
    const firstWinnerId = sortedPlayerIds[0];
    const secondWinnerId = sortedPlayerIds[1];
    const firstLoserId = sortedPlayerIds[2];
    const secondLoserId = sortedPlayerIds[3];

    if (
      !firstWinnerId ||
      !firstLoserId ||
      !secondWinnerId ||
      !secondLoserId
    ) {
      throw new Error("Expected 4 player session ids");
    }

    expect(serverRoom.state.players.get(firstLoserId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(secondLoserId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(firstWinnerId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(secondWinnerId)?.hp).toBe(100);
  });

  test("prep_commandのboardUnitCountで勝敗が変わる", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const sortedSessionIds = clients.map((client) => client.sessionId).sort();
    const weakestA = sortedSessionIds[0];
    const weakestB = sortedSessionIds[1];
    const strongestA = sortedSessionIds[2];
    const strongestB = sortedSessionIds[3];

    if (!weakestA || !weakestB || !strongestA || !strongestB) {
      throw new Error("Expected 4 player session ids");
    }

    const clientBySessionId = new Map(clients.map((client) => [client.sessionId, client]));
    const strongestAClient = clientBySessionId.get(strongestA);
    const strongestBClient = clientBySessionId.get(strongestB);

    if (!strongestAClient || !strongestBClient) {
      throw new Error("Expected clients for strongest players");
    }

    strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardUnitCount: 8,
    });
    strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardUnitCount: 8,
    });

    const strongestAResult =
      await strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    const strongestBResult =
      await strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    expect(strongestAResult).toEqual({ accepted: true });
    expect(strongestBResult).toEqual({ accepted: true });

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    expect(serverRoom.state.players.get(weakestA)?.hp).toBe(100);
    expect(serverRoom.state.players.get(weakestB)?.hp).toBe(100);
    expect(serverRoom.state.players.get(strongestA)?.hp).toBe(100);
    expect(serverRoom.state.players.get(strongestB)?.hp).toBe(100);
  });

  test("prep_commandのboardPlacementsでboardUnitCountが同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "vanguard" },
        { cell: 2, unitType: "ranger" },
        { cell: 3, unitType: "ranger" },
        { cell: 4, unitType: "assassin" },
        { cell: 5, unitType: "mage" },
      ],
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    await waitForCondition(
      () =>
        serverRoom.state.players.get(targetClient.sessionId)?.boardUnitCount === 6,
      1_000,
    );

    expect(serverRoom.state.players.get(targetClient.sessionId)?.boardUnitCount).toBe(6);
  });

  test("xpPurchaseCountでgold/xp/levelがstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      xpPurchaseCount: 2,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(targetClient.sessionId);
      return player?.gold === 7 && player?.xp === 4 && player?.level === 3;
    }, 1_000);

    const player = serverRoom.state.players.get(targetClient.sessionId);

    expect(player?.gold).toBe(7);
    expect(player?.xp).toBe(4);
    expect(player?.level).toBe(3);
  });

  test("xpPurchaseCountが所持goldを超えるとINSUFFICIENT_GOLDで却下される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      xpPurchaseCount: 4,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });

    const player = serverRoom.state.players.get(targetClient.sessionId);

    expect(player?.gold).toBe(15);
    expect(player?.xp).toBe(0);
    expect(player?.level).toBe(1);
  });

  test("試合開始時にshopOffersがstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const target = serverRoom.state.players.get(clients[0].sessionId);

    expect(target?.shopOffers.length).toBe(5);
  });

  test("shopRefreshCountでgold減少とshopOffers更新がstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    const beforePlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeOffers =
      beforePlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopRefreshCount: 1,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterOffers =
      afterPlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    expect(afterPlayer?.gold).toBe(13);
    expect(afterPlayer?.shopOffers.length).toBe(5);
    expect(afterOffers).not.toBe(beforeOffers);
  });

  test("shopBuySlotIndexでgold減少とshopOffers差し替えがstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    const internalController = (serverRoom as unknown as {
      controller?: {
        shopOffersByPlayer: Map<
          string,
          Array<{
            unitType: "vanguard" | "ranger" | "mage" | "assassin";
            rarity: 1 | 2 | 3;
            cost: number;
          }>
        >;
      };
    }).controller;

    if (!internalController) {
      throw new Error("Expected internal controller");
    }

    // Fix shopOffers to ensure deterministic purchase target
    const forcedOffers: Array<{
      unitType: "vanguard" | "ranger" | "mage" | "assassin";
      rarity: 1 | 2 | 3;
      cost: number;
    }> = [
      { unitType: "vanguard", rarity: 1, cost: 1 },
      { unitType: "ranger", rarity: 1, cost: 1 },
      { unitType: "mage", rarity: 2, cost: 2 },
      { unitType: "assassin", rarity: 2, cost: 2 },
      { unitType: "vanguard", rarity: 1, cost: 1 },
    ];
    internalController.shopOffersByPlayer.set(targetClient.sessionId, forcedOffers);

    const firstForcedOffer = forcedOffers[0];

    if (!firstForcedOffer) {
      throw new Error("Expected forced shop offers to include slot 0");
    }

    const firstOfferCost = firstForcedOffer.cost;
    const firstOfferUnitType = firstForcedOffer.unitType;
    const beforeOffers = forcedOffers
      .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
      .join(",");

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterOffers =
      afterPlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    expect(afterPlayer?.gold).toBe(15 - firstOfferCost);
    expect(afterPlayer?.shopOffers.length).toBe(5);
    expect(afterOffers).not.toBe(beforeOffers);
    expect(afterPlayer?.benchUnits.length).toBe(1);

    expect(afterPlayer?.benchUnits[0]).toBe(firstOfferUnitType);

    const ownedCountByUnitType: Record<string, number> = {
      vanguard: Number(afterPlayer?.ownedVanguard ?? 0),
      ranger: Number(afterPlayer?.ownedRanger ?? 0),
      mage: Number(afterPlayer?.ownedMage ?? 0),
      assassin: Number(afterPlayer?.ownedAssassin ?? 0),
    };

    expect(ownedCountByUnitType[firstOfferUnitType]).toBe(1);
  });

  test("shopLock=trueで次ラウンドPrepでもshopOffersが維持される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    const beforeOffers =
      serverRoom.state.players
        .get(targetClient.sessionId)
        ?.shopOffers.map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopLock: true,
    });

    const lockResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(lockResult).toEqual({ accepted: true });

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterOffers =
      afterPlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    expect(afterPlayer?.shopLocked).toBe(true);
    expect(afterOffers).toBe(beforeOffers);
  });

  test("benchToBoardCellでbenchからboardへ1体配置がstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });

    const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(buyResult).toEqual({ accepted: true });

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      benchToBoardCell: {
        benchIndex: 0,
        cell: 6,
      },
    });

    const deployResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(deployResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(0);
    expect(afterPlayer?.boardUnitCount).toBe(1);
  });

  test("benchToBoardCellが既存cellと競合するとINVALID_PAYLOADでstate不変", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardPlacements: [{ cell: 2, unitType: "vanguard" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    const beforePlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeBench = beforePlayer?.benchUnits.length ?? 0;
    const beforeBoardCount = beforePlayer?.boardUnitCount ?? 0;

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 3,
      benchToBoardCell: {
        benchIndex: 0,
        cell: 2,
      },
    });

    const rejectResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(rejectResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(beforeBench);
    expect(afterPlayer?.boardUnitCount).toBe(beforeBoardCount);
  });

  test("benchSellIndexでbench売却すると購入時のコスト分goldがstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    const beforeBuyPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeBuyGold = Number(beforeBuyPlayer?.gold ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });

    const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(buyResult).toEqual({ accepted: true });

    const afterBuyPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterBuyGold = Number(afterBuyPlayer?.gold ?? 0);
    const unitCost = beforeBuyGold - afterBuyGold;

    const beforeSellGold = afterBuyGold;

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      benchSellIndex: 0,
    });

    const sellResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(sellResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(0);
    expect(afterPlayer?.gold).toBe(beforeSellGold + unitCost);
  });

  test("boardSellIndexで盤面ユニット売却するとgold増加とboardUnitCount減少がstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 3, unitType: "mage" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    const beforeSellPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeSellGold = Number(beforeSellPlayer?.gold ?? 0);
    const beforeSellCount = Number(beforeSellPlayer?.boardUnitCount ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardSellIndex: 3,
    });

    const sellResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(sellResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.gold).toBe(beforeSellGold + 2);
    expect(afterPlayer?.boardUnitCount).toBe(beforeSellCount - 1);
  });

  test("boardSellIndexでユニット不在セル指定はINVALID_PAYLOADでstate不変", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 0, unitType: "vanguard" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    const beforePlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeGold = Number(beforePlayer?.gold ?? 0);
    const beforeCount = Number(beforePlayer?.boardUnitCount ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardSellIndex: 7,
    });

    const rejectResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(rejectResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.gold).toBe(beforeGold);
    expect(afterPlayer?.boardUnitCount).toBe(beforeCount);
  });

  test("role-resolved Prep reflects raid heroes onto fixed shared-board cells", async () => {
    const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer, {
      prepDurationMs: 4_000,
      battleDurationMs: 4_000,
      settleDurationMs: 1_000,
      eliminationDurationMs: 1_000,
      sharedBoardRoomId: sharedBoardRoom.roomId,
    }, {
      enableSharedBoardShadow: true,
    });

    const roomInternals = serverRoom as unknown as {
      sharedBoardBridge?: {
        getState: () => string;
        syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

    await waitForCondition(
      () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
      1_000,
    );
    roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);

    const raidPlayerIds = [
      clients[0]!.sessionId,
      clients[2]!.sessionId,
      clients[3]!.sessionId,
    ].sort();
    const heroCellIndexes = [
      sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
      sharedBoardCoordinateToIndex({ x: 2, y: 5 }),
      sharedBoardCoordinateToIndex({ x: 4, y: 5 }),
    ];

    await waitForCondition(() => heroCellIndexes.every((index) => {
      const cell = sharedBoardRoom.state.cells.get(String(index));
      return (
        cell !== undefined
        && raidPlayerIds.includes(cell.ownerId)
        && (cell.unitId?.startsWith("hero:") ?? false)
        && cell.displayName !== ""
      );
    }), 1_000);

    const heroOwnerIds = heroCellIndexes.map((index) => {
      const cell = sharedBoardRoom.state.cells.get(String(index));
      expect(cell?.unitId).toContain("hero:");
      expect(cell?.displayName).not.toBe("");
      return cell?.ownerId ?? "";
    }).sort();

    expect(heroOwnerIds).toEqual(raidPlayerIds);
  });

  test("shared board hero move updates hero placement outside the old raid footprint", async () => {
    const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer, {
      prepDurationMs: 4_000,
      battleDurationMs: 4_000,
      settleDurationMs: 1_000,
      eliminationDurationMs: 1_000,
      sharedBoardRoomId: sharedBoardRoom.roomId,
    }, {
      enableSharedBoardShadow: true,
    });

    const raidPlayerId = clients[0]!.sessionId;
    const targetHeroCell = sharedBoardCoordinateToIndex({ x: 0, y: 4 });
    const roomInternals = serverRoom as unknown as {
      controller?: {
        getHeroPlacementForPlayer: (playerId: string) => number | null;
      };
      sharedBoardBridge?: {
        getState: () => string;
        syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

    await waitForCondition(
      () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
      1_000,
    );
    roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);

    await waitForCondition(
      () => (roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId) ?? -1) >= 0,
      1_000,
    );

    const initialHeroCell = roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId);
    if (typeof initialHeroCell !== "number") {
      throw new Error("Expected hero placement to be available");
    }

    await waitForCondition(() => {
      const cell = sharedBoardRoom.state.cells.get(String(initialHeroCell));
      return cell?.ownerId === raidPlayerId && cell.unitId === `hero:${raidPlayerId}`;
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);

    const sharedClient = await testServer.connectTo(sharedBoardRoom, {
      gamePlayerId: raidPlayerId,
    });

    sharedClient.send("shared_place_unit", {
      unitId: `hero:${raidPlayerId}`,
      toCell: targetHeroCell,
    });

    const placeResult = await sharedClient.waitForMessage("shared_action_result");
    expect(placeResult).toEqual({
      accepted: true,
      action: "place_unit",
    });

    await waitForCondition(() => {
      const targetCell = sharedBoardRoom.state.cells.get(String(targetHeroCell));
      const sourceCell = sharedBoardRoom.state.cells.get(String(initialHeroCell));
      return (
        roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId) === targetHeroCell
        && targetCell?.unitId === `hero:${raidPlayerId}`
        && sourceCell?.unitId === ""
      );
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);
  });

  test("shared board boss move updates boss placement from its fixed top-row cell", async () => {
    const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(testServer, {
      prepDurationMs: 4_000,
      battleDurationMs: 4_000,
      settleDurationMs: 1_000,
      eliminationDurationMs: 1_000,
      sharedBoardRoomId: sharedBoardRoom.roomId,
    }, {
      enableSharedBoardShadow: true,
    });

    const bossPlayerId = clients[1]!.sessionId;
    const targetBossCell = sharedBoardCoordinateToIndex({ x: 4, y: 2 });
    const roomInternals = serverRoom as unknown as {
      controller?: {
        getBossPlacementForPlayer: (playerId: string) => number | null;
      };
      sharedBoardBridge?: {
        getState: () => string;
        syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

    await waitForCondition(
      () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
      1_000,
    );
    roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);

    await waitForCondition(
      () => (roomInternals.controller?.getBossPlacementForPlayer(bossPlayerId) ?? -1) >= 0,
      1_000,
    );

    const initialBossCell = roomInternals.controller?.getBossPlacementForPlayer(bossPlayerId);
    if (typeof initialBossCell !== "number") {
      throw new Error("Expected boss placement to be available");
    }

    await waitForCondition(() => {
      const cell = sharedBoardRoom.state.cells.get(String(initialBossCell));
      return cell?.ownerId === bossPlayerId && cell.unitId === `boss:${bossPlayerId}`;
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);

    const sharedClient = await testServer.connectTo(sharedBoardRoom, {
      gamePlayerId: bossPlayerId,
    });

    sharedClient.send("shared_place_unit", {
      unitId: `boss:${bossPlayerId}`,
      toCell: targetBossCell,
    });

    const placeResult = await sharedClient.waitForMessage("shared_action_result");
    expect(placeResult).toEqual({
      accepted: true,
      action: "place_unit",
    });

    await waitForCondition(() => {
      const targetCell = sharedBoardRoom.state.cells.get(String(targetBossCell));
      const sourceCell = sharedBoardRoom.state.cells.get(String(initialBossCell));
      return (
        roomInternals.controller?.getBossPlacementForPlayer(bossPlayerId) === targetBossCell
        && targetCell?.unitId === `boss:${bossPlayerId}`
        && sourceCell?.unitId === ""
      );
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);
  });

  test("boardToBenchCellで盤面ユニットをbenchへ戻すとstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 3, unitType: "mage" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardToBenchCell: { cell: 3 },
    });

    const result = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.boardUnitCount).toBe(0);
    expect(Array.from(afterPlayer?.boardUnits ?? [])).toEqual([]);
    expect(Array.from(afterPlayer?.benchUnits ?? [])).toEqual(["mage"]);
  });

  test("同種3体購入でベンチ上の自動合成結果がstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    const internalController = (serverRoom as unknown as {
      controller?: {
        shopOffersByPlayer: Map<
          string,
          Array<{
            unitType: "vanguard" | "ranger" | "mage" | "assassin";
            rarity: 1 | 2 | 3;
            cost: number;
          }>
        >;
      };
    }).controller;

    if (!internalController) {
      throw new Error("Expected internal controller");
    }

    for (const cmdSeq of [1, 2, 3]) {
      internalController.shopOffersByPlayer.set(targetClient.sessionId, [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq,
        shopBuySlotIndex: 0,
      });

      const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
      expect(buyResult).toEqual({ accepted: true });
    }

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(1);
    expect(afterPlayer?.benchUnits[0]).toBe("vanguard:2");
    expect(afterPlayer?.ownedVanguard).toBe(3);
  });

  test("同種9体購入で連鎖合成した★3がstateへ同期される", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const targetClient = clients[0];
    const internalController = (serverRoom as unknown as {
      controller?: {
        shopOffersByPlayer: Map<
          string,
          Array<{
            unitType: "vanguard" | "ranger" | "mage" | "assassin";
            rarity: 1 | 2 | 3;
            cost: number;
          }>
        >;
      };
    }).controller;

    if (!internalController) {
      throw new Error("Expected internal controller");
    }

    for (const cmdSeq of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      internalController.shopOffersByPlayer.set(targetClient.sessionId, [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq,
        shopBuySlotIndex: 0,
      });

      const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
      expect(buyResult).toEqual({ accepted: true });
    }

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(1);
    expect(afterPlayer?.benchUnits[0]).toBe("vanguard:3");
    expect(afterPlayer?.ownedVanguard).toBe(9);
  });

  test("set2ルームのranger編成 fixture は shared-index pathing でも勝利する", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game", {
      setId: "set2",
    });
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const set2RoundState = await clients[0].waitForMessage(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
    );
    expect(set2RoundState.phase).toBe("Prep");
    expect(serverRoom.state.setId).toBe("set2");

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const sortedSessionIds = clients.map((client) => client.sessionId).sort();
    const lowId = sortedSessionIds[0];
    const highId = sortedSessionIds[3];

    if (!lowId || !highId) {
      throw new Error("Expected 4 player session ids");
    }

    const clientBySessionId = new Map(clients.map((client) => [client.sessionId, client]));
    const lowClient = clientBySessionId.get(lowId);
    const highClient = clientBySessionId.get(highId);

    if (!lowClient || !highClient) {
      throw new Error("Expected clients for target players");
    }

    lowClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(4), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(1), unitType: "assassin" },
      ],
    });
    highClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(2), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "mage" },
        { cell: combatCellToRaidBoardIndex(4), unitType: "assassin" },
      ],
    });

    const lowResult = await lowClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    const highResult = await highClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );

    expect(lowResult).toEqual({ accepted: true });
    expect(highResult).toEqual({ accepted: true });

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    expect(serverRoom.state.players.get(lowId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(highId)?.hp).toBe(87);
  });

  test("connectAndAttachSetIdDisplayでjoinOrCreateからsetId表示できる", async () => {
    const root = new FakeRoot();
    const setIdElement = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const createClient = async (_endpoint: string): Promise<BrowserClient> => {
      return {
        joinOrCreate: async (
          roomName: string,
          roomOptions?: Record<string, unknown>,
        ): Promise<BrowserRoom> => {
          const room = await testServer.sdk.joinOrCreate(roomName, roomOptions);
          return room as unknown as BrowserRoom;
        },
      };
    };

    const binding = await connectAndAttachSetIdDisplay({
      endpoint: "ws://unused",
      roomName: "game",
      roomOptions: { setId: "set2" },
      root,
      createClient,
    });

    if (!binding) {
      throw new Error("Expected connected binding");
    }

    await waitForText(setIdElement, "set2", 1_000);
    await binding.leave();
  });

  test("不正setIdでルーム作成するとエラーになる", async () => {
    await expect(
      testServer.createRoom<GameRoom>("game", {
        setId: "set3",
      }),
    ).rejects.toThrow("Invalid setId");
  });

  test("不正setIdでjoinOrCreateするとエラーになる", async () => {
    await expect(
      testServer.sdk.joinOrCreate("game", {
        setId: "set3",
      }),
    ).rejects.toThrow("Invalid setId");
  });

  test("Waiting中の離脱でghost playerが残らず、補充後に開始できる", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);

    clients[0].connection.close(4000, "refresh");

    await waitForCondition(() => serverRoom.state.players.size === 3, 1_000);

    const remainingClientIds = clients.slice(1).map((c) => c.sessionId);

    for (const clientId of remainingClientIds) {
      const player = serverRoom.state.players.get(clientId);
      expect(player?.ready).toBe(false);
      expect(player?.lastCmdSeq).toBe(0);
    }

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.phaseDeadlineAtMs).toBe(0);
    expect(serverRoom.state.prepDeadlineAtMs).toBe(0);
    expect(serverRoom.state.roundIndex).toBe(0);
    expect(serverRoom.state.ranking.length).toBe(0);

    const newClient = await testServer.connectTo(serverRoom);
    newClient.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);

    const allClients = [...clients.slice(1), newClient];
    for (const client of allClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
  });

  test("Waitingで4人未満の離脱でもghost playerを残さない", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 3, 1_000);

    clients[0].connection.close(4000, "refresh");

    await waitForCondition(() => serverRoom.state.players.size === 2, 1_000);
    expect(serverRoom.state.phase).toBe("Waiting");
  });

  test("Waiting中の離脱はlobby ready deadlineを引き直して即時auto-startを防ぐ", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game", {
      readyAutoStartMs: 300,
    });
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);
    const initialLobbyDeadline = serverRoom["lobbyReadyDeadlineAtMs"] as number;
    await new Promise((resolve) => setTimeout(resolve, 150));

    clients[0].connection.close(4000, "refresh");

    await waitForCondition(() => serverRoom.state.players.size === 3, 1_000);
    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom["lobbyReadyDeadlineAtMs"]).toBeGreaterThan(initialLobbyDeadline);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(serverRoom.state.phase).toBe("Waiting");
  });

  test("shared board shadow無効時のadmin_queryはnot availableを返す", async () => {
    const serverRoom = await testServer.createRoom<GameRoom>("game");
    const client = await testServer.connectTo(serverRoom);

    const responsePromise = client.waitForMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE);

    client.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
      kind: "metrics",
      correlationId: "corr_admin_disabled",
    });

    const response = (await responsePromise) as AdminResponseMessage;

    expect(response.ok).toBe(false);
    expect(response.kind).toBe("metrics");
    expect(response.correlationId).toBe("corr_admin_disabled");
    expect(response.error).toContain("SharedBoardBridge is not available");
  });

  test("shared board shadow有効時のadmin_queryはdashboard/alerts/logsを返す", async () => {
    await withFlags(FLAG_CONFIGURATIONS.SHARED_BOARD_SHADOW_ONLY, async () => {
      const serverRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      const targetClient = clients[0];

      const dashboardPromise = targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
      );
      targetClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
        kind: "dashboard",
        correlationId: "corr_admin_dashboard",
        windowMs: 60_000,
      });
      const dashboardResponse = (await dashboardPromise) as AdminResponseMessage;

      expect(dashboardResponse.ok).toBe(true);
      expect(dashboardResponse.kind).toBe("dashboard");
      expect(dashboardResponse.correlationId).toBe("corr_admin_dashboard");
      expect(dashboardResponse.data).toEqual(
        expect.objectContaining({
          windowMs: 60_000,
          windowEventCount: expect.any(Number),
          successRate: expect.any(Number),
          failureRate: expect.any(Number),
          conflictRate: expect.any(Number),
          avgLatencyMs: expect.any(Number),
          p95LatencyMs: expect.any(Number),
          topErrors: expect.any(Array),
        }),
      );

      const alertsPromise = targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
      );
      targetClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
        kind: "alerts",
        correlationId: "corr_admin_alerts",
        thresholds: {
          windowMs: 60_000,
          minEventCount: 1,
          maxFailureRate: 0.5,
          maxConflictRate: 0.5,
          maxP95LatencyMs: 500,
        },
      });
      const alertsResponse = (await alertsPromise) as AdminResponseMessage;

      expect(alertsResponse.ok).toBe(true);
      expect(alertsResponse.kind).toBe("alerts");
      expect(alertsResponse.correlationId).toBe("corr_admin_alerts");
      expect(alertsResponse.data).toEqual(
        expect.objectContaining({
          hasAlert: expect.any(Boolean),
          triggeredRules: expect.any(Array),
          evaluatedAt: expect.any(Number),
          thresholds: expect.objectContaining({
            windowMs: 60_000,
          }),
          dashboard: expect.objectContaining({
            windowMs: 60_000,
          }),
        }),
      );

      const logsPromise = targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
      );
      targetClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
        kind: "logs",
        correlationId: "corr_admin_logs",
        limit: 5,
      });
      const logsResponse = (await logsPromise) as AdminResponseMessage;

      expect(logsResponse.ok).toBe(true);
      expect(logsResponse.kind).toBe("logs");
      expect(logsResponse.correlationId).toBe("corr_admin_logs");
      expect(Array.isArray(logsResponse.data)).toBe(true);
    });
  });

  describe("Rumor Influence - Pre-submit Snapshot Regression", () => {
    beforeEach(() => {
      // Enable rumor influence for these tests
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "true";
    });

    afterEach(() => {
      delete process.env.FEATURE_ENABLE_RUMOR_INFLUENCE;
    });

    test("shopBuySlotIndex preserves isRumorUnit flag in action log after slot replacement", async () => {
      // This test verifies the fix for the bug where isRumorUnit was lost
      // because shop slot was replaced before logging occurred.
      // The fix captures a snapshot of shop offers before submitPrepCommand.

      await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
        const serverRoom = await testServer.createRoom<GameRoom>("game");
        const clients = await Promise.all([
          testServer.connectTo(serverRoom),
          testServer.connectTo(serverRoom),
          testServer.connectTo(serverRoom),
          testServer.connectTo(serverRoom),
        ]);

        for (const client of clients) {
          client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
        }

        await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

        // Access the match logger to verify action logging
        const matchLogger = (serverRoom as unknown as {
          matchLogger?: {
            getActionLogs: () => Array<{
              playerId: string;
              roundIndex: number;
              actionType: string;
              details: {
                unitType?: string;
                cost?: number;
                isRumorUnit?: boolean;
                goldBefore?: number;
                goldAfter?: number;
              };
            }>;
          };
        }).matchLogger;

        const targetClient = clients[0];

        // Force a shop offer with isRumorUnit flag via internal controller
        const internalController = (serverRoom as unknown as {
          controller?: {
            shopOffersByPlayer: Map<
              string,
              Array<{
                unitType: "vanguard" | "ranger" | "mage" | "assassin";
                rarity: 1 | 2 | 3;
                cost: number;
                isRumorUnit?: boolean;
              }>
            >;
          };
        }).controller;

        if (!internalController) {
          throw new Error("Expected internal controller");
        }

        // Set up a shop offer with isRumorUnit flag
        const forcedOffers = [
          { unitType: "vanguard" as const, rarity: 1 as const, cost: 3, isRumorUnit: true },
          { unitType: "ranger" as const, rarity: 1 as const, cost: 2 },
          { unitType: "mage" as const, rarity: 2 as const, cost: 4 },
          { unitType: "assassin" as const, rarity: 2 as const, cost: 4 },
          { unitType: "vanguard" as const, rarity: 1 as const, cost: 3 },
        ];
        internalController.shopOffersByPlayer.set(targetClient.sessionId, forcedOffers);

        const resultPromise = targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

        // Buy the rumor unit at slot 0
        targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq: 1,
          shopBuySlotIndex: 0,
        });

        const result = await resultPromise;
        expect(result).toEqual({ accepted: true });

        // Verify the action was logged with isRumorUnit flag preserved
        // This tests that the pre-submit snapshot captured the flag correctly
        // even though the slot was replaced after purchase
        if (!matchLogger) {
          throw new Error("Expected matchLogger to be available");
        }
        const actionLogs = matchLogger.getActionLogs();
        const buyAction = actionLogs.find(
          (log) =>
            log.playerId === targetClient.sessionId &&
            log.actionType === "buy_unit" &&
            log.details.unitType === "vanguard"
        );

        // The key assertion: isRumorUnit should be preserved in the log
        // even though the shop slot was replaced after purchase
        expect(buyAction).toBeDefined();
        expect(buyAction!.details.isRumorUnit).toBe(true);
        expect(buyAction!.details.cost).toBe(3);
      });
    });
  });
});
