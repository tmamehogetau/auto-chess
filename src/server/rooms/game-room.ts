import { CloseCode, type Client, Room } from "colyseus";

import { MatchRoomController } from "../match-room-controller";
import { isBossCharacterId } from "../../shared/boss-characters";
import { resolveCorrelationId } from "./game-room/correlation-id";
import { syncRanking } from "./game-room/ranking-sync";
import {
  syncPlayerStateFromController,
  syncPlayerStateFromCommandResult,
} from "./game-room/player-state-sync";
import {
  canAcceptBossPreference,
  resetSelectionStage,
  resolveBossPlayerId,
} from "./game-room/lobby-role-selection";
import { handleAdminQuery } from "./game-room/admin-query-handler";
import { logPrepCommandActions } from "./game-room/prep-command-logging";
import {
  buildPrepCommandPayload,
  type LoggedPrepCommandPayload,
} from "./game-room/prep-command-payload";
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
  SERVER_MESSAGE_TYPES,
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

interface GameRoomOptions {
  readyAutoStartMs?: number;
  prepDurationMs?: number;
  battleDurationMs?: number;
  settleDurationMs?: number;
  eliminationDurationMs?: number;
  selectionTimeoutMs?: number;
  setId?: UnitEffectSetId;
}

export class GameRoom extends Room<{ state: MatchRoomState }> {
  private static readonly MAX_PLAYERS = 4;

  private static readonly RECONNECT_WINDOW_SECONDS = 90;

  private static readonly DEFAULT_SELECTION_TIMEOUT_MS = 30_000;

  private readyAutoStartMs = 60_000;

  private prepDurationMs = 45_000;

  private battleDurationMs = 40_000;

  private settleDurationMs = 5_000;

  private eliminationDurationMs = 2_000;

  private setId: UnitEffectSetId = DEFAULT_UNIT_EFFECT_SET_ID;

  private selectionTimeoutMs = GameRoom.DEFAULT_SELECTION_TIMEOUT_MS;

  private controller: MatchRoomController | null = null;

  private sharedBoardBridge: SharedBoardBridge | null = null;

  private matchLogger: MatchLogger | null = null;

  private enableSharedBoardShadow = false;

  private playerHpCache: Map<string, number> = new Map();

  private lastRoundIndex = 0;

  private lobbyReadyDeadlineAtMs = 0;

