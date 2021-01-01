import WebSocketClientIo, {OnMessageHandler} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketClientIo';
import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import WsClientLogic, {WsClientLogicProps} from './WsClientLogic';
import IndexedEvents from '../squidlet-lib/src/IndexedEvents';


/**
 * Simplified websocket driver.
 * If autoReconnect if set it holds connection for ever and reconnects if it lost.
 * By calling getInstance() you will get always a new one. There isn't any sessions.
 */
export class WsClient extends DriverBase<WsClientLogicProps> {
  get connectedPromise(): Promise<void> {
    if (!this.client) {
      throw new Error(`WebSocketClient.connectedPromise: ${this.closedMsg}`);
    }

    return this.client.connectedPromise;
  }

  private readonly closeEvents = new IndexedEvents<() => void>();
  private get wsClientIo(): WebSocketClientIo {
    return this.context.getIo('WebSocketClient') as any;
  }
  private client?: WsClientLogic;
  private get closedMsg() {
    return `Connection "${this.props.url}" has been closed`;
  }


  init = async () => {
    this.client = new WsClientLogic(
      this.wsClientIo,
      this.props,
      this.onConnectionClosed,
      this.log.debug,
      this.log.info,
      this.log.error
    );

    await this.client.init();
  }

  destroy = async () => {
    if (!this.client) return;

    await this.client.destroy();
    delete this.client;
  }


  isConnected(): boolean {
    if (!this.client) return false;

    return this.client.isConnected();
  }

  send(data: string | Uint8Array): Promise<void> {
    if (!this.client) throw new Error(`WebSocketClient.send: ${this.closedMsg}`);

    return this.client.send(data);
  }

  onMessage(cb: OnMessageHandler): number {
    if (!this.client) throw new Error(`WebSocketClient.onMessage: ${this.closedMsg}`);

    return this.client.onMessage(cb);
  }

  onClose(cb: () => void): number {
    return this.closeEvents.addListener(cb);
  }

  removeMessageListener(handlerId: number) {
    if (!this.client) return;

    this.client.removeMessageListener(handlerId);
  }

  removeCloseListener(handlerIndex: number) {
    this.closeEvents.removeListener(handlerIndex);
  }


  /**
   * It calls on unexpected closing of connection or on max reconnect tries is exceeded.
   */
  private onConnectionClosed = () => {
    delete this.client;

    this.closeEvents.emit();
  }

}

export default class Factory extends DriverFactoryBase<WsClient, WsClientLogicProps> {
  protected SubDriverClass = WsClient;
  protected instanceId = (props: WsClientLogicProps) => props.url;
}
