Original prompt: 進めて

## 2026-03-15

- Task 1 done: entry flow guidance を `Connect -> Hero / Buy -> Place -> Ready` の常時文言に揃えた
- Task 2 done: shared-board に placement guide を追加し、click 選択でも valid / invalid lane を見せるようにした
- Task 3 done: phase HP を待機中から表示し、result/final judgment copy を次の一手ベースに整理した
- Task 4 done: pseudo-play observation を 1 回実施し、confusion point を 3 件に絞った
- Verification:
  - `npm.cmd run typecheck`
  - focused Task 1 vitest pass
  - focused Task 2 vitest pass
  - focused Task 3 vitest pass
- Next:
  1. Task 5 で blocker 一覧を作る
  2. Task 5 で `single-player dead-end`, `spectator slot`, `Waiting / Prep gate mismatch` を blocker 一覧へ落とす
  3. blocker ごとに verify 方針を付けて hardening 順を決める

- Task 5 progress:
  - `shared-board-room` の active 枠を 4 に拡張し、`4 active / 5th spectator` を `tests/server/shared-board-room.integration.test.ts` で固定
  - connection panel の `autoFillBots` 既定値を 3 に更新し、solo pseudo-play の不足席を first-pass で自動補完
  - `src/client/utils/pure-utils.js` に `entries/get` 対応を追加し、shared-board client が Colyseus client-side state の `players / cursors` を正しく読めるようにした
- Verification:
  - `npx.cmd vitest run tests/client/pure-utils.test.ts tests/client/shared-board-client.test.ts tests/client/shared-board-integration-ui.contract.test.ts tests/client/raid-board-ui.contract.test.ts tests/client/index-html.contract.test.ts tests/server/shared-board-room.integration.test.ts`
  - `npm.cmd run typecheck`
- Pseudo-play:
  - `?autoconnect=1` の browser 再確認で `Spectator slot` は消え、shared-board 上で own unit / own cursor を確認
  - ただし `1/4 Ready`, `Waiting / Prep mismatch`, `--- Round 0 --- / DEFEAT` は残存
- Next:
  1. `RB-02` として `Waiting / Prep / Ready` の player-facing copy と command gate を揃える
  2. `RB-04` として pre-action result pollution の発火条件を止める
  3. pseudo-play を再実施して `最初の購入 -> 配置 -> Ready` までを通す

- RB-02 / RB-04 progress:
  - `src/client/manual-check.js` で `room.onStateChange` / `round_state` listener を `connectAutoFillRooms()` より前に移動
  - `lastBattleResult` は `opponentId` がある時だけ battle result / combat log に出すように変更
  - `sendPrepCommand()` の trace 表示は local DOM 更新に戻し、`setMonitorText is not defined` console error を除去
  - `beforeunload` / `pagehide` で page-exit cleanup を即時化し、same-tab reload 後に前回 room の途中戦闘へ吸い込まれにくくした
  - `connectAutoFillRooms()` は helper 全員の join 完了後に `READY` をまとめて送るようにして、`1/4 Ready` race を解消
  - `player-facing-copy.js` で `Waiting = まず Ready`, `Prep = Buy / Place` に文言を分離
- Verification:
  - `npx.cmd vitest run tests/client/manual-check-script.contract.test.ts tests/client/player-facing-copy.test.ts tests/client/index-html.contract.test.ts tests/client/phase-hp-ui.contract.test.ts tests/client/raid-board-ui.contract.test.ts tests/client/round-summary-ui.contract.test.ts tests/client/pure-utils.test.ts`
  - `npm.cmd run typecheck`
  - `npm.cmd run verify:ci`
- Browser check:
  - same-tab reload 後も fresh な `Waiting` から入り、途中戦闘へ吸い込まれないことを確認
  - `Waiting` では `Press Ready to open the first prep phase` が出て、Ready クリック後に `Prep`, `4/4 Ready`, shop open を確認
  - pre-action の `Round 0 / DEFEAT` は消え、実際の戦闘後に `Round 1 / DEFEAT` が出ることを確認
