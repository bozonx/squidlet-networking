import DeviceBase from '../../../../../squidlet/__old/system/base/DeviceBase';
import {ChangeHandler} from '../../../../../squidlet/__old/system/interfaces/io/DigitalInputIo';
//import {GpioDigital} from 'system/interfaces/Gpio';
import {Edge} from '../../../../../squidlet/__old/system/interfaces/gpioTypes';
import {InputResistorMode, OutputResistorMode, PinDirection} from '../../../../../squidlet/__old/system/interfaces/gpioTypes';
import {omitObj} from '../squidlet-lib/src/objects';
import {stringifyPinMode} from '../squidlet-lib/src/digitalHelpers';
import {normalizeHexString} from '../squidlet-lib/src/binaryHelpers';

import {Pcf8574ExpanderProps, Pcf8574 as Pcf8574Driver} from '../../drivers/Pcf8574/Pcf8574';


interface Props extends Pcf8574ExpanderProps {
  // default debounce for all ge input pins
  defaultDebounce?: number;
}


/**
 * GPIO device which is represent a PCF8574 port expander board.
 * Don't specify more than one instance in config please.
 * Props of this instance will be defaults of IO devices.
 */
export default class GpioPcf8574OldDevice extends DeviceBase<Props> {
  get expander(): Pcf8574Driver {
    return this.depsInstances.expander;
  }

  protected async didInit() {
    this.depsInstances.expander = await this.context.getSubDriver('Pcf8574', {
      ...omitObj(this.props, 'defaultDebounce'),
    });
    // TODO: нужно ли явно включать буферизацию запросов ???
  }

  protected async devicesDidInit() {
    this.log.debug(`GpioPcf8574: init IC: ${normalizeHexString(this.props.address)}`);
    // initialize IC after app did init
    // don't wait while ic is initialized
    this.expander.initIc();
  }

  destroy = async () => {
    // clear all the pins on destroy this instance (actually means destroy system).
    return this.expander.clearAll();
  }


  private gpio: GpioDigital = {
    digitalSetupInput: (
      pin: number,
      // on PCF8574 pins always have pullup resistors
      inputMode: InputResistorMode = InputResistorMode.pullup,
      debounce: number = 0,
      edge: Edge = Edge.both
    ): Promise<void> => {
      const resolvedDebounce: number = (typeof debounce === 'undefined')
        ? (this.props.defaultDebounce || 0)
        : debounce;

      // TODO: почему??? можно же распознать в драйвере
      if (typeof edge !== 'undefined' && edge !== Edge.both) {
        throw new Error(
          `GpioPcf8574.digitalSetupInput: Edge "rising" or "falling" aren't supported ` +
          ` on Pcf8574 board because there isn't way to recognize which pin has been exactly changed`
        );
      }

      this.log.debug(
        `GpioPcf8574.digitalSetupInput. ` +
        `pin: ${pin}, inputMode: ${inputMode}, debounce: ${debounce}`
      );

      return this.expander.setupInput(pin, resolvedDebounce);
    },

    digitalSetupOutput: (pin: number, initialValue: boolean): Promise<void> => {
      this.log.debug(
        `GpioPcf8574.digitalSetupOutput. ` +
        `pin: ${pin}, initialValue: ${initialValue}`
      );

      return this.expander.setupOutput(pin, initialValue);
    },

    digitalGetPinDirection: async (pin: number): Promise<PinDirection | undefined> => {
      return this.expander.getPinDirection(pin);
    },

    digitalGetPinResistorMode: async (pin: number): Promise<InputResistorMode | OutputResistorMode | undefined> => {
      return InputResistorMode.pullup;
    },

    digitalRead: async (pin: number): Promise<boolean> => {
      return this.expander.read(pin);
    },

    /**
     * Set level to output pin
     */
    digitalWrite: (pin: number, value: boolean): Promise<void> => {
      return this.expander.write(pin, value);
    },

    digitalOnChange: async (pin: number, handler: ChangeHandler): Promise<number> => {
      return this.expander.onChange(pin, handler);
    },

    digitalRemoveListener: async (handlerIndex: number): Promise<void> => {
      return this.expander.removeListener(handlerIndex);
    },

  };

  protected actions = {
    getPinMode: async (pin: number): Promise<string> => {
      const direction: PinDirection | undefined = await this.expander.getPinDirection(pin);

      return stringifyPinMode(direction, InputResistorMode.pullup);
    },

    /**
     * Read level of an input or output pin.
     * Pin has to be setup first. To force setup use `digitalForceRead()`
     */
    digitalRead: (pin: number): Promise<boolean> => {
      return this.expander.read(pin);
    },

    /**
     * Write level to an output pin.
     * Pin has to be setup first as an output. To force setup use `digitalForceWrite()`
     */
    digitalWrite: (pin: number, level: boolean): Promise<void> => {
      return this.expander.write(pin, level);
    },

    /**
     * Setup pin as input and return it's value.
     * If direction isn't changed then setup won't be done.
     */
    digitalForceRead: async (pin: number): Promise<boolean> => {
      const direction: PinDirection | undefined = await this.expander.getPinDirection(pin);
      // if setup different or not set
      if (typeof direction === 'undefined' || direction !== PinDirection.input) {
        // clear pin only if it has another mode
        if (typeof direction !== 'undefined') await this.expander.clearPin(pin);
        // in case pin hasn't been setup or need to resetup
        await this.expander.setupInput(pin, 0);
      }

      return this.expander.read(pin);
    },

    /**
     * Setup pin as output and write the initial value.
     * If direction isn't changed then setup won't be done.
     */
    digitalForceWrite: async (pin: number, level: boolean, outputMode?: OutputResistorMode): Promise<void> => {
      const direction: PinDirection | undefined = await this.expander.getPinDirection(pin);
      // if setup different or not set
      if (typeof direction === 'undefined' || direction !== PinDirection.output) {
        // clear pin only if it has another mode
        if (typeof direction !== 'undefined') await this.expander.clearPin(pin);

        // in case pin hasn't been setup or need to resetup
        await this.expander.setupOutput(pin, level);
      }
      // write initial value
      return this.expander.write(pin, level);
    },
  };

}
