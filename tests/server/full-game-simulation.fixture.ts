import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";

type FullGameEvidenceFixtureName =
  | "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する"
  | "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する"
  | "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する"
  | "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する";

function buildGameplayKpiSummaryFixture(
  totalRounds: number,
  top1CompositionSignature: string,
): GameplayKpiSummary {
  return {
    totalRounds,
    playerCount: 4,
    playersSurvivedR8: 4,
    totalPlayers: 4,
    r8CompletionRate: 1,
    top1CompositionSignature,
    failedPrepCommands: 0,
    totalPrepCommands: totalRounds * 12,
    prepInputFailureRate: 0,
  };
}

const FULL_GAME_EVIDENCE_FIXTURES: Record<
  FullGameEvidenceFixtureName,
  GameplayKpiSummary
> = {
  "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する":
    buildGameplayKpiSummaryFixture(12, "mage:1,mage:1,ranger:1"),
  "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する":
    buildGameplayKpiSummaryFixture(8, "ranger:1,ranger:1,ranger:1"),
  "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する":
    buildGameplayKpiSummaryFixture(12, "assassin:1,assassin:1,assassin:1"),
  "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する":
    buildGameplayKpiSummaryFixture(8, "vanguard:1,vanguard:1,vanguard:1"),
};

export function getFullGameEvidenceFixture(name: string): GameplayKpiSummary {
  const fixture = FULL_GAME_EVIDENCE_FIXTURES[
    name as keyof typeof FULL_GAME_EVIDENCE_FIXTURES
  ];
  if (!fixture) {
    throw new Error(`Missing full game evidence fixture: ${name}`);
  }
  return fixture;
}
