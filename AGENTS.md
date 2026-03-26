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

## Local Play Startup On This Windows Setup

- `npm run server` may fail inside the sandbox with `Error: spawn EPERM` because `tsx`/`esbuild` spawns a child process.
- When that happens, rerun the game server with Administrator privileges on Windows. This bypasses sandbox protections, so use it only in trusted local development and never in production.
- Prefer launching the game server through `cmd.exe` so temporary env vars stick reliably on this setup:
  - `cmd.exe /c "set PORT=2568 && npm.cmd run server"`
- Prefer launching the static client check server the same way:
  - `cmd.exe /c "set CLIENT_CHECK_PORT=8081 && npm.cmd run client:check"`
- Use `http://localhost:8081/src/client/index.html?endpoint=ws://localhost:2568&setId=set2` for operator checks.
- Use `http://localhost:8081/src/client/player.html?endpoint=ws://localhost:2568` for player checks.
- If both servers are already running, reuse them instead of starting duplicate processes.

## Done Criteria

- `npm run verify:ci` passes.
- Documentation changes stay under `docs/`.
- CI still runs `verify:ci`.
