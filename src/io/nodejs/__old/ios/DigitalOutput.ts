/*
 * It uses a pigpiod daemon via websocket.
 */

import {OutputResistorMode} from '../../../../../../squidlet/__old/system/interfaces/gpioTypes';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';
import DigitalOutputIo from '../../../../../../squidlet/__old/system/interfaces/io/DigitalOutputIo';

import PigpioPinWrapper from '../helpers/PigpioPinWrapper';
import PigpioClient from './PigpioClient';


export default class DigitalOutput implements DigitalOutputIo {
  private _client?: PigpioClient;
  private _ioContext?: IoContext;
  private readonly resistors: {[index: string]: OutputResistorMode} = {};

  private get client(): PigpioClient {
    return this._client as any;
  }

  private get ioContext(): IoContext {
    return this._ioContext as any;
  }


  async init(ioContext: IoContext): Promise<void> {
    this._ioContext = ioContext;
    this._client = ioContext.getIo<PigpioClient>('PigpioClient');
  }

  async destroy(): Promise<void> {
  }


  /**
   * Setup pin before using.
   * It doesn't set an initial value on output pin because a driver have to use it.
   */
  async setup(pin: number, initialValue: boolean, outputMode: OutputResistorMode): Promise<void> {
    if (this.client.isPinInitialized(pin)) {
      throw new Error(
        `Digital IO setupOutput(): Pin ${pin} has been set up before. ` +
        `You should to call \`clearPin(${pin})\` and after that try again.`
      );
    }
    // wait for connection
    await this.client.connectionPromise;
    // make instance
    this.client.makePinInstance(pin);

    const pinInstance = this.getPinInstance('setupOutput', pin);
    const pullUpDown: number = this.convertOutputResistorMode(outputMode);
    // save resistor mode
    this.resistors[pin] = outputMode;
    // make setup
    await Promise.all([
      pinInstance.modeSet('output'),
      pinInstance.pullUpDown(pullUpDown),
    ]);
    // set initial value if it defined
    if (typeof initialValue !== 'undefined') await this.write(pin, initialValue);
  }

  // async getPinDirection(pin: number): Promise<PinDirection | undefined> {
  //   if (!this.client.connected) throw new Error(`Pigpio client hasn't been connected`);
  //
  //   const pinInstance = this.getPinInstance('getPinDirection', pin);
  //
  //   const modeNum: number = await pinInstance.modeGet();
  //
  //   if (modeNum === 0) {
  //     return PinDirection.input;
  //   }
  //
  //   return PinDirection.output;
  // }

  // /**
  //  * Get pin mode.
  //  * It throws an error if pin hasn't configured before
  //  */
  // async getPinResistorMode(pin: number): Promise<OutputResistorMode | undefined> {
  //   return this.resistors[pin];
  // }

  // async read(pin: number): Promise<boolean> {
  //   if (!this.client.connected) throw new Error(`Pigpio client hasn't been connected`);
  //
  //   return this.simpleRead(pin);
  // }

  async write(pin: number, value: boolean): Promise<void> {
    if (!this.client.connected) throw new Error(`Pigpio client hasn't been connected`);

    const pinInstance = this.getPinInstance('write', pin);
    const numValue: number = (value) ? 1 : 0;

    return pinInstance.write(numValue);
  }

  async clearPin(pin: number): Promise<void> {
    delete this.resistors[pin];

    this.client.clearPin(pin);
  }

  async clearAll(): Promise<void> {
    for (let pin of this.client.getInstantiatedPinList()) {
      await this.clearPin(parseInt(pin));
    }
  }


  // private async simpleRead(pin: number): Promise<boolean> {
  //   const pinInstance = this.getPinInstance('simpleRead', pin);
  //
  //   // returns 0 or 1
  //   const result: number = await pinInstance.read();
  //
  //   return Boolean(result);
  // }

  private convertOutputResistorMode(resistorMode: OutputResistorMode): number {
    switch (resistorMode) {
      case (OutputResistorMode.none):
        return 0;

      case (OutputResistorMode.opendrain):
        //throw new Error(`Open-drain mode isn't supported`);
        // TODO: выяснить можно ли включить open drain? может нужно использовать Gpio.PUD_UP
        return 2;
      default:
        throw new Error(`Unknown mode "${resistorMode}"`);
    }
  }

  private getPinInstance(methodWhichAsk: string, pin: number): PigpioPinWrapper {
    const instance: PigpioPinWrapper | undefined = this.client.getPinInstance(pin);

    if (!instance) {
      throw new Error(`Digital dev ${methodWhichAsk}: You have to do setup of local GPIO pin "${pin}" before manipulating it`);
    }

    return instance;
  }

}
