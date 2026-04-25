import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("server test manifest", () => {
  test("covers every tests/server suite exactly once", async () => {
    const {
      getParallelSafeServerTests,
      getServerTestsForGroup,
      getSerialRequiredServerTests,
      listAllServerTests,
    } = await import("../../../scripts/server-test-manifest.mjs");

    const allTests = await listAllServerTests();
    const parallelSafe = await getParallelSafeServerTests();
    const serialRequired = await getSerialRequiredServerTests();
    const serialBotPlayability = await getServerTestsForGroup("serial-bot-playability");
    const serialRest = await getServerTestsForGroup("serial-rest");

    expect(allTests.length).toBeGreaterThan(0);
    expect(new Set(parallelSafe).size).toBe(parallelSafe.length);
    expect(new Set(serialRequired).size).toBe(serialRequired.length);
    expect(serialBotPlayability).toEqual(["tests/server/game-room/bot-playability.test.ts"]);
    expect(serialRest).not.toContain("tests/server/game-room/bot-playability.test.ts");
    expect(new Set([...serialBotPlayability, ...serialRest])).toEqual(new Set(serialRequired));
    expect(new Set([...parallelSafe, ...serialRequired])).toEqual(new Set(allTests));
    expect(parallelSafe.filter((file: string) => serialRequired.includes(file))).toEqual([]);
  });

  test("package.json exposes manifest audit and split server scripts", async () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["test:server:audit"]).toContain("server-test-manifest");
    expect(packageJson.scripts?.["test:server:parallel-safe"]).toBeTruthy();
    expect(packageJson.scripts?.["test:server:serial-required"]).toBeTruthy();
    expect(packageJson.scripts?.["test:server:serial-bot-playability"]).toBeTruthy();
    expect(packageJson.scripts?.["test:server:serial-rest"]).toBeTruthy();
    expect(packageJson.scripts?.["test:server:ci"]).toContain("test:server:audit");
    expect(packageJson.scripts?.["test:server:ci"]).toContain("test:server:parallel-safe");
    expect(packageJson.scripts?.["test:server:ci"]).toContain("test:server:serial-bot-playability");
    expect(packageJson.scripts?.["test:server:ci"]).toContain("test:server:serial-rest");
  });

  test("helper CLI lists split groups as tests/server files", async () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/server-test-manifest.mjs");
    const [
      { stdout: parallelSafeStdout },
      { stdout: serialRequiredStdout },
      { stdout: serialBotPlayabilityStdout },
      { stdout: serialRestStdout },
    ] = await Promise.all([
      execFileAsync(process.execPath, [scriptPath, "--list=parallel-safe"], {
        cwd: process.cwd(),
      }),
      execFileAsync(process.execPath, [scriptPath, "--list=serial-required"], {
        cwd: process.cwd(),
      }),
      execFileAsync(process.execPath, [scriptPath, "--list=serial-bot-playability"], {
        cwd: process.cwd(),
      }),
      execFileAsync(process.execPath, [scriptPath, "--list=serial-rest"], {
        cwd: process.cwd(),
      }),
    ]);

    const parallelSafe = JSON.parse(parallelSafeStdout) as string[];
    const serialRequired = JSON.parse(serialRequiredStdout) as string[];
    const serialBotPlayability = JSON.parse(serialBotPlayabilityStdout) as string[];
    const serialRest = JSON.parse(serialRestStdout) as string[];
    const {
      listAllServerTests,
    } = await import("../../../scripts/server-test-manifest.mjs");
    const allTests = await listAllServerTests();

    expect(parallelSafe.every((file) => file.includes("tests/server/"))).toBe(true);
    expect(serialRequired.every((file) => file.includes("tests/server/"))).toBe(true);
    expect(serialBotPlayability.every((file) => file.includes("tests/server/"))).toBe(true);
    expect(serialRest.every((file) => file.includes("tests/server/"))).toBe(true);
    expect(serialBotPlayability).toEqual(["tests/server/game-room/bot-playability.test.ts"]);
    expect(new Set([...serialBotPlayability, ...serialRest])).toEqual(new Set(serialRequired));
    expect(parallelSafe.length + serialRequired.length).toBe(allTests.length);
  });
});
