/*
 * It uses a pigpiod daemon via websocket.
 */

import DigitalInputIo, {ChangeHandler} from '../../../../../../squidlet/__old/system/interfaces/io/DigitalInputIo';
import {Edge, InputResistorMode} from '../../../../../../squidlet/__old/system/interfaces/gpioTypes';
import ThrottleCall from '../../../../../../squidlet-lib/src/debounceCall/ThrottleCall';
import DebounceCall from '../../../../../../squidlet-lib/src/debounceCall/DebounceCall';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';
import PigpioPinWrapper from '../helpers/PigpioPinWrapper';
import PigpioClient from './PigpioClient';


export default class DigitalInput implements DigitalInputIo {
  private _client?: PigpioClient;
  private _ioContext?: IoContext;
  private readonly resistors: {[index: string]: InputResistorMode} = {};
  private readonly events = new IndexedEventEmitter<ChangeHandler>();
  private readonly debounceCall: DebounceCall = new DebounceCall();
  private readonly throttleCall: ThrottleCall = new ThrottleCall();

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
    this.debounceCall.destroy();
    this.throttleCall.destroy();
    this.events.destroy();
  }


  /**
   * Setup pin before using.
   * It doesn't set an initial value on output pin because a driver have to use it.
   */
  async setup(pin: number, inputMode: InputResistorMode, debounce: number, edge: Edge): Promise<void> {
    if (this.client.isPinInitialized(pin)) {
      throw new Error(
        `Digital IO setupInput(): Pin ${pin} has been set up before. ` +
        `You should to call \`clearPin(${pin})\` and after that try again.`
      );
    }
    // wait for connection
    await this.client.connectionPromise;
    // make instance
    this.client.makePinInstance(pin);

    const pinInstance = this.getPinInstance('setupInput', pin);
    const pullUpDown: number = this.convertInputResistorMode(inputMode);
    // make setup
    await Promise.all([
      pinInstance.modeSet('input'),
      pinInstance.pullUpDown(pullUpDown),
    ]);

    const handler = (level: number, tick: number) => this.handlePinChange(pin, level, tick, debounce, edge);

    pinInstance.notify(handler);
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
  // async getPinResistorMode(pin: number): Promise<InputResistorMode | undefined> {
  //   return this.resistors[pin];
  // }

  async read(pin: number): Promise<boolean> {
    if (!this.client.connected) throw new Error(`Pigpio client hasn't been connected`);

    return this.simpleRead(pin);
  }

  async onChange(pin: number, handler: ChangeHandler): Promise<number> {
    return this.events.addListener(pin, handler);
  }

  async removeListener(handlerIndex: number): Promise<void> {
    this.events.removeListener(handlerIndex);
  }

  async clearPin(pin: number): Promise<void> {
    delete this.resistors[pin];

    this.events.removeAllListeners(pin);
    this.debounceCall.clear(pin);
    this.throttleCall.clear(pin);
    this.client.clearPin(pin);
  }

  async clearAll(): Promise<void> {
    for (let pin of this.client.getInstantiatedPinList()) {
      await this.clearPin(parseInt(pin));
    }
  }


  private handlePinChange(pin: number, numLevel: number, tick: number, debounce: number, edge: Edge) {
    const level: boolean = Boolean(numLevel);

    // don't handle edge which is not suitable to edge that has been set up
    if (edge === Edge.rising && !level) {
      return;
    }
    else if (edge === Edge.falling && level) {
      return;
    }

    // if undefined or 0 - call handler immediately
    if (!debounce) {
      return this.events.emit(pin, level);
    }
    // use throttle instead of debounce if rising or falling edge is set
    else if (edge === Edge.rising || edge === Edge.falling) {
      this.throttleCall.invoke(() => {
        this.events.emit(pin, level);
      }, debounce, pin)
        .catch((e) => {
          this.ioContext.log.error(e);
        });

      return;
    }
    // else edge both and debounce is set
    // wait for debounce and read current level and emit an event
    // TODO: handleEndOfDebounce will return a promise
    this.debounceCall.invoke(() => this.handleEndOfDebounce(pin), debounce, pin)
      .catch((e) => {
        this.ioContext.log.error(e);
      });
  }

  private async handleEndOfDebounce(pin: number) {
    let realLevel: boolean;

    try {
      realLevel = await this.simpleRead(pin);
    }
    catch (e) {
      return this.ioContext.log.error(e);
    }

    this.events.emit(pin, realLevel);
  }

  private async simpleRead(pin: number): Promise<boolean> {
    const pinInstance = this.getPinInstance('simpleRead', pin);

    // returns 0 or 1
    const result: number = await pinInstance.read();

    return Boolean(result);
  }

  private convertInputResistorMode(resistorMode: InputResistorMode): number {
    switch (resistorMode) {
      case (InputResistorMode.none):
        return 0;
      case (InputResistorMode.pulldown):
        return 1;
      case (InputResistorMode.pullup):
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
