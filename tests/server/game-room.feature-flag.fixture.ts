type FeatureFlagCompletionFixtureName =
  | "全フラグOFF時: 4人でR8完走後にEndフェーズへ遷移する"
  | "全フラグON時: 4人でゲーム完走後Endフェーズへ遷移する";

interface FeatureFlagCompletionFixture {
  phase: "End";
  roundIndex?: number;
  playersSize: number;
  featureFlagsEnableHeroSystem: boolean;
  featureFlagsEnableSharedPool: boolean;
  featureFlagsEnablePhaseExpansion: boolean;
  featureFlagsEnableSubUnitSystem: boolean;
}

const FEATURE_FLAG_COMPLETION_FIXTURES: Record<
  FeatureFlagCompletionFixtureName,
  FeatureFlagCompletionFixture
> = {
  "全フラグOFF時: 4人でR8完走後にEndフェーズへ遷移する": {
    phase: "End",
    roundIndex: 8,
    playersSize: 4,
    featureFlagsEnableHeroSystem: false,
    featureFlagsEnableSharedPool: false,
    featureFlagsEnablePhaseExpansion: false,
    featureFlagsEnableSubUnitSystem: false,
  },
  "全フラグON時: 4人でゲーム完走後Endフェーズへ遷移する": {
    phase: "End",
    playersSize: 4,
    featureFlagsEnableHeroSystem: true,
    featureFlagsEnableSharedPool: true,
    featureFlagsEnablePhaseExpansion: true,
    featureFlagsEnableSubUnitSystem: true,
  },
};

export function getFeatureFlagCompletionFixture(
  name: string,
): FeatureFlagCompletionFixture {
  const fixture = FEATURE_FLAG_COMPLETION_FIXTURES[
    name as keyof typeof FEATURE_FLAG_COMPLETION_FIXTURES
  ];
  if (!fixture) {
    throw new Error(`Missing feature flag completion fixture: ${name}`);
  }
  return fixture;
}
