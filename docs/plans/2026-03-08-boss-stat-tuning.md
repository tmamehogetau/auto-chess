# Boss Stat Tuning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align Remilia boss stats with the current game spec, remove duplicated hardcoded boss values, and lock the new balance with focused regression coverage.

**Architecture:** Treat this phase as a focused balance-and-data-consistency pass, not a new gameplay-system expansion. First lock the intended boss numbers in tests, then route boss combat creation through a single source of truth from `src/data/mvp_phase1_units.json`, and finally update simulation and spec-facing docs so balance measurements reflect the new baseline.

**Tech Stack:** TypeScript, Vitest, JSON data fixtures, Colyseus server runtime

---

## Phase Scope

This phase covers only the high-priority boss stat mismatch called out in `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md:104`.

In scope:
- Remilia base combat stats (`hp`, `attack`, `attackSpeed`, `range`, reductions)
- Single source of truth for boss stat loading
- Regression tests for boss stat application and current balance measurement
- Plan/spec wording updates if measurement expectations change

Out of scope:
- New boss passives
- New boss UI
- Scarlet Mansion synergy redesign
- Boss shop redesign
- R12 boss flow redesign

---

### Task 1: Freeze the target boss baseline in tests

**Files:**
- Modify: `tests/server/combat/boss-raid-simulation.test.ts`
- Modify: `tests/server/combat/battle-simulator.test.ts`
- Reference: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md:104`
- Reference: `src/data/mvp_phase1_units.json`

**Step 1: Write the failing stat-baseline test**

In `tests/server/combat/boss-raid-simulation.test.ts`, update the explicit boss stat assertions to match the chosen spec baseline.

Add or update a test like:

```ts
test("ボスステータスが仕様値を使う", () => {
  const boss = createBossUnit();

  expect(boss.hp).toBe(3200);
  expect(boss.maxHp).toBe(3200);
  expect(boss.attackPower).toBe(280);
  expect(boss.attackSpeed).toBe(0.95);
  expect(boss.attackRange).toBe(3);
  expect(boss.physicalReduction).toBe(15);
  expect(boss.magicReduction).toBe(10);
});
```

If the spec was updated before execution, use the finalized numbers from the spec instead of the example above.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/boss-raid-simulation.test.ts -t "ボスステータスが仕様値を使う"`

Expected: FAIL because current runtime still uses mismatched or duplicated boss stat values.

**Step 3: Add a battle-unit creation regression**

In `tests/server/combat/battle-simulator.test.ts`, add a focused regression that verifies `createBattleUnit(..., isBoss=true, archetype="remilia")` reads the same baseline every time.

Example:

```ts
test("isBoss=true かつ remilia は boss data baseline を使う", () => {
  const boss = createBattleUnit(
    { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
    "right",
    0,
    true,
    DEFAULT_FLAGS,
  );

  expect(boss.maxHp).toBe(3200);
  expect(boss.attackPower).toBe(280);
  expect(boss.attackSpeed).toBe(0.95);
});
```

**Step 4: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts -t "boss data baseline"`

Expected: FAIL if runtime still has hardcoded values or drift from the data file.

**Step 5: Commit**

```bash
git add tests/server/combat/boss-raid-simulation.test.ts tests/server/combat/battle-simulator.test.ts
git commit -m "test: lock boss stat baseline"
```

---

### Task 2: Remove duplicated hardcoded boss stats from combat creation

**Files:**
- Modify: `src/server/combat/battle-simulator.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/data/mvp_phase1_units.json`
- Test: `tests/server/combat/battle-simulator.test.ts`
- Test: `tests/server/combat/boss-raid-simulation.test.ts`

**Step 1: Read boss data loading path**

Confirm how `src/shared/types.ts` exposes `loadMvpPhase1Boss()` and how `src/server/combat/battle-simulator.ts` currently hardcodes Remilia values.

**Step 2: Write the minimal failing integration expectation if needed**

If `battle-simulator.ts` cannot consume the JSON cleanly without a helper, first add a failing test that proves stat drift when JSON changes.

**Step 3: Write minimal implementation**

Replace the duplicated Remilia block in `src/server/combat/battle-simulator.ts` with a single-source lookup derived from `src/data/mvp_phase1_units.json`.

Implementation requirements:
- Do not keep a second independent literal copy of boss stats in `battle-simulator.ts`
- Keep creation synchronous for runtime callers
- Keep current non-boss and Scarlet Mansion unit behavior unchanged
- Preserve `isBoss && archetype === "remilia"` gating

One acceptable implementation shape:

```ts
import mvpPhase1Units from "../../data/mvp_phase1_units.json";

const MVP_PHASE1_BOSS = mvpPhase1Units.boss;
```

Then use `MVP_PHASE1_BOSS.hp`, `MVP_PHASE1_BOSS.attack`, etc. in the boss branch.

**Step 4: Run focused tests**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts tests/server/combat/boss-raid-simulation.test.ts`

Expected: PASS.

**Step 5: Refactor only if needed**

If there is duplication between JSON typing and runtime access, extract the smallest helper necessary. Avoid broad data-layer redesign.

