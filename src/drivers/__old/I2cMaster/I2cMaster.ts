import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import {hexNumToString, hexStringToHexNum} from '../squidlet-lib/src/binaryHelpers';
import I2cMasterIo from '../../../../../squidlet/__old/system/interfaces/io/I2cMasterIo';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import Queue from '../squidlet-lib/src/Queue';
import PeerConnectionLogic from '../../../../../squidlet/__old/system/logic/PeerConnectionLogic';


export interface I2cMasterDriverProps {
  busNum: number;
  // it can be i2c address as a string like '0x5a' or number equivalent - 90
  address: string | number;
}


// TODO: очередь нужна ????


export class I2cMaster extends DriverBase<I2cMasterDriverProps> {
  // converted address string or number to hex. E.g '5a' => 90, 22 => 34
  private addressHex!: number;
  private i2cMasterIo!: I2cMasterIo;
  //private sender!: Sender;
  private peerConnection!: PeerConnectionLogic;
  //private queue!: Queue;


  init = async () => {
    if (typeof this.props.address === 'string') {
      this.addressHex = hexStringToHexNum(String(this.props.address));
    }
    else if (typeof this.props.address !== 'number') {
      throw new Error(`I2cMaster driver: Prop address isn't string or number`);
    }
    else {
      this.addressHex = this.props.address;
    }

    this.i2cMasterIo = this.context.getIo('I2cMaster');
    this.peerConnection = new PeerConnectionLogic(
      this.ping,
      // means all errors are connection error
      (e: Error) => true,
      this.config.config.reconnectTimeoutSec * 1000,
      this.config.config.reconnectTimes,
    );
    //this.queue = new Queue(this.config.config.queueJobTimeoutSec);
  }


  // TODO: add connection logic
  /*
   * * смотрим isConnected адреса
   * * если connected то делаем запрос
   * * если нет (ошибка что нет связи), то навешиваемся на onConnected, ждем 5 сек
   * * если в течении этого времени не был отправлен запрос то rejected.
   *    (либо можно сделать повторный запрос)
   * * если запрос не прошел во всех случаях, то сразу reject
   *   - с ошибкой что нет соединения
   */

  async write(data: Uint8Array): Promise<void> {
    this.log.debug(
      `I2cMaster driver write. busNum ${this.props.busNum}, ` +
      `addr: ${hexNumToString(this.addressHex)}, data: ${JSON.stringify(data)}`
    );

    await this.peerConnection.promise;

    return this.peerConnection.send(
      () => this.i2cMasterIo.i2cWriteDevice(this.props.busNum, this.addressHex, data)
    );
  }

  async read(length: number): Promise<Uint8Array> {
    await this.peerConnection.promise;

    const result: Uint8Array = await this.peerConnection.send(
      () => this.i2cMasterIo.i2cReadDevice(
        this.props.busNum,
        this.addressHex,
        length
      )
    );

    this.log.debug(
      `I2cMaster driver read. busNum ${this.props.busNum}, ` +
      `addrHex: ${hexNumToString(this.addressHex)}, result: ${JSON.stringify(result)}`
    );

    return result;
  }

  isConnected(): boolean {
    return this.peerConnection.isConnected();
  }

  onConnected(cb: () => void): number {
    return this.peerConnection.onConnected(cb);
  }

  onDisconnected(cb: () => void): number {
    return this.peerConnection.onDisconnected(cb);
  }

  removeListener(handlerIndex: number) {
    this.peerConnection.removeListener(handlerIndex);
  }


  private async ping(): Promise<void> {

    // TODO: check

    await this.i2cMasterIo.i2cReadDevice(
      this.props.busNum,
      this.addressHex,
      0
    );
  }

}


export default class Factory extends DriverFactoryBase<I2cMaster, I2cMasterDriverProps> {
  protected SubDriverClass = I2cMaster;
  protected instanceId = (props: I2cMasterDriverProps): string => {
    return `${(typeof props.busNum === 'undefined') ? -1 : props.busNum}-${props.address}`;
  }
}
