#!/usr/bin/env node

/**
 * W6 KPI Report Script
 * Reads newline-delimited JSON and aggregates gameplay_kpi_summary records
 *
 * Usage: node scripts/w6-kpi-report.mjs <path-to-ndjson-file>
 */

import { readFileSync } from "fs";

const KPI_EVIDENCE_SUITE_MANIFEST = {
  "tests/server/full-game-simulation.integration.test.ts": "eligible",
  "tests/server/realistic-kpi-simulation.integration.test.ts": "eligible",
  "tests/server/game-room.feature-flag.integration.test.ts": "incidental",
  "tests/server/kpi-replan-classification.integration.test.ts": "incidental",
};

const FULL_GAME_EVIDENCE_CASE_MANIFEST = {
  "4人でR8完走後にEndフェーズへ遷移する": "eligible",
  "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する": "eligible",
  "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する": "eligible",
  "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する": "eligible",
  "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する": "eligible",
  "各ラウンドで正しいフェーズサイクルが実行される": "incidental",
  "プレイヤーが4人接続したままゲームが継続する": "incidental",
  "round_stateメッセージが各フェーズで送信される": "incidental",
};

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-9;]*m/g, "");
}

function getSuiteBucket(suitePath) {
  if (!suitePath) {
    return "incidental";
  }

  return KPI_EVIDENCE_SUITE_MANIFEST[suitePath] ?? "incidental";
}

function getRecordBucket(record) {
  if (record.suitePath === "tests/server/full-game-simulation.integration.test.ts") {
    return FULL_GAME_EVIDENCE_CASE_MANIFEST[record.testName] ?? "incidental";
  }

  return getSuiteBucket(record.suitePath);
}

// Note: top1CompositionSignature is now emitted as a pre-formatted string
// This function is kept for backward compatibility if needed
function formatCompositionSignature(signature) {
  if (typeof signature === "string") {
    return signature;
  }
  if (!Array.isArray(signature) || signature.length === 0) {
    return "";
  }
  return signature.map((unit) => `${unit.unitType}:${unit.starLevel}`).join(",");
}

/**
 * Aggregates gameplay KPI data from newline-delimited JSON
 * @param {string} filePath - Path to the NDJSON file
 * @returns {object} Aggregated KPI report
 */
function createEmptyAggregate() {
  return {
    sampledMatches: 0,
    r8CompletionRate: 0,
    prepInputFailureRate: 0,
    top1CompositionShare: 0,
    mostCommonTop1Composition: null,
  };
}

function parseKpiRecords(content) {
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const records = [];
  let currentSuitePath = null;
  let currentTestName = null;

  for (const rawLine of lines) {
    const line = stripAnsi(rawLine);
    const suiteMatch = line.match(/stdout \| (tests\/[^(>\s]+\.ts)/);
    if (suiteMatch) {
      currentSuitePath = suiteMatch[1];
    }

    if (currentSuitePath === "tests/server/full-game-simulation.integration.test.ts") {
      const parts = line.split(" > ");
      if (parts.length >= 3) {
        currentTestName = parts[parts.length - 1].trim();
      }
    }

    let record;
    try {
      const jsonCandidate = line.slice(line.indexOf("{"));
      record = JSON.parse(jsonCandidate);
    } catch {
      continue;
    }

    if (record.type !== "gameplay_kpi_summary") {
      continue;
    }

    records.push({
      ...record,
      suitePath: record.suitePath ?? currentSuitePath,
      testName: record.testName ?? currentTestName,
    });
  }

  return records;
}

function aggregateRecords(records) {
  let sampledMatches = 0;
  let totalPlayersSurvivedR8 = 0;
  let totalPlayers = 0;
  let totalFailedPrepCommands = 0;
  let totalPrepCommands = 0;
  const compositionCounts = new Map();

  for (const record of records) {

    const data = record.data || {};

    sampledMatches++;

    // Aggregate R8 completion from counts (not from rates)
    if (typeof data.playersSurvivedR8 === "number") {
      totalPlayersSurvivedR8 += data.playersSurvivedR8;
    }
    if (typeof data.totalPlayers === "number") {
      totalPlayers += data.totalPlayers;
    }

    // Aggregate prep input failures from counts (not from rates)
    if (typeof data.failedPrepCommands === "number") {
      totalFailedPrepCommands += data.failedPrepCommands;
    }
    if (typeof data.totalPrepCommands === "number") {
      totalPrepCommands += data.totalPrepCommands;
    }

    // Count compositions (now string format from runtime)
    const signatureKey = formatCompositionSignature(data.top1CompositionSignature);
    if (signatureKey) {
      compositionCounts.set(
        signatureKey,
        (compositionCounts.get(signatureKey) || 0) + 1,
      );
    }
  }

  // Calculate aggregates from counts
  const r8CompletionRate =
    totalPlayers > 0 ? totalPlayersSurvivedR8 / totalPlayers : 0;

  const prepInputFailureRate =
    totalPrepCommands > 0 ? totalFailedPrepCommands / totalPrepCommands : 0;

  // Find most common composition with lexicographic tie-break
  let mostCommonTop1Composition = null;
  let maxCount = 0;
  for (const [signature, count] of compositionCounts) {
    if (
      count > maxCount ||
      (count === maxCount &&
        (mostCommonTop1Composition === null || signature < mostCommonTop1Composition))
    ) {
      maxCount = count;
      mostCommonTop1Composition = signature;
    }
  }

  // top1CompositionShare is a ratio: occurrences of most common / sampledMatches
  const top1CompositionShare =
    sampledMatches > 0 && maxCount > 0 ? maxCount / sampledMatches : 0;

  return {
    sampledMatches,
    r8CompletionRate,
    prepInputFailureRate,
    top1CompositionShare,
    mostCommonTop1Composition,
  };
}

function aggregateKpiData(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const records = parseKpiRecords(content);

  const eligibleRecords = records.filter((record) => getRecordBucket(record) === "eligible");
  const incidentalRecords = records.filter((record) => getRecordBucket(record) !== "eligible");

  const combinedBundle = records.length > 0 ? aggregateRecords(records) : createEmptyAggregate();
  const eligibleBundle = eligibleRecords.length > 0 ? aggregateRecords(eligibleRecords) : createEmptyAggregate();
  const incidentalBundle = incidentalRecords.length > 0 ? aggregateRecords(incidentalRecords) : createEmptyAggregate();

  return {
    ...combinedBundle,
    combinedBundle,
    eligibleBundle,
    incidentalBundle,
    suiteClassification: {
      eligible: Object.keys(KPI_EVIDENCE_SUITE_MANIFEST).filter(
        (suitePath) => KPI_EVIDENCE_SUITE_MANIFEST[suitePath] === "eligible",
      ),
      incidental: Object.keys(KPI_EVIDENCE_SUITE_MANIFEST).filter(
        (suitePath) => KPI_EVIDENCE_SUITE_MANIFEST[suitePath] === "incidental",
      ),
      fullGameCases: FULL_GAME_EVIDENCE_CASE_MANIFEST,
    },
  };
}

// Main entry point
function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Error: File path required");
    console.error("Usage: node scripts/w6-kpi-report.mjs <path-to-ndjson-file>");
    process.exit(1);
  }

  try {
    const report = aggregateKpiData(filePath);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
