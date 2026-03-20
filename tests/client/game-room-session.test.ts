import { afterEach, describe, expect, test } from "vitest";

import { createGameRoomSession } from "../../src/client/game-room-session.js";

describe("game-room session", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  test("missing endpoint falls back to the current page origin", async () => {
    let capturedEndpoint = "";
    globalThis.window = {
      location: {
        host: "play.example.com",
        protocol: "https:",
        search: "",
      },
    } as unknown as Window & typeof globalThis;

    const session = createGameRoomSession({
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(endpoint: string) {
            capturedEndpoint = endpoint;
          }

          public async joinOrCreate() {
            return {
              leave: async () => {},
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: "player-1",
              state: {},
            };
          }
        },
      }),
    });

    await session.connect();

    expect(capturedEndpoint).toBe("wss://play.example.com");
  });

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
