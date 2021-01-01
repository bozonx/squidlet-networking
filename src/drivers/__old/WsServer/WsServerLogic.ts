import WebSocketServerIo, {
  ConnectionParams,
  WebSocketServerProps,
  WsServerEvent
} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import Promised from '../squidlet-lib/src/Promised';
import {SERVER_STARTING_TIMEOUT_SEC} from '../../../../../squidlet/__old/system/constants';
import {WsCloseStatus} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketClientIo';


export enum WS_SERVER_EVENTS {
  incomeMessage,
  closeConnection,
  newConnection,
}

export const SETCOOKIE_LABEL = '__SET_COOKIE__';
// TODO: review
const HANDLER_INDEX_POSITION = 1;


export default class WsServerLogic {
  // it fulfils when server is start listening
  get listeningPromise(): Promise<void> {
    return this._listeningPromised.promise;
  }

  private readonly events = new IndexedEventEmitter<(...args: any[]) => void>();
  private readonly wsServerIo: WebSocketServerIo;
  private readonly props: WebSocketServerProps;
  private readonly onClose: () => void;
  private readonly logDebug: (message: string) => void;
  private readonly logInfo: (message: string) => void;
  private readonly logError: (message: string) => void;
  private serverId: string = '';
  private _listeningPromised: Promised<void>;
  private handlerIndexes: [WsServerEvent, number][] = [];


  constructor(
    wsServerIo: WebSocketServerIo,
    props: WebSocketServerProps,
    // It rises a handler only if server is closed.
    // It's better to destroy this instance and make new one if need.
    onClose: () => void,
    logDebug: (message: string) => void,
    logInfo: (message: string) => void,
    logError: (message: string) => void,
  ) {
    this.wsServerIo = wsServerIo;
    this.props = props;
    this.onClose = onClose;
    this.logDebug = logDebug;
    this.logInfo = logInfo;
    this.logError = logError;
    this._listeningPromised = new Promised<void>();
  }


  /**
   * Start server
   */
  async init() {
    this.logInfo(`... Starting websocket server: ${this.props.host}:${this.props.port}`);
    this.serverId = await this.wsServerIo.newServer(this.props);

    await this.listenServerEvents();
    await this.listenConnectionEvents();
  }

  async destroy() {
    if (!this.isInitialized()) {
      return this.logError(`WsServerLogic.destroy: Server hasn't been initialized yet.`);
    }

    this.logDebug(`... destroying websocket server: ${this.props.host}:${this.props.port}`);
    this.events.destroy();
    await this.removeListeners();
    // TODO: use destroyServer - it removes all the events before destroy
    // TODO: не должно поднять события
    await this.wsServerIo.closeServer(this.serverId);

    delete this.serverId;
  }


  isInitialized(): boolean {
    return typeof this.serverId !== 'undefined';
  }

  /**
   * Send message to client
   */
  send = (connectionId: string, data: string | Uint8Array): Promise<void> => {
    this.logDebug(`WsServerLogic.send from ${this.props.host}:${this.props.port} to connection ${connectionId}, data length ${data.length}`);

    return this.wsServerIo.send(this.serverId, connectionId, data);
  }

  async setCookie(connectionId: string, cookie: string) {
    const data = `${SETCOOKIE_LABEL}${cookie}`;

    this.logDebug(`WsServerLogic.setCookie from ${this.props.host}:${this.props.port} to connection ${connectionId}, ${data}`);

    return this.wsServerIo.send(this.serverId, connectionId, data);
  }

  /**
   * Force closing a connection.
   * Close event will be risen
   */
  closeConnection(connectionId: string, code: number, reason: string): Promise<void> {
    this.logDebug(`WsServerLogic server ${this.props.host}:${this.props.port} manually closes connection ${connectionId}`);
    // TODO: проверить будет ли поднято событие close ???
    return this.wsServerIo.close(this.serverId, connectionId, code, reason);
  }

  async destroyConnection(connectionId: string) {
    this.logDebug(`WsServerLogic server ${this.props.host}:${this.props.port} destroys connection ${connectionId}`);
    // TODO: может проще тут отписаться от события и выполнить просто close
    return this.wsServerIo.close(this.serverId, connectionId, WsCloseStatus.closeGoingAway, 'Destroy connection');
    //await this.wsServerIo.destroyConnection(this.serverId, connectionId);
  }

  /**
   * Listen income messages
   */
  onMessage(cb: (connectionId: string, data: string | Uint8Array) => void): number {
    return this.events.addListener(WS_SERVER_EVENTS.incomeMessage, cb);
  }

