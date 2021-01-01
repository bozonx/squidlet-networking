// TODO: not actual because full build isn't under development at the moment. Use light build.

import * as path from 'path';

import Os from '../../../../../../squidlet/__old/shared/helpers/Os';
import GroupConfigParser from '../../../../../../squidlet/__old/shared/helpers/GroupConfigParser';
import systemConfig from '../../../../../../squidlet/__old/system/systemConfig';
import NodejsMachines from '../interfaces/NodejsMachines';
import {ENV_BUILD_TMP_DIR} from '../../../../../../squidlet/__old/shared/constants';
import EnvBuilder from '../../../../../../squidlet/__old/hostEnvBuilder/EnvBuilder';
import Props from '../../../../../../squidlet/__old/__veryold/nodejs/Props';
import ProdBuild from './ProdBuild';
import IoSetLocal from '../../../../../../squidlet/__old/system/IoSetLocal';
import IoSet from '../../../../../../squidlet/__old/system/interfaces/IoSet';
import LogLevel from '../../../../../../squidlet/__old/system/interfaces/LogLevel';


// TODO: extend StartBase
export default class StartProd {
  private readonly os: Os = new Os();
  private readonly groupConfig: GroupConfigParser;
  private readonly props: Props;
  private readonly prodBuild: ProdBuild;
  private _envBuilder?: EnvBuilder;
  private get envBuilder(): EnvBuilder {
    return this._envBuilder as any;
  }


  constructor(
    configPath: string,
    //argForce?: boolean,
    argLogLevel?: LogLevel,
    argMachine?: NodejsMachines,
    argHostName?: string,
    argWorkDir?: string,
    argUser?: string,
    argGroup?: string,
  ) {
    this.groupConfig = new GroupConfigParser(this.os, configPath);
    this.props = new Props(
      this.os,
      this.groupConfig,
      'prod',
      //argForce,
      argLogLevel,
      argMachine,
      argHostName,
      argWorkDir,
      argUser,
      argGroup,
    );
    this.prodBuild = new ProdBuild(this.os, this.props);
  }

  async init() {
    await this.groupConfig.init();
    await this.props.resolve();

    //const tmpDir = path.join(this.props.tmpDir, HOST_ENVSET_DIR);
    const appEnvSetDir = path.join(this.props.appWorkDir, systemConfig.rootDirs.envSet);
    const envSetTmpDir = path.join(this.props.buildWorkDir, ENV_BUILD_TMP_DIR);

    if (!this.props.machine) {
      throw new Error(`No defined machine`);
    }

    this._envBuilder = new EnvBuilder(
      this.props.hostConfig,
      appEnvSetDir,
      envSetTmpDir,
      this.props.platform,
      this.props.machine,
      { uid: this.props.uid, gid: this.props.gid }
    );

    await this.os.mkdirP(this.props.appWorkDir, { uid: this.props.uid, gid: this.props.gid });

    console.info(`Using app work dir ${this.props.appWorkDir} and build dir ${this.props.buildWorkDir}`);
    console.info(`Use host "${this.props.hostConfig.id}" on machine "${this.props.machine}", platform "${this.props.platform}"`);
  }

  destroy = async () => {
    // TODO: add
  }


  async start() {
    console.info(`===> collect env set`);
    await this.envBuilder.collect();

    //await this.os.mkdirP(this.props.varDataDir, { uid: this.props.uid, gid: this.props.gid });

    //await this.installModules();
    await this.makeSystemSymLink();

    //if (!this.props.force && await this.os.exists(prodSystemDirPath)) return;
    await this.prodBuild.buildInitialSystem();
    // build config and entities
    await this.envBuilder.writeEnv();
    // build platforms
    await this.prodBuild.buildIos();

    // TODO: pass workDir
    const ioSet: IoSet = new IoSetLocal();

    //await this.systemStarter.start(this.getPathToProdSystemDir(), ioSet);
    // TODO: make starter
  }


  // TODO: review. Better to use just in package.json postinstall script
  private async makeSystemSymLink() {
    const nodeModulesDir = this.getNodeModulesDir();
    const symLinkDst = path.join(nodeModulesDir, 'system');

    console.info(`===> Making symlink from "${this.getPathToProdSystemDir()}" to "${symLinkDst}"`);

    await this.os.mkdirP(nodeModulesDir, { uid: this.props.uid, gid: this.props.gid });

    try {
      await this.os.symlink(
        this.getPathToProdSystemDir(),
        symLinkDst,
        { uid: this.props.uid, gid: this.props.gid }
      );
    }
    catch (e) {
      // do nothing - link exists
    }
  }

  private getPathToProdSystemDir(): string {
    return path.join(this.props.appWorkDir, systemConfig.rootDirs.envSet, systemConfig.envSetDirs.system);
  }

  private getNodeModulesDir(): string {
    return path.join(this.props.appWorkDir, 'node_modules');
  }

}


// /**
//  * It builds package.json and installs node modules into root of working directory.
//  * And it makes link to system in node_modules/system.
//  * It installs only if node_modules directory doesn't exist it force parameter isn't set.
//  */
// private async installModules() {
//   // do not install node modules if they have been installed previously
//   if (!this.props.force && await this.os.exists(this.getNodeModulesDir())) {
//     console.info(`Directory node_modules exists. It doesn't need to run npm install`);
//
//     return;
//   }
//
//   console.info(`===> writing package.json`);
//
//   await this.prodBuild.buildPackageJson(this.envBuilder.configManager.dependencies);
//
//   console.info(`===> Installing npm modules`);
//
//   if (!isEmptyObject(this.envBuilder.configManager.dependencies)) {
//     await this.runNpmInstall();
//   }
// }
//
// private async runNpmInstall() {
//   const cmd = `npm install`;
//
//   const result: SpawnCmdResult = await this.os.spawnCmd(cmd, this.props.appWorkDir, {
//     uid: this.props.uid,
//     gid: this.props.gid,
//   });
//
//   if (result.status) {
//     console.error(`ERROR: npm ends with code ${result.status}`);
//     console.error(result.stdout);
//     console.error(result.stderr);
//   }
// }
