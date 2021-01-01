import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import {ConnectionParams} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';
import {WebSocketServerProps} from '../../../../../squidlet/__old/system/interfaces/io/WebSocketServerIo';
import {parseCookie} from '../squidlet-lib/src/cookies';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import {getKeyOfObject} from '../squidlet-lib/src/objects';
import {omitObj} from '../squidlet-lib/src/objects';
import {WsServer} from '../WsServer/WsServer';


export enum WS_SESSIONS_EVENTS {
  newSession,
  sessionClose,
  message
}

export interface WsServerSessionsProps extends WebSocketServerProps {
  expiredSec: number;
}

const SESSIONID_COOKIE = 'SESSIONID';


export class WsServerSessions extends DriverBase<WsServerSessionsProps> {
  // it fulfils when server is start listening
  get listeningPromise(): Promise<void> {
    return this.server.listeningPromise;
  }

  private readonly events = new IndexedEventEmitter();
  private get server(): WsServer {
    return this.depsInstances.server;
  }
  // like {sessionId: connectionId}
  private sessionConnections: {[index: string]: string} = {};


  init = async () => {
    this.depsInstances.server = await this.context.getSubDriver('WsServer', omitObj(this.props, 'expiredSec'));

    this.server.onConnection(this.handleNewConnection);
    this.server.onMessage((connectionId: string, data: string | Uint8Array) => {
      // handle only ours active sessions
      const sessionId: string | undefined = getKeyOfObject(this.sessionConnections, connectionId);

      if (!sessionId) return;

      this.log.debug(`WsServerSessions: new message of connection "${connectionId}", session "${sessionId}": length: ${data.length}`);
      this.events.emit(WS_SESSIONS_EVENTS.message, sessionId, data);
    });
    this.server.onConnectionClose((connectionId: string) => {
      // handle only ours active sessions
      const sessionId: string | undefined = getKeyOfObject(this.sessionConnections, connectionId);

      if (!sessionId) return;

      // clear connectionId
      delete this.sessionConnections[sessionId];
      this.log.debug(`WsServerSessions: connection "${connectionId}" of session "${sessionId}" closed`);
    });
    this.context.sessions.onSessionClosed((sessionId) => {
      // listen only ours session
      if (!Object.keys(this.sessionConnections).includes(sessionId)) return;

      delete this.sessionConnections[sessionId];

      this.log.debug(`WsServerSessions: session "${sessionId}" closed`);
      this.events.emit(WS_SESSIONS_EVENTS.sessionClose, sessionId);
    });
  }

  destroy = async () => {
    this.log.debug(`... destroying WsServerSessions: ${this.props.host}:${this.props.port}`);

    for (let sessionId of Object.keys(this.sessionConnections)) {
      this.context.sessions.destroySession(sessionId);
    }

    this.events.destroy();

    delete this.sessionConnections;
  }


  send(sessionId: string, data: string | Uint8Array): Promise<void> {
    if (!this.context.sessions.isSessionActive(sessionId)) {
      throw new Error(`WsServerSessions.send: Session ${sessionId} is inactive`);
    }
    else if (!this.sessionConnections[sessionId]) {
      throw new Error(`WsServerSessions.send: Can't find a connection of session "${sessionId}"`);
    }

    this.log.debug(`WsServerSessions: send message of session "${sessionId}": length: ${data.length}`);

    return this.server.send(this.sessionConnections[sessionId] as string, data);
  }

  /**
   * Close connection of session manually.
   */
  async close(sessionId: string) {
    if (!this.sessionConnections[sessionId]) return;

    await this.destroySession(sessionId);
    this.log.debug(`WsServerSessions: manually close session "${sessionId}"`);
    this.events.emit(WS_SESSIONS_EVENTS.sessionClose, sessionId);
  }

  async destroySession(sessionId: string) {
    const connectionId = this.sessionConnections[sessionId];

    if (!connectionId) return;

    await this.server.destroyConnection(connectionId);
    // destroy session and not rise a close event
    this.context.sessions.destroySession(sessionId);

    delete this.sessionConnections[sessionId];
  }

  onMessage(cb: (sessionId: string, data: string | Uint8Array) => void): number {
    return this.events.addListener(WS_SESSIONS_EVENTS.message, cb);
  }

  /**
   * On created new session at handshake.
   * Connection isn't established at this moment!
   */
  onNewSession(cb: (sessionId: string, connectionParams: ConnectionParams) => void): number {
    return this.events.addListener(WS_SESSIONS_EVENTS.newSession, cb);
  }

