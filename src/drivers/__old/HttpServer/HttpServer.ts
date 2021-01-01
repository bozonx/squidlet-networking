import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import {HttpServerIo, HttpServerProps} from '../../../../../squidlet/__old/system/interfaces/io/HttpServerIo';
import HttpServerLogic, {HttpDriverRequest, HttpDriverResponse} from './HttpServerLogic';


export class HttpServer extends DriverBase<HttpServerProps> {
  // it fulfils when server is start listening
  get listeningPromise(): Promise<void> {
    if (!this.server) {
      throw new Error(`HttpServer.listeningPromise: ${this.closedMsg}`);
    }

    return this.server.listeningPromise;
  }

  private get httpServerIo(): HttpServerIo {
    return this.context.getIo('HttpServer') as any;
  }
  private server?: HttpServerLogic;
  private get closedMsg() {
    return `Server "${this.props.host}:${this.props.port}" has been already closed`;
  }


  init = async () => {
    this.server = new HttpServerLogic(
      this.httpServerIo,
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


  // TODO: review disable and enable
  async disable() {
    await this.server?.closeServer();
  }

  async enable() {
    await this.init();
  }

  onRequest(cb: (request: HttpDriverRequest) => Promise<HttpDriverResponse>): number {
    if (!this.server) throw new Error(`WebSocketServer.onMessage: ${this.onRequest}`);

    return this.server.onRequest(cb);
  }

  removeRequestListener(handlerIndex: number) {
    if (!this.server) throw new Error(`WebSocketServer.removeRequestListener: ${this.onRequest}`);

    this.server.removeRequestListener(handlerIndex);
  }

  async closeServer() {
    if (!this.server) throw new Error(`WebSocketServer.removeRequestListener: ${this.onRequest}`);

    return this.server.closeServer();
  }


  private onServerClosed = () => {
    this.log.error(`HttpServer: ${this.closedMsg}, you can't manipulate it any more!`);
  }

}

export default class Factory extends DriverFactoryBase<HttpServer, HttpServerProps> {
  protected SubDriverClass = HttpServer;

  protected instanceId = (props: HttpServerProps): string => {
    return `${props.host}:${props.port}`;
  }
}
