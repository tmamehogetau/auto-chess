import type { BoardUnitPlacement } from "../shared/room-messages";

export function parsePlacementsSpec(spec: string): BoardUnitPlacement[];
export function parseAutoFlag(value: unknown): boolean;
export function parseAutoDelayMs(value: unknown): number;
