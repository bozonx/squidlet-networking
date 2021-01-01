import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import ModBusMasterRtuIo from '../../../../../squidlet/__old/system/interfaces/io/ModBusMasterRtuIo';
import {StatusHandler} from '../../../../../squidlet/__old/system/interfaces/Connection';


export interface ModbusMasterDriverProps {
  portNum: number;
  slaveId: number;
}


// TODO: нужно ли разделять RTU и TCP драйверы ????


export class ModbusMaster extends DriverBase<ModbusMasterDriverProps> {
  private modBusIo!: ModBusMasterRtuIo;


  init = async () => {
    this.modBusIo = this.context.getIo('ModBusMasterRtu');
  }


  isConnected(): boolean {
    // TODO: add
    return true;
  }

  // TODO: rename to onConnected
  onConnect(cb: StatusHandler): number {
    // TODO: add
    return 0;
  }

  // TODO: rename to onDisconnected
  onDisconnect(cb: StatusHandler): number {
    // TODO: add
    return 0;
  }

  removeListener(handlerIndex: number): void {
    // TODO: add
  }


  async readCoils(start: number, count: number): Promise<boolean[]> {
    return this.modBusIo.readCoils(
      this.props.portNum,
      this.props.slaveId,
      start,
      count
    );
  }

  async readDiscreteInputs(start: number, count: number): Promise<boolean[]> {
    return this.modBusIo.readDiscreteInputs(
      this.props.portNum,
      this.props.slaveId,
      start,
      count
    );
  }

  async readHoldingRegisters(start: number, count: number): Promise<Uint16Array> {
    return this.modBusIo.readHoldingRegisters(
      this.props.portNum,
      this.props.slaveId,
      start,
      count
    );
  }

  async readInputRegisters(start: number, count: number): Promise<Uint16Array> {
    return this.modBusIo.readInputRegisters(
      this.props.portNum,
      this.props.slaveId,
      start,
      count
    );
  }

  async writeSingleCoil(address: number, value: boolean): Promise<void> {
    return this.modBusIo.writeSingleCoil(
      this.props.portNum,
      this.props.slaveId,
      address,
      value
    );
  }

  async writeSingleRegister(address: number, value: number): Promise<void> {
    return this.modBusIo.writeSingleRegister(
      this.props.portNum,
      this.props.slaveId,
      address,
      value
    );
  }

  async writeMultipleCoils(start: number, values: boolean[]): Promise<void> {

    // TODO: проверять длину тут или в IO

    // if (result.length !== length) {
    //   throw new Error(
    //     `PollOnceModbusЖ Invalid length of readPackageLength result: ${result.length}, ` +
    //     `Expected: ${READ_PACKAGE_LENGTH_COUNT}`
    //   );
    // }


    return this.modBusIo.writeMultipleCoils(
      this.props.portNum,
      this.props.slaveId,
      start,
      values
    );
  }

  async writeMultipleRegisters(start: number, values: Uint16Array): Promise<void> {
    return this.modBusIo.writeMultipleRegisters(
      this.props.portNum,
      this.props.slaveId,
      start,
      values
    );
  }

}


export default class Factory extends DriverFactoryBase<ModbusMaster, ModbusMasterDriverProps> {
  protected SubDriverClass = ModbusMaster;
  protected instanceId = (props: ModbusMasterDriverProps): string => {
    return `${props.portNum}-${props.slaveId}`;
  }
}
