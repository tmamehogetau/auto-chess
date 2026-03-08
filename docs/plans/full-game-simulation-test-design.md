# R1〜R8 フルゲーム統合テスト設計案

## 1. テスト構造案

### ファイル名
`tests/server/full-game-simulation.integration.test.ts`

### 最小限のセットアップ
- 4人プレイヤー参加（既存の統合テストと同じパターン）
- タイマー短縮設定（既存のパターンを再利用）：
  ```typescript
  readyAutoStartMs: 2_000,
  prepDurationMs: 120,
  battleDurationMs: 120,
  settleDurationMs: 80,
  eliminationDurationMs: 80,
  ```
- タイムアウトの緩和（8ラウンド分待つため）：
  ```typescript
  const ROUND_TIMEOUT_MS = 500;  // 各ラウンドのタイムアウト
  const TOTAL_TIMEOUT_MS = 8_000; // 全体のタイムアウト
  ```

### describe/it構造
```typescript
describe("Full Game Simulation (R1-R8)", () => {
  describe("基本フロー検証", () => {
    test("R1→R8まで正常に進行し、Endフェーズになる", async () => {
      // テスト実装
    });

    test("各ラウンドで正しいラウンドインデックスとフェーズ遷移が行われる", async () => {
      // テスト実装
    });

    test("プレイヤーのHPが適切に変動する", async () => {
      // テスト実装
    });

    test("プレイヤーの経済状態（Gold/XP/Level）が正しく推移する", async () => {
      // テスト実装
    });

    test("全プレイヤーが脱落してもEndフェーズへ遷移する", async () => {
      // テスト実装
    });
  });

  describe("境界条件テスト", () => {
    test("R8終了時の順位が正しく決まる", async () => {
      // テスト実装
    });

    test("生存者が1人の場合も正常にEndへ遷移する", async () => {
      // テスト実装
    });
  });
});
```

---

## 2. 必要なモック・スタブ

### 戦闘シミュレーション
- **スキップ不要**: 既存の`BattleSimulator`をそのまま使用
- 理由: 既存のテストでも実際の戦闘シミュレーションが使用されており、十分に高速

### Phaseタイマー短縮方法
- **方法1**: ルームオプションで短縮設定を渡す（既存テストと同じ）
  ```typescript
  const server = defineServer({
    rooms: {
      game: defineRoom(GameRoom, {
        readyAutoStartMs: 2_000,
        prepDurationMs: 120,
        battleDurationMs: 120,
        settleDurationMs: 80,
        eliminationDurationMs: 80,
      }),
    },
  });
  ```
- **方法2**: `waitForCondition`のタイムアウトを調整
  ```typescript
  // 各ラウンドの各フェーズ遷移を待つ
  await waitForCondition(() => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === targetRound, 500);
  ```

### ユーティリティ関数（既存テストから再利用）
```typescript
const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();
  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("Timed out while waiting for condition");
};
```

---

## 3. アサーション設計

### 主要アサーション（5個）

#### アサーション1: ラウンドインデックスの推移
```typescript
for (let targetRound = 1; targetRound <= 8; targetRound++) {
  await waitForCondition(
    () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === targetRound,
    ROUND_TIMEOUT_MS,
  );
  expect(serverRoom.state.roundIndex).toBe(targetRound);
}
```
- **検証**: R1からR8までroundIndexが正しく1ずつ増加する

#### アサーション2: フェーズ遷移サイクル
```typescript
await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Elimination", 1_000);
// 次のPrepへ（または最終ラウンドならEndへ）
```
- **検証**: Prep→Battle→Settle→Elimination→Prepのサイクルが正常に動作する

#### アサーション3: プレイヤーのHP変化
```typescript
const sortedPlayerIds = clients.map((client) => client.sessionId).sort();

for (let round = 1; round <= 8; round++) {
  // 各ラウンドのBattle→Settle後にHPを記録
  await waitForCondition(
    () => serverRoom.state.phase === "Settle" && serverRoom.state.roundIndex === round,
    ROUND_TIMEOUT_MS,
  );

  // HPが100以下であることを確認
  for (const playerId of sortedPlayerIds) {
    const player = serverRoom.state.players.get(playerId);
    expect(player?.hp).toBeLessThanOrEqual(100);
    expect(player?.hp).toBeGreaterThan(-10); // オーバーキル防止
  }
}
```
- **検証**: HPが適切に減少している（戦闘ダメージが反映されている）

