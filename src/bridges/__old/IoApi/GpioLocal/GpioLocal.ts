import DeviceBase from '../../../../../../squidlet/__old/system/base/DeviceBase';
import Gpio from 'system/interfaces/Gpio';
import DigitalInputIo, {ChangeHandler} from '../../../../../../squidlet/__old/system/interfaces/io/DigitalInputIo';
import {Edge, InputResistorMode, OutputResistorMode, PinDirection} from '../../../../../../squidlet/__old/system/interfaces/gpioTypes';
import {stringifyPinMode} from '../squidlet-lib/src/digitalHelpers';


interface GpioLocalProps {
  // default debounce for all ge input pins
  defaultDebounce?: number;
}


/**
 * GPIO device which is represent a local digital, analog and PWM IO ports.
 * Don't specify more than one instance in config please.
 * Default instance in config should be names as "gpio".
 * Props of this instance will be defaults of IO devices.
 */
export default class GpioLocal extends DeviceBase<GpioLocalProps> {
  private get digitalIo(): DigitalInputIo {
    return this.context.getIo('Digital');
  }


  destroy = async () => {
    // clear all the pins on destroy this instance (actually means destroy system).
    await this.digitalIo.clearAll();
  }


  /**
   * Methods for manipulate via Binary drivers
   */
  gpio: Gpio = {
    digitalSetupInput: (
      pin: number,
      inputMode: InputResistorMode,
      debounce: number = 0,
      edge: Edge = Edge.both
    ): Promise<void> => {
      const resolvedDebounce: number = (typeof debounce === 'undefined')
        ? (this.props.defaultDebounce || 0)
        : debounce;

      this.log.debug(
        `GpioLocal.digitalSetupInput. ` +
        `pin: ${pin}, inputMode: ${inputMode}, debounce: ${debounce}, edge: ${edge}`
      );

      return this.digitalIo.setupInput(pin, inputMode, resolvedDebounce, edge);
    },

    digitalSetupOutput: (pin: number, initialValue: boolean, outputMode: OutputResistorMode): Promise<void> => {
      this.log.debug(
        `GpioLocal.digitalSetupOutput. ` +
        `pin: ${pin}, initialValue: ${initialValue}, outputMode: ${outputMode}`
      );

      return this.digitalIo.setupOutput(pin, initialValue, outputMode);
    },

    digitalGetPinDirection: (pin: number): Promise<PinDirection | undefined> => {
      return this.digitalIo.getPinDirection(pin);
    },

    digitalGetPinResistorMode: (pin: number): Promise<InputResistorMode | OutputResistorMode | undefined> => {
      return this.digitalIo.getPinResistorMode(pin);
    },

    digitalRead: (pin: number): Promise<boolean> => {
      this.log.debug(`GpioLocal.digitalRead. pin: ${pin}`);

      return this.digitalIo.read(pin);
    },

    // only for output pins
    digitalWrite: (pin: number, level: boolean): Promise<void> => {
      this.log.debug(`GpioLocal.digitalWrite. pin: ${pin}, level: ${level}`);

      return this.digitalIo.write(pin, level);
    },

    digitalOnChange: (pin: number, handler: ChangeHandler): Promise<number> => {
      return this.digitalIo.onChange(pin, handler);
    },

    digitalRemoveListener: (handlerIndex: number): Promise<void> => {
      return this.digitalIo.removeListener(handlerIndex);
    },
  };

  protected actions = {
    getPinMode: async (pin: number): Promise<string> => {
      const direction: PinDirection | undefined = await this.digitalIo.getPinDirection(pin);
      const mode: InputResistorMode | OutputResistorMode | undefined =
        await this.digitalIo.getPinResistorMode(pin);

      return stringifyPinMode(direction, mode);
    },

    /**
     * Read level of an input or output pin.
     * Pin has to be setup first. To force setup use `digitalForceRead()`
     */
    digitalRead: (pin: number): Promise<boolean> => {
      return this.digitalIo.read(pin);
    },

    /**
     * Write level to an output pin.
     * Pin has to be setup first as an output. To force setup use `digitalForceWrite()`
     */
    digitalWrite: (pin: number, level: boolean): Promise<void> => {
      return this.digitalIo.write(pin, level);
    },

    /**
     * Setup pin as input and return it's value.
     * If mode and direction aren't change then setup won't be done.
     */
    digitalForceRead: async (pin: number, inputMode?: InputResistorMode): Promise<boolean> => {
      const direction: PinDirection | undefined = await this.digitalIo.getPinDirection(pin);
      const mode: InputResistorMode | OutputResistorMode | undefined =
        await this.digitalIo.getPinResistorMode(pin);
      // if setup different or not set
      if (
        typeof direction === 'undefined'
        || typeof mode === 'undefined'
        || direction !== PinDirection.input
        || mode !== inputMode
      ) {
        // clear pin only if it has another mode
        if (typeof direction !== 'undefined') await this.digitalIo.clearPin(pin);
        // in case pin hasn't been setup or need to resetup
        await this.digitalIo.setupInput(
          pin,
          inputMode || InputResistorMode.none,
          0,
          Edge.both
        );
      }

      return this.digitalIo.read(pin);
    },

    /**
     * Setup pin as output and write the initial value.
     * If mode and direction aren't changed then setup won't be done.
     */
    digitalForceWrite: async (pin: number, level: boolean, outputMode?: OutputResistorMode): Promise<void> => {
      const direction: PinDirection | undefined = await this.digitalIo.getPinDirection(pin);
      const mode: InputResistorMode | OutputResistorMode | undefined =
        await this.digitalIo.getPinResistorMode(pin);
      // if setup different or not set
      if (
        typeof direction === 'undefined'
        || typeof mode === 'undefined'
        || direction !== PinDirection.output
        || mode !== outputMode
      ) {
        // clear pin only if it has another mode
        if (typeof direction !== 'undefined') await this.digitalIo.clearPin(pin);

        // in case pin hasn't been setup or need to resetup
        await this.digitalIo.setupOutput(
          pin,
          level,
          outputMode || OutputResistorMode.none
        );
      }
      // write initial value
      return this.digitalIo.write(pin, level);
    },
  };

}
