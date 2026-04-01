import { CloseCode, type Client, Room } from "colyseus";
import { ServerError } from "@colyseus/core";

import { MatchRoomController } from "../match-room-controller";
import { isBossCharacterId } from "../../shared/boss-characters";
import { syncRanking } from "./game-room/ranking-sync";
import {
  syncPlayerStateFromController,
  syncPlayerStateFromCommandResult,
} from "./game-room/player-state-sync";
import {
  resetSelectionStage,
  resolveBossPlayerId,
} from "./game-room/lobby-role-selection";
import { logPrepCommandActions } from "./game-room/prep-command-logging";
import type { LoggedPrepCommandPayload } from "./game-room/prep-command-payload";
import {
  handleAdminQueryMessage,
  handleBossPreferenceMessage,
  handleBossSelectMessage,
  handleHeroSelectMessage,
  handlePrepCommandMessage,
  handleReadyMessage,
  type GameRoomMessageHandlerDeps,
} from "./game-room/message-handler";
import { FeatureFlagService } from "../feature-flag-service";
import { SharedBoardBridge } from "../shared-board-bridge";
import { MatchLogger } from "../match-logger";
import { validateRosterAvailability } from "../roster/roster-provider";
import {
  MatchRoomState,
  PlayerPresenceState,
} from "../schema/match-room-state";
import {
  CLIENT_MESSAGE_TYPES,
  type PlayerFacingPhase,
  SERVER_MESSAGE_TYPES,
  type AdminPlayerSnapshot,
  type AdminQueryMessage,
  type BossPreferenceMessage,
  type BossSelectMessage,
  type PrepCommandMessage,
  type ReadyMessage,
  type RoundStateMessage,
} from "../../shared/room-messages";
import {
  DEFAULT_UNIT_EFFECT_SET_ID,
  isUnitEffectSetId,
  type UnitEffectSetId,
} from "../combat/unit-effect-definitions";
import { DEFAULT_FLAGS, type FeatureFlags } from "../../shared/feature-flags";

interface GameRoomOptions {
  readyAutoStartMs?: number;
  prepDurationMs?: number;
  battleDurationMs?: number;
  settleDurationMs?: number;
  eliminationDurationMs?: number;
  selectionTimeoutMs?: number;
  setId?: UnitEffectSetId;
  sharedBoardRoomId?: string;
  forcedFeatureFlags?: FeatureFlags;
  spectator?: boolean;
}

export class GameRoom extends Room<{ state: MatchRoomState }> {
  private static readonly MAX_PLAYERS = 4;
  private static readonly MAX_SPECTATORS = 1;
  private static readonly MIN_ACTIVE_PLAYERS_TO_START = GameRoom.MAX_PLAYERS;

  private static readonly RECONNECT_WINDOW_SECONDS = 90;

  private static readonly DEFAULT_SELECTION_TIMEOUT_MS = 30_000;

  private readyAutoStartMs = 60_000;

  private prepDurationMs = 45_000;

  private battleDurationMs = 40_000;

  private settleDurationMs = 5_000;

  private eliminationDurationMs = 2_000;

  private setId: UnitEffectSetId = DEFAULT_UNIT_EFFECT_SET_ID;

  private selectionTimeoutMs = GameRoom.DEFAULT_SELECTION_TIMEOUT_MS;

  private featureFlags: FeatureFlags = { ...DEFAULT_FLAGS };

  private controller: MatchRoomController | null = null;

  private sharedBoardBridge: SharedBoardBridge | null = null;
  private sharedBoardRoomId: string | undefined;

  private matchLogger: MatchLogger | null = null;

  private enableSharedBoardShadow = false;

  private playerHpCache: Map<string, number> = new Map();

  private lastRoundIndex = 0;

  private lobbyReadyDeadlineAtMs = 0;

