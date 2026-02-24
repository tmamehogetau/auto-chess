import {
  SERVER_MESSAGE_TYPES,
  type RoundStateMessage,
  type UnitEffectSetId,
} from "../shared/room-messages";

interface RoomStateSnapshot {
  setId?: UnitEffectSetId;
}

type RoomStateChangeCallback = (state: RoomStateSnapshot) => void;

interface StateChangeSubscription {
  remove(callback: RoomStateChangeCallback): void;
}

type MessageUnsubscribe = () => void;

export interface RoomMessageSubscriber {
  onMessage<T>(type: string, callback: (message: T) => void): void | MessageUnsubscribe;
  onStateChange?(
    callback: RoomStateChangeCallback,
  ): void | MessageUnsubscribe | StateChangeSubscription;
  state?: RoomStateSnapshot;
}

export class RoundStateReceiver {
  private latestRoundState: RoundStateMessage | null = null;

  private latestSetId: UnitEffectSetId | null = null;

  private readonly detachCallbacks: Array<() => void> = [];

  public attach(room: RoomMessageSubscriber): void {
    this.detach();
    this.latestSetId = this.readSetIdFromState(room);

    const messageUnsubscribe = room.onMessage<RoundStateMessage>(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
      (message) => {
        this.latestRoundState = {
          phase: message.phase,
          roundIndex: message.roundIndex,
          phaseDeadlineAtMs: message.phaseDeadlineAtMs,
          ranking: [...message.ranking],
        };

        const setIdFromState = this.readSetIdFromState(room);

        if (setIdFromState !== null) {
          this.latestSetId = setIdFromState;
        }
      },
    );

    if (typeof messageUnsubscribe === "function") {
      this.detachCallbacks.push(messageUnsubscribe);
    }

    if (!room.onStateChange) {
      return;
    }

    const stateChangeCallback: RoomStateChangeCallback = (state) => {
      const setId = this.readSetId(state);

      if (setId !== null) {
        this.latestSetId = setId;
      }
    };

    const stateSubscription = room.onStateChange(stateChangeCallback);

    if (typeof stateSubscription === "function") {
      this.detachCallbacks.push(stateSubscription);
      return;
    }

    if (
      stateSubscription &&
      typeof stateSubscription === "object" &&
      "remove" in stateSubscription &&
      typeof stateSubscription.remove === "function"
    ) {
      this.detachCallbacks.push(() => {
        stateSubscription.remove(stateChangeCallback);
      });
    }
  }

  public detach(): void {
    while (this.detachCallbacks.length > 0) {
      const callback = this.detachCallbacks.pop();

      if (!callback) {
        continue;
      }

      callback();
    }
  }

  public get rankingForDisplay(): string[] {
    if (!this.latestRoundState) {
      return [];
    }

    return [...this.latestRoundState.ranking];
  }

  public get roundLabelForDisplay(): string {
    if (!this.latestRoundState) {
      return "Round -";
    }

    return `Round ${this.latestRoundState.roundIndex}`;
  }

  public get setIdForDisplay(): string {
    if (!this.latestSetId) {
      return "-";
    }

    return this.latestSetId;
  }

  private readSetIdFromState(room: RoomMessageSubscriber): UnitEffectSetId | null {
    return this.readSetId(room.state);
  }

  private readSetId(state?: RoomStateSnapshot): UnitEffectSetId | null {
    const setId = state?.setId;

    if (setId !== "set1" && setId !== "set2") {
      return null;
    }

    return setId;
  }
}
