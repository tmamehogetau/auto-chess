import type { BoardUnitPlacement } from "../shared/room-messages";

export function parsePlacementsSpec(spec: string): BoardUnitPlacement[];
export function parseBoardUnitToken(token: unknown): BoardUnitPlacement | null;
export function parseAutoFlag(value: unknown): boolean;
export function parseAutoDelayMs(value: unknown): number;
export function parseAutoFillBots(value: unknown): number;
