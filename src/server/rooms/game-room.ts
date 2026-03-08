import { CloseCode, type Client, Room } from "colyseus";

import { MatchRoomController } from "../match-room-controller";
import { resolveCorrelationId } from "./game-room/correlation-id";
import { syncRanking } from "./game-room/ranking-sync";
import {
  syncPlayerStateFromController,
  syncPlayerStateFromCommandResult,
} from "./game-room/player-state-sync";
import { handleAdminQuery } from "./game-room/admin-query-handler";
import { logPrepCommandActions } from "./game-room/prep-command-logging";
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
  setId?: UnitEffectSetId;
}

export class GameRoom extends Room<{ state: MatchRoomState }> {
  private static readonly MAX_PLAYERS = 4;

  private static readonly RECONNECT_WINDOW_SECONDS = 90;

  private readyAutoStartMs = 60_000;

  private prepDurationMs = 45_000;

  private battleDurationMs = 40_000;

  private settleDurationMs = 5_000;

  private eliminationDurationMs = 2_000;

  private setId: UnitEffectSetId = DEFAULT_UNIT_EFFECT_SET_ID;

  private controller: MatchRoomController | null = null;

  private sharedBoardBridge: SharedBoardBridge | null = null;

  private matchLogger: MatchLogger | null = null;

  private enableSharedBoardShadow = false;

  private playerHpCache: Map<string, number> = new Map();

  private lastRoundIndex = 0;

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
    this.setId = rawSetId ?? this.setId;
    this.state.setId = this.setId;

    // Load feature flags
    const flagService = FeatureFlagService.getInstance();
    flagService.validateFlagConfiguration();
    const flags = flagService.getFlags();
    this.state.featureFlagsEnableHeroSystem = flags.enableHeroSystem;
    this.state.featureFlagsEnableSharedPool = flags.enableSharedPool;
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

    this.onMessage("HERO_SELECT", (client, message) => {
      this.handleHeroSelect(client, message as { heroId: string });
    });

