//import pigpioClient from 'pigpio-client';
import {normalizeHexString} from '../../../../../../squidlet-lib/src/binaryHelpers';

const pigpioClient = require('pigpio-client');

import Promised from '../squidlet-lib/src/Promised';
import {compactUndefined} from '../squidlet-lib/src/arrays';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';
import PigpioPinWrapper, {PigpioInfo, PigpioOptions} from '../helpers/PigpioPinWrapper';
import PigpioClientIo from '../../../../../../squidlet/__old/system/interfaces/io/PigpioClientIo';


const I2CO = 54;
const I2CC = 55;
const I2CRD = 56;
const I2CWD = 57;

export const BAD_HANDLE_CODE = 'PI_BAD_HANDLE';


interface Client {
  gpio(pin: number): any;
  end(cb?: () => void): void;
  on(eventName: string, cb: (...p: any[]) => void): void;
  once(eventName: string, cb: (...p: any[]) => void): void;
  removeListener(eventName: string, cb: (...p: any[]) => void): void;
  request(command: number, ...p: any[]): Promise<any>;
}

const RECONNECT_TIMEOUT_SEC = 20;
const DEFAULT_OPTIONS = {
  host: 'localhost',
};
let instance: PigpioClient | undefined;


export default class PigpioClient implements PigpioClientIo {
  get inited(): boolean {
    return Boolean(this._ioContext);
  }

  get connected(): boolean {
    return this.connectionPromised.isResolved();
  }

  get connectionPromise(): Promise<void> {
    return this.connectionPromised.promise;
  }

  private _ioContext?: IoContext;
  private clientOptions: PigpioOptions = DEFAULT_OPTIONS;
  private client?: Client;
  private connectionPromised = new Promised<void>();
  // timeout to wait between trying of connect
  private connectionTimeout?: NodeJS.Timeout;
  private readonly pinInstances: {[index: string]: PigpioPinWrapper} = {};

  private get ioContext(): IoContext {
    return this._ioContext as any;
  }


  async init(ioContext: IoContext): Promise<void> {
    this._ioContext = ioContext;

    this.connect();
  }

  async configure(clientOptions: PigpioOptions): Promise<void> {
    this.clientOptions = {
      ...this.clientOptions,
      ...clientOptions,
      // do not use timeout. Because client's reconnect works weirdly.
      timeout: 0,
    };
  }

  async destroy(): Promise<void> {
    if (!this.client) return;

    this.clearListeners();
    this.connectionPromised.destroy();

    delete this.connectionPromised;

    this.client && this.client.end();

    delete this.client;
  }


  isPinInitialized(pin: number): boolean {
    return Boolean(this.pinInstances[pin]);
  }

  getPinInstance(pin: number): PigpioPinWrapper | undefined {
    return this.pinInstances[pin];
  }

  makePinInstance(pin: number) {
    if (this.pinInstances[pin]) {
      throw new Error(`PigpioClient: pin has been already instantiated`);
    }

    if (!this.client) {
      throw new Error(`PigpioClient: Client hasn't been connected`);
    }

    this.pinInstances[pin] = new PigpioPinWrapper(this.client.gpio(pin));
  }

  clearPin(pin: number) {
    this.pinInstances[pin].destroy();

    delete this.pinInstances[pin];
  }

  getInstantiatedPinList(): string[] {
    return Object.keys(this.pinInstances);
  }

  /**
   * Open i2c bus and returns addressConnectionId
   */
  i2cOpen(bus: number, address: number): Promise<number> {
    if (!this.client) {
      throw new Error(`PigpioClient: Client hasn't been connected`);
    }

    const flags = new Uint8Array(4);

    this.ioContext.log.debug(
      `PigpioClient.i2cOpen: bus ${bus}, address ${normalizeHexString(address.toString(16))}`
    );

    return this.client.request(I2CO, bus, address, 4, undefined, flags);
  }

  i2cClose(addressConnectionId: number): Promise<void> {
    if (!this.client) return Promise.resolve();

    return this.client.request(I2CC, addressConnectionId, 0, 0);
  }

