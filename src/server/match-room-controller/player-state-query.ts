import type { Phase, GameLoopState } from "../../domain/game-loop-state";
import type {
  BattleTimelineEvent,
  BoardUnitType,
  BoardUnitPlacement,
  SharedBattleReplayMessage,
} from "../../shared/room-messages";
import type { ControllerPlayerStatus } from "../types/player-state-types";
import { comparePlayerIds } from "./player-compare";
import type { ActiveSynergy } from "./synergy-helpers";

type PhaseResult = "pending" | "success" | "failed";

export interface PlayerStateQueryShopOffer {
  unitType: BoardUnitType;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  starLevel?: number;
}

function normalizeShopOfferUnitId(offer: PlayerStateQueryShopOffer): string {
  const normalizedUnitId = typeof offer.unitId === "string" ? offer.unitId.trim() : "";
  return normalizedUnitId;
}

function toShopOfferView(offer: PlayerStateQueryShopOffer): PlayerStateQueryShopOffer & { unitId: string } {
  return {
    ...offer,
    unitId: normalizeShopOfferUnitId(offer),
  };
}

export interface PlayerStateQueryOwnedUnits {
  vanguard: number;
  ranger: number;
  mage: number;
  assassin: number;
}

export interface PlayerStateQueryBenchUnit {
  unitType: BoardUnitType;
  unitId?: string;
  cost: number;
  starLevel: number;
  unitCount: number;
}

export interface PlayerStateQueryBattleResult {
  opponentId: string;
  won: boolean;
  damageDealt: number;
  damageTaken: number;
  survivors: number;
  opponentSurvivors: number;
  timeline?: BattleTimelineEvent[];
  survivorSnapshots?: Array<{
    unitId: string;
    displayName: string;
    unitType: string;
    hp: number;
    maxHp: number;
    sharedBoardCellIndex: number;
  }>;
}

export interface PlayerStateQueryPairing {
  leftPlayerId: string;
  rightPlayerId: string | null;
  ghostSourcePlayerId: string | null;
}

export interface PlayerStateQueryPhaseProgress {
  targetHp: number;
  damageDealt: number;
  result: PhaseResult;
  completionRate: number;
}

export interface PlayerStateQueryServiceDeps {
  ensureKnownPlayer(playerId: string): void;
  ensureStarted(): GameLoopState;
  getCurrentPhase(): Phase | "Waiting";
  getCurrentRoundIndex(): number;
  getAlivePlayerIds(): string[];
  getCurrentPhaseDeadlineAtMs(): number | null;
  getTrackedPlayerIds(): string[];
  getFinalRankingOverride(): string[] | null;
  getEliminatedFromBottom(): string[];
  getCurrentRoundPairings(): PlayerStateQueryPairing[];
  getCurrentPhaseProgress(): PlayerStateQueryPhaseProgress;
  wantsBossByPlayer: ReadonlyMap<string, boolean>;
  selectedBossByPlayer: ReadonlyMap<string, string>;
  roleByPlayer: ReadonlyMap<string, "unassigned" | "raid" | "boss">;
  goldByPlayer: ReadonlyMap<string, number>;
  xpByPlayer: ReadonlyMap<string, number>;
  levelByPlayer: ReadonlyMap<string, number>;
  shopOffersByPlayer: ReadonlyMap<string, PlayerStateQueryShopOffer[]>;
  shopLockedByPlayer: ReadonlyMap<string, boolean>;
  benchUnitsByPlayer: ReadonlyMap<string, PlayerStateQueryBenchUnit[]>;
  ownedUnitsByPlayer: ReadonlyMap<string, PlayerStateQueryOwnedUnits>;
  bossShopOffersByPlayer: ReadonlyMap<string, PlayerStateQueryShopOffer[]>;
  battleResultsByPlayer: ReadonlyMap<string, PlayerStateQueryBattleResult>;
  selectedHeroByPlayer: ReadonlyMap<string, string>;
  rumorInfluenceEligibleByPlayer: ReadonlyMap<string, boolean>;
  boardUnitCountByPlayer: ReadonlyMap<string, number>;
  boardPlacementsByPlayer: ReadonlyMap<string, BoardUnitPlacement[]>;
  heroPlacementByPlayer: ReadonlyMap<string, number>;
  bossPlacementByPlayer: ReadonlyMap<string, number>;
  enableBossExclusiveShop: boolean;
  enableSharedPool: boolean;
  sharedPool: { getAllInventory(): ReadonlyMap<number, number> } | null;
  initialGold: number;
  initialXp: number;
  initialLevel: number;
  buildActiveSynergies(playerId: string, boardPlacements: BoardUnitPlacement[]): ActiveSynergy[];
  resolveBenchUnitDisplayName(benchUnit: PlayerStateQueryBenchUnit): string;
  formatBoardUnitToken(placement: BoardUnitPlacement): string;
}

