type Timeout = NodeJS.Timeout;
import WebSocketClientIo, {
  OnMessageHandler, WebSocketClientProps, WsClientEvent, WsCloseStatus,
} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketClientIo';
import {ConnectionParams} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';
import IndexedEvents from '../squidlet-lib/src/IndexedEvents';
import {Primitives} from '../../../../../squidlet/__old/system/interfaces/Types';
import {mergeDeepObjects} from '../squidlet-lib/src/objects';
import {parseCookie, stringifyCookie} from '../squidlet-lib/src/cookies';
import Promised from '../squidlet-lib/src/Promised';

import {SETCOOKIE_LABEL} from '../WsServer/WsServerLogic';


// TODO: review
const HANDLER_INDEX_POSITION = 1;


export interface WsClientLogicProps {
  url: string;
  // allow reconnect
  autoReconnect: boolean;
  // waiting before new reconnection trying. 0 or less means don't wait. In ms.
  reconnectTimeoutMs: number;
  // reconnect times. -1 = infinity. 0 means none.
  maxTries: number;
  useCookie: boolean;
}


/**
 * Websocket client simplified interface.
 * It can automatically reconnect if "autoReconnect" param is true.
 * But if connection is closed by calling the close method you should create a new instance to reconnect.
 */
export default class WsClientLogic {
  // on first time connect or reconnect
  get connectedPromise(): Promise<void> {
    if (!this.connectionId || !this.openPromise) {
      throw new Error(`WsClientLogic.connectedPromise: ${this.closedMsg}`);
    }

    return this.openPromise.promise;
  }

  private readonly messageEvents = new IndexedEvents<OnMessageHandler>();
  private readonly wsClientIo: WebSocketClientIo;
  private readonly props: WsClientLogicProps;
  private readonly onClose: () => void;
  private readonly logDebug: (message: string) => void;
  private readonly logInfo: (message: string) => void;
  private readonly logError: (message: string) => void;
  private connectionId: string = '';
  // TODO: review logic
  // TODO: where is reject????
  private openPromise: Promised<void>;
  // TODO: review logic
  // was previous open promise fulfilled
  private wasPrevOpenFulfilled: boolean = false;
  private connectionTries: number = 0;
  private reconnectTimeout?: Timeout;
  private isConnectionOpened: boolean = false;
  private cookies: {[index: string]: Primitives} = {};
  private waitingCookies: boolean = true;
  private handlerIndexes: [WsClientEvent, number][] = [];
  // TODO: use in other cases
  private get closedMsg() {
    return `Connection "${this.props.url}" has been closed`;
  }


  constructor(
    wsClientIo: WebSocketClientIo,
    props: WsClientLogicProps,
    // It rises a handler only if connection is really closed. It doesn't rise it on reconnect.
    // It's better to destroy this instance and make new one if need.
    onClose: () => void,
    logDebug: (message: string) => void,
    logInfo: (message: string) => void,
    logError: (message: string) => void,
  ) {
    this.wsClientIo = wsClientIo;
    this.props = props;
    this.onClose = onClose;
    this.logDebug = logDebug;
    this.logInfo = logInfo;
    this.logError = logError;
    this.openPromise = this.makeOpenPromise();
  }

  async init() {
    // make new connection and save connectionId of it
    const connectionProps: WebSocketClientProps = {
      url: this.props.url,
    };

    this.connectionId = await this.wsClientIo.newConnection(connectionProps);

    await this.listen();
  }

  async destroy() {
    this.logDebug(`... destroying WsClientLogic: ${this.props.url}`);
    await this.removeListeners();
    await this.wsClientIo.close(this.connectionId, WsCloseStatus.closeGoingAway, 'Closing on destroy');
    this.destroyInstance();
  }


  isConnected(): boolean {
    return this.isConnectionOpened;
  }

  async send(data: string | Uint8Array): Promise<void> {
    await this.connectedPromise;

    this.logDebug(`WsClientLogic send to ${this.props.url}, connection id ${this.connectionId}, data length ${data.length}`);

    return this.wsClientIo.send(this.connectionId, data);
  }

  async close(code: number, reason?: string) {
    this.logDebug(`WsClientLogic manual close connection ${this.connectionId} to ${this.props.url}`);
    // TODO: проверить поднимется ли событие close
    await this.wsClientIo.close(this.connectionId, code, reason);
  }

  onMessage(cb: OnMessageHandler): number {
    return this.messageEvents.addListener(cb);
  }

  removeMessageListener(handlerId: number) {
    this.messageEvents.removeListener(handlerId);
  }


  private async listen() {
    const openIndex: number = await this.wsClientIo.onOpen(this.handleConnectionOpen);
    const closeIndex: number = await this.wsClientIo.onClose(this.handleConnectionClose);
    const messageIndex: number = await this.wsClientIo.onMessage(this.handleMessage);
    const errorIndex: number = await this.wsClientIo.onError((connectionId: string, err: Error) => {
      if (connectionId !== this.connectionId) return;

      this.logError(String(err));
    });
    const unexpectedIndex: number = await this.wsClientIo.onUnexpectedResponse(
      (connectionId: string, response: ConnectionParams) => {
        if (connectionId !== this.connectionId) return;

        this.logError(
          `The unexpected response has been received on ` +
          `connection "${this.connectionId}": ${JSON.stringify(response)}`
        );
      }
    );

    this.handlerIndexes.push([WsClientEvent.open, openIndex]);
    this.handlerIndexes.push([WsClientEvent.close, closeIndex]);
    this.handlerIndexes.push([WsClientEvent.message, messageIndex]);
    this.handlerIndexes.push([WsClientEvent.error, errorIndex]);
    this.handlerIndexes.push([WsClientEvent.unexpectedResponse, unexpectedIndex]);
  }