  i2cWriteDevice(addressConnectionId: number, data: Uint8Array) {
    //return this.client.request(I2CWD, addressConnectionId, 0, data.length, undefined, data);
    return new Promise<void>((resolve, reject) => {
      if (!this.client) {
        return reject(`PigpioClient: Client hasn't been connected`);
      }

      const callback = (err: Error, bytesWritten: number) => {
        if (err) return reject(err);

        // if (data && data.length !== bytesWritten) {
        //   return reject(new Error(
        //     `Wrong number of bytes has been written. Tried to write ${data.length}, but eventually written ${bytesWritten}`
        //   ));
        // }

        resolve();
      };

      this.client.request(I2CWD, addressConnectionId, 0, data.length, callback, data);
    });
  }

  i2cReadDevice(addressConnectionId: number, count: number): Promise<Uint8Array> {
    //return this.client.request(I2CRD, addressConnectionId, count, 0);
    return new Promise<Uint8Array>((resolve, reject) => {
      if (!this.client) {
        throw new Error(`PigpioClient: Client hasn't been connected`);
      }

      const callback = (err: Error, bytesRead: number, result: Uint8Array) => {
        if (err) return reject(err);

        // TODO: поидее должен всегда возвращаться Uint8Array а не number
        // result can be a number
        const resolvedResult: Uint8Array = (result instanceof Uint8Array) ? result : new Uint8Array([result]);

        if (count !== bytesRead) {
          return reject(new Error(
            `Wrong number of bytes has been read. Sent ${count}, but eventually read ${bytesRead}`
          ));
        }

        resolve(resolvedResult);
      };

      this.client.request(I2CRD, addressConnectionId, count, 0, callback);
    });
  }


  /**
   * It rises once on client has been connected.
   */
  private handleConnected = (info: PigpioInfo): void => {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

    this.ioContext.log.info(
      `PigpioClient has been connected successfully to the pigpio daemon ` +
      `${info.host}:${info.port}, pigpioVersion: ${info.pigpioVersion}`
    );
    this.ioContext.log.debug(`PigpioClient connection info: ${JSON.stringify(info)}`);
    this.renewInstances();
    this.connectionPromised.resolve();
  }

  /**
   * It rises once only if client has already connected.
   */
  private handleDisconnect = (reason: string): void => {
    this.ioContext.log.debug(`PigpioClient disconnected: ${reason}`);

    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

    delete this.client;

    // remove listeners and gpio instance
    for (let pin of Object.keys(this.pinInstances)) {
      this.pinInstances[pin].$clear();
    }

    // renew promised if need
    if (this.connectionPromised.isFulfilled()) {
      this.connectionPromised.destroy();

      this.connectionPromised = new Promised<void>();
    }

    this.ioContext.log.info(`PigpioClient reconnecting after disconnect in ${RECONNECT_TIMEOUT_SEC} sec`);

    setTimeout(this.doReconnect, RECONNECT_TIMEOUT_SEC * 1000);
  }

  private handleError = (err: {message: string}) => {
    this.ioContext.log.error(`PigpioClient: ${err.message}`);
  }

  private connect() {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

    this.ioContext.log.info(
      `... Connecting to pigpiod daemon: ` +
      `${compactUndefined([this.clientOptions.host, this.clientOptions.port]).join(':')}`
    );

    try {
      this.client = pigpioClient.pigpio(this.clientOptions) as Client;
    }
    catch (e) {
      this.ioContext.log.error(e);
      this.doReconnect();

      return;
    }

    this.client.on('error', this.handleError);
    this.client.once('connected', this.handleConnected);
    this.client.once('disconnected', this.handleDisconnect);

    this.connectionTimeout = setTimeout(this.doReconnect, RECONNECT_TIMEOUT_SEC * 1000);
  }

  private doReconnect = () => {
    this.ioContext.log.info(`PigpioClient reconnecting`);
    this.client && this.client.end();
    this.clearListeners();
    this.connect();
  }

  private clearListeners() {
    if (!this.client) return;

    this.client.removeListener('error', this.handleError);
    this.client.removeListener('disconnected', this.handleDisconnect);
    this.client.removeListener('connected', this.handleConnected);
  }

  private renewInstances() {
    if (!this.client) {
      throw new Error(`PigpioClient: Client hasn't been connected`);
    }

    for (let pin of Object.keys(this.pinInstances)) {
      this.pinInstances[pin].$renew(this.client.gpio(Number(pin)));
    }
  }

}
