import { describe, expect, it } from "vitest";

import { GameLoopState } from "../../../src/domain/game-loop-state";
import {
  BattleOrchestrator,
  type BattleOrchestratorDeps,
  type BattlePairing,
} from "../../../src/server/match-room-controller/battle-orchestrator";
import type { MatchupOutcome } from "../../../src/server/match-room-controller/battle-resolution";

type BattleResultStub = {
  survivors: number;
};

type Harness = {
  state: GameLoopState;
  currentRoundPairings: BattlePairing[];
  battleParticipantIds: string[];
  pendingRoundDamageByPlayer: Map<string, number>;
  battleResultsByPlayer: Map<string, BattleResultStub>;
  hpAtBattleStartByPlayer: Map<string, number>;
  hpAfterBattleByPlayer: Map<string, number>;
  eliminatedFromBottom: string[];
  finalRankingOverride: string[] | null;
  outcomeResolver: (leftPlayerId: string, rightPlayerId: string) => MatchupOutcome;
  phaseResult: "pending" | "success" | "failed";
  orchestrator: BattleOrchestrator<BattleResultStub> | null;
};

function createHarness(playerIds: string[], options?: {
  raidBossPlayerId?: string;
  phaseResult?: "pending" | "success" | "failed";
}): Harness {
  const state = new GameLoopState(playerIds);
  if (options?.raidBossPlayerId) {
    state.setBossPlayer(options.raidBossPlayerId);
  }

  const harness: Harness = {
    state,
    currentRoundPairings: [],
    battleParticipantIds: [],
    pendingRoundDamageByPlayer: new Map<string, number>(),
    battleResultsByPlayer: new Map<string, BattleResultStub>(),
    hpAtBattleStartByPlayer: new Map<string, number>(),
    hpAfterBattleByPlayer: new Map<string, number>(),
    eliminatedFromBottom: [],
    finalRankingOverride: null,
    outcomeResolver: () => ({
      winnerId: null,
      loserId: null,
      winnerUnitCount: 0,
      loserUnitCount: 0,
      isDraw: true,
    }),
    phaseResult: options?.phaseResult ?? "pending",
    orchestrator: null,
  };

  const deps: BattleOrchestratorDeps<BattleResultStub> = {
    ensureStarted: () => harness.state,
    isRaidMode: () => harness.state.bossPlayerId !== null,
    getPhaseResult: () => harness.phaseResult,
    pendingRoundDamageByPlayer: harness.pendingRoundDamageByPlayer,
    battleResultsByPlayer: harness.battleResultsByPlayer,
    getCurrentRoundPairings: () => harness.currentRoundPairings,
    getBattleParticipantIds: () => harness.battleParticipantIds,
    getHpAtBattleStartByPlayer: () => harness.hpAtBattleStartByPlayer,
    getHpAfterBattleByPlayer: () => harness.hpAfterBattleByPlayer,
    eliminatedFromBottom: harness.eliminatedFromBottom,
    resolveMatchupOutcome: (leftPlayerId, rightPlayerId) =>
      harness.outcomeResolver(leftPlayerId, rightPlayerId),
    setFinalRankingOverride: (ranking) => {
      harness.finalRankingOverride = ranking;
    },
  };

  harness.orchestrator = new BattleOrchestrator(deps);

  return harness;
}

