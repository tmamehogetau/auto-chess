# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2
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
- ボス勝利数: 92
- レイド勝利数: 8
- ボス勝率: 92.0%
- レイド勝率: 8.0%
- 平均ラウンド数: 11.14
- 最短ラウンド: 4
- 最長ラウンド: 12
- 平均生存レイド人数: 2.41

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 4 | 2 |
| 5 | 6 |
| 7 | 1 |
| 8 | 2 |
| 9 | 3 |
| 10 | 2 |
| 11 | 2 |
| 12 | 82 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.71 | 32.0% | 100 | 1.49 | 9.31 | 10.8 | 78.32 | 40.75 | 0.56 | 6.56 |
| P2 | 2.1 | 30.0% | 100 | 2.1 | 6.47 | 14.53 | 88.12 | 44.38 | 0.51 | 8.35 |
| P3 | 2.9 | 16.0% | 100 | 1.71 | 5.58 | 14.48 | 84.1 | 41.49 | 0.23 | 8.91 |
| P4 | 3.29 | 22.0% | 100 | 1.52 | 6.78 | 12.68 | 83.34 | 37.82 | 0.03 | 9.2 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 宮古芳香 | mixed | 2624 | 100 | 1.81 | 58.83 | 1543.76 | 79.6% | 25.5% | 100.0% |
| 火焔猫燐 | mixed | 2618 | 100 | 1.72 | 49 | 1282.92 | 83.6% | 25.6% | 100.0% |
| レミリア | boss | 1114 | 100 | 1 | 31.68 | 352.94 | 98.2% | 6.9% | 100.0% |
| わかさぎ姫 | mixed | 776 | 95 | 1.58 | 208.64 | 1619.05 | 78.7% | 13.3% | 95.0% |
| 姫虫百々世 | mixed | 939 | 93 | 1.1 | 46.11 | 432.99 | 90.7% | 19.6% | 93.0% |
| ナズーリン | mixed | 759 | 92 | 1.55 | 153.27 | 1163.34 | 78.1% | 11.5% | 92.0% |
| 今泉影狼 | mixed | 752 | 92 | 1.1 | 53.97 | 405.89 | 88.8% | 27.0% | 92.0% |
| パチュリー・ノーレッジ | boss | 764 | 91 | 1.49 | 856.47 | 6543.42 | 99.7% | 6.9% | 91.0% |
| 雲居一輪＆雲山 | mixed | 676 | 90 | 1.02 | 43.03 | 290.86 | 88.9% | 18.9% | 90.0% |
| 紅美鈴 | boss | 715 | 85 | 1.33 | 71.51 | 511.3 | 99.0% | 8.4% | 85.0% |
| 純狐 | mixed | 606 | 83 | 1.05 | 164.96 | 999.66 | 98.2% | 23.6% | 83.0% |
| 隠岐奈 | raid | 873 | 81 | 1 | 64.11 | 559.67 | 84.0% | 0.3% | 81.0% |
| 聖白蓮 | mixed | 272 | 77 | 1 | 126.95 | 345.31 | 97.4% | 29.4% | 77.0% |
| 袿姫 | raid | 809 | 75 | 1 | 10.6 | 85.76 | 91.2% | 0.2% | 75.0% |
| 霊夢 | raid | 783 | 74 | 1 | 31.67 | 247.98 | 85.4% | 92.0% | 74.0% |
| 魔理沙 | raid | 840 | 70 | 1 | 1970.79 | 16554.67 | 97.4% | 37.1% | 70.0% |
| 十六夜咲夜 | boss | 179 | 64 | 1.18 | 655.99 | 1174.23 | 97.8% | 4.5% | 64.0% |
| クラウンピース | mixed | 256 | 45 | 1.06 | 286.97 | 734.65 | 99.6% | 8.2% | 45.0% |
| 蘇我屠自古 | mixed | 130 | 35 | 1.03 | 322.12 | 418.75 | 100.0% | 15.4% | 35.0% |
| 菅牧典 | mixed | 108 | 34 | 1.06 | 253.58 | 273.87 | 99.1% | 9.3% | 34.0% |
| 飯綱丸龍 | mixed | 111 | 32 | 1.1 | 350.68 | 389.26 | 100.0% | 10.8% | 32.0% |
| 古明地さとり | mixed | 93 | 31 | 1.09 | 713.46 | 663.52 | 100.0% | 16.1% | 31.0% |
| 天弓千亦 | mixed | 57 | 24 | 1.02 | 354.4 | 202.01 | 100.0% | 12.3% | 24.0% |
| 村紗水蜜 | mixed | 92 | 24 | 1.07 | 167.77 | 154.35 | 97.8% | 1.1% | 24.0% |
| 霊烏路空 | mixed | 42 | 18 | 1.05 | 185.31 | 77.83 | 100.0% | 11.9% | 18.0% |
| 物部布都 | mixed | 33 | 16 | 1.03 | 576.15 | 190.13 | 100.0% | 18.2% | 16.0% |
| 赤蛮奇 | mixed | 25 | 16 | 1 | 387.04 | 96.76 | 80.0% | 16.0% | 16.0% |
| 寅丸星 | mixed | 37 | 15 | 1.03 | 286.73 | 106.09 | 100.0% | 24.3% | 15.0% |
| 古明地こいし | mixed | 21 | 13 | 1 | 509.67 | 107.03 | 81.0% | 4.8% | 13.0% |
| ヘカーティア・ラピスラズリ | mixed | 19 | 12 | 1 | 1034.05 | 196.47 | 100.0% | 26.3% | 12.0% |
| 日白残無 | mixed | 21 | 12 | 1 | 568.43 | 119.37 | 100.0% | 23.8% | 12.0% |
| 豊聡耳神子 | mixed | 14 | 9 | 1 | 171.5 | 24.01 | 100.0% | 14.3% | 9.0% |
| 霍青娥 | boss | 8 | 4 | 1 | 511.38 | 40.91 | 87.5% | 0.0% | 4.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 雲居一輪＆雲山 | vanguard | 897 | 100 | 8.97 | 100.0% |
| 霊烏路空 | mage | 146 | 85 | 1.46 | 85.0% |
| クラウンピース | ranger | 129 | 83 | 1.29 | 83.0% |
| 霍青娥 | assassin | 12 | 11 | 0.12 | 11.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1655467 | 70 | 16554.67 |
| patchouli | patchouli | boss | 654342 | 91 | 6543.42 |
| wakasagihime | wakasagihime | boss | 132097 | 75 | 1320.97 |
| 宮古芳香 | yoshika | raid | 113274 | 95 | 1132.74 |
| sakuya | sakuya | boss | 108338 | 55 | 1083.38 |
| nazrin | nazrin | boss | 90558 | 65 | 905.58 |
| 火焔猫燐 | rin | raid | 89528 | 85 | 895.28 |
| clownpiece | clownpiece | boss | 61196 | 29 | 611.96 |
| 純狐 | junko | raid | 57611 | 61 | 576.11 |
| satori | satori | boss | 54426 | 10 | 544.26 |

