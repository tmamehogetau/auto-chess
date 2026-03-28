import type { GameLoopState } from "../../domain/game-loop-state";
import type { MatchupOutcome } from "./battle-resolution";
import { buildLoserDamage } from "./damage-calculator";
import { comparePlayerIds } from "./player-compare";

export interface BattlePairing {
  leftPlayerId: string;
  rightPlayerId: string | null;
  ghostSourcePlayerId: string | null;
}

type PhaseResult = "pending" | "success" | "failed";

type BattleResultLike = {
  survivors: number;
};

type BattleState = Pick<
  GameLoopState,
  | "alivePlayerIds"
  | "bossPlayerId"
  | "consumeLife"
  | "dominationCount"
  | "getPlayerHp"
  | "isPlayerEliminated"
  | "raidPlayerIds"
  | "roundIndex"
>;

export interface BattleOrchestratorDeps<TBattleResult extends BattleResultLike> {
  ensureStarted(): BattleState;
  isRaidMode(): boolean;
  getPhaseResult(): PhaseResult;
  pendingRoundDamageByPlayer: Map<string, number>;
  battleResultsByPlayer: ReadonlyMap<string, TBattleResult>;
  getCurrentRoundPairings(): BattlePairing[];
  getBattleParticipantIds(): string[];
  getHpAtBattleStartByPlayer(): ReadonlyMap<string, number>;
  getHpAfterBattleByPlayer(): ReadonlyMap<string, number>;
  eliminatedFromBottom: string[];
  resolveMatchupOutcome(leftPlayerId: string, rightPlayerId: string): MatchupOutcome;
  setFinalRankingOverride(ranking: string[] | null): void;
}

export class BattleOrchestrator<TBattleResult extends BattleResultLike> {
  public constructor(
    private readonly deps: BattleOrchestratorDeps<TBattleResult>,
  ) {}

  public buildPairingsForRound(
    battleParticipants: string[],
    roundIndex: number,
  ): BattlePairing[] {
    if (battleParticipants.length < 2) {
      return [];
    }

    const state = this.deps.ensureStarted();
    if (state.bossPlayerId) {
      const bossPlayerId = state.bossPlayerId;
      const raidPlayerIds = state.raidPlayerIds.filter((playerId) =>
        battleParticipants.includes(playerId),
      );
      const firstRaidPlayerId = raidPlayerIds[0];

      if (battleParticipants.includes(bossPlayerId) && firstRaidPlayerId) {
        return [
          {
            leftPlayerId: bossPlayerId,
            rightPlayerId: firstRaidPlayerId,
            ghostSourcePlayerId: null,
          },
        ];
      }
    }

    const orderedParticipants = [...battleParticipants].sort((left, right) =>
      comparePlayerIds(left, right),
    );

    if (orderedParticipants.length === 2) {
      const leftPlayerId = orderedParticipants[0];
      const rightPlayerId = orderedParticipants[1];

      if (!leftPlayerId || !rightPlayerId) {
        return [];
      }

      return [
        {
          leftPlayerId,
          rightPlayerId,
          ghostSourcePlayerId: null,
        },
      ];
    }

    const fixedPlayerId = orderedParticipants[0];

    if (!fixedPlayerId) {
      return [];
    }

    const rotating = orderedParticipants.slice(1);
    const rotateCount = (roundIndex - 1) % rotating.length;
    let rotated = [...rotating];

    for (let index = 0; index < rotateCount; index += 1) {
      const tailPlayerId = rotated.pop();

      if (!tailPlayerId) {
        break;
      }

      rotated = [tailPlayerId, ...rotated];
    }

    const arrangement = [fixedPlayerId, ...rotated];
    let ghostPlayerId: string | null = null;
    let pairableArrangement = arrangement;

    if (arrangement.length % 2 === 1) {
      const ghostCandidate = arrangement[arrangement.length - 1];

      if (ghostCandidate) {
        ghostPlayerId = ghostCandidate;
      }

      pairableArrangement = arrangement.slice(0, -1);
    }

    const pairingCount = Math.floor(pairableArrangement.length / 2);
    const pairings: BattlePairing[] = [];

    for (let index = 0; index < pairingCount; index += 1) {
      const leftPlayerId = pairableArrangement[index];
      const rightPlayerId =
        pairableArrangement[pairableArrangement.length - 1 - index];

      if (!leftPlayerId || !rightPlayerId || leftPlayerId === rightPlayerId) {
        continue;
      }

      pairings.push({
        leftPlayerId,
        rightPlayerId,
        ghostSourcePlayerId: null,
      });
    }

    if (ghostPlayerId) {
      const ghostSourcePlayerId = pairableArrangement[0] ?? fixedPlayerId;

      pairings.push({
        leftPlayerId: ghostPlayerId,
        rightPlayerId: null,
        ghostSourcePlayerId,
      });
    }

    return pairings;
  }

