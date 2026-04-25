import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  BOT_BALANCE_BASELINE_PORT_OFFSET_STRIDE,
  baselineChunkConfigMatches,
  createBaselineChunkConfigSnapshot,
  createBotBalanceBaselineHelperConfigs,
  createBotBalanceBaselineRoomTimings,
  createBaselineChunkDefinitions,
  DEFAULT_BOT_BALANCE_BASELINE_PARALLELISM,
  resolveBotBalanceBaselineAutoParallelism,
  resolveBotBalanceBaselineRaidPolicies,
  DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE,
  resolveBotBalanceBaselineParallelism,
  resolveBotBalanceBaselinePortOffsetBase,
  resolveBotBalanceBaselineWorkerPortOffset,
} from "./bot-balance-baseline-runner";

describe("bot balance baseline runner helpers", () => {
  test("builds chunk definitions with stable paths", () => {
    const outputDir = "/tmp/baseline";
    const chunks = createBaselineChunkDefinitions(12, 5, outputDir);

    expect(chunks).toEqual([
      {
        chunkIndex: 0,
        matchStartIndex: 0,
        requestedMatchCount: 5,
        chunkJsonPath: join(outputDir, "chunk-001.json"),
        logPath: join(outputDir, "chunk-001.log"),
      },
      {
        chunkIndex: 1,
        matchStartIndex: 5,
        requestedMatchCount: 5,
        chunkJsonPath: join(outputDir, "chunk-002.json"),
        logPath: join(outputDir, "chunk-002.log"),
      },
      {
        chunkIndex: 2,
        matchStartIndex: 10,
        requestedMatchCount: 2,
        chunkJsonPath: join(outputDir, "chunk-003.json"),
        logPath: join(outputDir, "chunk-003.log"),
      },
    ]);
  });

  test("returns no chunks when requested match count is non-positive", () => {
    expect(createBaselineChunkDefinitions(0, 5, "/tmp/baseline")).toEqual([]);
    expect(createBaselineChunkDefinitions(-3, 5, "/tmp/baseline")).toEqual([]);
  });

  test("matches resume chunk snapshots only when the baseline config is unchanged", () => {
    const baselineConfig = createBaselineChunkConfigSnapshot({
      requestedMatchCount: 5,
      bossPolicy: "growth",
      raidPolicies: ["strength", "growth", "growth"],
    });

    expect(baselineChunkConfigMatches(baselineConfig, baselineConfig)).toBe(true);
    expect(baselineChunkConfigMatches(undefined, baselineConfig)).toBe(false);
    expect(baselineChunkConfigMatches(
      createBaselineChunkConfigSnapshot({
        requestedMatchCount: 4,
        bossPolicy: "growth",
        raidPolicies: ["strength", "growth", "growth"],
      }),
      baselineConfig,
    )).toBe(false);
    expect(baselineChunkConfigMatches(
      createBaselineChunkConfigSnapshot({
        requestedMatchCount: 5,
        bossPolicy: "strength",
        raidPolicies: ["strength", "growth", "growth"],
      }),
      baselineConfig,
    )).toBe(false);
  });

  test("uses sane defaults for parallelism and worker port offsets", () => {
    expect(DEFAULT_BOT_BALANCE_BASELINE_PARALLELISM).toBe(12);
    expect(resolveBotBalanceBaselineAutoParallelism(4)).toBe(4);
    expect(resolveBotBalanceBaselineAutoParallelism(8)).toBe(4);
    expect(resolveBotBalanceBaselineAutoParallelism(12)).toBe(9);
    expect(resolveBotBalanceBaselineAutoParallelism(16)).toBe(12);
    expect(resolveBotBalanceBaselineAutoParallelism(64)).toBe(16);
    expect(resolveBotBalanceBaselineParallelism(undefined, 16)).toBe(
      12,
    );
    expect(resolveBotBalanceBaselineParallelism(0)).toBe(1);
    expect(resolveBotBalanceBaselineParallelism(6)).toBe(6);

    expect(resolveBotBalanceBaselinePortOffsetBase(undefined)).toBe(
      DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE,
    );
    expect(resolveBotBalanceBaselinePortOffsetBase(-10)).toBe(0);
    expect(resolveBotBalanceBaselinePortOffsetBase(60_000, 16)).toBe(55_266);
    expect(resolveBotBalanceBaselineWorkerPortOffset(0)).toBe(
      DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE,
    );
    expect(resolveBotBalanceBaselineWorkerPortOffset(1)).toBe(
      DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE
      + BOT_BALANCE_BASELINE_PORT_OFFSET_STRIDE,
    );
    expect(resolveBotBalanceBaselineWorkerPortOffset(3)).toBe(
      DEFAULT_BOT_BALANCE_BASELINE_PORT_OFFSET_BASE
      + BOT_BALANCE_BASELINE_PORT_OFFSET_STRIDE * 3,
    );
  });

  test("creates baseline timings that preserve combat-critical durations", () => {
    const timings = createBotBalanceBaselineRoomTimings(0.02);

    expect(timings).toMatchObject({
      prepDurationMs: 900,
      battleDurationMs: 800,
      battleTimelineTimeScale: 0.01,
      readyAutoStartMs: 200,
      settleDurationMs: 20,
      eliminationDurationMs: 10,
      selectionTimeoutMs: 200,
    });
  });

  test("creates fixed helper configs with bot1 as boss and strength defaults", () => {
    expect(createBotBalanceBaselineHelperConfigs()).toEqual([
      { wantsBoss: true, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
    ]);

    expect(createBotBalanceBaselineHelperConfigs({
      bossPolicy: "growth",
      raidPolicies: ["strength", "growth", "growth"],
    })).toEqual([
      { wantsBoss: true, policy: "growth" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "growth" },
      { wantsBoss: false, policy: "growth" },
    ]);
  });

  test("normalizes raid policy csv values and fills missing slots with strength", () => {
    expect(resolveBotBalanceBaselineRaidPolicies(undefined)).toEqual([
      "strength",
      "strength",
      "strength",
    ]);
    expect(resolveBotBalanceBaselineRaidPolicies("growth, strength")).toEqual([
      "growth",
      "strength",
      "strength",
    ]);
    expect(resolveBotBalanceBaselineRaidPolicies("growth,unknown,growth,extra")).toEqual([
      "growth",
      "strength",
      "growth",
    ]);
  });
});
