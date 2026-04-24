import type { UnitProgressionBonusConfig } from "./progression-bonus-types";

export const BOSS_CHARACTERS = [
  {
    id: "remilia",
    displayName: "レミリア",
    portraitKey: "remilia",
    flavor: "紅魔館の主。夜を支配する吸血鬼。",
    progressionBonus: {
      baseGrowthProfile: "boss-offense",
      level4Bonus: {
        kind: "boss-pressure",
        summary: "Lv4でボス本体の攻撃圧が上がる",
        statScore: 18,
      },
      level7Bonus: {
        kind: "boss-finisher",
        summary: "Lv7でボス本体の終盤火力がさらに伸びる",
        statScore: 28,
      },
      skillImplementationState: "missing",
    } satisfies UnitProgressionBonusConfig,
  },
] as const;

export type BossCharacterId = typeof BOSS_CHARACTERS[number]["id"];

export function isBossCharacterId(value: string): value is BossCharacterId {
  return BOSS_CHARACTERS.some((boss) => boss.id === value);
}
