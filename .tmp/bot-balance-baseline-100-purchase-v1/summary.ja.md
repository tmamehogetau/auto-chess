# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1
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
- ボス勝利数: 79
- レイド勝利数: 21
- ボス勝率: 79.0%
- レイド勝率: 21.0%
- 平均ラウンド数: 11.57
- 最短ラウンド: 3
- 最長ラウンド: 12
- 平均生存レイド人数: 2.64

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 3 | 1 |
| 4 | 2 |
| 5 | 2 |
| 10 | 2 |
| 12 | 93 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.95 | 31.0% | 100 | 1.59 | 16.62 | 5.67 | 70.91 | 39.68 | 0 | 3.15 |
| P2 | 2.05 | 32.0% | 100 | 2.32 | 20.42 | 4.27 | 65.48 | 39.61 | 0.01 | 2.6 |
| P3 | 2.82 | 17.0% | 100 | 1.89 | 12.2 | 12.39 | 80.15 | 41.31 | 0.01 | 5.58 |
| P4 | 3.18 | 20.0% | 100 | 1.83 | 2.46 | 30.39 | 108.7 | 46.57 | 0 | 12.69 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 火焔猫燐 | mixed | 3097 | 100 | 2.27 | 53.95 | 1670.73 | 86.5% | 23.9% | 100.0% |
| ナズーリン | mixed | 1038 | 100 | 1.85 | 129.71 | 1346.39 | 67.7% | 10.2% | 100.0% |
| 宮古芳香 | mixed | 2501 | 100 | 1.46 | 42.91 | 1073.24 | 79.2% | 23.1% | 100.0% |
| 姫虫百々世 | mixed | 1404 | 100 | 1.15 | 42.2 | 592.48 | 92.3% | 28.1% | 100.0% |
| 今泉影狼 | mixed | 1088 | 100 | 1.09 | 39.82 | 433.26 | 91.8% | 30.6% | 100.0% |
| レミリア | boss | 1157 | 100 | 1 | 28.36 | 328.07 | 98.8% | 4.4% | 100.0% |
| パチュリー・ノーレッジ | boss | 850 | 93 | 1.57 | 687.16 | 5840.89 | 99.9% | 4.6% | 93.0% |
| 純狐 | mixed | 679 | 91 | 1.22 | 210.71 | 1430.72 | 98.4% | 9.9% | 91.0% |
| 十六夜咲夜 | boss | 394 | 90 | 1.3 | 588.33 | 2318.02 | 97.0% | 4.3% | 90.0% |
| 紅美鈴 | boss | 488 | 86 | 1.11 | 68.86 | 336.04 | 97.5% | 7.2% | 86.0% |
| 魔理沙 | raid | 936 | 78 | 1 | 2070.29 | 19377.93 | 95.0% | 38.5% | 78.0% |
| 隠岐奈 | raid | 879 | 77 | 1 | 65.77 | 578.09 | 81.8% | 0.2% | 77.0% |
| 雲居一輪＆雲山 | mixed | 251 | 76 | 1.14 | 49.47 | 124.16 | 82.1% | 24.3% | 76.0% |
| 袿姫 | raid | 856 | 75 | 1 | 5.5 | 47.07 | 93.9% | 0.0% | 75.0% |
| 霊夢 | raid | 792 | 70 | 1 | 27.24 | 215.75 | 87.1% | 93.9% | 70.0% |
| クラウンピース | mixed | 510 | 65 | 1.09 | 214.01 | 1091.46 | 100.0% | 6.7% | 65.0% |
| 飯綱丸龍 | mixed | 108 | 54 | 1.01 | 397.62 | 429.43 | 100.0% | 9.3% | 54.0% |
| 天弓千亦 | mixed | 189 | 51 | 1.27 | 608.03 | 1149.17 | 98.9% | 8.5% | 51.0% |
| 村紗水蜜 | mixed | 92 | 43 | 1.1 | 665.77 | 612.51 | 98.9% | 8.7% | 43.0% |
| 日白残無 | boss | 100 | 42 | 1.04 | 673.8 | 673.8 | 100.0% | 6.0% | 42.0% |
| わかさぎ姫 | mixed | 133 | 42 | 1.14 | 168.9 | 224.64 | 75.2% | 15.8% | 42.0% |
| 蘇我屠自古 | mixed | 104 | 37 | 1.08 | 282.3 | 293.59 | 99.0% | 3.8% | 37.0% |
| 菅牧典 | mixed | 58 | 29 | 1 | 381.9 | 221.5 | 100.0% | 5.2% | 29.0% |
| 霍青娥 | boss | 29 | 16 | 1.21 | 353.21 | 102.43 | 89.7% | 3.4% | 16.0% |
| 赤蛮奇 | mixed | 19 | 13 | 1 | 349.74 | 66.45 | 78.9% | 0.0% | 13.0% |
| 物部布都 | boss | 18 | 11 | 1 | 1118.33 | 201.3 | 100.0% | 11.1% | 11.0% |
| 古明地さとり | boss | 6 | 3 | 1 | 964.83 | 57.89 | 100.0% | 33.3% | 3.0% |
| 古明地こいし | boss | 1 | 1 | 1 | 198 | 1.98 | 0.0% | 0.0% | 1.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 宮古芳香 | vanguard | 864 | 100 | 8.64 | 100.0% |
| パチュリー・ノーレッジ | mage | 193 | 97 | 1.93 | 97.0% |
| ナズーリン | ranger | 97 | 76 | 0.97 | 76.0% |
| 十六夜咲夜 | assassin | 34 | 32 | 0.34 | 32.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1937793 | 78 | 19377.93 |
| patchouli | patchouli | boss | 584089 | 93 | 5840.89 |
| sakuya | sakuya | boss | 231802 | 90 | 2318.02 |
| 火焔猫燐 | rin | raid | 134073 | 98 | 1340.73 |
| junko | junko | boss | 108615 | 76 | 1086.15 |
| chimata | chimata | boss | 107528 | 29 | 1075.28 |
| nazrin | nazrin | boss | 95757 | 73 | 957.57 |
| clownpiece | clownpiece | boss | 76312 | 34 | 763.12 |
| zanmu | zanmu | boss | 61047 | 20 | 610.47 |
| 宮古芳香 | yoshika | raid | 51605 | 54 | 516.05 |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 50773 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 65491 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 66401 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 64125 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 65836 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 65886 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 66743 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 64082 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-008.log |
| 8 | 40 | 5 | 0 | 10000 | 5 | 0 | 57714 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-009.log |
| 9 | 45 | 5 | 7 | 13500 | 5 | 0 | 58362 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-010.log |
| 10 | 50 | 5 | 3 | 11500 | 5 | 0 | 65236 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-011.log |
| 11 | 55 | 5 | 1 | 10500 | 5 | 0 | 65077 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-012.log |
| 12 | 60 | 5 | 4 | 12000 | 5 | 0 | 65062 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-013.log |
| 13 | 65 | 5 | 5 | 12500 | 5 | 0 | 69194 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-014.log |
| 14 | 70 | 5 | 2 | 11000 | 5 | 0 | 66342 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-015.log |
| 15 | 75 | 5 | 6 | 13000 | 5 | 0 | 66311 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-016.log |
| 16 | 80 | 5 | 0 | 10000 | 5 | 0 | 65428 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-017.log |
| 17 | 85 | 5 | 7 | 13500 | 5 | 0 | 64869 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-018.log |
| 18 | 90 | 5 | 3 | 11500 | 5 | 0 | 65446 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-019.log |
| 19 | 95 | 5 | 1 | 10500 | 5 | 0 | 55507 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v1\chunk-020.log |

## 失敗一覧

- 失敗はありません。
