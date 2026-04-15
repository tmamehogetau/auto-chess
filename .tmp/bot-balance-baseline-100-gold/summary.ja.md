# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold
- モード: custom
- 戦闘速度倍率: 0.01
- タイミング設定: 自動開始 200ms / 準備 900ms / 戦闘 800ms / 決着待機 20ms / 敗退演出 10ms / 選択制限 200ms

## 全体結果

- 完走数: 100
- 中断数: 0
- ボス勝利数: 92
- レイド勝利数: 8
- ボス勝率: 92.0%
- レイド勝率: 8.0%
- 平均ラウンド数: 11.32
- 最短ラウンド: 3
- 最長ラウンド: 12
- 平均生存レイド人数: 2.52

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 3 | 2 |
| 4 | 1 |
| 5 | 2 |
| 7 | 1 |
| 8 | 2 |
| 9 | 4 |
| 10 | 1 |
| 11 | 1 |
| 12 | 86 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.81 | 24.0% | 100 | 1.85 | 25.4 | 0 | 50.44 | 33.43 | 0 | 0 |
| P2 | 2.2 | 28.0% | 100 | 2.19 | 25.97 | 0 | 54.82 | 35.15 | 0 | 0 |
| P3 | 2.75 | 26.0% | 100 | 1.42 | 25.95 | 0 | 54.12 | 32.44 | 0 | 0 |
| P4 | 3.24 | 22.0% | 100 | 1.74 | 28.75 | 0 | 48.64 | 26.4 | 0 | 0 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 火焔猫燐 | mixed | 3081 | 100 | 2.27 | 64.62 | 1990.99 | 87.9% | 23.6% | 100.0% |
| ナズーリン | mixed | 1035 | 100 | 1.82 | 147.42 | 1525.8 | 71.0% | 12.4% | 100.0% |
| 宮古芳香 | mixed | 2574 | 100 | 1.52 | 48.89 | 1258.46 | 79.1% | 23.2% | 100.0% |
| 姫虫百々世 | mixed | 1683 | 100 | 1.11 | 48.65 | 818.7 | 89.4% | 26.5% | 100.0% |
| レミリア | boss | 1132 | 100 | 1 | 32.84 | 371.71 | 98.8% | 6.3% | 100.0% |
| 今泉影狼 | mixed | 1208 | 95 | 1.09 | 45.43 | 548.81 | 90.1% | 28.0% | 95.0% |
| パチュリー・ノーレッジ | boss | 725 | 86 | 1.6 | 875.87 | 6350.08 | 100.0% | 6.3% | 86.0% |
| 霊夢 | raid | 900 | 82 | 1 | 26.08 | 234.69 | 85.4% | 93.6% | 82.0% |
| 純狐 | mixed | 529 | 80 | 1.23 | 215.28 | 1138.84 | 98.3% | 9.5% | 80.0% |
| 袿姫 | raid | 861 | 78 | 1 | 12.29 | 105.85 | 92.5% | 0.0% | 78.0% |
| 魔理沙 | raid | 876 | 73 | 1 | 2050.26 | 17960.3 | 98.5% | 24.7% | 73.0% |
| 紅美鈴 | boss | 627 | 68 | 1.43 | 72.56 | 454.95 | 99.2% | 9.1% | 68.0% |
| 隠岐奈 | raid | 726 | 67 | 1 | 69.84 | 507.03 | 80.6% | 0.4% | 67.0% |
| クラウンピース | mixed | 504 | 65 | 1.07 | 301.74 | 1520.76 | 100.0% | 10.1% | 65.0% |
| 十六夜咲夜 | boss | 174 | 54 | 1.11 | 678.8 | 1181.12 | 100.0% | 6.9% | 54.0% |
| 飯綱丸龍 | mixed | 326 | 48 | 1.04 | 416.62 | 1358.19 | 100.0% | 4.9% | 48.0% |
| わかさぎ姫 | mixed | 216 | 38 | 1.02 | 179.45 | 387.61 | 79.2% | 7.4% | 38.0% |
| 菅牧典 | mixed | 154 | 24 | 1 | 400.36 | 616.55 | 100.0% | 6.5% | 24.0% |
| 雲居一輪＆雲山 | mixed | 42 | 17 | 1.24 | 78.81 | 33.1 | 78.6% | 26.2% | 17.0% |
| 蘇我屠自古 | mixed | 80 | 15 | 1.04 | 382.2 | 305.76 | 100.0% | 6.3% | 15.0% |
| 日白残無 | boss | 12 | 5 | 1.17 | 725 | 87 | 100.0% | 16.7% | 5.0% |
| 村紗水蜜 | boss | 11 | 3 | 1.09 | 1235 | 135.85 | 100.0% | 18.2% | 3.0% |
| 霍青娥 | boss | 4 | 3 | 1.5 | 258 | 10.32 | 100.0% | 0.0% | 3.0% |
| 天弓千亦 | boss | 3 | 1 | 1.67 | 2974.33 | 89.23 | 100.0% | 33.3% | 1.0% |
| 赤蛮奇 | boss | 2 | 1 | 1 | 211 | 4.22 | 100.0% | 0.0% | 1.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 姫虫百々世 | vanguard | 944 | 100 | 9.44 | 100.0% |
| わかさぎ姫 | ranger | 171 | 97 | 1.71 | 97.0% |
| パチュリー・ノーレッジ | mage | 82 | 71 | 0.82 | 71.0% |
| 十六夜咲夜 | assassin | 3 | 3 | 0.03 | 3.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1796030 | 73 | 17960.3 |
| patchouli | patchouli | boss | 635008 | 86 | 6350.08 |
| 火焔猫燐 | rin | raid | 164972 | 100 | 1649.72 |
| clownpiece | clownpiece | boss | 143866 | 53 | 1438.66 |
| megumu | megumu | boss | 127579 | 42 | 1275.79 |
| nazrin | nazrin | boss | 121601 | 90 | 1216.01 |
| sakuya | sakuya | boss | 109710 | 47 | 1097.1 |
| 宮古芳香 | yoshika | raid | 68939 | 70 | 689.39 |
| tsukasa | tsukasa | boss | 54455 | 11 | 544.55 |
| 姫虫百々世 | momoyo | raid | 44140 | 60 | 441.4 |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 65435 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 64293 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 62902 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 65375 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 65996 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 59602 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 65541 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 67022 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-008.log |
| 8 | 40 | 5 | 5 | 12500 | 5 | 0 | 64864 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-009.log |
| 9 | 45 | 5 | 2 | 11000 | 5 | 0 | 57823 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-010.log |
| 10 | 50 | 5 | 1 | 10500 | 5 | 0 | 66411 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-011.log |
| 11 | 55 | 5 | 3 | 11500 | 5 | 0 | 65008 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-012.log |
| 12 | 60 | 5 | 0 | 10000 | 5 | 0 | 56650 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-013.log |
| 13 | 65 | 5 | 6 | 13000 | 5 | 0 | 63107 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-014.log |
| 14 | 70 | 5 | 4 | 12000 | 5 | 0 | 66674 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-015.log |
| 15 | 75 | 5 | 7 | 13500 | 5 | 0 | 65719 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-016.log |
| 16 | 80 | 5 | 2 | 11000 | 5 | 0 | 56684 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-017.log |
| 17 | 85 | 5 | 0 | 10000 | 5 | 0 | 63599 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-018.log |
| 18 | 90 | 5 | 5 | 12500 | 5 | 0 | 48914 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-019.log |
| 19 | 95 | 5 | 6 | 13000 | 5 | 0 | 61060 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-gold\chunk-020.log |

## 失敗一覧

- 失敗はありません。
