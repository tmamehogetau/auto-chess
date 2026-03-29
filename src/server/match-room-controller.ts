import { GameLoopState, type Phase } from "../domain/game-loop-state";
import {
  hashToUint32,
  seedToUnitFloat,
  pickRarity,
} from "./match-room-controller/random-utils";
import {
  BattleResolutionService,
  type BattleResolutionDependencies,
  type BattleResolutionResult,
  type MatchupOutcome,
} from "./match-room-controller/battle-resolution";
import {
  buildBattleResultAssignments,
  buildBattleResultTraceSummary,
} from "./match-room-controller/matchup-result-helpers";
import {
  buildPreparedMatchupContext,
  buildBattleId,
  type PreparedMatchupContext,
  type RaidBattleInput,
} from "./match-room-controller/matchup-context-builder";
import {
  calculateActiveSynergyList,
  type ActiveSynergy,
} from "./match-room-controller/synergy-helpers";
import {
  applyPrepIncomeToPlayers,
} from "./match-room-controller/prep-economy";
import type {
  BoardUnitType,
  BoardUnitPlacement,
  BattleTimelineEvent,
  CommandResult,
  PlayerFacingPhase,
  SharedBattleReplayMessage,
} from "../shared/room-messages";
import { MatchLogger } from "./match-logger";
import { ShopOfferBuilder, type ShopOfferBuilderDependencies } from "./match-room-controller/shop-offer-builder";
import {
  validatePrepCommand,
  type ValidationDependencies,
  type CommandPayload,
  type ValidationInternalResult,
} from "./match-room-controller/prep-command-validator";
import {
  executePrepCommand,
  type ExecutionDependencies,
} from "./match-room-controller/prep-command-executor";
import {
  normalizeBoardPlacements,
  resolveBoardPowerFromState,
  resolveUnitCountFromState,
} from "./combat/unit-effects";
import {
  BattleSimulator,
  createBattleUnit,
  type BattleUnit,
} from "./combat/battle-simulator";
import {
  DEFAULT_UNIT_EFFECT_SET_ID,
  type UnitEffectSetId,
} from "./combat/unit-effect-definitions";
import {
  calculateSellValue,
  UNIT_SELL_VALUE_BY_TYPE,
} from "./star-level-config";
import { HEROES } from "../data/heroes";
import { isBossCharacterId } from "../shared/boss-characters";
import { FeatureFlagService } from "./feature-flag-service";
import { SharedPool } from "./shared-pool";
import {
  getActiveRosterKind,
  getActiveRosterUnitById,
  getTouhouDraftRosterUnits,
  validateRosterAvailability,
} from "./roster/roster-provider";
import type { FeatureFlags } from "../shared/feature-flags";
import { type SpellCard } from "../data/spell-cards";
import {
  SpellCardHandler,
  type SpellCombatModifiers,
} from "./match-room-controller/spell-card-handler";
import { PlayerStateQueryService } from "./match-room-controller/player-state-query";
import {
  PhaseOrchestrator,
  type PhaseProgressSnapshot,
} from "./match-room-controller/phase-orchestrator";
import { ShopManager } from "./match-room-controller/shop-manager";
import {
  BattleOrchestrator,
  type BattlePairing,
} from "./match-room-controller/battle-orchestrator";
import { getRumorUnitForRound, type RumorUnit } from "../data/rumor-units";
import { SCARLET_MANSION_UNITS, getRandomScarletMansionUnit, type ScarletMansionUnit } from "../data/scarlet-mansion-units";
import mvpPhase1UnitsData from "../data/mvp_phase1_units.json";
import type { SubUnitConfig } from "../shared/types";
import type { ControllerPlayerStatus } from "./types/player-state-types";
import {
  COMBAT_CELL_MAX_INDEX,
  COMBAT_CELL_MIN_INDEX,
} from "../shared/board-geometry";
import { DEFAULT_SHARED_BOARD_CONFIG, sharedBoardCoordinateToIndex } from "../shared/shared-board-config";

function shouldEmitVerboseBattleLogs(): boolean {
  return process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true";
}

interface MatchRoomControllerOptions {
  readyAutoStartMs: number;
  prepDurationMs: number;
  battleDurationMs: number;
  settleDurationMs: number;
  eliminationDurationMs: number;
  setId?: UnitEffectSetId;
  featureFlags?: Partial<FeatureFlags>;
}



type RoundDamageByPlayer = Partial<Record<string, number>>;

interface PlayerFacingPhaseState {
  phase: PlayerFacingPhase;
  deadlineAtMs: number;
}

const INITIAL_GOLD = 15;
const INITIAL_XP = 0;
const INITIAL_LEVEL = 1;
const RAID_PREP_BASE_INCOME = 5;
const BOSS_PREP_BASE_INCOME = 9;
const RAID_PHASE_SUCCESS_BONUS = 2;
const XP_PURCHASE_COST = 4;
const XP_PURCHASE_GAIN = 4;
const MAX_XP_PURCHASE_COUNT = 10;
const MAX_SHOP_REFRESH_COUNT = 5;
const SHOP_SIZE = 5;
const MAX_SHOP_BUY_SLOT_INDEX = SHOP_SIZE - 1;
const BOSS_SHOP_SIZE = 2;
const MIN_BOARD_CELL_INDEX = COMBAT_CELL_MIN_INDEX;
const MAX_BOARD_CELL_INDEX = COMBAT_CELL_MAX_INDEX;
const MAX_LEVEL = 6;

const PHASE_HP_TARGET_BY_ROUND: Readonly<Record<number, number>> = {
  1: 600,
  2: 750,
  3: 900,
  4: 1050,
  5: 1250,
  6: 1450,
  7: 1650,
  8: 1850,
  9: 2100,
  10: 2400,
  11: 2700,
  12: 0,
};

const PHASE_EXPANSION_HP_TARGET_BY_ROUND: Readonly<Record<number, number>> = {
  1: 10,
  2: 10,
  3: 10,
  4: 10,
  5: 10,
  6: 10,
  7: 10,
  8: 10,
  9: 10,
  10: 10,
  11: 10,
  12: 0,
};

const RAID_PHASE_HP_TARGET_BY_ROUND: Readonly<Record<number, number>> = {
  1: 600,
  2: 750,
  3: 900,
  4: 1050,
  5: 1250,
  6: 1450,
  7: 1650,
  8: 1850,
  9: 2100,
  10: 2400,
  11: 2700,
  12: 3000,
};

const XP_COSTS_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 2,
  2: 2,
  3: 6,
  4: 10,
  5: 20,
};

type UnitRarity = 1 | 2 | 3 | 4 | 5;
interface ShopOffer {
  unitType: BoardUnitType;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  rarity: UnitRarity;
  cost: number;
  isRumorUnit?: boolean;
  purchased?: boolean;
  starLevel?: number;
}

interface OwnedUnits {
  vanguard: number;
  ranger: number;
  mage: number;
  assassin: number;
}

interface BenchUnit {
  unitType: BoardUnitType;
  unitId?: string;
  cost: number;
  starLevel: number;
  unitCount: number;
}

const SHOP_ODDS_BY_LEVEL: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [1, 0, 0],
  2: [0.8, 0.2, 0],
  3: [0.6, 0.35, 0.05],
  4: [0.45, 0.4, 0.15],
  5: [0.3, 0.45, 0.25],
  6: [0.2, 0.45, 0.35],
};

interface MvpPhase1UnitForSubUnit {
  unitId: string;
  type: BoardUnitType;
  subUnit?: SubUnitConfig;
}

const SUPPORTED_SUB_UNIT_IDS = new Set(["warrior_a_sub"]);

function resolveSubUnitAssistConfigByType(): ReadonlyMap<BoardUnitType, SubUnitConfig> {
  const configByType = new Map<BoardUnitType, SubUnitConfig>();
  const unitRows = (mvpPhase1UnitsData as { units: MvpPhase1UnitForSubUnit[] }).units;

  for (const unitRow of unitRows) {
    const subUnit = unitRow.subUnit;

    if (!subUnit) {
      continue;
    }

    if (subUnit.mode !== "assist") {
      throw new Error(`Unsupported sub-unit mode: ${subUnit.mode}`);
    }

    if (!SUPPORTED_SUB_UNIT_IDS.has(subUnit.unitId)) {
      throw new Error(`Unsupported sub-unit id: ${subUnit.unitId}`);
    }

    if (subUnit.bonusAttackPct !== undefined && subUnit.bonusAttackPct <= 0) {
      throw new Error(`Invalid bonusAttackPct for ${subUnit.unitId}`);
    }

    if (subUnit.bonusHpPct !== undefined && subUnit.bonusHpPct <= 0) {
      throw new Error(`Invalid bonusHpPct for ${subUnit.unitId}`);
    }

    if (configByType.has(unitRow.type)) {
      continue;
    }

    const normalizedConfig: SubUnitConfig = {
      unitId: subUnit.unitId,
      mode: "assist",
      parentUnitId: unitRow.unitId,
    };

    if (subUnit.bonusAttackPct !== undefined) {
      normalizedConfig.bonusAttackPct = subUnit.bonusAttackPct;
    }

    if (subUnit.bonusHpPct !== undefined) {
      normalizedConfig.bonusHpPct = subUnit.bonusHpPct;
    }

    configByType.set(unitRow.type, normalizedConfig);
  }

  return configByType;
}

interface BattleResult {
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

export interface MatchRoomControllerTestBattleResult {
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

export interface MatchRoomControllerTestAccess {
  battleResultsByPlayer: Map<string, MatchRoomControllerTestBattleResult>;
  battleResolutionService: BattleResolutionService;
  spellCardHandler: SpellCardHandler;
  gameLoopState: Pick<GameLoopState, "consumeLife"> | null;
  boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
  battleInputSnapshotByPlayer: Map<string, BoardUnitPlacement[]>;
}

export class MatchRoomController {
  private playerIds: string[];

  private readonly readyPlayers: Set<string>;

  private readonly lastCmdSeqByPlayer: Map<string, number>;

  private readonly boardUnitCountByPlayer: Map<string, number>;

  private readonly boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;

  private readonly battleInputSnapshotByPlayer: Map<string, BoardUnitPlacement[]>;

  private readonly goldByPlayer: Map<string, number>;

  private readonly xpByPlayer: Map<string, number>;

  private readonly levelByPlayer: Map<string, number>;

  private readonly shopOffersByPlayer: Map<string, ShopOffer[]>;

  private readonly shopRefreshCountByPlayer: Map<string, number>;

  private readonly shopPurchaseCountByPlayer: Map<string, number>;

  private readonly shopLockedByPlayer: Map<string, boolean>;

  private readonly benchUnitsByPlayer: Map<string, BenchUnit[]>;

  private readonly ownedUnitsByPlayer: Map<string, OwnedUnits>;

  private readonly kouRyuudouFreeRefreshConsumedByPlayer: Map<string, boolean>;

  private readonly battleResultsByPlayer: Map<string, BattleResult>;

  private readonly selectedHeroByPlayer: Map<string, string>;
  private readonly heroPlacementByPlayer: Map<string, number>;
  private readonly heroSubHostCellByPlayer: Map<string, number>;

