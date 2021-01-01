import {ParsedUrl, parseUrl} from '../../../system/lib/url';
import {prepareRoute} from '../../../system/lib/route';
import HostInfo from '../../../system/interfaces/HostInfo';
import {HttpServerIo, HttpServerProps} from '../../../system/interfaces/io/HttpServerIo';
import {HttpApiBody} from '../HttpApi/HttpApi';
import IoSet from '../../../system/interfaces/IoSet';
import HostConfig from '../../../system/interfaces/HostConfig';
// TODO: use from system's interfaces
import HttpServerLogic, {HttpDriverRequest, HttpDriverResponse} from '../../drivers/HttpServer/HttpServerLogic';
import SysIo from '../../../system/interfaces/io/SysIo';
import StorageIo from '../../../system/interfaces/io/StorageIo';
import {pathJoin} from '../../../system/lib/paths';
import systemConfig from '../../../system/systemConfig';
import {START_APP_TYPE_FILE_NAME} from '../../../system/constants';
import {AppType} from '../../../system/interfaces/AppType';


const SWITCH_TO_APP_TIMEOUT_SEC = 5;


export default class IoServerHttpApi {
  private readonly ioSet: IoSet;
  private readonly hostConfig: HostConfig;
  private readonly logDebug: (msg: string) => void;
  private readonly logInfo: (msg: string) => void;
  private readonly logError: (msg: string) => void;
  private _httpServer?: HttpServerLogic;

  private get httpServer(): HttpServerLogic {
    return this._httpServer as any;
  }


  constructor(
    ioSet: IoSet,
    hostConfig: HostConfig,
    logDebug: (msg: string) => void,
    logInfo: (msg: string) => void,
    logError: (msg: string) => void
  ) {
    this.ioSet = ioSet;
    this.hostConfig = hostConfig;
    this.logDebug = logDebug;
    this.logInfo = logInfo;
    this.logError = logError;
  }

  async init() {
    // TODO: где берем хост и порт???
    const props: HttpServerProps = { host: '0.0.0.0', port: 8087 };
    const httpServerIo = this.ioSet.getIo<HttpServerIo>('HttpServer');

    this._httpServer = new HttpServerLogic(
      httpServerIo,
      props,
      () => this.logError(`Http server has been closed`),
      this.logDebug,
      this.logInfo,
      this.logError,
    );

    await this.httpServer.init();

    this.httpServer.onRequest(this.handleHttpRequest);
  }

  async destroy() {
    await this.httpServer.destroy();

    delete this._httpServer;
  }


  private handleHttpRequest = async (request: HttpDriverRequest): Promise<HttpDriverResponse> => {
    const parsedUrl: ParsedUrl = parseUrl(request.url);

    if (!parsedUrl.path) {
      return this.makeHttpApiErrorResponse(`Unsupported api call: no path part in the url`);
    }

    const preparedPath: string = prepareRoute(parsedUrl.path);
    let body: HttpApiBody;

    if (preparedPath === '/api/info') {
      body = this.apiHostInfo();
    }
    else if (preparedPath === '/api/switchToApp') {
      body = await this.apiSwitchToApp();
    }
    else if (preparedPath === '/api/reboot') {
      body = this.apiReboot();
    }
    else {
      return this.makeHttpApiErrorResponse(`Unsupported api call: "${preparedPath}"`);
    }

    return { body: body as {[index: string]: any} };
  }

  private apiReboot(): HttpApiBody {
    const Sys = this.ioSet.getIo<SysIo>('Sys');

    setTimeout(() => {
      Sys.reboot()
        .catch(this.logError);
    }, this.hostConfig.config.rebootDelaySec * 1000);

    return { result: `It will be rebooted in ${this.hostConfig.config.rebootDelaySec} seconds` };
  }

  private async apiSwitchToApp(): Promise<HttpApiBody> {
    // if (this.hostConfig.lockAppSwitch) {
    //   throw new Error(`Switching to App is not allowed!`);
    // }

    const storageIo: StorageIo = await this.ioSet.getIo<StorageIo>('Storage');
    const startAppTypeFileName: string = pathJoin(
      systemConfig.rootDirs.varData,
      systemConfig.envSetDirs.system,
      START_APP_TYPE_FILE_NAME,
    );
    const ioServerAppType: AppType = 'app';

    await storageIo.writeFile(startAppTypeFileName, ioServerAppType);

    setTimeout(() => {
      this.ioSet.getIo<SysIo>('Sys').exit();
    }, SWITCH_TO_APP_TIMEOUT_SEC * 1000);

    return { result: `Switching to the app in ${SWITCH_TO_APP_TIMEOUT_SEC} second` };
  }

  private apiHostInfo(): HttpApiBody {
    const ioServerAppType: AppType = 'ioServer';
    const hostInfo: HostInfo = {
      appType: ioServerAppType,
      platform: this.hostConfig.platform,
      machine: this.hostConfig.machine,
      usedIo: this.ioSet.getNames(),
    };

    return { result: hostInfo as {[index: string]: any} };
  }

  private makeHttpApiErrorResponse(error: string): HttpDriverResponse {
    const body: HttpApiBody = {
      error,
    };

    return {
      status: 500,
      body: body as {[index: string]: any}
    };
  }

}
