export type Phase = "Prep" | "Battle" | "Settle" | "Elimination" | "End";

interface PlayerState {
  id: string;
  hp: number;
  remainingLives: number;
  eliminated: boolean;
}

interface GameLoopStateOptions {
  raidRecoveryRoundIndex?: number;
}

const VALID_TRANSITIONS: Record<Phase, Phase[]> = {
  Prep: ["Battle"],
  Battle: ["Settle"],
  Settle: ["Elimination"],
  Elimination: ["Prep", "End"],
  End: [],
};

export class GameLoopState {
  private readonly players: Map<string, PlayerState>;

  public phase: Phase;

  public roundIndex: number;

  /** ボスプレイヤーID（ボス専用ショップ用） */
  public bossPlayerId: string | null;

  /** 支配カウント（ボス優勢時にカウントアップ、5でボス勝利） */
  public dominationCount: number;

  private readonly raidRecoveryRoundIndex: number;

  public constructor(playerIds: string[], options: GameLoopStateOptions = {}) {
    if (playerIds.length < 2) {
      throw new Error("At least 2 players are required");
    }

    this.players = new Map(
      playerIds.map((id) => [
        id,
        {
          id,
          hp: 100,
          remainingLives: 0,
          eliminated: false,
        },
      ]),
    );
    this.phase = "Prep";
    this.roundIndex = 1;
    this.bossPlayerId = null;
    this.dominationCount = 0;
    this.raidRecoveryRoundIndex = Math.max(1, options.raidRecoveryRoundIndex ?? 6);
  }

  /**
   * ボスプレイヤーを設定
   * @param playerId ボスプレイヤーID
   */
  public setBossPlayer(playerId: string): void {
    if (!this.players.has(playerId)) {
      throw new Error(`Unknown player: ${playerId}`);
    }
    this.bossPlayerId = playerId;

    for (const player of this.players.values()) {
      player.remainingLives = player.id === playerId ? 0 : 2;
    }
  }

  /**
   * ランダムにボスプレイヤーを設定
   */
  public setRandomBoss(): void {
    const playerIds = this.playerIds;
    const randomIndex = Math.floor(Math.random() * playerIds.length);
    const bossPlayerId = playerIds[randomIndex];
    if (!bossPlayerId) {
      this.bossPlayerId = null;
      return;
    }

    this.setBossPlayer(bossPlayerId);
  }

  /**
   * 指定プレイヤーがボスかどうか
   * @param playerId プレイヤーID
   * @returns ボスの場合true
   */
  public isBoss(playerId: string): boolean {
    return this.bossPlayerId === playerId;
  }

  /**
   * レイドプレイヤーID一覧を取得（ボス以外の生存プレイヤー）
   * @returns レイドプレイヤーID配列
   */
  public get raidPlayerIds(): string[] {
    return this.playerIds.filter((id) => id !== this.bossPlayerId);
  }

  public get alivePlayerIds(): string[] {
    const alivePlayers: string[] = [];

    for (const player of this.players.values()) {
      const isAliveInRaid = this.bossPlayerId !== null
        ? (
          player.id === this.bossPlayerId
          || (!player.eliminated && (player.remainingLives > 0 || this.phase !== "Elimination"))
        )
        : player.hp > 0;

      if (!player.eliminated && isAliveInRaid) {
        alivePlayers.push(player.id);
      }
    }

    return alivePlayers;
  }

  public get playerIds(): string[] {
    return Array.from(this.players.keys());
  }

  public getPlayerHp(playerId: string): number {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    return player.hp;
  }

  public isPlayerEliminated(playerId: string): boolean {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    return player.eliminated;
  }

  public getRemainingLives(playerId: string): number {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    return player.remainingLives;
  }

  public consumeLife(playerId: string, amount: number = 1): number {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    if (player.id === this.bossPlayerId) {
      return player.remainingLives;
    }

    player.remainingLives = Math.max(0, player.remainingLives - amount);

    return player.remainingLives;
  }

  public addLife(playerId: string, amount: number = 1): number {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    if (player.id === this.bossPlayerId) {
      return player.remainingLives;
    }

    player.remainingLives = Math.max(0, player.remainingLives + amount);
    return player.remainingLives;
  }

  public revivePlayer(playerId: string, nextLives: number = 1): number {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    if (player.id === this.bossPlayerId) {
      return player.remainingLives;
    }

    player.remainingLives = Math.max(0, nextLives);
    player.eliminated = false;
    return player.remainingLives;
  }

  public setPlayerHp(playerId: string, nextHp: number): void {
    const player = this.players.get(playerId);

    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }

    player.hp = nextHp;
  }

  public transitionTo(nextPhase: Phase): void {
    const allowed = VALID_TRANSITIONS[this.phase];

    if (!allowed.includes(nextPhase)) {
      throw new Error(`Invalid transition: ${this.phase} -> ${nextPhase}`);
    }

    if (this.phase === "Elimination") {
      const aliveCount = this.alivePlayerIds.length;

      if (nextPhase === "Prep" && aliveCount < 2) {
        throw new Error(`Invalid transition: ${this.phase} -> ${nextPhase}`);
      }
    }

    if (nextPhase === "Elimination") {
      this.applyElimination();
    }

    this.phase = nextPhase;

    if (nextPhase === "Prep") {
      this.roundIndex += 1;
    }
  }

  private applyElimination(): void {
    for (const player of this.players.values()) {
      if (this.bossPlayerId !== null) {
        if (player.id !== this.bossPlayerId && player.remainingLives <= 0) {
          if (this.roundIndex === this.raidRecoveryRoundIndex) {
            continue;
          }

          player.eliminated = true;
        }
        continue;
      }

      if (player.hp <= 0) {
        player.eliminated = true;
      }
    }
  }
}