  private readonly selectedBossByPlayer: Map<string, string>;
  private readonly bossPlacementByPlayer: Map<string, number>;

  private readonly wantsBossByPlayer: Map<string, boolean>;

  private readonly roleByPlayer: Map<string, "unassigned" | "raid" | "boss">;

  private readonly finalRoundShieldByPlayer: Map<string, number>;

  private readonly readyDeadlineAtMs: number;

  private readonly prepDurationMs: number;

  private readonly battleDurationMs: number;

  private readonly settleDurationMs: number;

  private readonly eliminationDurationMs: number;

  private gameLoopState: GameLoopState | null;

  private readonly pendingRoundDamageByPlayer: Map<string, number>;

  private pendingPhaseDamageForTest: number | null;

  private hpAtBattleStartByPlayer: Map<string, number>;

  private hpAfterBattleByPlayer: Map<string, number>;

  private battleParticipantIds: string[];

  private currentRoundPairings: BattlePairing[];

  private readonly eliminatedFromBottom: string[];

  private readonly setId: UnitEffectSetId;

  private readonly sharedPool: SharedPool | null;

  private readonly enableSharedPool: boolean;

  private readonly enableSubUnitSystem: boolean;

  private readonly enableSpellCard: boolean;

  private readonly spellCardHandler: SpellCardHandler;

  private readonly enableRumorInfluence: boolean;

  private readonly enableBossExclusiveShop: boolean;

  private readonly enableHeroSystem: boolean;

  private readonly rumorInfluenceEligibleByPlayer: Map<string, boolean>;

  private readonly bossShopOffersByPlayer: Map<string, ShopOffer[]>;

  private readonly subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig>;

  private readonly featureFlags: {
    enablePhaseExpansion: boolean;
  };

  private readonly rosterFlags: FeatureFlags;

  private finalRankingOverride: string[] | null;

  private matchLogger: MatchLogger | null;

  private readonly shopOfferBuilder: ShopOfferBuilder;
  private readonly battleResolutionService: BattleResolutionService;
  private readonly phaseOrchestrator: PhaseOrchestrator;
  private readonly shopManager: ShopManager<BattleResult>;
  private readonly battleOrchestrator: BattleOrchestrator<BattleResult>;
  private readonly playerStateQuery: PlayerStateQueryService;
  private readonly raidRecoveryRoundIndex: number;

  private pendingRumorInfluence: {
    roundIndex: number;
    rumorFactions: string[];
    guaranteedRumorSlotApplied: boolean;
  } | null = null;

  public constructor(
    playerIds: string[],
    createdAtMs: number,
    options: MatchRoomControllerOptions,
    matchLogger: MatchLogger | null = null,
  ) {
    if (playerIds.length < 2) {
      throw new Error("At least 2 players are required");
    }

    this.playerIds = [...playerIds];
    this.readyPlayers = new Set<string>();
    this.lastCmdSeqByPlayer = new Map<string, number>();
    this.boardUnitCountByPlayer = new Map<string, number>();
    this.boardPlacementsByPlayer = new Map<string, BoardUnitPlacement[]>();
    this.battleInputSnapshotByPlayer = new Map<string, BoardUnitPlacement[]>();
    this.goldByPlayer = new Map<string, number>();
    this.xpByPlayer = new Map<string, number>();
    this.levelByPlayer = new Map<string, number>();
    this.shopOffersByPlayer = new Map<string, ShopOffer[]>();
    this.shopRefreshCountByPlayer = new Map<string, number>();
    this.shopPurchaseCountByPlayer = new Map<string, number>();
    this.shopLockedByPlayer = new Map<string, boolean>();
    this.benchUnitsByPlayer = new Map<string, BenchUnit[]>();
    this.ownedUnitsByPlayer = new Map<string, OwnedUnits>();
    this.kouRyuudouFreeRefreshConsumedByPlayer = new Map<string, boolean>();
    this.battleResultsByPlayer = new Map<string, BattleResult>();
    this.selectedHeroByPlayer = new Map<string, string>();
    this.heroPlacementByPlayer = new Map<string, number>();
    this.heroSubHostCellByPlayer = new Map<string, number>();
    this.selectedBossByPlayer = new Map<string, string>();
    this.bossPlacementByPlayer = new Map<string, number>();
    this.wantsBossByPlayer = new Map<string, boolean>();
    this.roleByPlayer = new Map<string, "unassigned" | "raid" | "boss">();
    this.finalRoundShieldByPlayer = new Map<string, number>();
    this.readyDeadlineAtMs = createdAtMs + options.readyAutoStartMs;
    this.prepDurationMs = options.prepDurationMs;
    this.battleDurationMs = options.battleDurationMs;
    this.settleDurationMs = options.settleDurationMs;
    this.eliminationDurationMs = options.eliminationDurationMs;
    this.gameLoopState = null;
    this.pendingRoundDamageByPlayer = new Map<string, number>();
    this.pendingPhaseDamageForTest = null;
    this.hpAtBattleStartByPlayer = new Map<string, number>();
    this.hpAfterBattleByPlayer = new Map<string, number>();
    this.battleParticipantIds = [];
    this.currentRoundPairings = [];
    this.eliminatedFromBottom = [];
    this.setId = options.setId ?? DEFAULT_UNIT_EFFECT_SET_ID;
    const resolvedFeatureFlags: FeatureFlags = {
      ...FeatureFlagService.getInstance().getFlags(),
      ...options.featureFlags,
    };
    this.featureFlags = {
      enablePhaseExpansion: resolvedFeatureFlags.enablePhaseExpansion,
    };

    // Store a room-local snapshot for the full match lifetime.
    this.rosterFlags = resolvedFeatureFlags;

    // Feature Flagに基づいて共有プールを初期化
    this.enableSharedPool =
      resolvedFeatureFlags.enableSharedPool
      || resolvedFeatureFlags.enablePerUnitSharedPool;
    this.sharedPool = this.enableSharedPool ? new SharedPool() : null;

    validateRosterAvailability(this.rosterFlags);

    // Initialize shop offer builder with dependencies
    // Uses hardcoded pools for byte-for-byte MVP compatibility
    // Uses roster provider boundary to validate roster kind - fails clearly for Touhou roster
    const shopOfferDeps: ShopOfferBuilderDependencies = {
      getRumorUnitForRound,
      getRandomScarletMansionUnit,
      hashToUint32,
      seedToUnitFloat,
      pickRarity,
      getPlayerLevel: (playerId: string) => this.levelByPlayer.get(playerId) ?? INITIAL_LEVEL,
      isSharedPoolEnabled: () => this.enableSharedPool,
      isPoolDepleted: (cost: number) => this.sharedPool?.isDepleted(cost) ?? false,
      isPerUnitPoolEnabled: () => this.rosterFlags.enablePerUnitSharedPool,
      isUnitIdPoolDepleted: (unitId: string, cost: number) =>
        this.sharedPool?.isDepletedByUnitId(unitId, cost) ?? false,
      isRumorInfluenceEnabled: () => this.enableRumorInfluence,
      setId: this.setId,
      random: Math.random,
      getActiveRosterKind: () => getActiveRosterKind(this.rosterFlags),
      getTouhouDraftRosterUnits,
    };
    this.shopOfferBuilder = new ShopOfferBuilder(shopOfferDeps);

    this.finalRankingOverride = null;
    this.matchLogger = matchLogger;

    for (const playerId of playerIds) {
      this.lastCmdSeqByPlayer.set(playerId, 0);
      this.boardUnitCountByPlayer.set(playerId, 4);
      this.boardPlacementsByPlayer.set(playerId, []);
      this.goldByPlayer.set(playerId, INITIAL_GOLD);
      this.xpByPlayer.set(playerId, INITIAL_XP);
      this.levelByPlayer.set(playerId, INITIAL_LEVEL);
      this.shopOffersByPlayer.set(playerId, []);
      this.shopRefreshCountByPlayer.set(playerId, 0);
      this.shopPurchaseCountByPlayer.set(playerId, 0);
      this.shopLockedByPlayer.set(playerId, false);
      this.benchUnitsByPlayer.set(playerId, []);
      this.ownedUnitsByPlayer.set(playerId, {
        vanguard: 0,
        ranger: 0,
        mage: 0,
        assassin: 0,
      });
      this.kouRyuudouFreeRefreshConsumedByPlayer.set(playerId, false);
      this.selectedHeroByPlayer.set(playerId, "");
      this.heroPlacementByPlayer.set(playerId, -1);
      this.heroSubHostCellByPlayer.set(playerId, -1);
      this.selectedBossByPlayer.set(playerId, "");
      this.bossPlacementByPlayer.set(playerId, -1);
      this.wantsBossByPlayer.set(playerId, false);
      this.roleByPlayer.set(playerId, "unassigned");
      this.finalRoundShieldByPlayer.set(playerId, 0);
    }

    // Feature Flagに基づいてサブユニットシステムを初期化
    this.enableSubUnitSystem = resolvedFeatureFlags.enableSubUnitSystem;
    this.subUnitAssistConfigByType = this.enableSubUnitSystem
      ? resolveSubUnitAssistConfigByType()
      : new Map<BoardUnitType, SubUnitConfig>();
    // Initialize battle resolution service with dependencies
    // (must be after subUnit system initialization)
    const battleResolutionDeps: BattleResolutionDependencies = {
      battleSimulator: new BattleSimulator(),
      matchLogger,
      enableSubUnitSystem: this.enableSubUnitSystem,
      subUnitAssistConfigByType: this.enableSubUnitSystem
        ? this.subUnitAssistConfigByType
        : null,
      featureFlags: this.rosterFlags,
    };
    this.battleResolutionService = new BattleResolutionService(battleResolutionDeps);

    // Feature Flagに基づいてスペルカードを初期化
    this.enableSpellCard = resolvedFeatureFlags.enableSpellCard;
    this.spellCardHandler = new SpellCardHandler({
      enableSpellCard: this.enableSpellCard,
      matchLogger: this.matchLogger,
    });

    // Feature Flagに基づいて噂勢力を初期化
    this.enableRumorInfluence = resolvedFeatureFlags.enableRumorInfluence;
    this.rumorInfluenceEligibleByPlayer = new Map<string, boolean>();

    // 噂勢力 eligibility を全プレイヤーで初期化
    for (const playerId of playerIds) {
      this.rumorInfluenceEligibleByPlayer.set(playerId, false);
    }

    this.enableHeroSystem = resolvedFeatureFlags.enableHeroSystem;

    // Feature Flagに基づいてボス専用ショップを初期化
    this.enableBossExclusiveShop = resolvedFeatureFlags.enableBossExclusiveShop;
    this.raidRecoveryRoundIndex = Math.max(1, Math.floor(this.resolveMaxRounds() / 2));
    this.bossShopOffersByPlayer = new Map<string, ShopOffer[]>();
    this.shopManager = new ShopManager<BattleResult>({
      ensureStarted: () => this.ensureStarted(),
      buildShopOffers: (playerId, roundIndex, refreshCount, purchaseCount, isRumorEligible) =>
        this.shopOfferBuilder.buildShopOffers(
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount,
          isRumorEligible,
        ),
      buildBossShopOffers: () => this.shopOfferBuilder.buildBossShopOffers(),
      buildReplacementOffer: (playerId, roundIndex, refreshCount, purchaseCount) =>
        this.shopOfferBuilder.buildReplacementOffer(
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount,
        ),
      shopRefreshCountByPlayer: this.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.shopPurchaseCountByPlayer,
      shopLockedByPlayer: this.shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.shopOffersByPlayer,
      bossShopOffersByPlayer: this.bossShopOffersByPlayer,
      battleResultsByPlayer: this.battleResultsByPlayer,
      benchUnitsByPlayer: this.benchUnitsByPlayer,
      boardPlacementsByPlayer: this.boardPlacementsByPlayer,
      boardUnitCountByPlayer: this.boardUnitCountByPlayer,
      ownedUnitsByPlayer: this.ownedUnitsByPlayer,
      goldByPlayer: this.goldByPlayer,
      enableRumorInfluence: this.enableRumorInfluence,
      enableBossExclusiveShop: this.enableBossExclusiveShop,
      enableSharedPool: this.enableSharedPool,
      sharedPool: this.sharedPool,
      rosterFlags: this.rosterFlags,
      initialGold: INITIAL_GOLD,
      maxBenchSize: 9,
    });
    this.battleOrchestrator = new BattleOrchestrator<BattleResult>({
      ensureStarted: () => this.ensureStarted(),
      isRaidMode: () => this.isRaidMode(),
      getPhaseResult: () => this.phaseOrchestrator.getPhaseProgress().result,
      pendingRoundDamageByPlayer: this.pendingRoundDamageByPlayer,
      battleResultsByPlayer: this.battleResultsByPlayer,
      getCurrentRoundPairings: () => this.currentRoundPairings,
      getBattleParticipantIds: () => this.battleParticipantIds,
      getHpAtBattleStartByPlayer: () => this.hpAtBattleStartByPlayer,
      getHpAfterBattleByPlayer: () => this.hpAfterBattleByPlayer,
      eliminatedFromBottom: this.eliminatedFromBottom,
      resolveMatchupOutcome: (leftPlayerId, rightPlayerId) =>
        this.resolveMatchupOutcome(leftPlayerId, rightPlayerId),
      setFinalRankingOverride: (ranking) => {
        this.finalRankingOverride = ranking;
      },
    });
    this.phaseOrchestrator = new PhaseOrchestrator({
      getState: () => this.gameLoopState,
      isRaidMode: () => this.isRaidMode(),
      enablePhaseExpansion: this.featureFlags.enablePhaseExpansion,
      prepDurationMs: this.prepDurationMs,
      battleDurationMs: this.battleDurationMs,
      settleDurationMs: this.settleDurationMs,
      eliminationDurationMs: this.eliminationDurationMs,
      resolvePhaseHpTarget: (roundIndex) => this.resolvePhaseHpTarget(roundIndex),
      onPrepToBattle: () => {
        this.activateFinalRoundShields();
        this.captureBattleStartHp();
        this.captureBattleInputSnapshot();
        this.declareSpell();
        this.applyPreBattleSpellEffect();
      },
      onBattleToSettle: () => {
        this.battleOrchestrator.resolveMissingRoundDamage();
        this.capturePhaseProgressFromPendingDamage();
        this.applyPendingRoundDamage();
        this.capturePostBattleHp();
        this.applySpellEffect();
      },
      onBeforeSettleToElimination: () => {
        this.applyRaidRoundConsequences();
      },
      onAfterSettleToElimination: (aliveBeforeElimination) => {
        this.battleOrchestrator.captureEliminationResult(aliveBeforeElimination);
      },
      onEliminationToPrep: () => this.resetForNextPrepRound(),
      shouldEndAfterElimination: (maxRounds) => this.battleOrchestrator.shouldEndAfterElimination(maxRounds),
      logRoundTransition: (phase, roundIndex, nowMs) =>
        this.matchLogger?.logRoundTransition(phase, roundIndex, nowMs),
    });

    this.playerStateQuery = new PlayerStateQueryService({
      ensureKnownPlayer: (playerId) => this.ensureKnownPlayer(playerId),
      ensureStarted: () => this.ensureStarted(),
      getCurrentPhase: () => this.gameLoopState?.phase ?? "Waiting",
      getCurrentRoundIndex: () => this.gameLoopState?.roundIndex ?? 0,
      getAlivePlayerIds: () => this.gameLoopState?.alivePlayerIds ?? [],
      getCurrentPhaseDeadlineAtMs: () => {
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
      },
      getTrackedPlayerIds: () => this.playerIds,
      getFinalRankingOverride: () => this.finalRankingOverride,
      getEliminatedFromBottom: () => this.eliminatedFromBottom,
      getCurrentRoundPairings: () => this.currentRoundPairings,
      getCurrentPhaseProgress: () => this.phaseOrchestrator.getPhaseProgress(),
      wantsBossByPlayer: this.wantsBossByPlayer,
      selectedBossByPlayer: this.selectedBossByPlayer,
      roleByPlayer: this.roleByPlayer,
      getFinalRoundShield: (playerId) => this.getDisplayedFinalRoundShield(playerId),
      goldByPlayer: this.goldByPlayer,
      xpByPlayer: this.xpByPlayer,
      levelByPlayer: this.levelByPlayer,
      shopOffersByPlayer: this.shopOffersByPlayer,
      shopLockedByPlayer: this.shopLockedByPlayer,
      benchUnitsByPlayer: this.benchUnitsByPlayer,
      ownedUnitsByPlayer: this.ownedUnitsByPlayer,
      bossShopOffersByPlayer: this.bossShopOffersByPlayer,
      battleResultsByPlayer: this.battleResultsByPlayer,
      selectedHeroByPlayer: this.selectedHeroByPlayer,
      rumorInfluenceEligibleByPlayer: this.rumorInfluenceEligibleByPlayer,
      boardUnitCountByPlayer: this.boardUnitCountByPlayer,
      boardPlacementsByPlayer: this.boardPlacementsByPlayer,
      heroPlacementByPlayer: this.heroPlacementByPlayer,
      heroSubHostCellByPlayer: this.heroSubHostCellByPlayer,
      bossPlacementByPlayer: this.bossPlacementByPlayer,
      enableBossExclusiveShop: this.enableBossExclusiveShop,
      enableSharedPool: this.enableSharedPool,
      sharedPool: this.sharedPool,
      initialGold: INITIAL_GOLD,
      initialXp: INITIAL_XP,
      initialLevel: INITIAL_LEVEL,
      buildActiveSynergies: (playerId, boardPlacements) => {
        const heroSynergyBonusType = this.resolveHeroSynergyBonusType(playerId);
        return this.calculateActiveSynergies(boardPlacements, heroSynergyBonusType, playerId);
      },
      resolveBenchUnitDisplayName: (benchUnit) =>
        this.resolveBenchUnitDisplayName(benchUnit as BenchUnit),
      formatBoardUnitToken: (playerId, placement) => {
        const starLevel = placement.starLevel ?? 1;
        const hasSubUnitAssist = this.enableSubUnitSystem
          && (
            placement.subUnit !== undefined
            || this.getHeroSubHostCellForPlayer(playerId) === placement.cell
          );

        if (starLevel > 1 || hasSubUnitAssist) {
          const tokenWithStarLevel = `${placement.cell}:${placement.unitType}:${starLevel}`;
          if (hasSubUnitAssist) {
            return `${tokenWithStarLevel}:sub`;
          }
          return tokenWithStarLevel;
        }

        return `${placement.cell}:${placement.unitType}`;
      },
      formatBoardSubUnitToken: (cell, subUnit) => {
        const starLevel = subUnit.starLevel ?? 1;

        if (starLevel > 1) {
          return `${cell}:${subUnit.unitType}:${starLevel}`;
        }

        return `${cell}:${subUnit.unitType}`;
      },
      formatHeroSubUnitToken: (cell, heroId) => `${cell}:hero:${heroId}`,
    });
  }

