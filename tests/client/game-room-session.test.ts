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

  test("roomId が渡された connect は joinById を使う", async () => {
    const calls: Array<{ roomId: string; options?: Record<string, unknown> | undefined }> = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async joinById(roomId: string, options?: Record<string, unknown>) {
            calls.push({ roomId, options });
            return {
              roomId,
              leave: async () => {},
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: "player-1",
              state: {},
            };
          }

          public async joinOrCreate(): Promise<never> {
            throw new Error("joinOrCreate should not be used");
          }
        },
      }),
    });

    await session.connect({
      roomId: "room-123",
      roomOptions: {
        setId: "set2",
      },
    });

    expect(calls).toEqual([
      {
        roomId: "room-123",
        options: {
          setId: "set2",
        },
      },
    ]);
  });

  test("create mode の connect は create を使う", async () => {
    const calls: Array<{ method: string; roomName: string; options: Record<string, unknown> | undefined }> = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async create(roomName: string, options?: Record<string, unknown>) {
            calls.push({ method: "create", roomName, options });
            return {
              roomId: "created-room",
              leave: async () => {},
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: "player-1",
              state: {},
            };
          }

          public async joinOrCreate(): Promise<never> {
            throw new Error("joinOrCreate should not be used");
          }
        },
      }),
    });

    await session.connect({
      mode: "create",
      roomOptions: { setId: "set2" },
    });

    expect(calls).toEqual([
      { method: "create", roomName: "game", options: { setId: "set2" } },
    ]);
  });

  test("createPaired mode は shared_board を先に作って game へ sharedBoardRoomId を渡す", async () => {
    const calls: Array<{ method: string; roomName: string; options: Record<string, unknown> | undefined }> = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async create(roomName: string, options?: Record<string, unknown>) {
            calls.push({ method: "create", roomName, options });
            if (roomName === "shared_board") {
              return {
                roomId: "shared-room-1",
                leave: async () => {},
                onMessage: () => {},
                onStateChange: () => {},
                sessionId: "shared-owner",
                state: {},
              };
            }

            return {
              roomId: "game-room-1",
              leave: async () => {},
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: "player-1",
              state: {
                sharedBoardRoomId: "shared-room-1",
              },
            };
          }

          public async joinOrCreate(): Promise<never> {
            throw new Error("joinOrCreate should not be used");
          }
        },
      }),
    });

    await session.connect({
      mode: "createPaired",
      sharedBoardRoomName: "shared_board",
      roomOptions: { setId: "set2" },
    });

    expect(calls).toEqual([
      { method: "create", roomName: "shared_board", options: undefined },
      {
        method: "create",
        roomName: "game",
        options: {
          setId: "set2",
          sharedBoardRoomId: "shared-room-1",
        },
      },
    ]);

    expect(session.takeCreatedSharedBoardRoom()).toMatchObject({
      roomId: "shared-room-1",
      sessionId: "shared-owner",
    });
    expect(session.takeCreatedSharedBoardRoom()).toBeNull();
  });

  test("createPaired で game room 作成が失敗したら先に作った shared_board を閉じる", async () => {
    const sharedBoardLeave = vi.fn(async () => {});
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async create(roomName: string) {
            if (roomName === "shared_board") {
              return {
                roomId: "shared-room-1",
                leave: sharedBoardLeave,
                onLeave: () => {},
                onMessage: () => {},
                onStateChange: () => {},
                sessionId: "shared-owner",
                state: {},
              };
            }

            throw new Error("game create failed");
          }

          public async joinOrCreate(): Promise<never> {
            throw new Error("joinOrCreate should not be used");
          }
        },
      }),
    });

    await expect(session.connect({
      mode: "createPaired",
      sharedBoardRoomName: "shared_board",
    })).rejects.toThrow("game create failed");

    expect(sharedBoardLeave).toHaveBeenCalledTimes(1);
    expect(session.takeCreatedSharedBoardRoom()).toBeNull();
  });

  test("disconnect は take 前の paired shared_board も一緒に閉じる", async () => {
    const leaveCalls: string[] = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async create(roomName: string, options?: Record<string, unknown>) {
            return {
              roomId: roomName === "shared_board" ? "shared-room-1" : "game-room-1",
              leave: async () => {
                leaveCalls.push(roomName);
              },
              onLeave: () => {},
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: roomName === "shared_board" ? "shared-owner" : "player-1",
              state: roomName === "game"
                ? { sharedBoardRoomId: String(options?.sharedBoardRoomId ?? "") }
                : {},
            };
          }

          public async joinOrCreate(): Promise<never> {
            throw new Error("joinOrCreate should not be used");
          }
        },
      }),
    });

    await session.connect({
      mode: "createPaired",
      sharedBoardRoomName: "shared_board",
    });

    await session.disconnect();

    expect(leaveCalls).toEqual(["game", "shared_board"]);
  });

  test("structured connect options は top-level extras を roomOptions へ引き継ぐ", async () => {
    const calls: Array<{ roomId: string; options?: Record<string, unknown> | undefined }> = [];
    const session = createGameRoomSession({
      endpoint: "ws://localhost:9999",
      roomName: "game",
      loadSdk: async () => ({
        Client: class FakeClient {
          public constructor(_endpoint: string) {}

          public async joinById(roomId: string, options?: Record<string, unknown>) {
            calls.push({ roomId, options });
            return {
              roomId,
              leave: async () => {},
              onMessage: () => {},
              onStateChange: () => {},
              sessionId: "player-1",
              state: {},
            };
          }

          public async joinOrCreate(): Promise<never> {
            throw new Error("joinOrCreate should not be used");
          }
        },
      }),
    });

    await session.connect({
      roomId: "room-abc",
      setId: "set2",
      roomOptions: { sharedBoardRoomId: "shared-1" },
    });

    expect(calls).toEqual([
      {
        roomId: "room-abc",
        options: {
          setId: "set2",
          sharedBoardRoomId: "shared-1",
        },
      },
    ]);
  });
});