- Next:
  1. Task 6 として presentation / minimal audio の release slice を実装する
  2. first-play script に沿ってもう 1 回 observation を回し、player-facing confusion が blocker から落ちたか確認する
  3. 配布前 checklist と feedback route を試遊導線へ接続する

- Task 6 done:
  - `src/client/index.html` で shared-board に `Boss Raid / Raid Coordination Board` の stage banner を追加し、shared-board / round summary / battle result / battle start / hero selection overlay の配色と枠線を作品向けに統一
  - `src/client/ui/audio-cues.js` と `src/client/ui/audio-cues.d.ts` を追加し、`confirm`, `purchase`, `battle-start`, `victory`, `defeat` の最小 Web Audio cue を導入
  - `src/client/manual-check.js` で Ready, hero confirm, purchase, battle start, result に audio cue を接続
  - `tests/client/audio-cues.test.ts` を追加し、`tests/client/index-html.contract.test.ts` と `tests/client/manual-check-script.contract.test.ts` を更新
- Verification:
  - `npx.cmd vitest run tests/client/index-html.contract.test.ts tests/client/manual-check-script.contract.test.ts tests/client/audio-cues.test.ts tests/client/player-facing-copy.test.ts tests/client/phase-hp-ui.contract.test.ts tests/client/round-summary-ui.contract.test.ts tests/client/raid-board-ui.contract.test.ts tests/client/pure-utils.test.ts`
  - `npm.cmd run typecheck`
- Browser check:
  - waiting / prep / battle / result の presentation shell を実画面で確認
  - screenshot 候補として `task6-prep-stage-b.png`, `task6-battle-stage.png`, `task6-result-stage.png` を保存
  - console 上の残差は favicon 404 と `round_state` 未登録 warning のみ
- Next:
  1. Task 7 として external playtest package を固める
  2. 配布文面と known limits を `docs/reference/2026-03-14_Distribution_Readiness_Checklist.md` 基準で接続する
  3. first external playtest 前に Hero -> Prep の短い GIF 候補を 1 本押さえる

- Shared Board main-board restoration progress:
  - `src/server/rooms/shared-board-room.ts` から join/reset 時の player dummy token を撤去し、shared-board は `dummy-boss` 以外を bridge 経由の実ユニットだけ表示する形に戻した
  - `tests/server/shared-board-room.integration.test.ts` で `join時にdummy-boss以外の初期トークンを生成しない` を固定し、既存の再配置系テストは `applyPlacementsFromGame()` で実ユニットを seed する形へ更新した
  - `tests/server/game-room.integration.test.ts` で authoritative `benchToBoardCell` が shared-board に即反映されることを固定した
  - `src/client/shared-board-client.js` で cursor chip を盤面主表示から外し、shared-board は空のときは空、置かれた後は実ユニットだけを主表示するように変更した
  - `src/client/index.html` と `src/client/manual-check.js` の文言を `Shared Battle Board` / `shop -> bench -> shared-board` 基準に更新した
  - `tests/e2e/shared-board-bridge/bridge.ui-integration.e2e.spec.ts` も初期ユニット前提をやめ、実ユニット seed 後の再配置を検証するように揃えた
- Verification:
  - `npx.cmd vitest run tests/server/shared-board-room.integration.test.ts tests/server/game-room.integration.test.ts`
  - `npx.cmd vitest run tests/client/shared-board-client.test.ts tests/client/shared-board-integration-ui.contract.test.ts tests/client/raid-board-ui.contract.test.ts tests/client/index-html.contract.test.ts`
  - `npx.cmd vitest run tests/client/index-html.contract.test.ts tests/client/manual-check-script.contract.test.ts tests/client/audio-cues.test.ts`
  - `npx.cmd vitest run tests/e2e/shared-board-bridge/bridge.ui-integration.e2e.spec.ts`
  - `npm.cmd run typecheck`
  - `npm.cmd run verify:ci`