  onSessionClose(cb: (sessionId: string) => void): number {
    return this.events.addListener(WS_SESSIONS_EVENTS.sessionClose, cb);
  }

  removeListener(handlerIndex: number) {
    this.events.removeListener(handlerIndex);
  }


  private handleNewConnection = this.wrapErrors(async (
    connectionId: string,
    request: ConnectionParams,
  ) => {
    const requestCookie: { [SESSIONID_COOKIE]?: string } = parseCookie(request.headers.cookie);
    let sessionId: string | undefined = requestCookie[SESSIONID_COOKIE];

    if (sessionId && this.context.sessions.isSessionActive(sessionId)) {
      this.sessionConnections[sessionId] = connectionId;
      // if session exists - recover it
      this.context.sessions.recoverSession(sessionId);
      this.log.debug(`WsServerSessions: new connection, recover session "${sessionId}"`);
    }
    else {
      // create a new session if there isn't cookie of session is inactive
      sessionId = this.context.sessions.newSession(this.props.expiredSec);
      this.sessionConnections[sessionId] = connectionId;

      const cookie = `${SESSIONID_COOKIE}=${sessionId}`;

      this.log.debug(`WsServerSessions: new connection, make new session "${sessionId}"`);
      this.log.debug(`WsServerSessions: new connection, set cookie "${cookie}"`);

      try {
        await this.server.setCookie(connectionId, cookie);
      }
      catch (err) {
        delete this.sessionConnections[sessionId];
        // TODO: нужно ли дестроить сессию ???
        this.log.debug(`WsServerSessions: fail set cookie, remove session`);

        throw err;
      }


      this.events.emit(WS_SESSIONS_EVENTS.newSession, sessionId, request);
    }
  });

}


export default class Factory extends DriverFactoryBase<WsServerSessions, WsServerSessionsProps> {
  protected SubDriverClass = WsServerSessions;

  protected instanceId = (props: WsServerSessionsProps): string => {
    return `${props.host}:${props.port}`;
  }
}



// /**
//  * Set session id to cookie of client if it doesn't have or session is inactive
//  */
// private handleHeaders = this.wrapErrors(async (headers: {[index: string]: string}, request: ConnectionParams) => {
//
//   // T-O-D-O: headers это массив или объект ???
//
//   const parsedCookie: {SESSIONID?: string} = parseCookie(request.headers.cookie);
//
//   if (parsedCookie.SESSIONID && this.context.sessions.isSessionActive(parsedCookie.SESSIONID)) {
//     // if session exists - recover it
//     return this.context.sessions.recoverSession(parsedCookie.SESSIONID);
//   }
//
//   // or create a new session
//
//   const sessionId: string = this.context.sessions.newSession(this.props.expiredSec);
//   headers['Set-Cookie'] = `SESSIONID=${sessionId}`;
//   // rise a new session event
//   this.events.emit(WS_SESSIONS_EVENTS.newSession, sessionId, request);
//
//   // T-O-D-O: что если создали новую сессию а соединение так и не установилось????
//   //       Тогда наверное не подниметься connection close event
//
// })

// onMessage(cb: (sessionId: string, data: string | Uint8Array) => void): number {
//   return this.events.addListener(WS_SESSIONS_EVENTS.message, cb);
//
//   // if (!this.context.sessions.isSessionActive(sessionId)) {
//   //   throw new Error(`WsServerSessions.onMessage: Session ${sessionId} is inactive`);
//   // }
//   //
//   // return this.events.addListener(WS_SESSIONS_EVENTS.message, (msgSessionId: string, data: string | Uint8Array) => {
//   //   if (msgSessionId === sessionId) cb(data);
//   // });
// }

// /**
//  * Force closing a connection
//  */
// closeSession(sessionId: string, code: number, reason: string) {
//   if (!this.server) return;
//
//   this.server.closeConnection(connectionId, code, reason);
// }

// onSessionClose(sessionId: string, cb: () => void): number {
//   if (!this.context.sessions.isSessionActive(sessionId)) {
//     throw new Error(`WsServerSessions.onSessionClose: Session ${sessionId} is inactive`);
//   }
//
//   return this.context.sessions.onSessionClossed((closedSession: string) => {
//     if (closedSession === sessionId) cb();
//   });
// }
