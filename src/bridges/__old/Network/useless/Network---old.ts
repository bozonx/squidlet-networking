import ServiceBase from '../../../../../../squidlet/__old/system/base/ServiceBase';
import Context from '../../../../../../squidlet/__old/system/Context';
import EntityDefinition from '../../../../../../squidlet/__old/system/interfaces/EntityDefinition';
import RemoteCallMessage from '../../../../../../squidlet/__old/system/interfaces/RemoteCallMessage';
import Router from './Router';
import NetworkMessage, {MessageType} from './interfaces/NetworkMessage';


interface NodeProps {
  // driver name like: 'SerialNetwork' etc
  driver: string;
  busId: string | number;
}

interface NetworkInterface extends NodeProps {
  // props of network driver
  [index: string]: any;
}

export interface NetworkProps {
  interfaces: NetworkInterface[];
  closestHosts: {[index: string]: NodeProps};
  networkMap: {[index: string]: any};
}

// like [ hostId, networkDriverNum, busId ]
type AddressDefinition = [string, NetworkDriver, number | string];

// TODO: review
enum NetworkDriver {
  serial,
  mqtt,
  wsServer,
  wsClient,
  i2cMaster,
  i2cSlave,
}

export const NETWORK_PORT = 255;


export default class Network extends ServiceBase<NetworkProps> {
  private readonly router: Router;
  // link between { sessionId: [ hostId, networkDriverNum, busId ] }
  private sessionLinks: {[index: string]: AddressDefinition} = {};


  constructor(context: Context, definition: EntityDefinition) {
    super(context, definition);

    this.router = new Router(this.context, this.props);
  }


  init = async () => {
    await this.router.init();
    this.router.onIncomeDestMessage(this.handleIncomeMessage);
    this.context.system.apiManager.onOutcomeRemoteCall(this.handleOutcomeMessages);

    // TODO: слушать что сессия сдохла и удалить связь с hostId
  }

  destroy = async () => {
    this.router.destroy();
  }


  /**
   * Call api method at remote host and return result
   */
  async callApi(toHostId: string, pathToMethod: string, args: any[]): Promise<any> {
    const sessionId: string = this.resolveSessionId(toHostId);

    // TODO: как бы избежать двойного преобразования sessionId?

    return this.context.system.apiManager.callRemoteMethod(sessionId, pathToMethod, ...args);
  }


  private handleIncomeMessage(message: NetworkMessage) {
    const sessionId: string = this.resolveSessionId(message.from);

    this.context.system.apiManager.incomeRemoteCall(sessionId, message.payload)
      .catch(this.log.error);
  }

  private handleOutcomeMessages(sessionId: string, rcMessage: RemoteCallMessage) {
    // TODO: может и не найти - обработать ошибку или создать новую сессию???
    const hostId: string = this.resolveHostId(sessionId);

    this.router.send(hostId, MessageType.remoteCall, rcMessage)
      .catch(this.log.error);
  }

  private resolveHostId(sessionId: string): string {
    // TODO: add !!!!
  }

  /**
   * Return existent session id or
   */
  private resolveSessionId(remoteHostId: string): string {
    // TODO: принять driverName и busId
    // TODO: port нужно добавлять ????
  }

}
