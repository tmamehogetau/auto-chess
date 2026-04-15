# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1
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
- 平均ラウンド数: 11.55
- 最短ラウンド: 3
- 最長ラウンド: 12
- 平均生存レイド人数: 2.62

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 3 | 1 |
| 4 | 1 |
| 5 | 2 |
| 8 | 1 |
| 9 | 1 |
| 10 | 3 |
| 11 | 1 |
| 12 | 90 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.79 | 32.0% | 100 | 1.71 | 19.35 | 3.7 | 65.21 | 36.57 | 0 | 2.4 |
| P2 | 2.2 | 24.0% | 100 | 2.4 | 26.86 | 2.82 | 57.01 | 35.21 | 0 | 1.7 |
| P3 | 2.8 | 21.0% | 100 | 1.85 | 13.91 | 12.68 | 79.01 | 40.4 | 0 | 5.44 |
| P4 | 3.21 | 23.0% | 100 | 1.78 | 2.98 | 22.3 | 100.89 | 43.3 | 0 | 8.87 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 火焔猫燐 | mixed | 3050 | 100 | 2.26 | 53.52 | 1632.4 | 86.8% | 23.7% | 100.0% |
| 宮古芳香 | mixed | 2428 | 100 | 1.5 | 42.71 | 1037.06 | 82.2% | 22.5% | 100.0% |
| レミリア | boss | 1155 | 100 | 1 | 29.2 | 337.23 | 98.3% | 4.1% | 100.0% |
| 姫虫百々世 | mixed | 1419 | 99 | 1.11 | 38.7 | 549.2 | 92.2% | 29.7% | 99.0% |
| ナズーリン | mixed | 1050 | 98 | 1.85 | 119.9 | 1258.95 | 64.7% | 9.6% | 98.0% |
| 今泉影狼 | mixed | 1077 | 98 | 1.1 | 34.2 | 368.32 | 93.7% | 31.7% | 98.0% |
| パチュリー・ノーレッジ | boss | 912 | 97 | 1.59 | 612.33 | 5584.42 | 99.9% | 4.2% | 97.0% |
| 純狐 | mixed | 806 | 93 | 1.23 | 206.09 | 1661.07 | 98.1% | 13.0% | 93.0% |
| 紅美鈴 | boss | 511 | 90 | 1.11 | 72.64 | 371.17 | 98.6% | 7.2% | 90.0% |
| 魔理沙 | raid | 960 | 80 | 1 | 2034.53 | 19531.53 | 97.0% | 36.3% | 80.0% |
| 隠岐奈 | raid | 862 | 76 | 1 | 64.53 | 556.28 | 85.2% | 1.0% | 76.0% |
| 十六夜咲夜 | boss | 360 | 74 | 1.35 | 525.35 | 1891.25 | 98.9% | 3.6% | 74.0% |
| 袿姫 | raid | 830 | 73 | 1 | 5.32 | 44.17 | 94.6% | 0.1% | 73.0% |
| 霊夢 | raid | 787 | 71 | 1 | 19.3 | 151.9 | 89.8% | 95.3% | 71.0% |
| クラウンピース | mixed | 492 | 64 | 1.08 | 270 | 1328.41 | 100.0% | 11.0% | 64.0% |
| 雲居一輪＆雲山 | mixed | 187 | 62 | 1.06 | 41.13 | 76.92 | 90.9% | 25.1% | 62.0% |
| 飯綱丸龍 | mixed | 102 | 49 | 1.04 | 315.15 | 321.45 | 100.0% | 2.9% | 49.0% |
| 天弓千亦 | mixed | 133 | 44 | 1.27 | 326.07 | 433.67 | 100.0% | 4.5% | 44.0% |
| わかさぎ姫 | mixed | 127 | 41 | 1.06 | 155.36 | 197.31 | 74.8% | 11.8% | 41.0% |
| 村紗水蜜 | mixed | 92 | 37 | 1.11 | 197.29 | 181.51 | 100.0% | 1.1% | 37.0% |
| 菅牧典 | mixed | 77 | 32 | 1.05 | 306.36 | 235.9 | 98.7% | 5.2% | 32.0% |
| 日白残無 | boss | 61 | 32 | 1.11 | 290.66 | 177.3 | 100.0% | 3.3% | 32.0% |
| 蘇我屠自古 | mixed | 75 | 29 | 1.07 | 259.56 | 194.67 | 100.0% | 2.7% | 29.0% |
| 霍青娥 | boss | 49 | 26 | 1.12 | 294.53 | 144.32 | 93.9% | 2.0% | 26.0% |
| 物部布都 | boss | 12 | 7 | 1 | 380.33 | 45.64 | 100.0% | 8.3% | 7.0% |
| 赤蛮奇 | boss | 16 | 7 | 1 | 282.13 | 45.14 | 81.3% | 0.0% | 7.0% |
| 古明地さとり | boss | 4 | 4 | 1 | 326.5 | 13.06 | 100.0% | 0.0% | 4.0% |
| 古明地こいし | boss | 1 | 1 | 1 | 184 | 1.84 | 0.0% | 0.0% | 1.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 今泉影狼 | vanguard | 872 | 100 | 8.72 | 100.0% |
| 天弓千亦 | mage | 176 | 98 | 1.76 | 98.0% |
| ナズーリン | ranger | 114 | 78 | 1.14 | 78.0% |
| 十六夜咲夜 | assassin | 27 | 27 | 0.27 | 27.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1953153 | 80 | 19531.53 |
| patchouli | patchouli | boss | 558442 | 97 | 5584.42 |
| sakuya | sakuya | boss | 187360 | 72 | 1873.6 |
| 火焔猫燐 | rin | raid | 130252 | 100 | 1302.52 |
| clownpiece | clownpiece | boss | 121946 | 48 | 1219.46 |
| junko | junko | boss | 117344 | 73 | 1173.44 |
| nazrin | nazrin | boss | 98258 | 91 | 982.58 |
| 宮古芳香 | yoshika | raid | 62796 | 80 | 627.96 |
| chimata | chimata | boss | 37187 | 13 | 371.87 |
| 隠岐奈 | okina | raid | 36984 | 50 | 369.84 |

