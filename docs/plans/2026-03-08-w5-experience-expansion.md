# W5 Experience Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the W5 experience-expansion slice so spell cards, rumor influence, boss exclusive shop, and the fixed-pair sub-unit path all work together in real matches without regressing the MVP-safe `enableTouhouRoster=false` baseline.

**Architecture:** Keep W5 as a thin gameplay-layer expansion on top of the already-stabilized Phase2 core. Prefer extending existing handlers (`SpellCardHandler`, `ShopOfferBuilder`, `BattleResolutionService`, `player-state-sync`) over introducing new subsystems. Every feature must stay gated behind its existing flag and must keep OFF-path behavior identical to current MVP.

**Tech Stack:** TypeScript, Vitest, Colyseus, npm, Markdown

---

### Task 1: Lock spell-card minimum gameplay as a match-safe vertical slice

**Files:**
- Modify: `src/server/match-room-controller/spell-card-handler.ts`
- Modify: `src/server/match-room-controller.ts`
- Modify: `src/server/rooms/game-room.ts`
- Test: `tests/server/spell-card.integration.test.ts`
- Test: `tests/server/match-room-controller/spell-card-handler.test.ts`
- Test: `tests/e2e/full-game/p1-features-integration.e2e.spec.ts`

**Step 1: Write the failing test**

Add tests that verify:
- `declaredSpellId` is set for the correct round band and cleared when the feature flag is off
- pre-battle `buff/debuff` modifiers change combat modifiers only for the intended target side
- used spell IDs are synced back to room state after effect application

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/spell-card.integration.test.ts tests/server/match-room-controller/spell-card-handler.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts`
Expected: FAIL because at least one state-sync or round-band assertion is still incomplete.

**Step 3: Write minimal implementation**

Make the smallest change so that:
- spell declaration remains round-band deterministic
- `applyPreBattleSpellEffect()` and `applySpellEffect()` update only the intended state paths
- `GameRoom` continues syncing `declaredSpellId` and `usedSpellIds` from controller state after transitions

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/spell-card.integration.test.ts tests/server/match-room-controller/spell-card-handler.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-room-controller/spell-card-handler.ts src/server/match-room-controller.ts src/server/rooms/game-room.ts tests/server/spell-card.integration.test.ts tests/server/match-room-controller/spell-card-handler.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts
git commit -m "feat: stabilize spell card match flow"
```

### Task 2: Lock rumor-influence next-round offer injection and state/log sync

**Files:**
- Modify: `src/server/match-room-controller/shop-offer-builder.ts`
- Modify: `src/server/match-room-controller.ts`
- Modify: `src/server/rooms/game-room/player-state-sync.ts`
- Test: `tests/server/rumor-influence.integration.test.ts`
- Test: `tests/server/match-room-controller/shop-offer-builder.test.ts`
- Test: `tests/server/game-room/player-state-sync.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- rumor-eligible players receive exactly one guaranteed rumor offer on the next Prep when the feature flag is on
- `isRumorEligible` resets after the guaranteed slot is consumed
- round logs keep `rumorFactions` and `guaranteedRumorSlotApplied` aligned with actual offer generation

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/rumor-influence.integration.test.ts tests/server/match-room-controller/shop-offer-builder.test.ts tests/server/game-room/player-state-sync.test.ts`
Expected: FAIL because at least one eligibility reset or state-sync assertion is missing.

**Step 3: Write minimal implementation**

Patch only the current rumor path so that:
- the guaranteed rumor offer remains single-slot and deterministic
- player state sync exposes the same eligibility/result state the controller now owns
- OFF-path remains unchanged when `enableRumorInfluence=false`

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/rumor-influence.integration.test.ts tests/server/match-room-controller/shop-offer-builder.test.ts tests/server/game-room/player-state-sync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-room-controller/shop-offer-builder.ts src/server/match-room-controller.ts src/server/rooms/game-room/player-state-sync.ts tests/server/rumor-influence.integration.test.ts tests/server/match-room-controller/shop-offer-builder.test.ts tests/server/game-room/player-state-sync.test.ts
git commit -m "feat: lock rumor influence next-round offers"
```

### Task 3: Finish boss exclusive shop as a boss-only purchase lane

**Files:**
- Modify: `src/server/match-room-controller.ts`
- Modify: `src/server/match-room-controller/prep-command-executor.ts`
- Modify: `src/server/match-room-controller/prep-command-validator.ts`
- Modify: `src/server/rooms/game-room/player-state-sync.ts`
- Test: `tests/server/boss-exclusive-shop.integration.test.ts`
- Test: `tests/server/match-room-controller/prep-command-executor.test.ts`
- Test: `tests/server/match-room-controller/prep-command-validator.test.ts`
- Test: `tests/e2e/full-game/p1-features-integration.e2e.spec.ts`

**Step 1: Write the failing test**

Add tests that verify:
- only the boss player gets `bossShopOffers`
- boss-shop purchases validate against the boss-only lane and spend the expected gold
- state sync keeps `bossShopOffers` isolated from the regular shop lane

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/boss-exclusive-shop.integration.test.ts tests/server/match-room-controller/prep-command-executor.test.ts tests/server/match-room-controller/prep-command-validator.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts`
Expected: FAIL because one of the boss-only purchase assertions is incomplete.

