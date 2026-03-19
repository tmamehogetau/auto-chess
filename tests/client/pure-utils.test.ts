import { describe, expect, test } from "vitest";

// @ts-expect-error JS helper module has no declaration file.
import { mapEntries, mapGet } from "../../src/client/utils/pure-utils.js";

describe("pure-utils map helpers", () => {
  test("entries/get だけを持つ MapSchema-like object を読める", () => {
    const store = new Map([
      ["player-1", { isSpectator: false }],
      ["player-2", { isSpectator: true }],
    ]);

    const mapSchemaLike = {
      entries: () => store.entries(),
      get: (key: string) => store.get(key),
    };

    expect(mapEntries(mapSchemaLike)).toEqual([
      ["player-1", { isSpectator: false }],
      ["player-2", { isSpectator: true }],
    ]);
    expect(mapGet(mapSchemaLike, "player-1")).toEqual({ isSpectator: false });
  });
});
