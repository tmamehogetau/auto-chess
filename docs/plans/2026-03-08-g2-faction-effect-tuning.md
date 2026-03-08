# G2 Faction Effect Tuning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finalize the currently defined Touhou numeric faction effect definitions behind the existing migration flags without breaking legacy MVP behavior, while explicitly deferring unresolved special-effect work.

**Architecture:** Keep the current flag gates and runtime metadata path intact. First lock the faction-effect matrix in code-facing docs, then finalize only the numeric faction rows that already have concrete values in repo docs/code: `chireiden`, `myourenji`, `grassroot_network`, and `kanjuden`. Treat special effects and unresolved factions as a follow-up plan once concrete values are decided, and keep legacy MVP synergies and fully-off flag behavior as regression boundaries on every step.

**Tech Stack:** TypeScript, Vitest, Colyseus, npm

---

### Task 1: Freeze the G2 faction effect matrix before code changes

**Files:**
- Modify: `docs/plans/feature-flag-design.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md`
- Create: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/touhou-faction-effect-matrix.md`

**Step 1: Write the matrix doc skeleton**

Create `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/touhou-faction-effect-matrix.md` with one table row per faction:

```md
| factionId | thresholds | effectId | tier1 | tier2 | tier3 | runtime surface | combat/shop hook |
|-----------|------------|----------|-------|-------|-------|-----------------|------------------|
| chireiden | [2,4] | faction.chireiden | ... | ... | n/a | activeSynergies + battle | battle-simulator |
```

**Step 2: Fill the matrix with current known behavior and open questions**

Document for each faction:
- exact threshold array from `src/server/combat/synergy-definitions.ts`
- current provisional numeric behavior if it already exists
- whether the effect is numeric, reactive, shop-phase, debuff-related, or ultimate-specific
- exact unresolved values that must be confirmed before implementation

**Step 3: Update the roadmap docs to point at the matrix**

Add references in:
- `docs/plans/feature-flag-design.md`
- `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md`

State explicitly:
- G2 execution starts only after the matrix rows are filled with concrete values
- legacy MVP path stays unchanged behind `false/false/false`

**Step 4: Review the doc for execution readiness**

Check that every faction has:
- an `effectId`
- tier-by-tier values or explicit `n/a`
- one owning runtime hook
- one owning test target

Expected: no `TBD` remains in rows that will be implemented in this branch.

Scope note for this branch:
- implement now: `chireiden`, `myourenji`, `grassroot_network`, `kanjuden`
- defer: `shinreibyou`, `niji_ryuudou`
- defer: reflection / shop cost reduction / debuff immunity / ultimate-specific modifiers until concrete values are agreed

### Task 2: Convert faction definitions to typed effect metadata

**Files:**
- Modify: `src/server/combat/synergy-definitions.ts`
- Test: `tests/server/combat/synergy-definitions.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
- every Touhou faction definition exposes a stable `effectId`
- each tier resolves the finalized numeric metadata from the matrix doc
- `enableTouhouFactions=false` still returns no Touhou faction activations
- legacy non-Touhou synergy definitions stay unchanged

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts`
Expected: FAIL because finalized effect ids / tier payloads are not encoded yet.

**Step 3: Write minimal implementation**

Implement typed faction effect definitions in `src/server/combat/synergy-definitions.ts`.

Shape to introduce:

```ts
type TouhouFactionEffectId =
  | 'faction.chireiden'
  | 'faction.myourenji'
  | 'faction.shinreibyou'
  | 'faction.grassroot_network'
  | 'faction.niji_ryuudou'
  | 'faction.kanjuden';

type TouhouFactionTierEffect = {
  effectId: TouhouFactionEffectId;
  statModifiers?: {
    hpMultiplier?: number;
    attackPower?: number;
    attackSpeedMultiplier?: number;
    defense?: number;
  };
  special?: {
    reflectRatio?: number;
    shopCostReduction?: number;
    debuffImmune?: boolean;
    ultimateModifier?: string;
  };
};
```

Implementation rules:
- keep thresholds exactly as they are today unless the matrix explicitly changes them
- keep Scarlet Mansion handling separate
- do not apply any effect yet outside the codepaths covered by the current task

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/feature-flag-design.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/touhou-faction-effect-matrix.md src/server/combat/synergy-definitions.ts tests/server/combat/synergy-definitions.test.ts
git commit -m "feat: define finalized Touhou faction effect metadata"
```

### Task 3: Verify numeric faction tuning coverage in battle simulation

**Files:**
- Modify: `src/server/combat/battle-simulator.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`

**Step 1: Review existing battle tests against the scoped 4 factions**

Confirm focused tests exist for:
- one faction that grants flat attack / defense
- one faction that grants hp multiplier
- `enableTouhouFactions=false` preserving current battle stats
- Touhou faction buffs applying only to units with matching `factionId`

Use concrete board placements with `unitId`, `factionId`, `hp`, `attack`, `attackSpeed`, and `range` so the review proves the runtime Touhou path instead of legacy defaults.

Note: do not invent an `attackSpeedMultiplier` faction for this branch because none of the scoped 4 factions currently define it.