  public onCreate(options: GameRoomOptions = {}): void {
    this.maxClients = GameRoom.MAX_PLAYERS + GameRoom.MAX_SPECTATORS;
    this.state = new MatchRoomState();
    this.state.maxPlayers = GameRoom.MAX_PLAYERS;
    const rawSetId = (options as { setId?: unknown }).setId;

    if (rawSetId !== undefined && !isUnitEffectSetId(rawSetId)) {
      throw new Error(`Invalid setId: ${String(rawSetId)}`);
    }

    this.readyAutoStartMs = options.readyAutoStartMs ?? this.readyAutoStartMs;
    this.prepDurationMs = options.prepDurationMs ?? this.prepDurationMs;
    this.battleDurationMs = options.battleDurationMs ?? this.battleDurationMs;
    this.settleDurationMs = options.settleDurationMs ?? this.settleDurationMs;
    this.eliminationDurationMs =
      options.eliminationDurationMs ?? this.eliminationDurationMs;
    this.selectionTimeoutMs = options.selectionTimeoutMs ?? this.selectionTimeoutMs;
    this.setId = rawSetId ?? this.setId;
    this.sharedBoardRoomId = options.sharedBoardRoomId;
    this.state.setId = this.setId;
    this.state.sharedBoardRoomId = this.sharedBoardRoomId ?? "";

    // Load feature flags
    const forcedFeatureFlags = options.forcedFeatureFlags;
    const flagService = FeatureFlagService.getInstance();
    if (!forcedFeatureFlags) {
      flagService.validateFlagConfiguration();
    }
    const flags = forcedFeatureFlags ?? flagService.getFlags();
    this.featureFlags = { ...flags };
    this.state.featureFlagsEnableHeroSystem = flags.enableHeroSystem;
    this.state.featureFlagsEnableSharedPool =
      flags.enableSharedPool || flags.enablePerUnitSharedPool;
    this.state.featureFlagsEnablePhaseExpansion = flags.enablePhaseExpansion;
    this.state.featureFlagsEnableSubUnitSystem = flags.enableSubUnitSystem;
    this.state.featureFlagsEnableSpellCard = flags.enableSpellCard;
    this.state.featureFlagsEnableRumorInfluence = flags.enableRumorInfluence;
    this.state.featureFlagsEnableBossExclusiveShop = flags.enableBossExclusiveShop;
    this.state.featureFlagsEnableSharedBoardShadow = flags.enableSharedBoardShadow;
    this.state.featureFlagsEnableTouhouRoster = flags.enableTouhouRoster;
    this.state.featureFlagsEnableTouhouFactions = flags.enableTouhouFactions;
    this.state.featureFlagsEnablePerUnitSharedPool = flags.enablePerUnitSharedPool;
    this.enableSharedBoardShadow = flags.enableSharedBoardShadow;

    validateRosterAvailability(flags);

    this.onMessage<ReadyMessage>(CLIENT_MESSAGE_TYPES.READY, async (client, message) => {
      await handleReadyMessage(client, message, this.createMessageHandlerDeps());
    });

    this.onMessage<BossPreferenceMessage>(
      CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE,
      (client, message) => {
        handleBossPreferenceMessage(client, message, this.createMessageHandlerDeps());
      },
    );

    this.onMessage<BossSelectMessage>(
      CLIENT_MESSAGE_TYPES.BOSS_SELECT,
      async (client, message) => {
        await handleBossSelectMessage(client, message, this.createMessageHandlerDeps());
      },
    );

    this.onMessage<PrepCommandMessage>(
      CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      (client, message) => {
        handlePrepCommandMessage(client, message, this.createMessageHandlerDeps());
      },
    );

    this.onMessage<AdminQueryMessage>(
      CLIENT_MESSAGE_TYPES.ADMIN_QUERY,
      (client, message) => {
        handleAdminQueryMessage(client, message, this.createMessageHandlerDeps());
      },
    );

    this.onMessage(CLIENT_MESSAGE_TYPES.HERO_SELECT, async (client, message) => {
      await handleHeroSelectMessage(
        client,
        message as { heroId: string },
        this.createMessageHandlerDeps(),
      );
    });

    this.clock.setInterval(() => {
      this.advanceLoop(Date.now());
    }, 50);
  }

  public onJoin(client: Client, options?: { spectator?: boolean }): void {
    const isSpectator = options?.spectator === true;
    const trackedActivePlayerIds = this.getTrackedActivePlayerIds()
      .filter((playerId) => playerId !== client.sessionId);
    const trackedSpectatorIds = this.getTrackedSpectatorIds()
      .filter((playerId) => playerId !== client.sessionId);

    if (isSpectator) {
      if (trackedSpectatorIds.length >= GameRoom.MAX_SPECTATORS) {
        throw new ServerError(4004, "Spectator capacity reached");
      }
    } else if (trackedActivePlayerIds.length >= GameRoom.MAX_PLAYERS) {
      throw new ServerError(4004, "Active player capacity reached");
    }

    const playerState = new PlayerPresenceState();
    playerState.isSpectator = isSpectator;
    playerState.role = playerState.isSpectator ? "spectator" : "unassigned";
    this.state.players.set(client.sessionId, playerState);

    if (playerState.isSpectator) {
      this.broadcastRoundState();
      return;
    }

    if (this.controller !== null && this.controller.phase !== "Waiting") {
      return;
    }

    if (trackedActivePlayerIds.length + 1 < GameRoom.MIN_ACTIVE_PLAYERS_TO_START) {
      return;
    }

    this.initializeController();

    this.clock.setTimeout(() => {
      void this.tryStartMatch(Date.now());
    }, this.readyAutoStartMs);
  }