  public get phase(): Phase | "Waiting" {
    return this.playerStateQuery.getPhase();
  }

  public get prepDeadlineAtMs(): number | null {
    return this.phaseOrchestrator.getPrepDeadlineAtMs();
  }

  private get battleDeadlineAtMs(): number | null {
    return this.phaseOrchestrator.getBattleDeadlineAtMs();
  }

  private get settleDeadlineAtMs(): number | null {
    return this.phaseOrchestrator.getSettleDeadlineAtMs();
  }

  private get eliminationDeadlineAtMs(): number | null {
    return this.phaseOrchestrator.getEliminationDeadlineAtMs();
  }

  public get roundIndex(): number {
    return this.playerStateQuery.getRoundIndex();
  }

  public get alivePlayerIds(): string[] {
    return this.playerStateQuery.getAlivePlayerIds();
  }

  public get phaseDeadlineAtMs(): number | null {
    return this.playerStateQuery.getPhaseDeadlineAtMs();
  }

  public getPlayerFacingPhaseState(nowMs: number = Date.now()): PlayerFacingPhaseState {
    switch (this.phase) {
      case "Prep": {
        const prepDeadlineAtMs = this.prepDeadlineAtMs ?? 0;
        const deployDurationMs = Math.floor(this.prepDurationMs / 2);
        const purchaseDeadlineAtMs = Math.max(0, prepDeadlineAtMs - deployDurationMs);
        const phase = nowMs < purchaseDeadlineAtMs ? "purchase" : "deploy";
        const deadlineAtMs = phase === "purchase" ? purchaseDeadlineAtMs : prepDeadlineAtMs;
        return { phase, deadlineAtMs };
      }
      case "Battle":
        return { phase: "battle", deadlineAtMs: this.battleDeadlineAtMs ?? 0 };
      case "Settle":
        return { phase: "battle", deadlineAtMs: this.settleDeadlineAtMs ?? 0 };
      case "Elimination":
        return { phase: "battle", deadlineAtMs: this.eliminationDeadlineAtMs ?? 0 };
      case "End":
        return { phase: "battle", deadlineAtMs: 0 };
      case "Waiting":
      default:
        return { phase: "lobby", deadlineAtMs: 0 };
    }
  }

  /**
   * ゲーム状態を取得（SharedBoardBridge用）
   * @returns ゲーム状態（未開始時はnull）
   */
  public getGameState(): { phase: string; roundIndex: number } | null {
    return this.playerStateQuery.getGameState();
  }

