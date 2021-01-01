import IndexedEvents from '../squidlet-lib/src/IndexedEvents';
import {makeUniqId} from '../squidlet-lib/src/uniqId';
import {omitObj} from '../squidlet-lib/src/objects';
import {lastItem} from '../squidlet-lib/src/arrays';
import Connection from '../../../../../squidlet/__old/system/interfaces/Connection';

import {decodeNetworkMessage, encodeNetworkMessage} from './helpers';
import RouteResolver from './RouteResolver';
import NetworkMessage from './interfaces/NetworkMessage';
import {NETWORK_PORT} from './NetworkLogic';


type IncomeMessageHandler = (incomeMessage: NetworkMessage) => void;


// TODO: add get name
// TODO: ping, pong

/**
 * It sends and receives messages into network.
 * It resends messages further to the next subnet.
 */
export default class Router {
  private readonly peerConnections: Connection;
  private readonly myId: string;
  private readonly defaultTtl: number;
  private readonly logWarn: (msg: string) => void;
  private readonly logError: (msg: string) => void;
  private routeResolver: RouteResolver;
  private incomeMessagesEvents = new IndexedEvents<IncomeMessageHandler>();


  constructor(
    peerConnections: Connection,
    myId: string,
    defaultTtl: number,
    logWarn: (msg: string) => void,
    logError: (msg: string) => void,
  ) {
    this.peerConnections = peerConnections;
    this.myId = myId;
    this.defaultTtl = defaultTtl;
    this.logWarn = logWarn;
    this.logError = logError;
    this.routeResolver = new RouteResolver(myId);
  }

  init() {
    this.routeResolver.init();
    this.peerConnections.onIncomeMessage(this.handleIncomeMessages);

    this.peerConnections.onPeerConnect((peerId: string) => {
      // TODO: сделать запрос имени хоста и зарегистрировать его
    });
    this.peerConnections.onPeerDisconnect((peerId: string) => {
      this.routeResolver.deactivatePeer(peerId);
    });
  }

  destroy() {
    this.routeResolver.destroy();
    this.incomeMessagesEvents.destroy();
  }


  newMessageId(): string {
    // TODO: set 8 bytes length
    return makeUniqId();
  }

  onIncomeMessage(cb: IncomeMessageHandler): number {
    return this.incomeMessagesEvents.addListener(cb);
  }

  removeListener(handlerIndex: number) {
    this.incomeMessagesEvents.removeListener(handlerIndex);
  }

  /**
   * Send new message
   * If TTL doesn't set the default value will be used.
   * It just sends and doesn't wait for any response.
   * If it is the new request, make messageId by calling `router.newMessageId()`
   */
  async send(
    toHostId: string,
    uri: string,
    payload: Uint8Array,
    messageId: string,
    TTL?: number
  ) {
    const encodedMessage: Uint8Array = encodeNetworkMessage({
      TTL: TTL || this.defaultTtl,
      messageId,
      uri,
      to: toHostId,
      completeRoute: [this.myId],
      payload,
    });

    await this.sendToPeer(toHostId, encodedMessage);
  }


  private handleIncomeMessages(peerId: string, port: number, payload: Uint8Array) {
    // listen only our port
    if (port !== NETWORK_PORT) return;

    const incomeMessage: NetworkMessage = decodeNetworkMessage(payload);

    this.routeResolver.saveRoute(incomeMessage.completeRoute);
    this.routeResolver.activatePeer(peerId, lastItem(incomeMessage.completeRoute));

    if (incomeMessage.to !== this.myId) {
      // if receiver isn't current host then send message further
      this.sendFurther(incomeMessage)
        .catch(this.logError);

      return;
    }
    // if it is ours - rise an event
    this.incomeMessagesEvents.emit(incomeMessage);
  }

  /**
   * Send mediate message further
   * @param incomeMessage
   */
  private async sendFurther(incomeMessage: NetworkMessage) {
    if (incomeMessage.TTL <= 0) {
      return this.logWarn(
        `TTL of network message has been exceeded: `
        + `${JSON.stringify(omitObj(incomeMessage, 'payload'))}`
        + `. Payload length is ${incomeMessage.payload.length}`
      );
    }

    const encodedMessage: Uint8Array = encodeNetworkMessage({
      ...incomeMessage,
      // add current host as a bearer
      completeRoute: [...incomeMessage.completeRoute, this.myId],
      // decrement TTL on each host
      TTL: incomeMessage.TTL - 1,
    });

    await this.sendToPeer(incomeMessage.to, encodedMessage);
  }

  private async sendToPeer(to: string, payload: Uint8Array) {
    const closestHostId: string | undefined = this.routeResolver.resolveClosestHostId(to);
    // TODO: поидее нужно сделать ping
    if (!closestHostId) throw new Error(`No route to host`);

    const peerId: string | undefined = this.routeResolver.resolvePeerId(closestHostId);

    if (!peerId) throw new Error(`Can't resolve peer of host ${closestHostId}`);

    await this.peerConnections.send(peerId, NETWORK_PORT, payload);
  }

}
