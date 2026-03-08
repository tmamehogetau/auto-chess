# Touhou Faction Runtime Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire Touhou faction data into the active runtime path behind `enableTouhouFactions` without breaking MVP behavior or the already-active Touhou roster switch.

**Architecture:** Keep existing MVP class synergies and Scarlet Mansion behavior unchanged. Add a small faction-metadata path from roster provider -> resolved board placements -> shared synergy calculation, then expose Touhou faction tiers in runtime/player-status only when `enableTouhouFactions=true`. Do not invent final combat effect numbers yet; faction combat effects stay deferred until G2 effect parameters are agreed.

**Tech Stack:** TypeScript, Vitest, Colyseus, npm

---

### Task 1: Carry Touhou faction metadata through runtime placements

**Files:**
- Modify: `src/shared/room-messages.ts`
- Modify: `src/server/roster/roster-provider.ts`
- Modify: `src/server/unit-id-resolver.ts`
- Test: `tests/server/game-room.feature-flag.integration.test.ts`
- Test: `tests/server/roster/roster-provider.test.ts`

**Step 1: Write the failing tests**

Add tests that cover:
- `getTouhouDraftRosterUnits()` exposing `factionId` for factioned Touhou units and `null` for `zanmu`
- `resolveBattlePlacement()` preserving MVP behavior with `enableTouhouRoster=false`
- `resolveBattlePlacement()` attaching `factionId` when resolving Touhou `unitId` values with `enableTouhouRoster=true`

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/roster/roster-provider.test.ts tests/server/game-room.feature-flag.integration.test.ts`
Expected: FAIL because runtime placement metadata does not expose faction data yet.

**Step 3: Write the minimal implementation**

Implement only:
- optional `factionId` on `BoardUnitPlacement`
- optional `factionId` on `RosterUnit`
- roster provider mapping from `src/data/touhou-units.ts`
- unit-id resolver propagation of `factionId` into resolved placements

Implementation rules:
- keep existing MVP placements byte-for-byte compatible when Touhou flags are off
- do not change scarlet/archetype behavior
- do not add per-unit shared-pool logic

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/roster/roster-provider.test.ts tests/server/game-room.feature-flag.integration.test.ts`
Expected: PASS

### Task 2: Add shared Touhou faction tier calculation behind the flag

**Files:**
- Modify: `src/server/combat/synergy-definitions.ts`
- Test: `tests/server/combat/synergy-definitions.test.ts`

**Step 1: Write the failing tests**

Add focused tests for:
- thresholds `chireiden [2,4]`, `myourenji [2,3,5]`, `grassroot_network [2,3]`
- `enableTouhouFactions=false` returning no Touhou faction activations
- `enableTouhouFactions=true` counting only placement `factionId`, not all unit types
- `heroSynergyBonusType` still affecting only legacy unit-type synergies

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts`
Expected: FAIL because Touhou faction threshold calculation does not exist yet.

**Step 3: Write the minimal implementation**

Add a shared calculation boundary that returns:
- existing unit-type counts/tiers
- optional Touhou faction counts/tiers when enabled

Implementation rules:
- reuse current unit-type synergy behavior unchanged
- encode only faction thresholds for now, not final combat-effect numbers
- keep Scarlet Mansion as its separate special-case path

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/combat/synergy-definitions.test.ts`
Expected: PASS

### Task 3: Surface Touhou faction synergies in controller runtime state

**Files:**
- Modify: `src/server/match-room-controller.ts`
- Modify: `src/server/types/player-state-types.ts`
- Modify: `src/shared/room-messages.ts`
- Test: `tests/server/hero-system.integration.test.ts`

**Step 1: Write the failing tests**

Add tests that cover:
- `enableTouhouFactions=false` keeps current `activeSynergies` output unchanged
- `enableTouhouRoster=true` and `enableTouhouFactions=true` surfaces Touhou faction entries in `getPlayerStatus()`
- mixed Touhou board still reports legacy class synergies and Touhou faction synergies together
- `zanmu` remains excluded from faction activations

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/hero-system.integration.test.ts`
Expected: FAIL because controller status does not report Touhou factions yet.

**Step 3: Write the minimal implementation**

Replace duplicated controller-side counting with the shared synergy calculation from Task 2.

Implementation rules:
- gate Touhou faction entries strictly on `enableTouhouFactions`
- keep `unitType` string field for backward compatibility; faction ids can reuse that field value
- keep logging format unchanged except for new faction ids appearing as `synergyType`

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/hero-system.integration.test.ts tests/server/game-room.feature-flag.integration.test.ts`
Expected: PASS

### Task 4: Document the runtime boundary and verify full safety

**Files:**
- Modify: `docs/plans/feature-flag-design.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/reference/touhou-units-migration-plan.md`

**Step 1: Update docs**

Document:
- `enableTouhouFactions=true` now enables faction metadata/tier calculation on the active runtime path
- current scope is tier activation and state reporting, not final faction combat effects
- G2 numeric combat-effect tuning remains follow-up work

**Step 2: Run focused verification**

Run: `npx vitest run tests/server/roster/roster-provider.test.ts tests/server/combat/synergy-definitions.test.ts tests/server/hero-system.integration.test.ts tests/server/game-room.feature-flag.integration.test.ts`
Expected: PASS

**Step 3: Run full verification**

Run: `npm run verify:ci`
Expected: PASS

---

## Notes for execution

- Preferred minimal path: faction runtime wiring first, no combat-stat tuning yet.
- If tests show battle simulation already depends on the old duplicated controller counting, factor the shared calculation once instead of patching two codepaths independently.
- Treat `.serena/project.yml` as local noise and keep it out of commits.
