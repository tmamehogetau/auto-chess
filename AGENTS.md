# Auto-Chess MVP - Agent Context

## Project Purpose
Auto-Chess MVP is a multiplayer auto-battler game built with Colyseus framework. It features real-time combat simulation, hero collection, and competitive gameplay mechanics.

## Key Directories
- `src/` - Core game logic, room definitions, and state management
- `tests/` - Unit and integration tests (using Vitest)
- `public/` - Static client assets
- `server.ts` - Main server entry point

## Documentation Structure

Documentation is stored in: `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/`

```
auto-chess-mvp_Docs/
├─ index.md                          # Entry point hub
├─ specs/                            # Specifications & gate definitions
│  ├─ Game_Specification_Summary.md  # Game spec SoT
│  └─ MVP_SharedBoard_Battle_Gate_Tickets.md
├─ plans/                            # Implementation plans
│  ├─ active/                        # Current plans
│  │  ├─ MVP_to_Production_Weekly_Execution_Plan.md  # Overall SoT
│  │  └─ Phase2_Implementation_Plan.md
│  └─ archive/                       # Completed/superseded plans
├─ tickets/                          # Execution tickets
│  ├─ active/
│  │  └─ W1_Execution_Tickets.md     # Weekly task SoT
│  └─ archive/
├─ subplans/                         # Dependent detailed plans
│  └─ Phase2_Sub_Unit_Implementation_Plan.md
└─ reference/                        # Reference documents
   ├─ Documentation_Organization_Rules.md
   └─ touhou-units-migration-plan.md
```

### Single Source of Truth (SoT)

| Type | File | Purpose |
|------|------|---------|
| Spec | `specs/Game_Specification_Summary.md` | Game specifications |
| Overview | `plans/active/MVP_to_Production_Weekly_Execution_Plan.md` | 14-week execution plan |
| Tasks | `tickets/active/W1_Execution_Tickets.md` | Current week tasks |

### Minimal Reading Set

For new agents or quick start, read these 3 files:
1. `index.md` - Project overview and navigation
2. `specs/Game_Specification_Summary.md` - What we're building
3. `tickets/active/W1_Execution_Tickets.md` - What to do now

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
- Flag any mismatch between implemented Touhou faction effects and `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/specs/touhou-faction-effect-matrix.md`.
- Treat data-loss, state-desync, and pool-inventory inconsistencies as high priority.

## Done Criteria
- All tests pass (`npm run test:run`)
- Type checking succeeds (`npm run typecheck`)
- Linting succeeds (`npm run lint`)
- CI workflow passes on push/pull request
- Documentation is properly organized under `00_Obsidian_Vault/Projects/auto-chess-mvp_Docs/`

## Technology Stack
- Colyseus 0.17.x - Multiplayer game server framework
- TypeScript 5.9+ - Type-safe JavaScript
- Vitest 4.0.x - Testing framework
- Node 20+ - Runtime environment
