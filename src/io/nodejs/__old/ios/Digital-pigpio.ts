// @ts-ignore
import {Gpio} from 'pigpio';

import DigitalInputIo, {ChangeHandler} from '../../../../../../squidlet/__old/system/interfaces/io/DigitalInputIo';
import DebounceCall from '../../../../../../squidlet-lib/src/debounceCall/DebounceCall';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import {Edge, InputResistorMode, OutputResistorMode, PinDirection} from '../../../../../../squidlet/__old/system/interfaces/gpioTypes';
import ThrottleCall from '../../../../../../squidlet-lib/src/debounceCall/ThrottleCall';


type GpioHandler = (level: number) => void;

const INTERRUPT_EVENT_NAME = 'interrupt';
const ALERT_EVENT_NAME = 'alert';


export default class DigitalPigpio implements DigitalInputIo {
  private readonly pinInstances: {[index: string]: Gpio} = {};
  private readonly events = new IndexedEventEmitter<ChangeHandler>();
  // pin change listeners by pin
  private readonly pinListeners: {[index: string]: GpioHandler} = {};
  // resistor constant of pins by id
  private readonly resistors: {[index: string]: InputResistorMode | OutputResistorMode} = {};
  private readonly debounceCall: DebounceCall = new DebounceCall();
  private readonly throttleCall: ThrottleCall = new ThrottleCall();


  async destroy(): Promise<void> {
    await this.clearAll();

    this.events.destroy();
    this.debounceCall.destroy();
  }


  /**
   * Setup pin before using.
   * It doesn't set an initial value on output pin because a driver have to use it.
   */
  async setupInput(pin: number, inputMode: InputResistorMode, debounce: number, edge: Edge): Promise<void> {
    if (this.pinInstances[pin]) {
      throw new Error(
        `Digital IO setupInput(): Pin ${pin} has been set up before. ` +
        `You should to call \`clearPin(${pin})\` and after that try again.`
      );
    }

    const pullUpDown: number = this.convertInputResistorMode(inputMode);
    // make a new instance of Gpio
    this.pinInstances[pin] = new Gpio(pin, {
      pullUpDown,
      mode: Gpio.INPUT,
    });
    this.resistors[pin] = inputMode;

    // try to use "interrupt" event because "alert" event emits too many changes.
    // But not all the pins can have an interruption, in this case better to use the "alert" event.
    try {
      this.pinInstances[pin].enableInterrupt(this.resolveEdge(edge));

      this.pinListeners[pin] = (level: number) => this.handlePinChange(pin, level, debounce);

      // start listen pin changes
      this.pinInstances[pin].on(INTERRUPT_EVENT_NAME, this.pinListeners[pin]);
    }
    catch (e) {
      this.pinInstances[pin].enableAlert();
      // use own edge handler because alert mode doesn't have edge
      this.pinListeners[pin] = (level: number) => this.handlePinChange(pin, level, debounce, edge);
      // start listen pin changes
      this.pinInstances[pin].on(ALERT_EVENT_NAME, this.pinListeners[pin]);
    }
  }

  /**
   * Setup pin before using.
   * It doesn't set an initial value on output pin because a driver have to use it.
   */
  async setupOutput(pin: number, initialValue: boolean, outputMode: OutputResistorMode): Promise<void> {
    if (this.pinInstances[pin]) {
      throw new Error(
        `Digital IO setupOutput(): Pin ${pin} has been set up before. ` +
        `You should to call \`clearPin(${pin})\` and after that try again.`
      );
    }

    const pullUpDown: number = this.convertOutputResistorMode(outputMode);
    // make instance and setup it
    this.pinInstances[pin] = new Gpio(pin, {
      pullUpDown,
      mode: Gpio.OUTPUT,
    });
    // save resistor mode
    this.resistors[pin] = outputMode;
    // set initial value if it defined
    if (typeof initialValue !== 'undefined') await this.write(pin, initialValue);
  }

  async getPinDirection(pin: number): Promise<PinDirection | undefined> {
    return this.resolvePinDirection(pin);
  }

  // async getPinResistorMode(pin: number): Promise<InputResistorMode | OutputResistorMode | undefined> {
  //   return this.resistors[pin];
  // }

  async read(pin: number): Promise<boolean> {
    return this.simpleRead(pin);
  }

