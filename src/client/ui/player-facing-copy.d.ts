export type ReadyHintInput = {
  phase?: string;
  isReady?: boolean;
  heroEnabled?: boolean;
  heroSelected?: boolean;
  bossRoleSelectionEnabled?: boolean;
  lobbyStage?: string;
  isBossPlayer?: boolean;
  bossSelected?: boolean;
  readyCount?: number;
  totalCount?: number;
};

export type PhaseHpProgress = {
  targetHp?: number;
  damageDealt?: number;
  completionRate?: number;
  result?: "pending" | "success" | "failed";
} | null;

export type PhaseHpCopy = {
  valueText: string;
  resultText: string;
  helperText: string;
};

export type EntryFlowStatusInput = {
  connected?: boolean;
  connecting?: boolean;
  phase?: string;
  heroEnabled?: boolean;
  heroSelected?: boolean;
  bossRoleSelectionEnabled?: boolean;
  lobbyStage?: string;
  isBossPlayer?: boolean;
  bossSelected?: boolean;
  isReady?: boolean;
};

export type LobbyRoleCopyInput = {
  lobbyStage?: string;
  isBossPlayer?: boolean;
  heroSelected?: boolean;
  bossSelected?: boolean;
};

export type FinalJudgmentInput = {
  phase?: string;
  ranking?: string[] | Iterable<string>;
  bossPlayerId?: string;
  raidPlayerIds?: string[] | Iterable<string>;
  roundIndex?: number;
};

export type BattleResultInput = {
  damageDealt?: number;
  damageTaken?: number;
  survivors?: number;
  opponentSurvivors?: number;
};

export type BattleResultCopy = {
  title: string;
  subtitle: string;
  hint: string;
  damageDealt: number;
  damageTaken: number;
};

export type RoundSummaryEntry = {
  playerId?: string;
  damageDealt?: number;
};

export function buildReadyHint(input: ReadyHintInput): string;
export function buildEntryFlowStatus(input: EntryFlowStatusInput): string;
export function buildLobbyRoleCopy(input: LobbyRoleCopyInput): string;
export function buildPhaseHpCopy(progress: PhaseHpProgress): PhaseHpCopy;
export function buildFinalJudgmentCopy(input: FinalJudgmentInput): string;
export function buildBattleResultCopy(input: {
  isVictory: boolean;
  battleResult?: BattleResultInput;
}): BattleResultCopy;
export function buildRoundSummaryCaption(input: {
  ranking?: RoundSummaryEntry[];
  sessionId?: string;
}): string;
export function buildRoundSummaryTip(input: {
  ranking?: RoundSummaryEntry[];
  sessionId?: string;
}): string;
export function buildCommandResultCopy(input: {
  accepted?: boolean;
  code?: string;
  hint?: string;
}): string;
