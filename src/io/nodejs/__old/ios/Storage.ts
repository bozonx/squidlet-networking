import * as fs from 'fs';
import {Stats} from 'fs';
import * as path from 'path';

import StorageIo, {StatsSimplified, ConfigParams} from '../../../../../../squidlet/__old/system/interfaces/io/StorageIo';
import {callPromised} from '../squidlet-lib/src/common';
import {convertBufferToUint8Array} from '../squidlet-lib/src/buffer';
import {ENCODE} from '../squidlet-lib/src/constants';
import {trimCharEnd} from '../squidlet-lib/src/strings';
import {PATH_SEP} from '../squidlet-lib/src/paths';


let config: ConfigParams | undefined;


export default class Storage implements StorageIo {
  //private readonly os = new Os();

  async configure(configParams: ConfigParams): Promise<void> {
    // remove trailing slash if set
    const resolvedWorkDir: string | undefined = (configParams.workDir)
      ? trimCharEnd(configParams.workDir, PATH_SEP)
      : undefined;

    config = {
      ...config,
      ...configParams,
    };

    if (resolvedWorkDir) config.workDir = resolvedWorkDir;
  }

  async appendFile(pathTo: string, data: string | Uint8Array): Promise<void> {
    const resolvedPath = this.resolvePath(pathTo);
    const wasExist: boolean = await this.exists(pathTo);

    if (typeof data === 'string') {
      await callPromised(fs.appendFile, resolvedPath, data, ENCODE);
    }
    else {
      await callPromised(fs.appendFile, resolvedPath, data);
    }

    if (!wasExist) await this.chown(resolvedPath);
  }

  async mkdir(pathTo: string): Promise<void> {
    const resolvedPath = this.resolvePath(pathTo);

    await callPromised(fs.mkdir, resolvedPath);
    await this.chown(resolvedPath);
  }

  readdir(pathTo: string): Promise<string[]> {
    const resolvedPath = this.resolvePath(pathTo);

    return callPromised(fs.readdir, resolvedPath, ENCODE) as Promise<string[]>;
  }

  readFile(pathTo: string): Promise<string> {
    const resolvedPath = this.resolvePath(pathTo);

    return callPromised(fs.readFile, resolvedPath, ENCODE) as Promise<string>;
  }

  readlink(pathTo: string): Promise<string> {
    const resolvedPath = this.resolvePath(pathTo);

    return callPromised(fs.readlink, resolvedPath);
  }

  async readBinFile(pathTo: string): Promise<Uint8Array> {
    const resolvedPath = this.resolvePath(pathTo);

    const buffer: Buffer = await callPromised(fs.readFile, resolvedPath);

    return convertBufferToUint8Array(buffer);
  }

  rmdir(pathTo: string): Promise<void> {
    const resolvedPath = this.resolvePath(pathTo);

    return callPromised(fs.rmdir, resolvedPath);
  }

  unlink(pathTo: string): Promise<void> {
    const resolvedPath = this.resolvePath(pathTo);

    return callPromised(fs.unlink, resolvedPath);
  }

  async writeFile(pathTo: string, data: string | Uint8Array): Promise<void> {
    const resolvedPath = this.resolvePath(pathTo);

    if (typeof data === 'string') {
      await callPromised(fs.writeFile, resolvedPath, data, ENCODE);
    }
    else {
      await callPromised(fs.writeFile, resolvedPath, data);
    }

    await this.chown(resolvedPath);
  }

  async stat(pathTo: string): Promise<StatsSimplified> {
    const resolvedPath = this.resolvePath(pathTo);
    const stat = await callPromised(fs.lstat, resolvedPath);

    return {
      size: stat.size,
      dir: stat.isDirectory(),
      symbolicLink: stat.isSymbolicLink(),
      mtime: stat.mtime.getTime(),
    };
  }

  async exists(pathTo: string): Promise<boolean> {
    const resolvedPath = this.resolvePath(pathTo);

    return new Promise<boolean>((resolve) => {
      fs.access(resolvedPath, fs.constants.F_OK, (err) => {
        if (err) return resolve(false);

        resolve(true);
      });
    });
  }


  ////// additional

  async copyFile(src: string, dest: string): Promise<void> {
    const resolvedDest = this.resolvePath(dest);

    await callPromised(fs.copyFile, this.resolvePath(src), resolvedDest);
    await this.chown(resolvedDest);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const resolvedNewPath = this.resolvePath(newPath);

    await callPromised(fs.rename, this.resolvePath(oldPath), resolvedNewPath);
    await this.chown(resolvedNewPath);
  }


  private async chown(pathTo: string) {
    if (!config) return;

    if (typeof config.uid === 'undefined' && typeof config.gid === 'undefined') {
      // noting to change - just return
      return;
    }
    else if (typeof config.uid !== 'undefined' && typeof config.gid !== 'undefined') {
      // uid and gid are specified - set both
      return await callPromised(fs.chown, pathTo, config.uid, config.gid);
    }

    // else load stats to resolve lack of params

    const stat: Stats = await callPromised(fs.lstat, pathTo);

    await callPromised(
      fs.chown,
      pathTo,
      (typeof config.uid === 'undefined') ? stat.uid : config.uid,
      (typeof config.gid === 'undefined') ? stat.gid : config.gid,
    );
  }

  private resolvePath(pathTo: string): string {
    if (!config || !config.workDir) throw new Error(`Storage IO: workDir han't been set`);

    return path.join(config.workDir, pathTo);
  }

}