  async write(pin: number, value: boolean): Promise<void> {
    const pinDirection: PinDirection | undefined = this.resolvePinDirection(pin);

    if (typeof pinDirection === 'undefined') {
      throw new Error(`Digital.write: pin ${pin} hasn't been set up yet`);
    }
    else if (pinDirection !== PinDirection.output) {
      throw new Error(`Digital.write: pin ${pin}: writing is allowed only for output pins`);
    }

    const pinInstance = this.getPinInstance('write', pin);
    const numValue = (value) ? 1 : 0;

    pinInstance.digitalWrite(numValue);
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

    if (!this.pinInstances[pin]) {
      delete this.pinListeners[pin];

      return;
    }

    // remove listeners. It won't rise error event the listener hasn't been registered before.
    if (this.pinListeners[pin]) {
      this.pinInstances[pin].removeListener(INTERRUPT_EVENT_NAME, this.pinListeners[pin]);
      this.pinInstances[pin].removeListener(ALERT_EVENT_NAME, this.pinListeners[pin]);
    }

    // it won't throw the error event interrupt or alert haven't been configured before.
    this.pinInstances[pin].disableInterrupt();
    this.pinInstances[pin].disableAlert();
    this.debounceCall.clear(pin);
    this.throttleCall.clear(pin);

    delete this.pinListeners[pin];
    delete this.pinInstances[pin];
  }

  async clearAll(): Promise<void> {
    for (let index in this.pinInstances) {
      await this.clearPin(parseInt(index));
    }
  }


  private handlePinChange(pin: number, numLevel: number, debounce: number, edge?: Edge) {
    const level: boolean = Boolean(numLevel);

    // don't handle edge which is not suitable to edge that has been set up
    if (typeof edge !== 'undefined') {
      if (edge === Edge.rising && !level) {
        return;
      }
      else if (edge === Edge.falling && level) {
        return;
      }
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
          // TODO: call IO's logError()
          console.error(e);
        });

      return;
    }
    // else edge both and debounce is set
    // wait for debounce and read current level and emit an event
    this.debounceCall.invoke(() => this.handleEndOfDebounce(pin), debounce, pin)
      .catch((e) => {
        // TODO: call IO's logError()
        console.error(e);
      });
  }

  private handleEndOfDebounce(pin: number) {
    let realLevel: boolean;

    try {
      realLevel = this.simpleRead(pin);
    }
    catch (e) {
      // TODO: call IO's logError()
      return console.error(e);
    }

    this.events.emit(pin, realLevel);
  }

  private convertInputResistorMode(resistorMode: InputResistorMode): number {
    switch (resistorMode) {
      case (InputResistorMode.none):
        return Gpio.PUD_OFF;
      case (InputResistorMode.pulldown):
        return Gpio.PUD_DOWN;
      case (InputResistorMode.pullup):
        return Gpio.PUD_UP;
      default:
        throw new Error(`Unknown mode "${resistorMode}"`);
    }
  }

  private convertOutputResistorMode(resistorMode: OutputResistorMode): number {
    switch (resistorMode) {
      case (OutputResistorMode.none):
        return Gpio.PUD_OFF;

      case (OutputResistorMode.opendrain):
        //throw new Error(`Open-drain mode isn't supported`);
        // TODO: выяснить можно ли включить open drain? может нужно использовать Gpio.PUD_UP
        return Gpio.PUD_UP;
      default:
        throw new Error(`Unknown mode "${resistorMode}"`);
    }
  }

  private resolveEdge(edge: Edge): number {
    if (edge === Edge.rising) {
      return Gpio.RISING_EDGE;
    }
    else if (edge === Edge.falling) {
      return Gpio.FALLING_EDGE;
    }

    return Gpio.EITHER_EDGE;
  }

  private resolvePinDirection(pin: number): PinDirection | undefined {
    let pinInstance: Gpio;

    try {
      pinInstance = this.getPinInstance('resolvePinDirection', pin);
    }
    catch (e) {
      // if instance of pin hasn't been created yet = undefined
      return;
    }

    // it returns input or output. Input by default.
    const modeConst: number = pinInstance.getMode();

    if (modeConst === Gpio.OUTPUT) {
      return PinDirection.output;
    }

    return PinDirection.input;
  }

  private getPinInstance(methodWhichAsk: string, pin: number): Gpio {
    if (!this.pinInstances[pin]) {
      throw new Error(`Nodejs Digital io ${methodWhichAsk}: You have to do setup of local GPIO pin "${pin}" before manipulating it`);
    }

    return this.pinInstances[pin];
  }

  private simpleRead(pin: number): boolean {
    const pinInstance = this.getPinInstance('simpleRead', pin);

    return Boolean(pinInstance.digitalRead());
  }

}
