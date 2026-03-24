import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../src/server/rooms/game-room";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";
import {
  createRoomWithFlags,
  FLAG_CONFIGURATIONS,
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

describe("Prep duration 45 seconds integration test", () => {
  let testServer!: ColyseusTestServer;

  const TEST_SERVER_PORT = 26_571;
  const DEFAULT_PREP_DURATION_MS = 45_000;
  const TOLERANCE_MS = 5_000;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 2_000,
          battleDurationMs: 30_000,
          settleDurationMs: 5_000,
          eliminationDurationMs: 5_000,
        }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  }, 20_000);

  afterEach(async () => {
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

  test("4人ready後にGameRoomデフォルトprepDurationMs=45秒が反映される", async () => {
    const serverRoom = await createRoomWithFlags(
      testServer,
      FLAG_CONFIGURATIONS.ALL_DISABLED,
    );
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

    const nowMs = Date.now();
    const phaseDeadlineAtMs = serverRoom.state.phaseDeadlineAtMs;
    const remainingMs = phaseDeadlineAtMs - nowMs;

    expect(serverRoom.state.phase).toBe("Prep");
    expect(phaseDeadlineAtMs).toBeGreaterThan(0);
    expect(remainingMs).toBeGreaterThanOrEqual(DEFAULT_PREP_DURATION_MS - TOLERANCE_MS);
    expect(remainingMs).toBeLessThanOrEqual(DEFAULT_PREP_DURATION_MS + TOLERANCE_MS);
  });
});
