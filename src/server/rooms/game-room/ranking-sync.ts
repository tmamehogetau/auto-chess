/**
 * Synchronizes the ranking array in the state with the new ranking.
 * Clears all existing entries and repopulates with the new ranking order.
 * The ranking is ordered from top (winner) to bottom (eliminated).
 */
export function syncRanking(
  stateRanking: { pop: () => void; push: (item: string) => void; length: number },
  nextRanking: string[],
): void {
  while (stateRanking.length > 0) {
    stateRanking.pop();
  }

  for (const playerId of nextRanking) {
    stateRanking.push(playerId);
  }
}