  private initializeController(): void {
    const createdAtMs = Date.now();
    const activePlayerIds = this.getConnectedActivePlayerIds();

    if (activePlayerIds.length < GameRoom.MIN_ACTIVE_PLAYERS_TO_START) {
      this.disposePreStartController();
      return;
    }

    if (this.sharedBoardBridge) {
      this.sharedBoardBridge.dispose();
      this.sharedBoardBridge = null;
    }

    this.controller = new MatchRoomController(
      activePlayerIds,
      createdAtMs,
      {
        readyAutoStartMs: this.readyAutoStartMs,
        prepDurationMs: this.prepDurationMs,
        battleDurationMs: this.battleDurationMs,
        settleDurationMs: this.settleDurationMs,
        eliminationDurationMs: this.eliminationDurationMs,
        setId: this.setId,
        featureFlags: this.featureFlags,
      },
    );
    this.lobbyReadyDeadlineAtMs = createdAtMs + this.readyAutoStartMs;
    this.state.phaseDeadlineAtMs = 0;
    this.state.playerPhase = "lobby";
    this.state.playerPhaseDeadlineAtMs = 0;
    this.state.lobbyStage = "preference";
    this.state.selectionDeadlineAtMs = 0;

    for (const joinedClient of this.clients) {
      const playerState = this.state.players.get(joinedClient.sessionId);
      if (!playerState || playerState.isSpectator) {
        continue;
      }
      const player = this.state.players.get(joinedClient.sessionId);
      if (player?.ready === true) {
        this.controller.setReady(joinedClient.sessionId, true);
      }
    }

    // SharedBoardBridge初期化（Feature Flag制御・非同期・fail-open）
    if (this.enableSharedBoardShadow && this.controller) {
      this.sharedBoardBridge = new SharedBoardBridge(
        this,
        this.controller,
        true,
        this.sharedBoardRoomId,
      );
    }
  }

  private disposePreStartController(): void {
    if (this.sharedBoardBridge) {
      this.sharedBoardBridge.dispose();
      this.sharedBoardBridge = null;
    }

    this.controller = null;
    this.lobbyReadyDeadlineAtMs = 0;
  }

  private isBossRoleSelectionEnabled(): boolean {
    return (
      this.state.featureFlagsEnableBossExclusiveShop
      && this.state.featureFlagsEnableHeroSystem
    );
  }

  private restartLobbyReadyDeadline(nowMs: number): void {
    this.lobbyReadyDeadlineAtMs = nowMs + this.readyAutoStartMs;
  }

  private getConnectedActivePlayerIds(): string[] {
    return this.clients
      .map((client) => client.sessionId)
      .filter((playerId) => this.state.players.get(playerId)?.isSpectator !== true);
  }

  private getConnectedSpectatorIds(): string[] {
    return this.clients
      .map((client) => client.sessionId)
      .filter((playerId) => this.state.players.get(playerId)?.isSpectator === true);
  }

  private getTrackedActivePlayerIds(): string[] {
    return Array.from(this.state.players.entries())
      .filter(([, playerState]) => playerState.isSpectator !== true)
      .map(([playerId]) => playerId);
  }

  private getTrackedSpectatorIds(): string[] {
    return Array.from(this.state.players.entries())
      .filter(([, playerState]) => playerState.isSpectator === true)
      .map(([playerId]) => playerId);
  }

  private clearRaidPlayerIds(): void {
    this.state.raidPlayerIds.splice(0, this.state.raidPlayerIds.length);
  }

  private broadcastRoundState(): void {
    this.broadcast(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
      this.createRoundStateMessage(),
    );
  }

  private finalizeStartedMatch(connectedPlayerIds: string[]): void {
    this.matchLogger = new MatchLogger(this.roomId, this.roomId);
    for (const playerId of connectedPlayerIds) {
      this.matchLogger.registerPlayer(playerId);
    }

    this.controller?.setMatchLogger(this.matchLogger);
  }

  private resetSelectionToPreference(nowMs: number): void {
    const connectedPlayerIds = this.getConnectedActivePlayerIds();
    const resetState = resetSelectionStage({
      connectedPlayerIds,
      players: this.state.players,
    });

    this.state.lobbyStage = resetState.lobbyStage;
    this.state.selectionDeadlineAtMs = resetState.selectionDeadlineAtMs;
    this.state.bossPlayerId = resetState.bossPlayerId;
    this.state.phase = "Waiting";
    this.state.prepDeadlineAtMs = 0;
    this.state.playerPhase = "lobby";
    this.state.playerPhaseDeadlineAtMs = 0;
    this.clearRaidPlayerIds();

    if (connectedPlayerIds.length >= GameRoom.MIN_ACTIVE_PLAYERS_TO_START && this.controller) {
      this.restartLobbyReadyDeadline(nowMs);
      this.broadcastRoundState();
      return;
    }

    this.state.phaseDeadlineAtMs = 0;
    this.disposePreStartController();
    this.broadcastRoundState();
  }