**Step 2: Run battle tests to verify current coverage still passes**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts`
Expected: PASS because the scoped numeric faction buffs are already applied in battle.

**Step 3: Add one missing regression test only if a scoped faction lacks coverage**

If coverage is already sufficient, make no runtime code change in this task.

Implementation rules:
- reuse the existing synergy calculation entrypoint
- do not add special-effect behavior in this task
- keep boss / Scarlet Mansion / legacy synergy behavior unchanged

**Step 4: Re-run battle tests**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts`
Expected: PASS

**Step 5: Commit if any test was added**

```bash
git add src/server/combat/battle-simulator.ts tests/server/combat/battle-simulator.test.ts
git commit -m "feat: apply finalized numeric Touhou faction tuning"
```

### Task 4: Defer unresolved special effects and split follow-up scope

**Files:**
- Modify: `src/server/combat/battle-simulator.ts`
- Modify: `src/server/combat/skill-definitions.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`

**Step 1: Update the matrix and roadmap docs**

Record explicitly that the following remain blocked on concrete values:
- reflection
- shop cost reduction
- debuff immunity
- ultimate-specific modifiers
- `shinreibyou` / `niji_ryuudou` finalized faction rows

**Step 2: Remove implementation claims from this branch scope**

Do not add runtime code or tests for these effects in this branch.

**Step 3: Create a clean handoff note for the next plan**

Write down what must be decided next:
- owning faction per special effect
- tier-by-tier values
- runtime hook owner
- regression test owner

### Task 5: Add shop-phase cost reduction support

**Files:**
- Modify: `src/server/match-room-controller.ts`
- Test: `tests/server/match-room-controller.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
- faction-provided shop cost reduction lowers the purchase cost for eligible Touhou units
- gold never goes below zero and cost never drops below the floor defined in the matrix
- `enableTouhouFactions=false` keeps current shop costs unchanged
- legacy MVP units do not accidentally inherit Touhou reductions

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/match-room-controller.test.ts`
Expected: FAIL because the buy path does not consume faction special metadata yet.

**Step 3: Write minimal implementation**

Implement cost reduction only in the buy path that already owns final purchase validation.

Rules:
- read active faction tiers from the same shared synergy calculation used for player status
- apply reduction at the last possible point before gold subtraction
- keep refresh cost and sell value unchanged unless the matrix explicitly requires otherwise

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/match-room-controller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-room-controller.ts tests/server/match-room-controller.test.ts
git commit -m "feat: apply Touhou faction shop cost reductions"
```

### Task 6: Add ultimate-specific faction modifiers through skill execution

**Files:**
- Modify: `src/server/combat/skill-definitions.ts`
- Modify: `src/server/combat/battle-simulator.ts`
- Test: `tests/server/combat/unit-effects.test.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`

**Step 1: Write the failing tests**

Add one focused test per ultimate-specific rule from the matrix, covering:
- the exact owning hero / unit
- the exact trigger point
- the exact stat or behavior change
- no activation when the relevant faction tier is inactive

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/unit-effects.test.ts tests/server/combat/battle-simulator.test.ts`
Expected: FAIL because ultimate-specific faction modifiers are not wired yet.

**Step 3: Write minimal implementation**

Implement a small hook from resolved faction effect metadata into the specific skill execution points that need it.

Rules:
- do not create a generic scripting system
- keep each ultimate-specific modifier explicit and named
- only touch the units/factions listed in the matrix

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/combat/unit-effects.test.ts tests/server/combat/battle-simulator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/combat/skill-definitions.ts src/server/combat/battle-simulator.ts tests/server/combat/unit-effects.test.ts tests/server/combat/battle-simulator.test.ts
git commit -m "feat: wire Touhou ultimate-specific faction modifiers"
```

### Task 7: Broaden migration verification and update rollout docs

**Files:**
- Modify: `tests/server/game-room.feature-flag.integration.test.ts`
- Modify: `tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
- Modify: `docs/plans/feature-flag-design.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md`

**Step 1: Write the failing tests**

Add migration-level checks for:
- `true/true/false` with finalized faction combat behavior
- `true/true/true` with faction behavior plus per-unit shared pool still intact
- fully-off flags preserving legacy MVP outcomes

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/game-room.feature-flag.integration.test.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
Expected: FAIL because rollout-level expectations are not yet covered.

**Step 3: Write minimal implementation/docs updates**

Update docs to record:
- which G2 rows are now complete
- which effects remain explicitly deferred, if any
- rollout cautions for gameplay balance and PR review

Do not change runtime code in this step unless the new regression tests expose a real gap.

**Step 4: Run focused verification**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts tests/server/combat/battle-simulator.test.ts tests/server/combat/unit-effects.test.ts tests/server/match-room-controller.test.ts tests/server/game-room.feature-flag.integration.test.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
Expected: PASS

**Step 5: Run full verification**

Run: `npm run verify:ci`
Expected: PASS

**Step 6: Commit**

```bash
git add tests/server/game-room.feature-flag.integration.test.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts docs/plans/feature-flag-design.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md
git commit -m "test: broaden Touhou migration verification"
```

---

## Notes for execution

- If a later task depends on a row or effect without concrete values, stop there and split a follow-up plan instead of guessing.
- Keep `.serena/project.yml` out of commits.
- If any special effect turns out to need cross-system design beyond the current code boundaries, write the failing test, confirm the boundary problem, then stop and split a new plan instead of improvising a framework.
- Before claiming completion, run `npm run verify:ci` fresh in the execution turn.
