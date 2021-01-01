import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';

import NetworkLogic, {UriHandler} from './NetworkLogic';


export interface NetworkProps {
}


export default class Network extends ServiceBase<NetworkProps> {
  private logic!: NetworkLogic;


  init = async () => {
    this.logic = new NetworkLogic(
      this.context.service.PeerConnections,
      this.context.config.id,
      this.context.config.config.requestTimeoutSec,
      this.context.config.config.defaultTtl,
      this.context.log.warn,
      this.context.log.error,
    );

    this.logic.init();
  }

  destroy = async () => {
    this.logic.destroy();
  }


  async request(
    toHostId: string,
    uri: string,
    payload: Uint8Array,
    TTL?: number
  ): Promise<Uint8Array> {
    return this.logic.request(toHostId, uri, payload, TTL);
  }

  startListenUri(uri: string, handler: UriHandler) {
    this.logic.startListenUri(uri, handler);
  }

  stopListenUri(uri: string) {
    this.logic.stopListenUri(uri);
  }

}