    this.clock.setInterval(() => {
      this.advanceLoop(Date.now());
    }, 50);
  }

  public onJoin(client: Client): void {
    this.state.players.set(client.sessionId, new PlayerPresenceState());

    if (this.clients.length !== GameRoom.MAX_PLAYERS || this.controller !== null) {
      return;
    }

    this.controller = new MatchRoomController(
      this.clients.map((joinedClient) => joinedClient.sessionId),
      Date.now(),
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

    // SharedBoardBridge初期化（Feature Flag制御・非同期・fail-open）
    if (this.enableSharedBoardShadow && this.controller) {
      this.sharedBoardBridge = new SharedBoardBridge(
        this,
        this.controller,
        true,
      );
    }

    this.clock.setTimeout(() => {
      void this.tryStartMatch(Date.now());
    }, this.readyAutoStartMs);
  }

  private cleanupLobbyPlayer(sessionId: string): void {
    this.state.players.delete(sessionId);

    if (this.controller?.phase === "Waiting") {
      this.controller.removePlayer(sessionId);

      if (this.clients.length < 2) {
        this.controller = null;
      }
    }

    for (const player of this.state.players.values()) {
      player.ready = false;
      player.lastCmdSeq = 0;
    }

    this.state.phase = "Waiting";
    this.state.phaseDeadlineAtMs = 0;
    this.state.prepDeadlineAtMs = 0;
    this.state.roundIndex = 0;
    syncRanking(this.state.ranking, []);
  }

  public async onLeave(client: Client, code: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    const isLobbyPhase = this.controller === null || this.controller.phase === "Waiting";

    if (isLobbyPhase) {
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
    if (!this.controller) {
      return;
    }

    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    const nextReady = message.ready ?? true;
    this.controller.setReady(client.sessionId, nextReady);
    player.ready = nextReady;

    await this.tryStartMatch(Date.now());
  }

  private handleHeroSelect(client: Client, message: { heroId: string }): void {
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

    const { heroId } = message;

    if (!heroId || typeof heroId !== "string") {
      return;
    }

    try {
      this.controller.selectHero(client.sessionId, heroId);
      player.selectedHeroId = heroId;
    } catch (error) {
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

    const commandPayload = this.buildPrepCommandPayload(message);

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

      this.logPrepCommandActions(client.sessionId, commandPayload);
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

  private buildPrepCommandPayload(
    message: PrepCommandMessage,
  ):
    | {
        boardUnitCount?: number;
        boardPlacements?: NonNullable<PrepCommandMessage["boardPlacements"]>;
        xpPurchaseCount?: number;
        shopRefreshCount?: number;
        shopBuySlotIndex?: number;
        shopLock?: boolean;
        benchToBoardCell?: { benchIndex: number; cell: number };
        benchSellIndex?: number;
        boardSellIndex?: number;
        itemBuySlotIndex?: number;
        itemEquipToBench?: { inventoryItemIndex: number; benchIndex: number };
        itemUnequipFromBench?: { benchIndex: number; itemSlotIndex: number };
        itemSellInventoryIndex?: number;
        bossShopBuySlotIndex?: number;
      }
    | undefined {
    if (
      message.boardUnitCount === undefined &&
      message.boardPlacements === undefined &&
      message.xpPurchaseCount === undefined &&
      message.shopRefreshCount === undefined &&
      message.shopBuySlotIndex === undefined &&
      message.shopLock === undefined &&
      message.benchToBoardCell === undefined &&
      message.benchSellIndex === undefined &&
      message.boardSellIndex === undefined &&
      message.itemBuySlotIndex === undefined &&
      message.itemEquipToBench === undefined &&
      message.itemUnequipFromBench === undefined &&
      message.itemSellInventoryIndex === undefined &&
      message.bossShopBuySlotIndex === undefined
    ) {
      return undefined;
    }

    return {
      ...(message.boardUnitCount !== undefined && { boardUnitCount: message.boardUnitCount }),
      ...(message.boardPlacements !== undefined && { boardPlacements: message.boardPlacements }),
      ...(message.xpPurchaseCount !== undefined && { xpPurchaseCount: message.xpPurchaseCount }),
      ...(message.shopRefreshCount !== undefined && { shopRefreshCount: message.shopRefreshCount }),
      ...(message.shopBuySlotIndex !== undefined && { shopBuySlotIndex: message.shopBuySlotIndex }),
      ...(message.shopLock !== undefined && { shopLock: message.shopLock }),
      ...(message.benchToBoardCell !== undefined && { benchToBoardCell: message.benchToBoardCell }),
      ...(message.benchSellIndex !== undefined && { benchSellIndex: message.benchSellIndex }),
      ...(message.boardSellIndex !== undefined && { boardSellIndex: message.boardSellIndex }),
      ...(message.itemBuySlotIndex !== undefined && { itemBuySlotIndex: message.itemBuySlotIndex }),
      ...(message.itemEquipToBench !== undefined && { itemEquipToBench: message.itemEquipToBench }),
      ...(message.itemUnequipFromBench !== undefined && { itemUnequipFromBench: message.itemUnequipFromBench }),
      ...(message.itemSellInventoryIndex !== undefined && { itemSellInventoryIndex: message.itemSellInventoryIndex }),
      ...(message.bossShopBuySlotIndex !== undefined && { bossShopBuySlotIndex: message.bossShopBuySlotIndex }),
    };
  }

  private logPrepCommandActions(
    sessionId: string,
    commandPayload:
      | {
          boardUnitCount?: number;
          boardPlacements?: NonNullable<PrepCommandMessage["boardPlacements"]>;
          xpPurchaseCount?: number;
          shopRefreshCount?: number;
          shopBuySlotIndex?: number;
          shopLock?: boolean;
          benchToBoardCell?: { benchIndex: number; cell: number };
          benchSellIndex?: number;
          boardSellIndex?: number;
          itemBuySlotIndex?: number;
          itemEquipToBench?: { inventoryItemIndex: number; benchIndex: number };
          itemUnequipFromBench?: { benchIndex: number; itemSlotIndex: number };
          itemSellInventoryIndex?: number;
          bossShopBuySlotIndex?: number;
        }
      | undefined,
  ): void {
    logPrepCommandActions(sessionId, commandPayload, {
      logger: this.matchLogger,
      getShopOffers: (sid) => this.controller?.getShopOffersForPlayer(sid),
      getBossShopOffers: (sid) => this.controller?.getBossShopOffersForPlayer(sid),
      getPlayerStatus: (sid) => this.controller?.getPlayerStatus(sid) ?? null,
      getRoundIndex: () => this.controller?.roundIndex ?? 0,
      getPlayerGold: (sid) => this.state.players.get(sid)?.gold ?? 0,
    });
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
    const started = this.controller.startIfReady(nowMs, connectedPlayerIds);

    if (!started) {
      return;
    }

    // Initialize match logger
    this.matchLogger = new MatchLogger(this.roomId, this.roomId);
    for (const playerId of connectedPlayerIds) {
      this.matchLogger.registerPlayer(playerId);
    }

    // Set match logger in controller
    this.controller?.setMatchLogger(this.matchLogger);

    this.syncStateFromController();
    await this.lock();
  }

  private advanceLoop(nowMs: number): void {
    if (!this.controller) {
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
    const phaseProgress = this.controller?.getPhaseProgress();

    return {
      phase: this.state.phase as RoundStateMessage["phase"],
      roundIndex: this.state.roundIndex,
      phaseDeadlineAtMs: this.state.phaseDeadlineAtMs,
      ranking: Array.from(this.state.ranking),
      dominationCount: this.state.dominationCount,
      phaseHpTarget: phaseProgress?.targetHp ?? 0,
      phaseDamageDealt: phaseProgress?.damageDealt ?? 0,
      phaseResult: phaseProgress?.result ?? "pending",
      phaseCompletionRate: phaseProgress?.completionRate ?? 0,
    };
  }

  public onDispose(): void {
    // Output match summary log
    if (this.matchLogger && this.controller) {
      const ranking = this.controller.rankingTopToBottom;
      const winner = ranking.length > 0 ? (ranking[0] ?? null) : null;
      const flags = FeatureFlagService.getInstance().getFlags();

      this.matchLogger.outputSummary(
        winner,
        ranking,
        this.controller.roundIndex,
        {
          enableHeroSystem: flags.enableHeroSystem,
          enableSharedPool: flags.enableSharedPool,
          enableSpellCard: flags.enableSpellCard,
          enableRumorInfluence: flags.enableRumorInfluence,
          enableBossExclusiveShop: flags.enableBossExclusiveShop,
        },
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
}
