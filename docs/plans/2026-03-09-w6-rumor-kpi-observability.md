# W6 Rumor KPI Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the smallest safe observability slice for rumor influence so W6 can measure guaranteed-offer usage before expanding spell variety, boss shop UI, or additional fixed-pair sub-units.

**Architecture:** Keep W6-1 inside the existing logging path. Reuse `MatchLogger` round/action logs, tag rumor purchases at the prep-command logging boundary, then compute a derived KPI summary from those logs instead of introducing a new analytics subsystem or persistent storage. Preserve the MVP-safe OFF path: when `enableRumorInfluence=false`, no new rumor-only behavior should appear and summary values should stay zeroed.

**Tech Stack:** TypeScript, Vitest, Colyseus, npm, Markdown

---

### Task 1: Tag rumor purchases in the existing action log stream

**Files:**
- Modify: `src/server/match-logger.ts`
- Modify: `src/server/rooms/game-room/prep-command-logging.ts`
- Test: `tests/server/match-logger.test.ts`
- Test: `tests/server/game-room/prep-command-logging.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- a normal `buy_unit` action can expose whether the purchased offer was a rumor slot
- buying a guaranteed rumor offer records `isRumorUnit: true` in the action log details
- non-rumor purchases keep `isRumorUnit` absent or false
- `MatchLogger` exposes action logs via a defensive-copy getter

Use assertions shaped like:

```ts
expect(logger.getActionLogs()[0]?.details.isRumorUnit).toBe(true)
expect(logger.getActionLogs()[0]).not.toBe(logger.getActionLogs()[0])
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/match-logger.test.ts tests/server/game-room/prep-command-logging.test.ts`

Expected: FAIL because `PlayerActionLog` has no rumor purchase field yet and `MatchLogger` has no `getActionLogs()` getter.

**Step 3: Write minimal implementation**

Make only the smallest logging changes:
- extend `PlayerActionLog.details` with optional `isRumorUnit?: boolean`
- in `logPrepCommandActions()`, when `shopBuySlotIndex` targets an offer with `offer.isRumorUnit === true`, include that flag in the logged action details
- add `getActionLogs(): PlayerActionLog[]` to `MatchLogger` and return cloned entries so later KPI aggregation can read them safely

Implementation target shape:

```ts
if (offer) {
  deps.logger.logAction(sessionId, roundIndex, "buy_unit", {
    unitType: offer.unitType,
    cost: offer.cost,
    ...(offer.isRumorUnit === true && { isRumorUnit: true }),
    goldBefore,
    goldAfter: goldBefore - offer.cost,
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/match-logger.test.ts tests/server/game-room/prep-command-logging.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-logger.ts src/server/rooms/game-room/prep-command-logging.ts tests/server/match-logger.test.ts tests/server/game-room/prep-command-logging.test.ts
git commit -m "feat: log rumor purchase signals"
```

### Task 2: Build a derived rumor KPI summary from existing logs

**Files:**
- Create: `src/server/analytics/rumor-kpi.ts`
- Modify: `src/server/match-logger.ts`
- Test: `tests/server/analytics/rumor-kpi.test.ts`
- Test: `tests/server/rumor-influence.integration.test.ts`

**Step 1: Write the failing test**

Add tests that verify a new summary builder can derive these minimum W6 metrics:
- `guaranteedRounds`: rounds where `guaranteedRumorSlotApplied === true`
- `rumorPurchaseCount`: unique `(roundIndex, playerId)` rumor purchases (count once per player per round even if multiple buys)
- `rumorPurchaseRate`: `rumorPurchaseCount / total guaranteed player-round opportunities` with zero-safe handling
- `roundsWithoutPurchase`: guaranteed player-round opportunities with no rumor purchase
- per-player counts for guaranteed rounds and rumor purchases

Use fixture-style tests plus one integration test that advances a real controller through:
- a successful rumor grant round with no purchase
- a successful rumor grant round with a purchase

Expected output shape:

```ts
expect(summary).toEqual({
  guaranteedRounds: 2,
  rumorPurchaseCount: 1,
  rumorPurchaseRate: 0.5,
  roundsWithoutPurchase: 1,
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/analytics/rumor-kpi.test.ts tests/server/rumor-influence.integration.test.ts`

Expected: FAIL because no KPI builder exists yet.

**Step 3: Write minimal implementation**

Create `src/server/analytics/rumor-kpi.ts` with a pure helper that accepts round logs and action logs and returns a summary object. Keep it deliberately narrow:
- no database writes
- no UI rendering
- no cross-feature analytics
- round identity is `(roundIndex, playerId)` for purchase counting

Add a convenience method to `MatchLogger` only if it stays a thin wrapper, for example:

```ts
getRumorKpiSummary(): RumorKpiSummary {
  return buildRumorKpiSummary(this.getRoundLogs(), this.getActionLogs())
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/analytics/rumor-kpi.test.ts tests/server/rumor-influence.integration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/analytics/rumor-kpi.ts src/server/match-logger.ts tests/server/analytics/rumor-kpi.test.ts tests/server/rumor-influence.integration.test.ts
git commit -m "feat: add rumor kpi summary"
```

### Task 3: Add one structured report output for manual W6 review

**Files:**
- Modify: `src/server/match-logger.ts`
- Test: `tests/server/match-logger.test.ts`

**Step 1: Write the failing test**

Add a focused test that verifies `MatchLogger` can emit one machine-readable rumor KPI report without changing existing summary output.

Assert a payload like:

```ts
expect(JSON.parse(consoleSpy.mock.calls[0][0] as string)).toEqual({
  type: "rumor_kpi_summary",
  data: expect.objectContaining({
    guaranteedRounds: 1,
    rumorPurchaseCount: 1,
  }),
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/match-logger.test.ts`

Expected: FAIL because no rumor KPI output method exists yet.

**Step 3: Write minimal implementation**

Add a dedicated output method that reuses the Task 2 helper and emits only structured JSON:

```ts
outputRumorKpiSummary(): void {
  console.log(JSON.stringify({
    type: "rumor_kpi_summary",
    data: this.getRumorKpiSummary(),
  }))
}
```

Do not alter `outputSummary()` semantics.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/match-logger.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-logger.ts tests/server/match-logger.test.ts
git commit -m "feat: add rumor kpi report output"
```

### Task 4: Sync W6 docs and verification evidence

**Files:**
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md`
- Modify: `docs/plans/2026-03-09-w6-rumor-kpi-observability.md`

**Step 1: Write the failing documentation checklist**

Before editing, lock this checklist:
- W6 in-scope is only rumor observability and KPI confirmation support
- `enableRumorInfluence=false` OFF-path remains unchanged
- later W6/W7 work still owns spell variety, boss shop UI polish, and extra fixed pairs
- docs mention the single structured report output and the minimum KPI fields

**Step 2: Update docs minimally**

Sync docs so they reflect the shipped scope accurately:
- spec summary mentions the new rumor KPI observability slice
- weekly plan notes W6-1 as the current executed sub-slice if implementation completes
- this plan file records verification evidence and any follow-up deferred because of YAGNI

**Step 3: Run verification**

Run: `npx vitest run tests/server/game-room/prep-command-logging.test.ts tests/server/match-logger.test.ts tests/server/analytics/rumor-kpi.test.ts tests/server/rumor-influence.integration.test.ts`

Expected: PASS

Run: `npm run verify:ci`

Expected: PASS

Note: keep fixed-port Colyseus suites sequential; do not parallelize them with other heavy E2E runs.

**Step 4: Commit**

```bash
git add 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md docs/plans/2026-03-09-w6-rumor-kpi-observability.md
git commit -m "docs: add W6 rumor KPI observability plan"
```

---

## Verification Evidence

### Task 4 Completion (2026-03-09)

**Documentation Checklist** (locked):
- [x] W6 in-scope is only rumor observability and KPI confirmation support
- [x] `enableRumorInfluence=false` OFF-path remains unchanged
- [x] Later W6/W7 work still owns spell variety, boss shop UI polish, and extra fixed pairs
- [x] Docs mention the single structured report output and the minimum KPI fields

**Verification Commands**:
```bash
# Run specific test suites for W6-1
npx vitest run tests/server/game-room/prep-command-logging.test.ts tests/server/match-logger.test.ts tests/server/analytics/rumor-kpi.test.ts tests/server/rumor-influence.integration.test.ts

# Run full CI verification
npm run verify:ci

# Workspace governance check
node scripts/verify/check-workspace-governance.mjs
node scripts/verify/check-workspace-governance.mjs --strict
```

**Expected Results**:
- All unit tests: PASS
- All integration tests: PASS
- CI verification: PASS
- Type checking: Clean
- Linting: Clean

**Actual Results** (2026-03-09):
- ✅ W6-1 specific test suites: **PASS** (92 tests)
  - prep-command-logging.test.ts: 29 tests
  - match-logger.test.ts: 33 tests
  - rumor-kpi.test.ts: 15 tests
  - rumor-influence.integration.test.ts: 15 tests
- ✅ Full CI verification: **PASS**
  - Client tests: 75 tests
  - Server tests: All passed
  - E2E tests: Passed
- Summary: All TypeScript errors fixed, type checking clean, linting clean

**Test Coverage**:
- `tests/server/game-room/prep-command-logging.test.ts` - Rumor purchase tagging in action logs
- `tests/server/match-logger.test.ts` - MatchLogger getter methods and report output
- `tests/server/analytics/rumor-kpi.test.ts` - Pure KPI summary calculation
- `tests/server/rumor-influence.integration.test.ts` - End-to-end rumor flow

**Note**: Keep fixed-port Colyseus suites sequential; do not parallelize them with other heavy E2E runs.

## Deferred Follow-up (YAGNI)

Deferred because of YAGNI (You Aren't Gonna Need It):

1. **Rumor unit variation**: Out of scope for W6-1. Measure current guaranteed-slot behavior first before adding complexity.
2. **Spell card variety**: Stays deferred until KPI baseline exists. Need purchase rate data to prioritize which spells matter.
3. **Boss exclusive shop UI polish**: Separate workstream from observability. No UI changes in W6-1.
4. **Additional fixed-pair sub-unit support**: Deferred until W6-1 provides usage/balance signals. Need to see if current sub-units are purchased before adding more.

**Rationale**: W6-1 delivers measurable insight, not new gameplay. W6-2 and beyond will use actual KPI data (guaranteedRounds, rumorPurchaseCount, rumorPurchaseRate, roundsWithoutPurchase) for prioritization instead of speculation.
