/**
 * スペルカード定義
 * Phase2 P1-1: スペルカード最小版
 */

/**
 * スペル効果の種類
 */
export type SpellEffectType = 'damage' | 'heal' | 'buff' | 'debuff';

/**
 * スペル効果のターゲット
 */
export type SpellEffectTarget = 'boss' | 'raid' | 'all';

/**
 * スペル効果定義
 */
export interface SpellEffect {
  type: SpellEffectType;
  target: SpellEffectTarget;
  value: number;
}

/**
 * スペルカード定義
 */
export interface SpellCard {
  id: string;
  name: string;
  description: string;
  roundRange: [number, number]; // [1,4] or [5,8] or [9,11]
  effect: SpellEffect;
}

/**
 * スペルカードリスト
 */
export const SPELL_CARDS: SpellCard[] = [
  // R1-4: スカーレットデスレーザー簡易版
  {
    id: 'sdl-1',
    name: 'スカーレットデスレーザー',
    description: 'レイドメンバー全員に50ダメージを与える',
    roundRange: [1, 4],
    effect: {
      type: 'damage',
      target: 'raid',
      value: 50,
    },
  },
];

/**
 * 現在のラウンドで有効なスペルカードを取得
 */
export function getAvailableSpellsForRound(roundIndex: number): SpellCard[] {
  return SPELL_CARDS.filter((spell) => {
    const [min, max] = spell.roundRange;
    return roundIndex >= min && roundIndex <= max;
  });
}
