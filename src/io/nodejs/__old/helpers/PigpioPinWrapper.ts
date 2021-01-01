import {callPromised} from '../../../../../../squidlet-lib/src/common';
import {removeItemFromArray} from '../../../../../../squidlet-lib/src/arrays';


export type PigpioHandler = (level: number, tick: number) => void;

export interface PigpioOptions {
  host?: string;
  port?: number;
  timeout?: number;
}

export interface PigpioInfo {
  host: string;
  // default is 8888
  port: number;
  timeout: number;
  pipelining: boolean;
  commandSocket: boolean;
  notificationSocket: boolean;
  pigpioVersion: number;
  hwVersion: number;
  hardware_type: number;
  userGpioMask: number;
  version: string;
}


/**
 * Wrapper of pigpio-client's gpio to use promises.
 */
export default class PigpioPinWrapper {
  private gpio: any;
  private listeners: PigpioHandler[] = [];


  constructor(gpio: any) {
    this.gpio = gpio;
  }

  destroy() {
    this.$clear();
    delete this.listeners;
  }

  $clear() {
    try {
      for (let cb of this.listeners) {
        this.gpio.endNotify(cb);
      }
    }
    catch (e) {
      // do noting on error
    }

    delete this.gpio;
  }

  $renew(gpio: any) {
    this.gpio = gpio;

    for (let cb of this.listeners) {
      this.gpio.notify(cb);
    }
  }

  modeSet(mode: 'input' | 'output'): Promise<void> {
    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    return callPromised(this.gpio.modeSet, mode);
  }

  modeGet(): Promise<number> {
    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    return callPromised(this.gpio.modeGet);
  }

  pullUpDown(pullUpDown: number): Promise<void> {
    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    return callPromised(this.gpio.pullUpDown, pullUpDown);
  }

  read(): Promise<number> {
    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    return callPromised(this.gpio.read);
  }

  write(value: number): Promise<void> {
    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    return callPromised(this.gpio.write, value);
  }

  notify(cb: PigpioHandler) {
    this.listeners.push(cb);

    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    this.gpio.notify(cb);
  }

  endNotify(cb: PigpioHandler) {
    this.listeners = removeItemFromArray(this.listeners, cb);

    if (!this.gpio) throw new Error(`Pigpio hasn't been connected`);

    this.gpio.endNotify(cb);
  }

}
