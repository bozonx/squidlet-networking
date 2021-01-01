import {createServer, IncomingMessage, Server, ServerResponse} from 'http';

import {
  HttpRequestHandler,
  HttpServerEvent,
  HttpServerIo,
  HttpServerProps
} from '../../../../../../squidlet/__old/system/interfaces/io/HttpServerIo';
import IndexedEventEmitter, {DefaultHandler} from '../squidlet-lib/src/IndexedEventEmitter';
import {WAIT_RESPONSE_TIMEOUT_SEC} from '../../../../../../squidlet/__old/system/constants';
import {makeUniqNumber} from '../squidlet-lib/src/uniqId';
import {callPromised} from '../squidlet-lib/src/common';
import {HttpRequest, HttpResponse} from '../../../../../../squidlet/__old/system/interfaces/Http';


type ServerItem = [
  // Http server instance
  Server,
  // server's events
  IndexedEventEmitter<DefaultHandler>,
  // is server listening.
  boolean
];

enum ITEM_POSITION {
  server,
  events,
  listeningState
}

const RESPONSE_EVENT = 'res';


export default class HttpServer implements HttpServerIo {
  private readonly servers: ServerItem[] = [];


  async destroy() {
    for (let serverId in this.servers) {
      // destroy events of server
      // TODO: review
      if (this.servers[Number(serverId)] && this.servers[Number(serverId)][ITEM_POSITION.events]) {
        this.servers[Number(serverId)][ITEM_POSITION.events].destroy();
      }

      // TODO: not emit events
      await this.closeServer(serverId);
    }
  }


  async newServer(props: HttpServerProps): Promise<string>{
    const serverId: string = String(this.servers.length);

    this.servers.push( this.makeServer(serverId, props) );

    return serverId;
  }

  async closeServer(serverId: string): Promise<void> {
    const serverIdNum: number = Number(serverId);
    if (!this.servers[serverIdNum]) return;

    const serverItem = this.servers[serverIdNum];

    serverItem[ITEM_POSITION.events].destroy();
    // TODO: если раскоментировать то будет ошибка при дестрое
    //await callPromised(serverItem[ITEM_POSITION.server].close.bind(serverItem[ITEM_POSITION.server]));

    delete this.servers[serverIdNum];

    // TODO: НЕ должно при этом подняться событие close или должно???
    // TODO: отписаться от всех событий навешанный на этот сервер
  }

  async onServerClose(serverId: string, cb: () => void): Promise<number> {
    const serverItem = this.getServerItem(serverId);

    return serverItem[ITEM_POSITION.events].addListener(HttpServerEvent.serverClose, cb);
  }

  async onServerError(serverId: string, cb: (err: string) => void): Promise<number> {
    const serverItem = this.getServerItem(serverId);

    return serverItem[ITEM_POSITION.events].addListener(HttpServerEvent.serverError, cb);
  }

  async onServerListening(serverId: string, cb: () => void): Promise<number> {
    const serverItem = this.getServerItem(serverId);

    if (serverItem[ITEM_POSITION.listeningState]) {
      cb();

      return -1;
    }

    return serverItem[ITEM_POSITION.events].once(HttpServerEvent.listening, cb);
  }

  async onRequest(serverId: string, cb: HttpRequestHandler): Promise<number> {
    const serverItem = this.getServerItem(serverId);

    return serverItem[ITEM_POSITION.events].addListener(HttpServerEvent.request, cb);
  }

  async sendResponse(serverId: string, requestId: number, response: HttpResponse): Promise<void> {
    const serverItem = this.getServerItem(serverId);

    return serverItem[ITEM_POSITION.events].emit(RESPONSE_EVENT, requestId, response);
  }

  async removeListener(serverId: string, handlerIndex: number): Promise<void> {
    if (!this.servers[Number(serverId)]) return;

    return this.servers[Number(serverId)][ITEM_POSITION.events].removeListener(handlerIndex);
  }


  private makeServer(serverId: string, props: HttpServerProps): ServerItem {
    const events = new IndexedEventEmitter();
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleIncomeRequest(serverId, req, res)
          .catch((e: Error) => events.emit(HttpServerEvent.serverError, e));
    });

    server.on('error', (err: Error) => events.emit(HttpServerEvent.serverError, String(err)));
    server.on('close', () => events.emit(HttpServerEvent.serverClose));

    server.listen(props.port, props.host, () => this.handleServerStartListening(serverId));

    return [
      server,
      events,
      // not listening at the moment
      false
    ];
  }

  private handleServerStartListening = (serverId: string) => {
    const serverItem = this.getServerItem(serverId);

    serverItem[ITEM_POSITION.listeningState] = true;

    serverItem[ITEM_POSITION.events].emit(HttpServerEvent.listening);
  }

  private handleIncomeRequest(serverId: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.servers[Number(serverId)]) return Promise.resolve();

    const events = this.servers[Number(serverId)][ITEM_POSITION.events];

    return new Promise<void>((resolve, reject) => {
      let handlerIndex: number;
      let waitTimeout: any;
      const requestId: number = makeUniqNumber();
      const httpRequest: HttpRequest = this.makeRequestObject(req);

      const respHandler = (receivedRequestId: number, response: HttpResponse) => {
        // listen only expected requestId
        if (receivedRequestId !== requestId) return;

        clearTimeout(waitTimeout);
        events.removeListener(handlerIndex, RESPONSE_EVENT);

        this.setupResponse(response, res);

        resolve();
      };

      handlerIndex = events.addListener(RESPONSE_EVENT, respHandler);

      waitTimeout = setTimeout(() => {
        events.removeListener(handlerIndex, RESPONSE_EVENT);
        reject(
          `HttpServerIo: Wait for response: Timeout has been exceeded. ` +
          `Server ${serverId}. ${req.method} ${req.url}`
        );
      }, WAIT_RESPONSE_TIMEOUT_SEC * 1000);

      events.emit(HttpServerEvent.request, requestId, httpRequest);
    });
  }

  private makeRequestObject(req: IncomingMessage): HttpRequest {
    // TODO: review
    let body: string | Buffer | undefined;

    //req.

    // if (typeof req.body === 'string') {
    //   body = req.body;
    // }
    // else {
    //   // TODO: convert Uint8Array to Buffer
    //   body = req.body;
    // }

    //console.log(111111, req.method, req.url, req.headers);

    return  {
      // method of http request is in upper case format
      method: (req.method || 'get').toLowerCase() as any,
      url: req.url || '',
      headers: req.headers as any,
      body,
    };
  }

  private setupResponse(response: HttpResponse, httpRes: ServerResponse) {
    httpRes.writeHead(response.status, response.headers as {[index: string]: string});

    if (typeof response.body === 'string') {
      httpRes.end(response.body);
    }
    else {
      // TODO: support of Buffer - convert from Uint8Arr to Buffer
    }
  }

  private getServerItem(serverId: string): ServerItem {
    if (!this.servers[Number(serverId)]) {
      throw new Error(`РеезServer: Server "${serverId}" hasn't been found`);
    }

    return this.servers[Number(serverId)];
  }

}
