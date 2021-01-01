import * as path from 'path';
import _template = require('lodash/template');

import systemConfig from '../../../../../../squidlet/__old/system/systemConfig';
import BuildSystem from '../../../../../../squidlet/__old/shared/envSetBuild/BuildSystem';
import BuildIo from '../../../../../../squidlet/__old/shared/envSetBuild/BuildIo';
import {SQUIDLET_PACKAGE_JSON_PATH} from '../../../../../../squidlet/__old/shared/helpers/helpers';
import Os from '../../../../../../squidlet/__old/shared/helpers/Os';
import PackageJson from '../../../../../../squidlet/__old/shared/interfaces/PackageJson';
// TODO: don't use props
import Props from '../../../../../../squidlet/__old/__veryold/nodejs/Props';
import {ENV_BUILD_TMP_DIR} from '../../../../../../squidlet/__old/shared/constants';


export const PACKAGE_JSON_TEMPLATE_PATH = path.resolve(__dirname, './package.json.template');


export default class ProdBuild {
  private readonly os: Os;
  private readonly props: Props;
  private buildSystem: BuildSystem;


  constructor(os: Os, props: Props) {
    this.os = os;
    this.props = props;
    this.buildSystem = new BuildSystem(this.os);
  }


  /**
   * Build system to workDir/envsSet/system
   */
  async buildInitialSystem() {
    const systemBuildDir = path.join(
      this.props.appWorkDir,
      systemConfig.rootDirs.envSet,
      systemConfig.envSetDirs.system
    );
    const systemTmpDir = path.join(
      this.props.buildWorkDir,
      ENV_BUILD_TMP_DIR,
      systemConfig.envSetDirs.system
    );

    console.info(`===> Building system to "${systemBuildDir}"`);

    await this.buildSystem.build(systemBuildDir, systemTmpDir);
  }

  /**
   * Build platforms files to workDir/platforms
   */
  async buildIos() {
    console.info(`===> Building io`);

    const buildDir = path.join(
      this.props.appWorkDir,
      systemConfig.rootDirs.envSet,
      systemConfig.envSetDirs.ios
    );
    const tmpDir = path.join(
      this.props.buildWorkDir,
      ENV_BUILD_TMP_DIR,
      systemConfig.envSetDirs.ios
    );

    await this.doBuildIo(buildDir, tmpDir);
  }

  async buildPackageJson(dependencies: {[index: string]: any} = {}) {
    const packageJson: string = await this.generatePackageJson(dependencies);

    await this.os.writeFile(path.join(this.props.appWorkDir, 'package.json'), packageJson, {
      uid: this.props.uid,
      gid: this.props.gid,
    });
  }

  private async generatePackageJson(dependencies: {[index: string]: any}): Promise<string> {
    const templateContent: string = await this.os.getFileContent(PACKAGE_JSON_TEMPLATE_PATH);
    const squildletPackageJson: PackageJson = this.os.require(SQUIDLET_PACKAGE_JSON_PATH);

    return _template(templateContent)({
      version: squildletPackageJson.version,
      dependencies: JSON.stringify(dependencies),
    });
  }

  private async doBuildIo(buildDir: string, tmpDir: string) {
    if (!this.props.machine) {
      throw new Error(`No defined machine`);
    }

    const buildIo: BuildIo = new BuildIo(
      this.os,
      this.props.platform,
      this.props.machine,
      buildDir,
      tmpDir,
      { uid: this.props.uid, gid: this.props.gid }
    );

    await buildIo.build();
  }

}
