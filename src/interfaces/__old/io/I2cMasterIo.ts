import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';
import IoContext from '../../../../../squidlet/__old/system/interfaces/IoContext';


export interface I2cBusParams {
  // bus number on raspberry pi like hosts
  //bus?: string | number;
  // SDA pin on micro-controller
  pinSDA?: number;
  // SCL pin on micro-controller
  pinSCL?: number;
  // bus frequency. Default is 100000
  clockHz: number;
}

export interface I2cDefinition {
  // bus params by bus num|name
  buses: {[index: string]: I2cBusParams};
  // Bus num which is set if bus isn't specified in methods props
  defaultBus?: string | number;
}

// low level instance interface
export interface I2cMasterBusLike {
  read(addrHex: number, quantity: number): Promise<Uint8Array>;
  write(addrHex: number, data: Uint8Array): Promise<void>;
  destroy(): Promise<void>;
}


export const defaultI2cParams: I2cBusParams = {
  clockHz: 100000,
};

export const Methods = [
  'init',
  'configure',
  'destroy',
  'destroyBus',
  'i2cWriteDevice',
  'i2cReadDevice',
];


export default interface I2cMasterIo extends IoItem {
  init(ioContext: IoContext): Promise<void>;
  configure(definition: I2cDefinition): Promise<void>;
  destroy(): Promise<void>;

  destroyBus(busNum: string | number): Promise<void>;

  i2cWriteDevice(busNum: string | number | undefined, addrHex: number, data: Uint8Array): Promise<void>;
  i2cReadDevice(busNum: string | number | undefined, addrHex: number, count: number): Promise<Uint8Array>;
}
