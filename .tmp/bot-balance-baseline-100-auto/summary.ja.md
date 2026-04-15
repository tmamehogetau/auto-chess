# Bot Balance Baseline レポート

## 実行条件

- 要求対戦数: 100
- チャンクサイズ: 5
- 並列数: 8
- ポートオフセット基準値: 10000
- チャンク数: 20
- 出力先: C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto
- モード: custom
- 戦闘速度倍率: 0.01
- タイミング設定: 自動開始 200ms / 準備 900ms / 戦闘 800ms / 決着待機 20ms / 敗退演出 10ms / 選択制限 200ms

## 全体結果

- 完走数: 100
- 中断数: 0
- ボス勝利数: 98
- レイド勝利数: 2
- ボス勝率: 98.0%
- レイド勝率: 2.0%
- 平均ラウンド数: 11.73
- 最短ラウンド: 4
- 最長ラウンド: 12
- 平均生存レイド人数: 2.69

## ラウンド分布

| ラウンド | 件数 |
| --- | --- |
| 4 | 1 |
| 8 | 3 |
| 9 | 1 |
| 10 | 1 |
| 11 | 2 |
| 12 | 92 |

## プレイヤー別成績

| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 |
| --- | --- | --- | --- | --- |
| P1 | 1.78 | 24.0% | 100 | 1.91 |
| P2 | 2.2 | 28.0% | 100 | 2.16 |
| P3 | 2.75 | 25.0% | 100 | 1.73 |
| P4 | 3.27 | 23.0% | 100 | 1.87 |

## 戦闘ユニット指標

| ユニット名 | 陣営 | 戦闘登場回数 | 登場試合数 | 平均星レベル | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 所持者勝率 | 採用率 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 火焔猫燐 | mixed | 3217 | 100 | 2.32 | 66.85 | 2150.65 | 87.3% | 23.5% | 100.0% |
| 宮古芳香 | mixed | 2993 | 100 | 1.75 | 57.43 | 1718.87 | 81.0% | 22.8% | 100.0% |
| 姫虫百々世 | mixed | 1836 | 100 | 1.13 | 49.15 | 902.41 | 92.3% | 26.2% | 100.0% |
| レミリア | boss | 1173 | 100 | 1 | 29.5 | 346 | 98.1% | 5.4% | 100.0% |
| ナズーリン | mixed | 1019 | 99 | 2.01 | 151.64 | 1545.2 | 76.8% | 9.4% | 99.0% |
| 今泉影狼 | mixed | 989 | 99 | 1.24 | 63.69 | 629.9 | 89.3% | 27.8% | 99.0% |
| クラウンピース | mixed | 725 | 88 | 1.18 | 255.92 | 1855.43 | 99.9% | 9.0% | 88.0% |
| パチュリー・ノーレッジ | boss | 709 | 85 | 1.53 | 1009.27 | 7155.69 | 100.0% | 6.6% | 85.0% |
| 霊夢 | raid | 892 | 78 | 1 | 33.1 | 295.29 | 87.2% | 93.8% | 78.0% |
| 袿姫 | raid | 889 | 77 | 1 | 11.63 | 103.37 | 94.3% | 0.0% | 77.0% |
| 紅美鈴 | boss | 694 | 74 | 1.43 | 68.84 | 477.78 | 99.7% | 7.5% | 74.0% |
| 隠岐奈 | raid | 841 | 73 | 1 | 65.99 | 554.99 | 84.7% | 1.1% | 73.0% |
| 魔理沙 | raid | 864 | 72 | 1 | 1991 | 17202.24 | 99.3% | 30.6% | 72.0% |
| 純狐 | mixed | 381 | 72 | 1.27 | 213.59 | 813.77 | 98.2% | 15.2% | 72.0% |
| 十六夜咲夜 | boss | 189 | 62 | 1.07 | 481.18 | 909.43 | 99.5% | 0.5% | 62.0% |
| わかさぎ姫 | mixed | 349 | 57 | 1.04 | 166.61 | 581.48 | 81.4% | 10.9% | 57.0% |
| 菅牧典 | boss | 176 | 31 | 1.02 | 687.55 | 1210.08 | 100.0% | 8.5% | 31.0% |
| 飯綱丸龍 | mixed | 165 | 30 | 1.26 | 380.34 | 627.56 | 100.0% | 4.2% | 30.0% |
| 蘇我屠自古 | boss | 11 | 3 | 1 | 228.27 | 25.11 | 100.0% | 0.0% | 3.0% |
| 日白残無 | boss | 12 | 2 | 1.25 | 131.5 | 15.78 | 100.0% | 0.0% | 2.0% |
| 雲居一輪＆雲山 | raid | 2 | 2 | 1 | 205 | 4.1 | 0.0% | 50.0% | 2.0% |

