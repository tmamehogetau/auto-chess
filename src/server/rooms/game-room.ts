import { CloseCode, type Client, Room } from "colyseus";

import { MatchRoomController } from "../match-room-controller";
import {
  MatchRoomState,
  PlayerPresenceState,
  ShopOfferState,
} from "../schema/match-room-state";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
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

  private prepDurationMs = 30_000;

  private battleDurationMs = 40_000;

  private settleDurationMs = 5_000;

  private eliminationDurationMs = 2_000;

  private setId: UnitEffectSetId = DEFAULT_UNIT_EFFECT_SET_ID;

  private controller: MatchRoomController | null = null;

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

    this.onMessage<ReadyMessage>(CLIENT_MESSAGE_TYPES.READY, async (client, message) => {
      await this.handleReady(client, message);
    });

    this.onMessage<PrepCommandMessage>(
      CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      (client, message) => {
        this.handlePrepCommand(client, message);
      },
    );

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
      },
    );

    this.clock.setTimeout(() => {
      void this.tryStartMatch(Date.now());
    }, this.readyAutoStartMs);
  }

  public async onLeave(client: Client, code: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
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

  private handlePrepCommand(client: Client, message: PrepCommandMessage): void {
    if (!this.controller) {
      return;
    }

    let commandPayload:
      | {
          boardUnitCount?: number;
          boardPlacements?: NonNullable<PrepCommandMessage["boardPlacements"]>;
          xpPurchaseCount?: number;
          shopRefreshCount?: number;
          shopBuySlotIndex?: number;
          shopLock?: boolean;
        }
      | undefined;

    if (
      message.boardUnitCount !== undefined ||
      message.boardPlacements !== undefined ||
      message.xpPurchaseCount !== undefined ||
      message.shopRefreshCount !== undefined ||
      message.shopBuySlotIndex !== undefined ||
      message.shopLock !== undefined
    ) {
      commandPayload = {};

      if (message.boardUnitCount !== undefined) {
        commandPayload.boardUnitCount = message.boardUnitCount;
      }

      if (message.boardPlacements !== undefined) {
        commandPayload.boardPlacements = message.boardPlacements;
      }

      if (message.xpPurchaseCount !== undefined) {
        commandPayload.xpPurchaseCount = message.xpPurchaseCount;
      }

      if (message.shopRefreshCount !== undefined) {
        commandPayload.shopRefreshCount = message.shopRefreshCount;
      }

      if (message.shopBuySlotIndex !== undefined) {
        commandPayload.shopBuySlotIndex = message.shopBuySlotIndex;
      }

      if (message.shopLock !== undefined) {
        commandPayload.shopLock = message.shopLock;
      }
    }

    const result = this.controller.submitPrepCommand(
      client.sessionId,
      message.cmdSeq,
      Date.now(),
      commandPayload,
    );
    const player = this.state.players.get(client.sessionId);

    if (result.accepted && player) {
      player.lastCmdSeq = message.cmdSeq;

      const latestStatus = this.controller.getPlayerStatus(client.sessionId);
      player.boardUnitCount = latestStatus.boardUnitCount;
      player.gold = latestStatus.gold;
      player.xp = latestStatus.xp;
      player.level = latestStatus.level;
      player.shopLocked = latestStatus.shopLocked;
      player.ownedVanguard = latestStatus.ownedUnits.vanguard;
      player.ownedRanger = latestStatus.ownedUnits.ranger;
      player.ownedMage = latestStatus.ownedUnits.mage;
      player.ownedAssassin = latestStatus.ownedUnits.assassin;

      while (player.shopOffers.length > 0) {
        player.shopOffers.pop();
      }

      while (player.benchUnits.length > 0) {
        player.benchUnits.pop();
      }

      for (const offer of latestStatus.shopOffers) {
        const nextOffer = new ShopOfferState();

        nextOffer.unitType = offer.unitType;
        nextOffer.cost = offer.cost;
        nextOffer.rarity = offer.rarity;
        player.shopOffers.push(nextOffer);
      }

      for (const benchUnit of latestStatus.benchUnits) {
        player.benchUnits.push(benchUnit);
      }
    }

    client.send(SERVER_MESSAGE_TYPES.COMMAND_RESULT, result);
  }

  private async tryStartMatch(nowMs: number): Promise<void> {
    if (!this.controller) {
      return;
    }

    const started = this.controller.startIfReady(nowMs);

    if (!started) {
      return;
    }

    this.syncStateFromController();
    await this.lock();
  }

  private advanceLoop(nowMs: number): void {
    if (!this.controller) {
      return;
    }

    const progressed = this.controller.advanceByTime(nowMs);

    if (!progressed) {
      return;
    }

    this.syncStateFromController();
  }

  private syncStateFromController(): void {
    if (!this.controller) {
      return;
    }

    this.state.phase = this.controller.phase;
    this.state.phaseDeadlineAtMs = this.controller.phaseDeadlineAtMs ?? 0;
    this.state.prepDeadlineAtMs =
      this.controller.phase === "Prep" ? this.controller.prepDeadlineAtMs ?? 0 : 0;
    this.state.roundIndex = this.controller.roundIndex;
    this.state.setId = this.setId;
    this.syncRanking(this.controller.rankingTopToBottom);

    for (const [playerId, playerState] of this.state.players.entries()) {
      const status = this.controller.getPlayerStatus(playerId);
      playerState.hp = status.hp;
      playerState.eliminated = status.eliminated;
      playerState.boardUnitCount = status.boardUnitCount;
      playerState.gold = status.gold;
      playerState.xp = status.xp;
      playerState.level = status.level;
      playerState.shopLocked = status.shopLocked;
      playerState.ownedVanguard = status.ownedUnits.vanguard;
      playerState.ownedRanger = status.ownedUnits.ranger;
      playerState.ownedMage = status.ownedUnits.mage;
      playerState.ownedAssassin = status.ownedUnits.assassin;

      while (playerState.shopOffers.length > 0) {
        playerState.shopOffers.pop();
      }

      while (playerState.benchUnits.length > 0) {
        playerState.benchUnits.pop();
      }

      for (const offer of status.shopOffers) {
        const nextOffer = new ShopOfferState();

        nextOffer.unitType = offer.unitType;
        nextOffer.cost = offer.cost;
        nextOffer.rarity = offer.rarity;
        playerState.shopOffers.push(nextOffer);
      }

      for (const benchUnit of status.benchUnits) {
        playerState.benchUnits.push(benchUnit);
      }
    }

    this.broadcast(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
      this.createRoundStateMessage(),
    );
  }

  private syncRanking(nextRanking: string[]): void {
    while (this.state.ranking.length > 0) {
      this.state.ranking.pop();
    }

    for (const playerId of nextRanking) {
      this.state.ranking.push(playerId);
    }
  }

  private createRoundStateMessage(): RoundStateMessage {
    return {
      phase: this.state.phase as RoundStateMessage["phase"],
      roundIndex: this.state.roundIndex,
      phaseDeadlineAtMs: this.state.phaseDeadlineAtMs,
      ranking: Array.from(this.state.ranking),
    };
  }
}
