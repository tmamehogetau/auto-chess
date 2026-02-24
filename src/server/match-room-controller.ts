import { GameLoopState, type Phase } from "../domain/game-loop-state";
import type {
  BoardUnitPlacement,
  CommandResult,
} from "../shared/room-messages";
import {
  normalizeBoardPlacements,
  resolveBoardPowerFromState,
  resolveUnitCountFromState,
} from "./combat/unit-effects";
import {
  DEFAULT_UNIT_EFFECT_SET_ID,
  type UnitEffectSetId,
} from "./combat/unit-effect-definitions";

interface MatchRoomControllerOptions {
  readyAutoStartMs: number;
  prepDurationMs: number;
  battleDurationMs: number;
  settleDurationMs: number;
  eliminationDurationMs: number;
  setId?: UnitEffectSetId;
}

type RoundDamageByPlayer = Partial<Record<string, number>>;

interface BattlePairing {
  leftPlayerId: string;
  rightPlayerId: string | null;
  ghostSourcePlayerId: string | null;
}

interface MatchupOutcome {
  winnerId: string;
  loserId: string;
  winnerUnitCount: number;
  loserUnitCount: number;
}

export class MatchRoomController {
  private readonly playerIds: string[];

  private readonly readyPlayers: Set<string>;

  private readonly lastCmdSeqByPlayer: Map<string, number>;

  private readonly boardUnitCountByPlayer: Map<string, number>;

  private readonly boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;

  private readonly readyDeadlineAtMs: number;

  private readonly prepDurationMs: number;

  private readonly battleDurationMs: number;

  private readonly settleDurationMs: number;

  private readonly eliminationDurationMs: number;

  private gameLoopState: GameLoopState | null;

  public prepDeadlineAtMs: number | null;

  private battleDeadlineAtMs: number | null;

  private settleDeadlineAtMs: number | null;

  private eliminationDeadlineAtMs: number | null;

  private readonly pendingRoundDamageByPlayer: Map<string, number>;

  private hpAtBattleStartByPlayer: Map<string, number>;

  private hpAfterBattleByPlayer: Map<string, number>;

  private battleParticipantIds: string[];

  private currentRoundPairings: BattlePairing[];

  private readonly eliminatedFromBottom: string[];

  private readonly setId: UnitEffectSetId;

  public constructor(
    playerIds: string[],
    createdAtMs: number,
    options: MatchRoomControllerOptions,
  ) {
    if (playerIds.length < 2) {
      throw new Error("At least 2 players are required");
    }

    this.playerIds = [...playerIds];
    this.readyPlayers = new Set<string>();
    this.lastCmdSeqByPlayer = new Map<string, number>();
    this.boardUnitCountByPlayer = new Map<string, number>();
    this.boardPlacementsByPlayer = new Map<string, BoardUnitPlacement[]>();
    this.readyDeadlineAtMs = createdAtMs + options.readyAutoStartMs;
    this.prepDurationMs = options.prepDurationMs;
    this.battleDurationMs = options.battleDurationMs;
    this.settleDurationMs = options.settleDurationMs;
    this.eliminationDurationMs = options.eliminationDurationMs;
    this.gameLoopState = null;
    this.prepDeadlineAtMs = null;
    this.battleDeadlineAtMs = null;
    this.settleDeadlineAtMs = null;
    this.eliminationDeadlineAtMs = null;
    this.pendingRoundDamageByPlayer = new Map<string, number>();
    this.hpAtBattleStartByPlayer = new Map<string, number>();
    this.hpAfterBattleByPlayer = new Map<string, number>();
    this.battleParticipantIds = [];
    this.currentRoundPairings = [];
    this.eliminatedFromBottom = [];
    this.setId = options.setId ?? DEFAULT_UNIT_EFFECT_SET_ID;

    for (const playerId of playerIds) {
      this.lastCmdSeqByPlayer.set(playerId, 0);
      this.boardUnitCountByPlayer.set(playerId, 4);
      this.boardPlacementsByPlayer.set(playerId, []);
    }
  }

  public get phase(): Phase | "Waiting" {
    if (!this.gameLoopState) {
      return "Waiting";
    }

    return this.gameLoopState.phase;
  }

