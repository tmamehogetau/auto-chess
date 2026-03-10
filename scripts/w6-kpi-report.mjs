#!/usr/bin/env node

/**
 * W6 KPI Report Script
 * Reads newline-delimited JSON and aggregates gameplay_kpi_summary records
 *
 * Usage: node scripts/w6-kpi-report.mjs <path-to-ndjson-file>
 */

import { readFileSync } from "fs";

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
function aggregateKpiData(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  let sampledMatches = 0;
  let totalPlayersSurvivedR8 = 0;
  let totalPlayers = 0;
  let totalFailedPrepCommands = 0;
  let totalPrepCommands = 0;
  const compositionCounts = new Map();

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      // Skip malformed JSON lines
      continue;
    }

    // Only process gameplay_kpi_summary records (actual log shape uses 'type')
    if (record.type !== "gameplay_kpi_summary") {
      continue;
    }

    // Get data from nested data field
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
