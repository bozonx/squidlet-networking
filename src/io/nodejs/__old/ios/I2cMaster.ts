import I2cMasterIo, {I2cDefinition} from '../../../../../../squidlet/__old/system/interfaces/io/I2cMasterIo';
import {isKindOfNumber} from '../squidlet-lib/src/common';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';
import Promised from '../squidlet-lib/src/Promised';
import PigpioClient, {BAD_HANDLE_CODE} from './PigpioClient';


/**
 * It's raspberry pi implementation of I2C master.
 * It doesn't support setting clock. You should set it in your OS.
 */
export default class I2cMaster implements I2cMasterIo {
  private _client?: PigpioClient;
  private definition?: I2cDefinition;
  private openConnectionPromised: {[index: string]: Promised<void>} = {};
  // { `${busNum}${addressNum}`: addressConnectionId }
  private openedAddresses: {[index: string]: number} = {};

  private get client(): PigpioClient {
    return this._client as any;
  }


  async init(ioContext: IoContext): Promise<void> {
    this._client = ioContext.getIo<PigpioClient>('PigpioClient');
  }


  async configure(definition: I2cDefinition): Promise<void> {
    this.definition = {
      ...this.definition,
      ...definition,
    };
  }

  async destroy(): Promise<void> {
    delete this._client;
    delete this.definition;
    delete this.openConnectionPromised;
    delete this.openedAddresses;
  }


  async i2cWriteDevice(
    busNum: string | number | undefined,
    addrHex: number,
    data: Uint8Array
  ): Promise<void> {
    const addressConnectionId: number = await this.resolveAddressConnectionId(busNum, addrHex);

    try {
      await this.client.i2cWriteDevice(addressConnectionId, data);
    }
    catch (e) {
      if (e.code === BAD_HANDLE_CODE) {
        await this.handleBadHandle(busNum, addrHex);
        await this.client.i2cWriteDevice(addressConnectionId, data);

        return;
      }

      throw e;
    }
  }

  async i2cReadDevice(
    busNum: string | number | undefined,
    addrHex: number,
    count: number
  ): Promise<Uint8Array> {
    const addressConnectionId: number = await this.resolveAddressConnectionId(busNum, addrHex);

    try {
      return await this.client.i2cReadDevice(addressConnectionId, count);
    }
    catch (e) {
      if (e.code === BAD_HANDLE_CODE) {
        await this.handleBadHandle(busNum, addrHex);
        return await this.client.i2cReadDevice(addressConnectionId, count);
      }

      throw e;
    }
  }

  async destroyBus(busNum: string | number): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let index of Object.keys(this.openedAddresses)) {
      if (index.indexOf(String(busNum)) !== 0) continue;

      promises.push(this.client.i2cClose(this.openedAddresses[index]));

      delete this.openedAddresses[index];
    }

    try {
      await Promise.all(promises);
    }
    catch (e) {
      console.error(e);
    }
  }


  /**
   * Reconnect if handle doesn't exist (pigpiod has been restarted)
   */
  private async handleBadHandle(busNum: string | number | undefined, addrHex: number) {
    const resolvedBusNum: number = this.resolveBusNum(busNum);
    const index: string = `${resolvedBusNum}${addrHex}`;

    delete this.openedAddresses[index];

    this.openedAddresses[index] = await this.client.i2cOpen(resolvedBusNum, addrHex);
  }

  /**
   * Open a connection or return existent
   */
  private async resolveAddressConnectionId(
    busNum: string | number | undefined,
    addrHex: number
  ): Promise<number> {
    const resolvedBusNum: number = this.resolveBusNum(busNum);
    const index: string = `${resolvedBusNum}${addrHex}`;

    if (typeof this.openedAddresses[index] !== 'undefined') return this.openedAddresses[index];

    if (this.openConnectionPromised[index]) {
      if (!this.openConnectionPromised[index].isFulfilled()) {
        await this.openConnectionPromised[index];
      }

      return this.openedAddresses[index];
    }
    else {
      this.openConnectionPromised[index] = new Promised<void>();
    }

    // TODO: remove promised

    // open a new connection
    const addressConnectionId: number = await this.client.i2cOpen(resolvedBusNum, addrHex);

    this.openedAddresses[index] = addressConnectionId;

    this.openConnectionPromised[index].resolve();

    return addressConnectionId;
  }

  private resolveBusNum(specifiedBusNum: string | number | undefined): number {
    if (typeof specifiedBusNum === 'undefined') {
      if (!this.definition) throw new Error(`No definition`);
      if (typeof this.definition.defaultBus === 'undefined') throw new Error(`No defaultBus`);

      return parseInt(this.definition.defaultBus as any);
    }
    else {
      if (!isKindOfNumber(specifiedBusNum)) throw new Error(`busNum has to be a number`);

      return parseInt(specifiedBusNum as any);
    }
  }

}
