import IoSet from '../../../../../../squidlet/__old/system/interfaces/IoSet';
import LogLevel from '../../../../../../squidlet/__old/system/interfaces/LogLevel';
import IoSetDevelopRemote from '../ioSets/IoSetDevelopRemote';
import StartBase from './StartBase';
import {IOSET_STRING_DELIMITER} from '../../../../../../squidlet/__old/shared/constants';
import Platforms from '../../../../../../squidlet/__old/system/interfaces/Platforms';
import HostInfo from '../../../../../../squidlet/__old/system/interfaces/HostInfo';
import HttpApiClient from '../../../../bridges/__old/HttpApiClient';
import Main from '../../../../../../squidlet/__old/system/Main';
import Sender from '../../../../../../squidlet-lib/src/Sender';
import {WAIT_RESPONSE_TIMEOUT_SEC} from '../../../../../../squidlet/__old/system/constants';
import ConsoleLoggerColorful from '../../../../../../squidlet/__old/shared/helpers/ConsoleLoggerColorful';


const SENDER_RESEND_INTERVAL_SEC = 1;
const SENDER_REPEATS = 10;
const SENDER_REPEATS_INTERVAL_SEC = 2;


export default class StartRemoteDevelop extends StartBase {
  protected buildRoot = 'remote';

  private remoteHostInfo?: HostInfo;
  private readonly host: string;
  private readonly port?: number;
  private readonly httpApiClient: HttpApiClient;
  private readonly sender: Sender;


  constructor(configPath: string, logLevel?: LogLevel, hostName?: string, argIoSet?: string) {
    super(configPath, {
      logLevel,
      machine: 'noMachine',
      hostName,
    });

    if (!argIoSet) throw new Error(`--ioset param is required`);

    // TODO: поидее нужно распарсить уровнем выше
    const {host, port} = this.parseIoSetString(argIoSet);

    this.host = host;
    this.port = port;
    this.httpApiClient = new HttpApiClient(console.log, this.host, this.port);
    this.sender = new Sender(
      WAIT_RESPONSE_TIMEOUT_SEC,
      SENDER_RESEND_INTERVAL_SEC,
      console.log,
      console.warn
    );
  }

  async init() {
    this.remoteHostInfo = await this.switchAppAndGetInfo();

    // TODO: как будет резолвится machine etc ???
    await super.init();

    if (!this.remoteHostInfo) throw new Error(`no remoteHostInfo`);

    console.info(`Using remote ioset of host "${this.httpApiClient.hostPort}".`);
    console.info(`Remote machine: ${this.remoteHostInfo.machine}, ${this.remoteHostInfo.platform}`);
  }


  async start() {
    await super.start();

    const ioSet: IoSet = await this.makeIoSet();
    const logger = new ConsoleLoggerColorful(this.starterProps.logLevel);

    this.main = new Main(ioSet, logger, {
      appType: 'app',
    });

    console.info(`===> Starting app`);

    await this.main.init();
    await this.main.start();
  }

  /**
   * Resolve which platforms set will be used and make instance of it and pass ioSet config.
   */
  protected async makeIoSet(): Promise<IoSet> {
    if (!this.remoteHostInfo) throw new  Error(`No remote host info`);

    const ioSet = new IoSetDevelopRemote(
      this.os,
      this.envBuilder,
      this.remoteHostInfo.usedIo,
      this.host,
      this.port
    );

    return ioSet;
  }

  protected resolvePlatformMachine(): {platform: Platforms, machine: string} {
    if (!this.remoteHostInfo) throw new  Error(`No remote host info`);

    return {
      platform: this.remoteHostInfo.platform,
      machine: this.remoteHostInfo.machine,
    };
  }


  private parseIoSetString(ioSetString?: string): {host: string, port?: number} {
    if (!ioSetString) throw new Error(`IoSet host is required`);

    const splat = ioSetString.split(IOSET_STRING_DELIMITER);

    return {
      host: splat[0],
      port: splat[1] && parseInt(splat[1]) || undefined,
    };
  }

  private async switchAppAndGetInfo(): Promise<HostInfo> {
    const info: HostInfo = await this.httpApiClient.callMethod('info') as any;

    if (info.appType === 'ioServer') return info;

    await this.httpApiClient.callMethod('switchApp', 'ioServer');

    for (let i = 0; i < SENDER_REPEATS; i++) {
      let result: HostInfo | undefined;

      await new Promise<void>((resolve, reject) => {
        //if (i >= SENDER_REPEATS -1)
        setTimeout(() => {
          this.sender.send<HostInfo>('info', () => this.httpApiClient.callMethod('info') as any)
            .then((hostInfo: HostInfo) => {
              // just end cycle if app hasn't been switched
              if (hostInfo.appType !== 'ioServer') return resolve();

              result = hostInfo;

              resolve();
            })
            .catch((e) => resolve);
        }, SENDER_REPEATS_INTERVAL_SEC * 1000);
      });
      // exit cycle if there is a result
      if (result) return result;

      console.info(`App hasn't been switched, try again`);
    }

    throw new Error(`App hasn't been switched during timeout`);
  }

}
