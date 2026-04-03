import type { Client } from "colyseus";

import { isBossCharacterId } from "../../../shared/boss-characters";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type AdminPlayerSnapshot,
  type AdminQueryMessage,
  type BossPreferenceMessage,
  type BossSelectMessage,
  type PrepCommandMessage,
  type ReadyMessage,
} from "../../../shared/room-messages";
import type { MatchRoomController } from "../../match-room-controller";
import type { LoggedPrepCommandPayload } from "./prep-command-payload";
import { buildPrepCommandPayload } from "./prep-command-payload";
import { resolveCorrelationId } from "./correlation-id";
import { handleAdminQuery as dispatchAdminQuery } from "./admin-query-handler";
import type { SharedBoardBridge } from "../../shared-board-bridge";
import {
  MatchRoomState,
  PlayerPresenceState,
} from "../../schema/match-room-state";

type ShopOfferSnapshot = Array<{ unitType: string; cost: number; isRumorUnit?: boolean }>;
type BenchUnitSnapshot = Array<{
  unitType: "vanguard" | "ranger" | "mage" | "assassin";
  cost: number;
  starLevel: number;
  unitCount: number;
}>;
type BoardPlacementSnapshot = Array<{
  cell: number;
  unitType: "vanguard" | "ranger" | "mage" | "assassin";
  sellValue?: number;
  starLevel?: number;
  unitCount?: number;
}>;

export interface GameRoomMessageHandlerDeps {
  state: MatchRoomState;
  setPlayerReady: (sessionId: string, ready: boolean) => void;
  tryStartMatch: (nowMs: number) => Promise<void>;
  isBossRoleSelectionEnabled: () => boolean;
  broadcastRoundState: () => void;
  isSharedBoardAuthoritativePrep: () => boolean;
  syncPlayerFromCommandResult: (
    player: PlayerPresenceState,
    sessionId: string,
    cmdSeq: number,
  ) => void;
  logPrepCommandActions: (
    sessionId: string,
    commandPayload: LoggedPrepCommandPayload | undefined,
    shopOffersSnapshot?: ShopOfferSnapshot,
    benchUnitsSnapshot?: BenchUnitSnapshot,
    boardPlacementsSnapshot?: BoardPlacementSnapshot,
  ) => void;
  buildAdminPlayerSnapshots: () => AdminPlayerSnapshot[];
  isAdminQueryClient: (client: Client) => boolean;
  getPlayer: (sessionId: string) => PlayerPresenceState | null;
  getController: () => MatchRoomController | null;
  getSharedBoardBridge: () => SharedBoardBridge | null;
}

export async function handleReadyMessage(
  client: Client,
  message: ReadyMessage | null | undefined,
  deps: GameRoomMessageHandlerDeps,
): Promise<void> {
  const player = deps.getPlayer(client.sessionId);

  if (!player || player.isSpectator) {
    return;
  }

  if (!isRecordMessage(message)) {
    return;
  }

  if (message.ready !== undefined && typeof message.ready !== "boolean") {
    return;
  }

  const nextReady = message.ready ?? true;
  player.ready = nextReady;
  deps.setPlayerReady(client.sessionId, nextReady);

  if (deps.getController()) {
    await deps.tryStartMatch(Date.now());
  }
}

export function handleBossPreferenceMessage(
  client: Client,
  message: BossPreferenceMessage | null | undefined,
  deps: GameRoomMessageHandlerDeps,
): void {
  if (!deps.isBossRoleSelectionEnabled()) {
    return;
  }

  if (!canAcceptBossPreferenceState(deps.state)) {
    return;
  }

  if (!isRecordMessage(message)) {
    return;
  }

  const player = deps.getPlayer(client.sessionId);
  if (!player || player.isSpectator || typeof message.wantsBoss !== "boolean") {
    return;
  }

  player.wantsBoss = message.wantsBoss;
  deps.broadcastRoundState();
}

export async function handleBossSelectMessage(
  client: Client,
  message: BossSelectMessage | null | undefined,
  deps: GameRoomMessageHandlerDeps,
): Promise<void> {
  if (!deps.getController()) {
    return;
  }

  if (!isRecordMessage(message) || typeof message.bossId !== "string") {
    sendInvalidPayload(client);
    return;
  }

  const player = deps.getPlayer(client.sessionId);
  if (
    !player
    || player.isSpectator
    || !deps.isBossRoleSelectionEnabled()
    || deps.state.phase !== "Waiting"
    || deps.state.lobbyStage !== "selection"
    || player.role !== "boss"
    || !isBossCharacterId(message.bossId)
    || client.sessionId !== deps.state.bossPlayerId
  ) {
    sendInvalidPayload(client);
    return;
  }

  player.selectedBossId = message.bossId;
  deps.broadcastRoundState();
  await deps.tryStartMatch(Date.now());
}

