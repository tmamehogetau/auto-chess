import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "colyseus";

import {
  handleAdminQueryMessage,
  handleBossPreferenceMessage,
  handleReadyMessage,
  type GameRoomMessageHandlerDeps,
} from "../../../src/server/rooms/game-room/message-handler";
import {
  SERVER_MESSAGE_TYPES,
  type AdminQueryMessage,
  type AdminResponseMessage,
  type BossPreferenceMessage,
} from "../../../src/shared/room-messages";
import { MatchRoomState, PlayerPresenceState } from "../../../src/server/schema/match-room-state";

describe("game-room/message-handler", () => {
  let client: Client;
  let sentMessages: Array<{ type: string; payload: AdminResponseMessage }>;
  let deps: GameRoomMessageHandlerDeps;

  beforeEach(() => {
    sentMessages = [];

    client = {
      sessionId: "player-1",
      send: vi.fn((type: string, payload: AdminResponseMessage) => {
        sentMessages.push({ type, payload });
      }),
    } as unknown as Client;

    const state = new MatchRoomState();
    const player = new PlayerPresenceState();
    state.phase = "Waiting";
    state.lobbyStage = "preference";
    state.players.set(client.sessionId, player);

    deps = {
      state,
      setPlayerReady: vi.fn(),
      tryStartMatch: vi.fn(async () => {}),
      isBossRoleSelectionEnabled: vi.fn(() => true),
      broadcastRoundState: vi.fn(),
      isSharedBoardAuthoritativePrep: vi.fn(() => false),
      syncPlayerFromCommandResult: vi.fn(),
      logPrepCommandActions: vi.fn(),
      buildAdminPlayerSnapshots: vi.fn(() => []),
      isAdminQueryClient: vi.fn(() => false),
      getPlayer: vi.fn((sessionId: string) => state.players.get(sessionId) ?? null),
      getController: vi.fn(() => null),
      getSharedBoardBridge: vi.fn(() => null),
    };
  });

  it("updates wantsBoss and broadcasts round state when boss preference is accepted", () => {
    const message: BossPreferenceMessage = { wantsBoss: true };

    handleBossPreferenceMessage(client, message, deps);

    expect(deps.state.players.get(client.sessionId)?.wantsBoss).toBe(true);
    expect(deps.broadcastRoundState).toHaveBeenCalledOnce();
  });

  it("rejects player_snapshot admin query for non-spectator clients", () => {
    const message: AdminQueryMessage = {
      kind: "player_snapshot",
      correlationId: "corr-forbidden",
    };

    handleAdminQueryMessage(client, message, deps);

    expect(deps.buildAdminPlayerSnapshots).not.toHaveBeenCalled();
    expect(sentMessages).toEqual([
      {
        type: SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
        payload: {
          ok: false,
          kind: "player_snapshot",
          timestamp: expect.any(Number),
          correlationId: "corr-forbidden",
          error: "FORBIDDEN",
        },
      },
    ]);
  });

  it("ignores malformed ready payloads instead of mutating player readiness", async () => {
    await handleReadyMessage(
      client,
      { ready: "yes" } as unknown as { ready?: boolean },
      deps,
    );

    expect(deps.state.players.get(client.sessionId)?.ready).toBe(false);
    expect(deps.setPlayerReady).not.toHaveBeenCalled();
    expect(deps.tryStartMatch).not.toHaveBeenCalled();
  });
});
