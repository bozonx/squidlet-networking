// need to decrease of memory usage
import * as mqtt from 'mqtt';

import MqttIo, {MqttIoEvents, MqttOptions} from '../../../../../../squidlet/__old/system/interfaces/io/MqttIo';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import {callPromised} from '../squidlet-lib/src/common';
import {convertBufferToUint8Array} from '../squidlet-lib/src/buffer';
import {CError} from '../squidlet-lib/src/CError';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';

require('mqtt-packet').writeToStream.cacheNumbers = false;


//type MqttContentTypes = 'string' | 'binary';

interface MqttPacket {
  // properties: {
  //   contentType: MqttContentTypes;
  // };
}

type ConnectionItem = [mqtt.MqttClient, IndexedEventEmitter];

enum CONNECTION_POSITION {
  client,
  events,
}

const TIMEOUT_OF_CONNECTION_SEC = 20;
// TODO: use infinity counter
let connectionCounter: number = 0;


/**
 * The same for rpi and x86
 */
export default class Mqtt implements MqttIo {
  private ioContext?: IoContext;
  private readonly connections: Record<string, ConnectionItem> = {};


  async init(ioContext: IoContext) {
    this.ioContext = ioContext;
  }

  async destroy() {
    for (let connectionId of Object.keys(this.connections)) {
      this.close(connectionId)
        .catch(this.ioContext && this.ioContext.log.error);
    }
  }


  async newConnection(url: string, options: MqttOptions): Promise<string> {
    const connectionId = this.makeConnectionId();

    return new Promise<string>((resolve, reject) => {
      try {
        this.connectToServer(connectionId, url, options);
      }
      catch (e) {
        return reject(e);
      }

      let handlerIndex: number;
      const connectionTimeout = setTimeout(() => {
        this.connections[connectionId][CONNECTION_POSITION.events].removeListener(handlerIndex);
        this.close(connectionId);
        reject(`Timeout of connection has been exceeded`);
      }, TIMEOUT_OF_CONNECTION_SEC * 1000);

      handlerIndex = this.connections[connectionId][CONNECTION_POSITION.events].once(
        MqttIoEvents.connect,
        () => {
          clearTimeout(connectionTimeout);
          resolve(connectionId);
        }
      );
    });
  }

  async close(connectionId: string, force: boolean = false): Promise<void> {
    if (!this.connections[connectionId]) return;

    try {
      this.connections[connectionId][CONNECTION_POSITION.events].destroy();
    }
    catch (e) {
      this.ioContext && this.ioContext.log.error(e);
    }

    const client = this.connections[connectionId][CONNECTION_POSITION.client];

    // TODO: удалить все хэндлеры

    return callPromised(client.end.bind(client), force);
  }

  async isConnected(connectionId: string): Promise<boolean> {
    return this.connections[connectionId][CONNECTION_POSITION.client].connected;
  }

  async isDisconnecting(connectionId: string): Promise<boolean> {
    return this.connections[connectionId][CONNECTION_POSITION.client].disconnecting;
  }

  async isDisconnected(connectionId: string): Promise<boolean> {
    return this.connections[connectionId][CONNECTION_POSITION.client].disconnected;
  }

  async isReconnecting(connectionId: string): Promise<boolean> {
    return this.connections[connectionId][CONNECTION_POSITION.client].reconnecting;
  }


  async onConnect(connectionId: string, cb: () => void): Promise<number> {
    return this.connections[connectionId][CONNECTION_POSITION.events]
      .addListener(MqttIoEvents.connect, cb);
  }

  async onClose(connectionId: string, cb: () => void): Promise<number> {
    return this.connections[connectionId][CONNECTION_POSITION.events]
      .addListener(MqttIoEvents.close, cb);
  }

  async onDisconnect(connectionId: string, cb: () => void): Promise<number> {
    return this.connections[connectionId][CONNECTION_POSITION.events]
      .addListener(MqttIoEvents.disconnect, cb);
  }

  async onMessage(connectionId: string, cb: (topic: string, data: Uint8Array) => void): Promise<number> {
    return this.connections[connectionId][CONNECTION_POSITION.events]
      .addListener(MqttIoEvents.message, cb);
  }

  async onError(connectionId: string, cb: (err: string) => void): Promise<number> {
    return this.connections[connectionId][CONNECTION_POSITION.events]
      .addListener(MqttIoEvents.error, cb);
  }

