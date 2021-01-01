import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';
import {Edge, InputResistorMode} from '../../../../../squidlet/__old/system/interfaces/gpioTypes';


export type ChangeHandler = (level: boolean) => void;


export const Methods = [
  'setupInput',
  //'getPinResistorMode',
  'read',
  'onChange',
  'removeListener',
  'clearPin',
  'clearAll',
];


export default interface DigitalInputIo extends IoItem {
  /**
   * Setup pin as an input
   * @param pin - pin number
   * @param inputMode - one of modes: input | input_pullup | input_pulldown | output
   * @param debounce - debounce time in ms. 0 or less = no debounce.
   * @param edge - Which value (0 or 1 or both) will rise an event. One of modes: rising | falling | both
   */
  setup(
    pin: number,
    inputMode: InputResistorMode,
    debounce: number,
    edge: Edge
  ): Promise<void>;

  //getPinDirection(pin: number): Promise<PinDirection | undefined>;

  // /**
  //  * Get resistor pin mode.
  //  * To be sure about direction, please check it before.
  //  * Results might be:
  //  * * undefined - pin hasn't been set up
  //  * * 0 - resistor isn't used
  //  * * 1 - pullUp
  //  * * 2 - pullDown
  //  */
  // getPinResistorMode(pin: number): Promise<InputResistorMode | undefined>;

  read(pin: number): Promise<boolean>;

  // TODO: на самом деле нет смысла навешиваться на отдельный пин когда переделаю api call
  /**
   * Listen of changes of input pins according to specified edge in setup.
   * It allows to add listener even pin hasn't been set up, but better to check it before add a listener.
   */
  onChange(pin: number, handler: ChangeHandler): Promise<number>;

  /**
   * Remove listener which has been added by "onChange" method.
   */
  removeListener(handlerIndex: number): Promise<void>;

  /**
   * Destroy pin and remove listeners of it.
   * After that pin is uncontrolled, if you want to control it again then set it up.
   */
  clearPin(pin: number): Promise<void>;

  /**
   * Destroy all the pins but not destroy Digital IO instance.
   */
  clearAll(): Promise<void>;
}
