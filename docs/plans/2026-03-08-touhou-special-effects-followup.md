# Touhou Special Effects Follow-up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finalize and implement the unresolved Touhou faction special effects and unresolved faction rows after numeric-only G2 metadata has been stabilized.

**Architecture:** Treat this as a follow-up phase after `docs/plans/2026-03-08-g2-faction-effect-tuning.md`. Freeze concrete values first in the matrix, then implement one effect family at a time with TDD so battle, shop, and skill systems consume explicit typed metadata rather than ad-hoc branching. Keep legacy MVP behavior and fully-off flags as hard regression boundaries throughout.

**Tech Stack:** TypeScript, Vitest, Colyseus, npm

---

### Task 1: Freeze unresolved faction rows and special-effect ownership in the matrix

**Files:**
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/touhou-faction-effect-matrix.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md`
- Modify: `docs/plans/feature-flag-design.md`

**Step 1: Fill the unresolved matrix rows**

For each unresolved row, replace `unresolved` with concrete values or explicit `n/a`:
- `shinreibyou`
- `niji_ryuudou`
- reflection
- shop cost reduction
- debuff immunity
- ultimate-specific modifiers

Use the current starter values unless they are superseded by a newer balance note:
- `chireiden`: reflection `10% / 20%`
- `myourenji`: shop cost reduction `0 / 1 / 1`
- `niji_ryuudou`: shop cost reduction `1 / 1`, tier2 first item/equip use draws 1
- `kanjuden`: tier1 ignores `crowd_control`, tier2 ignores `crowd_control + stat_down + dot`
- `shinreibyou`: ultimate damage `x1.10 / x1.20 / x1.35`, plus bonus damage vs debuffed targets `n/a / +12% / +18%`

Use this row shape:

```md
| factionId | thresholds | effectId | tier1 | tier2 | tier3 | effect family | runtime surface | primary hook | test target | status |
```

**Step 2: Record exact ownership**

For each effect family, document:
- owning faction
- tier threshold where it first activates
- exact numeric value or boolean rule
- exact runtime hook owner
- exact regression test owner

**Step 3: Update roadmap docs**

Make `feature-flag-design.md` and `touhou-units-migration-plan.md` point at the finalized matrix rows instead of generic follow-up language.

**Step 4: Review for execution readiness**

Check that no row targeted by this plan contains `unresolved`, `TBD`, or ambiguous natural-language-only behavior.

Expected: every planned row is code-ready.

### Task 2: Extend typed faction metadata for `shinreibyou` and `niji_ryuudou`

**Files:**
- Modify: `src/server/combat/synergy-definitions.ts`
- Test: `tests/server/combat/synergy-definitions.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
- `getTouhouFactionTierEffect("shinreibyou", tier)` returns finalized metadata for each active tier
- `getTouhouFactionTierEffect("niji_ryuudou", tier)` returns finalized metadata for each active tier
- unresolved-row fallback behavior is removed for those factions once values are frozen

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts`
Expected: FAIL because those faction rows still return `null` or incomplete metadata.

**Step 3: Write minimal implementation**

Extend the typed metadata so `shinreibyou` and `niji_ryuudou` are encoded alongside the existing numeric factions.

Rules:
- keep thresholds aligned with `TOUHOU_FACTION_THRESHOLDS`
- keep special-effect payloads explicit and typed
- do not apply behavior in runtime yet during this task

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/combat/synergy-definitions.ts tests/server/combat/synergy-definitions.test.ts 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/touhou-faction-effect-matrix.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md docs/plans/feature-flag-design.md
git commit -m "feat: define unresolved Touhou faction effect rows"
```

### Task 3: Add `chireiden` reflection in battle simulation

**Files:**
- Modify: `src/server/combat/battle-simulator.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
- `chireiden` reflection triggers only at the configured tier
- reflection uses the finalized value from the matrix
- reflected damage happens after normal mitigation is resolved
- reflection does not recurse into itself
- `enableTouhouFactions=false` disables the effect

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts`
Expected: FAIL because reflection is not implemented yet.

**Step 3: Write minimal implementation**

Implement one local reflection hook in the damage application path.