  private maybeResolveBossSelectionStage(nowMs: number): void {
    const connectedPlayerIds = this.getConnectedActivePlayerIds();

    if (connectedPlayerIds.length < GameRoom.MIN_ACTIVE_PLAYERS_TO_START) {
      return;
    }

    const allReady = connectedPlayerIds.every(
      (playerId) => this.state.players.get(playerId)?.ready === true,
    );
    const autoStartReached = nowMs >= this.lobbyReadyDeadlineAtMs;

    if (!allReady && !autoStartReached) {
      return;
    }

    const wantsBossByPlayer = new Map<string, boolean>();
    for (const playerId of connectedPlayerIds) {
      wantsBossByPlayer.set(
        playerId,
        this.state.players.get(playerId)?.wantsBoss === true,
      );
    }

    const bossPlayerId = resolveBossPlayerId({
      connectedPlayerIds,
      wantsBossByPlayer,
      random: () => Math.random(),
    });

    if (bossPlayerId === "") {
      return;
    }

    this.state.lobbyStage = "selection";
    this.state.selectionDeadlineAtMs = nowMs + this.selectionTimeoutMs;
    this.state.phaseDeadlineAtMs = 0;
    this.state.bossPlayerId = bossPlayerId;
    this.state.playerPhase = "selection";
    this.state.playerPhaseDeadlineAtMs = this.state.selectionDeadlineAtMs;
    this.clearRaidPlayerIds();

    for (const playerId of connectedPlayerIds) {
      const player = this.state.players.get(playerId);
      if (!player) {
        continue;
      }

      const isBossPlayer = playerId === bossPlayerId;
      player.role = isBossPlayer ? "boss" : "raid";
      if (isBossPlayer) {
        player.selectedHeroId = "";
        continue;
      }

      player.selectedBossId = "";
      this.state.raidPlayerIds.push(playerId);
    }

    this.broadcastRoundState();
  }

  private areRequiredSelectionsComplete(connectedPlayerIds: string[]): boolean {
    if (this.state.bossPlayerId === "") {
      return false;
    }

    const bossPlayer = this.state.players.get(this.state.bossPlayerId);
    if (!bossPlayer || bossPlayer.role !== "boss" || !isBossCharacterId(bossPlayer.selectedBossId)) {
      return false;
    }

    return connectedPlayerIds
      .filter((playerId) => playerId !== this.state.bossPlayerId)
      .every((playerId) => {
        const player = this.state.players.get(playerId);
        return player?.role === "raid" && player.selectedHeroId !== "";
      });
  }

  private async startResolvedMatch(nowMs: number, connectedPlayerIds: string[]): Promise<void> {
    if (!this.controller) {
      return;
    }

    const selectedHeroByPlayer = new Map<string, string>();
    const selectedBossByPlayer = new Map<string, string>();

    for (const playerId of connectedPlayerIds) {
      const player = this.state.players.get(playerId);
      if (!player) {
        continue;
      }

      if (player.role === "boss") {
        selectedBossByPlayer.set(playerId, player.selectedBossId);
        continue;
      }

      if (player.role === "raid") {
        selectedHeroByPlayer.set(playerId, player.selectedHeroId);
      }
    }

    const started = this.controller.startWithResolvedRoles(nowMs, connectedPlayerIds, {
      bossPlayerId: this.state.bossPlayerId,
      selectedHeroByPlayer,
      selectedBossByPlayer,
    });

    if (!started) {
      return;
    }

    this.state.lobbyStage = "started";
    this.state.selectionDeadlineAtMs = 0;
    this.finalizeStartedMatch(connectedPlayerIds);
    this.syncStateFromController();
    await this.lock();
  }

  private cleanupLobbyPlayer(sessionId: string): void {
    this.state.players.delete(sessionId);

    if (this.controller?.phase === "Waiting") {
      this.controller.removePlayer(sessionId);

      if (this.getConnectedActivePlayerIds().length < GameRoom.MIN_ACTIVE_PLAYERS_TO_START) {
        this.disposePreStartController();
      }
    }

    for (const [playerId, player] of this.state.players.entries()) {
      if (player.isSpectator) {
        continue;
      }
      player.ready = false;
      player.lastCmdSeq = 0;
      this.controller?.setReady(playerId, false);
    }

    this.state.phase = "Waiting";
    this.state.lobbyStage = "preference";
    this.state.phaseDeadlineAtMs = 0;
    this.state.selectionDeadlineAtMs = 0;
    this.state.prepDeadlineAtMs = 0;
    this.state.playerPhase = "lobby";
    this.state.playerPhaseDeadlineAtMs = 0;
    this.state.bossPlayerId = "";
    this.clearRaidPlayerIds();
    this.state.roundIndex = 0;
    syncRanking(this.state.ranking, []);
    if (this.controller && this.getConnectedActivePlayerIds().length >= GameRoom.MIN_ACTIVE_PLAYERS_TO_START) {
      this.restartLobbyReadyDeadline(Date.now());
    } else {
      this.lobbyReadyDeadlineAtMs = 0;
    }
    this.broadcastRoundState();
  }