  public get roundIndex(): number {
    return this.gameLoopState?.roundIndex ?? 0;
  }

  public get phaseDeadlineAtMs(): number | null {
    if (!this.gameLoopState) {
      return null;
    }

    switch (this.gameLoopState.phase) {
      case "Prep":
        return this.prepDeadlineAtMs;
      case "Battle":
        return this.battleDeadlineAtMs;
      case "Settle":
        return this.settleDeadlineAtMs;
      case "Elimination":
        return this.eliminationDeadlineAtMs;
      case "End":
        return null;
      default:
        return null;
    }
  }

  public get rankingTopToBottom(): string[] {
    const state = this.gameLoopState;

    if (!state) {
      return [];
    }

    const alivePlayers = [...state.alivePlayerIds].sort((left, right) =>
      MatchRoomController.comparePlayerIds(left, right),
    );
    const eliminatedBestToWorst = [...this.eliminatedFromBottom].reverse();

    return [...alivePlayers, ...eliminatedBestToWorst];
  }

  public get roundPairings(): BattlePairing[] {
    return this.currentRoundPairings.map((pairing) => ({
      leftPlayerId: pairing.leftPlayerId,
      rightPlayerId: pairing.rightPlayerId,
      ghostSourcePlayerId: pairing.ghostSourcePlayerId,
    }));
  }

  public setReady(playerId: string, ready: boolean): void {
    this.ensureKnownPlayer(playerId);

    if (ready) {
      this.readyPlayers.add(playerId);
      return;
    }

    this.readyPlayers.delete(playerId);
  }

  public startIfReady(nowMs: number): boolean {
    if (this.gameLoopState) {
      return false;
    }

    const allReady = this.readyPlayers.size === this.playerIds.length;
    const autoStartReached = nowMs >= this.readyDeadlineAtMs;

    if (!allReady && !autoStartReached) {
      return false;
    }

    this.gameLoopState = new GameLoopState(this.playerIds);
    this.prepDeadlineAtMs = nowMs + this.prepDurationMs;
    this.battleDeadlineAtMs = null;
    this.settleDeadlineAtMs = null;
    this.eliminationDeadlineAtMs = null;
    return true;
  }

  public transitionTo(nextPhase: Phase): void {
    if (!this.gameLoopState) {
      throw new Error("Match has not started");
    }

    this.gameLoopState.transitionTo(nextPhase);
  }

  public setPlayerHp(playerId: string, nextHp: number): void {
    const state = this.ensureStarted();
    state.setPlayerHp(playerId, nextHp);
  }

  public setPlayerBoardUnitCount(playerId: string, nextUnitCount: number): void {
    this.ensureKnownPlayer(playerId);

    if (!Number.isInteger(nextUnitCount) || nextUnitCount < 0 || nextUnitCount > 8) {
      throw new Error(`Invalid unit count: ${playerId}`);
    }

    this.boardUnitCountByPlayer.set(playerId, nextUnitCount);
    this.boardPlacementsByPlayer.set(playerId, []);
  }

  public getPlayerHp(playerId: string): number {
    const state = this.ensureStarted();
    return state.getPlayerHp(playerId);
  }

  public getPlayerStatus(playerId: string): {
    hp: number;
    eliminated: boolean;
    boardUnitCount: number;
  } {
    const state = this.ensureStarted();

    return {
      hp: state.getPlayerHp(playerId),
      eliminated: state.isPlayerEliminated(playerId),
      boardUnitCount: this.boardUnitCountByPlayer.get(playerId) ?? 4,
    };
  }

  public setPendingRoundDamage(damageByPlayer: RoundDamageByPlayer): void {
    const state = this.ensureStarted();

    if (state.phase !== "Battle") {
      throw new Error("Round damage can only be submitted during Battle phase");
    }

    for (const [playerId, damageValue] of Object.entries(damageByPlayer)) {
      this.ensureKnownPlayer(playerId);

      if (damageValue === undefined || !Number.isFinite(damageValue) || damageValue < 0) {
        throw new Error(`Invalid damage: ${playerId}`);
      }

      if (damageValue === 0) {
        this.pendingRoundDamageByPlayer.delete(playerId);
        continue;
      }

      this.pendingRoundDamageByPlayer.set(playerId, damageValue);
    }
  }

