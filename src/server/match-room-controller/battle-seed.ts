import { hashToUint32 } from "./random-utils";

export type DeterministicBattleSeedInput = {
  battleId: string;
  roundIndex: number;
  battleIndex: number;
};

export function resolveDeterministicBattleSeed(
  seedBase: number | undefined,
  input: DeterministicBattleSeedInput,
): number | undefined {
  if (seedBase === undefined || !Number.isFinite(seedBase)) {
    return undefined;
  }

  const normalizedSeedBase = Math.trunc(seedBase);
  const normalizedRoundIndex = Math.max(0, Math.trunc(input.roundIndex));
  const normalizedBattleIndex = Math.max(0, Math.trunc(input.battleIndex));

  return hashToUint32([
    "battle",
    normalizedSeedBase,
    normalizedRoundIndex,
    normalizedBattleIndex,
    input.battleId,
  ].join(":"));
}
