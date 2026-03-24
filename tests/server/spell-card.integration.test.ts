/**
 * スペルカード統合テスト
 * Phase2 P1-1: スペルカード最小版
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { MatchRoomController } from "../../src/server/match-room-controller";
import { SPELL_CARDS, getAvailableSpellsForRound, getSpellCardSetForRound } from "../../src/data/spell-cards";
import { FeatureFlagService } from "../../src/server/feature-flag-service";
import { FLAG_CONFIGURATIONS, FLAG_ENV_VARS } from "./feature-flag-test-helper";

const SPELL_CARD_FLAGS = {
  ...FLAG_CONFIGURATIONS.ALL_DISABLED,
  enableSpellCard: true,
};

describe("SpellCard Integration", () => {
  let controller: MatchRoomController;
  const playerIds = ["player1", "player2"] as const;
  const PLAYER1 = playerIds[0];
  const PLAYER2 = playerIds[1];

  beforeAll(() => {
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(
        SPELL_CARD_FLAGS[flagName as keyof typeof SPELL_CARD_FLAGS],
      );
    }
    // Reset singleton to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(() => {
    for (const envVarName of Object.values(FLAG_ENV_VARS)) {
      delete process.env[envVarName];
    }
    // Reset singleton
    (FeatureFlagService as any).instance = undefined;
  });

  beforeEach(() => {
    controller = new MatchRoomController([...playerIds], Date.now(), {
      readyAutoStartMs: 1000,
      prepDurationMs: 10000,
      battleDurationMs: 5000,
      settleDurationMs: 1000,
      eliminationDurationMs: 1000,
      featureFlags: SPELL_CARD_FLAGS,
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("スペルカード定義", () => {
    it("SPELL_CARDSが定義されている", () => {
      expect(SPELL_CARDS).toBeDefined();
      expect(SPELL_CARDS.length).toBeGreaterThan(0);
    });

    it("紅符「スカーレットシュート」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "instant-1");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("紅符「スカーレットシュート」");
      expect(spell?.roundRange).toEqual([1, 4]);
      expect(spell?.category).toBe("instantLaser");
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(50);
    });

    it("必殺「ハートブレイク」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "instant-2");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("必殺「ハートブレイク」");
      expect(spell?.roundRange).toEqual([5, 8]);
      expect(spell?.category).toBe("instantLaser");
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(65);
    });

    it("神槍「スピア・ザ・グングニル」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "instant-3");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("神槍「スピア・ザ・グングニル」");
      expect(spell?.roundRange).toEqual([9, 11]);
      expect(spell?.category).toBe("instantLaser");
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(80);
    });

    it("「紅色の幻想郷」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "last-word");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("「紅色の幻想郷」");
      expect(spell?.roundRange).toEqual([12, 12]);
      expect(spell?.category).toBe("lastWord");
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(100);
    });

    // 追加のスペルカード定義確認テスト
    it("全10種のスペルカードが定義されている", () => {
      expect(SPELL_CARDS.length).toBe(10);
    });

    it("範囲攻撃系スペルが定義されている", () => {
      const area1 = SPELL_CARDS.find((s) => s.id === "area-1");
      expect(area1).toBeDefined();
      expect(area1?.name).toBe("紅符「不夜城レッド」");
      expect(area1?.category).toBe("areaAttack");
      expect(area1?.effect.value).toBe(40);

      const area2 = SPELL_CARDS.find((s) => s.id === "area-2");
      expect(area2).toBeDefined();
      expect(area2?.name).toBe("紅魔「スカーレットデビル」");
      expect(area2?.category).toBe("areaAttack");
      expect(area2?.effect.value).toBe(55);

      const area3 = SPELL_CARDS.find((s) => s.id === "area-3");
      expect(area3).toBeDefined();
      expect(area3?.name).toBe("魔符「全世界ナイトメア」");
      expect(area3?.category).toBe("areaAttack");
      expect(area3?.effect.value).toBe(70);
    });

    it("突進系スペルが定義されている", () => {
      const rush1 = SPELL_CARDS.find((s) => s.id === "rush-1");
      expect(rush1).toBeDefined();
      expect(rush1?.name).toBe("神鬼「レミリアストーカー」");
      expect(rush1?.category).toBe("rush");
      expect(rush1?.effect.value).toBe(45);

      const rush2 = SPELL_CARDS.find((s) => s.id === "rush-2");
      expect(rush2).toBeDefined();
      expect(rush2?.name).toBe("夜符「デーモンキングクレイドル」");
      expect(rush2?.category).toBe("rush");
      expect(rush2?.effect.value).toBe(60);

      const rush3 = SPELL_CARDS.find((s) => s.id === "rush-3");
      expect(rush3).toBeDefined();
      expect(rush3?.name).toBe("夜王「ドラキュラクレイドル」");
      expect(rush3?.category).toBe("rush");
      expect(rush3?.effect.value).toBe(75);
    });

    it("R5以降のスペルが未実装値0ではない", () => {
      const spellIds = ["instant-2", "instant-3", "area-2", "area-3", "rush-2", "rush-3", "last-word"];
      for (const spellId of spellIds) {
        const spell = SPELL_CARDS.find((s) => s.id === spellId);
        expect(spell).toBeDefined();
        expect(spell?.effect.value).toBeGreaterThan(0);
      }
    });
  });

  describe("ラウンド範囲別スペル取得", () => {
    it("R1-4で紅符「スカーレットシュート」が取得できる", () => {
      const spells = getAvailableSpellsForRound(1);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "instant-1")).toBe(true);

      const spells4 = getAvailableSpellsForRound(4);
      expect(spells4.length).toBeGreaterThan(0);
      expect(spells4.some((s) => s.id === "instant-1")).toBe(true);
    });

    it("R5-8では必殺「ハートブレイク」が取得できる", () => {
      const spells = getAvailableSpellsForRound(5);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "instant-2")).toBe(true);

      const spells8 = getAvailableSpellsForRound(8);
      expect(spells8.length).toBeGreaterThan(0);
      expect(spells8.some((s) => s.id === "instant-2")).toBe(true);
    });

    it("R9-11では神槍「スピア・ザ・グングニル」が取得できる", () => {
      const spells = getAvailableSpellsForRound(9);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "instant-3")).toBe(true);

      const spells11 = getAvailableSpellsForRound(11);
      expect(spells11.length).toBeGreaterThan(0);
      expect(spells11.some((s) => s.id === "instant-3")).toBe(true);
    });

    it("R12では「紅色の幻想郷」が取得できる", () => {
      const spells = getAvailableSpellsForRound(12);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "last-word")).toBe(true);
    });
  });

  describe("スペル宣言と効果適用", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("R1でスペルが宣言される", () => {
      // Prep → Battleへ遷移してスペルを宣言
      const now = Date.now();
      const prepDeadline = controller.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();

      // PrepをスキップしてBattleへ
      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      // スペルが宣言されているか確認
      const declaredSpell = controller.getDeclaredSpell();
      expect(declaredSpell).toBeDefined();
      expect(declaredSpell?.id).toBe("instant-1");
    });

    it("戦闘フェーズ終了時にスペル効果が適用される", () => {
      // Prep → Battleへ遷移してスペルを宣言
      const prepDeadline = controller.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();

      // PrepをスキップしてBattleへ
      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      // 戦闘前のHPを確認
      const hpBeforeBattle1 = controller.getPlayerHp(PLAYER1);
      const hpBeforeBattle2 = controller.getPlayerHp(PLAYER2);
      expect(hpBeforeBattle1).toBe(100);
      expect(hpBeforeBattle2).toBe(100);

      // Battle → Settleへ遷移してスペル効果を適用
      // battleDeadlineAtMsはprivateなので、phaseDeadlineAtMsを使う
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // スペル効果（ダメージ）が適用されているか確認
      const hpAfterBattle1 = controller.getPlayerHp(PLAYER1);
      const hpAfterBattle2 = controller.getPlayerHp(PLAYER2);

      // 注: 実際には戦闘ダメージも加算されるため、完全なテストにはモックが必要
      // ここではHPが減少していることを確認
      expect(hpAfterBattle1).toBeLessThan(hpBeforeBattle1);
      expect(hpAfterBattle2).toBeLessThan(hpBeforeBattle2);
    });

    it("効果適用後は使用済みスペルIDを保持する", () => {
      const prepDeadline = controller.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();

      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      expect(controller.getUsedSpellIds()).toEqual(["instant-1"]);
    });

    it("R5帯ではR5-8用のスペルが宣言される", () => {
      // 8人プレイヤーでR5に到達（脱落防止のため毎ラウンド回復）
      const r5PlayerIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"] as const;
      const r5Controller = new MatchRoomController([...r5PlayerIds], Date.now(), {
        readyAutoStartMs: 10,
        prepDurationMs: 10,
        battleDurationMs: 10,
        settleDurationMs: 10,
        eliminationDurationMs: 10,
        featureFlags: SPELL_CARD_FLAGS,
      });

      for (const playerId of r5PlayerIds) {
        r5Controller.setReady(playerId, true);
      }
      expect(r5Controller.startIfReady(Date.now(), [...r5PlayerIds])).toBe(true);

      // R5に到達するまで進行（スペルダメージで脱落しないよう回復）
      let iterations = 0;
      const maxIterations = 200;

      while (r5Controller.roundIndex < 5 && r5Controller.phase !== "End" && iterations < maxIterations) {
        iterations++;

        // Prepフェーズ: スペルダメージを回復
        if (r5Controller.phase === "Prep" && r5Controller.roundIndex > 1) {
          for (const pid of r5PlayerIds) {
            if (r5Controller.getPlayerHp(pid) < 100) {
              r5Controller.setPlayerHp(pid, 100);
            }
          }
        }

        // Prepフェーズを進める
        if (r5Controller.prepDeadlineAtMs && r5Controller.phase === "Prep") {
          r5Controller.advanceByTime(r5Controller.prepDeadlineAtMs + 1);
        }

        // Battle→Settle→Eliminationを進める（Endフェーズで抜ける）
        while (r5Controller.phase !== "Prep" && r5Controller.phaseDeadlineAtMs) {
          // Endフェーズに入ったらループを抜ける
          if ((r5Controller.phase as string) === "End") break;
          r5Controller.advanceByTime(r5Controller.phaseDeadlineAtMs + 1);
        }
      }

      expect(r5Controller.roundIndex).toBe(5);
      expect(r5Controller.phase).toBe("Prep");

      // Prep→Battleでスペル宣言
      if (r5Controller.prepDeadlineAtMs) {
        r5Controller.advanceByTime(r5Controller.prepDeadlineAtMs + 1);
      }

      expect(r5Controller.getDeclaredSpellId()).toBe("instant-2");
    });

    it("boss target healでボスHPが回復する", () => {
      const bossHealController = new MatchRoomController([...playerIds], Date.now(), {
        readyAutoStartMs: 1000,
        prepDurationMs: 10000,
        battleDurationMs: 5000,
        settleDurationMs: 1000,
        eliminationDurationMs: 1000,
        featureFlags: {
          ...SPELL_CARD_FLAGS,
          enableBossExclusiveShop: true,
        },
      });

      for (const playerId of playerIds) {
        bossHealController.setReady(playerId, true);
      }

      const started = bossHealController.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);

      const prepDeadline = bossHealController.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();

      if (prepDeadline) {
        bossHealController.advanceByTime(prepDeadline + 100);
      }

      const bossId = bossHealController.getBossPlayerId();
      expect(bossId).not.toBeNull();

      if (!bossId) {
        return;
      }

      bossHealController.setPlayerHp(bossId, 60);

      // spellCardHandlerを通してスペルを設定
      (bossHealController as any).spellCardHandler.setDeclaredSpell({
        id: "test-heal-boss",
        name: "テスト回復",
        description: "ボスを30回復する",
        roundRange: [1, 1],
        category: "instantLaser",
        effect: {
          type: "heal",
          target: "boss",
          value: 30,
        },
      });

      if (bossHealController.phaseDeadlineAtMs) {
        bossHealController.advanceByTime(bossHealController.phaseDeadlineAtMs + 100);
      }

      expect(bossHealController.getPlayerHp(bossId)).toBe(90);
    });

    it("boss target damageでボスHPが減少する", () => {
      const bossDamageController = new MatchRoomController([...playerIds], Date.now(), {
        readyAutoStartMs: 1000,
        prepDurationMs: 10000,
        battleDurationMs: 5000,
        settleDurationMs: 1000,
        eliminationDurationMs: 1000,
        featureFlags: {
          ...SPELL_CARD_FLAGS,
          enableBossExclusiveShop: true,
        },
      });

      for (const playerId of playerIds) {
        bossDamageController.setReady(playerId, true);
      }

      const started = bossDamageController.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);

      const prepDeadline = bossDamageController.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();

      if (prepDeadline) {
        bossDamageController.advanceByTime(prepDeadline + 100);
      }

      const bossId = bossDamageController.getBossPlayerId();
      expect(bossId).not.toBeNull();

      if (!bossId) {
        return;
      }

      // spellCardHandlerを通してスペルを設定
      (bossDamageController as any).spellCardHandler.setDeclaredSpell({
        id: "test-damage-boss",
        name: "テストダメージ",
        description: "ボスに30ダメージを与える",
        roundRange: [1, 1],
        category: "instantLaser",
        effect: {
          type: "damage",
          target: "boss",
          value: 30,
        },
      });

      if (bossDamageController.phaseDeadlineAtMs) {
        bossDamageController.advanceByTime(bossDamageController.phaseDeadlineAtMs + 100);
      }

      expect(bossDamageController.getPlayerHp(bossId)).toBe(70);
    });

    it("all target healはHP上限100を超えない", () => {
      const prepDeadline = controller.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();

      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      controller.setPendingRoundDamage({
        [PLAYER1]: 5,
        [PLAYER2]: 15,
      });

      // spellCardHandlerを通してスペルを設定
      (controller as any).spellCardHandler.setDeclaredSpell({
        id: "test-heal-all",
        name: "全体回復",
        description: "全員を20回復する",
        roundRange: [1, 1],
        category: "instantLaser",
        effect: {
          type: "heal",
          target: "all",
          value: 20,
        },
      });

      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      expect(controller.getPlayerHp(PLAYER1)).toBe(100);
      expect(controller.getPlayerHp(PLAYER2)).toBe(100);
    });

    it("attack buffは戦闘前の対象プレイヤー倍率として保持される", () => {
      // spellCardHandlerを通してスペルを設定
      (controller as any).spellCardHandler.setDeclaredSpell({
        id: "test-buff-attack",
        name: "攻撃強化",
        description: "レイドの攻撃力を25%上げる",
        roundRange: [1, 1],
        category: "instantLaser",
        effect: {
          type: "buff",
          target: "raid",
          value: 1.25,
          buffStat: "attack",
        },
      });

      (controller as any).gameLoopState.setBossPlayer(PLAYER1);
      (controller as any).applyPreBattleSpellEffect();

      // spellCardHandlerを通してmodifiersを取得
      const handler = (controller as any).spellCardHandler;
      const player1Mod = handler.getCombatModifiersForPlayer(PLAYER1);
      const player2Mod = handler.getCombatModifiersForPlayer(PLAYER2);

      expect(player1Mod).toBeNull();
      expect(player2Mod).toEqual({
        attackMultiplier: 1.25,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      });
    });

    it("attackSpeed debuffは戦闘前の対象プレイヤー倍率として保持される", () => {
      // spellCardHandlerを通してスペルを設定
      (controller as any).spellCardHandler.setDeclaredSpell({
        id: "test-debuff-speed",
        name: "速度低下",
        description: "ボスの攻撃速度を30%下げる",
        roundRange: [1, 1],
        category: "instantLaser",
        effect: {
          type: "debuff",
          target: "boss",
          value: 0.7,
          buffStat: "attackSpeed",
        },
      });

      (controller as any).gameLoopState.setBossPlayer(PLAYER2);
      (controller as any).applyPreBattleSpellEffect();

      // spellCardHandlerを通してmodifiersを取得
      const handler = (controller as any).spellCardHandler;
      const player1Mod = handler.getCombatModifiersForPlayer(PLAYER1);
      const player2Mod = handler.getCombatModifiersForPlayer(PLAYER2);

      expect(player1Mod).toBeNull();
      expect(player2Mod).toEqual({
        attackMultiplier: 1,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 0.7,
      });
    });
  });

  describe("Feature Flag無効時の動作", () => {
    // 注: Feature Flagは環境変数で制御されるため、
    // 実際のテストでは環境変数を設定してからテストを実行する必要がある
    it("enableSpellCard=falseの場合、スペルは宣言されない", () => {
      // このテストは環境変数を設定して実行する必要がある
      // FEATURE_ENABLE_SPELL_CARD=false の場合
      // declaredSpellはnullになるはず

      // Prep → Battleへ遷移
      const now = Date.now();
      const prepDeadline = controller.prepDeadlineAtMs;
      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      // Feature Flagが無効の場合、declaredSpellはnull
      // (実際の動作は環境変数依存)
      const declaredSpell = controller.getDeclaredSpell();
      expect(declaredSpell).toBeNull();
    });
  });

  describe("getSpellCardSetForRound", () => {
    it("R1-4では3枚のスペルセットが返る", () => {
      const spells1 = getSpellCardSetForRound(1);
      expect(spells1.length).toBe(3);
      const ids1 = spells1.map((s) => s.id).sort();
      expect(ids1).toEqual(["area-1", "instant-1", "rush-1"]);

      const spells4 = getSpellCardSetForRound(4);
      expect(spells4.length).toBe(3);
      const ids4 = spells4.map((s) => s.id).sort();
      expect(ids4).toEqual(["area-1", "instant-1", "rush-1"]);
    });

    it("R5-8では3枚のスペルセットが返る", () => {
      const spells5 = getSpellCardSetForRound(5);
      expect(spells5.length).toBe(3);
      const ids5 = spells5.map((s) => s.id).sort();
      expect(ids5).toEqual(["area-2", "instant-2", "rush-2"]);

      const spells8 = getSpellCardSetForRound(8);
      expect(spells8.length).toBe(3);
      const ids8 = spells8.map((s) => s.id).sort();
      expect(ids8).toEqual(["area-2", "instant-2", "rush-2"]);
    });

    it("R9-11では3枚のスペルセットが返る", () => {
      const spells9 = getSpellCardSetForRound(9);
      expect(spells9.length).toBe(3);
      const ids9 = spells9.map((s) => s.id).sort();
      expect(ids9).toEqual(["area-3", "instant-3", "rush-3"]);

      const spells11 = getSpellCardSetForRound(11);
      expect(spells11.length).toBe(3);
      const ids11 = spells11.map((s) => s.id).sort();
      expect(ids11).toEqual(["area-3", "instant-3", "rush-3"]);
    });

    it("R12ではラストスペルのみが返る", () => {
      const spells12 = getSpellCardSetForRound(12);
      expect(spells12.length).toBe(1);
      expect(spells12[0]!.id).toBe("last-word");
      expect(spells12[0]!.name).toBe("「紅色の幻想郷」");
      expect(spells12[0]!.category).toBe("lastWord");
    });

    it("範囲外のラウンドでは空配列が返る", () => {
      const spells0 = getSpellCardSetForRound(0);
      expect(spells0.length).toBe(0);

      const spells13 = getSpellCardSetForRound(13);
      expect(spells13.length).toBe(0);

      const spells100 = getSpellCardSetForRound(100);
      expect(spells100.length).toBe(0);
    });
  });
});
