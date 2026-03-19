# Auto-Chess MVP Agent Guide

## Project Purpose

Auto-Chess MVP is a Colyseus-based multiplayer auto-battler focused on shared-board play, hero collection, and release-slice hardening.

## Project Map

- `src/` - game logic, rooms, and state
- `tests/` - unit and integration coverage
- `docs/README.md` - required docs entry point
- `docs/index.md` - full documentation map and active document routing

## Minimal Reading Set

- `docs/README.md`
- `docs/index.md`
- `docs/plans/active/2026-03-15_Current_Execution_Dashboard.md`
- `docs/specs/Game_Specification_Summary.md`

## Required Verify Command

```bash
npm run verify:ci
```

## Local Fast Gate

```bash
npx lefthook run pre-commit
```

## Review Focus

- Prioritize regressions when `enableTouhouRoster=false`.
- Keep Touhou-only behavior gated behind the existing feature flags.
- Treat `unitId` propagation, pool inventory, and shared-board state consistency as high risk.

## Done Criteria

- `npm run verify:ci` passes.
- Documentation changes stay under `docs/`.
- CI still runs `verify:ci`.