- Next:
  1. Browser 上で `buy -> bench -> shared-board -> reposition` の golden path を実画面確認する
  2. boss side の bench-first 導線と表示が raid side と同じ温度で読めるかを確認する
  3. Phase B として hero / boss 常駐表現を shared-board 上でどう見せるかを分離して詰める

- Shared Board browser validation:
  - `src/client/manual-check.js` で shared-board index をそのまま `benchToBoardCell.cell` に送っていたため、実ブラウザでは `INVALID_PAYLOAD` になっていた
  - shared-board index から combat cell への変換を追加し、非 playable cell は `That shared-board cell is outside the playable combat area. Use one of the center lane cells.` で早期 return するようにした
  - shared-board client の own/ally 判定は shared room session ではなく game room player id を優先するように変更し、bridge 反映後の実ユニットが `occupied-own` で見えるようにした
- Verification:
  - `npx.cmd vitest run tests/client/shared-board-client.test.ts tests/client/manual-check-script.contract.test.ts tests/client/index-html.contract.test.ts`
  - `npm.cmd run typecheck`
  - `npm.cmd run verify:ci`
- Browser check:
  - `http://localhost:9080/src/client/index.html?endpoint=ws://localhost:3568&roomName=game&autofillBots=3` で `Connect -> Ready -> Buy -> Bench -> Shared Battle Board cell 13 へ配置 -> cell 14 へ再配置` を確認
  - bench slot 0 は配置後に空へ戻り、shared-board の配置済みユニットは `occupied-own` で表示されることを確認
  - 配置後の selection guide は `Select or drag one of your units. Blue cells show open moves and red cells show blocked lanes.` に遷移し、message bar では `Shared board move applied. Keep covering open lanes before you press Ready.` を確認
- Next:
  1. boss side の `shop -> bench -> shared-board` を real browser でも確認する
  2. Phase B として hero / boss 常駐表現を shared-board 上でどう見せるかを分離して詰める
  3. shared-board の playable lane を視覚だけで誤解しにくい見せ方にもう一段寄せる

- Task 7 first pass done:
  - `src/server/shared-board-unit-presentation.ts` を追加し、shared-board cell に載せる `displayName` / `portraitKey` を `unitId` から解決する経路を用意
  - `src/server/schema/shared-board-state.ts` と `src/server/rooms/shared-board-room.ts` で shared-board state に presentation metadata を保持し、bridge sync / move / clear で落とさないように更新
  - `src/server/match-room-controller/shop-offer-builder.ts` と `src/server/match-room-controller.ts` で boss shop offer から `unitId` を bench へ引き継ぎ、boss side でも shared-board に作品名を出せるように修正
  - `src/client/shared-board-client.js` と `src/client/index.html` で `enableTouhouRoster=true` のときだけ `pics` の portrait と東方名を shared-board cell に描画する first pass を追加
  - `src/client/manual-check.js` から roster flag を shared-board client へ渡すようにし、baseline の `enableTouhouRoster=false` は generic 表示のまま維持
- Verification:
  - `npx.cmd vitest run tests/server/shared-board-room.integration.test.ts tests/server/game-room.integration.test.ts`
  - `npx.cmd vitest run tests/client/shared-board-client.test.ts`
  - `npm.cmd run verify:ci`
- Browser / review notes:
  - `pics` 素材は暫定マッピングで接続し、名前ベースの正式対応は後続 pass に回す
  - shared-board の owner 判定や baseline 表示を壊さないため、Touhou 表示は feature flag 条件付きでのみ有効化
- Cleanup:
  - product 変更は `feat: polish shared board onboarding and touhou identity` として 1 塊に整理
  - repo guide / tooling 変更は `chore: add repo guidance and lefthook typecheck` として別塊に整理
