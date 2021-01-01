import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';
import PigpioPinWrapper from '../../../../../squidlet-networking/src/io/nodejs/helpers/PigpioPinWrapper';


export const Methods = [
  'init',
  'configure',
  'destroy',
  'isPinInitialized',
  'getPinInstance',
  'makePinInstance',
  'clearPin',
  'getInstantiatedPinList',
  'i2cOpen',
  'i2cClose',
  'i2cWriteDevice',
  'i2cReadDevice',
];

export default interface PigpioClientIo extends IoItem {
  isPinInitialized(pin: number): boolean;
  getPinInstance(pin: number): PigpioPinWrapper | undefined;
  makePinInstance(pin: number): void;
  clearPin(pin: number): void;
  getInstantiatedPinList(): string[];
  i2cOpen(bus: number, address: number): Promise<number>;
  i2cClose(addressConnectionId: number): Promise<void>;
  i2cWriteDevice(addressConnectionId: number, data: Uint8Array): void;
  i2cReadDevice(addressConnectionId: number, count: number): Promise<Uint8Array>;
}
