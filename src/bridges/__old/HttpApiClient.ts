import * as path from 'path';
import * as fs from 'fs';

import HttpClient from '../../platforms/nodejs/ios/HttpClient';
import HttpClientLogic from '../../../../squidlet-networking/src/drivers/HttpClient/HttpClientLogic';
import {ENCODE} from '../../../../squidlet-lib/src/constants';
import * as yaml from 'js-yaml';
import {collectPropsDefaults} from '../../system/lib/helpers';
import {HttpDriverRequest} from '../../../../squidlet-networking/src/drivers/HttpServer/HttpServerLogic';
import {HttpApiBody} from '../../../../squidlet-networking/src/bridges/__old/HttpApi/HttpApi';
import {JsonTypes} from '../../system/interfaces/Types';
import {HttpResponse} from '../../system/interfaces/Http';


const httpApiManifestPath = path.resolve(__dirname, '../../entities/services/HttpApi/manifest.yaml');
const httpClientIo = new HttpClient();


export default class HttpApiClient {
  readonly port: number;
  readonly hostPort: string;

  private readonly logDebug: (msg: string) => void;
  private readonly client: HttpClientLogic;
  private readonly baseUrl: string;


  constructor(logDebug: (msg: string) => void, host: string = 'localhost', port?: number) {
    this.logDebug = logDebug;
    this.client = new HttpClientLogic(
      httpClientIo,
      {},
      this.logDebug
    );

    this.port = (port) ? port : this.loadDefaultPort();
    this.hostPort = `${host}:${this.port}`;

    this.baseUrl = `http://${this.hostPort}/api`;
  }


  async callMethod<T extends (JsonTypes | undefined) = (JsonTypes | undefined)>(
    apiMethodName: string,
    ...args: any[]
  ): Promise<T> {
    const url: string = `${this.baseUrl}/${apiMethodName}/${this.prepareArgsString(args)}`;
    const request: HttpDriverRequest = {
      url,
      method: 'get',
      headers: {},
    };

    this.logDebug(`HttpApiClient: request url: ${url}`);

    const result = await this.client.fetch(request);

    return this.parseResult<T>(url, result);
  }


  private loadDefaultPort(): number {
    const yamlContent: string = fs.readFileSync(httpApiManifestPath, ENCODE);
    const serviceManifest = yaml.safeLoad(yamlContent) as {[index: string]: any};
    const serviceProps = collectPropsDefaults(serviceManifest.props);

    return serviceProps.port;
  }

  private prepareArgsString(args: any[]): string {
    const result = args.map((item) => JSON.stringify(item)).join(',');

    return encodeURIComponent(result);
  }

  private parseResult<T extends (JsonTypes | undefined) = (JsonTypes | undefined)>(
    url: string,
    result: HttpResponse
  ): T {

    // TODO: review  - может вернут undefined если нет body ???

    if (!result.body) {
      throw new Error(`Result of request "${url}" doesn't content body`);
    }

    const body: HttpApiBody = result.body as any;

    if (result.status !== 200) {
      if (body.error) throw new Error(body.error);

      throw new Error(`Result of request "${url}" returns not successful status "${result.status}" but there isn't error string.`);
    }

    // if (!body.result) {
    //   throw new Error(`Result of request "${url}" doesn't content "result" in the body`);
    // }

    //return body as T;
    return body?.result as T;
  }

}