  private handleConnectionOpen = (connectionId: string) => {
    if (connectionId !== this.connectionId) return;

    this.connectionTries = 0;
    this.wasPrevOpenFulfilled = true;
    this.isConnectionOpened = true;

    if (this.props.useCookie) {
      this.waitingCookies = true;
    }
    else {
      this.openPromise.resolve();
    }

    this.logInfo(`WsClientLogic: connection opened. ${this.props.url} Id: ${this.connectionId}`);
  }

  /**
   * Trying to reconnect on connection closed.
   */
  private handleConnectionClose = (connectionId: string) => {
    if (connectionId !== this.connectionId) return;

    this.isConnectionOpened = false;
    // TODO: проверить действительно ли сработает close если даже соединение не открывалось

    this.logInfo(`WsClientLogic: connection closed. ${this.props.url} Id: ${this.connectionId}`);
    this.resolveReconnection()
      .catch(this.logError);
  }

  private handleMessage = (connectionId: string, data: string | Uint8Array) => {
    if (connectionId !== this.connectionId) return;

    // if the first message is cookie - set it
    if (this.waitingCookies) {
      if (this.isCookieMessage(data)) {
        this.waitingCookies = false;

        this.logDebug(`WsClientLogic income set cookie request of connection ${this.connectionId} from ${this.props.url}, ${data}`);
        this.setCookie(data);
        this.openPromise.resolve();

        return;
      }

      // go to ordinary mode if the first message isn't cookie
      this.waitingCookies = false;
      this.openPromise.resolve();
    }

    //this.logDebug(`WsClientLogic income message connection ${this.connectionId} from ${this.props.url}, data length ${data.length}`);
    // ordinary message
    this.messageEvents.emit(data);
  }

  /**
   * close connection and don't do reconnect if autoReconnect=false or no max tries or tries are exceeded
   * if tries more than -1(infinity) - increment it and close connection if can't connect
   * 0 means none
   */
  private async resolveReconnection() {
    if (
      !this.props.autoReconnect
      || this.props.maxTries === 0
      || (this.props.maxTries > 0 && this.connectionTries >= this.props.maxTries)
    ) {
      return this.finallyCloseConnection();
    }

    await this.reconnect();
  }

  private async reconnect() {
    // do nothing if current reconnection is in progress
    if (this.reconnectTimeout) return;

    // make new promise if previous was fulfilled
    if (this.wasPrevOpenFulfilled) this.openPromise = this.makeOpenPromise();

    // TODO: нужно тогда опять ждать cookie и потом резолвиться connection promise

    // reconnect immediately if reconnectTimeoutMs = 0 or less
    if (this.props.reconnectTimeoutMs <= 0) return this.doReconnect();

    this.logInfo(`WsClientLogic: Wait ${this.props.reconnectTimeoutMs} ms to reconnect`);
    this.reconnectTimeout = setTimeout(this.doReconnect, this.props.reconnectTimeoutMs);
  }

  private doReconnect = async () => {
    delete this.reconnectTimeout;
    this.logInfo(`WsClientLogic: Reconnecting connection "${this.connectionId}" ...`);

    // TODO: при этом не сработает close ??? или сработает???
    // TODO: писать в debug о reconnect

    const connectionProps: WebSocketClientProps = {
      url: this.props.url,
      headers: {
        'Cookie': stringifyCookie(this.cookies),
      }
    };

    // try to reconnect and save current connectionId
    try {
      await this.wsClientIo.reConnect(this.connectionId, connectionProps);
    }
    catch (err) {
      this.logError(`WsClientLogic.doReconnect: ${err}. Reconnecting...`);

      // increment connection tries if maxTries is greater than 0
      if (this.props.maxTries >= 0) this.connectionTries++;

      this.resolveReconnection()
        .catch(this.logError);
    }

    this.listen()
      .catch(this.logError);
  }

  /**
   * You can't reconnect anymore after this. You should create a new instance if need.
   */
  private async finallyCloseConnection() {
    await this.removeListeners();
    await this.wsClientIo.close(this.connectionId, WsCloseStatus.closeNormal);

    // // reject open promise if connection hasn't been established
    // if (!this.wasPrevOpenFulfilled) {
    //   this.wasPrevOpenFulfilled = true;
    //   this.openPromiseReject();
    // }

    this.destroyInstance();

    return this.onClose();
  }

  // TODO: review
  private makeOpenPromise(): Promised<void> {
    this.wasPrevOpenFulfilled = false;

    return new Promised<void>();
  }

  private destroyInstance() {
    this.isConnectionOpened = false;
    this.openPromise.destroy();

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    delete this.openPromise;
    delete this.reconnectTimeout;
    this.messageEvents.destroy();
  }

  private setCookie(data: string | Uint8Array) {
    if (typeof data !== 'string' || !this.isCookieMessage(data)) return;

    const [left, cookiePart] = data.split(SETCOOKIE_LABEL);

    try {
      const cookies: {[index: string]: Primitives} = parseCookie(cookiePart);

      this.cookies = mergeDeepObjects(this.cookies, cookies);
    }
    catch (err) {
      return this.logError(`WsClientLogic.setCookie: ${err}`);
    }
  }

  private isCookieMessage(message: any): boolean {
    if (typeof message !== 'string') return false;

    return message.indexOf(SETCOOKIE_LABEL) === 0;
  }

  private async removeListeners() {
    for (let handlerIndex of this.handlerIndexes) {
      await this.wsClientIo.removeListener(this.connectionId, handlerIndex[HANDLER_INDEX_POSITION]);
    }
  }

}
