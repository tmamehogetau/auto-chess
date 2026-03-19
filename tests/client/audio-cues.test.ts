import { describe, expect, test } from "vitest";

import { buildCuePlan } from "../../src/client/ui/audio-cues.js";

describe("audio cues", () => {
  test("battle start cue uses a layered rising plan", () => {
    const cue = buildCuePlan("battle-start");
    const [leadTone, supportTone] = cue;

    expect(cue).toHaveLength(2);
    expect(leadTone?.waveform).toBe("sawtooth");
    expect((leadTone?.startFrequency ?? 0)).toBeLessThan(leadTone?.endFrequency ?? 0);
    expect(supportTone?.startAt ?? 0).toBeGreaterThan(0);
  });

  test("victory and defeat cues separate their emotional direction", () => {
    const victory = buildCuePlan("victory");
    const defeat = buildCuePlan("defeat");
    const [victoryLeadTone] = victory;
    const [defeatLeadTone] = defeat;

    expect(victoryLeadTone?.endFrequency ?? 0).toBeGreaterThan(victoryLeadTone?.startFrequency ?? 0);
    expect(defeatLeadTone?.endFrequency ?? 0).toBeLessThan(defeatLeadTone?.startFrequency ?? 0);
  });
});
