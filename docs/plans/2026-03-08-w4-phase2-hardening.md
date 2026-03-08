# W4 Phase2 Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize the newly merged Phase2 core by reducing noisy bridge logging, hardening roster-switch regressions, and syncing the remaining active docs to the real main-branch state.

**Architecture:** Keep the hardening pass small and local. Do not redesign bridge/monitoring infrastructure; instead, add explicit guards and regression tests around the current MVP-safe behavior. Treat `enableTouhouRoster=false` as the primary compatibility boundary and keep monitoring/reporting lightweight and structured.

**Tech Stack:** TypeScript, Vitest, Colyseus, npm, Markdown

---

### Task 1: Silence noisy SharedBoardBridge success logs without losing failures

**Files:**
- Modify: `src/server/shared-board-bridge.ts`
- Test: `tests/server/shared-board-bridge.validation.test.ts`
- Test: `tests/server/shared-board-bridge.batch-sync.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- successful `applyPlacementChange()` no longer emits full placement payload logs
- successful `sendPlacementToSharedBoard()` no longer emits full placement payload logs
- error paths still emit failure logs

Use `vi.spyOn(console, "log")` / `vi.spyOn(console, "error")` and restore mocks per test.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/shared-board-bridge.validation.test.ts tests/server/shared-board-bridge.batch-sync.test.ts`
Expected: FAIL because the current implementation still emits verbose success logs.

**Step 3: Write minimal implementation**

Change `src/server/shared-board-bridge.ts` so that:
- success paths do not print placement arrays to stdout
- failure paths remain logged
- no behavior changes are introduced to sync/apply logic

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/shared-board-bridge.validation.test.ts tests/server/shared-board-bridge.batch-sync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/shared-board-bridge.ts tests/server/shared-board-bridge.validation.test.ts tests/server/shared-board-bridge.batch-sync.test.ts
git commit -m "fix: reduce shared board bridge log noise"
```

### Task 2: Make BridgeMonitor structured logging opt-in for runtime noise control

**Files:**
- Modify: `src/server/shared-board-bridge-monitor.ts`
- Test: `tests/server/shared-board-bridge-monitor.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- default monitor instances do not emit structured `console.log` / `console.warn` output on every event
- an explicit debug-enabled path still emits structured logs
- in-memory metrics and recent event history remain unchanged

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/shared-board-bridge-monitor.test.ts`
Expected: FAIL because the current monitor always writes structured logs.

**Step 3: Write minimal implementation**

Update `BridgeMonitor` so that structured log emission is gated behind one explicit runtime switch (constructor option or local constant), while metrics/history collection still always runs.

Rules:
- keep the API simple
- do not add a full logging subsystem
- preserve current dashboard/alert behavior

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/shared-board-bridge-monitor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/shared-board-bridge-monitor.ts tests/server/shared-board-bridge-monitor.test.ts
git commit -m "fix: gate bridge monitor structured logs"
```

### Task 3: Broaden roster-switch regression coverage around legacy fallback

**Files:**
- Modify: `tests/server/roster/roster-provider.test.ts`
- Modify: `tests/e2e/full-game/roster-switch.e2e.spec.ts`
- Modify: `src/server/roster/roster-provider.ts` (only if tests expose a real gap)

**Step 1: Write the failing test**

Add tests that verify:
- `enableTouhouFactions=true` without `enableTouhouRoster` still resolves MVP roster units at the provider boundary
- `enablePerUnitSharedPool=true` without roster switch does not change active roster selection
- roster switch OFF keeps MVP offers even when adjacent Touhou flags are force-set in a controlled test fixture

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/roster/roster-provider.test.ts tests/e2e/full-game/roster-switch.e2e.spec.ts`
Expected: FAIL because the new edge-case assertions are not covered yet.

**Step 3: Write minimal implementation**

If the provider already behaves correctly, keep this task test-only.
If tests expose a real gap, patch `src/server/roster/roster-provider.ts` minimally so MVP fallback stays deterministic when the roster switch is off.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/roster/roster-provider.test.ts tests/e2e/full-game/roster-switch.e2e.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/server/roster/roster-provider.test.ts tests/e2e/full-game/roster-switch.e2e.spec.ts src/server/roster/roster-provider.ts
git commit -m "test: harden roster switch fallback coverage"
```

### Task 4: Sync active docs to the real post-merge state

**Files:**
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md`
- Create: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/tickets/active/W2_Execution_Tickets.md`
- Modify: `docs/plans/sharedboard-battle-input-contract.md`

**Step 1: Write the failing documentation checklist**

Create a short checklist before editing:
- remove or reword stale `共有プール在庫体系修正` text now that per-unit pool is shipped
- add the missing W2 execution ticket
- keep `3v1同時戦闘` explicitly marked as MVP後 open item, not current scope
- record W4 as the active stabilization focus

**Step 2: Update docs minimally**

Make the docs reflect the real state after PR #1 / #2 merge:
- W2 ticket exists and summarizes completed T3/T4/T5 outcomes
- active weekly plan highlights W4 as the current in-progress phase
- spec no longer claims the shipped shared-pool inventory work is unimplemented
- shared-board contract keeps only true open items

**Step 3: Verify docs consistency**

Check manually that:
- the same work is not marked both complete and unimplemented
- ticket/plan/spec references agree on W2/W3/W4 status
- no file points to deleted branches or stale PR-only status

**Step 4: Commit**

```bash
git add 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/tickets/active/W2_Execution_Tickets.md docs/plans/sharedboard-battle-input-contract.md
git commit -m "docs: sync W4 phase2 hardening status"
```

### Task 5: Run final hardening verification

**Files:**
- Verify only: touched test files, docs, `package.json`

**Step 1: Run focused regression suite**

Run: `npx vitest run tests/server/shared-board-bridge.validation.test.ts tests/server/shared-board-bridge.batch-sync.test.ts tests/server/shared-board-bridge-monitor.test.ts tests/server/roster/roster-provider.test.ts tests/e2e/full-game/roster-switch.e2e.spec.ts`
Expected: PASS

**Step 2: Run project verify command**

Run: `npm run verify:ci`
Expected: PASS

**Step 3: Run coverage gate**

Run: `npm run test:coverage`
Expected: PASS

**Step 4: Commit verification-safe final state if needed**

If any follow-up fixes were required during Task 5, create one final commit describing the root cause.

```bash
git add <touched-files>
git commit -m "test: finalize W4 phase2 hardening"
```