**Step 6: Commit**

```bash
git add src/server/combat/battle-simulator.ts src/shared/types.ts src/data/mvp_phase1_units.json tests/server/combat/battle-simulator.test.ts tests/server/combat/boss-raid-simulation.test.ts
git commit -m "fix: source boss combat stats from shared data"
```

---

### Task 3: Re-baseline boss raid measurement tests

**Files:**
- Modify: `tests/server/combat/boss-raid-simulation.test.ts`
- Reference: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md:241`

**Step 1: Write the failing balance expectation**

Update the measurement suite comments and any explicit expectations so they describe the new intended baseline instead of the current overpowered boss assumption.

Prefer bounded assertions that reflect intended design, for example:

```ts
expect(overallBossWinRate).toBeGreaterThanOrEqual(0.4);
expect(overallBossWinRate).toBeLessThanOrEqual(0.8);
```

Only use these exact numbers if they are agreed by spec/product intent. If no target range exists yet, keep the tests as measurement-only and add a TODO in the plan summary instead of inventing a balance target.

**Step 2: Run the measurement test to verify RED or capture current value**

Run: `npx vitest run tests/server/combat/boss-raid-simulation.test.ts -t "総合ボス勝率"`

Expected:
- Either FAIL against the new desired range, or
- PASS as a measurement-only test while logging the new baseline

**Step 3: Apply the minimal stat adjustment needed**

Adjust only the finalized boss numbers in `src/data/mvp_phase1_units.json`.

Do not simultaneously change:
- raid unit base stats
- scarlet synergy values
- spell card values

**Step 4: Re-run the focused measurement suite**

Run: `npx vitest run tests/server/combat/boss-raid-simulation.test.ts`

Expected: PASS with logs matching the new intended baseline.

**Step 5: Commit**

```bash
git add src/data/mvp_phase1_units.json tests/server/combat/boss-raid-simulation.test.ts
git commit -m "balance: tune remilia boss baseline"
```

---

### Task 4: Sync spec and rollout docs to the new boss baseline

**Files:**
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/Phase2_Implementation_Plan.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md`
- Optional Modify: `docs/plans/full-game-simulation-test-design.md`

**Step 1: Update spec values**

Make `Game_Specification_Summary.md` reflect the finalized boss stats and remove stale `要調整` wording if this phase fully resolves it.

**Step 2: Update active plan status**

Mark the boss-stat tuning item as complete or moved, depending on whether the entire phase is done.

**Step 3: Update weekly plan if status drift exists**

If the active weekly plan still says Phase 2 P1 is in progress, add a brief status note or route readers to the current branch-level plan so the SoT does not drift further.

**Step 4: Verify doc consistency**

Read the updated sections and make sure:
- spec values match runtime data
- weekly/phase plans do not claim boss stats are still untouched

**Step 5: Commit**

```bash
git add 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/Phase2_Implementation_Plan.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md docs/plans/full-game-simulation-test-design.md
git commit -m "docs: sync boss tuning status"
```

---

### Task 5: Full verification and branch readiness check

**Files:**
- Verify: `tests/server/combat/boss-raid-simulation.test.ts`
- Verify: `tests/server/combat/battle-simulator.test.ts`
- Verify: `tests/server/boss-exclusive-shop.integration.test.ts`
- Verify: `tests/e2e/full-game/p1-features-integration.e2e.spec.ts`

**Step 1: Run focused combat + boss tests**

Run:

```bash
npx vitest run tests/server/combat/boss-raid-simulation.test.ts tests/server/combat/battle-simulator.test.ts tests/server/boss-exclusive-shop.integration.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts
```

Expected: PASS.

**Step 2: Run full verification**

Run:

```bash
npm run verify:ci
```

Expected: PASS.

**Step 3: Review diff before claiming completion**

Run:

```bash
git status --short
git diff --stat
```

Check that only boss-tuning and doc-sync changes are included.

**Step 4: Commit if verification-only fixes were needed**

If verification required any final small fix, create a new commit instead of amending older ones.

**Step 5: Completion note**

Record in the final handoff:
- finalized boss baseline
- measured boss win-rate range
- whether the spec now treats boss stats as aligned

---

## Risks to watch during execution

- `battle-simulator.ts` currently hardcodes boss stats, so partial refactors can leave drift between JSON/spec/runtime.
- `boss-raid-simulation.test.ts` is partly measurement-oriented; avoid turning it into fake certainty without an agreed target range.
- Boss shop behavior is adjacent but not part of this phase unless stat changes accidentally break Scarlet Mansion unit handling.
- `MVP_to_Production_Weekly_Execution_Plan.md` and `Phase2_Implementation_Plan.md` already show status drift; update carefully and explicitly.

## Verify Commands

```bash
npx vitest run tests/server/combat/boss-raid-simulation.test.ts
npx vitest run tests/server/combat/battle-simulator.test.ts
npx vitest run tests/server/boss-exclusive-shop.integration.test.ts
npx vitest run tests/e2e/full-game/p1-features-integration.e2e.spec.ts
npm run verify:ci
```