**Step 3: Write minimal implementation**

Adjust the current purchase path so that:
- boss-only offers stay in the dedicated lane
- validator/executor agree on which slot space they are validating
- player-state sync reflects the updated boss shop after purchase/refresh

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/boss-exclusive-shop.integration.test.ts tests/server/match-room-controller/prep-command-executor.test.ts tests/server/match-room-controller/prep-command-validator.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/match-room-controller.ts src/server/match-room-controller/prep-command-executor.ts src/server/match-room-controller/prep-command-validator.ts src/server/rooms/game-room/player-state-sync.ts tests/server/boss-exclusive-shop.integration.test.ts tests/server/match-room-controller/prep-command-executor.test.ts tests/server/match-room-controller/prep-command-validator.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts
git commit -m "feat: complete boss exclusive shop lane"
```

### Task 4: Promote the fixed-pair sub-unit path from assist data to match-visible behavior

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/match-room-controller.ts`
- Modify: `src/server/match-room-controller/battle-resolution.ts`
- Modify: `src/server/combat/battle-simulator.ts`
- Test: `tests/server/sub-unit-system.integration.test.ts`
- Test: `tests/server/match-room-controller/battle-resolution.test.ts`
- Test: `tests/server/combat/battle-simulator.test.ts`
- Test: `tests/e2e/full-game/sub-unit-system.e2e.spec.ts`

**Step 1: Write the failing test**

Add tests that verify:
- a supported fixed pair receives the configured assist bonus only when `enableSubUnitSystem=true`
- the assist token/marker exposed through controller state matches the combat assist application
- OFF-path keeps the existing MVP token/state behavior unchanged

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/sub-unit-system.integration.test.ts tests/server/match-room-controller/battle-resolution.test.ts tests/server/combat/battle-simulator.test.ts tests/e2e/full-game/sub-unit-system.e2e.spec.ts`
Expected: FAIL because one of the fixed-pair combat or exposed-state assertions is still incomplete.

**Step 3: Write minimal implementation**

Keep this to the existing assist-mode architecture:
- validate one fixed pair only
- reuse `subUnitAssistConfigByType`
- keep OFF-path and unsupported pair behavior unchanged

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/sub-unit-system.integration.test.ts tests/server/match-room-controller/battle-resolution.test.ts tests/server/combat/battle-simulator.test.ts tests/e2e/full-game/sub-unit-system.e2e.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types.ts src/server/match-room-controller.ts src/server/match-room-controller/battle-resolution.ts src/server/combat/battle-simulator.ts tests/server/sub-unit-system.integration.test.ts tests/server/match-room-controller/battle-resolution.test.ts tests/server/combat/battle-simulator.test.ts tests/e2e/full-game/sub-unit-system.e2e.spec.ts
git commit -m "feat: finish fixed-pair sub unit assist flow"
```

### Task 5: Sync docs and run W5 integrated verification

**Files:**
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md`
- Modify: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md`
- Modify: `docs/plans/2026-03-08-w5-experience-expansion.md`

**Step 1: Write the failing documentation checklist**

Create a short checklist before editing:
- mark each W5 feature as `部分実装` or `完了` based on actual shipped state
- keep `enableTouhouRoster=false` compatibility called out explicitly
- record any deferred item that misses the W5 minimum slice

**Step 2: Update docs minimally**

Sync docs so they reflect the actual W5 exit state:
- weekly plan marks W5 as active or complete depending on execution status
- spec summary reflects shipped spell/rumor/boss shop/sub-unit scope accurately
- the W5 plan records verification evidence and any deferred follow-up

**Step 3: Run integrated verification**

Run: `npx vitest run tests/server/spell-card.integration.test.ts tests/server/rumor-influence.integration.test.ts tests/server/boss-exclusive-shop.integration.test.ts tests/server/sub-unit-system.integration.test.ts tests/e2e/full-game/p1-features-integration.e2e.spec.ts tests/e2e/full-game/sub-unit-system.e2e.spec.ts tests/e2e/full-game/full-game-with-phase2-features.e2e.spec.ts`
Expected: PASS

Run: `npm run verify:ci`
Expected: PASS

Run: `npm run test:coverage`
Expected: PASS

**Step 4: Commit**

```bash
git add 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/Game_Specification_Summary.md 00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/plans/active/MVP_to_Production_Weekly_Execution_Plan.md docs/plans/2026-03-08-w5-experience-expansion.md
git commit -m "docs: sync W5 experience expansion status"
```
