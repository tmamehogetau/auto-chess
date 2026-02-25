export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type ItemType = 'sword' | 'shield' | 'boots' | 'ring' | 'amulet';

export interface ItemInstance {
  type: ItemType;
  id: string;
}
