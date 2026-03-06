/**
 * スペルカード統合テスト
 * Phase2 P1-1: スペルカード最小版
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { MatchRoomController } from "../../src/server/match-room-controller";
import { SPELL_CARDS, getAvailableSpellsForRound } from "../../src/data/spell-cards";
import { FeatureFlagService } from "../../src/server/feature-flag-service";

describe("SpellCard Integration", () => {
  let controller: MatchRoomController;
  const playerIds = ["player1", "player2"] as const;
  const PLAYER1 = playerIds[0];
  const PLAYER2 = playerIds[1];

  beforeAll(() => {
    // Feature Flagを有効にする
    process.env.FEATURE_ENABLE_SPELL_CARD = "true";
    // Reset singleton to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(() => {
    // 環境変数をリセット
    delete process.env.FEATURE_ENABLE_SPELL_CARD;
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
      const spell = SPELL_CARDS.find((s) => s.id === "sdl-1");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("紅符「スカーレットシュート」");
      expect(spell?.roundRange).toEqual([1, 4]);
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(50);
    });

    it("必殺「ハートブレイク」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "sdl-2");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("必殺「ハートブレイク」");
      expect(spell?.roundRange).toEqual([5, 8]);
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(65);
    });

    it("神槍「スピア・ザ・グングニル」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "sdl-3");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("神槍「スピア・ザ・グングニル」");
      expect(spell?.roundRange).toEqual([9, 11]);
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(80);
    });

    it("「紅色の幻想郷」が定義されている", () => {
      const spell = SPELL_CARDS.find((s) => s.id === "sdl-4");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("「紅色の幻想郷」");
      expect(spell?.roundRange).toEqual([12, 12]);
      expect(spell?.effect.type).toBe("damage");
      expect(spell?.effect.target).toBe("raid");
      expect(spell?.effect.value).toBe(100);
    });

    it("R5以降のスペルが未実装値0ではない", () => {
      const spellIds = ["sdl-2", "sdl-3", "sdl-4"];
      for (const spellId of spellIds) {
        const spell = SPELL_CARDS.find((s) => s.id === spellId);
        expect(spell).toBeDefined();
        expect(spell?.effect.value).toBeGreaterThan(0);
      }
    });
  });

  describe("ラウンド範囲別スペル取得", () => {
    it("R1-4でスカーレットデスレーザーが取得できる", () => {
      const spells = getAvailableSpellsForRound(1);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "sdl-1")).toBe(true);

      const spells4 = getAvailableSpellsForRound(4);
      expect(spells4.length).toBeGreaterThan(0);
      expect(spells4.some((s) => s.id === "sdl-1")).toBe(true);
    });

    it("R5-8では必殺「ハートブレイク」が取得できる", () => {
      const spells = getAvailableSpellsForRound(5);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "sdl-2")).toBe(true);

      const spells8 = getAvailableSpellsForRound(8);
      expect(spells8.length).toBeGreaterThan(0);
      expect(spells8.some((s) => s.id === "sdl-2")).toBe(true);
    });

    it("R9-11では神槍「スピア・ザ・グングニル」が取得できる", () => {
      const spells = getAvailableSpellsForRound(9);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "sdl-3")).toBe(true);

      const spells11 = getAvailableSpellsForRound(11);
      expect(spells11.length).toBeGreaterThan(0);
      expect(spells11.some((s) => s.id === "sdl-3")).toBe(true);
    });

    it("R12では「紅色の幻想郷」が取得できる", () => {
      const spells = getAvailableSpellsForRound(12);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells.some((s) => s.id === "sdl-4")).toBe(true);
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
      expect(declaredSpell?.id).toBe("sdl-1");
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

      expect(controller.getUsedSpellIds()).toEqual(["sdl-1"]);
    });

    it("boss target healでボスHPが回復する", () => {
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
      (FeatureFlagService as any).instance = undefined;

      const bossHealController = new MatchRoomController([...playerIds], Date.now(), {
        readyAutoStartMs: 1000,
        prepDurationMs: 10000,
        battleDurationMs: 5000,
        settleDurationMs: 1000,
        eliminationDurationMs: 1000,
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

      bossHealController.setPendingRoundDamage({
        [bossId]: 40,
      });

      (bossHealController as any).declaredSpell = {
        id: "test-heal-boss",
        name: "テスト回復",
        description: "ボスを30回復する",
        roundRange: [1, 1],
        effect: {
          type: "heal",
          target: "boss",
          value: 30,
        },
      };

      if (bossHealController.phaseDeadlineAtMs) {
        bossHealController.advanceByTime(bossHealController.phaseDeadlineAtMs + 100);
      }

      expect(bossHealController.getPlayerHp(bossId)).toBe(90);

      delete process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP;
      (FeatureFlagService as any).instance = undefined;
    });

    it("boss target damageでボスHPが減少する", () => {
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
      (FeatureFlagService as any).instance = undefined;

      const bossDamageController = new MatchRoomController([...playerIds], Date.now(), {
        readyAutoStartMs: 1000,
        prepDurationMs: 10000,
        battleDurationMs: 5000,
        settleDurationMs: 1000,
        eliminationDurationMs: 1000,
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

      (bossDamageController as any).declaredSpell = {
        id: "test-damage-boss",
        name: "テストダメージ",
        description: "ボスに30ダメージを与える",
        roundRange: [1, 1],
        effect: {
          type: "damage",
          target: "boss",
          value: 30,
        },
      };

      if (bossDamageController.phaseDeadlineAtMs) {
        bossDamageController.advanceByTime(bossDamageController.phaseDeadlineAtMs + 100);
      }

      expect(bossDamageController.getPlayerHp(bossId)).toBe(70);

      delete process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP;
      (FeatureFlagService as any).instance = undefined;
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

      (controller as any).declaredSpell = {
        id: "test-heal-all",
        name: "全体回復",
        description: "全員を20回復する",
        roundRange: [1, 1],
        effect: {
          type: "heal",
          target: "all",
          value: 20,
        },
      };

      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      expect(controller.getPlayerHp(PLAYER1)).toBe(100);
      expect(controller.getPlayerHp(PLAYER2)).toBe(100);
    });

    it("attack buffは戦闘前の対象プレイヤー倍率として保持される", () => {
      (controller as any).declaredSpell = {
        id: "test-buff-attack",
        name: "攻撃強化",
        description: "レイドの攻撃力を25%上げる",
        roundRange: [1, 1],
        effect: {
          type: "buff",
          target: "raid",
          value: 1.25,
          buffStat: "attack",
        },
      };

      (controller as any).gameLoopState.setBossPlayer(PLAYER1);
      (controller as any).applyPreBattleSpellEffect();

      const modifiers = (controller as any).spellCombatModifiersByPlayer as Map<string, {
        attackMultiplier: number;
        defenseMultiplier: number;
        attackSpeedMultiplier: number;
      }>;

      expect(modifiers.get(PLAYER1)).toBeUndefined();
      expect(modifiers.get(PLAYER2)).toEqual({
        attackMultiplier: 1.25,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      });
    });

    it("attackSpeed debuffは戦闘前の対象プレイヤー倍率として保持される", () => {
      (controller as any).declaredSpell = {
        id: "test-debuff-speed",
        name: "速度低下",
        description: "ボスの攻撃速度を30%下げる",
        roundRange: [1, 1],
        effect: {
          type: "debuff",
          target: "boss",
          value: 0.7,
          buffStat: "attackSpeed",
        },
      };

      (controller as any).gameLoopState.setBossPlayer(PLAYER2);
      (controller as any).applyPreBattleSpellEffect();

      const modifiers = (controller as any).spellCombatModifiersByPlayer as Map<string, {
        attackMultiplier: number;
        defenseMultiplier: number;
        attackSpeedMultiplier: number;
      }>;

      expect(modifiers.get(PLAYER1)).toBeUndefined();
      expect(modifiers.get(PLAYER2)).toEqual({
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
});
