import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "colyseus";

import {
  handleAdminQueryMessage,
  handleBossPreferenceMessage,
  handlePrepCommandMessage,
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
  let sentMessages: Array<{ type: string; payload: unknown }>;
  let deps: GameRoomMessageHandlerDeps;
  let bridge: {
    logGameCommandEvent: ReturnType<typeof vi.fn>;
    syncSharedBoardViewFromController: ReturnType<typeof vi.fn>;
    sendPlacementToSharedBoard: ReturnType<typeof vi.fn>;
  };
  let controller: {
    submitPrepCommand: ReturnType<typeof vi.fn>;
    getBoardPlacementsForPlayer: ReturnType<typeof vi.fn>;
    getShopOffersForPlayer: ReturnType<typeof vi.fn>;
    getBenchUnitDetailsForPlayer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sentMessages = [];

    client = {
      sessionId: "player-1",
      send: vi.fn((type: string, payload: unknown) => {
        sentMessages.push({ type, payload });
      }),
    } as unknown as Client;

    const state = new MatchRoomState();
    const player = new PlayerPresenceState();
    state.phase = "Waiting";
    state.lobbyStage = "preference";
    state.players.set(client.sessionId, player);

    bridge = {
      logGameCommandEvent: vi.fn(),
      syncSharedBoardViewFromController: vi.fn(),
      sendPlacementToSharedBoard: vi.fn(),
    };
    controller = {
      submitPrepCommand: vi.fn(() => ({ accepted: true })),
      getBoardPlacementsForPlayer: vi.fn(() => [{ cell: 24, unitType: "vanguard" }]),
      getShopOffersForPlayer: vi.fn(() => []),
      getBenchUnitDetailsForPlayer: vi.fn(() => []),
    };

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
      getController: vi.fn(() => controller as any),
      getSharedBoardBridge: vi.fn(() => bridge as any),
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

  it("uses full shared-board resync for hero-affecting prep commands like subUnitMove", () => {
    deps.state.phase = "Prep";

    handlePrepCommandMessage(
      client,
      {
        cmdSeq: 1,
        subUnitMove: { fromCell: 24, toCell: 25, slot: "main" },
      },
      deps,
    );

    expect(deps.syncPlayerFromCommandResult).toHaveBeenCalledOnce();
    expect(bridge.syncSharedBoardViewFromController).toHaveBeenCalledWith(true);
    expect(bridge.sendPlacementToSharedBoard).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: true });
  });

  it("keeps the lighter placement sync for ordinary board placement commands", () => {
    deps.state.phase = "Prep";

    handlePrepCommandMessage(
      client,
      {
        cmdSeq: 2,
        boardPlacements: [{ cell: 24, unitType: "vanguard" }],
      },
      deps,
    );

    expect(bridge.syncSharedBoardViewFromController).not.toHaveBeenCalled();
    expect(bridge.sendPlacementToSharedBoard).toHaveBeenCalledWith(client.sessionId, [
      { cell: 24, unitType: "vanguard" },
    ]);
  });
});
