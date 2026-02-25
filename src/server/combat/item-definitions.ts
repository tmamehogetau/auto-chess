export type ItemType =
  | 'sword'      // +attack
  | 'shield'     // +defense
  | 'boots'      // +attack speed
  | 'ring'       // +crit rate
  | 'amulet';    // +hp

export interface ItemDefinition {
  name: string;
  type: ItemType;
  effects: {
    attackPower?: number;
    defense?: number;
    attackSpeedMultiplier?: number;
    critRate?: number;
    hpMultiplier?: number;
  };
  cost: number;  // Shop cost
}

export const ITEM_DEFINITIONS: Record<ItemType, ItemDefinition> = {
  sword: {
    name: 'Iron Sword',
    type: 'sword',
    effects: { attackPower: 3 },
    cost: 3,
  },
  shield: {
    name: 'Iron Shield',
    type: 'shield',
    effects: { defense: 2 },
    cost: 3,
  },
  boots: {
    name: 'Swift Boots',
    type: 'boots',
    effects: { attackSpeedMultiplier: 0.15 },
    cost: 3,
  },
  ring: {
    name: 'Critical Ring',
    type: 'ring',
    effects: { critRate: 0.15 },
    cost: 4,
  },
  amulet: {
    name: 'Health Amulet',
    type: 'amulet',
    effects: { hpMultiplier: 0.2 },
    cost: 4,
  },
};

export const ITEM_TYPES: ItemType[] = ['sword', 'shield', 'boots', 'ring', 'amulet'];
