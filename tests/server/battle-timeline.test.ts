import { expect, test } from "vitest";

import {
  createBattleStartEvent,
  createKeyframeEvent,
  isBattleTimelineEvent,
} from "../../src/server/combat/battle-timeline";

test("battle timeline contract supports event-driven replay with keyframes", () => {
  const event = createBattleStartEvent({
    battleId: "battle-1",
    round: 3,
    boardConfig: { width: 6, height: 6 },
    units: [{ battleUnitId: "raid-0", side: "raid", x: 0, y: 5, currentHp: 20, maxHp: 20 }],
  });

  expect(isBattleTimelineEvent(event)).toBe(true);

  const keyframe = createKeyframeEvent({
    battleId: "battle-1",
    atMs: 250,
    units: [{ battleUnitId: "raid-0", x: 0, y: 4, currentHp: 18, maxHp: 20, alive: true, state: "moving" }],
  });

  expect(keyframe.type).toBe("keyframe");
});
