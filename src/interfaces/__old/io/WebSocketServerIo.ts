import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';


export const Methods = [
  'destroy',
  'newServer',
  'closeServer',
  'onConnection',
  'onServerListening',
  'onServerClose',
  'onServerError',
  'onClose',
  'onMessage',
  'onError',
  'onUnexpectedResponse',
  'removeListener',
  'send',
  'close',
  'destroyConnection',
];

export enum WsServerEvent {
  newConnection,
  listening,
  serverClose,
  serverError,
  clientClose,
  clientMessage,
  clientError,
  clientUnexpectedResponse,
}


export interface WebSocketServerProps {
  // The hostname where to bind the server
  host: string;
  // The port where to bind the server
  port: number;
}

interface CommonHeaders {
  authorization?: string;
  cookie?: string;
  'Set-Cookie'?: string;
  'user-agent'?: string;
}

export interface ConnectionParams {
  url: string;
  method: string;
  statusCode: number;
  statusMessage: string;
  headers: CommonHeaders;
}


export default interface WebSocketServerIo extends IoItem {
  /**
   * Destroy server and don't rise a close event.
   */
  destroy: () => Promise<void>;

  /**
   * make new server and return serverId
   */
  newServer(props: WebSocketServerProps): Promise<string>;

  /**
   * Shut down a server which has been previously created.
   * After than a close event will be risen.
   */
  closeServer(serverId: string): Promise<void>;

  /**
   * when new client is connected
   */
  onConnection(
    serverId: string,
    cb: (connectionId: string, request: ConnectionParams) => void
  ): Promise<number>;

  /**
   * when server starts listening
   */
  onServerListening(serverId: string, cb: () => void): Promise<number>;

  /**
   * on server close. Depend on http server close
   */
  onServerClose(serverId: string, cb: () => void): Promise<number>;

  /**
   * Emits on server error
   */
  onServerError(serverId: string, cb: (err: Error) => void): Promise<number>;

  /**
   * On connection close
   */
  onClose(serverId: string, cb: (connectionId: string) => void): Promise<number>;
  onMessage(serverId: string, cb: (connectionId: string, data: string | Uint8Array) => void): Promise<number>;
  onError(serverId: string, cb: (connectionId: string, err: Error) => void): Promise<number>;
  onUnexpectedResponse(serverId: string, cb: (connectionId: string, response: ConnectionParams) => void): Promise<number>

  /**
   * Remove one of server listeners
   */
  removeListener(serverId: string, handlerIndex: number): Promise<void>;

  ////////// Connection's methods like in client, but without onOpen

  send(serverId: string, connectionId: string, data: string | Uint8Array): Promise<void>;
  close(serverId: string, connectionId: string, code: number, reason: string): Promise<void>;

  /**
   * Destroy the connection and not rise an close event
   */
  destroyConnection(serverId: string, connectionId: string): Promise<void>;
}
