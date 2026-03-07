/**
 * SpellCardHandler Service
 * Task 10: Extract spell card handling from match-room-controller
 *
 * スペルカードの宣言、効果適用、戦闘修飾子管理を担当するサービス
 */

import {
  type SpellCard,
  getAvailableSpellsForRound,
  getSpellCardSetForRound,
} from "../../data/spell-cards";
import type { MatchLogger } from "../match-logger";

/**
 * スペルによる戦闘修飾子
 */
export interface SpellCombatModifiers {
  attackMultiplier: number;
  defenseMultiplier: number;
  attackSpeedMultiplier: number;
}

/**
 * SpellCardHandler の依存関係
 */
export interface SpellCardHandlerDependencies {
  enableSpellCard: boolean;
  matchLogger: MatchLogger | null;
}

/**
 * applySpellEffect の入力パラメータ
 */
export interface ApplySpellEffectParams {
  roundIndex: number;
  playerHps: Map<string, number>;
  alivePlayerIds: string[];
  bossPlayerId: string | null;
}

/**
 * applyPreBattleSpellEffect の入力パラメータ
 */
export interface ApplyPreBattleSpellEffectParams {
  alivePlayerIds: string[];
  bossPlayerId: string | null;
}

/**
 * スペルカードハンドラ
 *
 * 責務:
 * - スペルカードの宣言（自動選択 / ID指定）
 * - スペル効果の適用（ダメージ / 回復）
 * - 戦闘前スペル効果の適用（buff / debuff）
 * - 戦闘修飾子の管理
 * - 使用済みスペルIDの管理
 */
export class SpellCardHandler {
  private readonly enableSpellCard: boolean;
  private matchLogger: MatchLogger | null;

  private declaredSpell: SpellCard | null = null;
  private readonly usedSpellIds: string[] = [];
  private readonly spellCombatModifiersByPlayer: Map<string, SpellCombatModifiers> =
    new Map();

  constructor(deps: SpellCardHandlerDependencies) {
    this.enableSpellCard = deps.enableSpellCard;
    this.matchLogger = deps.matchLogger;
  }

  /**
   * マッチロガーを更新（コンストラクション後に呼ばれる）
   */
  public setMatchLogger(logger: MatchLogger | null): void {
    this.matchLogger = logger;
  }

  /**
   * 現在宣言中のスペルカードを取得
   */
  public getDeclaredSpell(): SpellCard | null {
    return this.declaredSpell;
  }

  /**
   * 宣言中のスペルカードIDを取得
   */
  public getDeclaredSpellId(): string | null {
    return this.declaredSpell?.id ?? null;
  }

  /**
   * 宣言中のスペルカードを設定（外部からの設定用）
   */
  public setDeclaredSpell(spell: SpellCard | null): void {
    this.declaredSpell = spell;
  }

  /**
   * 宣言中のスペルカードをクリア
   */
  public clearDeclaredSpell(): void {
    this.declaredSpell = null;
  }

  /**
   * 使用済みスペルIDリストを取得
   */
  public getUsedSpellIds(): string[] {
    return [...this.usedSpellIds];
  }

  /**
   * プレイヤーの戦闘修飾子を取得
   */
  public getCombatModifiersForPlayer(
    playerId: string
  ): SpellCombatModifiers | null {
    return this.spellCombatModifiersByPlayer.get(playerId) ?? null;
  }

  /**
   * 全プレイヤーの戦闘修飾子を取得
   */
  public getAllCombatModifiers(): Map<string, SpellCombatModifiers> {
    return new Map(this.spellCombatModifiersByPlayer);
  }

  /**
   * 戦闘修飾子をクリア
   */
  public clearCombatModifiers(): void {
    this.spellCombatModifiersByPlayer.clear();
  }

  /**
   * ラウンドに応じたスペルを自動宣言
   * 有効なスペルの中から最初のものを選択
   */
  public declareSpell(roundIndex: number): void {
    if (!this.enableSpellCard) {
      return;
    }

    const availableSpells = getAvailableSpellsForRound(roundIndex);

    if (availableSpells.length === 0) {
      this.declaredSpell = null;
      return;
    }

    // 簡易版：最初のスペルを選択
    this.declaredSpell = availableSpells[0] ?? null;
  }

  /**
   * スペルIDを指定して宣言
   * @param roundIndex 現在のラウンド
   * @param spellId 宣言するスペルカードID
   * @returns 宣言に成功した場合true
   */
  public declareSpellById(roundIndex: number, spellId: string): boolean {
    if (!this.enableSpellCard) {
      return false;
    }

    const availableSpells = getSpellCardSetForRound(roundIndex);
    const spell = availableSpells.find((s) => s.id === spellId);

    if (!spell) {
      return false;
    }

    this.declaredSpell = spell;
    return true;
  }

  /**
   * スペル効果を適用（戦闘フェーズ終了時）
   * @param params 適用パラメータ
   */
  public applySpellEffect(params: ApplySpellEffectParams): void {
    if (!this.enableSpellCard || !this.declaredSpell) {
      return;
    }

    const { roundIndex, playerHps, alivePlayerIds, bossPlayerId } = params;
    const spell = this.declaredSpell;

    if (spell.effect.type === "damage") {
      this.applyDamageEffect(spell, playerHps, alivePlayerIds, bossPlayerId, roundIndex);
    }

    if (spell.effect.type === "heal") {
      this.applyHealEffect(spell, playerHps, alivePlayerIds, bossPlayerId, roundIndex);
    }

    // 使用済みスペルIDに追加（重複なし）
    if (!this.usedSpellIds.includes(spell.id)) {
      this.usedSpellIds.push(spell.id);
    }

    // 戦闘修飾子をクリア
    this.spellCombatModifiersByPlayer.clear();

    // 他の効果タイプ（buff, debuff）は戦闘前に適用される
  }