  public onCreate(options: GameRoomOptions = {}): void {
    this.maxClients = GameRoom.MAX_PLAYERS;
    this.state = new MatchRoomState();
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
    this.state.setId = this.setId;

    // Load feature flags
    const flagService = FeatureFlagService.getInstance();
    flagService.validateFlagConfiguration();
    const flags = flagService.getFlags();
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
      await this.handleReady(client, message);
    });

    this.onMessage<BossPreferenceMessage>(
      CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE,
      (client, message) => {
        this.handleBossPreference(client, message);
      },
    );

    this.onMessage<BossSelectMessage>(
      CLIENT_MESSAGE_TYPES.BOSS_SELECT,
      async (client, message) => {
        await this.handleBossSelect(client, message);
      },
    );

    this.onMessage<PrepCommandMessage>(
      CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      (client, message) => {
        this.handlePrepCommand(client, message);
      },
    );

    this.onMessage<AdminQueryMessage>(
      CLIENT_MESSAGE_TYPES.ADMIN_QUERY,
      (client, message) => {
        this.handleAdminQuery(client, message);
      },
    );

    this.onMessage(CLIENT_MESSAGE_TYPES.HERO_SELECT, (client, message) => {
      void this.handleHeroSelect(client, message as { heroId: string });
    });

    this.clock.setInterval(() => {
      this.advanceLoop(Date.now());
    }, 50);
  }

  public onJoin(client: Client): void {
    this.state.players.set(client.sessionId, new PlayerPresenceState());

    if (this.clients.length !== GameRoom.MAX_PLAYERS) {
      return;
    }

    if (this.controller !== null && this.controller.phase !== "Waiting") {
      return;
    }

    this.initializeController();

    this.clock.setTimeout(() => {
      void this.tryStartMatch(Date.now());
    }, this.readyAutoStartMs);
  }

  private initializeController(): void {
    const createdAtMs = Date.now();

    if (this.sharedBoardBridge) {
      this.sharedBoardBridge.dispose();
      this.sharedBoardBridge = null;
    }

    this.controller = new MatchRoomController(
      this.clients.map((joinedClient) => joinedClient.sessionId),
      createdAtMs,
      {
        readyAutoStartMs: this.readyAutoStartMs,
        prepDurationMs: this.prepDurationMs,
        battleDurationMs: this.battleDurationMs,
        settleDurationMs: this.settleDurationMs,
        eliminationDurationMs: this.eliminationDurationMs,
        setId: this.setId,
        featureFlags: {
          enablePhaseExpansion: this.state.featureFlagsEnablePhaseExpansion,
        },
      },
    );
    this.lobbyReadyDeadlineAtMs = createdAtMs + this.readyAutoStartMs;
    this.state.phaseDeadlineAtMs = 0;
    this.state.lobbyStage = "preference";
    this.state.selectionDeadlineAtMs = 0;

    for (const joinedClient of this.clients) {
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
    const connectedPlayerIds = this.clients.map((client) => client.sessionId);
    const resetState = resetSelectionStage({
      connectedPlayerIds,
      players: this.state.players,
    });

    this.state.lobbyStage = resetState.lobbyStage;
    this.state.selectionDeadlineAtMs = resetState.selectionDeadlineAtMs;
    this.state.bossPlayerId = resetState.bossPlayerId;
    this.state.phase = "Waiting";
    this.state.prepDeadlineAtMs = 0;
    this.clearRaidPlayerIds();

    if (connectedPlayerIds.length >= 2 && this.controller) {
      this.restartLobbyReadyDeadline(nowMs);
      this.broadcastRoundState();
      return;
    }

    this.state.phaseDeadlineAtMs = 0;
    this.disposePreStartController();
    this.broadcastRoundState();
  }

  private maybeResolveBossSelectionStage(nowMs: number): void {
    const connectedPlayerIds = this.clients.map((client) => client.sessionId);

    if (connectedPlayerIds.length < 2) {
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

      if (this.clients.length < 2) {
        this.disposePreStartController();
      }
    }

    for (const player of this.state.players.values()) {
      player.ready = false;
      player.lastCmdSeq = 0;
    }

    this.state.phase = "Waiting";
    this.state.lobbyStage = "preference";
    this.state.phaseDeadlineAtMs = 0;
    this.state.selectionDeadlineAtMs = 0;
    this.state.prepDeadlineAtMs = 0;
    this.state.bossPlayerId = "";
    this.clearRaidPlayerIds();
    this.state.roundIndex = 0;
    syncRanking(this.state.ranking, []);
    this.broadcastRoundState();
  }

  public async onLeave(client: Client, code: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
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

  private async handleReady(client: Client, message: ReadyMessage): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    const nextReady = message.ready ?? true;
    player.ready = nextReady;
    this.controller?.setReady(client.sessionId, nextReady);

    if (this.controller) {
      await this.tryStartMatch(Date.now());
    }
  }

  private handleBossPreference(client: Client, message: BossPreferenceMessage): void {
    if (!this.isBossRoleSelectionEnabled()) {
      return;
    }

    if (!canAcceptBossPreference({
      phase: this.state.phase,
      lobbyStage: this.state.lobbyStage,
    })) {
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player || typeof message.wantsBoss !== "boolean") {
      return;
    }

    player.wantsBoss = message.wantsBoss;
    this.broadcastRoundState();
  }

  private async handleBossSelect(client: Client, message: BossSelectMessage): Promise<void> {
    if (!this.controller) {
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (
      !player
      || !this.isBossRoleSelectionEnabled()
      || this.state.phase !== "Waiting"
      || this.state.lobbyStage !== "selection"
      || player.role !== "boss"
      || !isBossCharacterId(message.bossId)
      || client.sessionId !== this.state.bossPlayerId
    ) {
      client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, {
        accepted: false,
        code: "INVALID_PAYLOAD",
      });
      return;
    }

    player.selectedBossId = message.bossId;
    this.broadcastRoundState();
    await this.tryStartMatch(Date.now());
  }

  private async handleHeroSelect(client: Client, message: { heroId: string }): Promise<void> {
    if (!this.controller) {
      return;
    }

    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    // Check if hero system is enabled
    if (!this.state.featureFlagsEnableHeroSystem) {
      return;
    }

    if (this.isBossRoleSelectionEnabled()) {
      if (
        this.state.phase !== "Waiting"
        || this.state.lobbyStage !== "selection"
        || player.role !== "raid"
      ) {
        client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, {
          accepted: false,
          code: "INVALID_PAYLOAD",
        });
        return;
      }
    }

    const { heroId } = message;

    if (!heroId || typeof heroId !== "string") {
      if (this.isBossRoleSelectionEnabled()) {
        client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, {
          accepted: false,
          code: "INVALID_PAYLOAD",
        });
      }
      return;
    }

    try {
      this.controller.selectHero(client.sessionId, heroId);
      player.selectedHeroId = heroId;
      if (this.isBossRoleSelectionEnabled()) {
        this.broadcastRoundState();
        await this.tryStartMatch(Date.now());
      }
    } catch (error) {
      if (this.isBossRoleSelectionEnabled()) {
        client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, {
          accepted: false,
          code: "INVALID_PAYLOAD",
        });
        return;
      }

      console.error(`Hero selection error for ${client.sessionId}:`, error);
    }
  }

  private handlePrepCommand(client: Client, message: PrepCommandMessage): void {
    if (!this.controller) {
      return;
    }

    const correlationId = resolveCorrelationId(
      client.sessionId,
      message.cmdSeq,
      message.correlationId,
    );

    const commandPayload = buildPrepCommandPayload(message);

    if (this.isSharedBoardAuthoritativePrep() && commandPayload?.boardPlacements !== undefined) {
      delete commandPayload.boardPlacements;
    }

    // Capture shop offers snapshot before submit to preserve isRumorUnit info
    const shopOffersSnapshot = commandPayload?.shopBuySlotIndex !== undefined
      ? this.controller.getShopOffersForPlayer(client.sessionId)
      : undefined;

    this.sharedBoardBridge?.logGameCommandEvent({
      playerId: client.sessionId,
      eventType: "apply_request",
      success: true,
      latencyMs: 0,
      correlationId,
    });

    const submitStartedAtMs = Date.now();

    const result = this.controller.submitPrepCommand(
      client.sessionId,
      message.cmdSeq,
      submitStartedAtMs,
      commandPayload,
    );

    const submitLatencyMs = Date.now() - submitStartedAtMs;

    if (result.accepted) {
      this.sharedBoardBridge?.logGameCommandEvent({
        playerId: client.sessionId,
        eventType: "apply_result",
        success: true,
        latencyMs: submitLatencyMs,
        correlationId,
      });

      this.logPrepCommandActions(client.sessionId, commandPayload, shopOffersSnapshot);
    } else {
      this.sharedBoardBridge?.logGameCommandEvent({
        playerId: client.sessionId,
        eventType: "error",
        success: false,
        latencyMs: submitLatencyMs,
        correlationId,
        errorCode: result.code,
        errorMessage: result.code,
      });
    }

    const player = this.state.players.get(client.sessionId);

    if (result.accepted && player) {
      this.syncPlayerFromCommandResult(player, client.sessionId, message.cmdSeq);
      const latestBoardPlacements = this.controller.getBoardPlacementsForPlayer(client.sessionId);
      void this.sharedBoardBridge?.sendPlacementToSharedBoard(client.sessionId, latestBoardPlacements);
    }

    client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, result);
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
  ): void {
    logPrepCommandActions(sessionId, commandPayload, {
      logger: this.matchLogger,
      getShopOffers: (sid) => this.controller?.getShopOffersForPlayer(sid),
      getBossShopOffers: (sid) => this.controller?.getBossShopOffersForPlayer(sid),
      getPlayerStatus: (sid) => this.controller?.getPlayerStatus(sid) ?? null,
      getRoundIndex: () => this.controller?.roundIndex ?? 0,
      getPlayerGold: (sid) => this.state.players.get(sid)?.gold ?? 0,
    }, { shopOffersSnapshot });
  }

  private handleAdminQuery(client: Client, message: AdminQueryMessage): void {
    handleAdminQuery(client, message, {
      bridge: this.sharedBoardBridge,
    });
  }



  private async tryStartMatch(nowMs: number): Promise<void> {
    if (!this.controller) {
      return;
    }

    const connectedPlayerIds = this.clients.map((c) => c.sessionId);

    if (this.isBossRoleSelectionEnabled() && this.controller.phase === "Waiting") {
      if (this.state.lobbyStage === "selection") {
        if (connectedPlayerIds.length < 2) {
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

    // Endフェーズでも状態同期を行う（クライアントが終了を認識できるように）
    if (!progressed && this.controller.phase !== "End") {
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

    this.state.phase = this.controller.phase;
    this.state.phaseDeadlineAtMs = this.controller.phaseDeadlineAtMs ?? 0;
    this.state.prepDeadlineAtMs =
      this.controller.phase === "Prep" ? this.controller.prepDeadlineAtMs ?? 0 : 0;
    this.state.lobbyStage = this.controller.phase === "Waiting"
      ? this.state.lobbyStage
      : "started";
    this.state.selectionDeadlineAtMs = this.controller.phase === "Waiting"
      ? this.state.selectionDeadlineAtMs
      : 0;
    this.state.roundIndex = this.controller.roundIndex;
    this.state.setId = this.setId;

    // スペルカード関連の同期
    const flagService = FeatureFlagService.getInstance();
    this.state.featureFlagsEnableSubUnitSystem = flagService.isFeatureEnabled(
      "enableSubUnitSystem",
    );
    this.state.featureFlagsEnableSpellCard = flagService.isFeatureEnabled('enableSpellCard');
    this.state.featureFlagsEnableRumorInfluence = flagService.isFeatureEnabled('enableRumorInfluence');
    this.state.featureFlagsEnableBossExclusiveShop = flagService.isFeatureEnabled('enableBossExclusiveShop');
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
      for (const playerId of this.state.players.keys()) {
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

  private syncSinglePlayerStateFromController(playerId: string): void {
    if (!this.controller) {
      return;
    }

    const playerState = this.state.players.get(playerId);
    if (!playerState) {
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
      roundIndex: this.state.roundIndex,
      phaseDeadlineAtMs: this.state.phaseDeadlineAtMs,
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

  public onDispose(): void {
    // Output match summary log
    if (this.matchLogger && this.controller) {
      const ranking = this.controller.rankingTopToBottom;
      const winner = ranking.length > 0 ? (ranking[0] ?? null) : null;
      const flags = FeatureFlagService.getInstance().getFlags();

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
      for (const playerId of this.state.players.keys()) {
        const boardPlacements = this.controller.getBoardPlacementsForPlayer(playerId);
        const benchUnits = this.controller.getBenchUnitsForPlayer?.(playerId) ?? [];

        // Convert placements to BoardUnitSnapshot format
        const finalBoardUnits = boardPlacements.map((placement) => ({
          unitType: placement.unitType,
          starLevel: placement.starLevel ?? 1,
          cell: placement.cell,
          items: placement.items ?? [],
        }));

        // Convert bench units to BenchUnitSnapshot format
        const finalBenchUnits = benchUnits.map((unit, index) => ({
          unitType: unit.unitType,
          starLevel: unit.starLevel ?? 1,
          benchIndex: index,
          items: unit.items ?? [],
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