## 高コスト指標

| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |
| --- | --- | --- | --- | --- | --- | --- |
| 9525 | 100 | 2857 | 99 | 289 | 89 | 89.0% |

## 高コストショップ提示ユニット

| ユニット名 | ユニットID | ユニット種別 | ロール | 提示元 | コスト | 提示回数 | 提示試合数 | 提示試合率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| パチュリー・ノーレッジ | patchouli | mage | boss | bossShop | 4 | 731 | 100 | 100.0% |
| 寅丸星 | shou | mage | raid | shop | 4 | 957 | 96 | 96.0% |
| 物部布都 | futo | mage | raid | shop | 4 | 912 | 96 | 96.0% |
| 霊烏路空 | utsuho | mage | raid | shop | 4 | 1085 | 95 | 95.0% |
| 純狐 | junko | vanguard | raid | shop | 4 | 937 | 95 | 95.0% |
| 天弓千亦 | chimata | mage | raid | shop | 4 | 1022 | 94 | 94.0% |
| 日白残無 | zanmu | mage | raid | shop | 5 | 599 | 90 | 90.0% |
| 豊聡耳神子 | miko | mage | raid | shop | 5 | 542 | 90 | 90.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | raid | shop | 5 | 524 | 90 | 90.0% |
| 聖白蓮 | byakuren | vanguard | raid | shop | 5 | 526 | 89 | 89.0% |
| 物部布都 | futo | mage | boss | shop | 4 | 273 | 89 | 89.0% |
| 純狐 | junko | vanguard | boss | shop | 4 | 231 | 84 | 84.0% |
| 天弓千亦 | chimata | mage | boss | shop | 4 | 245 | 81 | 81.0% |
| 霊烏路空 | utsuho | mage | boss | shop | 4 | 241 | 80 | 80.0% |
| 寅丸星 | shou | mage | boss | shop | 4 | 202 | 77 | 77.0% |
| 日白残無 | zanmu | mage | boss | shop | 5 | 149 | 70 | 70.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | boss | shop | 5 | 130 | 69 | 69.0% |
| 豊聡耳神子 | miko | mage | boss | shop | 5 | 127 | 64 | 64.0% |
| 聖白蓮 | byakuren | vanguard | boss | shop | 5 | 92 | 57 | 57.0% |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 66633 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 59185 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 59022 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 65510 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 57655 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 65493 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 65830 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 65989 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-008.log |
| 8 | 40 | 5 | 4 | 12000 | 5 | 0 | 56817 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-009.log |
| 9 | 45 | 5 | 2 | 11000 | 5 | 0 | 59270 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-010.log |
| 10 | 50 | 5 | 1 | 10500 | 5 | 0 | 52793 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-011.log |
| 11 | 55 | 5 | 5 | 12500 | 5 | 0 | 59831 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-012.log |
| 12 | 60 | 5 | 3 | 11500 | 5 | 0 | 57278 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-013.log |
| 13 | 65 | 5 | 6 | 13000 | 5 | 0 | 65022 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-014.log |
| 14 | 70 | 5 | 7 | 13500 | 5 | 0 | 52192 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-015.log |
| 15 | 75 | 5 | 0 | 10000 | 5 | 0 | 66414 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-016.log |
| 16 | 80 | 5 | 1 | 10500 | 5 | 0 | 66361 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-017.log |
| 17 | 85 | 5 | 4 | 12000 | 5 | 0 | 64796 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-018.log |
| 18 | 90 | 5 | 7 | 13500 | 5 | 0 | 64948 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-019.log |
| 19 | 95 | 5 | 2 | 11000 | 5 | 0 | 64957 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v2\chunk-020.log |

## 失敗一覧

- 失敗はありません。
