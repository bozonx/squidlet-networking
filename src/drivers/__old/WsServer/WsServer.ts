import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import WebSocketServerIo, {ConnectionParams} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';
import {WebSocketServerProps} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';
import WsServerLogic, {WS_SERVER_EVENTS} from './WsServerLogic';


export class WsServer extends DriverBase<WebSocketServerProps> {
  // it fulfils when server is start listening
  get listeningPromise(): Promise<void> {
    if (!this.server) {
      throw new Error(`WebSocketServer.listeningPromise: ${this.closedMsg}`);
    }

    return this.server.listeningPromise;
  }

  private get wsServerIo(): WebSocketServerIo {
    return this.context.getIo('WebSocketServer') as any;
  }
  private server?: WsServerLogic;
  private get closedMsg() {
    return `Server "${this.props.host}:${this.props.port}" has been already closed`;
  }


  init = async () => {
    this.server = new WsServerLogic(
      this.wsServerIo,
      this.props,
      this.onServerClosed,
      this.log.debug,
      this.log.info,
      this.log.error
    );

    await this.server.init();
  }

  // protected appDidInit = async () => {
  //   this.server && await this.server.init();
  // }

  destroy = async () => {
    if (!this.server) return;

    await this.server.destroy();
    delete this.server;
  }


  send = (connectionId: string, data: string | Uint8Array): Promise<void> => {
    if (!this.server) throw new Error(`WebSocketServer.send: ${this.closedMsg}`);

    return this.server.send(connectionId, data);
  }

  // TODO: add closeServer ???

  /**
   * Force closing a connection
   */
  async closeConnection(connectionId: string, code: number, reason: string): Promise<void> {
    if (!this.server) return;

    await this.server.closeConnection(connectionId, code, reason);
  }

  async destroyConnection(connectionId: string) {
    if (!this.server) return;

    await this.server.destroyConnection(connectionId);
  }

  async setCookie(connectionId: string, cookie: string) {
    if (!this.server) return;

    await this.server.setCookie(connectionId, cookie);
  }

  onMessage(cb: (connectionId: string, data: string | Uint8Array) => void): number {
    if (!this.server) throw new Error(`WebSocketServer.onMessage: ${this.closedMsg}`);

    return this.server.onMessage(cb);
  }

  onConnection(
    cb: (connectionId: string, connectionParams: ConnectionParams) => void
  ): number {
    if (!this.server) throw new Error(`WebSocketServer.onConnection: ${this.closedMsg}`);

    return this.server.onConnection(cb);
  }

  /**
   * Ordinary connection close.
   * It won't be called on destroy
   */
  onConnectionClose(cb: (connectionId: string) => void): number {
    if (!this.server) throw new Error(`WebSocketServer.onConnectionClose: ${this.closedMsg}`);

    return this.server.onConnectionClose(cb);
  }

  removeListener(handlerIndex: number) {
    if (!this.server) return;

    this.server.removeListener(handlerIndex);
  }


  private onServerClosed = () => {
    this.log.error(`WebSocketServer: ${this.closedMsg}, you can't manipulate it any more!`);
  }

}

export default class Factory extends DriverFactoryBase<WsServer, WebSocketServerProps> {
  protected SubDriverClass = WsServer;
  protected instanceId = (props: WebSocketServerProps): string => {
    return `${props.host}:${props.port}`;
  }
}