  public advanceByTime(nowMs: number): boolean {
    if (!this.gameLoopState) {
      return false;
    }

    switch (this.gameLoopState.phase) {
      case "Prep":
        if (this.prepDeadlineAtMs !== null && nowMs >= this.prepDeadlineAtMs) {
          this.captureBattleStartHp();
          this.gameLoopState.transitionTo("Battle");
          this.prepDeadlineAtMs = null;
          this.battleDeadlineAtMs = nowMs + this.battleDurationMs;
          return true;
        }

        return false;
      case "Battle":
        if (this.battleDeadlineAtMs !== null && nowMs >= this.battleDeadlineAtMs) {
          this.resolveMissingRoundDamage();
          this.applyPendingRoundDamage();
          this.capturePostBattleHp();
          this.gameLoopState.transitionTo("Settle");
          this.battleDeadlineAtMs = null;
          this.settleDeadlineAtMs = nowMs + this.settleDurationMs;
          return true;
        }

        return false;
      case "Settle":
        if (this.settleDeadlineAtMs !== null && nowMs >= this.settleDeadlineAtMs) {
          const aliveBeforeElimination = new Set(this.gameLoopState.alivePlayerIds);
          this.gameLoopState.transitionTo("Elimination");
          this.captureEliminationResult(aliveBeforeElimination);
          this.settleDeadlineAtMs = null;
          this.eliminationDeadlineAtMs = nowMs + this.eliminationDurationMs;
          return true;
        }

        return false;
      case "Elimination":
        if (
          this.eliminationDeadlineAtMs !== null &&
          nowMs >= this.eliminationDeadlineAtMs
        ) {
          this.eliminationDeadlineAtMs = null;

          if (this.gameLoopState.alivePlayerIds.length <= 1) {
            this.gameLoopState.transitionTo("End");
            return true;
          }

          this.pendingRoundDamageByPlayer.clear();
          this.hpAtBattleStartByPlayer = new Map<string, number>();
          this.hpAfterBattleByPlayer = new Map<string, number>();
          this.battleParticipantIds = [];
          this.currentRoundPairings = [];
          this.gameLoopState.transitionTo("Prep");
          this.prepDeadlineAtMs = nowMs + this.prepDurationMs;
          return true;
        }

        return false;
      case "End":
        return false;
      default:
        return false;
    }
  }

  public submitPrepCommand(
    playerId: string,
    cmdSeq: number,
    receivedAtMs: number,
    commandPayload?: {
      boardUnitCount?: number;
      boardPlacements?: BoardUnitPlacement[];
    },
  ): CommandResult {
    if (!this.gameLoopState || this.gameLoopState.phase !== "Prep") {
      return { accepted: false, code: "PHASE_MISMATCH" };
    }

    if (!this.lastCmdSeqByPlayer.has(playerId)) {
      return { accepted: false, code: "UNKNOWN_PLAYER" };
    }

    const deadline = this.prepDeadlineAtMs;

    if (deadline === null || receivedAtMs >= deadline) {
      return { accepted: false, code: "LATE_INPUT" };
    }

    const previousCmdSeq = this.lastCmdSeqByPlayer.get(playerId);

    if (previousCmdSeq === undefined || cmdSeq <= previousCmdSeq) {
      return { accepted: false, code: "DUPLICATE_CMD" };
    }

    if (commandPayload?.boardUnitCount !== undefined) {
      const nextUnitCount = commandPayload.boardUnitCount;

      if (!Number.isInteger(nextUnitCount) || nextUnitCount < 0 || nextUnitCount > 8) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      this.boardUnitCountByPlayer.set(playerId, nextUnitCount);
      this.boardPlacementsByPlayer.set(playerId, []);
    }

    if (commandPayload?.boardPlacements !== undefined) {
      const normalizedPlacements = normalizeBoardPlacements(commandPayload.boardPlacements);

      if (!normalizedPlacements) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      this.boardPlacementsByPlayer.set(playerId, normalizedPlacements);
      this.boardUnitCountByPlayer.set(playerId, normalizedPlacements.length);
    }

    this.lastCmdSeqByPlayer.set(playerId, cmdSeq);

    return { accepted: true };
  }

