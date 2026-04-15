# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- ボス購入方針: strength
- レイド購入方針: strength, strength, strength
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest
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
- ボス勝利数: 80
- レイド勝利数: 20
- ボス勝率: 80.0%
- レイド勝率: 20.0%
- 平均ラウンド数: 11.37
- 最短ラウンド: 2
- 最長ラウンド: 12
- 平均生存レイド人数: 2.55

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 2 | 1 |
| 4 | 2 |
| 5 | 4 |
| 7 | 1 |
| 10 | 1 |
| 11 | 2 |
| 12 | 89 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 1.88 | 30.0% | 100 | 1.63 | 3.63 | 16.13 | 90.48 | 44.9 | 0.51 | 9.96 |
| P2 | 1.96 | 37.0% | 100 | 2.11 | 3.59 | 18.4 | 96.47 | 47.14 | 0.63 | 11.1 |
| P3 | 2.99 | 12.0% | 100 | 1.75 | 4.49 | 17.47 | 89.41 | 43.24 | 0.2 | 10.65 |
| P4 | 3.17 | 21.0% | 100 | 1.68 | 3.79 | 14.87 | 89.31 | 40.25 | 0.05 | 10.34 |

## ボス側戦闘ユニット指標

| ユニット名 | ユニットID | ユニット種別 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| レミリア | remilia | remilia | 1137 | 100 | 1 | 32.73 | 372.14 | 98.3% | 5.5% | 100.0% |
| 紅美鈴 | meiling | meiling | 516 | 99 | 1.09 | 74.02 | 381.93 | 97.1% | 9.3% | 99.0% |
| 宮古芳香 | yoshika | yoshika | 791 | 97 | 1.75 | 40.64 | 321.47 | 53.9% | 4.7% | 97.0% |
| パチュリー・ノーレッジ | patchouli | patchouli | 880 | 96 | 1.5 | 718.24 | 6320.53 | 99.9% | 4.4% | 96.0% |
| 火焔猫燐 | rin | rin | 725 | 93 | 1.6 | 32.12 | 232.88 | 65.2% | 5.0% | 93.0% |
| ナズーリン | nazrin | nazrin | 760 | 91 | 1.63 | 128.84 | 979.18 | 74.3% | 5.7% | 91.0% |
| わかさぎ姫 | wakasagihime | wakasagihime | 559 | 87 | 1.48 | 205.43 | 1148.36 | 75.3% | 5.7% | 87.0% |
| 十六夜咲夜 | sakuya | sakuya | 337 | 78 | 1.3 | 620.88 | 2092.35 | 95.5% | 4.2% | 78.0% |
| クラウンピース | clownpiece | clownpiece | 361 | 53 | 1.16 | 267.68 | 966.32 | 98.3% | 5.5% | 53.0% |
| 純狐 | junko | junko | 223 | 50 | 1.07 | 224.63 | 500.93 | 98.7% | 5.8% | 50.0% |
| 聖白蓮 | byakuren | byakuren | 138 | 47 | 1 | 189.53 | 261.55 | 94.2% | 8.7% | 47.0% |
| 今泉影狼 | kagerou | kagerou | 73 | 38 | 1 | 56.52 | 41.26 | 86.3% | 4.1% | 38.0% |
| 霊烏路空 | utsuho | utsuho | 159 | 35 | 1.1 | 836.86 | 1330.6 | 100.0% | 5.7% | 35.0% |
| 雲居一輪＆雲山 | ichirin | ichirin | 79 | 35 | 1.06 | 62.38 | 49.28 | 87.3% | 10.1% | 35.0% |
| 古明地さとり | satori | satori | 68 | 34 | 1.01 | 598.57 | 407.03 | 100.0% | 7.4% | 34.0% |
| 飯綱丸龍 | megumu | megumu | 57 | 34 | 1.05 | 344.46 | 196.34 | 98.2% | 5.3% | 34.0% |
| 菅牧典 | tsukasa | tsukasa | 53 | 30 | 1 | 1006.34 | 533.36 | 98.1% | 13.2% | 30.0% |
| 姫虫百々世 | momoyo | momoyo | 58 | 30 | 1 | 60.97 | 35.36 | 84.5% | 5.2% | 30.0% |
| 天弓千亦 | chimata | chimata | 124 | 28 | 1.07 | 664.67 | 824.19 | 100.0% | 8.9% | 28.0% |
| 村紗水蜜 | murasa | murasa | 66 | 28 | 1 | 479.95 | 316.77 | 100.0% | 4.5% | 28.0% |
| 蘇我屠自古 | tojiko | tojiko | 48 | 25 | 1 | 341.21 | 163.78 | 97.9% | 6.3% | 25.0% |
| ヘカーティア・ラピスラズリ | hecatia | hecatia | 46 | 20 | 1.02 | 717.96 | 330.26 | 100.0% | 8.7% | 20.0% |
| 物部布都 | futo | futo | 34 | 17 | 1 | 819.97 | 278.79 | 100.0% | 5.9% | 17.0% |
| 寅丸星 | shou | shou | 37 | 17 | 1 | 681.54 | 252.17 | 100.0% | 10.8% | 17.0% |
| 日白残無 | zanmu | zanmu | 27 | 15 | 1 | 466.41 | 125.93 | 100.0% | 3.7% | 15.0% |
| 霍青娥 | seiga | seiga | 20 | 14 | 1 | 457.3 | 91.46 | 40.0% | 0.0% | 14.0% |
| 赤蛮奇 | sekibanki | sekibanki | 21 | 13 | 1 | 258.38 | 54.26 | 57.1% | 0.0% | 13.0% |
| 古明地こいし | koishi | koishi | 15 | 9 | 1 | 355.47 | 53.32 | 86.7% | 0.0% | 9.0% |
| 豊聡耳神子 | miko | miko | 13 | 6 | 1 | 945.77 | 122.95 | 100.0% | 23.1% | 6.0% |

