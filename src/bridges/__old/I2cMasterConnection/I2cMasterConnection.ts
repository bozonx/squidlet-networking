import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import Connection, {
  CONNECTION_SERVICE_TYPE,
  ConnectionServiceType, ConnectionsEvents,
  IncomeMessageHandler,
  StatusHandler
} from '../../../../../squidlet/__old/system/interfaces/Connection';
import {uint8ToUint16} from '../squidlet-lib/src/binaryHelpers';
import IndexedEventEmitter from '../squidlet-lib/src/IndexedEventEmitter';
import {makeCallFunctionMessage} from '../../../../../squidlet/__old/system/lib/remoteFunctionProtocol/writeLogic';

import {
  SemiDuplexFeedback,
  SemiDuplexFeedbackBaseProps
} from '../../drivers/SemiDuplexFeedback/SemiDuplexFeedback';
import {I2cMaster, I2cMasterDriverProps} from '../../../../../squidlet-networking/src/drivers/I2cMaster/I2cMaster';


interface Props extends SemiDuplexFeedbackBaseProps, I2cMasterDriverProps {
}

const WRITE_START_INDEX = 0;

// TODO: use Sender ???
// TODO: review poll once logic

export default class I2cMasterConnection extends ServiceBase<Props> implements Connection {
  serviceType: ConnectionServiceType = CONNECTION_SERVICE_TYPE;

  private events = new IndexedEventEmitter();
  private semiDuplexFeedback!: SemiDuplexFeedback;
  private i2cMaster!: I2cMaster;
  //private pollOnce!: PollOnceModbus;


  init = async () => {
    this.semiDuplexFeedback = await this.context.getSubDriver(
      'SemiDuplexFeedback',
      {
        pollIntervalMs: this.props.pollIntervalMs,
        int: this.props.int,
        // TODO: make feedbackId
        //feedbackId: `mbc${this.props.}`,
        compareResult: false,
      }
    );
    this.i2cMaster = await this.context.getSubDriver(
      'I2cMaster',
      {
        // TODO: add props
        portNum: this.props.portNum,
        slaveId: this.props.slaveId,
      }
    );
    //this.pollOnce = new PollOnceModbus(this.i2cMaster, this.log.warn);

    this.i2cMaster.onConnected(() => this.events.emit(ConnectionsEvents.connected));
    this.i2cMaster.onDisconnected(() => this.events.emit(ConnectionsEvents.disconnected));
    this.semiDuplexFeedback.startFeedback(this.feedbackHandler);
    //this.pollOnce.addEventListener(this.handleIncomeMessage);
  }

  destroy = async () => {
    this.events.destroy();
  }


  /**
   * Send data to peer and don't wait for response.
   * Port is from 0 and up to 253. Don't use 254 and 255.
   */
  async send(channel: number, payload: Uint8Array): Promise<void> {

    // TODO: make packages from buffer

    const data8Bit = makeCallFunctionMessage(channel, payload);
    // const data8Bit = makeCallFunctionMessage(new Uint8Array([
    //   channel,
    //   ...payload,
    // ]));
    const package16Bit: Uint16Array = uint8ToUint16(data8Bit);

    await this.i2cMaster.writeMultipleRegisters(WRITE_START_INDEX, package16Bit);
  }

  isConnected(): boolean {
    return this.i2cMaster.isConnected();
  }

  onIncomeMessage(cb: IncomeMessageHandler): number {
    return this.events.addListener(ConnectionsEvents.message, cb);
  }

  onConnect(cb: StatusHandler): number {
    return this.events.addListener(ConnectionsEvents.connected, cb);
  }

  onDisconnect(cb: StatusHandler): number {
    return this.events.addListener(ConnectionsEvents.disconnected, cb);
  }

  /**
   * Remove listener of onIncomeData, onConnect or onDisconnect
   */
  removeListener(handlerIndex: number): void {
    this.events.removeListener(handlerIndex);
  }


  // TODO: проверить что будет гарантированно дожидаться результата и не будет
  //       делаться других запросов
  private feedbackHandler = async (): Promise<Uint8Array | undefined> => {
    await this.pollOnce.pollOnce();

    return;
  }

  private handleIncomeMessage = (channel: number, payload: Uint8Array) => {
    this.events.emit(ConnectionsEvents.message, channel, payload);
  }

}