  public resolveMissingRoundDamage(): void {
    const currentRoundPairings = this.deps.getCurrentRoundPairings();
    if (currentRoundPairings.length === 0) {
      return;
    }

    for (const pairing of currentRoundPairings) {
      if (pairing.rightPlayerId && pairing.ghostSourcePlayerId === null) {
        this.resolveMissingDamageForPair(pairing.leftPlayerId, pairing.rightPlayerId);
        continue;
      }

      if (!pairing.rightPlayerId && pairing.ghostSourcePlayerId) {
        this.resolveMissingDamageForGhost(
          pairing.leftPlayerId,
          pairing.ghostSourcePlayerId,
        );
      }
    }
  }

  public applyRaidRoundConsequences(): void {
    if (!this.deps.isRaidMode()) {
      return;
    }

    const state = this.deps.ensureStarted();

    for (const playerId of state.raidPlayerIds) {
      const battleResult = this.deps.battleResultsByPlayer.get(playerId);
      if (battleResult === undefined) {
        continue;
      }

      if (battleResult.survivors > 0) {
        continue;
      }

      state.consumeLife(playerId);
    }
  }

  public shouldEndAfterElimination(maxRounds: number): boolean {
    const state = this.deps.ensureStarted();

    if (!this.deps.isRaidMode()) {
      return state.alivePlayerIds.length <= 1 || state.roundIndex === maxRounds || state.dominationCount >= 5;
    }

    const survivingRaidPlayerIds = state.raidPlayerIds.filter((playerId) => !state.isPlayerEliminated(playerId));
    if (survivingRaidPlayerIds.length === 0 || state.dominationCount >= 5) {
      this.deps.setFinalRankingOverride(this.buildRaidFinalRanking("boss"));
      return true;
    }

    if (state.roundIndex < maxRounds) {
      return false;
    }

    this.deps.setFinalRankingOverride(
      this.buildRaidFinalRanking(
        this.deps.getPhaseResult() === "success" && survivingRaidPlayerIds.length > 0 ? "raid" : "boss",
      ),
    );
    return true;
  }

  public captureEliminationResult(aliveBeforeElimination: Set<string>): void {
    const state = this.deps.ensureStarted();
    const aliveAfterElimination = new Set(state.alivePlayerIds);
    const newlyEliminated: string[] = [];
    const eliminationCandidates =
      this.deps.getBattleParticipantIds().length > 0
        ? this.deps.getBattleParticipantIds()
        : Array.from(aliveBeforeElimination);

    for (const playerId of eliminationCandidates) {
      if (this.deps.eliminatedFromBottom.includes(playerId)) {
        continue;
      }

      if (aliveAfterElimination.has(playerId)) {
        continue;
      }

      newlyEliminated.push(playerId);
    }

    if (newlyEliminated.length === 0) {
      return;
    }

    const bestToWorst = [...newlyEliminated].sort((left, right) =>
      this.compareEliminatedPlayers(left, right),
    );

    for (const playerId of bestToWorst.reverse()) {
      if (this.deps.eliminatedFromBottom.includes(playerId)) {
        continue;
      }

      this.deps.eliminatedFromBottom.push(playerId);
    }
  }

