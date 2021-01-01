import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import {WsServerSessionsProps} from '../../../../../squidlet-networking/src/drivers/WsServerSessions/WsServerSessions';
import IoServerConnectionLogic from './IoServerConnectionLogic';
import {WsServer} from '../../../../../squidlet-networking/src/drivers/WsServer/WsServer';


export default class IoServer extends ServiceBase<WsServerSessionsProps> {
  private wsServer!: WsServer;
  private ioConnection?: IoServerConnectionLogic;


  init = async () => {
    this.log.info('--> Initializing websocket io servers');

    this.wsServer = await this.context.getSubDriver('WsServer', this.props);

    this.wsServer.onMessage((connectionId: string, data: string | Uint8Array) => {
      if (!this.ioConnection) {
        return this.log.error(`IoServer.onMessage: no ioConnection`);
      }

      this.ioConnection.incomeMessage(connectionId, data)
        .catch(this.log.error);
    });
    this.wsServer.onConnection((connectionId: string) => {
      this.handleNewIoClientConnection(connectionId)
        .catch(this.log.error);
    });
    this.wsServer.onConnectionClose(() => {
      this.handleIoClientCloseConnection()
        .catch(this.log.error);
    });
  }

  destroy = async () => {
    this.log.info('... destroying IoServer');
    this.ioConnection && await this.ioConnection.destroy();
    await this.wsServer.destroy();

    delete this.ioConnection;
  }


  private handleNewIoClientConnection = async (connectionId: string) => {
    if (this.ioConnection) {
      const msg = `Only one connection is allowed`;

      this.log.error(msg);
      await this.wsServer.closeConnection(connectionId, 1, msg);

      return;
    }

    // turn off HttpApi of IoServer
    try {
      await this.context.service['httpApi'].disable();
    }
    catch (e) {
      console.warn(e);
    }

    this.ioConnection = new IoServerConnectionLogic(
      connectionId,
      this.context,
      this.wsServer.send,
      this.log.debug,
      this.log.error
    );

    this.ioConnection.setReadyState();

    this.log.info(`New IO client has been connected`);
  }

  private handleIoClientCloseConnection = async () => {
    this.ioConnection && await this.ioConnection.destroy();

    delete this.ioConnection;

    this.log.info(`IO client has been disconnected`);
  }

}
