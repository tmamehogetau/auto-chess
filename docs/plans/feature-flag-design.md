# Feature Flag Design

## Overview
Environment variable-based feature flag system for Phase2 features.

## Architecture

### Type Definition
Located at: `src/shared/feature-flags.ts`

```typescript
export interface FeatureFlags {
  enableHeroSystem: boolean;
  enableSharedPool: boolean;
  enablePhaseExpansion: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  enableHeroSystem: false,
  enableSharedPool: false,
  enablePhaseExpansion: false,
};
```

### Service Layer
Located at: `src/server/feature-flag-service.ts`

Responsibilities:
- Load feature flags from environment variables
- Override default flags with environment variable values
- Provide consistent API for flag access

Environment Variable Naming:
- Prefix: `FEATURE_`
- Pattern: `FEATURE_<UPPER_SNAKE_CASE_FLAG_NAME>`
- Example: `FEATURE_ENABLE_HERO_SYSTEM=true`

### Client Delivery
Modified files:
- `src/server/schema/match-room-state.ts`: Add `featureFlags` field
- `src/server/rooms/game-room.ts`: Set feature flags on room creation

Flow:
1. Feature flag service loads flags on server startup
2. `GameRoom.onCreate` loads flags via service
3. `MatchRoomState` stores flags for client sync
4. Client receives flags via Colyseus schema sync

## Flag Definitions

### enableHeroSystem
- **Purpose**: Enable hero unit system
- **Default**: false
- **Env Var**: `FEATURE_ENABLE_HERO_SYSTEM`

### enableSharedPool
- **Purpose**: Enable shared pool for unit rarity
- **Default**: false
- **Env Var**: `FEATURE_ENABLE_SHARED_POOL`

### enablePhaseExpansion
- **Purpose**: Enable Phase 2 phase expansion
- **Default**: false
- **Env Var**: `FEATURE_ENABLE_PHASE_EXPANSION`

## Usage Examples

### Server-side
```typescript
import { FeatureFlagService } from './feature-flag-service';

const service = FeatureFlagService.getInstance();
if (service.getFlags().enableHeroSystem) {
  // Hero system logic
}
```

### Client-side
```typescript
// Access from room state
if (room.state.featureFlags?.enableHeroSystem) {
  // Show hero UI
}
```

## Testing
Integration tests verify:
- Default flag values are applied
- Environment variables override defaults
- Client receives correct flags on join
- Flag changes trigger proper schema updates