## レイド側戦闘ユニット指標

| ユニット名 | ユニットID | ユニット種別 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 | サブ採用回数 | サブ採用試合数 | サブ採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 宮古芳香 | yoshika | yoshika | 1749 | 100 | 1.83 | 61.85 | 1081.72 | 91.4% | 32.0% | 100.0% | 1744 | 100 | 100.0% |
| 火焔猫燐 | rin | rin | 1736 | 100 | 1.67 | 53.81 | 934.16 | 92.1% | 36.1% | 100.0% | 1676 | 100 | 100.0% |
| 姫虫百々世 | momoyo | momoyo | 855 | 91 | 1.09 | 39.48 | 337.55 | 90.9% | 30.1% | 91.0% | 842 | 91 | 91.0% |
| 今泉影狼 | kagerou | kagerou | 661 | 91 | 1.05 | 42.86 | 283.32 | 89.3% | 27.5% | 91.0% | 653 | 91 | 91.0% |
| 雲居一輪＆雲山 | ichirin | ichirin | 412 | 91 | 1.01 | 40.6 | 167.26 | 86.7% | 28.2% | 91.0% | 406 | 91 | 91.0% |
| 純狐 | junko | junko | 470 | 87 | 1.05 | 146.57 | 688.86 | 92.6% | 29.1% | 87.0% | 470 | 87 | 87.0% |
| 隠岐奈 | okina | okina | 885 | 80 | 1 | 66.72 | 590.5 | 81.8% | 0.9% | 80.0% | 0 | 0 | 0.0% |
| わかさぎ姫 | wakasagihime | wakasagihime | 175 | 76 | 1.35 | 152.01 | 266.02 | 88.0% | 43.4% | 76.0% | 82 | 49 | 49.0% |
| 聖白蓮 | byakuren | byakuren | 268 | 75 | 1.01 | 86.38 | 231.49 | 92.5% | 26.5% | 75.0% | 268 | 75 | 75.0% |
| 袿姫 | keiki | keiki | 832 | 75 | 1 | 7.23 | 60.18 | 92.3% | 0.0% | 75.0% | 0 | 0 | 0.0% |
| 霊夢 | reimu | reimu | 810 | 74 | 1 | 27.31 | 221.21 | 81.1% | 93.2% | 74.0% | 0 | 0 | 0.0% |
| 魔理沙 | marisa | marisa | 852 | 71 | 1 | 2007.64 | 17105.07 | 95.1% | 36.6% | 71.0% | 0 | 0 | 0.0% |
| ナズーリン | nazrin | nazrin | 160 | 71 | 1.4 | 124.96 | 199.93 | 88.8% | 26.9% | 71.0% | 109 | 57 | 57.0% |
| 蘇我屠自古 | tojiko | tojiko | 34 | 19 | 1.15 | 208.79 | 70.99 | 100.0% | 38.2% | 19.0% | 24 | 16 | 16.0% |
| クラウンピース | clownpiece | clownpiece | 21 | 16 | 1.05 | 154.67 | 32.48 | 95.2% | 28.6% | 16.0% | 14 | 11 | 11.0% |
| 菅牧典 | tsukasa | tsukasa | 22 | 14 | 1.05 | 109.05 | 23.99 | 100.0% | 40.9% | 14.0% | 18 | 11 | 11.0% |
| 霊烏路空 | utsuho | utsuho | 17 | 13 | 1 | 204.06 | 34.69 | 100.0% | 17.6% | 13.0% | 16 | 12 | 12.0% |
| 古明地さとり | satori | satori | 14 | 13 | 1 | 130.64 | 18.29 | 100.0% | 28.6% | 13.0% | 14 | 13 | 13.0% |
| 飯綱丸龍 | megumu | megumu | 21 | 12 | 1.19 | 278.33 | 58.45 | 100.0% | 19.0% | 12.0% | 17 | 11 | 11.0% |
| 物部布都 | futo | futo | 15 | 11 | 1 | 266.8 | 40.02 | 100.0% | 33.3% | 11.0% | 15 | 11 | 11.0% |
| 日白残無 | zanmu | zanmu | 12 | 10 | 1 | 259.58 | 31.15 | 100.0% | 33.3% | 10.0% | 12 | 10 | 10.0% |
| ヘカーティア・ラピスラズリ | hecatia | hecatia | 9 | 9 | 1 | 422.56 | 38.03 | 100.0% | 33.3% | 9.0% | 9 | 9 | 9.0% |
| 赤蛮奇 | sekibanki | sekibanki | 16 | 9 | 1.06 | 191.5 | 30.64 | 100.0% | 31.3% | 9.0% | 0 | 0 | 0.0% |
| 寅丸星 | shou | shou | 15 | 9 | 1.07 | 199.4 | 29.91 | 100.0% | 26.7% | 9.0% | 15 | 9 | 9.0% |
| 天弓千亦 | chimata | chimata | 8 | 6 | 1 | 212.25 | 16.98 | 100.0% | 12.5% | 6.0% | 8 | 6 | 6.0% |
| 村紗水蜜 | murasa | murasa | 9 | 6 | 1 | 145.89 | 13.13 | 100.0% | 11.1% | 6.0% | 9 | 6 | 6.0% |
| 豊聡耳神子 | miko | miko | 5 | 4 | 1 | 816 | 40.8 | 100.0% | 60.0% | 4.0% | 5 | 4 | 4.0% |
| 古明地こいし | koishi | koishi | 3 | 3 | 1 | 164 | 4.92 | 100.0% | 33.3% | 3.0% | 1 | 1 | 1.0% |
| 霍青娥 | seiga | seiga | 1 | 1 | 1 | 0 | 0 | 0.0% | 100.0% | 1.0% | 0 | 0 | 0.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニットID | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- |
| パチュリー・ノーレッジ | patchouli | mage | 83 | 83 | 0.83 | 83.0% |
| 宮古芳香 | yoshika | vanguard | 152 | 82 | 1.52 | 82.0% |
| 純狐 | junko | vanguard | 170 | 81 | 1.7 | 81.0% |
| 聖白蓮 | byakuren | vanguard | 142 | 79 | 1.42 | 79.0% |
| 火焔猫燐 | rin | vanguard | 136 | 78 | 1.36 | 78.0% |
| 姫虫百々世 | momoyo | vanguard | 73 | 58 | 0.73 | 58.0% |
| ナズーリン | nazrin | ranger | 60 | 58 | 0.6 | 58.0% |
| 紅美鈴 | meiling | vanguard | 48 | 48 | 0.48 | 48.0% |
| 今泉影狼 | kagerou | vanguard | 50 | 44 | 0.5 | 44.0% |
| 雲居一輪＆雲山 | ichirin | vanguard | 41 | 35 | 0.41 | 35.0% |
| クラウンピース | clownpiece | ranger | 34 | 34 | 0.34 | 34.0% |
| 霊烏路空 | utsuho | mage | 33 | 31 | 0.33 | 31.0% |
| わかさぎ姫 | wakasagihime | ranger | 30 | 29 | 0.3 | 29.0% |
| 天弓千亦 | chimata | mage | 26 | 25 | 0.26 | 25.0% |
| 十六夜咲夜 | sakuya | assassin | 25 | 25 | 0.25 | 25.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | 22 | 22 | 0.22 | 22.0% |
| 物部布都 | futo | mage | 11 | 11 | 0.11 | 11.0% |
| 日白残無 | zanmu | mage | 11 | 11 | 0.11 | 11.0% |
| 寅丸星 | shou | mage | 9 | 9 | 0.09 | 9.0% |
| 飯綱丸龍 | megumu | ranger | 8 | 8 | 0.08 | 8.0% |
| 豊聡耳神子 | miko | mage | 5 | 5 | 0.05 | 5.0% |
| 村紗水蜜 | murasa | mage | 5 | 5 | 0.05 | 5.0% |
| 古明地さとり | satori | mage | 5 | 5 | 0.05 | 5.0% |
| 蘇我屠自古 | tojiko | ranger | 2 | 2 | 0.02 | 2.0% |
| 菅牧典 | tsukasa | mage | 2 | 2 | 0.02 | 2.0% |
| 古明地こいし | koishi | assassin | 1 | 1 | 0.01 | 1.0% |
| 霍青娥 | seiga | assassin | 1 | 1 | 0.01 | 1.0% |
| 赤蛮奇 | sekibanki | assassin | 1 | 1 | 0.01 | 1.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1710507 | 71 | 17105.07 |
| patchouli | patchouli | boss | 632053 | 96 | 6320.53 |
| sakuya | sakuya | boss | 207449 | 77 | 2074.49 |
| utsuho | utsuho | boss | 123139 | 25 | 1231.39 |
| wakasagihime | wakasagihime | boss | 104399 | 76 | 1043.99 |
| 宮古芳香 | yoshika | raid | 100263 | 94 | 1002.63 |
| clownpiece | clownpiece | boss | 80786 | 41 | 807.86 |
| nazrin | nazrin | boss | 78481 | 65 | 784.81 |
| 火焔猫燐 | rin | raid | 77141 | 73 | 771.41 |
| chimata | chimata | boss | 71012 | 16 | 710.12 |

