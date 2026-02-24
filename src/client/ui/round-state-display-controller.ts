export interface SetIdDisplaySource {
  readonly setIdForDisplay: string;
}

export interface TextDisplayTarget {
  setText(value: string): void;
}

export class RoundStateDisplayController {
  public constructor(
    private readonly receiver: SetIdDisplaySource,
    private readonly setIdDisplay: TextDisplayTarget,
  ) {}

  public render(): void {
    this.setIdDisplay.setText(this.receiver.setIdForDisplay);
  }
}