describe("BattleOrchestrator", () => {
  it("builds round-robin pairings and assigns a ghost source for odd player counts", () => {
    const harness = createHarness(["p1", "p2", "p3", "p4", "p5"]);

    expect(harness.orchestrator?.buildPairingsForRound(["p1", "p2", "p3", "p4", "p5"], 1)).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p4", ghostSourcePlayerId: null },
      { leftPlayerId: "p2", rightPlayerId: "p3", ghostSourcePlayerId: null },
      { leftPlayerId: "p5", rightPlayerId: null, ghostSourcePlayerId: "p1" },
    ]);
  });

  it("fills missing damage from pair and ghost outcomes", () => {
    const harness = createHarness(["p1", "p2", "p3"]);
    harness.currentRoundPairings = [
      { leftPlayerId: "p1", rightPlayerId: "p2", ghostSourcePlayerId: null },
      { leftPlayerId: "p3", rightPlayerId: null, ghostSourcePlayerId: "p1" },
    ];
    harness.outcomeResolver = (leftPlayerId, rightPlayerId) => {
      if (leftPlayerId === "p1" && rightPlayerId === "p2") {
        return {
          winnerId: "p1",
          loserId: "p2",
          winnerUnitCount: 4,
          loserUnitCount: 1,
          isDraw: false,
        };
      }

      return {
        winnerId: "p1",
        loserId: "p3",
        winnerUnitCount: 3,
        loserUnitCount: 0,
        isDraw: false,
      };
    };

    harness.orchestrator?.resolveMissingRoundDamage();

    expect(Array.from(harness.pendingRoundDamageByPlayer.entries())).toEqual([
      ["p1", 0],
      ["p2", 13],
      ["p3", 11],
    ]);
  });

  it("covers every unique matchup across odd-player round-robin rotations", () => {
    const harness = createHarness(["p1", "p2", "p3", "p4", "p5"]);
    const matchups = new Set<string>();

    for (let roundIndex = 1; roundIndex <= 5; roundIndex += 1) {
      const pairings =
        harness.orchestrator?.buildPairingsForRound(
          ["p1", "p2", "p3", "p4", "p5"],
          roundIndex,
        ) ?? [];

      const ghostPairings = pairings.filter(
        (pairing) => pairing.rightPlayerId === null,
      );
      expect(ghostPairings).toHaveLength(1);

      for (const pairing of pairings) {
        if (!pairing.rightPlayerId) {
          continue;
        }

        const matchupKey = [pairing.leftPlayerId, pairing.rightPlayerId]
          .sort()
          .join(":");
        matchups.add(matchupKey);
      }
    }

    expect(matchups).toEqual(new Set([
      "p1:p2",
      "p1:p3",
      "p1:p4",
      "p1:p5",
      "p2:p3",
      "p2:p4",
      "p2:p5",
      "p3:p4",
      "p3:p5",
      "p4:p5",
    ]));
  });

  it("fills only the missing side when pair damage is partially recorded", () => {
    const harness = createHarness(["p1", "p2"]);
    harness.currentRoundPairings = [
      { leftPlayerId: "p1", rightPlayerId: "p2", ghostSourcePlayerId: null },
    ];
    harness.pendingRoundDamageByPlayer.set("p1", 0);
    harness.outcomeResolver = () => ({
      winnerId: "p1",
      loserId: "p2",
      winnerUnitCount: 4,
      loserUnitCount: 1,
      isDraw: false,
    });

    harness.orchestrator?.resolveMissingRoundDamage();

    expect(Array.from(harness.pendingRoundDamageByPlayer.entries())).toEqual([
      ["p1", 0],
      ["p2", 13],
    ]);
  });

  it("preserves existing manual damage when the unresolved side draws", () => {
    const harness = createHarness(["p1", "p2"]);
    harness.currentRoundPairings = [
      { leftPlayerId: "p1", rightPlayerId: "p2", ghostSourcePlayerId: null },
    ];
    harness.pendingRoundDamageByPlayer.set("p1", 600);
    harness.outcomeResolver = () => ({
      winnerId: null,
      loserId: null,
      winnerUnitCount: 0,
      loserUnitCount: 0,
      isDraw: true,
    });

    harness.orchestrator?.resolveMissingRoundDamage();

    expect(Array.from(harness.pendingRoundDamageByPlayer.entries())).toEqual([
      ["p1", 600],
      ["p2", 0],
    ]);
  });

  it("orders simultaneous eliminations from worst to best for bottom ranking", () => {
    const harness = createHarness(["p1", "p2", "p3"]);
    harness.battleParticipantIds = ["p1", "p2", "p3"];
    harness.hpAtBattleStartByPlayer = new Map([
      ["p1", 30],
      ["p2", 20],
    ]);
    harness.hpAfterBattleByPlayer = new Map([
      ["p1", -20],
      ["p2", -5],
    ]);
    harness.state.setPlayerHp("p1", 0);
    harness.state.setPlayerHp("p2", -5);

    harness.orchestrator?.captureEliminationResult(new Set(["p1", "p2", "p3"]));

    expect(harness.eliminatedFromBottom).toEqual(["p1", "p2"]);
  });

  it("decides raid R12 final ranking from phase result and surviving raid players", () => {
    const harness = createHarness(["boss", "raid-a", "raid-b"], {
      raidBossPlayerId: "boss",
      phaseResult: "success",
    });
    harness.state.roundIndex = 12;
    harness.state.consumeLife("raid-b", 3);
    harness.state.phase = "Settle";
    harness.state.transitionTo("Elimination");

    expect(harness.orchestrator?.shouldEndAfterElimination(12)).toBe(true);
    expect(harness.finalRankingOverride).toEqual(["raid-a", "raid-b", "boss"]);
  });
});
