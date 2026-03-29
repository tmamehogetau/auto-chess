import { describe, expect, test } from "vitest";

import { GameLoopState } from "../../src/domain/game-loop-state";

describe("GameLoopState", () => {
  test("初期化時はPrepフェーズで4人全員が生存している", () => {
    const state = new GameLoopState(["p1", "p2", "p3", "p4"]);

    expect(state.phase).toBe("Prep");
    expect(state.roundIndex).toBe(1);
    expect(state.alivePlayerIds).toEqual(["p1", "p2", "p3", "p4"]);
  });

  test("正しい順序でフェーズ遷移できる", () => {
    const state = new GameLoopState(["p1", "p2", "p3", "p4"]);

    state.transitionTo("Battle");
    state.transitionTo("Settle");
    state.transitionTo("Elimination");
    state.transitionTo("Prep");

    expect(state.phase).toBe("Prep");
    expect(state.roundIndex).toBe(2);
  });

  test("不正な逆方向遷移はエラーになる", () => {
    const state = new GameLoopState(["p1", "p2", "p3", "p4"]);

    state.transitionTo("Battle");

    expect(() => state.transitionTo("Prep")).toThrow(
      "Invalid transition: Battle -> Prep",
    );
  });

  test("Elimination後に生存者が1人ならEndへ遷移できる", () => {
    const state = new GameLoopState(["p1", "p2", "p3", "p4"]);

    state.transitionTo("Battle");
    state.transitionTo("Settle");
    state.setPlayerHp("p2", 0);
    state.setPlayerHp("p3", -3);
    state.setPlayerHp("p4", 0);
    state.transitionTo("Elimination");
    state.transitionTo("End");

    expect(state.phase).toBe("End");
    expect(state.alivePlayerIds).toEqual(["p1"]);
  });

  test("raid recovery round は constructor option で切り替えられる", () => {
    const state = new GameLoopState(["p1", "p2", "p3", "p4"], {
      raidRecoveryRoundIndex: 4,
    });

    state.setBossPlayer("p4");

    for (let round = 1; round < 4; round += 1) {
      state.transitionTo("Battle");
      state.transitionTo("Settle");
      state.transitionTo("Elimination");
      state.transitionTo("Prep");
    }

    expect(state.roundIndex).toBe(4);

    state.consumeLife("p1", 2);
    state.transitionTo("Battle");
    state.transitionTo("Settle");
    state.transitionTo("Elimination");

    expect(state.isPlayerEliminated("p1")).toBe(false);

    state.transitionTo("Prep");
    state.transitionTo("Battle");
    state.transitionTo("Settle");
    state.transitionTo("Elimination");

    expect(state.isPlayerEliminated("p1")).toBe(true);
  });
});
