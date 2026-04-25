import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("e2e test manifest", () => {
  test("covers every tests/e2e suite exactly once", async () => {
    const {
      getE2eTestsForShard,
      listAllE2eTests,
    } = await import("../../../scripts/e2e-test-manifest.mjs");

    const allTests = await listAllE2eTests();
    const shardA = await getE2eTestsForShard("a");
    const shardB = await getE2eTestsForShard("b");
    const shardC = await getE2eTestsForShard("c");

    expect(allTests.length).toBeGreaterThan(0);
    expect(new Set(shardA).size).toBe(shardA.length);
    expect(new Set(shardB).size).toBe(shardB.length);
    expect(new Set(shardC).size).toBe(shardC.length);
    expect(shardC).toEqual(["tests/e2e/full-game/full-round-completion.e2e.spec.ts"]);
    expect(new Set([...shardA, ...shardB, ...shardC])).toEqual(new Set(allTests));
    expect(shardA.filter((file: string) => shardB.includes(file))).toEqual([]);
    expect(shardA.filter((file: string) => shardC.includes(file))).toEqual([]);
    expect(shardB.filter((file: string) => shardC.includes(file))).toEqual([]);
  });

  test("package.json exposes manifest audit and split e2e scripts", async () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["test:e2e:audit"]).toContain("e2e-test-manifest");
    expect(packageJson.scripts?.["test:e2e:ci:a"]).toBeTruthy();
    expect(packageJson.scripts?.["test:e2e:ci:b"]).toBeTruthy();
    expect(packageJson.scripts?.["test:e2e:ci:c"]).toBeTruthy();
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:audit");
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:ci:a");
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:ci:b");
    expect(packageJson.scripts?.["test:e2e:ci"]).toContain("test:e2e:ci:c");
  });

  test("helper CLI lists all shards as tests/e2e files", async () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/e2e-test-manifest.mjs");
    const [{ stdout: shardAStdout }, { stdout: shardBStdout }, { stdout: shardCStdout }] = await Promise.all([
      execFileAsync(process.execPath, [scriptPath, "--list=a"], {
        cwd: process.cwd(),
      }),
      execFileAsync(process.execPath, [scriptPath, "--list=b"], {
        cwd: process.cwd(),
      }),
      execFileAsync(process.execPath, [scriptPath, "--list=c"], {
        cwd: process.cwd(),
      }),
    ]);

    const shardA = JSON.parse(shardAStdout) as string[];
    const shardB = JSON.parse(shardBStdout) as string[];
    const shardC = JSON.parse(shardCStdout) as string[];
    const {
      listAllE2eTests,
    } = await import("../../../scripts/e2e-test-manifest.mjs");
    const allTests = await listAllE2eTests();

    expect(shardA.every((file) => file.includes("tests/e2e/"))).toBe(true);
    expect(shardB.every((file) => file.includes("tests/e2e/"))).toBe(true);
    expect(shardC.every((file) => file.includes("tests/e2e/"))).toBe(true);
    expect(shardC).toEqual(["tests/e2e/full-game/full-round-completion.e2e.spec.ts"]);
    expect(shardA.length + shardB.length + shardC.length).toBe(allTests.length);
  });
});
