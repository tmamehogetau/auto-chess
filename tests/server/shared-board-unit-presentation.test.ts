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
      displayName: "摩多羅隠岐奈",
      portraitKey: "okina",
    });
    expect(resolveSharedBoardHeroPresentation("jyoon")).toEqual({
      displayName: "依神女苑",
      portraitKey: "jyoon",
    });
    expect(resolveSharedBoardBossPresentation("remilia")).toEqual({
      displayName: "レミリア",
      portraitKey: "remilia",
    });
  });

  test("uses hero-exclusive display names when those units appear on the shared board", () => {
    expect(resolveSharedBoardUnitPresentation("mayumi", "vanguard")).toEqual({
      displayName: "杖刀偶磨弓",
      portraitKey: "",
    });
    expect(resolveSharedBoardUnitPresentation("shion", "assassin")).toEqual({
      displayName: "依神紫苑",
      portraitKey: "",
    });
    expect(resolveSharedBoardUnitPresentation("ariya", "vanguard")).toEqual({
      displayName: "磐永阿梨夜",
      portraitKey: "",
    });
  });
});