  /**
   * It rises when new connection is come.
   */
  onConnection(cb: (connectionId: string, request: ConnectionParams) => void): number {
    return this.events.addListener(WS_SERVER_EVENTS.newConnection, cb);
  }

  /**
   * Listen any connection close
   */
  onConnectionClose(cb: (connectionId: string) => void): number {
    return this.events.addListener(WS_SERVER_EVENTS.closeConnection, cb);
  }

  removeListener(handlerIndex: number) {
    this.events.removeListener(handlerIndex);
  }


  private async listenServerEvents() {
    const listeningTimeout = setTimeout(() => {
      this.handleTimeout()
        .catch(this.logError);
    }, SERVER_STARTING_TIMEOUT_SEC * 1000);

    const listeningIndex: number = await this.wsServerIo.onServerListening(
      this.serverId,
      () => {
        clearTimeout(listeningTimeout);
        this.logDebug(`WsServerLogic: server ${this.props.host}:${this.props.port} started listening`);
        this._listeningPromised.resolve();
      }
    );
    const connectionIndex: number = await this.wsServerIo.onConnection(
      this.serverId,
      (connectionId: string, request: ConnectionParams) => {
        this.logDebug(`WsServerLogic: server ${this.props.host}:${this.props.port} received a new connection ${connectionId}, ${JSON.stringify(request)}`);
        this.events.emit(WS_SERVER_EVENTS.newConnection, connectionId, request);
      }
    );
    const closeIndex: number = await this.wsServerIo.onServerClose(
      this.serverId,
      () => {
        clearTimeout(listeningTimeout);
        this.handleCloseServer()
          .catch(this.logError);
      }
    );
    const errorIndex: number = await this.wsServerIo.onServerError(this.serverId, (err: Error) => this.logError(String(err)));

    this.handlerIndexes.push([WsServerEvent.listening, listeningIndex]);
    this.handlerIndexes.push([WsServerEvent.newConnection, connectionIndex]);
    this.handlerIndexes.push([WsServerEvent.serverClose, closeIndex]);
    this.handlerIndexes.push([WsServerEvent.serverError, errorIndex]);
  }

  private async listenConnectionEvents() {
    const closeIndex: number = await this.wsServerIo.onClose(
      this.serverId,
      (connectionId: string) => {
        this.logDebug(`WsServerLogic connection ${connectionId} has been closed on server ${this.props.host}:${this.props.port} has been closed`);
        this.events.emit(WS_SERVER_EVENTS.closeConnection, connectionId);
      }
    );
    const messageIndex: number = await this.wsServerIo.onMessage(
      this.serverId,
      (connectionId: string, data: string | Uint8Array) => {
        this.logDebug(`WsServerLogic income message on server ${this.props.host}:${this.props.port}, connection id ${connectionId}, data length ${data.length}`);
        this.events.emit(WS_SERVER_EVENTS.incomeMessage, connectionId, data);
      }
    );
    const errorIndex: number = await this.wsServerIo.onError(
      this.serverId,
      (connectionId: string, err: Error) => this.logError(String(err))
    );
    const unexpectedIndex: number = await this.wsServerIo.onUnexpectedResponse(
      this.serverId,
      (connectionId: string, response: ConnectionParams) => {
        this.logError(
          `Unexpected response has been received on server "${this.serverId}", ` +
          `connection "${connectionId}": ${JSON.stringify(response)}`
        );
      }
    );

    this.handlerIndexes.push([WsServerEvent.clientClose, closeIndex]);
    this.handlerIndexes.push([WsServerEvent.clientMessage, messageIndex]);
    this.handlerIndexes.push([WsServerEvent.clientError, errorIndex]);
    this.handlerIndexes.push([WsServerEvent.clientUnexpectedResponse, unexpectedIndex]);
  }

  private async handleCloseServer() {
    this.logDebug(`WsServerLogic: server ${this.props.host}:${this.props.port} has been closed`);
    await this.removeListeners();
    delete this.serverId;
    this.onClose();
    this.events.destroy();
  }

  private async removeListeners() {
    for (let handlerIndex of this.handlerIndexes) {
      await this.wsServerIo.removeListener(this.serverId, handlerIndex[HANDLER_INDEX_POSITION]);
    }
  }

  private async handleTimeout() {
    this._listeningPromised.reject(new Error(`Server hasn't been started. Timeout has been exceeded`));
    await this.removeListeners();
    await this.wsServerIo.closeServer(this.serverId);
  }

}
