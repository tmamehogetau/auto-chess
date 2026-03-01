export interface Hero {
  id: string;
  name: string;
  role: 'tank' | 'dps' | 'support';
  hp: number;
  attack: number;
  skill: {
    name: string;
    description: string;
    effect: (battleContext: any) => void;
  };
}

export const HEROES: Hero[] = [
  {
    id: 'reimu',
    name: '霊夢',
    role: 'support',
    hp: 120,
    attack: 15,
    skill: {
      name: '結界',
      description: 'ダメージ無効化',
      effect: () => {},
    },
  },
];
