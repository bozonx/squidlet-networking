import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import Connection, {
  CONNECTION_SERVICE_TYPE,
  ConnectionServiceType,
  ConnectionsEvents,
  IncomeMessageHandler,
  PeerStatusHandler
} from '../../../../../squidlet/__old/system/interfaces/Connection';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import {ConnectionParams, WebSocketServerProps} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';

import {WsServer} from '../../../../../squidlet-networking/src/drivers/WsServer/WsServer';


export default class WsServerConnection
  extends ServiceBase<WebSocketServerProps>
  implements Connection
{
  serviceType: ConnectionServiceType = CONNECTION_SERVICE_TYPE;

  private events = new IndexedEventEmitter();
  private server!: WsServer;


  init = async () => {
    // it creates a new server on specified host:port
    this.server = await this.context.getSubDriver('WsServer', this.props);

    this.server.onMessage(this.handleIncomeMessage);
    this.server.onConnection((connectionId: string, connectionParams: ConnectionParams) => {
      this.events.emit(ConnectionsEvents.connected, connectionId);
    });
    this.server.onConnectionClose((connectionId: string) => {
      this.events.emit(ConnectionsEvents.disconnected, connectionId);
    });
  }


  /**
   * Send data to peer and don't wait for response.
   * Port is from 0 and up to 255.
   */
  async send(peerId: string, port: number, payload: Uint8Array): Promise<void> {
    await this.server.send(peerId, new Uint8Array([port, ...payload]));
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


  private handleIncomeMessage = (connectionId: string, data: string | Uint8Array) => {
    if (!(data instanceof Uint8Array) || !data.length) return;

    const [port, ...rest] = data;
    const payload = new Uint8Array(rest);
    // peerId is actually connectionId
    this.events.emit(ConnectionsEvents.message, connectionId, port, payload);
  }

}
