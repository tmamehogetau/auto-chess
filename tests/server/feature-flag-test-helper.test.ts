import { afterEach, describe, expect, test } from "vitest";

import type { ColyseusTestServer } from "@colyseus/testing";

import { FeatureFlagService } from "../../src/server/feature-flag-service";
import {
  FLAG_ENV_VARS,
  createRoomWithForcedFlags,
  restoreForcedFlagFixtures,
  withFlags,
} from "./feature-flag-test-helper";

describe("feature-flag-test-helper", () => {
  afterEach(() => {
    restoreForcedFlagFixtures();
    FeatureFlagService.resetForTests();
  });

  test("withFlags restores managed env vars without replacing process.env", async () => {
    const originalEnvRef = process.env;
    const originalHeroValue = process.env[FLAG_ENV_VARS.enableHeroSystem];
    process.env.CODEX_HELPER_SENTINEL = "keep-me";

    await withFlags({ enableHeroSystem: true }, async () => {
      expect(process.env[FLAG_ENV_VARS.enableHeroSystem]).toBe("true");
      expect(process.env.CODEX_HELPER_SENTINEL).toBe("keep-me");
    });

    expect(process.env).toBe(originalEnvRef);
    expect(process.env[FLAG_ENV_VARS.enableHeroSystem]).toBe(originalHeroValue);
    expect(process.env.CODEX_HELPER_SENTINEL).toBe("keep-me");

    delete process.env.CODEX_HELPER_SENTINEL;
  });

  test("restoreForcedFlagFixtures restores managed env vars without replacing process.env", async () => {
    const originalEnvRef = process.env;
    const originalSharedPoolValue = process.env[FLAG_ENV_VARS.enableSharedPool];
    process.env.CODEX_HELPER_SENTINEL = "keep-me";

    const testServer = {
      createRoom: async () => ({}) as never,
    } as unknown as ColyseusTestServer;

    await createRoomWithForcedFlags(testServer, { enableSharedPool: true });
    restoreForcedFlagFixtures();

    expect(process.env).toBe(originalEnvRef);
    expect(process.env[FLAG_ENV_VARS.enableSharedPool]).toBe(originalSharedPoolValue);
    expect(process.env.CODEX_HELPER_SENTINEL).toBe("keep-me");

    delete process.env.CODEX_HELPER_SENTINEL;
  });
});
