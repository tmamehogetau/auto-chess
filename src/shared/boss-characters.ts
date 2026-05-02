import type { UnitProgressionBonusConfig } from "./progression-bonus-types";
import type { BoardUnitType } from "./room-messages";

export const BOSS_CHARACTERS = [
  {
    id: "remilia",
    displayName: "レミリア",
    combatClass: "assassin" as BoardUnitType,
    portraitKey: "remilia",
    flavor: "紅魔館の主。夜を支配する吸血鬼。",
    progressionBonus: {
      baseGrowthProfile: "boss-offense",
      level4Bonus: {
        kind: "boss-pressure",
        summary: "Lv4で幼きデーモンロードの被ダメージ軽減・高HP攻撃補正・吸血が強化される",
        statScore: 18,
      },
      level7Bonus: {
        kind: "boss-finisher",
        summary: "Lv7で幼きデーモンロードの被ダメージ軽減・高HP攻撃補正・吸血がさらに強化される",
        statScore: 28,
      },
      skillImplementationState: "implemented",
    } satisfies UnitProgressionBonusConfig,
  },
] as const;

export type BossCharacterId = typeof BOSS_CHARACTERS[number]["id"];

export function isBossCharacterId(value: string): value is BossCharacterId {
  return BOSS_CHARACTERS.some((boss) => boss.id === value);
}
