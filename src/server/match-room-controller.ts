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
} from "./match-room-controller/battle-resolution";
import type {
  BoardUnitType,
  BoardUnitPlacement,
  CommandResult,
  ShopItemOffer,
} from "../shared/room-messages";
import { MatchLogger } from "./match-logger";
import { ShopOfferBuilder, type ShopOfferBuilderDependencies } from "./match-room-controller/shop-offer-builder";
import {
  validatePrepCommand,
  type ValidationDependencies,
  type CommandPayload,
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
  calculateScarletMansionSynergy,
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
import { FeatureFlagService } from "./feature-flag-service";
import { SharedPool } from "./shared-pool";
import {
  getActiveRosterKind,
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
import { resolveBattlePlacements } from "./unit-id-resolver";
import {
  COMBAT_CELL_MAX_INDEX,
  COMBAT_CELL_MIN_INDEX,
} from "../shared/board-geometry";

interface MatchRoomControllerOptions {
  readyAutoStartMs: number;
  prepDurationMs: number;
  battleDurationMs: number;
  settleDurationMs: number;
  eliminationDurationMs: number;
  setId?: UnitEffectSetId;
  featureFlags?: {
    enablePhaseExpansion?: boolean;
  };
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

  private readonly nijiRyuudouFirstItemDrawConsumedByPlayer: Map<string, boolean>;

  private readonly battleResultsByPlayer: Map<string, BattleResult>;

  private readonly selectedHeroByPlayer: Map<string, string>;

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

  private readonly rumorInfluenceEligibleByPlayer: Map<string, boolean>;

  private readonly bossShopOffersByPlayer: Map<string, ShopOffer[]>;

  private readonly subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig>;

  private readonly featureFlags: {
    enablePhaseExpansion: boolean;
  };

  private readonly rosterFlags: FeatureFlags;

  private matchLogger: MatchLogger | null;

  private readonly shopOfferBuilder: ShopOfferBuilder;
  private readonly battleResolutionService: BattleResolutionService;

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
    this.nijiRyuudouFirstItemDrawConsumedByPlayer = new Map<string, boolean>();
    this.battleResultsByPlayer = new Map<string, BattleResult>();
    this.selectedHeroByPlayer = new Map<string, string>();
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
    this.featureFlags = {
      enablePhaseExpansion: options.featureFlags?.enablePhaseExpansion ?? false,
    };

    // Store roster flags for runtime use
    this.rosterFlags = FeatureFlagService.getInstance().getFlags();

    // Feature Flagに基づいて共有プールを初期化
    this.enableSharedPool =
      FeatureFlagService.getInstance().isFeatureEnabled('enableSharedPool')
      || this.rosterFlags.enablePerUnitSharedPool;
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
      this.nijiRyuudouFirstItemDrawConsumedByPlayer.set(playerId, false);
      this.selectedHeroByPlayer.set(playerId, "");
    }

    // Feature Flagに基づいてサブユニットシステムを初期化
    this.enableSubUnitSystem = FeatureFlagService.getInstance().isFeatureEnabled('enableSubUnitSystem');
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
    this.enableSpellCard = FeatureFlagService.getInstance().isFeatureEnabled('enableSpellCard');
    this.spellCardHandler = new SpellCardHandler({
      enableSpellCard: this.enableSpellCard,
      matchLogger: this.matchLogger,
    });

    // Feature Flagに基づいて噂勢力を初期化
    this.enableRumorInfluence = FeatureFlagService.getInstance().isFeatureEnabled('enableRumorInfluence');
    this.rumorInfluenceEligibleByPlayer = new Map<string, boolean>();

    // 噂勢力 eligibility を全プレイヤーで初期化
    for (const playerId of playerIds) {
      this.rumorInfluenceEligibleByPlayer.set(playerId, false);
    }

    // Feature Flagに基づいてボス専用ショップを初期化
    this.enableBossExclusiveShop = FeatureFlagService.getInstance().isFeatureEnabled('enableBossExclusiveShop');
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

    this.gameLoopState = new GameLoopState(activePlayerIds);

    // ボスプレイヤーをランダムに設定（ボス専用ショップ用）
    if (this.enableBossExclusiveShop) {
      this.gameLoopState.setRandomBoss();
    }

    // Log initial Prep phase transition
    this.matchLogger?.logRoundTransition("Prep", this.gameLoopState.roundIndex, nowMs);

    this.initializeShopsForPrep();
    this.resetPhaseProgressForRound(this.gameLoopState.roundIndex);
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

  public getPlayerStatus(playerId: string): ControllerPlayerStatus {
    const state = this.ensureStarted();
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
      hp: state.getPlayerHp(playerId),
      eliminated: state.isPlayerEliminated(playerId),
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
      boardUnits: boardPlacements.map((placement) => {
        const starLevel = placement.starLevel ?? 1;
        const hasSubUnitAssist =
          this.enableSubUnitSystem &&
          this.subUnitAssistConfigByType.has(placement.unitType);

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
          this.captureBattleInputSnapshot();
          this.declareSpell(); // スペル宣言
          this.applyPreBattleSpellEffect();
          this.gameLoopState.transitionTo("Battle");
          this.prepDeadlineAtMs = null;
          this.battleDeadlineAtMs = nowMs + this.battleDurationMs;
          this.matchLogger?.logRoundTransition("Battle", this.gameLoopState.roundIndex, nowMs);
          return true;
        }

        return false;
      case "Battle":
        if (this.battleDeadlineAtMs !== null && nowMs >= this.battleDeadlineAtMs) {
          this.resolveMissingRoundDamage();
          this.capturePhaseProgressFromPendingDamage();
          this.applyPendingRoundDamage();
          this.capturePostBattleHp();
          this.applySpellEffect(); // スペル効果を適用
          this.gameLoopState.transitionTo("Settle");
          this.battleDeadlineAtMs = null;
          this.settleDeadlineAtMs = nowMs + this.settleDurationMs;
          this.matchLogger?.logRoundTransition("Settle", this.gameLoopState.roundIndex, nowMs);
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
          this.matchLogger?.logRoundTransition("Elimination", this.gameLoopState.roundIndex, nowMs);
          return true;
        }

        return false;
      case "Elimination":
        if (
          this.eliminationDeadlineAtMs !== null &&
          nowMs >= this.eliminationDeadlineAtMs
        ) {
          this.eliminationDeadlineAtMs = null;

          const maxRounds = this.featureFlags.enablePhaseExpansion ? 12 : 8;
          if (this.gameLoopState.alivePlayerIds.length <= 1 || this.gameLoopState.roundIndex === maxRounds || this.gameLoopState.dominationCount >= 5) {
            this.gameLoopState.transitionTo("End");
            return true;
          }

          this.pendingRoundDamageByPlayer.clear();
          this.applyPrepIncome();
          this.refreshShopsForPrep();
          this.hpAtBattleStartByPlayer = new Map<string, number>();
          this.hpAfterBattleByPlayer = new Map<string, number>();
          this.battleParticipantIds = [];
          this.currentRoundPairings = [];
          this.battleInputSnapshotByPlayer.clear();
          this.gameLoopState.transitionTo("Prep");
          this.resetPhaseProgressForRound(this.gameLoopState.roundIndex);
          this.prepDeadlineAtMs = nowMs + this.prepDurationMs;
          this.matchLogger?.logRoundTransition("Prep", this.gameLoopState.roundIndex, nowMs);
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
    commandPayload?: CommandPayload,
  ): CommandResult {
    // Step 1: Build validation dependencies
    const validationDeps: ValidationDependencies = {
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
    };

    // Step 2: Validate the command
    const validationError = validatePrepCommand(
      playerId,
      cmdSeq,
      receivedAtMs,
      commandPayload ?? {},
      validationDeps,
    );

    if (validationError) {
      return validationError;
    }

    // Step 3: Build execution dependencies
    const executionDeps: ExecutionDependencies = {
      setBoardUnitCount: (id, count) => this.boardUnitCountByPlayer.set(id, count),
      setBoardPlacements: (id, placements) => this.boardPlacementsByPlayer.set(id, placements),
      setShopLock: (id, locked) => this.shopLockedByPlayer.set(id, locked),
      setLastCmdSeq: (id, seq) => this.lastCmdSeqByPlayer.set(id, seq),
      addGold: (id, amount) => {
        const current = this.goldByPlayer.get(id) ?? INITIAL_GOLD;
        this.goldByPlayer.set(id, current + amount);
      },
      addXp: (id, amount) => this.addXp(id, amount),
      refreshShop: (id, count) => this.refreshShopByCount(id, count),
      buyShopOffer: (id, slotIndex) => this.buyShopOfferBySlot(id, slotIndex),
      deployBenchUnitToBoard: (id, benchIndex, cell) =>
        this.deployBenchUnitToBoard(id, benchIndex, cell),
      sellBenchUnit: (id, benchIndex) => this.sellBenchUnit(id, benchIndex),
      sellBoardUnit: (id, cell) => this.sellBoardUnit(id, cell),
      addItemToInventory: (id, itemType) => {
        const inventory = this.itemInventoryByPlayer.get(id);
        if (inventory) {
          inventory.push(itemType);
          this.tryGrantNijiRyuudouFirstItemDraw(id);
        }
      },
      equipItemToBenchUnit: (id, inventoryItemIndex, benchIndex) => {
        const inventory = this.itemInventoryByPlayer.get(id);
        const benchUnits = this.benchUnitsByPlayer.get(id);
        if (inventory && benchUnits) {
          const benchUnit = benchUnits[benchIndex];
          if (benchUnit) {
            const item = inventory[inventoryItemIndex];
            if (item !== undefined) {
              inventory.splice(inventoryItemIndex, 1);
              benchUnit.items = benchUnit.items || [];
              benchUnit.items.push(item);
              this.tryGrantNijiRyuudouFirstItemDraw(id);
            }
          }
        }
      },
      unequipItemFromBenchUnit: (id, benchIndex, itemSlotIndex) => {
        const benchUnits = this.benchUnitsByPlayer.get(id);
        const inventory = this.itemInventoryByPlayer.get(id);
        if (benchUnits && inventory) {
          const benchUnit = benchUnits[benchIndex];
          if (benchUnit?.items) {
            const item = benchUnit.items[itemSlotIndex];
            if (item !== undefined) {
              benchUnit.items.splice(itemSlotIndex, 1);
              inventory.push(item);
            }
          }
        }
      },
      sellInventoryItem: (id, inventoryItemIndex) => {
        const inventory = this.itemInventoryByPlayer.get(id);
        if (inventory) {
          const item = inventory[inventoryItemIndex];
          if (item !== undefined) {
            const itemDef = ITEM_DEFINITIONS[item];
            const sellValue = Math.floor(itemDef.cost / 2);
            inventory.splice(inventoryItemIndex, 1);
            const currentGold = this.goldByPlayer.get(id) || 0;
            this.goldByPlayer.set(id, currentGold + sellValue);
          }
        }
      },
      buyBossShopOffer: (id, slotIndex) => {
        const bossOffers = this.getBossShopOffersForPlayer(id);
        const benchUnits = this.benchUnitsByPlayer.get(id) ?? [];
        if (bossOffers && slotIndex < bossOffers.length) {
          const bossOffer = bossOffers[slotIndex];
          if (bossOffer && !bossOffer.purchased) {
            benchUnits.push({
              unitType: bossOffer.unitType,
              cost: bossOffer.cost,
              starLevel: bossOffer.starLevel ?? STAR_LEVEL_MIN,
              unitCount: 1,
            });
            this.benchUnitsByPlayer.set(id, benchUnits);
            bossOffer.purchased = true;
          }
        }
      },
      getBenchUnits: (id) => this.benchUnitsByPlayer.get(id) ?? [],
      getOwnedUnits: (id) => this.ownedUnitsByPlayer.get(id) ?? { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
      getItemInventory: (id) => this.itemInventoryByPlayer.get(id) ?? [],
      getBoardPlacements: (id) => this.boardPlacementsByPlayer.get(id) ?? [],
      getShopOffers: (id) => this.shopOffersByPlayer.get(id) ?? [],
      getItemShopOffers: (id) => this.itemShopOffersByPlayer.get(id) ?? [],
      getBossShopOffers: (id) => this.bossShopOffersByPlayer.get(id) ?? [],
      getRosterFlags: () => this.rosterFlags,
      logBossShop: (id, offers, purchase) => {
        const state = this.ensureStarted();
        this.matchLogger?.logBossShop(
          state.roundIndex,
          id,
          offers,
          purchase,
        );
      },
    };

    // Step 4: Execute the command
    return executePrepCommand(playerId, cmdSeq, commandPayload ?? {}, executionDeps);
  }

  private applyPrepIncome(): void {
    const state = this.ensureStarted();

    for (const playerId of state.alivePlayerIds) {
      const currentGold = this.goldByPlayer.get(playerId) ?? INITIAL_GOLD;
      this.goldByPlayer.set(playerId, currentGold + PREP_BASE_INCOME);
    }
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

    for (const playerId of state.playerIds) {
      this.shopRefreshCountByPlayer.set(playerId, 0);
      this.shopPurchaseCountByPlayer.set(playerId, 0);
      this.shopLockedByPlayer.set(playerId, false);
      this.nijiRyuudouFirstItemDrawConsumedByPlayer.set(playerId, false);
      const isRumorEligible = this.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;
      this.shopOffersByPlayer.set(
        playerId,
        this.shopOfferBuilder.buildShopOffers(
          playerId,
          state.roundIndex,
          0,
          0,
          isRumorEligible,
        ),
      );

      // Initialize item shops
      if (!this.shopLockedByPlayer.get(playerId)) {
        const itemOffers = this.shopOfferBuilder.buildItemShopOffers(ITEM_TYPES, ITEM_DEFINITIONS);
        this.itemShopOffersByPlayer.set(playerId, itemOffers);
      }

      // 噂勢力: ショップ初期化時にeligibleフラグをリセット
      if (this.enableRumorInfluence) {
        this.rumorInfluenceEligibleByPlayer.set(playerId, false);
      }

      // ボス専用ショップ: ボスプレイヤーに初期化
      if (this.enableBossExclusiveShop && state.isBoss(playerId)) {
        this.bossShopOffersByPlayer.set(
          playerId,
          this.shopOfferBuilder.buildBossShopOffers(),
        );
      }
    }
  }

  private refreshShopsForPrep(): void {
    const state = this.ensureStarted();

    for (const playerId of state.alivePlayerIds) {
      const locked = this.shopLockedByPlayer.get(playerId) ?? false;

      if (locked) {
        continue;
      }

      this.shopRefreshCountByPlayer.set(playerId, 0);
      this.shopPurchaseCountByPlayer.set(playerId, 0);
      this.nijiRyuudouFirstItemDrawConsumedByPlayer.set(playerId, false);
      const isRumorEligible = this.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;
      this.shopOffersByPlayer.set(
        playerId,
        this.shopOfferBuilder.buildShopOffers(
          playerId,
          state.roundIndex,
          0,
          0,
          isRumorEligible,
        ),
      );

      // 噂勢力: ショップ生成後、eligibleフラグをリセット
      if (this.enableRumorInfluence) {
        this.rumorInfluenceEligibleByPlayer.set(playerId, false);
      }

      // ボス専用ショップ: ボスプレイヤーを更新
      if (this.enableBossExclusiveShop && state.isBoss(playerId)) {
        this.bossShopOffersByPlayer.set(
          playerId,
          this.shopOfferBuilder.buildBossShopOffers(),
        );
      }
    }

    // Clear battle results at the start of each new Prep phase
    this.battleResultsByPlayer.clear();
  }

  private refreshShopByCount(playerId: string, refreshCount: number): void {
    const state = this.ensureStarted();
    const previousOffers = this.shopOffersByPlayer.get(playerId) ?? [];
    const currentCount = this.shopRefreshCountByPlayer.get(playerId) ?? 0;
    const nextCount = currentCount + refreshCount;
    const isRumorEligible = this.rumorInfluenceEligibleByPlayer.get(playerId) ?? false;
    let nextOffers = this.shopOfferBuilder.buildShopOffers(
      playerId,
      state.roundIndex,
      nextCount,
      0,
      isRumorEligible,
    );

    if (this.areShopOffersEqual(previousOffers, nextOffers)) {
      nextOffers = this.shopOfferBuilder.buildShopOffers(
        playerId,
        state.roundIndex,
        nextCount,
        1,
        isRumorEligible,
      );
    }

    this.shopRefreshCountByPlayer.set(playerId, nextCount);
    this.shopPurchaseCountByPlayer.set(playerId, 0);
    this.shopOffersByPlayer.set(playerId, nextOffers);
  }

  private areShopOffersEqual(left: ShopOffer[], right: ShopOffer[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      const leftOffer = left[index];
      const rightOffer = right[index];

      if (!leftOffer || !rightOffer) {
        return false;
      }

      const leftKey: ShopOfferKey = `${leftOffer.unitId ?? leftOffer.unitType}:${leftOffer.rarity}:${leftOffer.cost}`;
      const rightKey: ShopOfferKey = `${rightOffer.unitId ?? rightOffer.unitType}:${rightOffer.rarity}:${rightOffer.cost}`;

      if (leftKey !== rightKey) {
        return false;
      }
    }

    return true;
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

    const purchasedBenchUnit: BenchUnit = {
      unitType: boughtOffer.unitType,
      cost: boughtOffer.cost,
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
    this.nijiRyuudouFirstItemDrawConsumedByPlayer.delete(playerId);
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

    for (let i = 0; i < count; i += 1) {
      if (this.rosterFlags.enablePerUnitSharedPool && unitId) {
        this.sharedPool.increaseByUnitId(unitId, cost);
      } else {
        this.sharedPool.increase(cost);
      }
    }
  }

  private tryGrantNijiRyuudouFirstItemDraw(playerId: string): void {
    if (this.nijiRyuudouFirstItemDrawConsumedByPlayer.get(playerId)) {
      return;
    }

    if (!this.hasActiveNijiRyuudouFirstItemDraw(playerId)) {
      return;
    }

    const inventory = this.itemInventoryByPlayer.get(playerId);

    if (!inventory || inventory.length >= MAX_INVENTORY_SIZE) {
      return;
    }

    const bonusOffer = this.shopOfferBuilder.buildItemShopOffers(ITEM_TYPES, ITEM_DEFINITIONS)[0];

    if (!bonusOffer) {
      return;
    }

    inventory.push(bonusOffer.itemType);
    this.nijiRyuudouFirstItemDrawConsumedByPlayer.set(playerId, true);
  }

  private hasActiveNijiRyuudouFirstItemDraw(playerId: string): boolean {
    if (!this.rosterFlags.enableTouhouFactions) {
      return false;
    }

    const placements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const resolvedPlacements = resolveBattlePlacements(placements, this.rosterFlags);
    const synergyDetails = calculateSynergyDetails(
      resolvedPlacements,
      null,
      { enableTouhouFactions: true },
    );
    const tier = synergyDetails.factionActiveTiers.niji_ryuudou ?? 0;
    const factionEffect = getTouhouFactionTierEffect("niji_ryuudou", tier);

    return (factionEffect?.special?.firstItemUseDraws ?? 0) > 0;
  }

  private calculateActiveSynergies(
    placements: BoardUnitPlacement[],
    heroSynergyBonusType: BoardUnitType | null = null,
    playerId?: string, // ログ記録用
  ): { unitType: string; count: number; tier: number }[] {
    if (!placements) {
      return [];
    }

    const resolvedPlacements = resolveBattlePlacements(placements, this.rosterFlags);
    const synergyDetails = calculateSynergyDetails(
      resolvedPlacements,
      heroSynergyBonusType,
      { enableTouhouFactions: this.rosterFlags.enableTouhouFactions },
    );

    const result: { unitType: string; count: number; tier: number }[] = [];

    const unitTypes: BoardUnitType[] = ["vanguard", "ranger", "mage", "assassin"];

    for (const type of unitTypes) {
      const count = synergyDetails.countsByType[type] ?? 0;
      const tier = synergyDetails.activeTiers[type] ?? 0;

      if (count > 0) {
        result.push({ unitType: type, count, tier });
      }
    }

    if (this.rosterFlags.enableTouhouFactions) {
      for (const [factionId, count] of Object.entries(synergyDetails.factionCounts)) {
        if (!count || count <= 0) {
          continue;
        }

        result.push({
          unitType: factionId,
          count,
          tier: synergyDetails.factionActiveTiers[factionId as keyof typeof synergyDetails.factionActiveTiers] ?? 0,
        });
      }
    }

    if (calculateScarletMansionSynergy(placements)) {
      result.push({ unitType: "scarletMansion", count: 2, tier: 1 });
    }

    // シナジー発動ログを記録（playerIdが指定されている場合のみ）
    if (playerId && this.matchLogger) {
      const state = this.gameLoopState;
      if (state) {
        for (const synergy of result) {
          if (synergy.tier > 0) {
            this.matchLogger.logSynergyActivation(
              state.roundIndex,
              playerId,
              synergy.unitType,
              synergy.count,
              [{ type: 'tier', value: synergy.tier }],
            );
          }
        }
      }
    }

    return result;
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
    let totalDamage = 0;

    for (const damageValue of this.pendingRoundDamageByPlayer.values()) {
      totalDamage += damageValue;
    }

    this.phaseHpTarget = targetHp;
    this.phaseDamageDealt = totalDamage;
    this.phaseResult = totalDamage >= targetHp ? "success" : "failed";
    this.phaseCompletionRate = targetHp > 0 ? totalDamage / targetHp : 0;

    // 支配カウント: ボス優勢（フェーズ失敗）時にカウントアップ（R12以外）
    if (this.phaseResult === "failed" && state.roundIndex < 12) {
      state.dominationCount += 1;
    }

    const nextRoundRumorUnit = getRumorUnitForRound(state.roundIndex + 1);
    const rumorFactions = nextRoundRumorUnit ? [nextRoundRumorUnit.unitType] : [];
    const guaranteedRumorSlotApplied =
      this.enableRumorInfluence &&
      this.phaseResult === "success" &&
      rumorFactions.length > 0;

    if (this.matchLogger) {
      this.matchLogger.logRumorInfluence(
        state.roundIndex,
        rumorFactions,
        guaranteedRumorSlotApplied,
      );
    }

    // 噂勢力: フェーズ成功時、全レイドプレイヤーを次ラウンド eligible に設定
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

  private resetPhaseProgressForRound(roundIndex: number): void {
    this.phaseHpTarget = this.resolvePhaseHpTarget(roundIndex);
    this.phaseDamageDealt = 0;
    this.phaseResult = "pending";
    this.phaseCompletionRate = 0;
  }

  private resolvePhaseHpTarget(roundIndex: number): number {
    if (roundIndex <= 1) {
      return PHASE_HP_TARGET_BY_ROUND[1] ?? 400;
    }

    if (PHASE_HP_TARGET_BY_ROUND[roundIndex] !== undefined) {
      return PHASE_HP_TARGET_BY_ROUND[roundIndex];
    }

    return PHASE_HP_TARGET_BY_ROUND[12] ?? 0;
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

  private resolveMatchupOutcome(leftPlayerId: string, rightPlayerId: string): MatchupOutcome {
    const leftPlacements = this.battleInputSnapshotByPlayer.get(leftPlayerId) ?? [];
    const rightPlacements = this.battleInputSnapshotByPlayer.get(rightPlayerId) ?? [];
    const leftResolvedPlacements = resolveBattlePlacements(leftPlacements, this.rosterFlags);
    const rightResolvedPlacements = resolveBattlePlacements(rightPlacements, this.rosterFlags);

    // ボード配置をBattleUnitに変換
    const leftBattleUnits: BattleUnit[] = leftResolvedPlacements.map((placement, index) =>
      createBattleUnit(placement, "left", index, false, this.rosterFlags),
    );

    const rightBattleUnits: BattleUnit[] = rightResolvedPlacements.map((placement, index) =>
      createBattleUnit(placement, "right", index, false, this.rosterFlags),
    );

    // スペル効果を適用
    const leftModifiers = this.spellCardHandler.getCombatModifiersForPlayer(leftPlayerId);
    this.battleResolutionService.applySpellModifiers(leftBattleUnits, leftModifiers);
    const rightModifiers = this.spellCardHandler.getCombatModifiersForPlayer(rightPlayerId);
    this.battleResolutionService.applySpellModifiers(rightBattleUnits, rightModifiers);

    // 主人公を追加（選択されている場合）
    const leftHeroId = this.selectedHeroByPlayer.get(leftPlayerId);
    const leftHeroBattleUnit = this.battleResolutionService.createHeroBattleUnit(leftHeroId, leftPlayerId);
    if (leftHeroBattleUnit) {
      leftBattleUnits.push(leftHeroBattleUnit);
    }

    const rightHeroId = this.selectedHeroByPlayer.get(rightPlayerId);
    const rightHeroBattleUnit = this.battleResolutionService.createHeroBattleUnit(rightHeroId, rightPlayerId);
    if (rightHeroBattleUnit) {
      rightBattleUnits.push(rightHeroBattleUnit);
    }

    const leftHeroSynergyBonusType = this.battleResolutionService.getHeroSynergyBonusType(leftHeroId);
    const rightHeroSynergyBonusType = this.battleResolutionService.getHeroSynergyBonusType(rightHeroId);

    // T3: 戦闘入力トレースログ（Battle開始時スナップショット）
    const battleId = `r${this.roundIndex}-${leftPlayerId}-${rightPlayerId}`;
    const battleTraceLog = this.battleResolutionService.createBattleTraceLog({
      battleId,
        roundIndex: this.roundIndex,
        leftPlayerId,
        rightPlayerId,
        leftPlacements: leftResolvedPlacements,
        rightPlacements: rightResolvedPlacements,
        leftHeroId: leftHeroId ?? null,
        rightHeroId: rightHeroId ?? null,
      });
    // T3: 常時出力（環境変数依存を廃止）
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(battleTraceLog));

    // バトル解決サービスで戦闘を実行
    const battleIndex = this.currentRoundPairings.findIndex(
      (p) => p.leftPlayerId === leftPlayerId && p.rightPlayerId === rightPlayerId,
    );

    const resolutionResult = this.battleResolutionService.resolveMatchup({
      battleId,
      roundIndex: this.roundIndex,
      leftPlayerId,
      rightPlayerId,
      leftPlacements: leftResolvedPlacements,
      rightPlacements: rightResolvedPlacements,
      leftBattleUnits,
      rightBattleUnits,
      leftHeroSynergyBonusType,
      rightHeroSynergyBonusType,
      battleIndex,
    });

    // Store battle results in controller state
    this.battleResultsByPlayer.set(leftPlayerId, resolutionResult.leftBattleResult);
    this.battleResultsByPlayer.set(rightPlayerId, resolutionResult.rightBattleResult);

    // Log battle result trace
    const { outcome } = resolutionResult;
    let winner: "left" | "right" | "draw";
    let leftDamageTaken: number;
    let rightDamageTaken: number;

    if (outcome.isDraw) {
      winner = "draw";
      leftDamageTaken = 0;
      rightDamageTaken = 0;
    } else if (outcome.winnerId === leftPlayerId) {
      winner = "left";
      leftDamageTaken = 0;
      rightDamageTaken = resolutionResult.rightBattleResult.damageTaken;
    } else {
      winner = "right";
      leftDamageTaken = resolutionResult.leftBattleResult.damageTaken;
      rightDamageTaken = 0;
    }

    this.logBattleResultTrace({
      battleId,
      leftPlayerId,
      rightPlayerId,
      winner,
      leftSurvivors: resolutionResult.leftBattleResult.survivors,
      rightSurvivors: resolutionResult.rightBattleResult.survivors,
      leftDamageTaken,
      rightDamageTaken,
    });

    return outcome;
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

    // T3: 常時出力（環境変数依存を廃止）
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(resultTraceLog));
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
