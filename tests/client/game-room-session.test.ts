import { describe, expect, test } from "vitest";

import { createGameRoomSession } from "../../src/client/game-room-session.js";

describe("game-room session", () => {
  test("connect failure restores idle state and re-enables retry flow", async () => {
    const connectionStates: string[] = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async joinOrCreate(): Promise<never> {
            throw new Error("join failed");
          }
        },
      }),
    });

    session.onConnectionState((state) => {
      connectionStates.push(state);
    });

    await expect(session.connect()).rejects.toThrow("join failed");
    expect(session.getConnectionState()).toBe("idle");
    expect(connectionStates).toEqual(["idle", "connecting", "idle"]);
  });

  test("disconnect returns to idle even when leave throws", async () => {
    const connectionStates: string[] = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async joinOrCreate() {
            return {
              leave: async () => {
                throw new Error("leave failed");
              },
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: "player-1",
              state: {},
            };
          }
        },
      }),
    });

    session.onConnectionState((state) => {
      connectionStates.push(state);
    });

    await session.connect();
    await expect(session.disconnect()).rejects.toThrow("leave failed");
    expect(session.getConnectionState()).toBe("idle");
    expect(connectionStates).toEqual(["idle", "connecting", "connected", "disconnecting", "idle"]);
  });
});