  /**
   * SharedBoardBridgeからの配置適用（双方向同期）
   * @param playerId プレイヤーID
   * @param placements 配置データ
   * @returns 適用結果
   */
  public applyPrepPlacementForPlayer(
    playerId: string,
    placements: BoardUnitPlacement[],
  ): { success: boolean; code: string; error?: string } {
    try {
      // プレイヤー存在確認
      this.ensureKnownPlayer(playerId);

      // Prepフェーズチェック
      if (!this.gameLoopState || this.gameLoopState.phase !== "Prep") {
        return { success: false, code: "PHASE_MISMATCH", error: "Not in Prep phase" };
      }

      // 配置の正規化とバリデーション
      const validationResult = normalizeBoardPlacements(placements);
      if (!validationResult.normalized) {
        const errorCode = validationResult.errorCode ?? "INVALID_PAYLOAD";
        return {
          success: false,
          code: errorCode,
          error: `Invalid placements: ${errorCode}`,
        };
      }

      const normalizedPlacements = validationResult.normalized;

      // 配置上限チェック（8枠）
      if (normalizedPlacements.length > 8) {
        return { success: false, code: "TOO_MANY_UNITS", error: "Too many units (max 8)" };
      }

      // 配置を適用
      this.setBoardPlacementsForPlayer(playerId, normalizedPlacements);
      this.boardUnitCountByPlayer.set(playerId, normalizedPlacements.length);

      // 副作用（シナジー計算等）はgetPlayerStatus()で自動的に行われる

      return { success: true, code: "SUCCESS" };
    } catch (error) {
      console.error(`[MatchRoomController] applyPrepPlacementForPlayer failed for ${playerId}:`, error);
      return {
        success: false,
        code: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public get rankingTopToBottom(): string[] {
    return this.playerStateQuery.getRankingTopToBottom();
  }

  public get roundPairings(): BattlePairing[] {
    return this.playerStateQuery.getRoundPairings();
  }

  public setReady(playerId: string, ready: boolean): void {
    this.ensureKnownPlayer(playerId);

    if (ready) {
      this.readyPlayers.add(playerId);
      return;
    }

    this.readyPlayers.delete(playerId);
  }

  public selectHero(playerId: string, heroId: string): void {
    this.ensureKnownPlayer(playerId);

    if (!HEROES.some((hero) => hero.id === heroId)) {
      throw new Error(`Unknown hero: ${heroId}`);
    }

    this.selectedHeroByPlayer.set(playerId, heroId);
  }

  public getSelectedHero(playerId: string): string {
    return this.playerStateQuery.getSelectedHero(playerId);
  }

  public getSelectedBoss(playerId: string): string {
    return this.playerStateQuery.getSelectedBoss(playerId);
  }

  public getHeroPlacementForPlayer(playerId: string): number | null {
    return this.playerStateQuery.getHeroPlacementForPlayer(playerId);
  }

  public getBossPlacementForPlayer(playerId: string): number | null {
    return this.playerStateQuery.getBossPlacementForPlayer(playerId);
  }

  public applyHeroPlacementForPlayer(
    playerId: string,
    cellIndex: number,
  ): { success: boolean; code: string; error?: string } {
    try {
      this.ensureKnownPlayer(playerId);

      if (!this.gameLoopState || this.gameLoopState.phase !== "Prep") {
        return { success: false, code: "PHASE_MISMATCH", error: "Not in Prep phase" };
      }

      if (!this.selectedHeroByPlayer.get(playerId)) {
        return { success: false, code: "INVALID_PAYLOAD", error: "Hero not selected" };
      }

      if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= DEFAULT_SHARED_BOARD_CONFIG.width * DEFAULT_SHARED_BOARD_CONFIG.height) {
        return { success: false, code: "INVALID_CELL", error: "Hero cell out of range" };
      }

      const row = Math.floor(cellIndex / DEFAULT_SHARED_BOARD_CONFIG.width);
      if (row < Math.floor(DEFAULT_SHARED_BOARD_CONFIG.height / 2)) {
        return { success: false, code: "INVALID_CELL", error: "Hero must stay in raid deployment rows" };
      }

      const selectedHeroId = this.selectedHeroByPlayer.get(playerId) ?? "";
      const ownBoardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
      const occupiedOwnPlacement = ownBoardPlacements.some((placement) => placement.cell === cellIndex);

      if (occupiedOwnPlacement) {
        if (!this.enableSubUnitSystem || selectedHeroId !== "okina") {
          return { success: false, code: "INVALID_CELL", error: "Hero cannot enter occupied sub slot" };
        }

        this.heroPlacementByPlayer.set(playerId, -1);
        this.heroSubHostCellByPlayer.set(playerId, cellIndex);
        return { success: true, code: "SUCCESS" };
      }

      if (this.isBoardCellOccupiedByStandardPlacement(cellIndex)) {
        return { success: false, code: "INVALID_CELL", error: "Hero cell already occupied by board unit" };
      }

      this.heroSubHostCellByPlayer.set(playerId, -1);
      this.heroPlacementByPlayer.set(playerId, cellIndex);
      return { success: true, code: "SUCCESS" };
    } catch (error) {
      return {
        success: false,
        code: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public applyBossPlacementForPlayer(
    playerId: string,
    cellIndex: number,
  ): { success: boolean; code: string; error?: string } {
    try {
      this.ensureKnownPlayer(playerId);

      if (!this.gameLoopState || this.gameLoopState.phase !== "Prep") {
        return { success: false, code: "PHASE_MISMATCH", error: "Not in Prep phase" };
      }

      if (!this.selectedBossByPlayer.get(playerId)) {
        return { success: false, code: "INVALID_PAYLOAD", error: "Boss not selected" };
      }

      if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= DEFAULT_SHARED_BOARD_CONFIG.width * DEFAULT_SHARED_BOARD_CONFIG.height) {
        return { success: false, code: "INVALID_CELL", error: "Boss cell out of range" };
      }

      const row = Math.floor(cellIndex / DEFAULT_SHARED_BOARD_CONFIG.width);
      if (row >= Math.floor(DEFAULT_SHARED_BOARD_CONFIG.height / 2)) {
        return { success: false, code: "INVALID_CELL", error: "Boss must stay in boss deployment rows" };
      }

      if (this.isBoardCellOccupiedByStandardPlacement(cellIndex)) {
        return { success: false, code: "INVALID_CELL", error: "Boss cell already occupied by board unit" };
      }

      this.bossPlacementByPlayer.set(playerId, cellIndex);
      return { success: true, code: "SUCCESS" };
    } catch (error) {
      return {
        success: false,
        code: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public startIfReady(nowMs: number, connectedPlayerIds: string[] = this.playerIds): boolean {
    if (this.gameLoopState) {
      return false;
    }

    const activePlayerIds = this.playerIds.filter((id) => connectedPlayerIds.includes(id));
    const readyActivePlayers = this.playerIds.filter(
      (id) => this.readyPlayers.has(id) && connectedPlayerIds.includes(id),
    );
    const allReady = readyActivePlayers.length === activePlayerIds.length;
    const autoStartReached = nowMs >= this.readyDeadlineAtMs;

    if (!allReady && !autoStartReached) {
      return false;
    }

    if (activePlayerIds.length < 2) {
      return false;
    }

    this.startMatch(nowMs, activePlayerIds);
    return true;
  }

  public startWithResolvedRoles(
    nowMs: number,
    connectedPlayerIds: string[],
    resolvedRoles: {
      bossPlayerId: string;
      selectedHeroByPlayer: Map<string, string>;
      selectedBossByPlayer: Map<string, string>;
    },
  ): boolean {
    if (this.gameLoopState || !this.enableBossExclusiveShop) {
      return false;
    }

    const activePlayerIds = this.playerIds.filter((id) => connectedPlayerIds.includes(id));
    if (activePlayerIds.length < 2 || !activePlayerIds.includes(resolvedRoles.bossPlayerId)) {
      return false;
    }

    const raidPlayerIds = activePlayerIds.filter((playerId) => playerId !== resolvedRoles.bossPlayerId);
    const bossId = resolvedRoles.selectedBossByPlayer.get(resolvedRoles.bossPlayerId) ?? "";
    if (!isBossCharacterId(bossId)) {
      return false;
    }

    if (this.enableHeroSystem) {
      for (const raidPlayerId of raidPlayerIds) {
        const heroId = resolvedRoles.selectedHeroByPlayer.get(raidPlayerId) ?? "";
        if (!HEROES.some((hero) => hero.id === heroId)) {
          return false;
        }
      }
    }

    for (const playerId of activePlayerIds) {
      const isBossPlayer = playerId === resolvedRoles.bossPlayerId;
      this.wantsBossByPlayer.set(playerId, isBossPlayer);
      this.roleByPlayer.set(playerId, isBossPlayer ? "boss" : "raid");
      this.selectedBossByPlayer.set(playerId, isBossPlayer ? bossId : "");
      this.bossPlacementByPlayer.set(playerId, -1);
      this.heroSubHostCellByPlayer.set(playerId, -1);
      this.selectedHeroByPlayer.set(
        playerId,
        isBossPlayer || !this.enableHeroSystem
          ? ""
          : resolvedRoles.selectedHeroByPlayer.get(playerId) ?? "",
      );
    }

    for (const playerId of this.playerIds) {
      if (activePlayerIds.includes(playerId)) {
        continue;
      }

      this.wantsBossByPlayer.set(playerId, false);
      this.roleByPlayer.set(playerId, "unassigned");
      this.selectedBossByPlayer.set(playerId, "");
      this.bossPlacementByPlayer.set(playerId, -1);
      this.heroSubHostCellByPlayer.set(playerId, -1);
      this.selectedHeroByPlayer.set(playerId, "");
    }

    this.startMatch(nowMs, activePlayerIds, resolvedRoles.bossPlayerId);
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
    // boardPlacementsByPlayerはリセットしない（Bug #2修正）
  }

  public getPlayerHp(playerId: string): number {
    return this.playerStateQuery.getPlayerHp(playerId);
  }

  public getShopOffersForPlayer(playerId: string): ShopOffer[] {
    return this.playerStateQuery.getShopOffersForPlayer(playerId);
  }

  /**
   * ボス専用ショップのオファーを取得
   * @param playerId プレイヤーID
   * @returns ボスショップオファー、ボスでない場合は空配列
   */
  public getBossShopOffersForPlayer(playerId: string): ShopOffer[] {
    return this.playerStateQuery.getBossShopOffersForPlayer(playerId);
  }

  /**
   * マッチロガーを設定
   * @param logger MatchLoggerインスタンス
   */
  public setMatchLogger(logger: MatchLogger | null): void {
    this.matchLogger = logger;
    // 抽出したサービスにもロガーを伝播（Bug: コンストラクタ後にロガーが設定される場合の対応）
    this.battleResolutionService.setMatchLogger(logger);
    this.spellCardHandler.setMatchLogger(logger);
  }

  /**
   * 指定プレイヤーがボスかどうか
   * @param playerId プレイヤーID
   * @returns ボスの場合true
   */
  public isBossPlayer(playerId: string): boolean {
    return this.playerStateQuery.isBossPlayer(playerId);
  }

  /**
   * ボスプレイヤーIDを取得
   * @returns ボスプレイヤーID、未設定の場合はnull
   */
  public getBossPlayerId(): string | null {
    return this.playerStateQuery.getBossPlayerId();
  }

  public getRaidPlayerIds(): string[] {
    return this.playerStateQuery.getRaidPlayerIds();
  }

  /**
   * 支配カウントを取得
   * @returns 支配カウント
   */
  public getDominationCount(): number {
    return this.playerStateQuery.getDominationCount();
  }

  /**
   * 全プレイヤーIDを取得
   * @returns プレイヤーID配列
   */
  public getPlayerIds(): string[] {
    return this.playerStateQuery.getPlayerIds();
  }

  /**
   * 指定プレイヤーの盤面配置を取得
   * @param playerId プレイヤーID
   * @returns 盤面配置配列
   */
  public getBoardPlacementsForPlayer(playerId: string): BoardUnitPlacement[] {
    return this.playerStateQuery.getBoardPlacementsForPlayer(playerId);
  }

  /**
   * 指定プレイヤーのベンチユニットを取得
   * @param playerId プレイヤーID
   * @returns ベンチユニット配列
   */
  public getBenchUnitsForPlayer(playerId: string): Array<{ unitType: string; starLevel: number }> {
    return this.playerStateQuery.getBenchUnitsForPlayer(playerId);
  }

  public getBenchUnitDetailsForPlayer(playerId: string): Array<{
    unitType: "vanguard" | "ranger" | "mage" | "assassin";
    unitId?: string;
    cost: number;
    starLevel: number;
    unitCount: number;
  }> {
    this.ensureKnownPlayer(playerId);

    return (this.benchUnitsByPlayer.get(playerId) ?? []).map((unit) => ({
      ...unit,
    }));
  }

  public getPlayerStatus(playerId: string): ControllerPlayerStatus {
    return this.playerStateQuery.getPlayerStatus(playerId);
  }

  public getSharedBattleReplay(phase: "Battle" | "Settle"): SharedBattleReplayMessage | null {
    return this.playerStateQuery.getSharedBattleReplay(phase);
  }

  public getPhaseProgress(): {
    targetHp: number;
    damageDealt: number;
    result: PhaseProgressSnapshot["result"];
    completionRate: number;
  } {
    return this.playerStateQuery.getPhaseProgress();
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

  public setPendingPhaseDamageForTest(damageValue: number): void {
    if (!Number.isFinite(damageValue) || damageValue <= 0) {
      this.pendingPhaseDamageForTest = null;
      return;
    }

    this.pendingPhaseDamageForTest = Math.floor(damageValue);
  }

  public getTestAccess(): MatchRoomControllerTestAccess {
    return {
      battleResultsByPlayer: this.battleResultsByPlayer,
      battleResolutionService: this.battleResolutionService,
      spellCardHandler: this.spellCardHandler,
      gameLoopState: this.gameLoopState,
      boardPlacementsByPlayer: this.boardPlacementsByPlayer,
      battleInputSnapshotByPlayer: this.battleInputSnapshotByPlayer,
    };
  }

  private isRaidMode(): boolean {
    return this.enableBossExclusiveShop && this.gameLoopState?.bossPlayerId !== null;
  }

  public advanceByTime(nowMs: number): boolean {
    return this.phaseOrchestrator.advanceByTime(nowMs);
  }

  private resetFinalRoundShields(): void {
    this.finalRoundShieldByPlayer.clear();
    for (const playerId of this.playerIds) {
      this.finalRoundShieldByPlayer.set(playerId, 0);
    }
  }

  private getDisplayedFinalRoundShield(playerId: string): number {
    const state = this.gameLoopState;
    if (!state || !this.isRaidMode() || state.bossPlayerId === playerId) {
      return 0;
    }

    if (state.roundIndex === 12 && state.phase === "Prep") {
      return state.getRemainingLives(playerId);
    }

    return this.finalRoundShieldByPlayer.get(playerId) ?? 0;
  }

  private activateFinalRoundShields(): void {
    const state = this.ensureStarted();

    if (!this.isRaidMode() || state.roundIndex !== 12) {
      this.resetFinalRoundShields();
      return;
    }

    for (const playerId of state.playerIds) {
      const nextShield = playerId === state.bossPlayerId ? 0 : state.getRemainingLives(playerId);
      this.finalRoundShieldByPlayer.set(playerId, nextShield);
    }
  }

  private applyRaidRoundConsequences(): void {
    if (!this.isRaidMode()) {
      return;
    }

    const state = this.ensureStarted();

    if (state.roundIndex !== 12) {
      this.battleOrchestrator.applyRaidRoundConsequences();
      return;
    }

    for (const playerId of state.raidPlayerIds) {
      const battleResult = this.battleResultsByPlayer.get(playerId);
      if (battleResult === undefined || battleResult.survivors > 0) {
        continue;
      }

      const currentShield = this.finalRoundShieldByPlayer.get(playerId) ?? 0;
      const nextShield = Math.max(0, currentShield - 1);
      this.finalRoundShieldByPlayer.set(playerId, nextShield);

      if (nextShield <= 0) {
        state.consumeLife(playerId, state.getRemainingLives(playerId));
      }
    }
  }

  private resetForNextPrepRound(): void {
    this.resetBoardForPurchasePhase();
    this.pendingRoundDamageByPlayer.clear();
    this.pendingPhaseDamageForTest = null;
    this.resetFinalRoundShields();
    this.applyRaidRecoveryAndRevival();
    this.applyPrepIncome();
    this.logRumorInfluenceWithAlivePlayersAfterElimination();
    this.refreshShopsForPrep();
    this.hpAtBattleStartByPlayer = new Map<string, number>();
    this.hpAfterBattleByPlayer = new Map<string, number>();
    this.battleParticipantIds = [];
    this.currentRoundPairings = [];
    this.battleInputSnapshotByPlayer.clear();
  }

  private resetBoardForPurchasePhase(): void {
    const state = this.ensureStarted();

    for (const playerId of state.playerIds) {
      const boardPlacements = [...(this.boardPlacementsByPlayer.get(playerId) ?? [])];
      for (const placement of boardPlacements) {
        this.returnBoardUnitToBench(playerId, placement.cell);
      }
    }
  }

  private applyRaidRecoveryAndRevival(): void {
    const state = this.ensureStarted();

    if (!this.isRaidMode() || state.roundIndex !== this.raidRecoveryRoundIndex) {
      return;
    }

    for (const playerId of state.raidPlayerIds) {
      const wasEliminated = state.isPlayerEliminated(playerId);
      const hadNoLives = state.getRemainingLives(playerId) <= 0;

      if (wasEliminated) {
        state.revivePlayer(playerId, 1);
      } else {
        state.addLife(playerId, 1);
      }

      if (wasEliminated || hadNoLives) {
        this.restoreRevivedRaidPlayerBoardState(playerId);
      }
    }

    this.removeRaidPlayersFromEliminationRanking(state.raidPlayerIds);
    this.ensureInitialHeroPlacements(state.playerIds);
  }

  private restoreRevivedRaidPlayerBoardState(playerId: string): void {
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const nextBenchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];

    for (const placement of boardPlacements) {
      nextBenchUnits.push({
        unitType: placement.unitType,
        cost: placement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[placement.unitType] ?? 1,
        starLevel: placement.starLevel ?? 1,
        unitCount: placement.unitCount ?? 1,
        ...(placement.unitId !== undefined ? { unitId: placement.unitId } : {}),
      });
    }

    this.boardPlacementsByPlayer.set(playerId, []);
    this.heroSubHostCellByPlayer.set(playerId, -1);
    this.benchUnitsByPlayer.set(playerId, nextBenchUnits);
  }

  private removeRaidPlayersFromEliminationRanking(raidPlayerIds: readonly string[]): void {
    const revivedRaidIds = new Set(raidPlayerIds);
    const remainingRanking = this.eliminatedFromBottom.filter((playerId) => !revivedRaidIds.has(playerId));

    this.eliminatedFromBottom.length = 0;
    this.eliminatedFromBottom.push(...remainingRanking);
  }

  public submitPrepCommand(
    playerId: string,
    cmdSeq: number,
    receivedAtMs: number,
    commandPayload?: CommandPayload,
  ): CommandResult {
    const payload = commandPayload ?? {};
    const validationDeps = this.createPrepValidationDependencies();

    // Step 1: Validate the command
    const validationInternalResult: ValidationInternalResult = {};
    const validationError = validatePrepCommand(
      playerId,
      cmdSeq,
      receivedAtMs,
      payload,
      validationDeps,
      validationInternalResult,
    );

    // W6-2 KPI: バリデーション境界で拒否された場合は失敗を記録
    if (validationError) {
      if (validationInternalResult.rejectReason !== "SERVER_INVARIANT_BREACH") {
        // validationErrorはバリデーション失敗時のみ返されるため、必ずaccepted: false
        this.matchLogger?.recordPrepValidationFailure({
          errorCode: (validationError as { accepted: false; code: string }).code,
        });
      }

      return validationError;
    }

    this.matchLogger?.recordPrepValidationPass();

    // Step 2: Execute the command
    const result = executePrepCommand(
      playerId,
      cmdSeq,
      payload,
      this.createPrepExecutionDependencies(),
    );

    // W6-2 KPI: バリデーション通過後、実行が完了したら成功を記録
    // Note: executePrepCommandが返る = 実行成功（実行内で例外が発生した場合は別のエラーハンドリング）
    this.matchLogger?.recordPrepExecutionSuccess();

    return result;
  }

  private createPrepValidationDependencies(): ValidationDependencies {
    return {
      isKnownPlayer: (id) => this.lastCmdSeqByPlayer.has(id),
      isGameStarted: () => this.gameLoopState !== null,
      getCurrentPhase: () => this.gameLoopState?.phase ?? "Waiting",
      getLastCmdSeq: (id) => this.lastCmdSeqByPlayer.get(id) ?? 0,
      getGold: (id) => this.goldByPlayer.get(id) ?? INITIAL_GOLD,
      getShopOffers: (id) => this.shopOffersByPlayer.get(id) ?? [],
      getBenchUnits: (id) => this.benchUnitsByPlayer.get(id) ?? [],
      getBoardPlacements: (id) => this.boardPlacementsByPlayer.get(id) ?? [],
      getBoardUnitCount: (id) => this.resolveUnitCount(id),
      getBossShopOffers: (id) => this.bossShopOffersByPlayer.get(id) ?? [],
      getShopRefreshGoldCost: (id, count) => this.getShopRefreshGoldCost(id, count),
      isBossPlayer: (id) => this.isBossPlayer(id),
      isSubUnitSystemEnabled: () => this.enableSubUnitSystem,
      isSharedPoolEnabled: () => this.enableSharedPool,
      isPoolDepleted: (cost, unitId) => {
        if (this.rosterFlags.enablePerUnitSharedPool && unitId) {
          return this.sharedPool?.isDepletedByUnitId(unitId, cost) ?? false;
        }

        return this.sharedPool?.isDepleted(cost) ?? false;
      },
      getPrepDeadlineAtMs: () => this.prepDeadlineAtMs,
      getRosterFlags: () => this.rosterFlags,
      getReservedBoardCells: () => this.getReservedSpecialBoardCells(),
    };
  }

  private createPrepExecutionDependencies(): ExecutionDependencies {
    return {
      setBoardUnitCount: (id, count) => this.boardUnitCountByPlayer.set(id, count),
      setBoardPlacements: (id, placements) => this.setBoardPlacementsForPlayer(id, placements),
      setShopLock: (id, locked) => this.shopLockedByPlayer.set(id, locked),
      setLastCmdSeq: (id, seq) => this.lastCmdSeqByPlayer.set(id, seq),
      addGold: (id, amount) => {
        const current = this.goldByPlayer.get(id) ?? INITIAL_GOLD;
        this.goldByPlayer.set(id, current + amount);
      },
      addXp: (id, amount) => this.addXp(id, amount),
      getShopRefreshGoldCost: (id, count) => this.getShopRefreshGoldCost(id, count),
      refreshShop: (id, count) => this.refreshShopByCount(id, count),
      buyShopOffer: (id, slotIndex) => this.buyShopOfferBySlot(id, slotIndex),
      deployBenchUnitToBoard: (id, benchIndex, cell, slot) =>
        this.deployBenchUnitToBoard(id, benchIndex, cell, slot),
      returnBoardUnitToBench: (id, cell) => this.returnBoardUnitToBench(id, cell),
      sellBenchUnit: (id, benchIndex) => this.sellBenchUnit(id, benchIndex),
      sellBoardUnit: (id, cell) => this.sellBoardUnit(id, cell),
      buyBossShopOffer: (id, slotIndex) => this.buyBossShopOffer(id, slotIndex),
      getBenchUnits: (id) => this.benchUnitsByPlayer.get(id) ?? [],
      getOwnedUnits: (id) => this.ownedUnitsByPlayer.get(id) ?? { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
      getBoardPlacements: (id) => this.boardPlacementsByPlayer.get(id) ?? [],
      getShopOffers: (id) => this.shopOffersByPlayer.get(id) ?? [],
      getBossShopOffers: (id) => this.bossShopOffersByPlayer.get(id) ?? [],
      getRosterFlags: () => this.rosterFlags,
      logBossShop: (id, offers, purchase) => this.logBossShopPurchase(id, offers, purchase),
    };
  }

  private buyBossShopOffer(playerId: string, slotIndex: number): void {
    this.shopManager.buyBossShopOffer(playerId, slotIndex);
  }

  private logBossShopPurchase(
    playerId: string,
    offers: Array<{ unitType: string; cost: number; isRumorUnit?: boolean }>,
    purchase: { slotIndex: number; unitType: string; cost: number },
  ): void {
    const state = this.ensureStarted();
    this.matchLogger?.logBossShop(
      state.roundIndex,
      playerId,
      offers,
      purchase,
    );
  }

  private applyPrepIncome(): void {
    const state = this.ensureStarted();
    applyPrepIncomeToPlayers({
      alivePlayerIds: state.alivePlayerIds,
      goldByPlayer: this.goldByPlayer,
      getBaseIncome: (playerId) => state.isBoss(playerId) ? BOSS_PREP_BASE_INCOME : RAID_PREP_BASE_INCOME,
      initialGold: INITIAL_GOLD,
    });
  }

  private addXp(playerId: string, gainedXp: number): void {
    let currentXp = (this.xpByPlayer.get(playerId) ?? INITIAL_XP) + gainedXp;
    let currentLevel = this.levelByPlayer.get(playerId) ?? INITIAL_LEVEL;

    while (currentLevel < MAX_LEVEL) {
      const levelCost = XP_COSTS_BY_LEVEL[currentLevel];

      if (levelCost === undefined || currentXp < levelCost) {
        break;
      }

      currentXp -= levelCost;
      currentLevel += 1;
    }

    this.xpByPlayer.set(playerId, currentXp);
    this.levelByPlayer.set(playerId, currentLevel);
  }

  private initializeShopsForPrep(): void {
    this.shopManager.initializeShopsForPrep();
  }

  private refreshShopsForPrep(): void {
    this.shopManager.refreshShopsForPrep();
  }

  private refreshShopByCount(playerId: string, refreshCount: number): void {
    this.shopManager.refreshShopByCount(playerId, refreshCount);
  }

  private buyShopOfferBySlot(playerId: string, slotIndex: number): void {
    this.shopManager.buyShopOfferBySlot(playerId, slotIndex);
  }

  private deployBenchUnitToBoard(
    playerId: string,
    benchIndex: number,
    cell: number,
    slot: "main" | "sub" = "main",
  ): void {
    this.shopManager.deployBenchUnitToBoard(playerId, benchIndex, cell, slot);
  }

  private returnBoardUnitToBench(playerId: string, cell: number): void {
    const heroSubHostCell = this.getHeroSubHostCellForPlayer(playerId);
    this.shopManager.returnBoardUnitToBench(playerId, cell);

    const hostStillExists = (this.boardPlacementsByPlayer.get(playerId) ?? []).some(
      (placement) => placement.cell === cell,
    );
    if (heroSubHostCell === cell && !hostStillExists) {
      this.heroSubHostCellByPlayer.set(playerId, -1);
      this.heroPlacementByPlayer.set(playerId, cell);
    }
  }

  private sellBenchUnit(playerId: string, benchIndex: number): void {
    this.shopManager.sellBenchUnit(playerId, benchIndex);
  }

  private sellBoardUnit(playerId: string, cell: number): void {
    this.shopManager.sellBoardUnit(playerId, cell);
  }

  private resolveBenchUnitDisplayName(benchUnit: BenchUnit): string {
    if (!benchUnit.unitId) {
      return "";
    }

    return getActiveRosterUnitById(this.rosterFlags, benchUnit.unitId)?.name ?? "";
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

  public removePlayer(playerId: string): void {
    this.shopManager.releasePlayerInventoryToSharedPool(playerId);

    this.playerIds = this.playerIds.filter((id) => id !== playerId);
    this.readyPlayers.delete(playerId);
    this.lastCmdSeqByPlayer.delete(playerId);
    this.boardUnitCountByPlayer.delete(playerId);
    this.boardPlacementsByPlayer.delete(playerId);
    this.goldByPlayer.delete(playerId);
    this.xpByPlayer.delete(playerId);
    this.levelByPlayer.delete(playerId);
    this.shopOffersByPlayer.delete(playerId);
    this.shopRefreshCountByPlayer.delete(playerId);
    this.shopPurchaseCountByPlayer.delete(playerId);
    this.shopLockedByPlayer.delete(playerId);
    this.benchUnitsByPlayer.delete(playerId);
    this.ownedUnitsByPlayer.delete(playerId);
    this.kouRyuudouFreeRefreshConsumedByPlayer.delete(playerId);
    this.selectedHeroByPlayer.delete(playerId);
    this.heroPlacementByPlayer.delete(playerId);
    this.heroSubHostCellByPlayer.delete(playerId);
    this.selectedBossByPlayer.delete(playerId);
    this.bossPlacementByPlayer.delete(playerId);
    this.wantsBossByPlayer.delete(playerId);
    this.roleByPlayer.delete(playerId);
    this.finalRoundShieldByPlayer.delete(playerId);
    this.battleResultsByPlayer.delete(playerId);
    this.pendingRoundDamageByPlayer.delete(playerId);
    this.hpAtBattleStartByPlayer.delete(playerId);
    this.hpAfterBattleByPlayer.delete(playerId);
  }

  private startMatch(nowMs: number, activePlayerIds: string[], bossPlayerId?: string): void {
    this.gameLoopState = new GameLoopState(activePlayerIds, {
      raidRecoveryRoundIndex: this.raidRecoveryRoundIndex,
    });
    this.resetFinalRoundShields();

    if (this.enableBossExclusiveShop) {
      if (bossPlayerId) {
        this.gameLoopState.setBossPlayer(bossPlayerId);
      } else {
        this.gameLoopState.setRandomBoss();
      }
    }

    this.matchLogger?.logRoundTransition("Prep", this.gameLoopState.roundIndex, nowMs);
    this.ensureInitialHeroPlacements(activePlayerIds);
    this.ensureInitialBossPlacements(activePlayerIds);

    this.initializeShopsForPrep();
    this.phaseOrchestrator.startPrepRound(nowMs);
  }

  private getShopRefreshGoldCost(playerId: string, refreshCount: number): number {
    return this.shopManager.getShopRefreshGoldCost(playerId, refreshCount);
  }

  private calculateActiveSynergies(
    placements: BoardUnitPlacement[],
    heroSynergyBonusType: BoardUnitType | null = null,
    playerId?: string,
  ): ActiveSynergy[] {
    const activeSynergies = calculateActiveSynergyList(
      placements,
      heroSynergyBonusType,
      this.rosterFlags,
    );

    this.logActiveSynergyActivations(playerId, activeSynergies);
    return activeSynergies;
  }

  private logActiveSynergyActivations(
    playerId: string | undefined,
    activeSynergies: ActiveSynergy[],
  ): void {
    if (!playerId || !this.matchLogger) {
      return;
    }

    const state = this.gameLoopState;
    if (!state) {
      return;
    }

    for (const synergy of activeSynergies) {
      if (synergy.tier <= 0) {
        continue;
      }

      this.matchLogger.logSynergyActivation(
        state.roundIndex,
        playerId,
        synergy.unitType,
        synergy.count,
        [{ type: "tier", value: synergy.tier }],
      );
    }
  }

  private resolveHeroSynergyBonusType(playerId: string): BoardUnitType | null {
    const selectedHeroId = this.selectedHeroByPlayer.get(playerId);

    if (!selectedHeroId) {
      return null;
    }

    const selectedHero = HEROES.find((hero) => hero.id === selectedHeroId);
    return selectedHero?.synergyBonusType ?? null;
  }

  private captureBattleStartHp(): void {
    const state = this.ensureStarted();
    const snapshot = new Map<string, number>();
    const battleParticipants = [...state.alivePlayerIds];

    for (const playerId of battleParticipants) {
      snapshot.set(playerId, state.getPlayerHp(playerId));
    }

    this.battleParticipantIds = battleParticipants;
    this.currentRoundPairings = this.battleOrchestrator.buildPairingsForRound(
      battleParticipants,
      state.roundIndex,
    );
    this.hpAtBattleStartByPlayer = snapshot;
  }

  private buildRaidBattleInput(
    leftPlayerId: string,
    rightPlayerId: string,
  ): RaidBattleInput | null {
    const state = this.ensureStarted();
    const bossPlayerId = state.bossPlayerId;

    if (!bossPlayerId || (leftPlayerId !== bossPlayerId && rightPlayerId !== bossPlayerId)) {
      return null;
    }

    const raidPlayerIds = state.raidPlayerIds.filter((playerId) =>
      this.battleInputSnapshotByPlayer.has(playerId),
    );
    if (raidPlayerIds.length === 0) {
      return null;
    }

    const bossPlacements = (this.battleInputSnapshotByPlayer.get(bossPlayerId) ?? []).map(
      (placement) => ({
        ...placement,
      }),
    );
    const raidPlacements = raidPlayerIds.flatMap((playerId) =>
      (this.battleInputSnapshotByPlayer.get(playerId) ?? []).map((placement) => ({ ...placement })),
    );
    const bossIsLeft = leftPlayerId === bossPlayerId;

    return {
      bossPlayerId,
      raidPlayerIds,
      bossIsLeft,
      leftPlayerIds: bossIsLeft ? [bossPlayerId] : raidPlayerIds,
      rightPlayerIds: bossIsLeft ? raidPlayerIds : [bossPlayerId],
      leftPlacements: bossIsLeft ? bossPlacements : raidPlacements,
      rightPlacements: bossIsLeft ? raidPlacements : bossPlacements,
    };
  }

  private buildSideSpellModifiers(playerIds: string[]): SpellCombatModifiers | null {
    let aggregatedModifiers: SpellCombatModifiers | null = null;

    for (const playerId of playerIds) {
      const modifiers = this.spellCardHandler.getCombatModifiersForPlayer(playerId);
      if (!modifiers) {
        continue;
      }

      aggregatedModifiers ??= {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      };
      aggregatedModifiers.attackMultiplier *= modifiers.attackMultiplier;
      aggregatedModifiers.defenseMultiplier *= modifiers.defenseMultiplier;
      aggregatedModifiers.attackSpeedMultiplier *= modifiers.attackSpeedMultiplier;
    }

    return aggregatedModifiers;
  }

  private buildSideHeroIds(playerIds: string[]): string[] {
    return playerIds
      .map((playerId) => this.selectedHeroByPlayer.get(playerId) ?? "")
      .filter((heroId): heroId is string => heroId !== "");
  }

  private buildSideHeroSynergyBonusTypes(playerIds: string[]): BoardUnitType[] {
    return this.buildSideHeroIds(playerIds)
      .map((heroId) => this.battleResolutionService.getHeroSynergyBonusType(heroId))
      .filter((bonusType): bonusType is BoardUnitType => bonusType !== null);
  }

  private capturePostBattleHp(): void {
    const state = this.ensureStarted();
    const snapshot = new Map<string, number>();

    for (const playerId of state.playerIds) {
      snapshot.set(playerId, state.getPlayerHp(playerId));
    }

    this.hpAfterBattleByPlayer = snapshot;
  }

  private captureBattleInputSnapshot(): void {
    const state = this.ensureStarted();

    this.battleInputSnapshotByPlayer.clear();

    for (const playerId of state.alivePlayerIds) {
      const placements = this.boardPlacementsByPlayer.get(playerId) ?? [];
      this.battleInputSnapshotByPlayer.set(
        playerId,
        placements.map((placement) => ({ ...placement })),
      );
    }
  }

  private applyPendingRoundDamage(): void {
    const state = this.ensureStarted();
    const roundIndex = state.roundIndex;

    if (this.isRaidMode()) {
      this.pendingRoundDamageByPlayer.clear();
      return;
    }

    for (const [playerId, damageValue] of this.pendingRoundDamageByPlayer.entries()) {
      const currentHp = state.getPlayerHp(playerId);
      const hpBefore = currentHp;
      const hpAfter = currentHp - damageValue;
      state.setPlayerHp(playerId, hpAfter);
      // HP変化ログを記録
      this.matchLogger?.logHpChange(roundIndex, playerId, hpBefore, hpAfter, 'battle');
    }

    this.pendingRoundDamageByPlayer.clear();
  }

  private capturePhaseProgressFromPendingDamage(): void {
    const state = this.ensureStarted();
    const totalDamage = this.pendingPhaseDamageForTest
      ?? (this.isRaidMode()
        ? this.pendingRoundDamageByPlayer.get(state.bossPlayerId ?? "") ?? 0
        : Array.from(this.pendingRoundDamageByPlayer.values()).reduce(
          (sum, damageValue) => sum + damageValue,
          0,
        ));
    this.pendingPhaseDamageForTest = null;
    const phaseProgress = this.phaseOrchestrator.recordPhaseProgress(state.roundIndex, totalDamage);

    this.applyRaidPhaseSuccessBonus(phaseProgress.result);

    // 支配カウント: ボス優勢（フェーズ失敗）時にカウントアップ（R12以外）
    if (phaseProgress.result === "failed" && state.roundIndex < 12) {
      state.dominationCount += 1;
    }

    const nextRoundRumorUnit = getRumorUnitForRound(state.roundIndex + 1);
    const guaranteedRumorSlotApplied =
      this.enableRumorInfluence &&
      phaseProgress.result === "success" &&
      nextRoundRumorUnit !== null;
    const rumorFactions = guaranteedRumorSlotApplied && nextRoundRumorUnit
      ? [nextRoundRumorUnit.unitType]
      : [];

    // 噂勢力eligibleを付与されたプレイヤーID一覧（ボス以外）は
    // elimination 解決後に計算するため、ここではログ出力しない
    // logRumorInfluence は logRumorInfluenceWithAlivePlayersAfterElimination で呼び出す

    // 噂勢力のメタ情報を一時保存（elimination 後に使用）
    this.pendingRumorInfluence = {
      roundIndex: state.roundIndex,
      rumorFactions,
      guaranteedRumorSlotApplied,
    };

    // 噂勢力: フェーズ成功時、全レイドプレイヤーを次ラウンド eligible に設定
    // 注意: この時点では elimination 解決前なので、elimination されるプレイヤーも含まれる
    // 実際の eligibility は elimination 解決後に適用される
    if (this.enableRumorInfluence && phaseProgress.result === "success") {
      const bossPlayerId = state.bossPlayerId;
      for (const playerId of state.alivePlayerIds) {
        // ボス以外（レイド側）全員が対象
        if (playerId !== bossPlayerId) {
          this.rumorInfluenceEligibleByPlayer.set(playerId, true);
        }
      }
    }
  }

  private applyRaidPhaseSuccessBonus(phaseResult: "pending" | "success" | "failed"): void {
    const state = this.ensureStarted();

    if (!this.isRaidMode() || state.roundIndex >= 12 || phaseResult !== "success") {
      return;
    }

    for (const playerId of state.alivePlayerIds) {
      if (playerId === state.bossPlayerId) {
        continue;
      }

      const currentGold = this.goldByPlayer.get(playerId) ?? INITIAL_GOLD;
      this.goldByPlayer.set(playerId, currentGold + RAID_PHASE_SUCCESS_BONUS);
    }
  }

  /**
   * Elimination 解決後に呼び出し、正しい grantedPlayerIds で噂勢力ログを記録する
   * elimination 解決後の alivePlayerIds を使用することで、脱落プレイヤーを除外する
   */
  private logRumorInfluenceWithAlivePlayersAfterElimination(): void {
    if (!this.pendingRumorInfluence || !this.matchLogger) {
      return;
    }

    const state = this.ensureStarted();
    const { roundIndex, rumorFactions, guaranteedRumorSlotApplied } = this.pendingRumorInfluence;

    // elimination 解決後の alivePlayerIds を使用
    const grantedPlayerIds: string[] = [];
    if (this.enableRumorInfluence && guaranteedRumorSlotApplied) {
      const bossPlayerId = state.bossPlayerId;
      for (const playerId of state.alivePlayerIds) {
        if (playerId !== bossPlayerId) {
          grantedPlayerIds.push(playerId);
        }
      }
    }

    this.matchLogger.logRumorInfluence(
      roundIndex,
      rumorFactions,
      guaranteedRumorSlotApplied,
      grantedPlayerIds,
    );

    // 一時保存データをクリア
    this.pendingRumorInfluence = null;
  }

  private resolvePhaseHpTarget(roundIndex: number): number {
    if (this.isRaidMode()) {
      return RAID_PHASE_HP_TARGET_BY_ROUND[roundIndex] ?? RAID_PHASE_HP_TARGET_BY_ROUND[12] ?? 3000;
    }

    const phaseTargets = this.featureFlags.enablePhaseExpansion
      ? PHASE_EXPANSION_HP_TARGET_BY_ROUND
      : PHASE_HP_TARGET_BY_ROUND;

    if (roundIndex <= 1) {
      return phaseTargets[1] ?? 400;
    }

    if (phaseTargets[roundIndex] !== undefined) {
      return phaseTargets[roundIndex];
    }

    return phaseTargets[12] ?? 0;
  }

  private resolveMaxRounds(): number {
    return this.enableBossExclusiveShop || this.featureFlags.enablePhaseExpansion ? 12 : 8;
  }

  private resolveMatchupOutcome(leftPlayerId: string, rightPlayerId: string): MatchupOutcome {
    const matchup = this.prepareMatchupContext(leftPlayerId, rightPlayerId);
    const resolutionResult = this.battleResolutionService.resolveMatchup({
      battleId: matchup.battleId,
      roundIndex: this.roundIndex,
      leftPlayerId: matchup.leftPlayerId,
      rightPlayerId: matchup.rightPlayerId,
      leftPlacements: matchup.leftSide.resolvedPlacements,
      rightPlacements: matchup.rightSide.resolvedPlacements,
      leftBattleUnits: matchup.leftSide.battleUnits,
      rightBattleUnits: matchup.rightSide.battleUnits,
      leftHeroSynergyBonusType: matchup.leftSide.heroSynergyBonusTypes,
      rightHeroSynergyBonusType: matchup.rightSide.heroSynergyBonusTypes,
      battleIndex: matchup.battleIndex,
    });

    this.storeBattleResolutionResults(matchup, resolutionResult);
    this.logResolvedBattleResult(matchup, resolutionResult);

    return resolutionResult.outcome;
  }

  private prepareMatchupContext(leftPlayerId: string, rightPlayerId: string): PreparedMatchupContext {
    const matchup = buildPreparedMatchupContext({
      leftPlayerId,
      rightPlayerId,
      roundIndex: this.roundIndex,
      raidBattleInput: this.buildRaidBattleInput(leftPlayerId, rightPlayerId),
      battleInputSnapshotByPlayer: this.battleInputSnapshotByPlayer,
      currentRoundPairings: this.currentRoundPairings,
      rosterFlags: this.rosterFlags,
      buildSpellModifiers: (playerIds) => this.buildSideSpellModifiers(playerIds),
      applySpellModifiers: (battleUnits, modifiers) =>
        this.battleResolutionService.applySpellModifiers(battleUnits, modifiers),
      appendHeroBattleUnits: (playerIds, battleUnits) => {
        const heroIds = this.appendHeroBattleUnits(playerIds, battleUnits);
        this.appendBossBattleUnits(playerIds, battleUnits);
        return heroIds;
      },
      buildHeroSynergyBonusTypes: (playerIds) => this.buildSideHeroSynergyBonusTypes(playerIds),
    });

    this.logBattleInputTrace({
      battleId: matchup.battleId,
      leftPlayerId,
      rightPlayerId,
      leftPlacements: matchup.leftSide.resolvedPlacements,
      rightPlacements: matchup.rightSide.resolvedPlacements,
      leftHeroId: matchup.leftSide.heroIds[0] ?? null,
      rightHeroId: matchup.rightSide.heroIds[0] ?? null,
    });

    return matchup;
  }

  private appendHeroBattleUnits(playerIds: string[], battleUnits: BattleUnit[]): string[] {
    const heroIds = this.buildSideHeroIds(playerIds);

    for (const heroPlayerId of playerIds) {
      const heroId = this.selectedHeroByPlayer.get(heroPlayerId);
      const heroBattleUnit = this.battleResolutionService.createHeroBattleUnit(
        heroId,
        heroPlayerId,
        this.resolveHeroBattleCell(heroPlayerId),
      );
      if (heroBattleUnit) {
        battleUnits.push(heroBattleUnit);
      }
    }

    return heroIds;
  }

  private appendBossBattleUnits(playerIds: string[], battleUnits: BattleUnit[]): void {
    for (const bossPlayerId of playerIds) {
      const bossId = this.selectedBossByPlayer.get(bossPlayerId);
      const bossBattleUnit = this.battleResolutionService.createBossBattleUnit(
        bossId,
        bossPlayerId,
        this.getBossPlacementForPlayer(bossPlayerId) ?? undefined,
      );
      if (bossBattleUnit) {
        battleUnits.push(bossBattleUnit);
      }
    }
  }

  private logBattleInputTrace(params: {
    battleId: string;
    leftPlayerId: string;
    rightPlayerId: string;
    leftPlacements: BoardUnitPlacement[];
    rightPlacements: BoardUnitPlacement[];
    leftHeroId: string | null;
    rightHeroId: string | null;
  }): void {
    const battleTraceLog = this.battleResolutionService.createBattleTraceLog({
      battleId: params.battleId,
      roundIndex: this.roundIndex,
      leftPlayerId: params.leftPlayerId,
      rightPlayerId: params.rightPlayerId,
      leftPlacements: params.leftPlacements,
      rightPlacements: params.rightPlacements,
      leftHeroId: params.leftHeroId,
      rightHeroId: params.rightHeroId,
    });

    if (shouldEmitVerboseBattleLogs()) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(battleTraceLog));
    }
  }

  private storeBattleResolutionResults(
    matchup: PreparedMatchupContext,
    resolutionResult: BattleResolutionResult,
  ): void {
    for (const assignment of buildBattleResultAssignments(
      matchup.leftPlayerId,
      matchup.rightPlayerId,
      resolutionResult,
      matchup.raidBattleInput,
    )) {
      this.battleResultsByPlayer.set(assignment.playerId, assignment.battleResult);
    }
  }

  private logResolvedBattleResult(
    matchup: PreparedMatchupContext,
    resolutionResult: BattleResolutionResult,
  ): void {
    const summary = buildBattleResultTraceSummary(
      matchup.leftPlayerId,
      resolutionResult,
    );

    this.logBattleResultTrace({
      battleId: matchup.battleId,
      leftPlayerId: matchup.leftPlayerId,
      rightPlayerId: matchup.rightPlayerId,
      winner: summary.winner,
      leftSurvivors: summary.leftSurvivors,
      rightSurvivors: summary.rightSurvivors,
      leftDamageTaken: summary.leftDamageTaken,
      rightDamageTaken: summary.rightDamageTaken,
    });
  }

  private logBattleResultTrace(params: {
    battleId: string;
    leftPlayerId: string;
    rightPlayerId: string;
    winner: "left" | "right" | "draw";
    leftSurvivors: number;
    rightSurvivors: number;
    leftDamageTaken: number;
    rightDamageTaken: number;
  }): void {
    const resultTraceLog = {
      type: "battle_result_trace",
      battleId: params.battleId,
      roundIndex: this.roundIndex,
      leftPlayerId: params.leftPlayerId,
      rightPlayerId: params.rightPlayerId,
      winner: params.winner,
      leftSurvivors: params.leftSurvivors,
      rightSurvivors: params.rightSurvivors,
      leftDamageTaken: params.leftDamageTaken,
      rightDamageTaken: params.rightDamageTaken,
      timestamp: Date.now(),
    };

    if (shouldEmitVerboseBattleLogs()) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(resultTraceLog));
    }
  }

  private ensureInitialHeroPlacements(activePlayerIds: string[]): void {
    const state = this.ensureStarted();
    const defaultColumns = [0, 2, 4, 1, 3, 5];
    const raidPlayerIds = state.bossPlayerId
      ? state.raidPlayerIds
      : activePlayerIds.filter((playerId) => (this.selectedHeroByPlayer.get(playerId) ?? "").length > 0);

    let nextColumnIndex = 0;
    for (const playerId of raidPlayerIds) {
      const selectedHeroId = this.selectedHeroByPlayer.get(playerId) ?? "";
      if (!selectedHeroId) {
        this.heroPlacementByPlayer.set(playerId, -1);
        this.heroSubHostCellByPlayer.set(playerId, -1);
        continue;
      }

      const existingPlacement = this.heroPlacementByPlayer.get(playerId) ?? -1;
      if (Number.isInteger(existingPlacement) && existingPlacement >= 0) {
        continue;
      }

      const targetColumn = defaultColumns[nextColumnIndex] ?? (nextColumnIndex % DEFAULT_SHARED_BOARD_CONFIG.width);
      nextColumnIndex += 1;
      this.heroPlacementByPlayer.set(playerId, sharedBoardCoordinateToIndex({
        x: targetColumn,
        y: DEFAULT_SHARED_BOARD_CONFIG.height - 1,
      }));
    }
  }

  private ensureInitialBossPlacements(activePlayerIds: string[]): void {
    const state = this.ensureStarted();
    const bossPlayerId = state.bossPlayerId;

    if (!bossPlayerId || !activePlayerIds.includes(bossPlayerId)) {
      return;
    }

    const selectedBossId = this.selectedBossByPlayer.get(bossPlayerId) ?? "";
    if (!selectedBossId) {
      this.bossPlacementByPlayer.set(bossPlayerId, -1);
      return;
    }

    const existingPlacement = this.bossPlacementByPlayer.get(bossPlayerId) ?? -1;
    if (Number.isInteger(existingPlacement) && existingPlacement >= 0) {
      return;
    }

    this.bossPlacementByPlayer.set(bossPlayerId, sharedBoardCoordinateToIndex({ x: 2, y: 0 }));
  }

  private getReservedSpecialBoardCells(): number[] {
    const reserved = new Set<number>();

    for (const placement of this.heroPlacementByPlayer.values()) {
      if (Number.isInteger(placement) && placement >= 0) {
        reserved.add(placement);
      }
    }

    for (const placement of this.bossPlacementByPlayer.values()) {
      if (Number.isInteger(placement) && placement >= 0) {
        reserved.add(placement);
      }
    }

    return Array.from(reserved);
  }

  private isBoardCellOccupiedByStandardPlacement(cellIndex: number): boolean {
    for (const placements of this.boardPlacementsByPlayer.values()) {
      if (placements.some((placement) => placement.cell === cellIndex)) {
        return true;
      }
    }

    return false;
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

  private estimateWinningSurvivingUnits(
    winnerUnitCount: number,
    loserUnitCount: number,
  ): number {
    const unitGap = Math.max(0, winnerUnitCount - loserUnitCount);
    return Math.max(1, Math.min(8, unitGap + 1));
  }

  private setBoardPlacementsForPlayer(playerId: string, placements: BoardUnitPlacement[]): void {
    const previousPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    this.boardPlacementsByPlayer.set(playerId, placements);
    this.reconcileHeroSubHostAfterBoardPlacementUpdate(playerId, previousPlacements, placements);
  }

  private getHeroSubHostCellForPlayer(playerId: string): number | null {
    const cell = this.heroSubHostCellByPlayer.get(playerId) ?? -1;
    return Number.isInteger(cell) && cell >= 0 ? cell : null;
  }

  private resolveHeroBattleCell(playerId: string): number | undefined {
    return this.getHeroSubHostCellForPlayer(playerId)
      ?? this.getHeroPlacementForPlayer(playerId)
      ?? undefined;
  }

  private reconcileHeroSubHostAfterBoardPlacementUpdate(
    playerId: string,
    previousPlacements: readonly BoardUnitPlacement[],
    nextPlacements: readonly BoardUnitPlacement[],
  ): void {
    const currentHostCell = this.getHeroSubHostCellForPlayer(playerId);
    if (currentHostCell === null) {
      return;
    }

    if (nextPlacements.some((placement) => placement.cell === currentHostCell)) {
      return;
    }

    const previousHostPlacement = previousPlacements.find((placement) => placement.cell === currentHostCell);
    if (!previousHostPlacement) {
      this.heroSubHostCellByPlayer.set(playerId, -1);
      return;
    }

    const movedHostPlacement = nextPlacements.find((placement) =>
      this.isSameHeroSubHostPlacement(previousHostPlacement, placement),
    );
    if (movedHostPlacement) {
      this.heroSubHostCellByPlayer.set(playerId, movedHostPlacement.cell);
      return;
    }

    this.heroSubHostCellByPlayer.set(playerId, -1);
    this.heroPlacementByPlayer.set(playerId, currentHostCell);
  }

  private isSameHeroSubHostPlacement(
    left: BoardUnitPlacement,
    right: BoardUnitPlacement,
  ): boolean {
    return left.unitType === right.unitType
      && (left.unitId ?? "") === (right.unitId ?? "")
      && (left.factionId ?? "") === (right.factionId ?? "")
      && (left.starLevel ?? 1) === (right.starLevel ?? 1)
      && (left.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[left.unitType] ?? 1)
        === (right.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[right.unitType] ?? 1)
      && (left.unitCount ?? 1) === (right.unitCount ?? 1)
      && (left.archetype ?? "") === (right.archetype ?? "");
  }


  /**
   * ラウンド開始時にスペルを宣言
   * Feature Flagが有効な場合のみ実行
   */
  private declareSpell(): void {
    if (!this.enableSpellCard) {
      return;
    }

    const state = this.ensureStarted();
    const roundIndex = state.roundIndex;
    this.spellCardHandler.declareSpell(roundIndex);
  }

  /**
   * 戦闘フェーズ終了時にスペル効果を適用
   * Feature Flagが有効な場合のみ実行
   */
  private applySpellEffect(): void {
    const state = this.ensureStarted();

    // 現在のHP状態をMapに変換
    const playerHps = new Map<string, number>();
    for (const playerId of state.alivePlayerIds) {
      playerHps.set(playerId, state.getPlayerHp(playerId));
    }

    this.spellCardHandler.applySpellEffect({
      roundIndex: state.roundIndex,
      playerHps,
      alivePlayerIds: state.alivePlayerIds,
      bossPlayerId: state.bossPlayerId,
    });

    // HP変更をstateに反映
    for (const [playerId, hp] of playerHps) {
      state.setPlayerHp(playerId, hp);
    }
  }

  private applyPreBattleSpellEffect(): void {
    const state = this.ensureStarted();

    this.spellCardHandler.applyPreBattleSpellEffect({
      alivePlayerIds: state.alivePlayerIds,
      bossPlayerId: state.bossPlayerId,
    });
  }

  /**
   * 現在宣言中のスペルカードを取得
   */
  public getDeclaredSpell(): SpellCard | null {
    return this.spellCardHandler.getDeclaredSpell();
  }

  /**
   * 宣言中のスペルカードIDを取得
   */
  public getDeclaredSpellId(): string | null {
    return this.spellCardHandler.getDeclaredSpellId();
  }

  /**
   * スペルカードを宣言
   * @param spellId 宣言するスペルカードID
   * @returns 宣言に成功した場合true
   */
  public declareSpellById(spellId: string): boolean {
    const state = this.ensureStarted();
    const roundIndex = state.roundIndex;
    return this.spellCardHandler.declareSpellById(roundIndex, spellId);
  }

  public getUsedSpellIds(): string[] {
    return this.spellCardHandler.getUsedSpellIds();
  }

  /**
   * PrepCommandの基本バリデーション（フェーズ、プレイヤー、タイミング、コマンド順序）
   */
}
