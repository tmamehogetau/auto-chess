import { describe, expect, test } from "vitest";

import {
  parseTestServerPortOffset,
  resolveTestServerPort,
} from "./test-server-port";

describe("test server port helpers", () => {
  test("adds an explicit offset without changing suite hash", () => {
    const basePort = resolveTestServerPort("GameRoom integration / bot playability", 0);
    const offsetPort = resolveTestServerPort("GameRoom integration / bot playability", 500);

    expect(offsetPort - basePort).toBe(500);
  });

  test("treats missing or invalid offsets as zero", () => {
    expect(parseTestServerPortOffset(undefined)).toBe(0);
    expect(parseTestServerPortOffset("")).toBe(0);
    expect(parseTestServerPortOffset("-1")).toBe(0);
    expect(parseTestServerPortOffset("abc")).toBe(0);
    expect(parseTestServerPortOffset("250")).toBe(250);
  });
});