  private ensureKnownPlayer(playerId: string): void {
    if (this.lastCmdSeqByPlayer.has(playerId)) {
      return;
    }

    throw new Error(`Unknown player: ${playerId}`);
  }

  private ensureStarted(): GameLoopState {
    if (this.gameLoopState) {
      return this.gameLoopState;
    }

    throw new Error("Match has not started");
  }

  private captureBattleStartHp(): void {
    const state = this.ensureStarted();
    const snapshot = new Map<string, number>();
    const battleParticipants = [...state.alivePlayerIds];

    for (const playerId of battleParticipants) {
      snapshot.set(playerId, state.getPlayerHp(playerId));
    }

    this.battleParticipantIds = battleParticipants;
    this.currentRoundPairings = this.buildPairingsForRound(
      battleParticipants,
      state.roundIndex,
    );
    this.hpAtBattleStartByPlayer = snapshot;
  }

  private capturePostBattleHp(): void {
    const state = this.ensureStarted();
    const snapshot = new Map<string, number>();

    for (const playerId of state.playerIds) {
      snapshot.set(playerId, state.getPlayerHp(playerId));
    }

    this.hpAfterBattleByPlayer = snapshot;
  }

  private applyPendingRoundDamage(): void {
    const state = this.ensureStarted();

    for (const [playerId, damageValue] of this.pendingRoundDamageByPlayer.entries()) {
      const currentHp = state.getPlayerHp(playerId);
      state.setPlayerHp(playerId, currentHp - damageValue);
    }

    this.pendingRoundDamageByPlayer.clear();
  }

  private resolveMissingRoundDamage(): void {
    if (this.currentRoundPairings.length === 0) {
      return;
    }

    for (const pairing of this.currentRoundPairings) {
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

  private resolveMissingDamageForPair(leftPlayerId: string, rightPlayerId: string): void {
    const leftAlreadySet = this.pendingRoundDamageByPlayer.has(leftPlayerId);
    const rightAlreadySet = this.pendingRoundDamageByPlayer.has(rightPlayerId);

    if (leftAlreadySet || rightAlreadySet) {
      return;
    }

    const outcome = this.resolveMatchupOutcome(leftPlayerId, rightPlayerId);
    const loserDamage = this.buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );

    if (!this.pendingRoundDamageByPlayer.has(outcome.winnerId)) {
      this.pendingRoundDamageByPlayer.set(outcome.winnerId, 0);
    }

    if (!this.pendingRoundDamageByPlayer.has(outcome.loserId)) {
      this.pendingRoundDamageByPlayer.set(outcome.loserId, loserDamage);
    }
  }

  private resolveMissingDamageForGhost(
    challengerPlayerId: string,
    ghostSourcePlayerId: string,
  ): void {
    if (this.pendingRoundDamageByPlayer.has(challengerPlayerId)) {
      return;
    }

    const outcome = this.resolveMatchupOutcome(challengerPlayerId, ghostSourcePlayerId);

    if (outcome.winnerId === challengerPlayerId) {
      this.pendingRoundDamageByPlayer.set(challengerPlayerId, 0);
      return;
    }

    const challengerDamage = this.buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );
    this.pendingRoundDamageByPlayer.set(challengerPlayerId, challengerDamage);
  }

