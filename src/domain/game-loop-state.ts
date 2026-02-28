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
