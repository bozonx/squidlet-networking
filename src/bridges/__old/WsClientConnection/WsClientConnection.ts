import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import Connection, {
  CONNECTION_SERVICE_TYPE,
  ConnectionServiceType, ConnectionsEvents,
  IncomeMessageHandler, PeerStatusHandler
} from '../../../../../squidlet/__old/system/interfaces/Connection';
import {WebSocketClientProps} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketClientIo';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';

import {WsClient} from '../../../../../squidlet-networking/src/drivers/WsClient/WsClient';


export default class WsClientConnection extends ServiceBase<WebSocketClientProps> implements Connection {
  serviceType: ConnectionServiceType = CONNECTION_SERVICE_TYPE;

  private events = new IndexedEventEmitter();
  private client!: WsClient;


  init = async () => {
    this.client = await this.context.getSubDriver('WsClient', this.props);

    this.client.onMessage(this.handleIncomeMessage);
    // TODO: add on connected и выдавать connectionId
    // TODO: use connectedPromise !!!
    this.client.onClose(() => {
      // TODO: add
    });
  }

  // TODO: получается конкретный инстанс this.client подключен к конкретному серверу и
  //       должен иметь постоянны connectionId, но если отвалится то его менять????

  /**
   * Send data to peer and don't wait for response.
   * Port is from 0 and up to 255.
   */
  async send(peerId: string, port: number, payload: Uint8Array): Promise<void> {
    // TODO: клиент может быть подключен к нескольким серверам
    await this.client.send(new Uint8Array([port, ...payload]));
  }

  onIncomeMessage(cb: IncomeMessageHandler): number {
    return this.events.addListener(ConnectionsEvents.message, cb);
  }

  onPeerConnect(cb: PeerStatusHandler): number {
    return this.events.addListener(ConnectionsEvents.connected, cb);
  }

  onPeerDisconnect(cb: PeerStatusHandler): number {
    return this.events.addListener(ConnectionsEvents.disconnected, cb);
  }

  /**
   * Remove listener of onIncomeData, onPeerConnect or onPeerDisconnect
   */
  removeListener(handlerIndex: number): void {
    this.events.removeListener(handlerIndex);
  }


  // TODO: поидее нужно добавить connectionId
  private handleIncomeMessage = (data: string | Uint8Array) => {
    if (!(data instanceof Uint8Array) || !data.length) return;

    const [port, ...rest] = data;
    const payload = new Uint8Array(rest);
    // peerId is actually connectionId
    this.events.emit(ConnectionsEvents.message, connectionId, port, payload);
  }

}
