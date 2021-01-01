import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';


export const Methods = [
  'send',
  'listenIncome',
  'removeListener',
];


export default interface I2cSlaveIo extends IoItem {
  send(bus: number, data: Uint8Array): Promise<void>;
  listenIncome(bus: number, handler: (data: Uint8Array) => void): Promise<void>;
  removeListener(bus: number, handler: (data: Uint8Array) => void): Promise<void>;
}
