import type { UnitEffectSetId } from "../shared/room-messages";
import {
  connectAndAttachSetIdDisplay,
  type ConnectAndAttachSetIdDisplayOptions,
  type BrowserClientFactory,
  type ConnectedSetIdDisplayBinding,
} from "./main";

interface QueryRoot {
  querySelector(selector: string): unknown;
}

export interface StartSetIdDisplayBootstrapOptions {
  endpoint: string;
  roomName?: string;
  setId?: UnitEffectSetId;
  selector?: string;
  root?: QueryRoot;
  createClient?: BrowserClientFactory;
}

export async function startSetIdDisplayBootstrap(
  options: StartSetIdDisplayBootstrapOptions,
): Promise<ConnectedSetIdDisplayBinding | null> {
  const roomOptions =
    options.setId === undefined ? undefined : { setId: options.setId };

  const connectOptions: ConnectAndAttachSetIdDisplayOptions = {
    endpoint: options.endpoint,
  };

  if (options.roomName !== undefined) {
    connectOptions.roomName = options.roomName;
  }

  if (options.selector !== undefined) {
    connectOptions.selector = options.selector;
  }

  if (options.root !== undefined) {
    connectOptions.root = options.root;
  }

  if (options.createClient !== undefined) {
    connectOptions.createClient = options.createClient;
  }

  if (roomOptions !== undefined) {
    connectOptions.roomOptions = roomOptions;
  }

  return connectAndAttachSetIdDisplay(connectOptions);
}
