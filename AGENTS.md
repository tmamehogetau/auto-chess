# Auto-Chess MVP - Agent Context

## Project Purpose
Auto-Chess MVP is a multiplayer auto-battler game built with Colyseus framework. It features real-time combat simulation, hero collection, and competitive gameplay mechanics.

## Key Directories
- `src/` - Core game logic, room definitions, and state management
- `tests/` - Unit and integration tests (using Vitest)
- `public/` - Static client assets
- `server.ts` - Main server entry point

## Documentation Structure

Documentation entry point is: `docs/`

`docs/` is the canonical path agents should read and write. It may be backed by a symbolic link, but documents should still reference `docs/` paths in prose and cross-links.

```
docs/
├─ index.md                          # Entry point hub
├─ specs/                            # Specifications & gate definitions
│  ├─ Game_Specification_Summary.md  # Game spec SoT
│  └─ MVP_SharedBoard_Battle_Gate_Tickets.md
├─ plans/                            # Implementation plans
│  ├─ active/                        # Current plans
│  │  ├─ MVP_to_Production_Weekly_Execution_Plan.md  # Overall SoT
│  │  ├─ 2026-03-14_Game_Productization_Roadmap.md
│  │  └─ 2026-03-21_W15_Regular_Operations_And_Backlog_Plan.md
│  └─ archive/                       # Completed/superseded plans
├─ tickets/                          # Execution tickets
│  ├─ active/
│  │  └─ README.md                   # No active ticket in steady-state operations
│  └─ archive/
├─ subplans/                         # Dependent detailed plans
│  └─ *.md
└─ reference/                        # Reference documents
   ├─ Documentation_Organization_Rules.md
   ├─ touhou-unit-master-data.md
   └─ *.md
```

### Single Source of Truth (SoT)

| Type | File | Purpose |
|------|------|---------|
| Spec | `specs/Game_Specification_Summary.md` | Game specifications |
| Overview | `plans/active/MVP_to_Production_Weekly_Execution_Plan.md` | 14-week execution plan |
| Current Ops | `plans/active/2026-03-21_W15_Regular_Operations_And_Backlog_Plan.md` | Current steady-state operations and backlog SoT |
| Ticket Status | `tickets/active/README.md` | Explains why `tickets/active` may be empty |

### Minimal Reading Set

For new agents or quick start, read these 3 files:
1. `index.md` - Project overview and navigation
2. `specs/Game_Specification_Summary.md` - What we're building
3. `plans/active/2026-03-21_W15_Regular_Operations_And_Backlog_Plan.md` - What to do now in steady-state operations

### Documentation Update Rules

- **Active documents**: Update when scope/plan changes
- **Archive policy**: Move to `archive/` when phase completes
- **Status header**: Add `> **Status**: Archived (Superseded by: <path>)` to archived docs
- **Cross-references**: Use relative paths between related documents
- **Index updates**: Always update `index.md` when structure changes

## Required Verify Command
```bash
npm run verify:ci
```

## Review Guidelines
- Prioritize regressions that change MVP behavior when `enableTouhouRoster=false`.
- Verify Touhou-only behavior stays gated behind `enableTouhouRoster`, `enableTouhouFactions`, and `enablePerUnitSharedPool`.
- Check that `unitId` propagates correctly through buy, bench, board, sell, and shared-pool return paths.
- Flag any mismatch between implemented Touhou faction effects and `docs/specs/touhou-faction-effect-matrix.md`.
- Treat data-loss, state-desync, and pool-inventory inconsistencies as high priority.

## Done Criteria
- All tests pass (`npm run test:run`)
- Type checking succeeds (`npm run typecheck`)
- Linting succeeds (`npm run lint`)
- CI workflow passes on push/pull request
- Documentation is properly organized under `docs/`

## Technology Stack
- Colyseus 0.17.x - Multiplayer game server framework
- TypeScript 5.9+ - Type-safe JavaScript
- Vitest 4.0.x - Testing framework
- Node 20+ - Runtime environment