  async removeListener(connectionId: string, handlerId: number): Promise<void> {
    this.connections[connectionId][CONNECTION_POSITION.events]
      .removeListener(handlerId);
  }

  async publish(connectionId: string, topic: string, data: string | Uint8Array): Promise<void> {
    if (!this.connections[connectionId]) {
      throw new CError(1001, `Mqtt.publish: No connection "${connectionId}"`);
    }

    //let contentType: MqttContentTypes;
    let preparedData: string | Buffer;

    if (typeof data === 'string') {
      //contentType = 'string';
      preparedData = data;
    }
    // else if (typeof data === 'undefined') {
    //   contentType = 'binary';
    //   preparedData = new Buffer([]);
    // }
    else {
      //contentType = 'binary';
      preparedData = new Buffer(data);
    }

    // const options = {
    //   properties: {
    //     contentType
    //   }
    // };

    const client = this.connections[connectionId][CONNECTION_POSITION.client];

    return callPromised(client.publish.bind(client), topic, preparedData);
    //return callPromised(client.publish.bind(client), topic, preparedData, options);
  }

  subscribe(connectionId: string, topic: string): Promise<void> {
    if (!this.connections[connectionId]) {
      throw new CError(1001, `Mqtt.subscribe: No connection "${connectionId}"`);
    }

    const client = this.connections[connectionId][CONNECTION_POSITION.client];

    return callPromised(client.subscribe.bind(client), topic);
  }

  unsubscribe(connectionId: string, topic: string): Promise<void> {
    if (!this.connections[connectionId]) {
      throw new CError(1001, `Mqtt.unsubscribe: No connection "${connectionId}"`);
    }

    const client = this.connections[connectionId][CONNECTION_POSITION.client];

    return callPromised(client.unsubscribe.bind(client), topic);
  }


  private connectToServer(connectionId: string, url: string, options: MqttOptions) {
    const client: mqtt.MqttClient = mqtt.connect(url, options);

    client.on('message', (topic: string, data: Buffer, packet: MqttPacket) => {
      //const contentType: string | undefined = packet.properties && packet.properties.contentType;
      this.handleIncomeMessage(connectionId, topic, data);
    });
    client.on('error', (err: Error) =>
      this.connections[connectionId][CONNECTION_POSITION.events]
        .emit(MqttIoEvents.error, String(err))
    );
    client.on('connect',() =>
      this.connections[connectionId][CONNECTION_POSITION.events]
        .emit(MqttIoEvents.connect)
    );
    client.on('close', () => this.handleClose(connectionId));
    client.on('disconnect', (packet: MqttPacket) => this.handleDisconnect(connectionId, packet));
    // Other interesting events: offline, reconnect

    this.connections[connectionId] = [client, new IndexedEventEmitter()];
  }

  private handleClose = (connectionId: string) => {
    this.connections[connectionId][CONNECTION_POSITION.events].emit(MqttIoEvents.close);

    this.close(connectionId)
      .catch(this.ioContext && this.ioContext.log.error);
  }

  private handleDisconnect = (connectionId: string, packet: MqttPacket) => {
    this.connections[connectionId][CONNECTION_POSITION.events].emit(MqttIoEvents.disconnect);
  }

  /**
   * If no data then Buffer will be empty.
   */
  private handleIncomeMessage = (
    connectionId: string,
    topic: string,
    data: Buffer,
    //contentTypeProperty: string | undefined
  ) => {
    let preparedData: Uint8Array = convertBufferToUint8Array(data);
    //const binaryContentType: MqttContentTypes = 'binary';

    // if (contentTypeProperty === binaryContentType) {
    //   preparedData = convertBufferToUint8Array(data);
    // }
    // else {
    //   // not contentType or 'string'
    //   preparedData = data.toString();
    // }

    this.connections[connectionId][CONNECTION_POSITION.events]
      .emit(MqttIoEvents.message, topic, preparedData);
  }

  private makeConnectionId(): string {
    const id: string = String(connectionCounter);

    connectionCounter++;

    return id;
  }

}


// TODO: наверноене нужно -  при потере соединения просто делать close и заного соединяться
// async reConnect(connectionId: string): Promise<void> {
//   if (!this.connections[Number(connectionId)]) return;
//
//   this.connections[Number(connectionId)].reconnect();
// }