  /**
   * 戦闘前スペル効果を適用（buff / debuff）
   * @param params 適用パラメータ
   */
  public applyPreBattleSpellEffect(
    params: ApplyPreBattleSpellEffectParams
  ): void {
    const { alivePlayerIds, bossPlayerId } = params;

    // 修飾子をクリア
    this.spellCombatModifiersByPlayer.clear();

    if (!this.enableSpellCard || !this.declaredSpell) {
      return;
    }

    const spell = this.declaredSpell;

    // buff/debuffタイプのみ処理
    if (
      (spell.effect.type !== "buff" && spell.effect.type !== "debuff") ||
      !spell.effect.buffStat
    ) {
      return;
    }

    // 対象プレイヤーを特定
    const targetPlayerIds = alivePlayerIds.filter((playerId) => {
      if (spell.effect.target === "all") {
        return true;
      }
      if (spell.effect.target === "boss") {
        return playerId === bossPlayerId;
      }
      // "raid" target
      return playerId !== bossPlayerId;
    });

    // 各プレイヤーに修飾子を適用
    for (const playerId of targetPlayerIds) {
      const modifiers = this.spellCombatModifiersByPlayer.get(playerId) ?? {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      };

      const value = spell.effect.value;

      switch (spell.effect.buffStat) {
        case "attack":
          modifiers.attackMultiplier *= value;
          break;
        case "defense":
          modifiers.defenseMultiplier *= value;
          break;
        case "attackSpeed":
          modifiers.attackSpeedMultiplier *= value;
          break;
      }

      this.spellCombatModifiersByPlayer.set(playerId, modifiers);
    }
  }

  /**
   * ダメージ効果を適用
   */
  private applyDamageEffect(
    spell: SpellCard,
    playerHps: Map<string, number>,
    alivePlayerIds: string[],
    bossPlayerId: string | null,
    roundIndex: number
  ): void {
    const effect = spell.effect;
    const value = effect.value;

    // ボスにダメージ
    if ((effect.target === "boss" || effect.target === "all") && bossPlayerId) {
      const currentHp = playerHps.get(bossPlayerId) ?? 100;
      const hpBefore = currentHp;
      const hpAfter = Math.max(0, currentHp - value);
      playerHps.set(bossPlayerId, hpAfter);

      this.matchLogger?.logHpChange(roundIndex, bossPlayerId, hpBefore, hpAfter, "spell");
    }

    // レイドメンバーにダメージ
    if (effect.target === "raid" || effect.target === "all") {
      for (const playerId of alivePlayerIds) {
        // "all" targetの場合、ボスは除外（既に処理済み）
        // "raid" targetの場合もボスは除外
        if (playerId === bossPlayerId) {
          continue;
        }

        const currentHp = playerHps.get(playerId) ?? 100;
        const hpBefore = currentHp;
        const hpAfter = Math.max(0, currentHp - value);
        playerHps.set(playerId, hpAfter);

        this.matchLogger?.logHpChange(roundIndex, playerId, hpBefore, hpAfter, "spell");
      }
    }

    // スペル効果ログを記録
    this.matchLogger?.logSpellEffect(
      roundIndex,
      spell.id,
      spell.name,
      "damage",
      effect.target,
      value,
      value
    );
  }

  /**
   * 回復効果を適用
   */
  private applyHealEffect(
    spell: SpellCard,
    playerHps: Map<string, number>,
    alivePlayerIds: string[],
    bossPlayerId: string | null,
    roundIndex: number
  ): void {
    const effect = spell.effect;
    const value = effect.value;

    // ボスを回復
    if ((effect.target === "boss" || effect.target === "all") && bossPlayerId) {
      const currentHp = playerHps.get(bossPlayerId) ?? 100;
      const hpBefore = currentHp;
      const hpAfter = Math.min(100, currentHp + value);
      playerHps.set(bossPlayerId, hpAfter);

      this.matchLogger?.logHpChange(roundIndex, bossPlayerId, hpBefore, hpAfter, "spell");
    }

    // レイドメンバーを回復
    if (effect.target === "raid" || effect.target === "all") {
      for (const playerId of alivePlayerIds) {
        // "all" targetの場合、ボスは除外（既に処理済み）
        if (effect.target === "all" && playerId === bossPlayerId) {
          continue;
        }

        const currentHp = playerHps.get(playerId) ?? 100;
        const hpBefore = currentHp;
        const hpAfter = Math.min(100, currentHp + value);
        playerHps.set(playerId, hpAfter);

        this.matchLogger?.logHpChange(roundIndex, playerId, hpBefore, hpAfter, "spell");
      }
    }

    // スペル効果ログを記録
    this.matchLogger?.logSpellEffect(
      roundIndex,
      spell.id,
      spell.name,
      "heal",
      effect.target,
      value,
      value
    );
  }
}