## 高コスト指標

| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |
| --- | --- | --- | --- | --- | --- | --- |
| 10109 | 100 | 3289 | 100 | 429 | 94 | 94.0% |

## 高コストショップ提示ユニット

| ユニット名 | ユニットID | ユニット種別 | ロール | 提示元 | コスト | 提示回数 | 提示試合数 | 提示試合率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| パチュリー・ノーレッジ | patchouli | mage | boss | bossShop | 4 | 761 | 100 | 100.0% |
| 純狐 | junko | vanguard | raid | shop | 4 | 1013 | 98 | 98.0% |
| 霊烏路空 | utsuho | mage | raid | shop | 4 | 1026 | 97 | 97.0% |
| 寅丸星 | shou | mage | raid | shop | 4 | 1047 | 96 | 96.0% |
| 物部布都 | futo | mage | raid | shop | 4 | 993 | 96 | 96.0% |
| 天弓千亦 | chimata | mage | raid | shop | 4 | 994 | 95 | 95.0% |
| 豊聡耳神子 | miko | mage | raid | shop | 5 | 587 | 92 | 92.0% |
| 聖白蓮 | byakuren | vanguard | raid | shop | 5 | 539 | 92 | 92.0% |
| 日白残無 | zanmu | mage | raid | shop | 5 | 615 | 91 | 91.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | raid | shop | 5 | 522 | 91 | 91.0% |
| 天弓千亦 | chimata | mage | boss | shop | 4 | 301 | 91 | 91.0% |
| 物部布都 | futo | mage | boss | shop | 4 | 297 | 89 | 89.0% |
| 寅丸星 | shou | mage | boss | shop | 4 | 284 | 89 | 89.0% |
| 純狐 | junko | vanguard | boss | shop | 4 | 228 | 88 | 88.0% |
| 霊烏路空 | utsuho | mage | boss | shop | 4 | 296 | 87 | 87.0% |
| 日白残無 | zanmu | mage | boss | shop | 5 | 170 | 73 | 73.0% |
| ヘカーティア・ラピスラズリ | hecatia | mage | boss | shop | 5 | 144 | 72 | 72.0% |
| 聖白蓮 | byakuren | vanguard | boss | shop | 5 | 131 | 72 | 72.0% |
| 豊聡耳神子 | miko | mage | boss | shop | 5 | 161 | 70 | 70.0% |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 66431 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 57811 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 67859 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 66114 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 65029 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 47645 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 65781 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 65806 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-008.log |
| 8 | 40 | 5 | 5 | 12500 | 5 | 0 | 65768 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-009.log |
| 9 | 45 | 5 | 1 | 10500 | 5 | 0 | 53876 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-010.log |
| 10 | 50 | 5 | 4 | 12000 | 5 | 0 | 65062 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-011.log |
| 11 | 55 | 5 | 6 | 13000 | 5 | 0 | 57951 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-012.log |
| 12 | 60 | 5 | 7 | 13500 | 5 | 0 | 58218 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-013.log |
| 13 | 65 | 5 | 3 | 11500 | 5 | 0 | 65192 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-014.log |
| 14 | 70 | 5 | 0 | 10000 | 5 | 0 | 57098 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-015.log |
| 15 | 75 | 5 | 2 | 11000 | 5 | 0 | 66487 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-016.log |
| 16 | 80 | 5 | 1 | 10500 | 5 | 0 | 64323 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-017.log |
| 17 | 85 | 5 | 5 | 12500 | 5 | 0 | 65330 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-018.log |
| 18 | 90 | 5 | 0 | 10000 | 5 | 0 | 64858 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-019.log |
| 19 | 95 | 5 | 6 | 13000 | 5 | 0 | 65268 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-latest\chunk-020.log |

## 失敗一覧

- 失敗はありません。
