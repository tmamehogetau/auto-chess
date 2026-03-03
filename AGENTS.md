# Auto-Chess MVP - Agent Context

## Project Purpose
Auto-Chess MVP is a multiplayer auto-battler game built with Colyseus framework. It features real-time combat simulation, hero collection, and competitive gameplay mechanics.

## Key Directories
- `src/` - Core game logic, room definitions, and state management
- `tests/` - Unit and integration tests (using Vitest)
- `docs/` - Project documentation, ADRs, and test plans
- `public/` - Static client assets
- `server.ts` - Main server entry point

## Required Verify Command
```bash
npm run verify:ci
```

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
