export interface AudioCueTone {
  waveform: OscillatorType;
  startFrequency: number;
  endFrequency: number;
  durationMs: number;
  volume: number;
  startAt: number;
}

export type AudioCueKind =
  | "confirm"
  | "purchase"
  | "battle-start"
  | "victory"
  | "defeat";

export function buildCuePlan(kind: AudioCueKind): AudioCueTone[];
export function playUiCue(kind: AudioCueKind): boolean;
