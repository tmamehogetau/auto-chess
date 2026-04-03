import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";

type RealisticKpiProfileFixtureName =
  | "scenario A: vanguard-heavy構成を記録し vanguard > backline を検証"
  | "scenario B: backline-heavy構成を記録し backline > vanguard を検証"
  | "scenario C: frontline-balanced構成でも vanguard 優勢を維持する"
  | "scenario D: mage-heavy構成でも backline 優勢を記録する"
  | "scenario E: ranger-heavy構成でも non-empty composition を維持する";

function buildGameplayKpiSummaryFixture(
  top1CompositionSignature: string,
): GameplayKpiSummary {
  return {
    totalRounds: 8,
    playerCount: 4,
    playersSurvivedR8: 4,
    totalPlayers: 4,
    r8CompletionRate: 1,
    top1CompositionSignature,
    failedPrepCommands: 0,
    totalPrepCommands: 24,
    prepInputFailureRate: 0,
  };
}

export const REALISTIC_KPI_PROFILE_FIXTURES: Record<
  RealisticKpiProfileFixtureName,
  GameplayKpiSummary
> = {
  "scenario A: vanguard-heavy構成を記録し vanguard > backline を検証":
    buildGameplayKpiSummaryFixture("vanguard:1,vanguard:1,vanguard:1"),
  "scenario B: backline-heavy構成を記録し backline > vanguard を検証":
    buildGameplayKpiSummaryFixture("mage:1,ranger:1,ranger:1"),
  "scenario C: frontline-balanced構成でも vanguard 優勢を維持する":
    buildGameplayKpiSummaryFixture("vanguard:1,vanguard:1,ranger:1"),
  "scenario D: mage-heavy構成でも backline 優勢を記録する":
    buildGameplayKpiSummaryFixture("mage:1,mage:1,ranger:1"),
  "scenario E: ranger-heavy構成でも non-empty composition を維持する":
    buildGameplayKpiSummaryFixture("ranger:1,ranger:1,ranger:1"),
};

export function getRealisticKpiProfileFixture(name: string): GameplayKpiSummary {
  const fixture = REALISTIC_KPI_PROFILE_FIXTURES[
    name as keyof typeof REALISTIC_KPI_PROFILE_FIXTURES
  ];
  if (!fixture) {
    throw new Error(`Missing realistic KPI profile fixture: ${name}`);
  }
  return fixture;
}
