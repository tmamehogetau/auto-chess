# Week2 Day8-9 Phase HP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Week2 Day8-9の最小スコープとして、Battle終了時のPhase HP進捗（目標値・与ダメ・成功/失敗）を計算し、`round_state`に公開する。

**Architecture:** 現行の`MatchRoomController`が持つBattle終了処理（`advanceByTime`内）を拡張し、ラウンドごとのPhase HPメトリクスを計算する。Phase HP値はコントローラーの内部状態として保持し、`GameRoom`の`createRoundStateMessage`でクライアントに配信する。既存の戦闘・HP反映ロジックは変更せず、観測可能なメトリクス追加に限定する。

**Tech Stack:** TypeScript, Colyseus, Vitest

---

### Task 1: Phase HPの失敗テストを追加

**Files:**
- Modify: `tests/server/match-room-controller.test.ts`

**Step 1: Write the failing test**

追加テスト:
- `Battle終了時にphase HP進捗が計算される`
- `phase HP未達時はfailedになり次ラウンドPrepでリセットされる`

確認する期待値:
- Round1 target = 400
- totalDamage = pendingRoundDamageの合計
- result = `success` / `failed`
- completionRate = `totalDamage / target`
- 次ラウンドPrepで target が Round2(500) に更新され、damage=0, result=`pending`

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/match-room-controller.test.ts -t "phase HP"`

Expected: FAIL（`getPhaseProgress`未定義、または期待フィールド未存在）

**Step 3: Commit**

```bash
git add tests/server/match-room-controller.test.ts
git commit -m "test: add phase hp progress expectations for week2"
```

### Task 2: MatchRoomControllerにPhase HP進捗を実装

**Files:**
- Modify: `src/server/match-room-controller.ts`
- Test: `tests/server/match-room-controller.test.ts`

**Step 1: Write minimal implementation**

実装要素:
- Round1-8の目標カーブ定数（400,500,600,700,800,900,1000,1200）
- Controller内部状態:
  - targetHp
  - damageDealt
  - result (`pending` | `success` | `failed`)
  - completionRate
- `public getPhaseProgress()` を追加
- Battle終了時（`advanceByTime`のBattle分岐）に進捗更新
- Elimination -> Prep遷移時に次ラウンドtargetへ更新し、damage/resultをリセット

**Step 2: Run test to verify it passes**

Run: `npx vitest run tests/server/match-room-controller.test.ts -t "phase HP"`

Expected: PASS

**Step 3: Run related suite**

Run: `npx vitest run tests/server/match-room-controller.test.ts`

Expected: PASS（既存回帰なし）

**Step 4: Commit**

```bash
git add src/server/match-room-controller.ts tests/server/match-room-controller.test.ts
git commit -m "feat: add phase hp progress calculation for battle settle"
```

### Task 3: round_stateへPhase HP進捗を公開

**Files:**
- Modify: `src/shared/room-messages.ts`
- Modify: `src/server/rooms/game-room.ts`
- Test: `tests/server/game-room.integration.test.ts`

**Step 1: Write the failing integration test**

追加テスト:
- `round_stateにphaseHpTarget/phaseDamage/result/completionRateが含まれる`

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/game-room.integration.test.ts -t "phaseHp"`

Expected: FAIL（新フィールド未配信）

**Step 3: Write minimal implementation**

- `RoundStateMessage`に以下追加:
  - `phaseHpTarget`
  - `phaseDamageDealt`
  - `phaseResult`
  - `phaseCompletionRate`
- `GameRoom.createRoundStateMessage()`で`controller.getPhaseProgress()`の値を詰める

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/game-room.integration.test.ts -t "phaseHp"`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/room-messages.ts src/server/rooms/game-room.ts tests/server/game-room.integration.test.ts
git commit -m "feat: include phase hp progress in round_state message"
```

### Task 4: 最終検証

**Files:**
- Verify only

**Step 1: Run full verification**

Run: `npm run typecheck && npx vitest run tests/server/match-room-controller.test.ts tests/server/game-room.integration.test.ts`

Expected: PASS

**Step 2: Verify git status**

Run: `git status --short`

Expected: 意図しないファイルが含まれていない

**Step 3: Commit plan progress note (optional)**

```bash
git add docs/plans/2026-02-28-week2-day8-9-phase-hp.md
git commit -m "docs: add week2 day8-9 phase hp implementation plan"
```
