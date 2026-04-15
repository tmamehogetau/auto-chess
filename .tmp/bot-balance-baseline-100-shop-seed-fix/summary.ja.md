# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix
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
- ボス勝利数: 77
- レイド勝利数: 23
- ボス勝率: 77.0%
- レイド勝率: 23.0%
- 平均ラウンド数: 10.92
- 最短ラウンド: 3
- 最長ラウンド: 12
- 平均生存レイド人数: 2.4

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 3 | 4 |
| 4 | 4 |
| 5 | 3 |
| 7 | 1 |
| 9 | 2 |
| 10 | 3 |
| 11 | 2 |
| 12 | 81 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.81 | 31.0% | 100 | 1.71 | 18.94 | 9.45 | 65.28 | 37.19 | 0.05 | 5.72 |
| P2 | 2.05 | 32.0% | 100 | 2.19 | 22.38 | 7.61 | 61.91 | 35.83 | 0.14 | 4.69 |
| P3 | 2.82 | 19.0% | 100 | 1.52 | 11.47 | 21.95 | 87.1 | 42.98 | 0 | 10.19 |
| P4 | 3.32 | 18.0% | 100 | 1.52 | 2.98 | 35.26 | 109.17 | 47.24 | 0 | 15.66 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 宮古芳香 | mixed | 2655 | 100 | 1.77 | 51.77 | 1374.44 | 80.3% | 23.1% | 100.0% |
| 火焔猫燐 | mixed | 2729 | 100 | 1.66 | 44.14 | 1204.48 | 85.5% | 23.5% | 100.0% |
| レミリア | boss | 1092 | 100 | 1 | 33.06 | 361.03 | 97.9% | 5.7% | 100.0% |
| わかさぎ姫 | mixed | 752 | 97 | 1.41 | 183.53 | 1380.18 | 76.7% | 15.2% | 97.0% |
| ナズーリン | mixed | 805 | 95 | 1.61 | 108.04 | 869.72 | 68.9% | 8.2% | 95.0% |
| 姫虫百々世 | mixed | 842 | 95 | 1.08 | 31.23 | 262.97 | 91.8% | 31.1% | 95.0% |
| パチュリー・ノーレッジ | boss | 831 | 92 | 1.54 | 722.59 | 6004.69 | 100.0% | 5.7% | 92.0% |
| 今泉影狼 | mixed | 799 | 92 | 1.03 | 41.93 | 335.04 | 89.1% | 26.7% | 92.0% |
| 紅美鈴 | boss | 477 | 87 | 1.13 | 71.19 | 339.59 | 99.0% | 7.5% | 87.0% |
| 雲居一輪＆雲山 | mixed | 533 | 85 | 1.02 | 34.62 | 184.51 | 90.8% | 30.8% | 85.0% |
| 十六夜咲夜 | boss | 346 | 82 | 1.33 | 550.76 | 1905.62 | 97.7% | 3.5% | 82.0% |
| 霊夢 | raid | 841 | 80 | 1 | 18.64 | 156.8 | 86.3% | 93.8% | 80.0% |
| 純狐 | mixed | 422 | 78 | 1.08 | 197 | 831.32 | 98.6% | 18.7% | 78.0% |
| 魔理沙 | raid | 888 | 74 | 1 | 2059.8 | 18291.03 | 95.2% | 27.0% | 74.0% |
| 隠岐奈 | raid | 761 | 73 | 1 | 68.08 | 518.1 | 83.2% | 0.1% | 73.0% |
| 袿姫 | raid | 762 | 73 | 1 | 7.22 | 55.03 | 91.5% | 0.0% | 73.0% |
| クラウンピース | mixed | 328 | 58 | 1.11 | 235.69 | 773.07 | 99.7% | 7.3% | 58.0% |
| 聖白蓮 | mixed | 129 | 44 | 1.02 | 165.5 | 213.49 | 96.9% | 27.1% | 44.0% |
| 蘇我屠自古 | mixed | 77 | 41 | 1 | 237.65 | 182.99 | 100.0% | 15.6% | 41.0% |
| 村紗水蜜 | mixed | 88 | 40 | 1.01 | 568.3 | 500.1 | 98.9% | 13.6% | 40.0% |
| 菅牧典 | mixed | 88 | 38 | 1 | 316.74 | 278.73 | 98.9% | 8.0% | 38.0% |
| 古明地さとり | mixed | 93 | 37 | 1.04 | 531.74 | 494.52 | 100.0% | 15.1% | 37.0% |
| 霊烏路空 | mixed | 120 | 34 | 1.06 | 606.29 | 727.55 | 100.0% | 10.0% | 34.0% |
| 飯綱丸龍 | mixed | 56 | 34 | 1 | 368.07 | 206.12 | 100.0% | 8.9% | 34.0% |
| 寅丸星 | mixed | 33 | 23 | 1 | 492.12 | 162.4 | 100.0% | 12.1% | 23.0% |
| 天弓千亦 | mixed | 84 | 22 | 1.05 | 468.68 | 393.69 | 98.8% | 7.1% | 22.0% |
| 物部布都 | boss | 40 | 20 | 1.02 | 640.77 | 256.31 | 97.5% | 7.5% | 20.0% |
| ヘカーティア・ラピスラズリ | mixed | 37 | 16 | 1 | 801.11 | 296.41 | 100.0% | 8.1% | 16.0% |
| 赤蛮奇 | mixed | 25 | 16 | 1 | 320.52 | 80.13 | 60.0% | 8.0% | 16.0% |
| 日白残無 | mixed | 27 | 15 | 1 | 739.48 | 199.66 | 100.0% | 18.5% | 15.0% |
| 豊聡耳神子 | mixed | 23 | 15 | 1 | 734.43 | 168.92 | 100.0% | 17.4% | 15.0% |
| 古明地こいし | mixed | 18 | 15 | 1 | 307.33 | 55.32 | 94.4% | 11.1% | 15.0% |
| 霍青娥 | mixed | 16 | 13 | 1 | 390.31 | 62.45 | 62.5% | 6.3% | 13.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 火焔猫燐 | vanguard | 851 | 100 | 8.51 | 100.0% |
| パチュリー・ノーレッジ | mage | 192 | 94 | 1.92 | 94.0% |
| わかさぎ姫 | ranger | 122 | 83 | 1.22 | 83.0% |
| 十六夜咲夜 | assassin | 25 | 25 | 0.25 | 25.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1829103 | 74 | 18291.03 |
| patchouli | patchouli | boss | 600469 | 92 | 6004.69 |
| sakuya | sakuya | boss | 188879 | 81 | 1888.79 |
| wakasagihime | wakasagihime | boss | 102871 | 85 | 1028.71 |
| 宮古芳香 | yoshika | raid | 102416 | 95 | 1024.16 |
| 火焔猫燐 | rin | raid | 97496 | 100 | 974.96 |
| clownpiece | clownpiece | boss | 55777 | 35 | 557.77 |
| nazrin | nazrin | boss | 54999 | 59 | 549.99 |
| utsuho | utsuho | boss | 54684 | 17 | 546.84 |
| junko | junko | boss | 51478 | 43 | 514.78 |

