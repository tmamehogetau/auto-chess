export const BOSS_CHARACTERS = [
  {
    id: "remilia",
    displayName: "レミリア",
    portraitKey: "Remilia",
    flavor: "紅魔館の主。夜を支配する吸血鬼。",
  },
] as const;

export type BossCharacterId = typeof BOSS_CHARACTERS[number]["id"];

export function isBossCharacterId(value: string): value is BossCharacterId {
  return BOSS_CHARACTERS.some((boss) => boss.id === value);
}
