export interface ConnectionMessage {
  port: number;
  payload: Uint8Array;
}

export interface ConnectionProps {
  address: number;
}


export type IncomeMessageHandler = (channel: number, payload: Uint8Array) => void;
export type ConnectionServiceType = 'connection';

export enum ConnectionsEvents {
  message,
  connected,
  disconnected
}

// TODO: может где-то сделать enum ???
export const CONNECTION_SERVICE_TYPE = 'connection';


/**
 * Connection between two peers. Both side know address each other.
 */
export default interface Connection {
  serviceType?: ConnectionServiceType;

  /**
   * Send data to peer and don't wait for response.
   * Channel is from 0 and up to 253. Don't use 254 and 255.
   */
  send(channel: number, payload: Uint8Array): Promise<void>;

  isConnected(): boolean;

  onIncomeMessage(cb: IncomeMessageHandler): number;
  onConnect(cb: () => void): number;
  onDisconnect(cb: () => void): number;

  /**
   * Remove listener of onIncomeData, onConnect or onDisconnect
   */
  removeListener(handlerIndex: number): void;
}
