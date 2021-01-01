import IoItem from '../../../../../squidlet/__old/system/interfaces/IoItem';
import {SerialParams} from './SerialIo';


export const Methods = [
  'init',
  'configure',
  'destroy',

  'readCoils',
  'readDiscreteInputs',
  'readHoldingRegisters',
  'readInputRegisters',
  'writeSingleCoil',
  'writeSingleRegister',
  'writeMultipleCoils',
  'writeMultipleRegisters',
];

export interface ModbusParams extends SerialParams {
  deRePin?: number;
}

export interface ModbusDefinition {
  // params of ports by portNum or port name
  ports: {[index: string]: ModbusParams};
  // TODO: add default baudRate
  // TODO: add default port
}


// TODO: что должно передаваться из ModbusIo - Uint16Array или Uint8Array ???


export default interface ModBusMasterRtuIo extends IoItem {
  readCoils(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<boolean[]>;

  readDiscreteInputs(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<boolean[]>;

  readHoldingRegisters(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<Uint16Array>;

  readInputRegisters(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<Uint16Array>;

  writeSingleCoil(
    portNum: number | string,
    slaveId: number,
    address: number,
    value: boolean
  ): Promise<void>;

  writeSingleRegister(
    portNum: number | string,
    slaveId: number,
    address: number,
    value: number
  ): Promise<void>;

  writeMultipleCoils(
    portNum: number | string,
    slaveId: number,
    start: number,
    values: boolean[]
  ): Promise<void>;

  writeMultipleRegisters(
    portNum: number | string,
    slaveId: number,
    start: number,
    values: Uint16Array
  ): Promise<void>;
}