  public async onLeave(client: Client, code: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    if (player.isSpectator) {
      this.state.players.delete(client.sessionId);
      this.broadcastRoundState();
      return;
    }

    const isLobbyPhase = this.controller === null || this.controller.phase === "Waiting";

    if (isLobbyPhase) {
      if (this.state.lobbyStage === "selection") {
        this.state.players.delete(client.sessionId);
        this.controller?.removePlayer(client.sessionId);
        this.resetSelectionToPreference(Date.now());
        return;
      }

      this.cleanupLobbyPlayer(client.sessionId);
      return;
    }

    player.connected = false;

    if (code === CloseCode.CONSENTED) {
      return;
    }

    try {
      await this.allowReconnection(client, GameRoom.RECONNECT_WINDOW_SECONDS);
      player.connected = true;
    } catch {
      player.ready = false;
    }
  }

  public onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    player.connected = true;
  }

  private syncPlayerFromCommandResult(
    player: PlayerPresenceState,
    sessionId: string,
    cmdSeq: number,
  ): void {
    if (!this.controller) return;

    const latestStatus = this.controller.getPlayerStatus(sessionId);
    syncPlayerStateFromCommandResult(player, latestStatus, cmdSeq);
  }


  private logPrepCommandActions(
    sessionId: string,
    commandPayload: LoggedPrepCommandPayload | undefined,
    shopOffersSnapshot?: Array<{ unitType: string; cost: number; isRumorUnit?: boolean }>,
    benchUnitsSnapshot?: Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; cost: number; starLevel: number; unitCount: number }>,
    boardPlacementsSnapshot?: Array<{ cell: number; unitType: "vanguard" | "ranger" | "mage" | "assassin"; sellValue?: number; starLevel?: number; unitCount?: number }>,
  ): void {
    logPrepCommandActions(sessionId, commandPayload, {
      logger: this.matchLogger,
      getShopOffers: (sid) => this.controller?.getShopOffersForPlayer(sid),
      getBossShopOffers: (sid) => this.controller?.getBossShopOffersForPlayer(sid),
      getBenchUnits: (sid) => this.controller?.getBenchUnitDetailsForPlayer(sid),
      getBoardPlacements: (sid) => this.controller?.getBoardPlacementsForPlayer(sid),
      getRoundIndex: () => this.controller?.roundIndex ?? 0,
      getPlayerGold: (sid) => this.state.players.get(sid)?.gold ?? 0,
    }, { shopOffersSnapshot, benchUnitsSnapshot, boardPlacementsSnapshot });
  }

  private isAdminQueryClient(client: Client): boolean {
    return this.state.players.get(client.sessionId)?.isSpectator === true;
  }

  private buildAdminPlayerSnapshots(): AdminPlayerSnapshot[] {
    return Array.from(this.state.players.entries()).map(([sessionId, playerState]) => ({
      sessionId,
      name: sessionId,
      role: playerState.role,
      ready: playerState.ready,
      connected: playerState.connected,
      isSpectator: playerState.isSpectator,
      wantsBoss: playerState.wantsBoss,
      gold: playerState.gold,
      boardUnitCount: playerState.boardUnitCount,
      benchUnits: Array.from(playerState.benchUnits),
      selectedHeroId: playerState.selectedHeroId || null,
      selectedBossId: playerState.selectedBossId || null,
    }));
  }



  private async tryStartMatch(nowMs: number): Promise<void> {
    if (!this.controller) {
      return;
    }

    const connectedPlayerIds = this.getConnectedActivePlayerIds();

    if (this.isBossRoleSelectionEnabled() && this.controller.phase === "Waiting") {
      if (this.state.lobbyStage === "selection") {
        if (connectedPlayerIds.length < GameRoom.MIN_ACTIVE_PLAYERS_TO_START) {
          this.resetSelectionToPreference(nowMs);
          return;
        }

        if (this.areRequiredSelectionsComplete(connectedPlayerIds)) {
          await this.startResolvedMatch(nowMs, connectedPlayerIds);
        }

        return;
      }

      this.maybeResolveBossSelectionStage(nowMs);
      return;
    }

    const started = this.controller.startIfReady(nowMs, connectedPlayerIds);

    if (!started) {
      return;
    }

    this.finalizeStartedMatch(connectedPlayerIds);
    this.syncStateFromController();
    await this.lock();
  }

  private advanceLoop(nowMs: number): void {
    if (!this.controller) {
      return;
    }

    if (this.controller.phase === "Waiting") {
      if (
        this.isBossRoleSelectionEnabled()
        && this.state.lobbyStage === "selection"
        && this.state.selectionDeadlineAtMs > 0
        && nowMs >= this.state.selectionDeadlineAtMs
      ) {
        this.resetSelectionToPreference(nowMs);
        return;
      }

      void this.tryStartMatch(nowMs);
      return;
    }

    const progressed = this.controller.advanceByTime(nowMs);

    if (!progressed && !this.isStartedPlayerPhaseDirty(nowMs) && this.controller.phase !== "End") {
      return;
    }

    this.syncStateFromController();
  }

  /**
   * 指定プレイヤーのみをcontrollerから同期（SharedBoardBridgeのバッチ同期用）
   * @param playerIds 同期対象プレイヤーID一覧
   */
  public syncPlayersFromController(playerIds: string[]): void {
    if (!this.controller || playerIds.length === 0) {
      return;
    }

    const uniquePlayerIds = [...new Set(playerIds)];
    this.syncStateFromController(uniquePlayerIds);
  }

  private syncStateFromController(playerIds?: ReadonlyArray<string>): void {
    if (!this.controller) {
      return;
    }

    const previousPhase = this.state.phase;
    const previousPlayerPhase = this.state.playerPhase;
    const previousRoundIndex = this.state.roundIndex;
    const playerFacingPhase = this.controller.getPlayerFacingPhaseState();
    this.resetPrepReadyStateForNewPurchase({
      previousPhase,
      previousPlayerPhase,
      previousRoundIndex,
      nextPhase: this.controller.phase,
      nextPlayerPhase: playerFacingPhase.phase,
      nextRoundIndex: this.controller.roundIndex,
    });

    this.state.phase = this.controller.phase;
    this.state.phaseDeadlineAtMs = this.controller.phaseDeadlineAtMs ?? 0;
    this.state.sharedBoardRoomId = this.sharedBoardRoomId ?? "";
    this.state.prepDeadlineAtMs =
      this.controller.phase === "Prep" ? this.controller.prepDeadlineAtMs ?? 0 : 0;
    this.state.playerPhase = playerFacingPhase.phase;
    this.state.playerPhaseDeadlineAtMs = playerFacingPhase.deadlineAtMs;
    this.state.lobbyStage = this.controller.phase === "Waiting"
      ? this.state.lobbyStage
      : "started";
    this.state.selectionDeadlineAtMs = this.controller.phase === "Waiting"
      ? this.state.selectionDeadlineAtMs
      : 0;
    this.state.roundIndex = this.controller.roundIndex;
    this.state.setId = this.setId;

    // Keep room state tied to the onCreate snapshot so test helpers and reconnects
    // do not re-read mutated process-wide feature flag state mid-match.
    this.state.featureFlagsEnableHeroSystem = this.featureFlags.enableHeroSystem;
    this.state.featureFlagsEnableSharedPool =
      this.featureFlags.enableSharedPool || this.featureFlags.enablePerUnitSharedPool;
    this.state.featureFlagsEnablePhaseExpansion =
      this.featureFlags.enablePhaseExpansion;
    this.state.featureFlagsEnableSubUnitSystem =
      this.featureFlags.enableSubUnitSystem;
    this.state.featureFlagsEnableSpellCard = this.featureFlags.enableSpellCard;
    this.state.featureFlagsEnableRumorInfluence =
      this.featureFlags.enableRumorInfluence;
    this.state.featureFlagsEnableBossExclusiveShop =
      this.featureFlags.enableBossExclusiveShop;
    this.state.featureFlagsEnableSharedBoardShadow =
      this.featureFlags.enableSharedBoardShadow;
    this.state.featureFlagsEnableTouhouRoster =
      this.featureFlags.enableTouhouRoster;
    this.state.featureFlagsEnableTouhouFactions =
      this.featureFlags.enableTouhouFactions;
    this.state.featureFlagsEnablePerUnitSharedPool =
      this.featureFlags.enablePerUnitSharedPool;
    const declaredSpell = this.controller.getDeclaredSpell();
    this.state.declaredSpellId = declaredSpell?.id ?? "";
    this.state.usedSpellIds.splice(0, this.state.usedSpellIds.length);
    for (const spellId of this.controller.getUsedSpellIds()) {
      this.state.usedSpellIds.push(spellId);
    }
    this.state.bossPlayerId = this.controller.getBossPlayerId() ?? "";
    this.state.raidPlayerIds.splice(0, this.state.raidPlayerIds.length);
    for (const playerId of this.controller.getRaidPlayerIds()) {
      this.state.raidPlayerIds.push(playerId);
    }
    this.state.sharedBoardAuthorityEnabled = this.isSharedBoardAuthoritativePrep();
    this.state.sharedBoardMode = this.resolveSharedBoardMode();
    this.state.dominationCount = this.controller.getDominationCount() ?? 0;

    syncRanking(this.state.ranking, this.controller.rankingTopToBottom);

    const targetPlayerIds =
      playerIds && playerIds.length > 0
        ? playerIds
        : Array.from(this.state.players.keys());

    for (const playerId of targetPlayerIds) {
      this.syncSinglePlayerStateFromController(playerId);
    }

    // Track rounds survived for logging after state sync
    if (this.state.roundIndex > this.lastRoundIndex) {
      for (const playerId of this.getTrackedActivePlayerIds()) {
        const status = this.controller.getPlayerStatus(playerId);
        if (!status.eliminated) {
          this.matchLogger?.incrementRoundsSurvived(playerId);
        }
      }
      this.lastRoundIndex = this.state.roundIndex;
    }

    this.broadcast(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
      this.createRoundStateMessage(),
    );
  }

  private resetPrepReadyStateForNewPurchase(input: {
    previousPhase: string;
    previousPlayerPhase: string;
    previousRoundIndex: number;
    nextPhase: string;
    nextPlayerPhase: string;
    nextRoundIndex: number;
  }): void {
    if (!this.controller) {
      return;
    }

    if (input.nextPhase !== "Prep" || input.nextPlayerPhase !== "purchase") {
      return;
    }

    const isNewPurchaseWindow =
      input.previousPhase !== "Prep"
      || input.previousPlayerPhase !== "purchase"
      || input.previousRoundIndex !== input.nextRoundIndex;

    if (!isNewPurchaseWindow) {
      return;
    }

    for (const [playerId, playerState] of this.state.players.entries()) {
      if (playerState.isSpectator) {
        continue;
      }

      playerState.ready = false;
      this.controller.setReady(playerId, false);
    }
  }

  private syncSinglePlayerStateFromController(playerId: string): void {
    if (!this.controller) {
      return;
    }

    const playerState = this.state.players.get(playerId);
    if (!playerState) {
      return;
    }

    if (playerState.isSpectator) {
      playerState.ready = false;
      playerState.wantsBoss = false;
      playerState.selectedBossId = "";
      playerState.selectedHeroId = "";
      playerState.role = "spectator";
      return;
    }

    const status = this.controller.getPlayerStatus(playerId);

    // Track HP changes for logging
    const previousHp = this.playerHpCache.get(playerId);
    if (previousHp !== undefined && previousHp !== status.hp) {
      this.matchLogger?.updatePlayerHp(playerId, status.hp);
    }
    this.playerHpCache.set(playerId, status.hp);

    syncPlayerStateFromController(playerState, status);
  }



  private createRoundStateMessage(): RoundStateMessage {
    const phaseProgress =
      this.controller && this.controller.phase !== "Waiting"
        ? this.controller.getPhaseProgress()
        : undefined;

    return {
      phase: this.state.phase as RoundStateMessage["phase"],
      playerPhase: this.state.playerPhase as PlayerFacingPhase,
      roundIndex: this.state.roundIndex,
      phaseDeadlineAtMs: this.state.phaseDeadlineAtMs,
      playerPhaseDeadlineAtMs: this.state.playerPhaseDeadlineAtMs,
      sharedBoardRoomId: this.state.sharedBoardRoomId,
      lobbyStage: this.state.lobbyStage,
      selectionDeadlineAtMs: this.state.selectionDeadlineAtMs,
      ranking: Array.from(this.state.ranking),
      bossPlayerId: this.state.bossPlayerId,
      raidPlayerIds: Array.from(this.state.raidPlayerIds),
      sharedBoardAuthorityEnabled: this.state.sharedBoardAuthorityEnabled,
      sharedBoardMode: this.state.sharedBoardMode,
      dominationCount: this.state.dominationCount,
      phaseHpTarget: phaseProgress?.targetHp ?? 0,
      phaseDamageDealt: phaseProgress?.damageDealt ?? 0,
      phaseResult: phaseProgress?.result ?? "pending",
      phaseCompletionRate: phaseProgress?.completionRate ?? 0,
    };
  }

  private isStartedPlayerPhaseDirty(nowMs: number): boolean {
    if (!this.controller || this.controller.phase === "Waiting") {
      return false;
    }

    const playerFacingPhase = this.controller.getPlayerFacingPhaseState(nowMs);
    return this.state.playerPhase !== playerFacingPhase.phase
      || this.state.playerPhaseDeadlineAtMs !== playerFacingPhase.deadlineAtMs;
  }

  private isSharedBoardAuthoritativePrep(): boolean {
    return this.resolveSharedBoardMode() === "half-shared";
  }

  private resolveSharedBoardMode(): string {
    const bridgeReady = this.sharedBoardBridge?.getState() === "READY";

    if (
      this.state.featureFlagsEnableSharedBoardShadow
      && this.state.featureFlagsEnableBossExclusiveShop
      && this.state.bossPlayerId !== ""
      && bridgeReady
    ) {
      return "half-shared";
    }

    if (this.state.featureFlagsEnableSharedBoardShadow) {
      return "shadow";
    }

    return "local";
  }

  private createMessageHandlerDeps(): GameRoomMessageHandlerDeps {
    return {
      state: this.state,
      setPlayerReady: (sessionId, ready) => {
        this.controller?.setReady(sessionId, ready);
      },
      tryStartMatch: async (nowMs) => {
        await this.tryStartMatch(nowMs);
      },
      isBossRoleSelectionEnabled: () => this.isBossRoleSelectionEnabled(),
      broadcastRoundState: () => {
        this.broadcastRoundState();
      },
      isSharedBoardAuthoritativePrep: () => this.isSharedBoardAuthoritativePrep(),
      syncPlayerFromCommandResult: (player, sessionId, cmdSeq) => {
        this.syncPlayerFromCommandResult(player, sessionId, cmdSeq);
      },
      logPrepCommandActions: (
        sessionId,
        commandPayload,
        shopOffersSnapshot,
        benchUnitsSnapshot,
        boardPlacementsSnapshot,
      ) => {
        this.logPrepCommandActions(
          sessionId,
          commandPayload,
          shopOffersSnapshot,
          benchUnitsSnapshot,
          boardPlacementsSnapshot,
        );
      },
      buildAdminPlayerSnapshots: () => this.buildAdminPlayerSnapshots(),
      isAdminQueryClient: (client) => this.isAdminQueryClient(client),
      getPlayer: (sessionId) => this.state.players.get(sessionId) ?? null,
      getController: () => this.controller,
      getSharedBoardBridge: () => this.sharedBoardBridge,
    };
  }

  public onDispose(): void {
    // Output match summary log
    if (this.matchLogger && this.controller) {
      const ranking = this.controller.rankingTopToBottom;
      const winner = ranking.length > 0 ? (ranking[0] ?? null) : null;
      const flags = this.featureFlags;

      const featureFlags = {
        enableHeroSystem: flags.enableHeroSystem,
        enableSharedPool: flags.enableSharedPool,
        enablePerUnitSharedPool: flags.enablePerUnitSharedPool,
        enableSpellCard: flags.enableSpellCard,
        enableRumorInfluence: flags.enableRumorInfluence,
        enableBossExclusiveShop: flags.enableBossExclusiveShop,
      };

      // W6-3 Task 3: Capture final board state for all players before outputting summaries
      // This ensures top1CompositionSignature is populated in gameplay_kpi_summary
      for (const playerId of this.getTrackedActivePlayerIds()) {
        const boardPlacements = this.controller.getBoardPlacementsForPlayer(playerId);
        const benchUnits = this.controller.getBenchUnitsForPlayer?.(playerId) ?? [];

        // Convert placements to BoardUnitSnapshot format
        const finalBoardUnits = boardPlacements.map((placement) => ({
          unitType: placement.unitType,
          starLevel: placement.starLevel ?? 1,
          cell: placement.cell,
        }));

        // Convert bench units to BenchUnitSnapshot format
        const finalBenchUnits = benchUnits.map((unit, index) => ({
          unitType: unit.unitType,
          starLevel: unit.starLevel ?? 1,
          benchIndex: index,
        }));

        this.matchLogger.updateFinalUnits(playerId, finalBoardUnits, finalBenchUnits);
      }

      // W6-2: 既存のmatch_summary出力（変更なし）
      this.matchLogger.outputSummary(
        winner,
        ranking,
        this.controller.roundIndex,
        featureFlags,
      );

      // W6-2 Task 4: 新規gameplay_kpi_summary出力（機械可読KPIレポート）
      this.matchLogger.outputGameplayKpiSummary(
        winner,
        ranking,
        this.controller.roundIndex,
        featureFlags,
      );
    }

    // SharedBoardBridgeの破棄
    if (this.sharedBoardBridge) {
      this.sharedBoardBridge.dispose();
      this.sharedBoardBridge = null;
    }
  }

  /**
   * テスト用：controllerからsetPendingRoundDamageを呼び出す
   * @param damageByPlayer ダメージ値マップ
   */
  public setPendingRoundDamageForTest(damageByPlayer: Record<string, number>): void {
    if (!this.controller) {
      return;
    }

    this.controller.setPendingRoundDamage(damageByPlayer);
  }

  /**
   * テスト用：phase progress だけを強制する
   * @param damageValue フェーズ進捗用の合計ダメージ値
   */
  public setPendingPhaseDamageForTest(damageValue: number): void {
    if (!this.controller) {
      return;
    }

    this.controller.setPendingPhaseDamageForTest(damageValue);
  }
}
