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
  // R1-4: 紅符「スカーレットシュート」
  {
    id: 'sdl-1',
    name: '紅符「スカーレットシュート」',
    description: 'レイドメンバー全員に50ダメージを与える',
    roundRange: [1, 4],
    effect: {
      type: 'damage',
      target: 'raid',
      value: 50,
    },
  },
  // R5-8: 必殺「ハートブレイク」
  {
    id: 'sdl-2',
    name: '必殺「ハートブレイク」',
    description: 'レイドメンバー全員に65ダメージを与える',
    roundRange: [5, 8],
    effect: {
      type: 'damage',
      target: 'raid',
      value: 65,
    },
  },
  // R9-11: 神槍「スピア・ザ・グングニル」
  {
    id: 'sdl-3',
    name: '神槍「スピア・ザ・グングニル」',
    description: 'レイドメンバー全員に80ダメージを与える',
    roundRange: [9, 11],
    effect: {
      type: 'damage',
      target: 'raid',
      value: 80,
    },
  },
  // R12: 「紅色の幻想郷」
  {
    id: 'sdl-4',
    name: '「紅色の幻想郷」',
    description: 'レイドメンバー全員に100ダメージを与える',
    roundRange: [12, 12],
    effect: {
      type: 'damage',
      target: 'raid',
      value: 100,
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
