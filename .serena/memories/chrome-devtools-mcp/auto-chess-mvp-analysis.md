# chrome-devtools-mcp 機能適合性分析

## 対象
- リポジトリ: https://github.com/ChromeDevTools/chrome-devtools-mcp
- チェックリスト: auto-chess-mvp/docs/shared-board-day2-checklist.md

## 結論
**自動化可否: 一部可能**

---

## 確認点ごとの評価

### 1) 複数タブ(4タブ)を同時に扱えるか
**可**

**根拠:**
- `new_page`: 新しいタブを作成可能
- `list_pages`: 全タブの一覧を取得可能
- `select_page`: アクティブなタブを切り替え可能
- `background` パラメータでバックグラウンドタブ作成も可能

---

### 2) 0.5秒以内の操作競合を再現できるか（疑似同時で可）
**条件付き可（疑似同時のみ）**

**根拠:**
- Puppeteer 自体は `Promise.all` で並列操作可能だが、MCP ツールは順次実行されるため、真の並列操作は不可
- 解決策: `background` パラメータでバックグラウンドページを作成し、高速でタブを切り替えて疑似並列操作を実現可能
- 制約: 0.5秒以内の厳密な同時性は再現困難だが、1秒〜数秒レベルの競合再現は可能

---

### 3) Network throttling (Slow 3G / custom latency) をMCPツールで設定可能か
**条件付き可（プリセットのみ）**

**根拠:**
- `emulate` ツールの `networkConditions` パラメータで以下のプリセットをサポート:
  - "No emulation", "Offline", "Slow 3G", "Fast 3G", "Slow 4G", "Fast 4G"
- Slow 3G/Fast 3G は checklist の要求（遅延検証）に十分対応可能
- **制約**: カスタムレイテンシ（downloadThroughput, uploadThroughput, latency の個別指定）は MCP ツールインターフェースでは直接サポートされていない

---

### 4) イベントログ文言の検証・スクリーンショット保存が可能か
**可**

**根拠:**
- `list_console_messages`: コンソールメッセージの一覧を取得可能（`TARGET_LOCKED`, `NOT_ACTIVE_PLAYER` などのエラー検証に対応）
- `list_network_requests`: ネットワークリクエストの一覧を取得可能
- `take_screenshot`: スクリーンショットを保存可能（filePath, format, fullPage パラメータをサポート）

---

### 5) CIでの再現性（headless, isolated）
**可**

**根拠:**
- `--headless`: ヘッドレスモードで実行可能
- `--isolated`: 一時的なユーザーデータディレクトリを使用し、ブラウザ終了後に自動クリア
- CI 環境での再現性は十分に確保可能

---

## セクションごとの可否判定

| セクション | 可否 | 根拠 |
|----------|------|------|
| **3.1 同時配置競合** | 条件付き可 | 複数タブ可: new_page/list_pages/select_page<br>0.5秒競合: 疑似同時のみ（background + 高速切り替え）<br>エラー検証: list_console_messages<br>状態確認: take_screenshot/evaluate_script |
| **3.2 同時選択競合** | 条件付き可 | 1秒クリック競合: 疑似同時のみ<br>カーソル位置: evaluate_script で DOM 確認<br>アクティブ権限: list_console_messages |
| **3.3 リセット競合** | 可 | 複数タブ操作: 完全対応<br>選択状態クリア: take_screenshot/evaluate_script |
| **4.1 Slow 3G 検証** | 可 | Network Throttling: emulate (Slow 3G)<br>応答時間: 手動計測（要記録）<br>エラー検証: list_console_messages |
| **4.2 Custom 遅延検証** | 条件付き可 | Custom Throttling: プリセットのみ（Slow 3G/Fast 3G で近似）<br>ロック機構: 完全対応<br>再試行ロジック: 完全対応 |
| **5.1 観戦者操作拒否** | 可 | 4つ目のタブ: 完全対応<br>NOT_ACTIVE_PLAYER: list_console_messages<br>観察権限: take_screenshot/evaluate_script |

---

## 制約と注意点

### 技術的制約
1. **真の並列操作**: MCP ツールの仕様上、順次実行のみ可能。疑似同時操作（バックグラウンドタブ + 高速切り替え）で代用
2. **カスタムレイテンシ**: checklist 4.2 の「Download: 500kbps, Upload: 200kbps, Latency: 1000ms」はプリセットで近似（Slow 3G は downloadThroughput: 500Kbps, uploadThroughput: 500Kbps, latency: 2000ms）

### 推奨アプローチ
1. **競合検証**: Puppeteer の `evaluate_script` を使用して、クライアントサイドで擬似的なタイムラグを挿入し、競合シナリオを強制的に作成
2. **遅延検証**: Slow 3G プリセットを使用し、実際のカーソル同期遅延を目視またはタイムスタンプで記録
3. **自動化範囲**: 操作実行、状態確認、エラー検証を自動化。タイミング計測は手動またはスクリプトによるロギングで補完

---

## 参照ドキュメント

### chrome-devtools-mcp
- README: https://github.com/ChromeDevTools/chrome-devtools-mcp
- Tool Reference: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
- `emulate` ツール: networkConditions (enum), cpuThrottlingRate (number)
- `new_page` ツール: background (boolean), isolatedContext (string)

### Puppeteer
- Network Throttling: `Network.emulateNetworkConditions`
- CPU Throttling: `page.emulateCPUThrottling(factor)`
- 並列操作: `Promise.all` で複数ページを並列操作可能（ただし MCP ツールでは順次実行）

---

**作成日**: 2026-02-28
**バージョン**: v1.0
