import IoSet from '../../../../../../squidlet/__old/system/interfaces/IoSet';
import StartBase from './StartBase';
import IoSetDevelopSrc from '../ioSets/IoSetDevelopSrc';
import Main from '../../../../../../squidlet/__old/system/Main';


export default class StartDevelop extends StartBase {
  protected buildRoot = 'dev';


  async init() {
    await super.init();

    await this.os.mkdirP(this.appWorkDir, { uid: this.uid, gid: this.gid });

    console.info(`Using app work dir ${this.appWorkDir} and build dir ${this.buildWorkDir}`);
    console.info(`Using host "${this.hostConfig.id}" on machine "${this.machine}", platform "${this.platform}"`);
  }


  async start() {
    await super.start();

    const ioSet: IoSet = await this.makeIoSet();

    this.main = await this.startMain(Main, ioSet);
  }


  /**
   * Make development IO set which loads local ts files of IOs.
   */
  protected async makeIoSet(): Promise<IoSet> {
    return new IoSetDevelopSrc(this.os, this.envBuilder);
  }

}
