import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("w6-kpi-report.mjs", () => {
  const scriptPath = join(process.cwd(), "scripts", "w6-kpi-report.mjs");
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = join(tmpdir(), `kpi-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  it("should aggregate gameplay_kpi_summary records from newline-delimited JSON", () => {
    const testData = [
      { type: "gameplay_kpi_summary", data: { totalRounds: 15, playerCount: 4, playersSurvivedR8: 3, totalPlayers: 4, r8CompletionRate: 0.75, top1CompositionSignature: "warrior:2,archer:1", failedPrepCommands: 2, totalPrepCommands: 40, prepInputFailureRate: 0.05 } },
      { type: "gameplay_kpi_summary", data: { totalRounds: 20, playerCount: 4, playersSurvivedR8: 3, totalPlayers: 4, r8CompletionRate: 0.75, top1CompositionSignature: "mage:3", failedPrepCommands: 4, totalPrepCommands: 40, prepInputFailureRate: 0.1 } },
    ];

    const testFile = join(tempDir, "test-data.ndjson");
    writeFileSync(testFile, testData.map(d => JSON.stringify(d)).join("\n"));

    const result = execSync(`node ${scriptPath} "${testFile}"`, { encoding: "utf-8" });
    const output = JSON.parse(result);

    expect(output.sampledMatches).toBe(2);
    expect(output.r8CompletionRate).toBeCloseTo(0.75, 2); // (3+3)/(4+4) = 6/8 = 0.75
    expect(output.prepInputFailureRate).toBeCloseTo(0.075, 3); // (2+4)/(40+40) = 6/80 = 0.075
    expect(output.top1CompositionShare).toBe(0.5); // Each appears once, so 1/2
    expect(output.mostCommonTop1Composition).toBe("mage:3"); // Lexicographic tie-break: "m" < "w"
  });

  it("should ignore unrelated record types", () => {
    const testData = [
      { type: "match_summary", matchId: "123" },
      { type: "gameplay_kpi_summary", data: { totalRounds: 10, playerCount: 4, playersSurvivedR8: 1, totalPlayers: 4, r8CompletionRate: 0.25, top1CompositionSignature: "tank:2", failedPrepCommands: 0, totalPrepCommands: 50, prepInputFailureRate: 0 } },
      { type: "error_log", message: "something wrong" },
      { type: "gameplay_kpi_summary", data: { totalRounds: 12, playerCount: 4, playersSurvivedR8: 1, totalPlayers: 4, r8CompletionRate: 0.25, top1CompositionSignature: "tank:2", failedPrepCommands: 1, totalPrepCommands: 50, prepInputFailureRate: 0.02 } },
    ];

    const testFile = join(tempDir, "mixed-data.ndjson");
    writeFileSync(testFile, testData.map(d => JSON.stringify(d)).join("\n"));

    const result = execSync(`node ${scriptPath} "${testFile}"`, { encoding: "utf-8" });
    const output = JSON.parse(result);

    expect(output.sampledMatches).toBe(2);
    expect(output.r8CompletionRate).toBeCloseTo(0.25, 2); // (1+1)/(4+4) = 2/8 = 0.25
    expect(output.prepInputFailureRate).toBeCloseTo(0.01, 3); // (0+1)/(50+50) = 1/100 = 0.01
  });

  it("should handle empty files gracefully", () => {
    const testFile = join(tempDir, "empty.ndjson");
    writeFileSync(testFile, "");

    const result = execSync(`node ${scriptPath} "${testFile}"`, { encoding: "utf-8" });
    const output = JSON.parse(result);

    expect(output.sampledMatches).toBe(0);
    expect(output.r8CompletionRate).toBe(0);
    expect(output.prepInputFailureRate).toBe(0);
    expect(output.top1CompositionShare).toBe(0);
    expect(output.mostCommonTop1Composition).toBeNull();
  });

  it("should handle files with no gameplay_kpi_summary records", () => {
    const testData = [
      { type: "match_summary", matchId: "123" },
      { type: "error_log", message: "error" },
    ];

    const testFile = join(tempDir, "no-kpi.ndjson");
    writeFileSync(testFile, testData.map(d => JSON.stringify(d)).join("\n"));

    const result = execSync(`node ${scriptPath} "${testFile}"`, { encoding: "utf-8" });
    const output = JSON.parse(result);

    expect(output.sampledMatches).toBe(0);
    expect(output.r8CompletionRate).toBe(0);
    expect(output.prepInputFailureRate).toBe(0);
    expect(output.top1CompositionShare).toBe(0);
    expect(output.mostCommonTop1Composition).toBeNull();
  });

  it("should compute correct composition share statistics", () => {
    const testData = [
      { type: "gameplay_kpi_summary", data: { totalRounds: 15, playerCount: 4, playersSurvivedR8: 0, totalPlayers: 4, r8CompletionRate: 0, top1CompositionSignature: "warrior:2,archer:1", failedPrepCommands: 0, totalPrepCommands: 1, prepInputFailureRate: 0 } },
      { type: "gameplay_kpi_summary", data: { totalRounds: 15, playerCount: 4, playersSurvivedR8: 0, totalPlayers: 4, r8CompletionRate: 0, top1CompositionSignature: "warrior:2,archer:1", failedPrepCommands: 0, totalPrepCommands: 1, prepInputFailureRate: 0 } },
      { type: "gameplay_kpi_summary", data: { totalRounds: 15, playerCount: 4, playersSurvivedR8: 0, totalPlayers: 4, r8CompletionRate: 0, top1CompositionSignature: "mage:3", failedPrepCommands: 0, totalPrepCommands: 1, prepInputFailureRate: 0 } },
    ];

    const testFile = join(tempDir, "composition.ndjson");
    writeFileSync(testFile, testData.map(d => JSON.stringify(d)).join("\n"));

    const result = execSync(`node ${scriptPath} "${testFile}"`, { encoding: "utf-8" });
    const output = JSON.parse(result);

    expect(output.sampledMatches).toBe(3);
    expect(output.top1CompositionShare).toBeCloseTo(0.6667, 3); // 2/3
    expect(output.mostCommonTop1Composition).toBe("warrior:2,archer:1");
  });

  it("should handle malformed JSON lines gracefully", () => {
    const testFile = join(tempDir, "malformed.ndjson");
    writeFileSync(testFile, [
      '{"type": "gameplay_kpi_summary", "data": {"totalRounds": 10, "playerCount": 4, "playersSurvivedR8": 1, "totalPlayers": 4, "r8CompletionRate": 0.25, "top1CompositionSignature": "", "failedPrepCommands": 2, "totalPrepCommands": 40, "prepInputFailureRate": 0.05}}',
      "this is not json",
      '{"type": "gameplay_kpi_summary", "data": {"totalRounds": 12, "playerCount": 4, "playersSurvivedR8": 0, "totalPlayers": 4, "r8CompletionRate": 0, "top1CompositionSignature": "", "failedPrepCommands": 3, "totalPrepCommands": 40, "prepInputFailureRate": 0.075}}',
    ].join("\n"));

    const result = execSync(`node ${scriptPath} "${testFile}"`, { encoding: "utf-8" });
    const output = JSON.parse(result);

    expect(output.sampledMatches).toBe(2);
    expect(output.r8CompletionRate).toBeCloseTo(0.125, 3); // 1/8 = 0.125
    expect(output.prepInputFailureRate).toBeCloseTo(0.0625, 4); // 5/80 = 0.0625
  });

  it("should exit with error when file path not provided", () => {
    expect(() => {
      execSync(`node ${scriptPath}`, { encoding: "utf-8" });
    }).toThrow();
  });

  it("should exit with error when file does not exist", () => {
    expect(() => {
      execSync(`node ${scriptPath} "/nonexistent/file.ndjson"`, { encoding: "utf-8" });
    }).toThrow();
  });
});
