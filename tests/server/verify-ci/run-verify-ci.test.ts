import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("run-verify-ci", () => {
  test("prints ordered elapsed summaries", async () => {
    const {
      DEFAULT_VERIFY_CI_STAGES,
      formatStageSummary,
    } = await import("../../../scripts/run-verify-ci.mjs");

    const output = formatStageSummary([
      { name: "typecheck", elapsedMs: 1200 },
      { name: "client", elapsedMs: 500 },
      { name: "server-parallel", elapsedMs: 10_000 },
      { name: "server-serial-rest", elapsedMs: 40_000 },
      { name: "server-serial-bot-playability", elapsedMs: 55_000 },
      { name: "e2e-a", elapsedMs: 25_000 },
      { name: "e2e-b", elapsedMs: 20_000 },
      { name: "e2e-c", elapsedMs: 38_000 },
    ]);

    expect(output).toContain("reported-stage-total");
    expect(output).toContain("typecheck");
    expect(output).toContain("server-parallel");
    expect(output).toContain("server-serial-rest");
    expect(output).toContain("server-serial-bot-playability");
    expect(output).toContain("e2e-a");
    expect(output).toContain("elapsed");
    const stageNames = DEFAULT_VERIFY_CI_STAGES.map((stage: { name: string }) => stage.name);
    expect(stageNames).toContain("server-serial-rest");
    expect(stageNames).toContain("server-serial-bot-playability");
    expect(stageNames).toContain("e2e-a");
    expect(stageNames).toContain("e2e-b");
    expect(stageNames).toContain("e2e-c");
  });

  test("package.json routes verify scripts through the timing runner", async () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["verify:ci"]).toContain("run-verify-ci.mjs");
    expect(packageJson.scripts?.["verify:quick"]).toContain("test:server:parallel-safe");
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:ci:a");
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:ci:b");
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:ci:c");
  });

  test("can resolve a filtered stage list from VERIFY_CI_STAGES", async () => {
    const {
      resolveRequestedStages,
    } = await import("../../../scripts/run-verify-ci.mjs");

    const stageNames = resolveRequestedStages("typecheck,e2e-a").map((stage: { name: string }) => stage.name);

    expect(stageNames).toEqual(["typecheck", "e2e-a"]);
  });

  test("groups compatible stages into parallel execution batches while preserving summary order", async () => {
    const {
      DEFAULT_VERIFY_CI_STAGES,
      groupStagesForExecution,
    } = await import("../../../scripts/run-verify-ci.mjs");

    const groupedStageNames = groupStagesForExecution(DEFAULT_VERIFY_CI_STAGES)
      .map((batch: Array<{ name: string }>) => batch.map((stage) => stage.name));

    expect(groupedStageNames).toEqual([
      ["typecheck", "client", "server-audit"],
      ["server-parallel"],
      ["server-serial-rest", "server-serial-bot-playability"],
      ["e2e-a", "e2e-b", "e2e-c"],
    ]);
  });

  test("workflow fans out verify:ci with VERIFY_CI_STAGES", async () => {
    const workflowPath = path.resolve(process.cwd(), ".github", "workflows", "ci.yml");
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("VERIFY_CI_STAGES");
    expect(workflow).toContain("npm run verify:ci");
    expect(workflow).toContain("e2e-a");
    expect(workflow).toContain("e2e-b");
    expect(workflow).toContain("e2e-c");
  });
});