export class PlayerStateQueryService {
  public constructor(
    private readonly deps: PlayerStateQueryServiceDeps,
  ) {}

  public getPhase(): Phase | "Waiting" {
    return this.deps.getCurrentPhase();
  }

  public getRoundIndex(): number {
    return this.deps.getCurrentRoundIndex();
  }

  public getAlivePlayerIds(): string[] {
    return this.deps.getAlivePlayerIds();
  }

  public getPhaseDeadlineAtMs(): number | null {
    return this.deps.getCurrentPhaseDeadlineAtMs();
  }

  public getGameState(): { phase: string; roundIndex: number } | null {
    const phase = this.deps.getCurrentPhase();
    if (phase === "Waiting") {
      return null;
    }

    return {
      phase,
      roundIndex: this.deps.getCurrentRoundIndex(),
    };
  }

  public getRankingTopToBottom(): string[] {
    const finalRankingOverride = this.deps.getFinalRankingOverride();
    if (finalRankingOverride) {
      return [...finalRankingOverride];
    }

    const phase = this.deps.getCurrentPhase();
    if (phase === "Waiting") {
      return [];
    }

    const alivePlayers = [...this.deps.getAlivePlayerIds()].sort((left, right) =>
      comparePlayerIds(left, right),
    );
    const eliminatedBestToWorst = [...this.deps.getEliminatedFromBottom()].reverse();

    return [...alivePlayers, ...eliminatedBestToWorst];
  }

  public getRoundPairings(): PlayerStateQueryPairing[] {
    return this.deps.getCurrentRoundPairings().map((pairing) => ({
      leftPlayerId: pairing.leftPlayerId,
      rightPlayerId: pairing.rightPlayerId,
      ghostSourcePlayerId: pairing.ghostSourcePlayerId,
    }));
  }

  public getSelectedHero(playerId: string): string {
    this.deps.ensureKnownPlayer(playerId);
    return this.deps.selectedHeroByPlayer.get(playerId) ?? "";
  }

  public getSelectedBoss(playerId: string): string {
    this.deps.ensureKnownPlayer(playerId);
    return this.deps.selectedBossByPlayer.get(playerId) ?? "";
  }

  public getHeroPlacementForPlayer(playerId: string): number | null {
    this.deps.ensureKnownPlayer(playerId);
    const placement = this.deps.heroPlacementByPlayer.get(playerId) ?? -1;
    return Number.isInteger(placement) && placement >= 0 ? placement : null;
  }

  public getBossPlacementForPlayer(playerId: string): number | null {
    this.deps.ensureKnownPlayer(playerId);
    const placement = this.deps.bossPlacementByPlayer.get(playerId) ?? -1;
    return Number.isInteger(placement) && placement >= 0 ? placement : null;
  }

  public getPlayerHp(playerId: string): number {
    const state = this.deps.ensureStarted();
    return state.getPlayerHp(playerId);
  }

  public getShopOffersForPlayer(playerId: string): PlayerStateQueryShopOffer[] {
    this.deps.ensureKnownPlayer(playerId);
    return (this.deps.shopOffersByPlayer.get(playerId) ?? []).map((offer) => toShopOfferView(offer));
  }

  public getBossShopOffersForPlayer(playerId: string): PlayerStateQueryShopOffer[] {
    this.deps.ensureKnownPlayer(playerId);
    if (!this.deps.enableBossExclusiveShop) {
      return [];
    }

    const state = this.deps.ensureStarted();
    if (!state.isBoss(playerId)) {
      return [];
    }

    return (this.deps.bossShopOffersByPlayer.get(playerId) ?? []).map((offer) => toShopOfferView(offer));
  }

  public isBossPlayer(playerId: string): boolean {
    this.deps.ensureKnownPlayer(playerId);
    const state = this.deps.ensureStarted();
    return state.isBoss(playerId);
  }

  public getBossPlayerId(): string | null {
    const state = this.deps.ensureStarted();
    return state.bossPlayerId;
  }

  public getRaidPlayerIds(): string[] {
    const state = this.deps.ensureStarted();
    return [...state.raidPlayerIds];
  }

  public getDominationCount(): number {
    const state = this.deps.ensureStarted();
    return state.dominationCount;
  }

  public getPlayerIds(): string[] {
    return [...this.deps.getTrackedPlayerIds()];
  }

  public getBoardPlacementsForPlayer(playerId: string): BoardUnitPlacement[] {
    this.deps.ensureKnownPlayer(playerId);
    return [...(this.deps.boardPlacementsByPlayer.get(playerId) ?? [])];
  }

  public getBenchUnitsForPlayer(playerId: string): Array<{ unitType: string; starLevel: number }> {
    this.deps.ensureKnownPlayer(playerId);
    const benchUnits = this.deps.benchUnitsByPlayer.get(playerId) ?? [];
    return benchUnits.map((unit) => ({
      unitType: unit.unitType,
      starLevel: unit.starLevel,
    }));
  }

