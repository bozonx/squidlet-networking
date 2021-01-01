import {ConnectionParams} from './WebSocketServerIo';
import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';


export const Methods = [
  'destroy',

  'newConnection',
  'reConnect',

  'onOpen',
  'onClose',
  'onMessage',
  'onError',
  'onUnexpectedResponse',

  'removeListener',

  'send',
  'close',
  'destroyConnection',
];

// export const wsEventNames: {[index: string]: WsEvents} = {
//   open: 'open',
//   close: 'close',
//   message: 'message',
//   error: 'error',
//   unexpectedResponse: 'unexpectedResponse',
// };

//export type WsEvents = 'open' | 'close' | 'message' | 'error' | 'unexpectedResponse';

export enum WsClientEvent {
  open,
  close,
  message,
  error,
  unexpectedResponse,
}

// see https://github.com/Luka967/websocket-close-codes
export enum WsCloseStatus {
  // Successful operation / regular socket shutdown
  closeNormal = 1000,
  // Client is leaving (browser tab closing)
  closeGoingAway,
  // Internal server error while operating
  serverError = 1011,
}

export type OnMessageHandler = (data: string | Uint8Array) => void;

export interface WebSocketClientProps {
  url: string;
  headers?: {[index: string]: string};
}

export default interface WebSocketClientIo extends IoItem {
  destroy: () => Promise<void>;

  newConnection       (props: WebSocketClientProps): Promise<string>;
  reConnect           (connectionId: string, props: WebSocketClientProps): Promise<void>;

  onOpen              (cb: (connectionId: string) => void): Promise<number>;
  onClose             (cb: (connectionId: string) => void): Promise<number>;
  onMessage           (cb: (connectionId: string, data: string | Uint8Array) => void): Promise<number>;
  onError             (cb: (connectionId: string, err: Error) => void): Promise<number>;
  onUnexpectedResponse(cb: (connectionId: string, response: ConnectionParams) => void): Promise<number>;

  removeListener (connectionId: string, handlerIndex: number): Promise<void>;

  send                (connectionId: string, data: string | Uint8Array): Promise<void>;
  close               (connectionId: string, code: number, reason?: string): Promise<void>;
  destroyConnection   (connectionId: string): Promise<void>;
}