  private resolveMissingDamageForPair(leftPlayerId: string, rightPlayerId: string): void {
    const leftAlreadySet = this.deps.pendingRoundDamageByPlayer.has(leftPlayerId);
    const rightAlreadySet = this.deps.pendingRoundDamageByPlayer.has(rightPlayerId);

    if (leftAlreadySet || rightAlreadySet) {
      return;
    }

    const outcome = this.deps.resolveMatchupOutcome(leftPlayerId, rightPlayerId);

    if (outcome.isDraw) {
      this.deps.pendingRoundDamageByPlayer.set(leftPlayerId, 0);
      this.deps.pendingRoundDamageByPlayer.set(rightPlayerId, 0);
      return;
    }

    const loserDamage = buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );

    if (!this.deps.pendingRoundDamageByPlayer.has(outcome.winnerId!)) {
      this.deps.pendingRoundDamageByPlayer.set(outcome.winnerId!, 0);
    }

    if (!this.deps.pendingRoundDamageByPlayer.has(outcome.loserId!)) {
      this.deps.pendingRoundDamageByPlayer.set(outcome.loserId!, loserDamage);
    }
  }

  private resolveMissingDamageForGhost(
    challengerPlayerId: string,
    ghostSourcePlayerId: string,
  ): void {
    if (this.deps.pendingRoundDamageByPlayer.has(challengerPlayerId)) {
      return;
    }

    const outcome = this.deps.resolveMatchupOutcome(challengerPlayerId, ghostSourcePlayerId);

    if (outcome.isDraw || outcome.winnerId === challengerPlayerId) {
      this.deps.pendingRoundDamageByPlayer.set(challengerPlayerId, 0);
      return;
    }

    const challengerDamage = buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );
    this.deps.pendingRoundDamageByPlayer.set(challengerPlayerId, challengerDamage);
  }

  private buildRaidFinalRanking(winner: "raid" | "boss"): string[] {
    const state = this.deps.ensureStarted();
    const bossPlayerId = state.bossPlayerId;
    const survivingRaidPlayerIds = state.raidPlayerIds.filter((playerId) => !state.isPlayerEliminated(playerId));
    const eliminatedRaidPlayerIds = state.raidPlayerIds.filter((playerId) => state.isPlayerEliminated(playerId));

    if (!bossPlayerId) {
      return [];
    }

    if (winner === "raid") {
      return [...survivingRaidPlayerIds, ...eliminatedRaidPlayerIds, bossPlayerId];
    }

    return [bossPlayerId, ...survivingRaidPlayerIds, ...eliminatedRaidPlayerIds];
  }

  private compareEliminatedPlayers(left: string, right: string): number {
    const leftPostBattleHp = this.deps.getHpAfterBattleByPlayer().get(left) ?? Number.NEGATIVE_INFINITY;
    const rightPostBattleHp = this.deps.getHpAfterBattleByPlayer().get(right) ?? Number.NEGATIVE_INFINITY;

    if (leftPostBattleHp !== rightPostBattleHp) {
      return rightPostBattleHp - leftPostBattleHp;
    }

    const state = this.deps.ensureStarted();
    const leftRoundStartHp =
      this.deps.getHpAtBattleStartByPlayer().get(left) ?? state.getPlayerHp(left);
    const rightRoundStartHp =
      this.deps.getHpAtBattleStartByPlayer().get(right) ?? state.getPlayerHp(right);

    if (leftRoundStartHp !== rightRoundStartHp) {
      return rightRoundStartHp - leftRoundStartHp;
    }

    return comparePlayerIds(left, right);
  }
}