  private resolveMatchupOutcome(leftPlayerId: string, rightPlayerId: string): MatchupOutcome {
    const leftUnitCount = this.resolveUnitCount(leftPlayerId);
    const rightUnitCount = this.resolveUnitCount(rightPlayerId);
    const leftBoardPower = this.resolveBoardPower(leftPlayerId);
    const rightBoardPower = this.resolveBoardPower(rightPlayerId);
    const leftHp = this.hpAtBattleStartByPlayer.get(leftPlayerId) ?? 0;
    const rightHp = this.hpAtBattleStartByPlayer.get(rightPlayerId) ?? 0;

    let winnerId = leftPlayerId;
    let loserId = rightPlayerId;
    let winnerUnitCount = leftUnitCount;
    let loserUnitCount = rightUnitCount;

    if (rightBoardPower > leftBoardPower) {
      winnerId = rightPlayerId;
      loserId = leftPlayerId;
      winnerUnitCount = rightUnitCount;
      loserUnitCount = leftUnitCount;
    } else if (rightBoardPower === leftBoardPower && rightUnitCount > leftUnitCount) {
      winnerId = rightPlayerId;
      loserId = leftPlayerId;
      winnerUnitCount = rightUnitCount;
      loserUnitCount = leftUnitCount;
    } else if (
      rightBoardPower === leftBoardPower &&
      rightUnitCount === leftUnitCount &&
      rightHp > leftHp
    ) {
      winnerId = rightPlayerId;
      loserId = leftPlayerId;
      winnerUnitCount = rightUnitCount;
      loserUnitCount = leftUnitCount;
    } else if (
      rightBoardPower === leftBoardPower &&
      rightUnitCount === leftUnitCount &&
      rightHp === leftHp &&
      MatchRoomController.comparePlayerIds(rightPlayerId, leftPlayerId) < 0
    ) {
      winnerId = rightPlayerId;
      loserId = leftPlayerId;
      winnerUnitCount = rightUnitCount;
      loserUnitCount = leftUnitCount;
    }

    return {
      winnerId,
      loserId,
      winnerUnitCount,
      loserUnitCount,
    };
  }

  private resolveUnitCount(playerId: string): number {
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId);
    const fallbackUnitCount = this.boardUnitCountByPlayer.get(playerId) ?? 4;

    return resolveUnitCountFromState(boardPlacements, fallbackUnitCount);
  }

  private resolveBoardPower(playerId: string): number {
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId);
    const fallbackUnitCount = this.boardUnitCountByPlayer.get(playerId) ?? 4;

    return resolveBoardPowerFromState(boardPlacements, fallbackUnitCount, {
      setId: this.setId,
    });
  }

  private buildLoserDamage(winnerUnitCount: number, loserUnitCount: number): number {
    const baseDamage = 5;
    const estimatedSurvivingUnits = this.estimateWinningSurvivingUnits(
      winnerUnitCount,
      loserUnitCount,
    );

    return baseDamage + estimatedSurvivingUnits;
  }

  private estimateWinningSurvivingUnits(
    winnerUnitCount: number,
    loserUnitCount: number,
  ): number {
    const unitGap = Math.max(0, winnerUnitCount - loserUnitCount);
    return Math.max(1, Math.min(8, unitGap + 1));
  }

  private captureEliminationResult(aliveBeforeElimination: Set<string>): void {
    const state = this.ensureStarted();
    const aliveAfterElimination = new Set(state.alivePlayerIds);
    const newlyEliminated: string[] = [];
    const eliminationCandidates =
      this.battleParticipantIds.length > 0
        ? this.battleParticipantIds
        : Array.from(aliveBeforeElimination);

    for (const playerId of eliminationCandidates) {
      if (this.eliminatedFromBottom.includes(playerId)) {
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
      if (this.eliminatedFromBottom.includes(playerId)) {
        continue;
      }

      this.eliminatedFromBottom.push(playerId);
    }
  }

  private compareEliminatedPlayers(left: string, right: string): number {
    const leftPostBattleHp = this.hpAfterBattleByPlayer.get(left) ?? Number.NEGATIVE_INFINITY;
    const rightPostBattleHp = this.hpAfterBattleByPlayer.get(right) ?? Number.NEGATIVE_INFINITY;

    if (leftPostBattleHp !== rightPostBattleHp) {
      return rightPostBattleHp - leftPostBattleHp;
    }

    const leftRoundStartHp =
      this.hpAtBattleStartByPlayer.get(left) ?? this.ensureStarted().getPlayerHp(left);
    const rightRoundStartHp =
      this.hpAtBattleStartByPlayer.get(right) ?? this.ensureStarted().getPlayerHp(right);

    if (leftRoundStartHp !== rightRoundStartHp) {
      return rightRoundStartHp - leftRoundStartHp;
    }

    return MatchRoomController.comparePlayerIds(left, right);
  }

  private static comparePlayerIds(left: string, right: string): number {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  private buildPairingsForRound(
    battleParticipants: string[],
    roundIndex: number,
  ): BattlePairing[] {
    if (battleParticipants.length < 2) {
      return [];
    }

    const orderedParticipants = [...battleParticipants].sort((left, right) =>
      MatchRoomController.comparePlayerIds(left, right),
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
}
