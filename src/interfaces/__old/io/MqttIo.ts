import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';


export const Methods = [
  'init',
  'destroy',
  'newConnection',
  'reConnect',
  'close',
  'isConnected',
  'isDisconnecting',
  'isDisconnected',
  'isReconnecting',
  'onConnect',
  'onDisconnect',
  'onClose',
  'onMessage',
  'onError',
  'removeListener',
  'publish',
  'subscribe',
  'unsubscribe',
];


//export type MqttIoEvents = 'open' | 'close' | 'message' | 'error';
export enum MqttIoEvents {
  connect,
  disconnect,
  close,
  message,
  error
}

export interface MqttOptions {
  username?: string;
  password?: string;
  resubscribe?: boolean;
  // TODO: check
  reconnectPeriod?: number;
  connectTimeout?: number;
}

export default interface MqttIo extends IoItem {
  destroy: () => Promise<void>;

  /**
   * It makes new connection to broker and returns connectionId
   * @param url - broker url
   * @param options - connection options
   */
  newConnection(url: string, options: MqttOptions): Promise<string>;

  /**
   * Close connection and remove connectionId
   */
  close(connectionId: string, force?: boolean): Promise<void>;
  isConnected(connectionId: string): Promise<boolean>;
  isDisconnecting(connectionId: string): Promise<boolean>;
  isDisconnected(connectionId: string): Promise<boolean>;
  isReconnecting(connectionId: string): Promise<boolean>;

  /**
   * It rises at first time connect or at reconnect
   * @param cb
   */
  onConnect(connectionId: string, cb: () => void): Promise<number>;

  /**
   * It rises when client is disconnected. It tries to reconnect.
   * @param cb
   */
  onDisconnect(connectionId: string, cb: () => void): Promise<number>;

  /**
   * Means connection closed and connectionId is removed.
   */
  onClose(connectionId: string, cb: () => void): Promise<number>;

  /**
   * Listen all the subscribed messages.
   * Data will be a string or empty string or Uint8Array or empty Uint8Array.
   */
  onMessage(connectionId: string, cb: (topic: string, data: Uint8Array) => void): Promise<number>;
  onError(connectionId: string, cb: (err: string) => void): Promise<number>;
  removeListener(connectionId: string, handlerId: number): Promise<void>;

  publish(connectionId: string, topic: string, data: string | Uint8Array): Promise<void>;

  /**
   * Tell broker that you want to listen this topic.
   * And then use onMessage method
   */
  subscribe(connectionId: string, topic: string): Promise<void>;
  unsubscribe(connectionId: string, topic: string): Promise<void>;


  // /**
  //  * Reconnect manually. It doesn't change the connectionId.
  //  */
  // reConnect(connectionId: string): Promise<void>;

}
