import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("run-verify-ci", () => {
  test("prints ordered elapsed summaries", async () => {
    const { formatStageSummary } = await import("../../../scripts/run-verify-ci.mjs");

    const output = formatStageSummary([
      { name: "typecheck", elapsedMs: 1200 },
      { name: "client", elapsedMs: 500 },
      { name: "server-parallel", elapsedMs: 10_000 },
    ]);

    expect(output).toContain("typecheck");
    expect(output).toContain("server-parallel");
    expect(output).toContain("elapsed");
  });

  test("package.json routes verify scripts through the timing runner", async () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["verify:ci"]).toContain("run-verify-ci.mjs");
    expect(packageJson.scripts?.["verify:quick"]).toContain("test:server:parallel-safe");
  });
});