## 高コスト指標

| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |
| --- | --- | --- | --- | --- | --- | --- |
| 9465 | 100 | 2492 | 97 | 215 | 85 | 85.0% |

## 高コストショップ提示ユニット

| ユニット名 | ユニットID | ユニット種別 | ロール | 提示元 | コスト | 提示回数 | 提示試合数 | 提示試合率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| パチュリー・ノーレッジ | patchouli | mage | boss | bossShop | 4 | 745 | 100 | 100.0% |
| 天弓千亦 | chimata | mage | raid | shop | 4 | 1034 | 92 | 92.0% |
| 寅丸星 | shou | mage | raid | shop | 4 | 1020 | 92 | 92.0% |
| 物部布都 | futo | mage | raid | shop | 4 | 967 | 91 | 91.0% |
| 純狐 | junko | vanguard | raid | shop | 4 | 949 | 91 | 91.0% |
| 霊烏路空 | utsuho | mage | raid | shop | 4 | 985 | 90 | 90.0% |
| 聖白蓮 | byakuren | vanguard | raid | shop | 5 | 480 | 87 | 87.0% |
| 日白残無 | zanmu | mage | raid | shop | 5 | 527 | 86 | 86.0% |
| 霊烏路空 | utsuho | mage | boss | shop | 4 | 264 | 86 | 86.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | raid | shop | 5 | 484 | 85 | 85.0% |
| 豊聡耳神子 | miko | mage | raid | shop | 5 | 456 | 85 | 85.0% |
| 純狐 | junko | vanguard | boss | shop | 4 | 240 | 83 | 83.0% |
| 物部布都 | futo | mage | boss | shop | 4 | 257 | 82 | 82.0% |
| 天弓千亦 | chimata | mage | boss | shop | 4 | 257 | 81 | 81.0% |
| 寅丸星 | shou | mage | boss | shop | 4 | 254 | 80 | 80.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | boss | shop | 5 | 150 | 69 | 69.0% |
| 日白残無 | zanmu | mage | boss | shop | 5 | 140 | 66 | 66.0% |
| 豊聡耳神子 | miko | mage | boss | shop | 5 | 136 | 61 | 61.0% |
| 聖白蓮 | byakuren | vanguard | boss | shop | 5 | 120 | 61 | 61.0% |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 62591 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 56308 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 66093 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 58148 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 63792 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 65712 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 64782 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 56485 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-008.log |
| 8 | 40 | 5 | 1 | 10500 | 5 | 0 | 65081 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-009.log |
| 9 | 45 | 5 | 7 | 13500 | 5 | 0 | 57242 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-010.log |
| 10 | 50 | 5 | 3 | 11500 | 5 | 0 | 65071 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-011.log |
| 11 | 55 | 5 | 0 | 10000 | 5 | 0 | 48761 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-012.log |
| 12 | 60 | 5 | 4 | 12000 | 5 | 0 | 64913 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-013.log |
| 13 | 65 | 5 | 6 | 13000 | 5 | 0 | 64922 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-014.log |
| 14 | 70 | 5 | 5 | 12500 | 5 | 0 | 53214 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-015.log |
| 15 | 75 | 5 | 2 | 11000 | 5 | 0 | 57829 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-016.log |
| 16 | 80 | 5 | 0 | 10000 | 5 | 0 | 55296 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-017.log |
| 17 | 85 | 5 | 7 | 13500 | 5 | 0 | 64938 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-018.log |
| 18 | 90 | 5 | 5 | 12500 | 5 | 0 | 60221 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-019.log |
| 19 | 95 | 5 | 1 | 10500 | 5 | 0 | 48651 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-shop-seed-fix\chunk-020.log |

## 失敗一覧

- 失敗はありません。