Rules:
- read effect metadata from the shared faction helper
- do not create a general reactive-effect framework
- keep the logic local to combat damage resolution

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/combat/battle-simulator.ts tests/server/combat/battle-simulator.test.ts
git commit -m "feat: add chireiden reflection hook"
```

### Task 4: Add `kanjuden` debuff immunity in battle/skill application

**Files:**
- Modify: `src/server/combat/battle-simulator.ts`
- Modify: `src/server/combat/skill-definitions.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`
- Test: `tests/server/combat/unit-effects.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
- covered debuffs are ignored for `kanjuden` units at the configured tier
- positive buffs still apply
- non-`kanjuden` units still receive the debuff normally
- `enableTouhouFactions=false` disables immunity

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts tests/server/combat/unit-effects.test.ts`
Expected: FAIL because debuff immunity is not implemented yet.

**Step 3: Write minimal implementation**

Add one explicit guard around the covered negative modifiers.

Rules:
- guard only the debuff types listed in the matrix
- keep immunity representation typed and local
- do not expand into a full status-effect engine

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/combat/battle-simulator.test.ts tests/server/combat/unit-effects.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/combat/battle-simulator.ts src/server/combat/skill-definitions.ts tests/server/combat/battle-simulator.test.ts tests/server/combat/unit-effects.test.ts
git commit -m "feat: add kanjuden debuff immunity"
```

### Task 5: Add `myourenji` and/or `niji_ryuudou` shop cost reduction

**Files:**
- Modify: `src/server/match-room-controller.ts`
- Modify: `src/server/match-room-controller/shop-offer-builder.ts`
- Test: `tests/server/match-room-controller.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
- the owning faction discount applies at the configured tier only
- cost floor is respected
- legacy MVP units do not inherit Touhou discounts
- `enableTouhouFactions=false` preserves current costs

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/match-room-controller.test.ts`
Expected: FAIL because shop cost reduction is not implemented yet.

**Step 3: Write minimal implementation**

Implement the discount at the last possible point before final gold subtraction, and only where the matrix says it belongs.

Rules:
- do not silently alter unrelated refresh/sell rules unless the matrix explicitly requires it
- keep purchase validation as the owner of final cost

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/match-room-controller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-room-controller.ts src/server/match-room-controller/shop-offer-builder.ts tests/server/match-room-controller.test.ts
git commit -m "feat: add Touhou shop cost reduction effects"
```

### Task 6: Add `shinreibyou` ultimate-specific modifiers

**Files:**
- Modify: `src/server/combat/skill-definitions.ts`
- Modify: `src/server/match-room-controller/spell-card-handler.ts`
- Modify: `src/server/combat/battle-simulator.ts`
- Test: `tests/server/combat/unit-effects.test.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`

**Step 1: Write the failing tests**

Add one focused test per finalized `shinreibyou` rule, covering:
- exact trigger point
- exact owning unit/spell path
- exact multiplier or bonus damage amount
- no activation when the faction tier is inactive

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/combat/unit-effects.test.ts tests/server/combat/battle-simulator.test.ts`
Expected: FAIL because the ultimate-specific modifiers are not wired yet.

**Step 3: Write minimal implementation**

Implement only the explicit `shinreibyou` hooks required by the matrix.

Rules:
- no generic scripting layer
- keep each modifier named and local to its owning execution path
- do not broaden scope to unrelated faction logic

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/combat/unit-effects.test.ts tests/server/combat/battle-simulator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/combat/skill-definitions.ts src/server/match-room-controller/spell-card-handler.ts src/server/combat/battle-simulator.ts tests/server/combat/unit-effects.test.ts tests/server/combat/battle-simulator.test.ts
git commit -m "feat: add shinreibyou ultimate modifiers"
```

### Task 7: Broaden regression coverage and update rollout docs

**Files:**
- Modify: `tests/server/game-room.feature-flag.integration.test.ts`
- Modify: `tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
- Modify: `docs/plans/feature-flag-design.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md`

**Step 1: Write the failing tests**

Add migration-level checks for:
- `true/true/false` with finalized special effects
- `true/true/true` with finalized special effects plus per-unit shared pool
- `false/false/false` preserving legacy MVP behavior

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/game-room.feature-flag.integration.test.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
Expected: FAIL because the rollout-level special-effect expectations are not covered yet.

**Step 3: Write minimal implementation/docs updates**

Update docs to record:
- which special-effect rows are now complete
- which rows remain deferred, if any
- rollout cautions for balance and PR review

**Step 4: Run focused verification**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts tests/server/combat/battle-simulator.test.ts tests/server/combat/unit-effects.test.ts tests/server/match-room-controller.test.ts tests/server/game-room.feature-flag.integration.test.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
Expected: PASS

**Step 5: Run full verification**

Run: `npm run verify:ci`
Expected: PASS

**Step 6: Commit**

```bash
git add tests/server/game-room.feature-flag.integration.test.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts docs/plans/feature-flag-design.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md
git commit -m "test: broaden Touhou special-effect regression coverage"
```

---

## Notes for execution

- Do not start runtime work until Task 1 removes all ambiguity from the matrix rows being implemented.
- Keep `.serena/project.yml` out of commits.
- If one effect family still lacks concrete values after Task 1, split that family into another follow-up plan instead of guessing.
- Before claiming completion, run `npm run verify:ci` fresh in the execution turn.
