import {
  SERVER_MESSAGE_TYPES,
  type RoundStateMessage,
  type UnitEffectSetId,
} from "../../shared/room-messages";
import { RoundStateReceiver, type RoomMessageSubscriber } from "../round-state-receiver";
import {
  RoundStateDisplayController,
  type TextDisplayTarget,
} from "./round-state-display-controller";

type Unsubscribe = () => void;

export class SetIdDisplayApp {
  private readonly receiver: RoundStateReceiver;

  private readonly controller: RoundStateDisplayController;

  private readonly unsubscribers: Unsubscribe[] = [];

  public constructor(setIdDisplay: TextDisplayTarget) {
    this.receiver = new RoundStateReceiver();
    this.controller = new RoundStateDisplayController(this.receiver, setIdDisplay);
  }

  public start(room: RoomMessageSubscriber): void {
    this.stop();
    this.receiver.attach(room);
    this.controller.render();

    const messageUnsubscribe = room.onMessage<RoundStateMessage>(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
      () => {
        queueMicrotask(() => {
          this.controller.render();
        });
      },
    );

    if (typeof messageUnsubscribe === "function") {
      this.unsubscribers.push(messageUnsubscribe);
    }

    if (!room.onStateChange) {
      return;
    }

    const stateChangeCallback = (_state: { setId?: UnitEffectSetId }): void => {
      queueMicrotask(() => {
        this.controller.render();
      });
    };

    const stateChangeSubscription = room.onStateChange(stateChangeCallback);

    if (typeof stateChangeSubscription === "function") {
      this.unsubscribers.push(stateChangeSubscription);
      return;
    }

    if (
      stateChangeSubscription &&
      typeof stateChangeSubscription === "object" &&
      "remove" in stateChangeSubscription &&
      typeof stateChangeSubscription.remove === "function"
    ) {
      this.unsubscribers.push(() => {
        stateChangeSubscription.remove(stateChangeCallback);
      });
    }
  }

  public stop(): void {
    while (this.unsubscribers.length > 0) {
      const unsubscribe = this.unsubscribers.pop();

      if (!unsubscribe) {
        continue;
      }

      unsubscribe();
    }

    this.receiver.detach();
  }

  public renderNow(): void {
    this.controller.render();
  }
}
