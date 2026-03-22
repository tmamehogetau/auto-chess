import { GameLoopState, type Phase } from "../domain/game-loop-state";
import {
  hashToUint32,
  seedToUnitFloat,
  pickRarity,
} from "./match-room-controller/random-utils";
import { comparePlayerIds } from "./match-room-controller/player-compare";
import { buildLoserDamage } from "./match-room-controller/damage-calculator";
import {
  BattleResolutionService,
  type BattleResolutionDependencies,
  type BattleResolutionResult,
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
  initializeShopsForPrep,
  refreshShopByCount,
  refreshShopsForPrep,
} from "./match-room-controller/prep-economy";
import {
  beginBattlePhaseWindow,
  beginEliminationPhaseWindow,
  beginPrepPhaseWindow,
  beginSettlePhaseWindow,
  clearPhaseTiming,
  hasDeadlineElapsed,
  type PhaseTimingUpdate,
} from "./match-room-controller/phase-timing";
import type {
  BoardUnitType,
  BoardUnitPlacement,
  BattleTimelineEvent,
  CommandResult,
  SharedBattleReplayMessage,
  ShopItemOffer,
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
import { calculateDiscountedShopOfferCost } from "./match-room-controller/shop-cost-reduction";
import {
  normalizeBoardPlacements,
  resolveBoardPowerFromState,
  resolveUnitCountFromState,
} from "./combat/unit-effects";
import {
  ITEM_DEFINITIONS,
  ITEM_TYPES,
  type ItemType,
} from "./combat/item-definitions";
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
  calculateSynergyDetails,
  getTouhouFactionTierEffect,
} from "./combat/synergy-definitions";
import {
  STAR_LEVEL_MAX,
  STAR_LEVEL_MIN,
  STAR_MERGE_THRESHOLD,
  UNIT_SELL_VALUE_BY_TYPE,
  calculateSellValue,
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
import { getRumorUnitForRound, type RumorUnit } from "../data/rumor-units";
import { SCARLET_MANSION_UNITS, getRandomScarletMansionUnit, type ScarletMansionUnit } from "../data/scarlet-mansion-units";
import mvpPhase1UnitsData from "../data/mvp_phase1_units.json";
import type { SubUnitConfig } from "../shared/types";
import type { ControllerPlayerStatus } from "./types/player-state-types";
import { resolveBattlePlacements, resolveSharedPoolCost } from "./unit-id-resolver";
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



type PhaseResult = "pending" | "success" | "failed";

type RoundDamageByPlayer = Partial<Record<string, number>>;

interface BattlePairing {
  leftPlayerId: string;
  rightPlayerId: string | null;
  ghostSourcePlayerId: string | null;
}

const INITIAL_GOLD = 15;
const INITIAL_XP = 0;
const INITIAL_LEVEL = 1;
const PREP_BASE_INCOME = 5;
const XP_PURCHASE_COST = 4;
const XP_PURCHASE_GAIN = 4;
const MAX_XP_PURCHASE_COUNT = 10;
const SHOP_REFRESH_COST = 2;
const MAX_SHOP_REFRESH_COUNT = 5;
const SHOP_SIZE = 5;
const MAX_SHOP_BUY_SLOT_INDEX = SHOP_SIZE - 1;
const BOSS_SHOP_SIZE = 2;
const MAX_BENCH_SIZE = 9;
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

const ITEM_SHOP_SIZE = 5;
const MAX_INVENTORY_SIZE = 9;
const MAX_ITEMS_PER_UNIT = 3;
const XP_COSTS_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 2,
  2: 2,
  3: 6,
  4: 10,
  5: 20,
};

type UnitRarity = 1 | 2 | 3 | 4 | 5;
type LegacyRarity = 1 | 2 | 3;

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
  items?: ItemType[];
}

type ShopOfferKey = string;

// ユニットタイプとコストのマッピング（コスト=レアリティ）
const UNIT_TYPE_TO_COST: Readonly<Record<BoardUnitType, number>> = {
  vanguard: 1,
  ranger: 1,
  mage: 2,
  assassin: 3,
};

const SHOP_UNIT_POOL_BY_RARITY: Readonly<Record<LegacyRarity, readonly BoardUnitType[]>> = {
  1: ["vanguard", "ranger"],
  2: ["mage", "assassin"],
  3: ["assassin", "mage"],
};

const SHOP_ODDS_BY_LEVEL: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [1, 0, 0],
  2: [0.8, 0.2, 0],
  3: [0.6, 0.35, 0.05],
  4: [0.45, 0.4, 0.15],
  5: [0.3, 0.45, 0.25],
  6: [0.2, 0.45, 0.35],
};

