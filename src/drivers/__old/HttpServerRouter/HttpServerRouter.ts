import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import {HttpServerProps} from '../../../../../squidlet/__old/system/interfaces/io/HttpServerIo';
import HttpRouterLogic, {RouterEnterHandler, RouterRequestHandler} from '../../../../../squidlet/__old/system/lib/logic/HttpRouterLogic';
import {JsonTypes} from '../../../../../squidlet/__old/system/interfaces/Types';
import {HttpMethods} from '../../../../../squidlet/__old/system/interfaces/Http';
import {URL_DELIMITER} from '../squidlet-lib/src/url';

import {HttpServer} from '../HttpServer/HttpServer';
import {HttpDriverRequest, HttpDriverResponse} from '../HttpServer/HttpServerLogic';


export class HttpServerRouter extends DriverBase<HttpServerProps> {
  // it fulfils when server is start listening
  get listeningPromise(): Promise<void> {
    if (!this.server) {
      throw new Error(`HttpServerRouter.listeningPromise: ${this.closedMsg}`);
    }

    return this.server.listeningPromise;
  }

  private _router?: HttpRouterLogic;


  private get router(): HttpRouterLogic {
    return this._router as any;
  }
  private server!: HttpServer;
  private get closedMsg() {
    return `Server "${this.props.host}:${this.props.port}" has been already closed`;
  }


  init = async () => {
    this.server = await this.context.getSubDriver('HttpServer', this.props);
    this._router = new HttpRouterLogic(this.log.debug);

    this.server.onRequest(this.handleIncomeRequest);
  }

  destroy = async () => {
    this.router.destroy();
  }


  async disable() {
    await this.server.disable();
  }

  async enable() {
    await this.server.enable();
  }

  addRoute(
    method: HttpMethods,
    route: string,
    routeHandler: RouterRequestHandler,
    pinnedProps?: {[index: string]: JsonTypes}
  ) {
    if (route.indexOf(URL_DELIMITER) !== 0) {
      this.log.warn(
        `HttpServerRouter.addRoute: The route "${route}" doesn't have a "/" at the beginning.` +
        `Better to add it`
      );
    }

    this.router.addRoute(method, route, routeHandler, pinnedProps);
  }

  onEnter(cb: RouterEnterHandler): number {
    return this.router.onEnter(cb);
  }

  removeEnterListener(handlerIndex: number) {
    this.router.removeEnterListener(handlerIndex);
  }

  async closeServer() {
    if (!this.server) throw new Error(`HttpServerRouter.closeServer: ${this.closedMsg}`);

    return this.server.closeServer();
  }


  private handleIncomeRequest = async (request: HttpDriverRequest): Promise<HttpDriverResponse> => {
    return this.router.incomeRequest(request);
  }

}

export default class Factory extends DriverFactoryBase<HttpServerRouter, HttpServerProps> {
  protected SubDriverClass = HttpServerRouter;

  protected instanceId = (props: HttpServerProps): string => {
    return `${props.host}:${props.port}`;
  }
}
