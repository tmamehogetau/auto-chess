# SharedBoard -> Battle Input Contract (MVP)

## Overview

このドキュメントは、SharedBoard の編集結果を `MatchRoomController` の戦闘入力へ反映するための
MVP契約（責務境界、採用ルール、エラー規約）を定義する。

対象は「Prep中の配置確定から1v1戦闘入力まで」。

---

## Scope

### In (MVP)
- SharedBoard の配置変更を `player placements` として確定する
- 1v1戦闘は確定した `player placements` のみを入力として使う
- 競合/不正入力を明示エラーとして返す

### Out (MVP)
- SharedBoard を直接戦闘入力にする3v1同時戦闘
- 高度な同時編集競合解決（OT/CRDT）
- Battle結果を SharedBoard へ逆同期する仕組み

---

## Responsibility Boundary

### SharedBoardRoom
- 役割: 共有盤面のセル編集と、プレイヤー所有セルの変更イベント発火
- 根拠:
  - `src/server/rooms/shared-board-room.ts:450` (`emitPlacementChange` 呼び出し)
  - `src/server/rooms/shared-board-room.ts:728` (変更イベント作成)
  - `src/server/rooms/shared-board-room.ts:736` (`ownerId === playerId` のセルのみ抽出)

### SharedBoardBridge
- 役割: 同期要求の検証と `MatchRoomController` への適用ゲート
- 根拠:
  - `src/server/shared-board-bridge.ts:605` (`applySharedBoardPlacement`)
  - `src/server/shared-board-bridge.ts:640` (version競合チェック)
  - `src/server/shared-board-bridge.ts:650` (Prepフェーズチェック)
  - `src/server/shared-board-bridge.ts:662` (`applyPrepPlacementForPlayer` 呼び出し)

### MatchRoomController
- 役割: プレイヤー別配置の正規化/検証/保存、および戦闘時の入力参照
- 根拠:
  - `src/server/match-room-controller.ts:430` (`applyPrepPlacementForPlayer`)
  - `src/server/match-room-controller.ts:444` (`normalizeBoardPlacements`)
  - `src/server/match-room-controller.ts:450` (最大8枠チェック)
  - `src/server/match-room-controller.ts:455` (`boardPlacementsByPlayer` へ反映)
  - `src/server/match-room-controller.ts:2245` (`resolveMatchupOutcome`)

---

## Data Flow

1. SharedBoardでプレイヤーが配置操作する
2. SharedBoardRoom が当該プレイヤー所有セルだけを抽出してイベント化する
3. SharedBoardBridge が同期要求を受け、以下を検証する
   - bridge state
   - known player
   - op idempotency
   - baseVersion
   - phase
4. 検証を通過した要求のみ `applyPrepPlacementForPlayer` に渡す
5. MatchRoomController が正規化/上限検証後、`boardPlacementsByPlayer[playerId]` を更新する
6. Battle開始時、`resolveMatchupOutcome` が `boardPlacementsByPlayer` を読み、`simulateBattle` へ渡す

---

## Validation Rules

### Bridge Gate
- `state === READY` であること
- `playerId` が既知プレイヤーであること
- `baseVersion === currentVersion` であること
- `phase === Prep` であること

### Controller Gate
- `placements` が正規化可能であること
- 配置上限 `<= 8` を満たすこと
- 不正時は `INVALID_PAYLOAD` などの明示コードで拒否すること

---

## Conflict and Idempotency

### Idempotency
- `opId` を既適用集合で管理し、再送時は成功として扱う（重複適用しない）

### Version Conflict
- `baseVersion` 不一致時は `conflict` を返す
- 返却には `currentVersion` と `currentPlacements` を含める

### Unknown Player / Invalid Phase
- 未知プレイヤーは `forbidden`
- Prep以外は `invalid_phase`

---

## Battle Input Contract

- 戦闘入力の正は `boardPlacementsByPlayer` とする
- SharedBoardのセル状態を BattleSimulator へ直接渡さない
- 戦闘解決は `resolveMatchupOutcome(leftPlayerId, rightPlayerId)` 経由で行う

この契約により、「共有盤面UI」と「戦闘入力」の責務分離を維持する。

---

## Observability (MVP minimum)

最低限、戦闘単位で以下を追跡できること:
- 採用された `player placements`
- 勝敗
- 生存ユニット数
- 適用ダメージ

実装タスク: T3（トレースログ強化）で対応する。

---

## Test Checklist

以下がCIで安定パスすること:
- 正常系: Prep中の共有編集が戦闘入力へ反映される
- 競合系: version不一致を `conflict` で検出する
- フェーズ系: Prep以外で同期要求を拒否する
- 境界系: 上限超過/不正配置を拒否する

対象テスト候補:
- `tests/server/shared-board-room.integration.test.ts`
- `tests/server/shared-board-bridge.batch-sync.test.ts`
- `tests/e2e/shared-board-bridge/bridge.lifecycle.e2e.spec.ts`

---

## Open Items

- 3v1同時戦闘を導入する場合の契約再定義（MVP後）
