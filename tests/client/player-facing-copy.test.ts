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
  test("hero未選択でも preference lobby では Ready を先に促す", () => {
    expect(buildReadyHint({
      phase: "Waiting",
      isReady: false,
      heroEnabled: true,
      heroSelected: false,
      lobbyStage: "preference",
      readyCount: 0,
      totalCount: 3,
    })).toContain("Ready を押す");
  });

  test("waiting の ready hint は prep 開始前に Ready を先に促す", () => {
    expect(buildReadyHint({
      phase: "Waiting",
      isReady: false,
      heroEnabled: false,
      heroSelected: false,
      readyCount: 3,
      totalCount: 4,
    })).toContain("Ready を押す");
  });

  test("boss selection 中の ready hint は boss 側に hero ではなく boss confirm を促す", () => {
    expect(buildReadyHint({
      phase: "Waiting",
      isReady: true,
      heroEnabled: true,
      heroSelected: false,
      bossRoleSelectionEnabled: true,
      lobbyStage: "selection",
      isBossPlayer: true,
      bossSelected: false,
      readyCount: 4,
      totalCount: 4,
    })).toContain("ボスを確定");
  });

  test("boss selection 中の ready hint は raid 側に hero 選択待ちを返す", () => {
    expect(buildReadyHint({
      phase: "Waiting",
      isReady: false,
      heroEnabled: true,
      heroSelected: false,
      bossRoleSelectionEnabled: true,
      lobbyStage: "selection",
      isBossPlayer: false,
      bossSelected: false,
      readyCount: 4,
      totalCount: 4,
    })).toContain("主人公を選んでください");
  });

  test("prep の ready hint は boss 側で hero 未選択文に落ちない", () => {
    expect(buildReadyHint({
      phase: "Prep",
      isReady: true,
      heroEnabled: true,
      heroSelected: false,
      bossRoleSelectionEnabled: true,
      lobbyStage: "started",
      isBossPlayer: true,
      bossSelected: true,
      readyCount: 4,
      totalCount: 4,
    })).toContain("準備完了済み");
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
      valueText: "残り 75 HP (25%削り)",
      resultText: "フェイズ進行中",
      helperText: "0 で突破",
    });
  });

  test("phase hp copy は未開始でも 0 clear rule を先に示す", () => {
    expect(buildPhaseHpCopy(null)).toEqual({
      valueText: "0 / 0",
      resultText: "戦闘開始待ち",
      helperText: "0 で突破",
    });
  });

  test("final judgment copy は prep では次行動を案内する", () => {
    expect(buildFinalJudgmentCopy({
      phase: "Prep",
      ranking: [],
      bossPlayerId: "boss-1",
      raidPlayerIds: ["p1", "p2", "p3"],
      roundIndex: 2,
    })).toBe("第3ラウンド: 購入、配置、Ready");
  });

  test("final judgment copy は settle で結果確認と修正を促す", () => {
    expect(buildFinalJudgmentCopy({
      phase: "Settle",
      ranking: [],
      bossPlayerId: "boss-1",
      raidPlayerIds: ["p1", "p2", "p3"],
      roundIndex: 1,
    })).toBe("第2ラウンド: 結果を読んで弱い位置を 1 つ直す");
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

    expect(result.title).toBe("敗北");
    expect(result.subtitle).toContain("9 HP 被弾");
    expect(result.subtitle).toContain("ユニット差 2");
    expect(result.hint).toContain("配置");
  });

  test("command result copy は raw reject code を tester に見せない", () => {
    const copy = buildCommandResultCopy({
      accepted: false,
      code: "INVALID_PLACEMENT",
      hint: "Use an open cell on the board.",
    });

    expect(copy).not.toContain("INVALID_PLACEMENT");
    expect(copy).toContain("ここには置けません");
  });

  test("command result copy は prep 外の配置 reject を行動ベースで返す", () => {
    const copy = buildCommandResultCopy({
      accepted: false,
      code: "PHASE_LOCKED",
      hint: "",
    });

    expect(copy).not.toContain("PHASE_LOCKED");
    expect(copy).toContain("いまは準備時間ではありません");
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
    })).toContain("14 ダメージ差");
  });
});
