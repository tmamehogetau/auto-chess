export type Phase = "Prep" | "Battle" | "Settle" | "Elimination" | "End";

interface PlayerState {
  id: string;
  hp: number;
  eliminated: boolean;
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

  public constructor(playerIds: string[]) {
    if (playerIds.length < 2) {
      throw new Error("At least 2 players are required");
    }

    this.players = new Map(
      playerIds.map((id) => [
        id,
        {
          id,
          hp: 100,
          eliminated: false,
        },
      ]),
    );
    this.phase = "Prep";
    this.roundIndex = 1;
    this.bossPlayerId = null;
    this.dominationCount = 0;
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
  }

  /**
   * ランダムにボスプレイヤーを設定
   */
  public setRandomBoss(): void {
    const playerIds = this.playerIds;
    const randomIndex = Math.floor(Math.random() * playerIds.length);
    this.bossPlayerId = playerIds[randomIndex] ?? null;
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
    return this.alivePlayerIds.filter((id) => id !== this.bossPlayerId);
  }

  public get alivePlayerIds(): string[] {
    const alivePlayers: string[] = [];

    for (const player of this.players.values()) {
      if (!player.eliminated && player.hp > 0) {
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
      if (player.hp <= 0) {
        player.eliminated = true;
      }
    }
  }
}
