import IoSet from './interfaces/IoSet';
import WebSocketServerIo from './interfaces/io/WebSocketServerIo';
import HostConfig from './interfaces/HostConfig';
import {pathJoin} from './lib/paths';
import systemConfig from './systemConfig';
import StorageIo from './interfaces/io/StorageIo';
import IoItem, {IoDefinitions} from './interfaces/IoItem';
// TODO: use ioSet's - use driver
import WsServerLogic from '../entities/drivers/WsServer/WsServerLogic';

import IoServerConnectionLogic from '../entities/services/IoServerConnection/IoServerConnectionLogic';
import IoServerHttpApi from '../entities/services/IoServerHttpApi/IoServerHttpApi';
import IoContext from './interfaces/IoContext';
import Logger from './interfaces/Logger';


export default class IoServerOld {
  private readonly ioSet: IoSet;
  private _hostConfig?: HostConfig;
  private readonly log: Logger;
  private _wsServer?: WsServerLogic;
  private ioConnection?: IoServerConnectionLogic;
  private httpApi?: IoServerHttpApi;

  private get hostConfig(): HostConfig {
    return this._hostConfig as any;
  }

  private get wsServer(): WsServerLogic {
    return this._wsServer as any;
  }


  constructor(ioSet: IoSet, logger: Logger) {
    this.ioSet = ioSet;
    this.log = logger;
  }

  async start() {
    this._hostConfig = await this.loadConfig<HostConfig>(systemConfig.fileNames.hostConfig);

    this.log.info('--> Configuring Io');
    await this.configureIoSet();

    this.log.info('--> Initializing websocket and http servers');
    await this.startHttpApi();
    await this.initWsIoServer();

    this.log.info('===> IoServerOld initialization has been finished');
  }

  destroy = async () => {
    this.log.info('... destroying IoServer');
    this.httpApi && await this.httpApi.init();
    this.ioConnection && await this.ioConnection.destroy();
    await this.wsServer.destroy();

    delete this.ioConnection;
  }


  private handleNewIoClientConnection = async (connectionId: string) => {
    if (this.ioConnection) {
      const msg = `Only one connection is allowed`;

      this.log.error(msg);
      await this.wsServer.closeConnection(connectionId, 1, msg);

      return;
    }

    this.ioConnection = new IoServerConnectionLogic(
      connectionId,
      this.ioSet,
      this.hostConfig,
      this.wsServer.send,
      this.log.debug,
      this.log.error
    );

    // stop IoServerOld's http api server to not to busy the port
    this.httpApi && await this.httpApi.destroy();

    delete this.httpApi;

    this.ioConnection.setReadyState();

    this.log.info(`New IO client has been connected`);
  }

  private handleIoClientCloseConnection = async () => {
    this.ioConnection && await this.ioConnection.destroy();

    delete this.ioConnection;

    this.log.info(`IO client has been disconnected`);
    this.log.info(`Starting own http api`);
    await this.startHttpApi();
  }

  private async startHttpApi() {
    this.httpApi = new IoServerHttpApi(
      this.ioSet,
      this.hostConfig,
      this.log.debug,
      this.log.info,
      this.log.error
    );

    await this.httpApi.init();
  }

  private async loadConfig<T>(configFileName: string): Promise<T> {
    const pathToFile = pathJoin(
      systemConfig.rootDirs.envSet,
      systemConfig.envSetDirs.configs,
      configFileName
    );

    const storage = this.ioSet.getIo<StorageIo>('Storage');
    const configStr: string = await storage.readFile(pathToFile);

    return JSON.parse(configStr);
  }

  private async initWsIoServer() {
    if (!this.hostConfig.ioServer) {
      throw new Error(`Can't init ioServer because it isn't allowed in a host config`);
    }

    const wsServerIo = this.ioSet.getIo<WebSocketServerIo>('WebSocketServer');
    const props = this.hostConfig.ioServer;

    this._wsServer = new WsServerLogic(
      wsServerIo,
      props,
      () => this.log.error(`Websocket server has been closed`),
      this.log.debug,
      this.log.info,
      this.log.error,
    );

    await this.wsServer.init();

    this.wsServer.onMessage((connectionId: string, data: string | Uint8Array) => {
      if (!this.ioConnection) {
        return this.log.error(`IoServer.onMessage: no ioConnection`);
      }

      this.ioConnection.incomeMessage(connectionId, data)
        .catch(this.log.error);
    });
    this.wsServer.onConnection((connectionId: string) => {
      this.handleNewIoClientConnection(connectionId)
        .catch(this.log.error);
    });
    this.wsServer.onConnectionClose(() => {
      this.handleIoClientCloseConnection()
        .catch(this.log.error);
    });
  }

  private async configureIoSet() {
    const ioDefinitions = await this.loadConfig<IoDefinitions>(
      systemConfig.fileNames.iosDefinitions
    );
    const ioContext: IoContext = this.makeIoContext();

    for (let ioName of this.ioSet.getNames()) {
      const ioItem: IoItem = this.ioSet.getIo(ioName);

      if (ioItem.configure && ioDefinitions[ioName]) {
        this.log.debug(`configure io "${ioName}" with ${JSON.stringify(ioDefinitions[ioName])}`);
        await ioItem.configure(ioDefinitions[ioName]);
      }

      if (ioItem.init) {
        this.log.debug(`initialize io "${ioName}"`);
        await ioItem.init(ioContext);
      }
    }
  }

  private makeIoContext(): IoContext {
    return {
      log: this.log,
      getIo: <T extends IoItem>(ioName: string): T => {
        return this.ioSet.getIo<T>(ioName);
      },
      getNames: (): string[] => {
        return this.ioSet.getNames();
      }
    };
  }

}
