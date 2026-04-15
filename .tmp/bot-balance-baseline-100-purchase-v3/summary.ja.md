# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3
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
- ボス勝利数: 86
- レイド勝利数: 14
- ボス勝率: 86.0%
- レイド勝率: 14.0%
- 平均ラウンド数: 11.07
- 最短ラウンド: 3
- 最長ラウンド: 12
- 平均生存レイド人数: 2.45

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 3 | 1 |
| 4 | 6 |
| 5 | 2 |
| 7 | 2 |
| 8 | 1 |
| 9 | 1 |
| 11 | 5 |
| 12 | 82 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.87 | 31.0% | 100 | 1.3 | 4.44 | 16.59 | 90.96 | 44.41 | 0.56 | 10.18 |
| P2 | 1.95 | 37.0% | 100 | 2.1 | 3.25 | 16.63 | 92.52 | 45.3 | 0.53 | 10.1 |
| P3 | 2.75 | 17.0% | 100 | 1.68 | 3.21 | 16.67 | 88.77 | 43.76 | 0.2 | 10.08 |
| P4 | 3.43 | 15.0% | 100 | 1.76 | 3.92 | 15.28 | 86.62 | 39.71 | 0.01 | 10.26 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 宮古芳香 | mixed | 2547 | 100 | 1.77 | 52.57 | 1338.95 | 77.3% | 23.9% | 100.0% |
| 火焔猫燐 | mixed | 2491 | 100 | 1.73 | 46.89 | 1167.98 | 85.4% | 25.5% | 100.0% |
| レミリア | boss | 1107 | 100 | 1 | 31.92 | 353.34 | 97.1% | 6.1% | 100.0% |
| パチュリー・ノーレッジ | boss | 859 | 99 | 1.5 | 849.43 | 7296.6 | 99.9% | 7.1% | 99.0% |
| わかさぎ姫 | mixed | 641 | 97 | 1.35 | 193.04 | 1237.38 | 76.6% | 14.2% | 97.0% |
| 姫虫百々世 | mixed | 868 | 97 | 1.07 | 38.91 | 337.7 | 88.9% | 25.8% | 97.0% |
| ナズーリン | mixed | 846 | 96 | 1.65 | 121.59 | 1028.67 | 74.9% | 9.8% | 96.0% |
| 今泉影狼 | mixed | 689 | 95 | 1.07 | 40.69 | 280.36 | 91.7% | 28.2% | 95.0% |
| 紅美鈴 | boss | 480 | 94 | 1.11 | 69.06 | 331.47 | 97.9% | 8.1% | 94.0% |
| 純狐 | mixed | 719 | 89 | 1.04 | 178.35 | 1282.31 | 97.1% | 22.7% | 89.0% |
| 雲居一輪＆雲山 | mixed | 458 | 86 | 1.04 | 43.47 | 199.1 | 86.2% | 26.4% | 86.0% |
| 十六夜咲夜 | boss | 339 | 82 | 1.22 | 643.57 | 2181.69 | 96.8% | 5.6% | 82.0% |
| 袿姫 | raid | 888 | 82 | 1 | 6.57 | 58.32 | 92.2% | 0.0% | 82.0% |
| 聖白蓮 | mixed | 376 | 81 | 1.01 | 113.53 | 426.86 | 97.3% | 20.2% | 81.0% |
| 隠岐奈 | raid | 859 | 80 | 1 | 67.78 | 582.19 | 83.2% | 0.6% | 80.0% |
| 魔理沙 | raid | 852 | 71 | 1 | 1997.13 | 17015.57 | 95.0% | 46.1% | 71.0% |
| 霊夢 | raid | 700 | 67 | 1 | 27.36 | 191.55 | 80.3% | 91.6% | 67.0% |
| クラウンピース | mixed | 298 | 58 | 1.06 | 260.62 | 776.66 | 99.3% | 9.4% | 58.0% |
| 蘇我屠自古 | mixed | 95 | 44 | 1.01 | 221.21 | 210.15 | 97.9% | 14.7% | 44.0% |
| 古明地さとり | mixed | 88 | 41 | 1.01 | 233.86 | 205.8 | 100.0% | 10.2% | 41.0% |
| 飯綱丸龍 | mixed | 74 | 40 | 1 | 308.97 | 228.64 | 98.6% | 10.8% | 40.0% |
| 寅丸星 | mixed | 69 | 40 | 1.01 | 262.96 | 181.44 | 98.6% | 17.4% | 40.0% |
| 菅牧典 | mixed | 73 | 39 | 1.01 | 306.99 | 224.1 | 98.6% | 19.2% | 39.0% |
| 霊烏路空 | mixed | 134 | 38 | 1.03 | 633.49 | 848.88 | 100.0% | 9.7% | 38.0% |
| 天弓千亦 | mixed | 144 | 37 | 1.03 | 308.29 | 443.94 | 100.0% | 4.9% | 37.0% |
| 村紗水蜜 | mixed | 70 | 33 | 1 | 302.39 | 211.67 | 100.0% | 10.0% | 33.0% |
| 物部布都 | mixed | 44 | 23 | 1 | 442 | 194.48 | 100.0% | 15.9% | 23.0% |
| ヘカーティア・ラピスラズリ | mixed | 52 | 20 | 1.02 | 451.75 | 234.91 | 100.0% | 7.7% | 20.0% |
| 赤蛮奇 | mixed | 36 | 17 | 1.25 | 262.56 | 94.52 | 75.0% | 22.2% | 17.0% |
| 日白残無 | mixed | 24 | 17 | 1 | 278.04 | 66.73 | 100.0% | 8.3% | 17.0% |
| 古明地こいし | mixed | 23 | 16 | 1.04 | 207.22 | 47.66 | 95.7% | 4.3% | 16.0% |
| 豊聡耳神子 | mixed | 26 | 14 | 1.04 | 384.54 | 99.98 | 96.2% | 3.8% | 14.0% |
| 霍青娥 | mixed | 14 | 10 | 1 | 517.93 | 72.51 | 64.3% | 7.1% | 10.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 姫虫百々世 | vanguard | 842 | 100 | 8.42 | 100.0% |
| パチュリー・ノーレッジ | mage | 203 | 97 | 2.03 | 97.0% |
| ナズーリン | ranger | 127 | 86 | 1.27 | 86.0% |
| 十六夜咲夜 | assassin | 21 | 20 | 0.21 | 20.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1701557 | 71 | 17015.57 |
| patchouli | patchouli | boss | 729660 | 99 | 7296.6 |
| sakuya | sakuya | boss | 218169 | 82 | 2181.69 |
| 宮古芳香 | yoshika | raid | 100323 | 98 | 1003.23 |
| wakasagihime | wakasagihime | boss | 89607 | 76 | 896.07 |
| 火焔猫燐 | rin | raid | 87970 | 85 | 879.7 |
| utsuho | utsuho | boss | 73782 | 19 | 737.82 |
| nazrin | nazrin | boss | 73296 | 65 | 732.96 |
| clownpiece | clownpiece | boss | 59044 | 37 | 590.44 |
| 純狐 | junko | raid | 48426 | 53 | 484.26 |

