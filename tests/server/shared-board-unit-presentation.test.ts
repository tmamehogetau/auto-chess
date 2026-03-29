import { describe, expect, test } from "vitest";

import {
  resolveSharedBoardBossPresentation,
  resolveSharedBoardHeroPresentation,
  resolveSharedBoardUnitPresentation,
} from "../../src/server/shared-board-unit-presentation";

describe("shared board unit presentation", () => {
  test("uses lowercase unit ids as portrait keys when the asset exists", () => {
    expect(resolveSharedBoardUnitPresentation("koishi", "assassin")).toEqual({
      displayName: "古明地こいし",
      portraitKey: "koishi",
    });
    expect(resolveSharedBoardUnitPresentation("meiling", "vanguard")).toEqual({
      displayName: "紅美鈴",
      portraitKey: "meiling",
    });
  });

  test("uses the canonical portrait key when a newly added asset is available", () => {
    expect(resolveSharedBoardUnitPresentation("chimata", "mage")).toEqual({
      displayName: "天弓千亦",
      portraitKey: "chimata",
    });
  });

  test("uses canonical hero and boss ids for portrait keys", () => {
    expect(resolveSharedBoardHeroPresentation("okina")).toEqual({
      displayName: "隠岐奈",
      portraitKey: "okina",
    });
    expect(resolveSharedBoardHeroPresentation("jyoon")).toEqual({
      displayName: "女苑",
      portraitKey: "jyoon",
    });
    expect(resolveSharedBoardBossPresentation("remilia")).toEqual({
      displayName: "レミリア",
      portraitKey: "remilia",
    });
  });
});
