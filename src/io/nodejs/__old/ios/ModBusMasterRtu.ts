import {ModbusRTUClient} from 'jsmodbus';
import {IUserRequestResolve} from 'jsmodbus/dist/user-request';
import ModbusRTURequest from 'jsmodbus/dist/rtu-request';
import ReadInputRegistersRequestBody from 'jsmodbus/dist/request/read-input-registers';
import {ReadHoldingRegistersRequestBody} from 'jsmodbus/dist/request';
import {CastRequestBody} from 'jsmodbus/dist/request-response-map';
const Modbus = require('jsmodbus');
const SerialPort = require('serialport');
//import * as SerialPort from 'serialport';

import {OpenOptions} from 'serialport';

import ModBusMasterRtuIo, {ModbusDefinition, ModbusParams} from '../../../../../../squidlet/__old/system/interfaces/io/ModBusMasterRtuIo';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';
import {omitObj} from '../squidlet-lib/src/objects';


// TODO: handle errors


export default class ModBusMasterRtu implements ModBusMasterRtuIo {
  private ioContext!: IoContext;
  private definition?: ModbusDefinition;
  private instances: Record<string, ModbusRTUClient> = {};


  /**
   * Initialize platforms Item at System initialization time. It isn't allowed to call it more than once.
   */
  async init(ioContext: IoContext): Promise<void> {
    this.ioContext = ioContext;
  }

  /**
   * Setup props before init.
   * It allowed to call it more than once.
   */
  async configure(definition: ModbusDefinition) {
    this.definition = definition;
  }

  async destroy(): Promise<void> {
    // TODO: add!
  }


  async readCoils(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<boolean[]> {
    const instance = await this.getInstance(portNum, slaveId);
    const result: IUserRequestResolve<ModbusRTURequest> = await instance
      .readCoils(start, count);
    // TODO: check result
    console.log(11111111, result);

    return [];
  }

  async readDiscreteInputs(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<boolean[]> {
    const instance = await this.getInstance(portNum, slaveId);
    const result: IUserRequestResolve<ModbusRTURequest> = await instance
      .readDiscreteInputs(start, count);
    // TODO: check result
    console.log(11111111, result);

    return [];
  }

  async readHoldingRegisters(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<Uint16Array> {
    const instance = await this.getInstance(portNum, slaveId);
    const result: IUserRequestResolve<CastRequestBody<ModbusRTURequest, ReadHoldingRegistersRequestBody>> = await instance
      .readHoldingRegisters(start, count);
    const values: Buffer | number[] = result.response.body.values;

    if (values.length !== count) {
      throw new Error(`Incorrect values length: ${values.length}, expected ${count}`);
    }

    return new Uint16Array(values);
  }

  async readInputRegisters(
    portNum: number | string,
    slaveId: number,
    start: number,
    count: number
  ): Promise<Uint16Array> {
    const instance = await this.getInstance(portNum, slaveId);
    const result: IUserRequestResolve<CastRequestBody<ModbusRTURequest, ReadInputRegistersRequestBody>> = await instance
      .readInputRegisters(start, count);
    const values: Buffer | number[] | Uint16Array = result.response.body.values;

    if (values.length !== count) {
      throw new Error(`Incorrect values length: ${values.length}, expected ${count}`);
    }

    return new Uint16Array(values);
  }

  async writeSingleCoil(
    portNum: number | string,
    slaveId: number,
    address: number,
    value: boolean
  ): Promise<void> {
    const instance = await this.getInstance(portNum, slaveId);
    // TODO: check result
    await instance.writeSingleCoil(address, value);
  }

  async writeSingleRegister(
    portNum: number | string,
    slaveId: number,
    address: number,
    value: number
  ): Promise<void> {
    const instance = await this.getInstance(portNum, slaveId);
    // TODO: check result
    await instance.writeSingleRegister(address, value);
  }

  async writeMultipleCoils(
    portNum: number | string,
    slaveId: number,
    start: number,
    values: boolean[]
  ): Promise<void> {
    const instance = await this.getInstance(portNum, slaveId);
    // TODO: check result
    await instance.writeMultipleCoils(start, values);
  }

  async writeMultipleRegisters(
    portNum: number | string,
    slaveId: number,
    start: number,
    values: Uint16Array
  ): Promise<void> {
    const instance = await this.getInstance(portNum, slaveId);

    console.log(222222222, values)
    // TODO: check result
    await instance.writeMultipleRegisters(start, [...values]);
  }


  private async getInstance(portNum: number | string, slaveId: number): Promise<ModbusRTUClient> {
    const instanceId: string = this.makeInstanceId(portNum, slaveId);

    if (!this.instances[instanceId]) {
      this.instances[instanceId] = await this.makeInstance(portNum, slaveId);
    }

    return this.instances[instanceId];
  }

  private async makeInstance(portNum: number | string, slaveId: number): Promise<ModbusRTUClient> {
    if (!this.definition) {
      throw new Error(`No modbus definitions`);
    }
    else if (!this.definition.ports[portNum]) {
      throw new Error(`No modbus definitions for port "${portNum}"`);
    }

    const combinedParams: ModbusParams = {
      // TODO: add default params ???
      ...this.definition.ports[portNum],
    };

    if (!combinedParams.dev) {
      throw new Error(
        `Definition of modbus serial port ${portNum} doesn't have the "dev" param defined`
      );
    }

    const serialOptions: OpenOptions = omitObj(
      combinedParams,
      'deRePin',
      'dev',
      'pinRX',
      'pinTX'
    );

    // TODO: лучше использовать SerialIo наверное ???
    //       чтобы не допускать создание повторных инстансов ????
    const socket = new SerialPort(combinedParams.dev, serialOptions, (error?: Error | null) => {
      if (!error) return;

      this.ioContext.log.error(
        `ModBusMasterRtu serial "${combinedParams.dev}" initialization error: ${error}`
      );
    });
    const client = new Modbus.client.RTU(socket, slaveId);

    socket.on('error', (err: Error) => {
      this.ioContext.log.error(`ModBusMasterRtu serial error: ${err}`);
    });

    socket.on('close', function () {
      // TODO: what to do ???
      //console.log('close', arguments);
    });

    // socket.on('data', (data: Buffer) => {
    //   console.log(11111111, data);
    // });

    return new Promise((resolve, reject) => {

      // TODO: add timeout and call reject

      socket.on('open', function () {
        resolve(client);
      });
    });
  }

  private makeInstanceId(portNum: number | string, slaveId: number): string {
    return `${portNum}${slaveId}`;
  }

}

// TODO: for reconnecting see node-net-reconnect npm module


// function handleErrors(err: any) {
//   if (Modbus.errors.isUserRequestError(err)) {
//     switch (err.err) {
//       case 'OutOfSync':
//       case 'Protocol':
//       case 'Timeout':
//       case 'ManuallyCleared':
//       case 'ModbusException':
//       case 'Offline':
//       case 'crcMismatch':
//         console.log('Error Message: ' + err.message, 'Error' + 'Modbus Error Type: ' + err.err);
//         break;
//     }
//
//   } else if (Modbus.errors.isInternalException(err)) {
//     console.log('Error Message: ' + err.message, 'Error' + 'Error Name: ' + err.name, err.stack);
//   } else {
//     console.log('Unknown Error', err);
//   }
// }
