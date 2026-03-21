import type {
  BattleEndEvent,
  BattleKeyframeUnitState,
  BattleStartEvent,
  BattleStartUnitSnapshot,
  BattleTimelineBoardConfig,
  BattleTimelineEvent,
  BattleTimelineEventType,
  BattleTimelineSide,
  MoveEvent,
  AttackStartEvent,
  DamageAppliedEvent,
  UnitDeathEvent,
} from "../../shared/room-messages";

const BATTLE_TIMELINE_EVENT_TYPES = new Set<BattleTimelineEventType>([
  "battleStart",
  "move",
  "attackStart",
  "damageApplied",
  "unitDeath",
  "keyframe",
  "battleEnd",
]);

interface BattleScopedEventInput {
  battleId: string;
  atMs?: number;
}

interface BattleStartEventInput {
  battleId: string;
  round: number;
  boardConfig: BattleTimelineBoardConfig;
  units: BattleStartUnitSnapshot[];
}

interface KeyframeEventInput extends BattleScopedEventInput {
  units: BattleKeyframeUnitState[];
}

export function createBattleStartEvent(input: BattleStartEventInput): BattleStartEvent {
  return {
    type: "battleStart",
    battleId: input.battleId,
    round: input.round,
    boardConfig: input.boardConfig,
    units: input.units,
  };
}

export function createMoveEvent(input: MoveEvent): MoveEvent {
  return input;
}

export function createAttackStartEvent(input: AttackStartEvent): AttackStartEvent {
  return input;
}

export function createDamageAppliedEvent(input: DamageAppliedEvent): DamageAppliedEvent {
  return input;
}

export function createUnitDeathEvent(input: UnitDeathEvent): UnitDeathEvent {
  return input;
}

export function createKeyframeEvent(input: KeyframeEventInput): BattleTimelineEvent {
  return {
    type: "keyframe",
    battleId: input.battleId,
    atMs: input.atMs ?? 0,
    units: input.units,
  };
}

export function createBattleEndEvent(input: BattleEndEvent): BattleEndEvent {
  return input;
}

export function isBattleTimelineSide(value: unknown): value is BattleTimelineSide {
  return value === "boss" || value === "raid";
}

export function isBattleTimelineEvent(value: unknown): value is BattleTimelineEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const event = value as { type?: unknown; battleId?: unknown };
  return (
    typeof event.battleId === "string"
    && typeof event.type === "string"
    && BATTLE_TIMELINE_EVENT_TYPES.has(event.type as BattleTimelineEventType)
  );
}
