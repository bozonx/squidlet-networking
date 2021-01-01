import {asciiToUint8Array, uint8ArrayToAscii} from '../squidlet-lib/src/serialize';
import {callSafely} from '../squidlet-lib/src/common';
import Promised from '../squidlet-lib/src/Promised';
import Connection from '../../../../../squidlet/__old/system/interfaces/Connection';

import NetworkMessage from './interfaces/NetworkMessage';
import Router from './Router';


type Timeout = NodeJS.Timeout;
export type UriHandler = (request: NetworkMessage) => Promise<Uint8Array>;

// port of connection which network uses to send and receive messages
export const NETWORK_PORT = 254;

export enum SPECIAL_URI {
  responseOk,
  responseError,
  getName,
  ping,
  pong,
}


export default class NetworkLogic {
  private readonly requestTimeoutSec: number;
  private readonly logError: (msg: string) => void;
  private readonly router: Router;
  private uriHandlers: {[index: string]: UriHandler} = {};


  constructor(
    peerConnections: Connection,
    myId: string,
    requestTimeoutSec: number,
    defaultTtl: number,
    logWarn: (msg: string) => void,
    logError: (msg: string) => void,
  ) {
    this.requestTimeoutSec = requestTimeoutSec;
    this.logError = logError;
    this.router = new Router(
      peerConnections,
      myId,
      defaultTtl,
      logWarn,
      logError
    );
  }


  init() {
    this.router.init();
    this.router.onIncomeMessage(this.handleIncomeMessage);
  }

  destroy() {
    this.router.destroy();

    delete this.uriHandlers;
  }


  /**
   * Send request and wait for response
   */
  async request(
    toHostId: string,
    uri: string,
    payload: Uint8Array,
    TTL?: number
  ): Promise<Uint8Array> {
    if (uri.length <= 1) {
      throw new Error(`Uri has to have length greater than 1. One byte is for status number`);
    }

    const messageId: string = this.router.newMessageId();

    // send request and wait while it is finished
    await this.router.send(toHostId, uri, payload, messageId, TTL);

    return this.waitForResponse(uri, messageId);
  }

  /**
   * Handle income requests. Only on handler of one uri is allowed.
   * @param uri
   * @param handler
   */
  startListenUri(uri: string, handler: UriHandler) {
    if (this.uriHandlers[uri]) {
      throw new Error(`Handler of uri has already defined`);
    }

    this.uriHandlers[uri] = handler;
  }

  stopListenUri(uri: string) {
    delete this.uriHandlers[uri];
  }

  /**
   * Handle request which is for current host
   */
  private handleIncomeMessage(incomeMessage: NetworkMessage) {
    // listen only requests. They have uri with length greater than 1
    if (incomeMessage.uri.length <= 1 ) return;
    // if no handler - then send an error back
    if (!this.uriHandlers[incomeMessage.uri]) {
      this.router.send(
        incomeMessage.completeRoute[0],
        String(SPECIAL_URI.responseError),
        asciiToUint8Array(`No handler on uri "${incomeMessage.uri}"`),
        incomeMessage.messageId,
      )
        .catch(this.logError);

      return;
    }
    // call handler and send response but don't wait for result
    this.callUriHandlerAndSandBack(incomeMessage)
      .catch(this.logError);
  }

  private async callUriHandlerAndSandBack(incomeMessage: NetworkMessage) {
    let backUri: string = String(SPECIAL_URI.responseOk);
    let payloadToSendBack: Uint8Array;

    try {
      payloadToSendBack = await callSafely(
        this.uriHandlers[incomeMessage.uri],
        incomeMessage,
      );
    }
    catch (e) {
      backUri = String(SPECIAL_URI.responseError);
      payloadToSendBack = asciiToUint8Array(`Error while executing handler of uri "${incomeMessage.uri}" :${e}`);
    }
    // send back data which handler returned or error
    await this.router.send(
      incomeMessage.completeRoute[0],
      backUri,
      payloadToSendBack,
      incomeMessage.messageId,
    );
  }

  private waitForResponse(uri: string, messageId: string): Promise<Uint8Array> {
    const promised = new Promised<Uint8Array>();
    let timeout: Timeout | undefined;

    const responseListener: number = this.router.onIncomeMessage((
      incomeMessage: NetworkMessage
    ) => {
      // listen only ours response
      if (incomeMessage.messageId !== messageId) return;

      this.router.removeListener(responseListener);
      clearTimeout(timeout as any);

      this.processResponse(incomeMessage)
        .then(promised.resolve)
        .catch(promised.reject);
    });

    timeout = setTimeout(() => {
      this.router.removeListener(responseListener);

      if (promised.isFulfilled()) return;

      promised.reject(new Error(
        `Timeout of request has been exceeded of URI "${uri}"`
      ));
    }, this.requestTimeoutSec * 1000);

    return promised.promise;
  }

  private async processResponse(incomeMessage: NetworkMessage): Promise<Uint8Array> {
    switch (incomeMessage.uri) {
      case String(SPECIAL_URI.responseOk):
        // it's OK
        return incomeMessage.payload;

      case String(SPECIAL_URI.responseError):
        // if an error has been returned just convert it to string and reject promise
        throw new Error(uint8ArrayToAscii(incomeMessage.payload));
      default:
        throw new Error(`Unknown response URI "${incomeMessage.uri}"`);
    }
  }

}
