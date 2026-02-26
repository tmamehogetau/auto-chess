import { GameLoopState, type Phase } from "../domain/game-loop-state";
import type {
  BoardUnitType,
  BoardUnitPlacement,
  CommandResult,
  ShopItemOffer,
} from "../shared/room-messages";
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
  STAR_LEVEL_MAX,
  STAR_LEVEL_MIN,
  STAR_MERGE_THRESHOLD,
  UNIT_SELL_VALUE_BY_TYPE,
  calculateSellValue,
} from "./star-level-config";

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
const MAX_BENCH_SIZE = 9;
const MIN_BOARD_CELL_INDEX = 0;
const MAX_BOARD_CELL_INDEX = 7;
const MAX_LEVEL = 6;

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

type UnitRarity = 1 | 2 | 3;

interface ShopOffer {
  unitType: BoardUnitType;
  rarity: UnitRarity;
  cost: number;
}

interface OwnedUnits {
  vanguard: number;
  ranger: number;
  mage: number;
  assassin: number;
}

interface BenchUnit {
  unitType: BoardUnitType;
  cost: number;
  starLevel: number;
  unitCount: number;
  items?: ItemType[];
}

type ShopOfferKey = `${BoardUnitType}:${UnitRarity}:${number}`;

const SHOP_UNIT_POOL_BY_RARITY: Readonly<Record<UnitRarity, readonly BoardUnitType[]>> = {
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

interface BattleResult {
  opponentId: string;
  won: boolean;
  damageDealt: number;
  damageTaken: number;
  survivors: number;
  opponentSurvivors: number;
}

export class MatchRoomController {
  private readonly playerIds: string[];

  private readonly readyPlayers: Set<string>;

  private readonly lastCmdSeqByPlayer: Map<string, number>;

  private readonly boardUnitCountByPlayer: Map<string, number>;

  private readonly boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;

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

  private readonly battleResultsByPlayer: Map<string, BattleResult>;

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
    this.battleResultsByPlayer = new Map<string, BattleResult>();
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
    this.initializeShopsForPrep();
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
    gold: number;
    xp: number;
    level: number;
    shopOffers: ShopOffer[];
    shopLocked: boolean;
    benchUnits: string[];
    boardUnits: string[];
    ownedUnits: OwnedUnits;
    itemInventory: ItemType[];
    itemShopOffers: ShopItemOffer[];
    lastBattleResult: BattleResult | undefined;
    activeSynergies?: { unitType: string; count: number; tier: number }[];
  } {
    const state = this.ensureStarted();
    const ownedUnits = this.ownedUnitsByPlayer.get(playerId);
    const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];
    const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
    const itemInventory = this.itemInventoryByPlayer.get(playerId) ?? [];
    const itemShopOffers = this.itemShopOffersByPlayer.get(playerId) ?? [];

    // Calculate active synergies
    const activeSynergies = this.calculateActiveSynergies(boardPlacements);

    return {
      hp: state.getPlayerHp(playerId),
      eliminated: state.isPlayerEliminated(playerId),
      boardUnitCount: this.boardUnitCountByPlayer.get(playerId) ?? 4,
      gold: this.goldByPlayer.get(playerId) ?? INITIAL_GOLD,
      xp: this.xpByPlayer.get(playerId) ?? INITIAL_XP,
      level: this.levelByPlayer.get(playerId) ?? INITIAL_LEVEL,
      shopOffers: [...(this.shopOffersByPlayer.get(playerId) ?? [])],
      shopLocked: this.shopLockedByPlayer.get(playerId) ?? false,
      benchUnits: benchUnits.map((benchUnit) =>
        benchUnit.starLevel > 1
          ? `${benchUnit.unitType}★${benchUnit.starLevel}`
          : benchUnit.unitType,
      ),
      boardUnits: boardPlacements.map((placement) => {
        const starLevel = placement.starLevel ?? 1;

        if (starLevel > 1) {
          return `${placement.cell}:${placement.unitType}★${starLevel}`;
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
      lastBattleResult: this.battleResultsByPlayer.get(playerId),
      activeSynergies,
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
          this.applyPrepIncome();
          this.refreshShopsForPrep();
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
      xpPurchaseCount?: number;
      shopRefreshCount?: number;
      shopBuySlotIndex?: number;
      shopLock?: boolean;
      benchToBoardCell?: {
        benchIndex: number;
        cell: number;
      };
      benchSellIndex?: number;
      boardSellIndex?: number;
      itemBuySlotIndex?: number;
      itemEquipToBench?: {
        inventoryItemIndex: number;
        benchIndex: number;
      };
      itemUnequipFromBench?: {
        benchIndex: number;
        itemSlotIndex: number;
      };
      itemSellInventoryIndex?: number;
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

    let xpPurchaseCount = 0;
    let shopRefreshCount = 0;
    let shopBuySlotIndex: number | null = null;
    let benchToBoardCell:
      | {
          benchIndex: number;
          cell: number;
        }
      | null = null;
    let benchSellIndex: number | null = null;
    let boardSellIndex: number | null = null;
    let itemBuySlotIndex: number | null = null;
    let itemEquipToBench:
      | {
          inventoryItemIndex: number;
          benchIndex: number;
        }
      | null = null;
    let itemUnequipFromBench:
      | {
          benchIndex: number;
          itemSlotIndex: number;
        }
      | null = null;
    let itemSellInventoryIndex: number | null = null;

    if (commandPayload?.xpPurchaseCount !== undefined) {
      xpPurchaseCount = commandPayload.xpPurchaseCount;

      if (
        !Number.isInteger(xpPurchaseCount) ||
        xpPurchaseCount < 1 ||
        xpPurchaseCount > MAX_XP_PURCHASE_COUNT
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (commandPayload?.shopRefreshCount !== undefined) {
      shopRefreshCount = commandPayload.shopRefreshCount;

      if (
        !Number.isInteger(shopRefreshCount) ||
        shopRefreshCount < 1 ||
        shopRefreshCount > MAX_SHOP_REFRESH_COUNT
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (commandPayload?.shopBuySlotIndex !== undefined) {
      shopBuySlotIndex = commandPayload.shopBuySlotIndex;

      if (
        !Number.isInteger(shopBuySlotIndex) ||
        shopBuySlotIndex < 0 ||
        shopBuySlotIndex > MAX_SHOP_BUY_SLOT_INDEX
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (shopBuySlotIndex !== null && shopRefreshCount > 0) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (commandPayload?.benchToBoardCell !== undefined) {
      const benchIndex = commandPayload.benchToBoardCell.benchIndex;
      const cell = commandPayload.benchToBoardCell.cell;

      if (
        !Number.isInteger(benchIndex) ||
        benchIndex < 0 ||
        !Number.isInteger(cell) ||
        cell < MIN_BOARD_CELL_INDEX ||
        cell > MAX_BOARD_CELL_INDEX
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      benchToBoardCell = {
        benchIndex,
        cell,
      };
    }

    if (commandPayload?.benchSellIndex !== undefined) {
      benchSellIndex = commandPayload.benchSellIndex;

      if (!Number.isInteger(benchSellIndex) || benchSellIndex < 0) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (commandPayload?.boardSellIndex !== undefined) {
      boardSellIndex = commandPayload.boardSellIndex;

      if (
        !Number.isInteger(boardSellIndex) ||
        boardSellIndex < MIN_BOARD_CELL_INDEX ||
        boardSellIndex > MAX_BOARD_CELL_INDEX
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (commandPayload?.itemBuySlotIndex !== undefined) {
      itemBuySlotIndex = commandPayload.itemBuySlotIndex;

      if (
        !Number.isInteger(itemBuySlotIndex) ||
        itemBuySlotIndex < 0 ||
        itemBuySlotIndex >= ITEM_SHOP_SIZE
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (commandPayload?.itemEquipToBench !== undefined) {
      const inventoryItemIndex = commandPayload.itemEquipToBench.inventoryItemIndex;
      const benchIndex = commandPayload.itemEquipToBench.benchIndex;

      if (
        !Number.isInteger(inventoryItemIndex) ||
        !Number.isInteger(benchIndex) ||
        inventoryItemIndex < 0 ||
        benchIndex < 0
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      const inventory = this.itemInventoryByPlayer.get(playerId);
      const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];

      if (!inventory || inventoryItemIndex >= inventory.length) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (benchIndex >= benchUnits.length) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      const benchUnit = benchUnits[benchIndex];
      if (!benchUnit) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
      const currentItems = benchUnit.items || [];

      if (currentItems.length >= MAX_ITEMS_PER_UNIT) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      itemEquipToBench = {
        inventoryItemIndex,
        benchIndex,
      };
    }

    if (commandPayload?.itemUnequipFromBench !== undefined) {
      const benchIndex = commandPayload.itemUnequipFromBench.benchIndex;
      const itemSlotIndex = commandPayload.itemUnequipFromBench.itemSlotIndex;

      if (
        !Number.isInteger(benchIndex) ||
        !Number.isInteger(itemSlotIndex) ||
        benchIndex < 0 ||
        itemSlotIndex < 0
      ) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];
      const inventory = this.itemInventoryByPlayer.get(playerId);

      if (benchIndex >= benchUnits.length) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (!inventory || inventory.length >= MAX_INVENTORY_SIZE) {
        return { accepted: false, code: "INVENTORY_FULL" };
      }

      const benchUnit = benchUnits[benchIndex];
      if (!benchUnit) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
      const currentItems = benchUnit.items || [];

      if (itemSlotIndex >= currentItems.length) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      itemUnequipFromBench = {
        benchIndex,
        itemSlotIndex,
      };
    }

    if (commandPayload?.itemSellInventoryIndex !== undefined) {
      const index = commandPayload.itemSellInventoryIndex;

      if (!Number.isInteger(index) || index < 0) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      const inventory = this.itemInventoryByPlayer.get(playerId);

      if (!inventory || index >= inventory.length) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      itemSellInventoryIndex = index;
    }

    if (benchToBoardCell && benchSellIndex !== null) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (benchSellIndex !== null && shopBuySlotIndex !== null) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (boardSellIndex !== null && benchToBoardCell) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (boardSellIndex !== null && benchSellIndex !== null) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (boardSellIndex !== null && shopBuySlotIndex !== null) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (
      boardSellIndex !== null &&
      (commandPayload?.boardUnitCount !== undefined || commandPayload?.boardPlacements !== undefined)
    ) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (itemBuySlotIndex !== null && shopRefreshCount > 0) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (itemBuySlotIndex !== null && shopBuySlotIndex !== null) {
      return { accepted: false, code: "INVALID_PAYLOAD" };
    }

    if (benchToBoardCell) {
      const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];
      const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
      const currentBoardUnitCount = this.resolveUnitCount(playerId);

      if (!benchUnits[benchToBoardCell.benchIndex]) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (currentBoardUnitCount >= 8) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      const duplicatedCell = boardPlacements.some(
        (placement) => placement.cell === benchToBoardCell?.cell,
      );

      if (duplicatedCell) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (benchSellIndex !== null) {
      const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];

      if (!benchUnits[benchSellIndex]) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    if (boardSellIndex !== null) {
      const boardPlacements = this.boardPlacementsByPlayer.get(playerId) ?? [];
      const hasBoardUnit = boardPlacements.some((placement) => placement.cell === boardSellIndex);

      if (!hasBoardUnit) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }
    }

    let shopBuyCost = 0;

    if (shopBuySlotIndex !== null) {
      const offers = this.shopOffersByPlayer.get(playerId) ?? [];
      const targetOffer = offers[shopBuySlotIndex];
      const benchUnits = this.benchUnitsByPlayer.get(playerId) ?? [];

      if (!targetOffer) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (benchUnits.length >= MAX_BENCH_SIZE) {
        return { accepted: false, code: "BENCH_FULL" };
      }

      shopBuyCost = targetOffer.cost;
    }

    let itemBuyCost = 0;

    if (itemBuySlotIndex !== null) {
      const itemShop = this.itemShopOffersByPlayer.get(playerId);

      if (!itemShop || itemBuySlotIndex < 0 || itemBuySlotIndex >= itemShop.length) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      const offer = itemShop[itemBuySlotIndex];
      const inventory = this.itemInventoryByPlayer.get(playerId);

      if (!offer) {
        return { accepted: false, code: "INVALID_PAYLOAD" };
      }

      if (!inventory || inventory.length >= MAX_INVENTORY_SIZE) {
        return { accepted: false, code: "INVENTORY_FULL" };
      }

      itemBuyCost = offer.cost;
    }

    if (xpPurchaseCount > 0 || shopRefreshCount > 0 || shopBuyCost > 0 || itemBuyCost > 0) {
      const currentGold = this.goldByPlayer.get(playerId) ?? INITIAL_GOLD;
      const requiredGold =
        XP_PURCHASE_COST * xpPurchaseCount +
        SHOP_REFRESH_COST * shopRefreshCount +
        shopBuyCost +
        itemBuyCost;

      if (currentGold < requiredGold) {
        return { accepted: false, code: "INSUFFICIENT_GOLD" };
      }

      this.goldByPlayer.set(playerId, currentGold - requiredGold);

      if (xpPurchaseCount > 0) {
        this.addXp(playerId, XP_PURCHASE_GAIN * xpPurchaseCount);
      }

      if (shopRefreshCount > 0) {
        this.refreshShopByCount(playerId, shopRefreshCount);
      }

      if (shopBuySlotIndex !== null) {
        this.buyShopOfferBySlot(playerId, shopBuySlotIndex);
      }

      if (itemBuySlotIndex !== null) {
        const itemShop = this.itemShopOffersByPlayer.get(playerId);
        const inventory = this.itemInventoryByPlayer.get(playerId);

        if (itemShop && inventory) {
          const offer = itemShop[itemBuySlotIndex];
          if (offer) {
            inventory.push(offer.itemType);
          }
        }
      }
    }

    if (commandPayload?.shopLock !== undefined) {
      this.shopLockedByPlayer.set(playerId, commandPayload.shopLock);
    }

    if (benchToBoardCell) {
      this.deployBenchUnitToBoard(playerId, benchToBoardCell.benchIndex, benchToBoardCell.cell);
    }

    if (benchSellIndex !== null) {
      this.sellBenchUnit(playerId, benchSellIndex);
    }

    if (boardSellIndex !== null) {
      this.sellBoardUnit(playerId, boardSellIndex);
    }

    // Handle item equip to bench
    if (itemEquipToBench) {
      const { inventoryItemIndex, benchIndex } = itemEquipToBench;
      const inventory = this.itemInventoryByPlayer.get(playerId);
      const benchUnits = this.benchUnitsByPlayer.get(playerId);

      if (inventory && benchUnits) {
        const benchUnit = benchUnits[benchIndex];
        if (!benchUnit) {
          /* Should not happen due to validation */
        } else {
          const currentItems = benchUnit.items || [];

          // Move item from inventory to bench unit
          const item = inventory[inventoryItemIndex];
          if (item !== undefined) {
            inventory.splice(inventoryItemIndex, 1);
            currentItems.push(item);
            benchUnit.items = currentItems;
          }
        }
      }
    }

    // Handle item unequip from bench
    if (itemUnequipFromBench) {
      const { benchIndex, itemSlotIndex } = itemUnequipFromBench;
      const benchUnits = this.benchUnitsByPlayer.get(playerId);
      const inventory = this.itemInventoryByPlayer.get(playerId);

      if (benchUnits && inventory) {
        const benchUnit = benchUnits[benchIndex];
        if (!benchUnit) {
          /* Should not happen due to validation */
        } else {
          const currentItems = benchUnit.items || [];

          // Move item from bench unit to inventory
          const item = currentItems[itemSlotIndex];
          if (item !== undefined) {
            currentItems.splice(itemSlotIndex, 1);
            inventory.push(item);
          }
        }
      }
    }

    // Handle item sell
    if (itemSellInventoryIndex !== null) {
      const inventory = this.itemInventoryByPlayer.get(playerId);

      if (inventory) {
        const item = inventory[itemSellInventoryIndex];
        if (item !== undefined) {
          const itemDef = ITEM_DEFINITIONS[item];
          const sellValue = Math.floor(itemDef.cost / 2);

          // Remove from inventory and add gold
          inventory.splice(itemSellInventoryIndex, 1);
          const currentGold = this.goldByPlayer.get(playerId) || 0;
          this.goldByPlayer.set(playerId, currentGold + sellValue);
        }
      }
    }

    this.lastCmdSeqByPlayer.set(playerId, cmdSeq);

    return { accepted: true };
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
      this.shopOffersByPlayer.set(
        playerId,
        this.buildShopOffers(playerId, state.roundIndex, 0, 0),
      );

      // Initialize item shops
      if (!this.shopLockedByPlayer.get(playerId)) {
        const itemOffers = this.buildItemShopOffers();
        this.itemShopOffersByPlayer.set(playerId, itemOffers);
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
      this.shopOffersByPlayer.set(
        playerId,
        this.buildShopOffers(playerId, state.roundIndex, 0, 0),
      );
    }

    // Clear battle results at the start of each new Prep phase
    this.battleResultsByPlayer.clear();
  }

  private refreshShopByCount(playerId: string, refreshCount: number): void {
    const state = this.ensureStarted();
    const previousOffers = this.shopOffersByPlayer.get(playerId) ?? [];
    const currentCount = this.shopRefreshCountByPlayer.get(playerId) ?? 0;
    const nextCount = currentCount + refreshCount;
    let nextOffers = this.buildShopOffers(playerId, state.roundIndex, nextCount, 0);

    if (this.areShopOffersEqual(previousOffers, nextOffers)) {
      nextOffers = this.buildShopOffers(playerId, state.roundIndex, nextCount, 1);
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

      const leftKey: ShopOfferKey = `${leftOffer.unitType}:${leftOffer.rarity}:${leftOffer.cost}`;
      const rightKey: ShopOfferKey = `${rightOffer.unitType}:${rightOffer.rarity}:${rightOffer.cost}`;

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

    offers.splice(slotIndex, 1);
    offers.push(
      this.buildSingleShopOffer(
        playerId,
        state.roundIndex,
        refreshCount,
        SHOP_SIZE + purchaseCount,
      ),
    );

    this.shopPurchaseCountByPlayer.set(playerId, purchaseCount);
    this.shopOffersByPlayer.set(playerId, offers);

    const benchUnits = [...(this.benchUnitsByPlayer.get(playerId) ?? [])];

    benchUnits.push({
      unitType: boughtOffer.unitType,
      cost: boughtOffer.cost,
      starLevel: STAR_LEVEL_MIN,
      unitCount: 1,
    });
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
          const mergeCandidates: number[] = [];

          for (let index = 0; index < benchUnits.length; index += 1) {
            const unit = benchUnits[index];

            if (!unit || unit.unitType !== unitType || unit.starLevel !== starLevel) {
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

          benchUnits.push({
            unitType,
            cost: mergedCost,
            starLevel: starLevel + 1,
            unitCount: mergedCount,
          });
          mergedAny = true;
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
    boardPlacements.push({
      cell,
      unitType: benchUnit.unitType,
      starLevel: benchUnit.starLevel,
      sellValue: benchUnit.cost,
      unitCount: benchUnit.unitCount,
      items: benchUnit.items || [],
    });
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
  }

  private buildShopOffers(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    purchaseCount: number,
  ): ShopOffer[] {
    const offers: ShopOffer[] = [];

    for (let slotIndex = 0; slotIndex < SHOP_SIZE; slotIndex += 1) {
      offers.push(
        this.buildSingleShopOffer(
          playerId,
          roundIndex,
          refreshCount,
          purchaseCount + slotIndex,
        ),
      );
    }

    return offers;
  }

  private buildItemShopOffers(): ShopItemOffer[] {
    const offers: ShopItemOffer[] = [];

    for (let i = 0; i < ITEM_SHOP_SIZE; i++) {
      const randomIndex = Math.floor(Math.random() * ITEM_TYPES.length);
      const randomItem = ITEM_TYPES[randomIndex];

      if (!randomItem) {
        continue;
      }

      const itemDef = ITEM_DEFINITIONS[randomItem];
      offers.push({
        itemType: randomItem,
        cost: itemDef.cost
      });
    }

    return offers;
  }

  private buildSingleShopOffer(
    playerId: string,
    roundIndex: number,
    refreshCount: number,
    nonce: number,
  ): ShopOffer {
    const level = this.levelByPlayer.get(playerId) ?? INITIAL_LEVEL;
    const odds = SHOP_ODDS_BY_LEVEL[level] ?? SHOP_ODDS_BY_LEVEL[MAX_LEVEL] ?? [1, 0, 0];
    const seedBase = MatchRoomController.hashToUint32(
      `${playerId}:${roundIndex}:${refreshCount}:${nonce}:${this.setId}`,
    );
    const rarityRoll = MatchRoomController.seedToUnitFloat(seedBase + 1);
    const rarity = MatchRoomController.pickRarity(odds, rarityRoll);
    const unitPool = SHOP_UNIT_POOL_BY_RARITY[rarity];
    const unitRoll = MatchRoomController.seedToUnitFloat(seedBase + 2);
    const unitType =
      unitPool[Math.floor(unitRoll * unitPool.length) % unitPool.length] ??
      unitPool[0] ??
      "vanguard";

    return {
      unitType,
      rarity,
      cost: rarity,
    };
  }

  private static pickRarity(
    odds: readonly [number, number, number],
    roll: number,
  ): UnitRarity {
    const [oneCostRate, twoCostRate] = odds;

    if (roll < oneCostRate) {
      return 1;
    }

    if (roll < oneCostRate + twoCostRate) {
      return 2;
    }

    return 3;
  }

  private static seedToUnitFloat(seed: number): number {
    let x = seed >>> 0;

    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;

    return (x >>> 0) / 4294967296;
  }

  private static hashToUint32(text: string): number {
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
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

  private calculateActiveSynergies(
    placements: BoardUnitPlacement[]
  ): { unitType: string; count: number; tier: number }[] {
    const counts: { [key in BoardUnitType]: number } = { vanguard: 0, ranger: 0, mage: 0, assassin: 0 };
    
    if (!placements) {
      return [];
    }
    
    for (const p of placements) {
      if (!p || !p.unitType) continue;
      counts[p.unitType]++;
    }
    
    const result: { unitType: string; count: number; tier: number }[] = [];
    
    const unitTypes: BoardUnitType[] = ["vanguard", "ranger", "mage", "assassin"];
    
    for (const type of unitTypes) {
      const count: number = counts[type]! || 0;
      
      let tier = 0;
      if (count >= 9) tier = 3;
      else if (count >= 6) tier = 2;
      else if (count >= 3) tier = 1;
      
      if (count > 0) {
        result.push({ unitType: type, count, tier });
      }
    }
    
    return result;
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

    // 引き分けの場合は両方ダメージなし
    if (outcome.isDraw) {
      this.pendingRoundDamageByPlayer.set(leftPlayerId, 0);
      this.pendingRoundDamageByPlayer.set(rightPlayerId, 0);
      return;
    }

    const loserDamage = this.buildLoserDamage(
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

    const challengerDamage = this.buildLoserDamage(
      outcome.winnerUnitCount,
      outcome.loserUnitCount,
    );
    this.pendingRoundDamageByPlayer.set(challengerPlayerId, challengerDamage);
  }

  private resolveMatchupOutcome(leftPlayerId: string, rightPlayerId: string): MatchupOutcome {
    const leftPlacements = this.boardPlacementsByPlayer.get(leftPlayerId) ?? [];
    const rightPlacements = this.boardPlacementsByPlayer.get(rightPlayerId) ?? [];

    // ボード配置をBattleUnitに変換
    const leftBattleUnits: BattleUnit[] = leftPlacements.map((placement, index) =>
      createBattleUnit(placement, "left", index),
    );

    const rightBattleUnits: BattleUnit[] = rightPlacements.map((placement, index) =>
      createBattleUnit(placement, "right", index),
    );

    // バトルシミュレーターで戦闘を実行
    const battleSimulator = new BattleSimulator();
    const battleResult = battleSimulator.simulateBattle(
      leftBattleUnits,
      rightBattleUnits,
      leftPlacements,
      rightPlacements,
      30000, // 30秒の最大戦闘時間
    );

    // 戦闘結果から勝者と生存ユニット数を判定
    if (battleResult.winner === "right") {
      // After battle simulation, store results for both players
      const damageToLeft = this.buildLoserDamage(
        battleResult.rightSurvivors.length,
        battleResult.leftSurvivors.length,
      );
      this.battleResultsByPlayer.set(leftPlayerId, {
        opponentId: rightPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: damageToLeft,
        survivors: battleResult.leftSurvivors.length,
        opponentSurvivors: battleResult.rightSurvivors.length,
      });
      this.battleResultsByPlayer.set(rightPlayerId, {
        opponentId: leftPlayerId,
        won: true,
        damageDealt: damageToLeft,
        damageTaken: 0,
        survivors: battleResult.rightSurvivors.length,
        opponentSurvivors: battleResult.leftSurvivors.length,
      });

      return {
        winnerId: rightPlayerId,
        loserId: leftPlayerId,
        winnerUnitCount: battleResult.rightSurvivors.length,
        loserUnitCount: battleResult.leftSurvivors.length,
        isDraw: false,
      };
    } else if (battleResult.winner === "left") {
      // After battle simulation, store results for both players
      const damageToRight = this.buildLoserDamage(
        battleResult.leftSurvivors.length,
        battleResult.rightSurvivors.length,
      );
      this.battleResultsByPlayer.set(leftPlayerId, {
        opponentId: rightPlayerId,
        won: true,
        damageDealt: damageToRight,
        damageTaken: 0,
        survivors: battleResult.leftSurvivors.length,
        opponentSurvivors: battleResult.rightSurvivors.length,
      });
      this.battleResultsByPlayer.set(rightPlayerId, {
        opponentId: leftPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: damageToRight,
        survivors: battleResult.rightSurvivors.length,
        opponentSurvivors: battleResult.leftSurvivors.length,
      });

      return {
        winnerId: leftPlayerId,
        loserId: rightPlayerId,
        winnerUnitCount: battleResult.leftSurvivors.length,
        loserUnitCount: battleResult.rightSurvivors.length,
        isDraw: false,
      };
    } else {
      // 引き分けの場合 - 双方の結果を保存
      this.battleResultsByPlayer.set(leftPlayerId, {
        opponentId: rightPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: 0,
        survivors: battleResult.leftSurvivors.length,
        opponentSurvivors: battleResult.rightSurvivors.length,
      });
      this.battleResultsByPlayer.set(rightPlayerId, {
        opponentId: leftPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: 0,
        survivors: battleResult.rightSurvivors.length,
        opponentSurvivors: battleResult.leftSurvivors.length,
      });

      return {
        winnerId: null,
        loserId: null,
        winnerUnitCount: battleResult.leftSurvivors.length,
        loserUnitCount: battleResult.rightSurvivors.length,
        isDraw: true,
      };
    }
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
    // 新しいダメージ計算式: ベースダメージ + 勝者の生存ユニット数 × 2
    return baseDamage + winnerUnitCount * 2;
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
