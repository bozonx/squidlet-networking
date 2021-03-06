import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import RemoteCallMessage from '../../../../../squidlet/__old/system/interfaces/RemoteCallMessage';
import {deserializeJson, serializeJson} from '../squidlet-lib/src/serialize';
import {removeItemFromArray} from '../squidlet-lib/src/arrays';
import {WsServerSessions, WsServerSessionsProps} from '../../../../../squidlet-networking/src/drivers/WsServerSessions/WsServerSessions';


// TODO: use Channels|Duplex driver


export default class WsApi extends ServiceBase<WsServerSessionsProps> {
  private sessions: string[] = [];
  private get wsServerSessions(): WsServerSessions {
    return this.depsInstances.wsServer;
  }


  init = async () => {
    this.depsInstances.wsServer = await this.context.getSubDriver('WsServerSessions', this.props);

    this.wsServerSessions.onNewSession((sessionId: string) => {
      this.sessions.push(sessionId);
      this.log.info(`WsApi: new client has connected, session: ${sessionId}`);
    });

    this.wsServerSessions.onSessionClose(this.wrapErrors(async (sessionId: string) => {
      this.sessions = removeItemFromArray(this.sessions, sessionId);

      await this.context.system.apiManager.remoteCallSessionClosed(sessionId);
      this.log.info(`WsApi: client disconnected, session: ${sessionId}`);
    }));

    // listen income api requests
    this.wsServerSessions.onMessage(this.handleIncomeMessages);

    // listen outcome api requests
    this.context.system.apiManager.onOutcomeRemoteCall(this.handleOutcomeMessages);
  }

  destroy = async () => {
    for (let sessionId of this.sessions) {
      await this.wsServerSessions.destroySession(sessionId);
    }

    delete this.sessions;
  }


  private handleIncomeMessages = this.wrapErrors(async (sessionId: string, data: string | Uint8Array) => {
    if (!this.sessions.includes(sessionId)) return;

    let msg: RemoteCallMessage;

    try {
      msg = deserializeJson(data);
    }
    catch (err) {
      throw new Error(`WsApi: Can't decode message: ${err}`);
    }

    return this.context.system.apiManager.incomeRemoteCall(sessionId, msg);
  });

  private handleOutcomeMessages = this.wrapErrors(async (sessionId: string, message: RemoteCallMessage) => {
    const binData: Uint8Array = serializeJson(message);

    return this.wsServerSessions.send(sessionId, binData);
  });

}