interface MatchupOutcome {
  winnerId: string | null;
  loserId: string | null;
  winnerUnitCount: number;
  loserUnitCount: number;
  isDraw: boolean;
}

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

  private readonly itemInventoryByPlayer: Map<string, ItemType[]>;

  private readonly itemShopOffersByPlayer: Map<string, ShopItemOffer[]>;

  private readonly kouRyuudouFreeRefreshConsumedByPlayer: Map<string, boolean>;

  private readonly battleResultsByPlayer: Map<string, BattleResult>;

  private readonly selectedHeroByPlayer: Map<string, string>;
  private readonly heroPlacementByPlayer: Map<string, number>;

  private readonly selectedBossByPlayer: Map<string, string>;
  private readonly bossPlacementByPlayer: Map<string, number>;

  private readonly wantsBossByPlayer: Map<string, boolean>;

  private readonly roleByPlayer: Map<string, "unassigned" | "raid" | "boss">;

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

  private pendingPhaseDamageForTest: number | null;

  private hpAtBattleStartByPlayer: Map<string, number>;

  private hpAfterBattleByPlayer: Map<string, number>;

  private battleParticipantIds: string[];

  private currentRoundPairings: BattlePairing[];

  private readonly eliminatedFromBottom: string[];

  private readonly setId: UnitEffectSetId;

  private phaseHpTarget: number;

  private phaseDamageDealt: number;

  private phaseResult: PhaseResult;

  private phaseCompletionRate: number;

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
    this.itemInventoryByPlayer = new Map<string, ItemType[]>();
    this.itemShopOffersByPlayer = new Map<string, ShopItemOffer[]>();
    this.kouRyuudouFreeRefreshConsumedByPlayer = new Map<string, boolean>();
    this.battleResultsByPlayer = new Map<string, BattleResult>();
    this.selectedHeroByPlayer = new Map<string, string>();
    this.heroPlacementByPlayer = new Map<string, number>();
    this.selectedBossByPlayer = new Map<string, string>();
    this.bossPlacementByPlayer = new Map<string, number>();
    this.wantsBossByPlayer = new Map<string, boolean>();
    this.roleByPlayer = new Map<string, "unassigned" | "raid" | "boss">();
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

    this.phaseHpTarget = this.resolvePhaseHpTarget(1);
    this.phaseDamageDealt = 0;
    this.phaseResult = "pending";
    this.phaseCompletionRate = 0;
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
      this.itemInventoryByPlayer.set(playerId, []);
      this.itemShopOffersByPlayer.set(playerId, []);
      this.kouRyuudouFreeRefreshConsumedByPlayer.set(playerId, false);
      this.selectedHeroByPlayer.set(playerId, "");
      this.heroPlacementByPlayer.set(playerId, -1);
      this.selectedBossByPlayer.set(playerId, "");
      this.bossPlacementByPlayer.set(playerId, -1);
      this.wantsBossByPlayer.set(playerId, false);
      this.roleByPlayer.set(playerId, "unassigned");
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
    this.bossShopOffersByPlayer = new Map<string, ShopOffer[]>();
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

  public get alivePlayerIds(): string[] {
    return this.gameLoopState?.alivePlayerIds ?? [];
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

  /**
   * ゲーム状態を取得（SharedBoardBridge用）
   * @returns ゲーム状態（未開始時はnull）
   */
  public getGameState(): { phase: string; roundIndex: number } | null {
    if (!this.gameLoopState) {
      return null;
    }
    return {
      phase: this.gameLoopState.phase,
      roundIndex: this.gameLoopState.roundIndex,
    };
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
      this.boardPlacementsByPlayer.set(playerId, normalizedPlacements);
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
    if (this.finalRankingOverride) {
      return [...this.finalRankingOverride];
    }

    const state = this.gameLoopState;

    if (!state) {
      return [];
    }

    const alivePlayers = [...state.alivePlayerIds].sort((left, right) =>
      comparePlayerIds(left, right),
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

  public selectHero(playerId: string, heroId: string): void {
    this.ensureKnownPlayer(playerId);

    if (!HEROES.some((hero) => hero.id === heroId)) {
      throw new Error(`Unknown hero: ${heroId}`);
    }

    this.selectedHeroByPlayer.set(playerId, heroId);
  }

  public getSelectedHero(playerId: string): string {
    this.ensureKnownPlayer(playerId);
    return this.selectedHeroByPlayer.get(playerId) ?? "";
  }

  public getSelectedBoss(playerId: string): string {
    this.ensureKnownPlayer(playerId);
    return this.selectedBossByPlayer.get(playerId) ?? "";
  }

  public getHeroPlacementForPlayer(playerId: string): number | null {
    this.ensureKnownPlayer(playerId);
    const placement = this.heroPlacementByPlayer.get(playerId) ?? -1;
    return Number.isInteger(placement) && placement >= 0 ? placement : null;
  }

  public getBossPlacementForPlayer(playerId: string): number | null {
    this.ensureKnownPlayer(playerId);
    const placement = this.bossPlacementByPlayer.get(playerId) ?? -1;
    return Number.isInteger(placement) && placement >= 0 ? placement : null;
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

      if (this.isBoardCellOccupiedByStandardPlacement(cellIndex)) {
        return { success: false, code: "INVALID_CELL", error: "Hero cell already occupied by board unit" };
      }

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
    const state = this.ensureStarted();
    return state.getPlayerHp(playerId);
  }

  public getShopOffersForPlayer(playerId: string): ShopOffer[] {
    this.ensureKnownPlayer(playerId);
    return [...(this.shopOffersByPlayer.get(playerId) ?? [])];
  }

  /**
   * ボス専用ショップのオファーを取得
   * @param playerId プレイヤーID
   * @returns ボスショップオファー、ボスでない場合は空配列
   */
  public getBossShopOffersForPlayer(playerId: string): ShopOffer[] {
    this.ensureKnownPlayer(playerId);
    if (!this.enableBossExclusiveShop) {
      return [];
    }
    const state = this.ensureStarted();
    if (!state.isBoss(playerId)) {
      return [];
    }
    return [...(this.bossShopOffersByPlayer.get(playerId) ?? [])];
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
    this.ensureKnownPlayer(playerId);
    const state = this.ensureStarted();
    return state.isBoss(playerId);
  }

  /**
   * ボスプレイヤーIDを取得
   * @returns ボスプレイヤーID、未設定の場合はnull
   */
  public getBossPlayerId(): string | null {
    const state = this.ensureStarted();
    return state.bossPlayerId;
  }

  public getRaidPlayerIds(): string[] {
    const state = this.ensureStarted();
    return [...state.raidPlayerIds];
  }

  /**
   * 支配カウントを取得
   * @returns 支配カウント
   */
  public getDominationCount(): number {
    const state = this.ensureStarted();
    return state.dominationCount;
  }

  /**
   * 全プレイヤーIDを取得
   * @returns プレイヤーID配列
   */
  public getPlayerIds(): string[] {
    return [...this.playerIds];
  }

  /**
   * 指定プレイヤーの盤面配置を取得
   * @param playerId プレイヤーID
   * @returns 盤面配置配列
   */
  public getBoardPlacementsForPlayer(playerId: string): BoardUnitPlacement[] {
    this.ensureKnownPlayer(playerId);
    return [...(this.boardPlacementsByPlayer.get(playerId) ?? [])];
  }

  /**
   * 指定プレイヤーのベンチユニットを取得
   * @param playerId プレイヤーID
   * @returns ベンチユニット配列
   */
  public getBenchUnitsForPlayer(playerId: string): Array<{ unitType: string; starLevel: number; items?: string[] }> {
    this.ensureKnownPlayer(playerId);
    const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];
    return benchUnits.map((unit) => {
      if (unit.items === undefined) {
        return {
          unitType: unit.unitType,
          starLevel: unit.starLevel,
        };
      }

      return {
        unitType: unit.unitType,
        starLevel: unit.starLevel,
        items: unit.items,
      };
    });
  }

  public getPlayerStatus(playerId: string): ControllerPlayerStatus {
    this.ensureKnownPlayer(playerId);
    const state = this.ensureStarted();
    const isActivePlayer = state.playerIds.includes(playerId);
    const ownedUnits = this.ownedUnitsByPlayer.get(playerId);
    const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const itemInventory = this.itemInventoryByPlayer.get(playerId) ?? [];
    const itemShopOffers = this.itemShopOffersByPlayer.get(playerId) ?? [];
    const bossShopOffers = this.bossShopOffersByPlayer.get(playerId) ?? [];
    const isRumorEligible = this.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;

    // Debug log for shop offers (enabled only when MATCH_DEBUG_LOGS=1)
    const shopOffers = this.shopOffersByPlayer.get(playerId) ?? [];
    if (process.env.MATCH_DEBUG_LOGS === "1") {
      // eslint-disable-next-line no-console
      console.log(`Shop offers for ${playerId}:`, shopOffers);
    }

    // Calculate active synergies
    const heroSynergyBonusType = this.resolveHeroSynergyBonusType(playerId);
    const activeSynergies = this.calculateActiveSynergies(boardPlacements, heroSynergyBonusType, playerId);

    const baseStatus: ControllerPlayerStatus = {
      wantsBoss: this.wantsBossByPlayer.get(playerId) ?? false,
      selectedBossId: this.selectedBossByPlayer.get(playerId) ?? "",
      role: this.roleByPlayer.get(playerId) ?? "unassigned",
      hp: isActivePlayer ? state.getPlayerHp(playerId) : 100,
      remainingLives: isActivePlayer ? state.getRemainingLives(playerId) : 0,
      eliminated: isActivePlayer ? state.isPlayerEliminated(playerId) : false,
      boardUnitCount: this.boardUnitCountByPlayer.get(playerId) ?? 4,
      gold: this.goldByPlayer.get(playerId) ?? INITIAL_GOLD,
      xp: this.xpByPlayer.get(playerId) ?? INITIAL_XP,
      level: this.levelByPlayer.get(playerId) ?? INITIAL_LEVEL,
      shopOffers: shopOffers,
      shopLocked: this.shopLockedByPlayer.get(playerId) ?? false,
      benchUnits: benchUnits.map((benchUnit) =>
        benchUnit.starLevel > 1
          ? `${benchUnit.unitType}:${benchUnit.starLevel}`
          : benchUnit.unitType,
      ),
      benchDisplayNames: benchUnits.map((benchUnit) => this.resolveBenchUnitDisplayName(benchUnit)),
      boardUnits: boardPlacements.map((placement) => {
        const starLevel = placement.starLevel ?? 1;
        const hasSubUnitAssist =
          this.enableSubUnitSystem &&
          (() => {
            const config = this.subUnitAssistConfigByType.get(placement.unitType);
            if (!config) {
              return false;
            }
            if (!config.parentUnitId) {
              return true;
            }
            return placement.unitId === config.parentUnitId;
          })();

        if (starLevel > 1 || hasSubUnitAssist) {
          const tokenWithStarLevel = `${placement.cell}:${placement.unitType}:${starLevel}`;
          if (hasSubUnitAssist) {
            return `${tokenWithStarLevel}:sub`;
          }
          return tokenWithStarLevel;
        }

        return `${placement.cell}:${placement.unitType}`;
      }),
      ownedUnits: {
        vanguard: ownedUnits?.vanguard ?? 0,
        ranger: ownedUnits?.ranger ?? 0,
        mage: ownedUnits?.mage ?? 0,
        assassin: ownedUnits?.assassin ?? 0,
      },
      itemInventory: [...itemInventory],
      itemShopOffers: [...itemShopOffers],
      bossShopOffers: [...bossShopOffers],
      lastBattleResult: this.battleResultsByPlayer.get(playerId),
      activeSynergies,
      selectedHeroId: this.selectedHeroByPlayer.get(playerId) ?? "",
      isRumorEligible,
    };

    // 共有プールの在庫情報を追加（Feature Flagが有効な場合のみ）
    if (this.enableSharedPool && this.sharedPool) {
      return {
        ...baseStatus,
        sharedPoolInventory: this.sharedPool.getAllInventory(),
      };
    }

    return baseStatus;
  }

  public getSharedBattleReplay(phase: "Battle" | "Settle"): SharedBattleReplayMessage | null {
    const state = this.ensureStarted();
    const candidatePlayerIds = [
      state.bossPlayerId,
      ...state.raidPlayerIds,
      ...this.playerIds,
    ].filter((playerId): playerId is string => typeof playerId === "string" && playerId.length > 0);

    for (const playerId of candidatePlayerIds) {
      const timeline = this.battleResultsByPlayer.get(playerId)?.timeline;
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

  public getPhaseProgress(): {
    targetHp: number;
    damageDealt: number;
    result: PhaseResult;
    completionRate: number;
  } {
    this.ensureStarted();

    return {
      targetHp: this.phaseHpTarget,
      damageDealt: this.phaseDamageDealt,
      result: this.phaseResult,
      completionRate: this.phaseCompletionRate,
    };
  }

  private resolveBattleIdFromTimeline(timeline: BattleTimelineEvent[] | undefined): string | null {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return null;
    }

    const firstEvent = timeline.find((event) => typeof event?.battleId === "string");
    return firstEvent?.battleId ?? null;
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

  private isRaidMode(): boolean {
    return this.enableBossExclusiveShop && this.gameLoopState?.bossPlayerId !== null;
  }

  public advanceByTime(nowMs: number): boolean {
    if (!this.gameLoopState) {
      return false;
    }

    switch (this.gameLoopState.phase) {
      case "Prep":
        return this.advancePrepPhase(nowMs);
      case "Battle":
        return this.advanceBattlePhase(nowMs);
      case "Settle":
        return this.advanceSettlePhase(nowMs);
      case "Elimination":
        return this.advanceEliminationPhase(nowMs);
      case "End":
        return false;
      default:
        return false;
    }
  }

  private advancePrepPhase(nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.prepDeadlineAtMs, nowMs)) {
      return false;
    }

    const state = this.ensureStarted();
    this.captureBattleStartHp();
    this.captureBattleInputSnapshot();
    this.declareSpell();
    this.applyPreBattleSpellEffect();
    state.transitionTo("Battle");
    this.applyPhaseTimingUpdate(beginBattlePhaseWindow(nowMs, this.battleDurationMs));
    this.matchLogger?.logRoundTransition("Battle", state.roundIndex, nowMs);
    return true;
  }

  private advanceBattlePhase(nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.battleDeadlineAtMs, nowMs)) {
      return false;
    }

    const state = this.ensureStarted();
    this.resolveMissingRoundDamage();
    this.capturePhaseProgressFromPendingDamage();
    this.applyPendingRoundDamage();
    this.capturePostBattleHp();
    this.applySpellEffect();
    state.transitionTo("Settle");
    this.applyPhaseTimingUpdate(beginSettlePhaseWindow(nowMs, this.settleDurationMs));
    this.matchLogger?.logRoundTransition("Settle", state.roundIndex, nowMs);
    return true;
  }

  private advanceSettlePhase(nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.settleDeadlineAtMs, nowMs)) {
      return false;
    }

    const state = this.ensureStarted();
    this.applyRaidRoundConsequences();
    const aliveBeforeElimination = new Set(state.alivePlayerIds);
    state.transitionTo("Elimination");
    this.captureEliminationResult(aliveBeforeElimination);
    this.applyPhaseTimingUpdate(beginEliminationPhaseWindow(nowMs, this.eliminationDurationMs));
    this.matchLogger?.logRoundTransition("Elimination", state.roundIndex, nowMs);
    return true;
  }

  private advanceEliminationPhase(nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.eliminationDeadlineAtMs, nowMs)) {
      return false;
    }

    const state = this.ensureStarted();
    this.eliminationDeadlineAtMs = null;

    if (this.shouldEndAfterElimination(this.resolveMaxRounds())) {
      state.transitionTo("End");
      this.applyPhaseTimingUpdate(clearPhaseTiming());
      return true;
    }

    this.resetForNextPrepRound();
    state.transitionTo("Prep");
    this.resetPhaseProgressForRound(state.roundIndex);
    this.applyPhaseTimingUpdate(beginPrepPhaseWindow(nowMs, this.prepDurationMs));
    this.matchLogger?.logRoundTransition("Prep", state.roundIndex, nowMs);
    return true;
  }

  private resolveMaxRounds(): number {
    return this.isRaidMode() || this.featureFlags.enablePhaseExpansion ? 12 : 8;
  }

  private applyPhaseTimingUpdate(update: PhaseTimingUpdate): void {
    this.prepDeadlineAtMs = update.prepDeadlineAtMs;
    this.battleDeadlineAtMs = update.battleDeadlineAtMs;
    this.settleDeadlineAtMs = update.settleDeadlineAtMs;
    this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
  }

  private resetForNextPrepRound(): void {
    this.pendingRoundDamageByPlayer.clear();
    this.pendingPhaseDamageForTest = null;
    this.applyPrepIncome();
    this.logRumorInfluenceWithAlivePlayersAfterElimination();
    this.refreshShopsForPrep();
    this.hpAtBattleStartByPlayer = new Map<string, number>();
    this.hpAfterBattleByPlayer = new Map<string, number>();
    this.battleParticipantIds = [];
    this.currentRoundPairings = [];
    this.battleInputSnapshotByPlayer.clear();
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
      getItemInventory: (id) => this.itemInventoryByPlayer.get(id) ?? [],
      getItemShopOffers: (id) => this.itemShopOffersByPlayer.get(id) ?? [],
      getBossShopOffers: (id) => this.bossShopOffersByPlayer.get(id) ?? [],
      getShopRefreshGoldCost: (id, count) => this.getShopRefreshGoldCost(id, count),
      isBossPlayer: (id) => this.isBossPlayer(id),
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
      setBoardPlacements: (id, placements) => this.boardPlacementsByPlayer.set(id, placements),
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
      deployBenchUnitToBoard: (id, benchIndex, cell) =>
        this.deployBenchUnitToBoard(id, benchIndex, cell),
      returnBoardUnitToBench: (id, cell) => this.returnBoardUnitToBench(id, cell),
      sellBenchUnit: (id, benchIndex) => this.sellBenchUnit(id, benchIndex),
      sellBoardUnit: (id, cell) => this.sellBoardUnit(id, cell),
      addItemToInventory: (id, itemType) => this.addItemToInventory(id, itemType),
      equipItemToBenchUnit: (id, inventoryItemIndex, benchIndex) =>
        this.equipItemToBenchUnit(id, inventoryItemIndex, benchIndex),
      unequipItemFromBenchUnit: (id, benchIndex, itemSlotIndex) =>
        this.unequipItemFromBenchUnit(id, benchIndex, itemSlotIndex),
      sellInventoryItem: (id, inventoryItemIndex) => this.sellInventoryItem(id, inventoryItemIndex),
      buyBossShopOffer: (id, slotIndex) => this.buyBossShopOffer(id, slotIndex),
      getBenchUnits: (id) => this.benchUnitsByPlayer.get(id) ?? [],
      getOwnedUnits: (id) => this.ownedUnitsByPlayer.get(id) ?? { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
      getItemInventory: (id) => this.itemInventoryByPlayer.get(id) ?? [],
      getBoardPlacements: (id) => this.boardPlacementsByPlayer.get(id) ?? [],
      getShopOffers: (id) => this.shopOffersByPlayer.get(id) ?? [],
      getItemShopOffers: (id) => this.itemShopOffersByPlayer.get(id) ?? [],
      getBossShopOffers: (id) => this.bossShopOffersByPlayer.get(id) ?? [],
      getRosterFlags: () => this.rosterFlags,
      logBossShop: (id, offers, purchase) => this.logBossShopPurchase(id, offers, purchase),
    };
  }

  private addItemToInventory(playerId: string, itemType: ItemType): void {
    const inventory = this.itemInventoryByPlayer.get(playerId);
    if (!inventory) {
      return;
    }

    inventory.push(itemType);
  }

  private equipItemToBenchUnit(
    playerId: string,
    inventoryItemIndex: number,
    benchIndex: number,
  ): void {
    const inventory = this.itemInventoryByPlayer.get(playerId);
    const benchUnits = this.benchUnitsByPlayer.get(playerId);
    if (!inventory || !benchUnits) {
      return;
    }

    const benchUnit = benchUnits[benchIndex];
    if (!benchUnit) {
      return;
    }

    const item = inventory[inventoryItemIndex];
    if (item === undefined) {
      return;
    }

    inventory.splice(inventoryItemIndex, 1);
    benchUnit.items = benchUnit.items || [];
    benchUnit.items.push(item);
  }

  private unequipItemFromBenchUnit(
    playerId: string,
    benchIndex: number,
    itemSlotIndex: number,
  ): void {
    const benchUnits = this.benchUnitsByPlayer.get(playerId);
    const inventory = this.itemInventoryByPlayer.get(playerId);
    if (!benchUnits || !inventory) {
      return;
    }

    const benchUnit = benchUnits[benchIndex];
    if (!benchUnit?.items) {
      return;
    }

    const item = benchUnit.items[itemSlotIndex];
    if (item === undefined) {
      return;
    }

    benchUnit.items.splice(itemSlotIndex, 1);
    inventory.push(item);
  }

  private sellInventoryItem(playerId: string, inventoryItemIndex: number): void {
    const inventory = this.itemInventoryByPlayer.get(playerId);
    if (!inventory) {
      return;
    }

    const item = inventory[inventoryItemIndex];
    if (item === undefined) {
      return;
    }

    const itemDef = ITEM_DEFINITIONS[item];
    const sellValue = Math.floor(itemDef.cost / 2);
    inventory.splice(inventoryItemIndex, 1);
    const currentGold = this.goldByPlayer.get(playerId) || 0;
    this.goldByPlayer.set(playerId, currentGold + sellValue);
  }

  private buyBossShopOffer(playerId: string, slotIndex: number): void {
    const bossOffers = this.getBossShopOffersForPlayer(playerId);
    const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];
    if (!bossOffers || slotIndex >= bossOffers.length) {
      return;
    }

    const bossOffer = bossOffers[slotIndex];
    if (!bossOffer || bossOffer.purchased) {
      return;
    }

    const benchUnit: BenchUnit = {
      unitType: bossOffer.unitType,
      cost: bossOffer.cost,
      starLevel: bossOffer.starLevel ?? STAR_LEVEL_MIN,
      unitCount: 1,
    };

    if (bossOffer.unitId !== undefined) {
      benchUnit.unitId = bossOffer.unitId;
    }

    benchUnits.push(benchUnit);
    this.benchUnitsByPlayer.set(playerId, benchUnits);
    bossOffer.purchased = true;
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
      baseIncome: PREP_BASE_INCOME,
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
    const state = this.ensureStarted();
    initializeShopsForPrep({
      playerIds: state.playerIds,
      roundIndex: state.roundIndex,
      isBossPlayer: (playerId) => state.isBoss(playerId),
      buildShopOffers: (playerId, roundIndex, refreshCount, purchaseCount, isRumorEligible) =>
        this.shopOfferBuilder.buildShopOffers(
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount,
          isRumorEligible,
        ),
      buildItemShopOffers: () =>
        this.shopOfferBuilder.buildItemShopOffers(ITEM_TYPES, ITEM_DEFINITIONS),
      buildBossShopOffers: () => this.shopOfferBuilder.buildBossShopOffers(),
      shopRefreshCountByPlayer: this.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.shopPurchaseCountByPlayer,
      shopLockedByPlayer: this.shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.shopOffersByPlayer,
      itemShopOffersByPlayer: this.itemShopOffersByPlayer,
      bossShopOffersByPlayer: this.bossShopOffersByPlayer,
      enableRumorInfluence: this.enableRumorInfluence,
      enableBossExclusiveShop: this.enableBossExclusiveShop,
    });
  }

  private refreshShopsForPrep(): void {
    const state = this.ensureStarted();
    refreshShopsForPrep({
      alivePlayerIds: state.alivePlayerIds,
      roundIndex: state.roundIndex,
      isBossPlayer: (playerId) => state.isBoss(playerId),
      buildShopOffers: (playerId, roundIndex, refreshCount, purchaseCount, isRumorEligible) =>
        this.shopOfferBuilder.buildShopOffers(
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount,
          isRumorEligible,
        ),
      buildBossShopOffers: () => this.shopOfferBuilder.buildBossShopOffers(),
      shopRefreshCountByPlayer: this.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.shopPurchaseCountByPlayer,
      shopLockedByPlayer: this.shopLockedByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.shopOffersByPlayer,
      bossShopOffersByPlayer: this.bossShopOffersByPlayer,
      battleResultsByPlayer: this.battleResultsByPlayer,
      enableRumorInfluence: this.enableRumorInfluence,
      enableBossExclusiveShop: this.enableBossExclusiveShop,
    });
  }

  private refreshShopByCount(playerId: string, refreshCount: number): void {
    const state = this.ensureStarted();
    refreshShopByCount({
      playerId,
      roundIndex: state.roundIndex,
      refreshCount,
      buildShopOffers: (targetPlayerId, roundIndex, nextRefreshCount, purchaseCount, isRumorEligible) =>
        this.shopOfferBuilder.buildShopOffers(
          targetPlayerId,
          roundIndex,
          nextRefreshCount,
          purchaseCount,
          isRumorEligible,
        ),
      shopRefreshCountByPlayer: this.shopRefreshCountByPlayer,
      shopPurchaseCountByPlayer: this.shopPurchaseCountByPlayer,
      kouRyuudouFreeRefreshConsumedByPlayer: this.kouRyuudouFreeRefreshConsumedByPlayer,
      rumorInfluenceEligibleByPlayer: this.rumorInfluenceEligibleByPlayer,
      shopOffersByPlayer: this.shopOffersByPlayer,
      enableRumorInfluence: this.enableRumorInfluence,
      getAvailableFreeRefreshes: (targetPlayerId) =>
        this.getAvailableKouRyuudouFreeRefreshes(targetPlayerId),
    });
  }

  private buyShopOfferBySlot(playerId: string, slotIndex: number): void {
    const state = this.ensureStarted();
    const offers = [...(this.shopOffersByPlayer.get(playerId) ?? [])];
    const refreshCount = this.shopRefreshCountByPlayer.get(playerId) ?? 0;
    const purchaseCount = (this.shopPurchaseCountByPlayer.get(playerId) ?? 0) + 1;
    const ownedUnits = this.ownedUnitsByPlayer.get(playerId);

    if (!offers[slotIndex]) {
      return;
    }

    const boughtOffer = offers[slotIndex];

    if (!boughtOffer || !ownedUnits) {
      return;
    }

    // 共有プールから在庫を減らす（Feature Flagが有効な場合）
    this.decreaseSharedPoolForOffer(boughtOffer);

    offers.splice(slotIndex, 1);
    offers.push(
      this.shopOfferBuilder.buildReplacementOffer(
        playerId,
        state.roundIndex,
        refreshCount,
        purchaseCount,
      ),
    );

    this.shopPurchaseCountByPlayer.set(playerId, purchaseCount);
    this.shopOffersByPlayer.set(playerId, offers);

    const benchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const purchasedUnitCost = calculateDiscountedShopOfferCost(
      boughtOffer,
      boardPlacements,
      this.rosterFlags,
    );

    const purchasedBenchUnit: BenchUnit = {
      unitType: boughtOffer.unitType,
      cost: purchasedUnitCost,
      starLevel: STAR_LEVEL_MIN,
      unitCount: 1,
    };

    if (boughtOffer.unitId !== undefined) {
      purchasedBenchUnit.unitId = boughtOffer.unitId;
    }

    benchUnits.push(purchasedBenchUnit);
    this.benchUnitsByPlayer.set(playerId, benchUnits);
    this.tryMergeBenchUnits(playerId);

    const nextOwnedUnits: OwnedUnits = {
      vanguard: ownedUnits.vanguard,
      ranger: ownedUnits.ranger,
      mage: ownedUnits.mage,
      assassin: ownedUnits.assassin,
    };

    nextOwnedUnits[boughtOffer.unitType] += 1;
    this.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
  }

  private tryMergeBenchUnits(playerId: string): void {
    const benchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];

    let mergedAny = true;

    while (mergedAny) {
      mergedAny = false;

      for (const unitType of ["vanguard", "ranger", "mage", "assassin"] as const) {
        for (const starLevel of [STAR_LEVEL_MIN, STAR_LEVEL_MAX - 1] as const) {
          const mergeKeys = new Set(
            benchUnits
              .filter((unit) => unit.unitType === unitType && unit.starLevel === starLevel)
              .map((unit) => unit.unitId ?? ""),
          );

          for (const mergeUnitId of mergeKeys) {
            const mergeCandidates: number[] = [];

            for (let index = 0; index < benchUnits.length; index += 1) {
              const unit = benchUnits[index];

              if (
                !unit ||
                unit.unitType !== unitType ||
                unit.starLevel !== starLevel ||
                (unit.unitId ?? "") !== mergeUnitId
              ) {
                continue;
              }

              mergeCandidates.push(index);
            }

            if (mergeCandidates.length < STAR_MERGE_THRESHOLD) {
              continue;
            }

            const consumedIndexes = mergeCandidates
              .slice(0, STAR_MERGE_THRESHOLD)
              .sort((left, right) => right - left);
            let mergedCost = 0;
            let mergedCount = 0;

            for (const index of consumedIndexes) {
              const unit = benchUnits[index];

              if (!unit) {
                continue;
              }

              mergedCost += unit.cost;
              mergedCount += unit.unitCount;
              benchUnits.splice(index, 1);
            }

            const mergedBenchUnit: BenchUnit = {
              unitType,
              cost: mergedCost,
              starLevel: starLevel + 1,
              unitCount: mergedCount,
            };

            if (mergeUnitId !== "") {
              mergedBenchUnit.unitId = mergeUnitId;
            }

            benchUnits.push(mergedBenchUnit);
            mergedAny = true;
          }
        }
      }
    }

    this.benchUnitsByPlayer.set(playerId, benchUnits);
  }

  private deployBenchUnitToBoard(playerId: string, benchIndex: number, cell: number): void {
    const benchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.boardPlacementsByPlayer.get(playerId) ?? [])];
    const benchUnit = benchUnits[benchIndex];

    if (!benchUnit || boardPlacements.length >= 8) {
      return;
    }

    benchUnits.splice(benchIndex, 1);
    const boardPlacement: BoardUnitPlacement = {
      cell,
      unitType: benchUnit.unitType,
      starLevel: benchUnit.starLevel,
      sellValue: benchUnit.cost,
      unitCount: benchUnit.unitCount,
      items: benchUnit.items || [],
    };

    if (benchUnit.unitId !== undefined) {
      boardPlacement.unitId = benchUnit.unitId;
    }

    boardPlacements.push(boardPlacement);
    boardPlacements.sort((left, right) => left.cell - right.cell);

    this.benchUnitsByPlayer.set(playerId, benchUnits);
    this.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
  }

  private returnBoardUnitToBench(playerId: string, cell: number): void {
    const benchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];
    const boardPlacements = [...(this.boardPlacementsByPlayer.get(playerId) ?? [])];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);

    if (targetIndex < 0 || benchUnits.length >= MAX_BENCH_SIZE) {
      return;
    }

    const returnedPlacement = boardPlacements[targetIndex];

    if (!returnedPlacement) {
      return;
    }

    boardPlacements.splice(targetIndex, 1);

    const benchUnit: BenchUnit = {
      unitType: returnedPlacement.unitType,
      cost: returnedPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[returnedPlacement.unitType] ?? 1,
      starLevel: returnedPlacement.starLevel ?? 1,
      unitCount: returnedPlacement.unitCount ?? returnedPlacement.starLevel ?? 1,
      items: [...(returnedPlacement.items ?? [])],
    };

    if (returnedPlacement.unitId !== undefined) {
      benchUnit.unitId = returnedPlacement.unitId;
    }

    benchUnits.push(benchUnit);

    this.benchUnitsByPlayer.set(playerId, benchUnits);
    this.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
  }

  private sellBenchUnit(playerId: string, benchIndex: number): void {
    const benchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];
    const benchUnit = benchUnits[benchIndex];
    const currentGold = this.goldByPlayer.get(playerId) ?? INITIAL_GOLD;
    const ownedUnits = this.ownedUnitsByPlayer.get(playerId);

    if (!benchUnit || !ownedUnits) {
      return;
    }

    benchUnits.splice(benchIndex, 1);

    const nextOwnedUnits: OwnedUnits = {
      vanguard: ownedUnits.vanguard,
      ranger: ownedUnits.ranger,
      mage: ownedUnits.mage,
      assassin: ownedUnits.assassin,
    };

    nextOwnedUnits[benchUnit.unitType] = Math.max(
      0,
      nextOwnedUnits[benchUnit.unitType] - benchUnit.unitCount,
    );

    this.benchUnitsByPlayer.set(playerId, benchUnits);
    this.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
    this.goldByPlayer.set(playerId, currentGold + benchUnit.cost);

    // 共有プールへ在庫を戻す（Feature Flagが有効な場合）
    this.increaseSharedPoolForUnit(benchUnit.unitId, benchUnit.cost, benchUnit.unitCount);
  }

  private sellBoardUnit(playerId: string, cell: number): void {
    const boardPlacements = [...(this.boardPlacementsByPlayer.get(playerId) ?? [])];
    const targetIndex = boardPlacements.findIndex((placement) => placement.cell === cell);
    const currentGold = this.goldByPlayer.get(playerId) ?? INITIAL_GOLD;
    const ownedUnits = this.ownedUnitsByPlayer.get(playerId);

    if (targetIndex < 0 || !ownedUnits) {
      return;
    }

    const soldPlacement = boardPlacements[targetIndex];

    if (!soldPlacement) {
      return;
    }

    // Return items to inventory if space available
    const items = soldPlacement.items || [];
    const inventory = this.itemInventoryByPlayer.get(playerId);

    if (inventory && items.length > 0) {
      for (const item of items) {
        if (inventory.length < MAX_INVENTORY_SIZE) {
          inventory.push(item);
        }
        // If inventory is full, items are lost (design decision)
      }
    }

    boardPlacements.splice(targetIndex, 1);

    const nextOwnedUnits: OwnedUnits = {
      vanguard: ownedUnits.vanguard,
      ranger: ownedUnits.ranger,
      mage: ownedUnits.mage,
      assassin: ownedUnits.assassin,
    };

    const unitCount = soldPlacement.unitCount ?? soldPlacement.starLevel ?? 1;

    nextOwnedUnits[soldPlacement.unitType] = Math.max(0, nextOwnedUnits[soldPlacement.unitType] - unitCount);

    const sellValue = soldPlacement.sellValue ?? UNIT_SELL_VALUE_BY_TYPE[soldPlacement.unitType] ?? 1;

    this.boardPlacementsByPlayer.set(playerId, boardPlacements);
    this.boardUnitCountByPlayer.set(playerId, boardPlacements.length);
    this.ownedUnitsByPlayer.set(playerId, nextOwnedUnits);
    this.goldByPlayer.set(playerId, currentGold + sellValue);

    // 共有プールへ在庫を戻す（Feature Flagが有効な場合）
    this.increaseSharedPoolForUnit(
      soldPlacement.unitId,
      sellValue,
      soldPlacement.unitCount ?? soldPlacement.starLevel ?? 1,
    );
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
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];

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
    this.itemInventoryByPlayer.delete(playerId);
    this.itemShopOffersByPlayer.delete(playerId);
    this.kouRyuudouFreeRefreshConsumedByPlayer.delete(playerId);
    this.selectedHeroByPlayer.delete(playerId);
    this.heroPlacementByPlayer.delete(playerId);
    this.selectedBossByPlayer.delete(playerId);
    this.bossPlacementByPlayer.delete(playerId);
    this.wantsBossByPlayer.delete(playerId);
    this.roleByPlayer.delete(playerId);
    this.battleResultsByPlayer.delete(playerId);
    this.pendingRoundDamageByPlayer.delete(playerId);
    this.hpAtBattleStartByPlayer.delete(playerId);
    this.hpAfterBattleByPlayer.delete(playerId);

    // 共有プールへ全ユニットを返却（Feature Flagが有効な場合）
    if (this.enableSharedPool && this.sharedPool) {
      // 盤面のユニットを返却
      for (const placement of boardPlacements) {
        const unitCost = placement.sellValue ?? UNIT_TYPE_TO_COST[placement.unitType] ?? 1;
        const unitCount = placement.unitCount ?? placement.starLevel ?? 1;
        this.increaseSharedPoolForUnit(placement.unitId, unitCost, unitCount);
      }

      // ベンチのユニットを返却
      for (const benchUnit of benchUnits) {
        const unitCost = benchUnit.cost ?? 1;
        const unitCount = benchUnit.unitCount ?? 1;
        this.increaseSharedPoolForUnit(benchUnit.unitId, unitCost, unitCount);
      }
    }
  }

  private startMatch(nowMs: number, activePlayerIds: string[], bossPlayerId?: string): void {
    this.gameLoopState = new GameLoopState(activePlayerIds);

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
    this.resetPhaseProgressForRound(this.gameLoopState.roundIndex);
    this.prepDeadlineAtMs = nowMs + this.prepDurationMs;
    this.battleDeadlineAtMs = null;
    this.settleDeadlineAtMs = null;
    this.eliminationDeadlineAtMs = null;
  }

  private decreaseSharedPoolForOffer(offer: ShopOffer): void {
    if (!this.enableSharedPool || !this.sharedPool) {
      return;
    }

    if (this.rosterFlags.enablePerUnitSharedPool && offer.unitId) {
      this.sharedPool.decreaseByUnitId(offer.unitId, offer.cost);
      return;
    }

    this.sharedPool.decrease(offer.cost);
  }

  private increaseSharedPoolForUnit(unitId: string | undefined, cost: number, count: number): void {
    if (!this.enableSharedPool || !this.sharedPool) {
      return;
    }

    const resolvedPoolCost = resolveSharedPoolCost(unitId, cost, this.rosterFlags);

    for (let i = 0; i < count; i += 1) {
      if (this.rosterFlags.enablePerUnitSharedPool && unitId) {
        this.sharedPool.increaseByUnitId(unitId, resolvedPoolCost);
      } else {
        this.sharedPool.increase(resolvedPoolCost);
      }
    }
  }

  private getShopRefreshGoldCost(playerId: string, refreshCount: number): number {
    if (refreshCount <= 0) {
      return 0;
    }

    const freeRefreshes = this.getAvailableKouRyuudouFreeRefreshes(playerId);
    const paidRefreshCount = Math.max(0, refreshCount - freeRefreshes);
    return paidRefreshCount * SHOP_REFRESH_COST;
  }

  private getAvailableKouRyuudouFreeRefreshes(playerId: string): number {
    if (!this.rosterFlags.enableTouhouFactions) {
      return 0;
    }

    if (this.kouRyuudouFreeRefreshConsumedByPlayer.get(playerId)) {
      return 0;
    }

    const placements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const resolvedPlacements = resolveBattlePlacements(placements, this.rosterFlags);
    const synergyDetails = calculateSynergyDetails(
      resolvedPlacements,
      null,
      { enableTouhouFactions: true },
    );
    const tier = synergyDetails.factionActiveTiers.kou_ryuudou ?? 0;
    const factionEffect = getTouhouFactionTierEffect("kou_ryuudou", tier);

    return factionEffect?.special?.firstFreeRefreshes ?? 0;
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
    this.currentRoundPairings = this.buildPairingsForRound(
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
    const targetHp = this.resolvePhaseHpTarget(state.roundIndex);
    const totalDamage = this.pendingPhaseDamageForTest
      ?? (this.isRaidMode()
        ? this.pendingRoundDamageByPlayer.get(state.bossPlayerId ?? "") ?? 0
        : Array.from(this.pendingRoundDamageByPlayer.values()).reduce(
          (sum, damageValue) => sum + damageValue,
          0,
        ));
    this.pendingPhaseDamageForTest = null;

    this.phaseHpTarget = targetHp;
    this.phaseDamageDealt = totalDamage;
    this.phaseResult = totalDamage >= targetHp ? "success" : "failed";
    this.phaseCompletionRate = targetHp > 0 ? totalDamage / targetHp : 0;

    // 支配カウント: ボス優勢（フェーズ失敗）時にカウントアップ（R12以外）
    if (this.phaseResult === "failed" && state.roundIndex < 12) {
      state.dominationCount += 1;
    }

    const nextRoundRumorUnit = getRumorUnitForRound(state.roundIndex + 1);
    const guaranteedRumorSlotApplied =
      this.enableRumorInfluence &&
      this.phaseResult === "success" &&
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
    if (this.enableRumorInfluence && this.phaseResult === "success") {
      const bossPlayerId = state.bossPlayerId;
      for (const playerId of state.alivePlayerIds) {
        // ボス以外（レイド側）全員が対象
        if (playerId !== bossPlayerId) {
          this.rumorInfluenceEligibleByPlayer.set(playerId, true);
        }
      }
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

  private resetPhaseProgressForRound(roundIndex: number): void {
    this.phaseHpTarget = this.resolvePhaseHpTarget(roundIndex);
    this.phaseDamageDealt = 0;
    this.phaseResult = "pending";
    this.phaseCompletionRate = 0;
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

    // 引き分けの場合は両方ダメージなし
    if (outcome.isDraw) {
      this.pendingRoundDamageByPlayer.set(leftPlayerId, 0);
      this.pendingRoundDamageByPlayer.set(rightPlayerId, 0);
      return;
    }

    const loserDamage = buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );

    if (!this.pendingRoundDamageByPlayer.has(outcome.winnerId!)) {
      this.pendingRoundDamageByPlayer.set(outcome.winnerId!, 0);
    }

    if (!this.pendingRoundDamageByPlayer.has(outcome.loserId!)) {
      this.pendingRoundDamageByPlayer.set(outcome.loserId!, loserDamage);
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

    // 引き分けまたはチャレンジャーが勝つ場合: チャレンジャーのダメージは0
    if (outcome.isDraw || outcome.winnerId === challengerPlayerId) {
      this.pendingRoundDamageByPlayer.set(challengerPlayerId, 0);
      return;
    }

    const challengerDamage = buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );
    this.pendingRoundDamageByPlayer.set(challengerPlayerId, challengerDamage);
  }

  private applyRaidRoundConsequences(): void {
    if (!this.isRaidMode()) {
      return;
    }

    const state = this.ensureStarted();

    for (const playerId of state.raidPlayerIds) {
      const battleResult = this.battleResultsByPlayer.get(playerId);
      if (battleResult === undefined) {
        continue;
      }

      if (battleResult.survivors > 0) {
        continue;
      }

      state.consumeLife(playerId);
    }
  }

  private buildRaidFinalRanking(winner: "raid" | "boss"): string[] {
    const state = this.ensureStarted();
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

  private shouldEndAfterElimination(maxRounds: number): boolean {
    const state = this.ensureStarted();

    if (!this.isRaidMode()) {
      return state.alivePlayerIds.length <= 1 || state.roundIndex === maxRounds || state.dominationCount >= 5;
    }

    const survivingRaidPlayerIds = state.raidPlayerIds.filter((playerId) => !state.isPlayerEliminated(playerId));
    if (survivingRaidPlayerIds.length === 0 || state.dominationCount >= 5) {
      this.finalRankingOverride = this.buildRaidFinalRanking("boss");
      return true;
    }

    if (state.roundIndex < maxRounds) {
      return false;
    }

    this.finalRankingOverride = this.buildRaidFinalRanking(
      this.phaseResult === "success" && survivingRaidPlayerIds.length > 0 ? "raid" : "boss",
    );
    return true;
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
        this.getHeroPlacementForPlayer(heroPlayerId) ?? undefined,
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

    return comparePlayerIds(left, right);
  }

  private buildPairingsForRound(
    battleParticipants: string[],
    roundIndex: number,
  ): BattlePairing[] {
    if (battleParticipants.length < 2) {
      return [];
    }

    const state = this.ensureStarted();
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
