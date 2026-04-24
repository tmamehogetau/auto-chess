import { describe, expect, test } from "vitest";

import { createMatchupSideContext } from "../../../src/server/match-room-controller/matchup-context-builder";
import type { BattleUnit } from "../../../src/server/combat/battle-simulator";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";

describe("matchup-context-builder", () => {
  test("keeps boss-side standard units as escorts and leaves isBoss for the actual boss unit", () => {
    const side = createMatchupSideContext({
      side: "right",
      playerIds: ["boss-player"],
      placements: [{
        cell: 19,
        unitType: "vanguard",
        unitLevel: 3,
        unitId: "yoshika",
      }],
      isBossSide: true,
      rosterFlags: DEFAULT_FLAGS,
      buildSpellModifiers: () => null,
      applySpellModifiers: () => {},
      appendHeroBattleUnits: (_playerIds, battleUnits) => {
        battleUnits.push({
          id: "boss-boss-player",
          sourceUnitId: "remilia",
          ownerPlayerId: "boss-player",
          battleSide: "right",
          type: "vanguard",
          unitLevel: 1,
          hp: 600,
          maxHp: 600,
          attackPower: 80,
          attackSpeed: 0.8,
          movementSpeed: 1,
          attackRange: 1,
          cell: 20,
          isDead: false,
          isBoss: true,
          attackCount: 0,
          critRate: 0,
          critDamageMultiplier: 1.5,
          damageReduction: 0,
          buffModifiers: {
            attackMultiplier: 1,
            defenseMultiplier: 1,
            attackSpeedMultiplier: 1,
          },
        } satisfies BattleUnit);
        return [];
      },
      buildHeroSynergyBonusTypes: () => [],
    });

    expect(side.battleUnits).toHaveLength(2);
    expect(side.battleUnits.find((unit) => unit.sourceUnitId === "yoshika")?.isBoss).toBe(false);
    expect(side.battleUnits.find((unit) => unit.sourceUnitId === "remilia")?.isBoss).toBe(true);
  });
});