## 高コスト指標

| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |
| --- | --- | --- | --- | --- | --- | --- |
| 9930 | 100 | 3243 | 100 | 397 | 90 | 90.0% |

## 高コストショップ提示ユニット

| ユニット名 | ユニットID | ユニット種別 | ロール | 提示元 | コスト | 提示回数 | 提示試合数 | 提示試合率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| パチュリー・ノーレッジ | patchouli | mage | boss | bossShop | 4 | 741 | 100 | 100.0% |
| 寅丸星 | shou | mage | raid | shop | 4 | 1010 | 95 | 95.0% |
| 天弓千亦 | chimata | mage | raid | shop | 4 | 1086 | 94 | 94.0% |
| 霊烏路空 | utsuho | mage | raid | shop | 4 | 1046 | 94 | 94.0% |
| 物部布都 | futo | mage | raid | shop | 4 | 1022 | 94 | 94.0% |
| 純狐 | junko | vanguard | raid | shop | 4 | 865 | 92 | 92.0% |
| 豊聡耳神子 | miko | mage | raid | shop | 5 | 539 | 89 | 89.0% |
| 霊烏路空 | utsuho | mage | boss | shop | 4 | 290 | 89 | 89.0% |
| 日白残無 | zanmu | mage | raid | shop | 5 | 545 | 88 | 88.0% |
| 聖白蓮 | byakuren | vanguard | raid | shop | 5 | 523 | 88 | 88.0% |
| 寅丸星 | shou | mage | boss | shop | 4 | 288 | 88 | 88.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | raid | shop | 5 | 566 | 86 | 86.0% |
| 物部布都 | futo | mage | boss | shop | 4 | 283 | 85 | 85.0% |
| 天弓千亦 | chimata | mage | boss | shop | 4 | 255 | 81 | 81.0% |
| 純狐 | junko | vanguard | boss | shop | 4 | 242 | 80 | 80.0% |
| 日白残無 | zanmu | mage | boss | shop | 5 | 166 | 78 | 78.0% |
| 豊聡耳神子 | miko | mage | boss | shop | 5 | 191 | 73 | 73.0% |
| 聖白蓮 | byakuren | vanguard | boss | shop | 5 | 137 | 70 | 70.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | boss | shop | 5 | 135 | 64 | 64.0% |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 50547 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 57382 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 65547 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 65996 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 54944 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 66201 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 65857 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 61809 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-008.log |
| 8 | 40 | 5 | 0 | 10000 | 5 | 0 | 60586 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-009.log |
| 9 | 45 | 5 | 4 | 12000 | 5 | 0 | 65121 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-010.log |
| 10 | 50 | 5 | 1 | 10500 | 5 | 0 | 64858 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-011.log |
| 11 | 55 | 5 | 7 | 13500 | 5 | 0 | 55502 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-012.log |
| 12 | 60 | 5 | 2 | 11000 | 5 | 0 | 56879 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-013.log |
| 13 | 65 | 5 | 6 | 13000 | 5 | 0 | 64846 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-014.log |
| 14 | 70 | 5 | 3 | 11500 | 5 | 0 | 57255 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-015.log |
| 15 | 75 | 5 | 5 | 12500 | 5 | 0 | 60701 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-016.log |
| 16 | 80 | 5 | 0 | 10000 | 5 | 0 | 58015 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-017.log |
| 17 | 85 | 5 | 7 | 13500 | 5 | 0 | 65231 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-018.log |
| 18 | 90 | 5 | 4 | 12000 | 5 | 0 | 65618 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-019.log |
| 19 | 95 | 5 | 1 | 10500 | 5 | 0 | 56436 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-purchase-v3\chunk-020.log |

## 失敗一覧

- 失敗はありません。
