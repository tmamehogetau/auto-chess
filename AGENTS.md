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

## Documentation Handling

- `docs/` is backed by an external docs workspace via symlink.
- You may read and update files under `docs/` when the task requires documentation work.
- Do not include `docs/` changes in repository commits unless the user explicitly asks for a docs-repo workflow.

## Browser Companion On This Windows Setup

- If the brainstorming/browser-companion helper server does not stay reachable on this Windows worktree, fall back to a plain static HTML flow.
- Put the generated companion screen under `.superpowers/brainstorm/<session>/`.
- Serve that directory with `node scripts/brainstorm-static-server.js <screen_dir> 54321 127.0.0.1`.
- If sandboxed localhost binding is blocked, rerun the server start with escalated permissions.
- Open `http://127.0.0.1:54321` in Playwright or the user's browser and use that URL for the review step.

## Done Criteria

- `npm run verify:ci` passes.
- Documentation changes stay under `docs/`.
- CI still runs `verify:ci`.
