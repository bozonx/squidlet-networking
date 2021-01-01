import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import DriverBase from '../../../../../squidlet/__old/system/base/DriverBase';
import SerialIo from '../../../../../squidlet/__old/system/interfaces/io/SerialIo';
import IndexedEvents from '../squidlet-lib/src/IndexedEvents';
import {SerialMessageHandler} from '../../../../../squidlet/__old/system/interfaces/io/SerialIo';
import {uint8ArrayToAscii} from '../../../../../squidlet-lib/src/serialize';


export interface SerialProps {
  portNum: number | string;
}


export class Serial extends DriverBase<SerialProps> {
  private readonly messageEvents = new IndexedEvents<SerialMessageHandler>();
  private get serialIo(): SerialIo {
    return this.depsInstances.serialIo;
  }


  init = async () => {
    this.depsInstances.serialIo = this.context.getIo('Serial');

    await this.serialIo.onError(this.props.portNum, this.handleError);
    await this.serialIo.onData(this.props.portNum, this.handleData);

    this.log.debug(`Serial driver: Connected to port ${this.props.portNum}`);
  }


  destroy = async () => {
    this.messageEvents.destroy();
    await this.serialIo.destroyPort(this.props.portNum);
  }


  onMessage(cb: SerialMessageHandler, isBinary: boolean = false): number {
    return this.messageEvents.addListener((data: Uint8Array | string) => {
      if (isBinary) {
        cb(data);
      }
      else {
        cb(uint8ArrayToAscii(data as Uint8Array));
      }
    });
  }

  async write(data: Uint8Array) {
    await this.serialIo.write(this.props.portNum, data);
  }

  async print(data: string) {
    return await this.serialIo.print(this.props.portNum, data);
  }

  async println(data: string) {
    return await this.serialIo.print(this.props.portNum, data);
  }

  /**
   * Remove message listener
   */
  removeListener(handlerIndex: number) {
    this.messageEvents.removeListener(handlerIndex);
  }


  private handleData = (data: string | Uint8Array) => {
    this.messageEvents.emit(data);
  }

  private handleError = (err: string) => {
    this.log.error(err);
  }

}


export default class Factory extends DriverFactoryBase<Serial, SerialProps> {
  protected SubDriverClass = Serial;
  protected instanceId = (props: SerialProps): string => String(props.portNum);
}
