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

export type SpellEffectBuffStat = 'attack' | 'defense' | 'attackSpeed';

/**
 * スペルカテゴリ
 */
export type SpellCategory = 'instantLaser' | 'areaAttack' | 'rush' | 'lastWord';

/**
 * スペル効果定義
 */
export interface SpellEffect {
  type: SpellEffectType;
  target: SpellEffectTarget;
  value: number;
  buffStat?: SpellEffectBuffStat;
}

/**
 * スペルカード定義
 */
export interface SpellCard {
  id: string;
  name: string;
  description: string;
  roundRange: [number, number]; // [1,4] or [5,8] or [9,11] or [12,12]
  category: SpellCategory;
  effect: SpellEffect;
}

/**
 * スペルカードリスト
 */
export const SPELL_CARDS: SpellCard[] = [
  // 瞬間レーザー系 (instantLaser)
  {
    id: 'instant-1',
    name: '紅符「スカーレットシュート」',
    description: 'レイドメンバー全員に50ダメージを与える',
    roundRange: [1, 4],
    category: 'instantLaser',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 50,
    },
  },
  {
    id: 'instant-2',
    name: '必殺「ハートブレイク」',
    description: 'レイドメンバー全員に65ダメージを与える',
    roundRange: [5, 8],
    category: 'instantLaser',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 65,
    },
  },
  {
    id: 'instant-3',
    name: '神槍「スピア・ザ・グングニル」',
    description: 'レイドメンバー全員に80ダメージを与える',
    roundRange: [9, 11],
    category: 'instantLaser',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 80,
    },
  },

  // 範囲攻撃系 (areaAttack)
  {
    id: 'area-1',
    name: '紅符「不夜城レッド」',
    description: 'レイドメンバー全員に40ダメージを与える',
    roundRange: [1, 4],
    category: 'areaAttack',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 40,
    },
  },
  {
    id: 'area-2',
    name: '紅魔「スカーレットデビル」',
    description: 'レイドメンバー全員に55ダメージを与える',
    roundRange: [5, 8],
    category: 'areaAttack',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 55,
    },
  },
  {
    id: 'area-3',
    name: '魔符「全世界ナイトメア」',
    description: 'レイドメンバー全員に70ダメージを与える',
    roundRange: [9, 11],
    category: 'areaAttack',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 70,
    },
  },

  // 突進系 (rush)
  {
    id: 'rush-1',
    name: '神鬼「レミリアストーカー」',
    description: 'レイドメンバー全員に45ダメージを与える',
    roundRange: [1, 4],
    category: 'rush',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 45,
    },
  },
  {
    id: 'rush-2',
    name: '夜符「デーモンキングクレイドル」',
    description: 'レイドメンバー全員に60ダメージを与える',
    roundRange: [5, 8],
    category: 'rush',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 60,
    },
  },
  {
    id: 'rush-3',
    name: '夜王「ドラキュラクレイドル」',
    description: 'レイドメンバー全員に75ダメージを与える',
    roundRange: [9, 11],
    category: 'rush',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 75,
    },
  },

  // ラストスペル (lastWord)
  {
    id: 'last-word',
    name: '「紅色の幻想郷」',
    description: 'レイドメンバー全員に100ダメージを与える',
    roundRange: [12, 12],
    category: 'lastWord',
    effect: {
      type: 'damage',
      target: 'raid',
      value: 100,
    },
  },
];

/**
 * 現在のラウンドで有効なスペルカードを取得
 * @deprecated 代わりに getSpellCardSetForRound を使用すること
 */
export function getAvailableSpellsForRound(roundIndex: number): SpellCard[] {
  return SPELL_CARDS.filter((spell) => {
    const [min, max] = spell.roundRange;
    return roundIndex >= min && roundIndex <= max;
  });
}

/**
 * 指定ラウンド帯で選択可能なスペルカードセットを取得
 * R1-4: instant-1, area-1, rush-1
 * R5-8: instant-2, area-2, rush-2
 * R9-11: instant-3, area-3, rush-3
 * R12: last-word
 */
export function getSpellCardSetForRound(roundIndex: number): SpellCard[] {
  if (roundIndex >= 1 && roundIndex <= 4) {
    return SPELL_CARDS.filter(s => s.roundRange[0] === 1);
  }
  if (roundIndex >= 5 && roundIndex <= 8) {
    return SPELL_CARDS.filter(s => s.roundRange[0] === 5);
  }
  if (roundIndex >= 9 && roundIndex <= 11) {
    return SPELL_CARDS.filter(s => s.roundRange[0] === 9);
  }
  if (roundIndex === 12) {
    return SPELL_CARDS.filter(s => s.category === 'lastWord');
  }
  return [];
}
