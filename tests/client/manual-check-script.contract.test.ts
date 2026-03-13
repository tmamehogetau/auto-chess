import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const manualCheckScriptPath = resolve(process.cwd(), "src/client/manual-check.js");

describe("manual-check script contract", () => {
  test("module script として構文エラーなく解釈できる", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");
    const tempDir = mkdtempSync(join(tmpdir(), "manual-check-parse-"));
    const tempFilePath = join(tempDir, "manual-check.mjs");

    writeFileSync(tempFilePath, source, "utf-8");

    try {
      expect(() => {
        execFileSync(process.execPath, ["--check", tempFilePath], {
          stdio: "pipe",
        });
      }).not.toThrow();
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
