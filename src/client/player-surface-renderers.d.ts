import type { PhaseHpProgress } from "./ui/player-facing-copy.js";

export function renderPlayerLobbySummary(input: {
  participantSummaryElement?: HTMLElement | null;
  state?: {
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
  boardCopyElement?: HTMLElement | null;
  shopCopyElement?: HTMLElement | null;
  benchCopyElement?: HTMLElement | null;
  boardElement?: HTMLElement | null;
  shopElement?: HTMLElement | null;
  shopSlotElements?: HTMLButtonElement[];
  benchElement?: HTMLElement | null;
  benchSlotElements?: HTMLButtonElement[];
  readyElement?: HTMLElement | null;
  readyCopyElement?: HTMLElement | null;
  boardCellElements?: Array<HTMLElement | HTMLButtonElement>;
  state?: {
    phase?: string;
    lobbyStage?: string;
    featureFlagsEnableHeroSystem?: boolean;
    featureFlagsEnableBossExclusiveShop?: boolean;
    bossPlayerId?: string;
    players?: unknown;
  } | null;
  player?: {
    ready?: boolean;
    role?: string;
    gold?: number;
    selectedHeroId?: string;
    selectedBossId?: string;
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
    benchDisplayNames?: unknown[] | Iterable<unknown>;
  } | null;
  sessionId?: string;
  currentPhase?: string;
  selectedBenchIndex?: number | null;
  canSellBench?: boolean;
  canSellBoard?: boolean;
  canReturnBoard?: boolean;
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
        displayName?: string;
        unitType?: string;
        hp?: number;
        maxHp?: number;
        combatCell?: number;
      }> | Iterable<{
        unitId?: string;
        displayName?: string;
        unitType?: string;
        hp?: number;
        maxHp?: number;
        combatCell?: number;
      }>;
    } | null;
  } | null;
  phaseHpProgress?: PhaseHpProgress;
  sessionId?: string;
}): void;