## 高コスト指標

| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |
| --- | --- | --- | --- | --- | --- | --- |
| 9105 | 100 | 2325 | 100 | 158 | 88 | 88.0% |

## 高コストショップ提示ユニット

| ユニット名 | ユニットID | ユニット種別 | ロール | 提示元 | コスト | 提示回数 | 提示試合数 | 提示試合率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| パチュリー・ノーレッジ | patchouli | mage | boss | bossShop | 4 | 808 | 100 | 100.0% |
| 純狐 | junko | vanguard | raid | shop | 4 | 2111 | 99 | 99.0% |
| 純狐 | junko | vanguard | boss | shop | 4 | 575 | 99 | 99.0% |
| 天弓千亦 | chimata | mage | raid | shop | 4 | 2094 | 96 | 96.0% |
| 日白残無 | zanmu | mage | raid | shop | 5 | 1665 | 96 | 96.0% |
| 天弓千亦 | chimata | mage | boss | shop | 4 | 623 | 95 | 95.0% |
| 日白残無 | zanmu | mage | boss | shop | 5 | 610 | 95 | 95.0% |
| 物部布都 | futo | mage | raid | shop | 4 | 475 | 93 | 93.0% |
| 物部布都 | futo | mage | boss | shop | 4 | 144 | 69 | 69.0% |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 65500 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 65565 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 62931 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 65474 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 65430 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 65464 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 65013 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 63130 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-008.log |
| 8 | 40 | 5 | 2 | 11000 | 5 | 0 | 63125 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-009.log |
| 9 | 45 | 5 | 7 | 13500 | 5 | 0 | 65825 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-010.log |
| 10 | 50 | 5 | 6 | 13000 | 5 | 0 | 65527 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-011.log |
| 11 | 55 | 5 | 4 | 12000 | 5 | 0 | 58152 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-012.log |
| 12 | 60 | 5 | 5 | 12500 | 5 | 0 | 57107 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-013.log |
| 13 | 65 | 5 | 3 | 11500 | 5 | 0 | 63737 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-014.log |
| 14 | 70 | 5 | 0 | 10000 | 5 | 0 | 65101 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-015.log |
| 15 | 75 | 5 | 1 | 10500 | 5 | 0 | 65104 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-016.log |
| 16 | 80 | 5 | 5 | 12500 | 5 | 0 | 64839 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-017.log |
| 17 | 85 | 5 | 4 | 12000 | 5 | 0 | 64840 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-018.log |
| 18 | 90 | 5 | 2 | 11000 | 5 | 0 | 57706 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-019.log |
| 19 | 95 | 5 | 7 | 13500 | 5 | 0 | 58506 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-highcost-v1\chunk-020.log |

## 失敗一覧

- 失敗はありません。
