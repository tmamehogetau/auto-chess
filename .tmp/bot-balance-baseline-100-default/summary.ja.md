# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default
- bot1: boss希望=ON / 購入方針=strength
- bot2: boss希望=OFF / 購入方針=strength
- bot3: boss希望=OFF / 購入方針=strength
- bot4: boss希望=OFF / 購入方針=strength
- モード: custom
- 戦闘速度倍率: 0.01
- タイミング設定: 自動開始 200ms / 準備 900ms / 戦闘 800ms / 決着待機 20ms / 敗退演出 10ms / 選択制限 200ms

## 全体結果

- 完走数: 100
- 中断数: 0
- ボス勝利数: 89
- レイド勝利数: 11
- ボス勝率: 89.0%
- レイド勝率: 11.0%
- 平均ラウンド数: 11.29
- 最短ラウンド: 3
- 最長ラウンド: 12
- 平均生存レイド人数: 2.57

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 3 | 1 |
| 4 | 2 |
| 5 | 5 |
| 8 | 2 |
| 10 | 1 |
| 11 | 1 |
| 12 | 88 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.77 | 31.0% | 100 | 1.72 | 24.61 | 0 | 54.7 | 35.03 | 0 | 0 |
| P2 | 2.21 | 24.0% | 100 | 2.36 | 27.52 | 0 | 51.48 | 34.4 | 0 | 0 |
| P3 | 2.76 | 23.0% | 100 | 1.69 | 27.25 | 0 | 52.86 | 32.23 | 0 | 0 |
| P4 | 3.26 | 22.0% | 100 | 1.74 | 27.97 | 0 | 51.15 | 27.37 | 0 | 0 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 火焔猫燐 | mixed | 3091 | 100 | 2.28 | 61.09 | 1888.14 | 88.5% | 23.0% | 100.0% |
| 宮古芳香 | mixed | 2602 | 100 | 1.5 | 42.53 | 1106.76 | 80.9% | 22.0% | 100.0% |
| 姫虫百々世 | mixed | 1638 | 100 | 1.09 | 48.97 | 802.1 | 92.0% | 26.1% | 100.0% |
| レミリア | boss | 1129 | 100 | 1 | 29.54 | 333.55 | 98.0% | 4.8% | 100.0% |
| 今泉影狼 | mixed | 1215 | 99 | 1.07 | 40.11 | 487.31 | 91.9% | 27.9% | 99.0% |
| ナズーリン | mixed | 939 | 97 | 1.78 | 120.13 | 1128.03 | 68.6% | 9.3% | 97.0% |
| パチュリー・ノーレッジ | boss | 720 | 88 | 1.57 | 730.14 | 5257.02 | 100.0% | 5.6% | 88.0% |
| 魔理沙 | raid | 948 | 79 | 1 | 2046.52 | 19401 | 98.1% | 32.9% | 79.0% |
| 袿姫 | raid | 819 | 75 | 1 | 13.84 | 113.35 | 94.5% | 0.0% | 75.0% |
| 霊夢 | raid | 807 | 74 | 1 | 21.19 | 171.01 | 88.7% | 94.1% | 74.0% |
| 隠岐奈 | raid | 789 | 72 | 1 | 65.32 | 515.39 | 86.9% | 0.5% | 72.0% |
| 純狐 | mixed | 494 | 71 | 1.17 | 192.88 | 952.83 | 98.0% | 14.0% | 71.0% |
| 紅美鈴 | boss | 657 | 71 | 1.37 | 67.47 | 443.3 | 99.8% | 6.5% | 71.0% |
| クラウンピース | mixed | 462 | 67 | 1.11 | 250.04 | 1155.19 | 99.8% | 9.1% | 67.0% |
| 十六夜咲夜 | boss | 177 | 58 | 1.1 | 565.41 | 1000.77 | 99.4% | 2.3% | 58.0% |
| わかさぎ姫 | mixed | 241 | 49 | 1.12 | 170.49 | 410.89 | 78.8% | 11.2% | 49.0% |
| 飯綱丸龍 | mixed | 289 | 43 | 1.13 | 360.1 | 1040.68 | 100.0% | 5.5% | 43.0% |
| 菅牧典 | mixed | 190 | 33 | 1 | 493.89 | 938.39 | 100.0% | 10.0% | 33.0% |
| 雲居一輪＆雲山 | mixed | 71 | 22 | 1.1 | 54.01 | 38.35 | 84.5% | 39.4% | 22.0% |
| 蘇我屠自古 | boss | 70 | 14 | 1.14 | 246.43 | 172.5 | 100.0% | 2.9% | 14.0% |
| 霍青娥 | boss | 9 | 5 | 1.56 | 276.67 | 24.9 | 100.0% | 0.0% | 5.0% |
| 日白残無 | boss | 15 | 4 | 1.47 | 87 | 13.05 | 100.0% | 0.0% | 4.0% |
| 赤蛮奇 | boss | 5 | 3 | 1 | 467.2 | 23.36 | 100.0% | 20.0% | 3.0% |
| 天弓千亦 | boss | 13 | 3 | 1.23 | 71.85 | 9.34 | 100.0% | 0.0% | 3.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 宮古芳香 | vanguard | 948 | 100 | 9.48 | 100.0% |
| クラウンピース | ranger | 152 | 88 | 1.52 | 88.0% |
| パチュリー・ノーレッジ | mage | 98 | 79 | 0.98 | 79.0% |
| 赤蛮奇 | assassin | 2 | 2 | 0.02 | 2.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1940100 | 79 | 19401 |
| patchouli | patchouli | boss | 525702 | 88 | 5257.02 |
| 火焔猫燐 | rin | raid | 156555 | 100 | 1565.55 |
| clownpiece | clownpiece | boss | 100745 | 42 | 1007.45 |
| megumu | megumu | boss | 92561 | 36 | 925.61 |
| sakuya | sakuya | boss | 89391 | 46 | 893.91 |
| tsukasa | tsukasa | boss | 84028 | 18 | 840.28 |
| nazrin | nazrin | boss | 82902 | 76 | 829.02 |
| 宮古芳香 | yoshika | raid | 67285 | 85 | 672.85 |
| 姫虫百々世 | momoyo | raid | 37948 | 49 | 379.48 |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 65397 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 62111 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 65396 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 65429 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 65786 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 65400 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 50564 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 67032 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-008.log |
| 8 | 40 | 5 | 6 | 13000 | 5 | 0 | 57919 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-009.log |
| 9 | 45 | 5 | 1 | 10500 | 5 | 0 | 58705 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-010.log |
| 10 | 50 | 5 | 0 | 10000 | 5 | 0 | 65540 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-011.log |
| 11 | 55 | 5 | 2 | 11000 | 5 | 0 | 67463 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-012.log |
| 12 | 60 | 5 | 5 | 12500 | 5 | 0 | 58114 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-013.log |
| 13 | 65 | 5 | 3 | 11500 | 5 | 0 | 61981 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-014.log |
| 14 | 70 | 5 | 4 | 12000 | 5 | 0 | 58317 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-015.log |
| 15 | 75 | 5 | 7 | 13500 | 5 | 0 | 65846 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-016.log |
| 16 | 80 | 5 | 6 | 13000 | 5 | 0 | 64813 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-017.log |
| 17 | 85 | 5 | 1 | 10500 | 5 | 0 | 56675 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-018.log |
| 18 | 90 | 5 | 5 | 12500 | 5 | 0 | 54736 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-019.log |
| 19 | 95 | 5 | 4 | 12000 | 5 | 0 | 64868 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-default\chunk-020.log |

## 失敗一覧

- 失敗はありません。
