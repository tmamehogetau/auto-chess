import type { PhaseHpProgress } from "./ui/player-facing-copy.js";

export function renderPlayerLobbySummary(input: {
  participantSummaryElement?: HTMLElement | null;
  state?: {
    maxPlayers?: number;
    players?: unknown;
  } | null;
}): void;

export function renderPlayerLobbyPreferenceSummary(input: {
  preferenceCopyElement?: HTMLElement | null;
  state?: {
    lobbyStage?: string;
  } | null;
  player?: {
    wantsBoss?: boolean;
  } | null;
}): void;

export function renderPlayerSelectionSummary(input: {
  roleSummaryElement?: HTMLElement | null;
  roleOptionsElement?: HTMLElement | null;
  state?: {
    bossPlayerId?: string;
    lobbyStage?: string;
    players?: unknown;
  } | null;
  player?: {
    role?: string;
    selectedHeroId?: string;
    selectedBossId?: string;
  } | null;
  sessionId?: string;
}): void;

export function renderPlayerPrepSummary(input: {
  detailCardElement?: HTMLElement | null;
  allyRailElement?: HTMLElement | null;
  boardCopyElement?: HTMLElement | null;
  shopCopyElement?: HTMLElement | null;
  heroExclusiveShopCopyElement?: HTMLElement | null;
  bossShopCopyElement?: HTMLElement | null;
  heroUpgradeCopyElement?: HTMLElement | null;
  refreshCopyElement?: HTMLElement | null;
  specialUnitCopyElement?: HTMLElement | null;
  playerStatsCopyElement?: HTMLElement | null;
  spellCopyElement?: HTMLElement | null;
  synergyCopyElement?: HTMLElement | null;
  benchCopyElement?: HTMLElement | null;
  roomCopyElement?: HTMLElement | null;
  deadlineCopyElement?: HTMLElement | null;
  boardElement?: HTMLElement | null;
  shopElement?: HTMLElement | null;
  shopSlotElements?: HTMLButtonElement[];
  heroExclusiveShopElement?: HTMLElement | null;
  heroExclusiveShopSlotElements?: HTMLButtonElement[];
  bossShopElement?: HTMLElement | null;
  bossShopSlotElements?: HTMLButtonElement[];
  benchElement?: HTMLElement | null;
  benchSlotElements?: HTMLButtonElement[];
  readyElement?: HTMLElement | null;
  readyCopyElement?: HTMLElement | null;
  boardCellElements?: Array<HTMLElement | HTMLButtonElement>;
  state?: {
    phase?: string;
    lobbyStage?: string;
    prepDeadlineAtMs?: number;
    selectionDeadlineAtMs?: number;
    phaseDeadlineAtMs?: number;
    sharedBoardMode?: string;
    featureFlagsEnableHeroSystem?: boolean;
    featureFlagsEnableSpellCard?: boolean;
    featureFlagsEnableBossExclusiveShop?: boolean;
    bossPlayerId?: string;
    declaredSpellId?: string;
    usedSpellIds?: unknown[] | Iterable<unknown>;
    players?: unknown;
  } | null;
  player?: {
    ready?: boolean;
    role?: string;
    boardUnitCount?: number;
    gold?: number;
    hp?: number;
    remainingLives?: number;
    specialUnitLevel?: number;
    level?: number;
    selectedHeroId?: string;
    selectedBossId?: string;
    activeSynergies?: Array<{
      unitType?: string;
      count?: number;
      tier?: number;
    }> | Iterable<{
      unitType?: string;
      count?: number;
      tier?: number;
    }>;
    bossShopOffers?: Array<{
      unitType?: string;
      cost?: number;
      displayName?: string;
      rarity?: number;
      unitId?: string;
      purchased?: boolean;
    }> | Iterable<{
      unitType?: string;
      cost?: number;
      displayName?: string;
      rarity?: number;
      unitId?: string;
      purchased?: boolean;
    }>;
    heroExclusiveShopOffers?: Array<{
      unitType?: string;
      cost?: number;
      displayName?: string;
      rarity?: number;
      unitId?: string;
      purchased?: boolean;
    }> | Iterable<{
      unitType?: string;
      cost?: number;
      displayName?: string;
      rarity?: number;
      unitId?: string;
      purchased?: boolean;
    }>;
    shopOffers?: Array<{
      unitType?: string;
      cost?: number;
      displayName?: string;
    }> | Iterable<{
      unitType?: string;
      cost?: number;
      displayName?: string;
    }>;
    benchUnits?: unknown[] | Iterable<unknown>;
    benchUnitIds?: unknown[] | Iterable<unknown>;
    benchDisplayNames?: unknown[] | Iterable<unknown>;
  } | null;
  sessionId?: string;
  currentPhase?: string;
  playerFacingPhase?: string;
  selectedBenchIndex?: number | null;
  canSellBench?: boolean;
  canSellBoard?: boolean;
  canReturnBoard?: boolean;
  roomSummary?: {
    roomId?: string;
    sharedBoardRoomId?: string;
  } | null;
  deadlineSummary?: {
    label?: string;
    valueText?: string;
  } | null;
  hoverDetail?: {
    kicker?: string;
    title?: string;
    portraitKey?: string;
    portraitUrl?: string;
    lines?: string[];
  } | null;
  onHoverDetailChange?: ((detail: {
    kicker?: string;
    title?: string;
    portraitKey?: string;
    portraitUrl?: string;
    lines?: string[];
  } | null) => void) | null;
  benchSellButton?: HTMLButtonElement | null;
  boardReturnButton?: HTMLButtonElement | null;
  boardSellButton?: HTMLButtonElement | null;
  sharedBoardConnected?: boolean;
}): void;

export function renderPlayerResultSummary(input: {
  resultSurfaceElement?: HTMLElement | null;
  state?: {
    phase?: string;
    roundIndex?: number;
    ranking?: unknown[] | Iterable<unknown>;
    bossPlayerId?: string;
    raidPlayerIds?: unknown[] | Iterable<unknown>;
    players?: unknown;
  } | null;
  player?: {
    lastBattleResult?: {
      won?: boolean;
      damageDealt?: number;
      damageTaken?: number;
      survivors?: number;
      opponentSurvivors?: number;
      timelineEndState?: Array<{
        battleUnitId?: string;
        side?: "boss" | "raid";
        x?: number;
        y?: number;
        currentHp?: number;
        maxHp?: number;
        displayName?: string;
        unitType?: string;
      }> | Iterable<{
        battleUnitId?: string;
        side?: "boss" | "raid";
        x?: number;
        y?: number;
        currentHp?: number;
        maxHp?: number;
        displayName?: string;
        unitType?: string;
      }>;
      timelineEvents?: Array<string | Record<string, unknown>> | Iterable<string | Record<string, unknown>>;
      survivorSnapshots?: Array<{
        unitId?: string;
        battleUnitId?: string;
        ownerPlayerId?: string;
        displayName?: string;
        unitType?: string;
        hp?: number;
        maxHp?: number;
        sharedBoardCellIndex?: number;
      }> | Iterable<{
        unitId?: string;
        battleUnitId?: string;
        ownerPlayerId?: string;
        displayName?: string;
        unitType?: string;
        hp?: number;
        maxHp?: number;
        sharedBoardCellIndex?: number;
      }>;
    } | null;
  } | null;
  phaseHpProgress?: PhaseHpProgress;
  sessionId?: string;
}): void;
