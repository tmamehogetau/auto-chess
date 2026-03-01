# ADR 0001: 紋章マス（Emblem Cell）実装の遅延

## ステータス
承認済み / 保留中実装

## 背景
標準仕様には紋章マス（Emblem Cell）の実装が含まれているが、以下の理由によりMVP段階では実装を延期することを決定した：

1. **実装コスト vs 期待価値**:
   - 実装にはUI表示、状態管理、効果適用ロジックが必要（工数: 8-12時間）
   - MVP検証段階での頻度は低い（プレイヤーが少数であり、戦略深度の影響が限定的）
   - 期待価値（頻度×差別化）が初期閾値を下回る

2. **優先順位**:
   - ヒーローシステム、共有プールなど、コア機能の優先度が高い
   - リソースは「高インパクト・低コスト」機能に集中すべき

3. **再評価の必要性**:
   - ユーザー数増加に伴い、戦略的価値が変動する可能性
   - ユーザーフィードバックに基づく需要確認が望ましい

## 決定
紋章マスの実装を「契約温存・実装遅延」方式で延期する。以下の契約（型定義・スキーマ）のみを維持し、runtime実装は保留する。

### 再導入条件
以下の式を満たした時点で実装を再開する：

```
期待価値(頻度 × 差別化) - 実装コスト > 閾値
```

具体的な指標：
- **頻度**: 1プレイヤーあたりのゲーム内紋章マス使用回数 > 3回/ゲーム
- **差別化**: ユーザー調査で「紋章マスがゲーム体験に重要」と回答 > 60%
- **コスト**: 実装工数が8-12時間以内
- **閾値**: チームでの合意値（初期: 30ポイント）

## 保留中の契約（実装時に使用）

### 1. 型定義
```typescript
// src/shared/types.ts
export type EmblemType = 'attack' | 'defense' | 'speed';

export interface EmblemEffect {
  type: EmblemType;
  value: number;
  duration: number; // ターン数
}
```

### 2. スキーマ拡張スロット
```typescript
// src/server/schema/shared-board-state.ts
export class SharedBoardCellState extends Schema {
  // ... 既存フィールド ...

  // 紋章マス用拡張スロット（将来実装予約）
  // emblemType?: 'attack' | 'defense' | 'speed';
}
```

### 3. Feature Flag
```typescript
// src/shared/feature-flags.ts
export interface FeatureFlags {
  // ... 既存フラグ ...
  enableEmblemCells: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  // ... 既存値 ...
  enableEmblemCells: false,
};
```

## 実装時のチェックリスト
- [ ] Feature Flag `enableEmblemCells` を true に設定
- [ ] `SharedBoardCellState` に `emblemType` フィールドを有効化
- [ ] UIコンポーネントで紋章マスを可視化
- [ ] ゲームロジックで紋章効果を適用
- [ ] E2Eテストを追加
- [ ] ADRを「実装済み」に更新

## 代替案（検討中）
- 軽量版実装: 視覚表示のみで効果は簡略化
- ユーザー主導導入: キャンペーン機能として実装
- タイムリミット付き導入: イベント期間限定で有効化

## 参考資料
- 標準仕様 v1.0: 第3章「紋章マスシステム」
- MVP優先順位マトリックス: 2026-02-28版
- ユーザー調査結果: 2026-03-01（予定）

## 承認
- 作成者: ニナちゃん（Explorer）
- 承認者: つかさ（Orchestrator）
- 承認日: 2026-03-01