#### アサーション4: 経済状態の推移
```typescript
// R1 Prep時
let player = serverRoom.state.players.get(clients[0].sessionId);
expect(player?.gold).toBe(15);
expect(player?.xp).toBe(0);
expect(player?.level).toBe(1);

// R2 Prep時
await waitForCondition(
  () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
  ROUND_TIMEOUT_MS,
);
player = serverRoom.state.players.get(clients[0].sessionId);
expect(player?.gold).toBeGreaterThanOrEqual(20); // 15(初期) + 5(基礎収入)
expect(player?.xp).toBeGreaterThanOrEqual(0);
expect(player?.level).toBeGreaterThanOrEqual(1);
```
- **検証**: 各ラウンドでGoldが増加している（基礎収入が反映されている）

#### アサーション5: R8終了時のEndフェーズ
```typescript
await waitForCondition(
  () => serverRoom.state.phase === "End" || (serverRoom.state.phase === "Elimination" && serverRoom.state.alivePlayerIds?.length <= 1),
  TOTAL_TIMEOUT_MS,
);

expect(serverRoom.state.phase).toBe("End");
expect(serverRoom.state.roundIndex).toBe(8);

// すべてのプレイヤーが淘汰されていることを確認
const eliminatedCount = Array.from(serverRoom.state.players.values())
  .filter((p) => p.eliminated || p.hp <= 0).length;
expect(eliminatedCount).toBe(4); // すべてのプレイヤーがHPが0以下
```
- **検証**: R8終了時にゲームが正常にEndフェーズに遷移する

---

## 4. 既存テストから再利用すべき部分

### 再利用可能なユーティリティ関数
```typescript
// tests/server/game-room.integration.test.ts から再利用
const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();
  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("Timed out while waiting for condition");
};
```

### 再利用可能なテストパターン

#### パターン1: 4人プレイヤーセットアップ
```typescript
const serverRoom = await testServer.createRoom<GameRoom>("game");
const clients = await Promise.all([
  testServer.connectTo(serverRoom),
  testServer.connectTo(serverRoom),
  testServer.connectTo(serverRoom),
  testServer.connectTo(serverRoom),
]);

// メッセージリスナーの設定
for (const client of clients) {
  client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
}

// 全員Ready
for (const client of clients) {
  client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
}
```
- 出典: `game-room.integration.test.ts` の113-128行目

#### パターン2: フェーズ遷移待機
```typescript
await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Elimination", 1_000);
await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
```
- 出典: `game-room.integration.test.ts` の316-323行目

#### パターン3: ラウンドインデックスアサーション
```typescript
await waitForCondition(
  () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
  1_500,
);
expect(serverRoom.state.roundIndex).toBe(2);
```
- 出典: `game-room.integration.test.ts` の342-345行目

#### パターン4: HP変化アサーション
```typescript
const sortedPlayerIds = clients.map((client) => client.sessionId).sort();
const firstLoserId = sortedPlayerIds[2];

await waitForCondition(
  () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
  1_500,
);

expect(serverRoom.state.players.get(firstLoserId)?.hp).toBe(100);
```
- 出典: `game-room.integration.test.ts` の347-366行目

---

## 5. 補足事項

### ボス戦について
- **現状**: 戦闘シミュレーターには Remilia ボス戦 baseline があり、MVP 暫定ユニット基準の勝率 tuning も完了している
- **テスト対応**: ただし MatchRoomController には R8 でボス戦を自動トリガーする導線がまだないため、この統合テスト設計には含めない
- **将来対応**: R8 ボス導線を実装したら、この設計にボス戦アサーションを追加する

### テスト実行時間の見積もり
- 各ラウンド: Pre(120ms) + Battle(120ms) + Settle(80ms) + Elimination(80ms) = 400ms
- 8ラウンド分: 400ms × 8 = 3,200ms
- オーバーヘッド（アサーション等）: 約1,000ms
- **合計**: 約4,200ms（4秒強）

### トラブルシューティングポイント
1. **タイムアウト**: タイムアウト値が短すぎる場合は増やす
2. **フェーズ遷移の不整合**: `waitForCondition`の条件を確認
3. **HP計算の不整合**: 戦闘ダメージの計算ロジックを確認
4. **経済状態の不整合**: 基礎収入の計算を確認

---

## 6. 実装の優先順位

1. **高優先度**:
   - R1→R8の基本フロー検証
   - フェーズ遷移の確認
   - Endフェーズへの遷移確認

2. **中優先度**:
   - HP変化の検証
   - 経済状態の推移確認

3. **低優先度**:
   - 順位の正確性検証
   - 境界条件テスト（全員脱落ケースなど）
