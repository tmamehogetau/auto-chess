import { describe, expect, test } from "vitest";

import {
  buildBattleResultCopy,
  buildCommandResultCopy,
  buildEntryFlowStatus,
  buildFinalJudgmentCopy,
  buildLobbyRoleCopy,
  buildPhaseHpCopy,
  buildReadyHint,
  buildRoundSummaryCaption,
  buildRoundSummaryTip,
} from "../../src/client/ui/player-facing-copy.js";

describe("player-facing copy", () => {
  test("hero未選択の waiting では hero 選択を先に促す", () => {
    expect(buildReadyHint({
      phase: "Waiting",
      isReady: false,
      heroEnabled: true,
      heroSelected: false,
      readyCount: 0,
      totalCount: 3,
    })).toContain("Choose a hero first");
  });

  test("waiting の ready hint は prep 開始前に Ready を先に促す", () => {
    expect(buildReadyHint({
      phase: "Waiting",
      isReady: false,
      heroEnabled: false,
      heroSelected: false,
      readyCount: 3,
      totalCount: 4,
    })).toContain("Press Ready to open the first prep phase");
  });

  test("entry flow status は未接続時に 4 段階の主導線を返す", () => {
    expect(buildEntryFlowStatus({
      connected: false,
      connecting: false,
      phase: "Waiting",
      heroEnabled: true,
      heroSelected: false,
      isReady: false,
    })).toContain("Step 1: Connect");
  });

  test("entry flow status は waiting で Ready を先に案内する", () => {
    expect(buildEntryFlowStatus({
      connected: true,
      connecting: false,
      phase: "Waiting",
      heroEnabled: false,
      heroSelected: false,
      isReady: false,
    })).toContain("Press Ready to open the first prep phase");
  });

  test("lobby role copy は preference で boss 希望を促す", () => {
    expect(buildLobbyRoleCopy({
      lobbyStage: "preference",
      isBossPlayer: false,
      heroSelected: false,
      bossSelected: false,
    })).toBe("ボス希望を出して Ready");
  });

  test("lobby role copy は boss selection で boss 側の待機文を返す", () => {
    expect(buildLobbyRoleCopy({
      lobbyStage: "selection",
      isBossPlayer: true,
      heroSelected: false,
      bossSelected: false,
    })).toBe("ボスキャラを選んで開始を待つ");
  });

  test("lobby role copy は raid selection 完了後に待機文を返す", () => {
    expect(buildLobbyRoleCopy({
      lobbyStage: "selection",
      isBossPlayer: false,
      heroSelected: true,
      bossSelected: false,
    })).toBe("他プレイヤーの選択完了待ち");
  });

  test("phase hp copy は pending で目標を短文で説明する", () => {
    expect(buildPhaseHpCopy({
      targetHp: 100,
      damageDealt: 25,
      completionRate: 0.25,
      result: "pending",
    })).toEqual({
      valueText: "75 HP left (25% pushed)",
      resultText: "Phase in progress",
      helperText: "This is the boss HP still standing. Drop it to 0 to clear the phase.",
    });
  });

  test("phase hp copy は未開始でも 0 clear rule を先に示す", () => {
    expect(buildPhaseHpCopy(null)).toEqual({
      valueText: "0 / 0",
      resultText: "Waiting for battle",
      helperText: "Boss phase HP appears here when battle starts. Drop it to 0 to clear the phase.",
    });
  });

  test("final judgment copy は prep では次行動を案内する", () => {
    expect(buildFinalJudgmentCopy({
      phase: "Prep",
      ranking: [],
      bossPlayerId: "boss-1",
      raidPlayerIds: ["p1", "p2", "p3"],
      roundIndex: 2,
    })).toBe("Round 3: buy, place, then Ready");
  });

  test("final judgment copy は settle で結果確認と修正を促す", () => {
    expect(buildFinalJudgmentCopy({
      phase: "Settle",
      ranking: [],
      bossPlayerId: "boss-1",
      raidPlayerIds: ["p1", "p2", "p3"],
      roundIndex: 1,
    })).toBe("Round 2: read the result and fix one weak lane");
  });

  test("battle result copy は defeat で次の改善につながる文を返す", () => {
    const result = buildBattleResultCopy({
      isVictory: false,
      battleResult: {
        damageDealt: 18,
        damageTaken: 9,
        survivors: 1,
        opponentSurvivors: 3,
      },
    });

    expect(result.title).toBe("💀 DEFEAT");
    expect(result.subtitle).toContain("took 9 HP damage");
    expect(result.subtitle).toContain("2 units behind");
    expect(result.hint).toContain("positioning");
  });

  test("command result copy は reject を初見向けに返す", () => {
    expect(buildCommandResultCopy({
      accepted: false,
      code: "INVALID_PLACEMENT",
      hint: "Use an open cell on the board.",
    })).toContain("That action did not go through");
  });

  test("round summary caption は top damage を短く伝える", () => {
    expect(buildRoundSummaryCaption({
      ranking: [
        { playerId: "player-alpha" },
        { playerId: "player-beta" },
      ],
      sessionId: "player-self",
    })).toContain("player");
  });

  test("round summary tip は自分が大きく遅れている時に改善方向を返す", () => {
    expect(buildRoundSummaryTip({
      ranking: [
        { playerId: "player-alpha", damageDealt: 24 },
        { playerId: "player-self", damageDealt: 10 },
      ],
      sessionId: "player-self",
    })).toContain("14 damage");
  });
});
