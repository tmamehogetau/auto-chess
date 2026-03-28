import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const sharedBoardCheckScriptPath = resolve(process.cwd(), "src/client/shared-board-check.js");

describe("shared-board-check script contract", () => {
  test("shared role is explicitly requested after listeners are registered", () => {
    const source = readFileSync(sharedBoardCheckScriptPath, "utf-8");

    expect(source.includes('REQUEST_ROLE: "shared_request_role"')).toBe(true);
    expect(source.includes("room.onMessage(SERVER_MESSAGE_TYPES.ROLE, (payload) => {")).toBe(true);
    expect(source.includes("room.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);")).toBe(true);
    expect(source.indexOf("room.onMessage(SERVER_MESSAGE_TYPES.ROLE, (payload) => {"))
      .toBeLessThan(source.indexOf("room.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);"));
  });
});
