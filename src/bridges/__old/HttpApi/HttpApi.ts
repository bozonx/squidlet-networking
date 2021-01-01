import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import {HttpServerProps} from '../../../../../squidlet/__old/system/interfaces/io/HttpServerIo';
import {Route} from '../../../../../squidlet/__old/system/lib/logic/HttpRouterLogic';
import {JsonTypes, Primitives} from '../../../../../squidlet/__old/system/interfaces/Types';
import {parseArgs} from '../../../../../squidlet/__old/system/lib/helpers';

import {HttpDriverResponse} from '../../../../../squidlet-networking/src/drivers/HttpServer/HttpServerLogic';
import {HttpServerRouter} from '../../../../../squidlet-networking/src/drivers/HttpServerRouter/HttpServerRouter';


export interface HttpApiBody {
  result?: JsonTypes;
  error?: string;
}


const allowedApiMethodsToCall = [
  'info',
  'action',
  'getDeviceStatus',
  'getDeviceConfig',
  'getState',
  'getAutomationRuleActiveState',
  'setAutomationRuleActive',
  //'getSessionStore',
  'republishWholeState',
  'switchApp',
  'switchToApp',
  'reboot',
];


export default class HttpApi extends ServiceBase<HttpServerProps> {
  private router!: HttpServerRouter;


  init = async () => {
    this.router = await this.context.getSubDriver('HttpServerRouter', this.props);

    this.router.addRoute('get', '/api/:apiMethodName/:args', this.handleRoute);
    this.router.addRoute('get', '/api/:apiMethodName', this.handleRoute);
  }


  async disable() {
    await this.router.disable();
  }

  async enable() {
    await this.router.enable();
  }


  private handleRoute = async (route: Route): Promise<HttpDriverResponse> => {
    const apiMethodName: Primitives | undefined = route.params.apiMethodName;
    let body: HttpApiBody;

    if (typeof apiMethodName !== 'string') {
      body = { error: `Unexpected type of method "${apiMethodName}"` };

      return {
        status: 400,
        body: body as {[index: string]: Primitives},
      };
    }
    if (!allowedApiMethodsToCall.includes(apiMethodName)) {
      body = { error: `Api method "${apiMethodName}" not found` };

      return {
        status: 404,
        body: body as {[index: string]: Primitives},
      };
    }

    return await this.callApiMethod(route, apiMethodName);
  }

  private async callApiMethod(route: Route, apiMethodName: string): Promise<HttpDriverResponse> {
    const args: (JsonTypes | undefined)[] = parseArgs(route.params.args);
    let body: HttpApiBody;
    let result: any;

    try {
      result = await this.context.system.apiManager.callApi(apiMethodName, args);
    }
    catch (err) {
      body = { error: String(err) };

      return {
        status: 500,
        body: body as {[index: string]: Primitives},
      };
    }

    body = { result };

    return { body: body as {[index: string]: Primitives} };
  }

}