  public getPlayerStatus(playerId: string): ControllerPlayerStatus {
    this.deps.ensureKnownPlayer(playerId);
    const state = this.deps.ensureStarted();
    const isActivePlayer = state.playerIds.includes(playerId);
    const ownedUnits = this.deps.ownedUnitsByPlayer.get(playerId);
    const benchUnits = this.deps.benchUnitsByPlayer.get(playerId) ?? [];
    const boardPlacements = this.deps.boardPlacementsByPlayer.get(playerId) ?? [];
    const bossShopOffers = this.deps.bossShopOffersByPlayer.get(playerId) ?? [];
    const isRumorEligible = this.deps.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;

    const shopOffers = (this.deps.shopOffersByPlayer.get(playerId) ?? []).map((offer) => toShopOfferView(offer));
    if (process.env.MATCH_DEBUG_LOGS === "1") {
      // eslint-disable-next-line no-console
      console.log(`Shop offers for ${playerId}:`, shopOffers);
    }

    const activeSynergies = this.deps.buildActiveSynergies(playerId, boardPlacements);

    const baseStatus: ControllerPlayerStatus = {
      wantsBoss: this.deps.wantsBossByPlayer.get(playerId) ?? false,
      selectedBossId: this.deps.selectedBossByPlayer.get(playerId) ?? "",
      role: this.deps.roleByPlayer.get(playerId) ?? "unassigned",
      hp: isActivePlayer ? state.getPlayerHp(playerId) : 100,
      remainingLives: isActivePlayer ? state.getRemainingLives(playerId) : 0,
      eliminated: isActivePlayer ? state.isPlayerEliminated(playerId) : false,
      boardUnitCount: this.deps.boardUnitCountByPlayer.get(playerId) ?? 4,
      gold: this.deps.goldByPlayer.get(playerId) ?? this.deps.initialGold,
      xp: this.deps.xpByPlayer.get(playerId) ?? this.deps.initialXp,
      level: this.deps.levelByPlayer.get(playerId) ?? this.deps.initialLevel,
      shopOffers,
      shopLocked: this.deps.shopLockedByPlayer.get(playerId) ?? false,
      benchUnits: benchUnits.map((benchUnit) =>
        benchUnit.starLevel > 1
          ? `${benchUnit.unitType}:${benchUnit.starLevel}`
          : benchUnit.unitType,
      ),
      benchDisplayNames: benchUnits.map((benchUnit) => this.deps.resolveBenchUnitDisplayName(benchUnit)),
      boardUnits: boardPlacements.map((placement) => this.deps.formatBoardUnitToken(placement)),
      ownedUnits: {
        vanguard: ownedUnits?.vanguard ?? 0,
        ranger: ownedUnits?.ranger ?? 0,
        mage: ownedUnits?.mage ?? 0,
        assassin: ownedUnits?.assassin ?? 0,
      },
      bossShopOffers: bossShopOffers.map((offer) => toShopOfferView(offer)),
      lastBattleResult: this.deps.battleResultsByPlayer.get(playerId),
      activeSynergies,
      selectedHeroId: this.deps.selectedHeroByPlayer.get(playerId) ?? "",
      isRumorEligible,
    };

    if (this.deps.enableSharedPool && this.deps.sharedPool) {
      return {
        ...baseStatus,
        sharedPoolInventory: this.deps.sharedPool.getAllInventory(),
      };
    }

    return baseStatus;
  }

  public getSharedBattleReplay(phase: "Battle" | "Settle"): SharedBattleReplayMessage | null {
    const state = this.deps.ensureStarted();
    const candidatePlayerIds = [
      state.bossPlayerId,
      ...state.raidPlayerIds,
      ...this.deps.getTrackedPlayerIds(),
    ].filter((playerId): playerId is string => typeof playerId === "string" && playerId.length > 0);

    for (const playerId of candidatePlayerIds) {
      const timeline = this.deps.battleResultsByPlayer.get(playerId)?.timeline;
      const battleId = this.resolveBattleIdFromTimeline(timeline);

      if (!battleId || !timeline || timeline.length === 0) {
        continue;
      }

      return {
        type: "shared_battle_replay",
        battleId,
        phase,
        timeline,
      };
    }

    return null;
  }

  public getPhaseProgress(): PlayerStateQueryPhaseProgress {
    this.deps.ensureStarted();
    return this.deps.getCurrentPhaseProgress();
  }

  private resolveBattleIdFromTimeline(
    timeline: BattleTimelineEvent[] | undefined,
  ): string | null {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return null;
    }

    const firstEvent = timeline.find((event) => typeof event?.battleId === "string");
    return firstEvent?.battleId ?? null;
  }
}
