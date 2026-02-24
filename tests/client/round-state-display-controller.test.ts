import { describe, expect, test, vi } from "vitest";

import {
  RoundStateDisplayController,
  type SetIdDisplaySource,
  type TextDisplayTarget,
} from "../../src/client/ui/round-state-display-controller";

describe("RoundStateDisplayController", () => {
  test("receiverのsetIdForDisplayを表示ターゲットへ反映する", () => {
    const receiver: SetIdDisplaySource = {
      setIdForDisplay: "set2",
    };
    const display: TextDisplayTarget = {
      setText: vi.fn(),
    };
    const controller = new RoundStateDisplayController(receiver, display);

    controller.render();

    expect(display.setText).toHaveBeenCalledWith("set2");
  });

  test("未確定表示の値もそのまま反映する", () => {
    const receiver: SetIdDisplaySource = {
      setIdForDisplay: "-",
    };
    const display: TextDisplayTarget = {
      setText: vi.fn(),
    };
    const controller = new RoundStateDisplayController(receiver, display);

    controller.render();

    expect(display.setText).toHaveBeenCalledWith("-");
  });
});