## 最終盤面ユニット指標

| ユニット名 | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 |
| --- | --- | --- | --- | --- | --- |
| 姫虫百々世 | vanguard | 960 | 100 | 9.6 | 100.0% |
| 飯綱丸龍 | ranger | 167 | 95 | 1.67 | 95.0% |
| パチュリー・ノーレッジ | mage | 73 | 65 | 0.73 | 65.0% |

## 上位ダメージユニット

| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |
| --- | --- | --- | --- | --- | --- |
| 魔理沙 | marisa | raid | 1720224 | 72 | 17202.24 |
| patchouli | patchouli | boss | 715569 | 84 | 7155.69 |
| 火焔猫燐 | rin | raid | 180636 | 100 | 1806.36 |
| clownpiece | clownpiece | boss | 170986 | 71 | 1709.86 |
| nazrin | nazrin | boss | 123555 | 97 | 1235.55 |
| 宮古芳香 | yoshika | raid | 123410 | 95 | 1234.1 |
| tsukasa | tsukasa | boss | 113457 | 19 | 1134.57 |
| sakuya | sakuya | boss | 74071 | 47 | 740.71 |
| 姫虫百々世 | momoyo | raid | 55033 | 80 | 550.33 |
| megumu | megumu | boss | 54064 | 23 | 540.64 |

## チャンク実行状況

| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 5 | 0 | 10000 | 5 | 0 | 63165 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-001.log |
| 1 | 5 | 5 | 1 | 10500 | 5 | 0 | 70060 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-002.log |
| 2 | 10 | 5 | 2 | 11000 | 5 | 0 | 65887 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-003.log |
| 3 | 15 | 5 | 3 | 11500 | 5 | 0 | 66711 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-004.log |
| 4 | 20 | 5 | 4 | 12000 | 5 | 0 | 67925 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-005.log |
| 5 | 25 | 5 | 5 | 12500 | 5 | 0 | 65835 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-006.log |
| 6 | 30 | 5 | 6 | 13000 | 5 | 0 | 62608 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-007.log |
| 7 | 35 | 5 | 7 | 13500 | 5 | 0 | 66357 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-008.log |
| 8 | 40 | 5 | 6 | 13000 | 5 | 0 | 67540 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-009.log |
| 9 | 45 | 5 | 0 | 10000 | 5 | 0 | 56780 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-010.log |
| 10 | 50 | 5 | 5 | 12500 | 5 | 0 | 63662 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-011.log |
| 11 | 55 | 5 | 2 | 11000 | 5 | 0 | 65090 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-012.log |
| 12 | 60 | 5 | 7 | 13500 | 5 | 0 | 62068 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-013.log |
| 13 | 65 | 5 | 3 | 11500 | 5 | 0 | 65467 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-014.log |
| 14 | 70 | 5 | 4 | 12000 | 5 | 0 | 64782 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-015.log |
| 15 | 75 | 5 | 1 | 10500 | 5 | 0 | 67335 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-016.log |
| 16 | 80 | 5 | 0 | 10000 | 5 | 0 | 66360 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-017.log |
| 17 | 85 | 5 | 7 | 13500 | 5 | 0 | 65965 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-018.log |
| 18 | 90 | 5 | 5 | 12500 | 5 | 0 | 62528 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-019.log |
| 19 | 95 | 5 | 6 | 13000 | 5 | 0 | 65701 | C:\Users\kou-1\Dev_Workspace\00_Source_Codes\auto-chess-mvp\.tmp\bot-balance-baseline-100-auto\chunk-020.log |

## 失敗一覧

- 失敗はありません。