export async function handleHeroSelectMessage(
  client: Client,
  message: { heroId: string } | null | undefined,
  deps: GameRoomMessageHandlerDeps,
): Promise<void> {
  const controller = deps.getController();
  if (!controller) {
    return;
  }

  if (!isRecordMessage(message)) {
    if (deps.isBossRoleSelectionEnabled()) {
      sendInvalidPayload(client);
    }
    return;
  }

  const player = deps.getPlayer(client.sessionId);
  if (!player || player.isSpectator) {
    return;
  }

  if (!deps.state.featureFlagsEnableHeroSystem) {
    return;
  }

  if (
    deps.isBossRoleSelectionEnabled()
    && (
      deps.state.phase !== "Waiting"
      || deps.state.lobbyStage !== "selection"
      || player.role !== "raid"
    )
  ) {
    sendInvalidPayload(client);
    return;
  }

  const heroId = message.heroId;

  if (!heroId || typeof heroId !== "string") {
    if (deps.isBossRoleSelectionEnabled()) {
      sendInvalidPayload(client);
    }
    return;
  }

  try {
    controller.selectHero(client.sessionId, heroId);
    player.selectedHeroId = heroId;
    if (deps.isBossRoleSelectionEnabled()) {
      deps.broadcastRoundState();
      await deps.tryStartMatch(Date.now());
    }
  } catch (error) {
    if (deps.isBossRoleSelectionEnabled()) {
      sendInvalidPayload(client);
      return;
    }

    console.error(`Hero selection error for ${client.sessionId}:`, error);
  }
}

export function handlePrepCommandMessage(
  client: Client,
  message: PrepCommandMessage,
  deps: GameRoomMessageHandlerDeps,
): void {
  const controller = deps.getController();
  if (!controller) {
    return;
  }

  const correlationId = resolveCorrelationId(
    client.sessionId,
    message.cmdSeq,
    message.correlationId,
  );

  const commandPayload = buildPrepCommandPayload(message);

  if (deps.isSharedBoardAuthoritativePrep() && commandPayload?.boardPlacements !== undefined) {
    delete commandPayload.boardPlacements;
  }

  const shopOffersSnapshot = commandPayload?.shopBuySlotIndex !== undefined
    ? controller.getShopOffersForPlayer(client.sessionId)
    : undefined;
  const benchUnitsSnapshot = commandPayload?.benchSellIndex !== undefined
    ? controller.getBenchUnitDetailsForPlayer(client.sessionId)
    : undefined;
  const boardPlacementsSnapshot = commandPayload?.boardSellIndex !== undefined
    ? controller.getBoardPlacementsForPlayer(client.sessionId)
    : undefined;

  deps.getSharedBoardBridge()?.logGameCommandEvent({
    playerId: client.sessionId,
    eventType: "apply_request",
    success: true,
    latencyMs: 0,
    correlationId,
  });

  const submitStartedAtMs = Date.now();

  const result = controller.submitPrepCommand(
    client.sessionId,
    message.cmdSeq,
    submitStartedAtMs,
    commandPayload,
  );

  const submitLatencyMs = Date.now() - submitStartedAtMs;

  if (result.accepted) {
    deps.getSharedBoardBridge()?.logGameCommandEvent({
      playerId: client.sessionId,
      eventType: "apply_result",
      success: true,
      latencyMs: submitLatencyMs,
      correlationId,
    });

    deps.logPrepCommandActions(
      client.sessionId,
      commandPayload,
      shopOffersSnapshot,
      benchUnitsSnapshot,
      boardPlacementsSnapshot,
    );
  } else {
    deps.getSharedBoardBridge()?.logGameCommandEvent({
      playerId: client.sessionId,
      eventType: "error",
      success: false,
      latencyMs: submitLatencyMs,
      correlationId,
      errorCode: result.code,
      errorMessage: result.code,
    });
  }

  const player = deps.getPlayer(client.sessionId);

  if (result.accepted && player) {
    deps.syncPlayerFromCommandResult(player, client.sessionId, message.cmdSeq);
    const bridge = deps.getSharedBoardBridge();
    const requiresSharedBoardViewSync = commandPayload?.heroPlacementCell !== undefined
      || commandPayload?.subUnitMove !== undefined
      || commandPayload?.boardUnitMove !== undefined
      || commandPayload?.boardToBenchCell !== undefined
      || (
        commandPayload?.benchToBoardCell !== undefined
        && commandPayload.benchToBoardCell.slot === "sub"
      );

    if (requiresSharedBoardViewSync) {
      bridge?.syncSharedBoardViewFromController(true);
    } else {
      const latestBoardPlacements = controller.getBoardPlacementsForPlayer(client.sessionId);
      void bridge?.sendPlacementToSharedBoard(
        client.sessionId,
        latestBoardPlacements,
      );
    }
  }

  client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, result);
}

export function handleAdminQueryMessage(
  client: Client,
  message: AdminQueryMessage,
  deps: GameRoomMessageHandlerDeps,
): void {
  const kind = typeof message?.kind === "string" ? message.kind : "";
  const correlationId =
    typeof message?.correlationId === "string"
      ? message.correlationId.trim() || undefined
      : undefined;

  if (kind.length === 0) {
    client.send(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, {
      ok: false,
      kind: "dashboard",
      timestamp: Date.now(),
      correlationId,
      error: "INVALID_KIND",
    });
    return;
  }

  if (kind === "player_snapshot" && !deps.isAdminQueryClient(client)) {
    client.send(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, {
      ok: false,
      kind,
      timestamp: Date.now(),
      correlationId,
      error: "FORBIDDEN",
    });
    return;
  }

  dispatchAdminQuery(client, message, {
    bridge: deps.getSharedBoardBridge(),
    getPlayerSnapshots: () => deps.buildAdminPlayerSnapshots(),
  });
}

function sendInvalidPayload(client: Client): void {
  client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, {
    accepted: false,
    code: "INVALID_PAYLOAD",
  });
}

function canAcceptBossPreferenceState(state: MatchRoomState): boolean {
  return state.phase === "Waiting" && state.lobbyStage === "preference";
}

function isRecordMessage(message: unknown): message is Record<string, unknown> {
  return message !== null && typeof message === "object";
}
