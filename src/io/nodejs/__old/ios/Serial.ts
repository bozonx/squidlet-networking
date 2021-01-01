import {SerialParams, SerialPortLike} from '../../../../../../squidlet/__old/system/interfaces/io/SerialIo';
import {omitObj} from '../squidlet-lib/src/objects';
import {SERVER_STARTING_TIMEOUT_SEC} from '../../../../../../squidlet/__old/system/constants';
import SerialIoBase from '../../../../../../squidlet/__old/system/lib/base/SerialIoBase';
import {convertBufferToUint8Array} from '../squidlet-lib/src/buffer';
import IoContext from '../../../../../../squidlet/__old/system/interfaces/IoContext';
import PigpioClient from './PigpioClient';


export default class Serial extends SerialIoBase {
  private _client?: PigpioClient;

  private get client(): PigpioClient {
    return this._client as any;
  }

  async init(ioContext: IoContext): Promise<void> {
    this._client = ioContext.getIo<PigpioClient>('PigpioClient');
  }


  protected createConnection(portNum: number, params: SerialParams): Promise<SerialPortLike> {
    return new Promise<SerialPortLike>((resolve, reject) => {
      if (!params.dev) {
        throw new Error(
          `Params of serial port ${portNum} has to have a "dev" parameter ` +
          `which points to serial device`
        );
      }

      const options: OpenOptions = omitObj(params, 'dev', 'pinRX', 'pinTX');
      const serialPort: SerialPort = new SerialPort(params.dev, options);

      let openTimeout: any;
      let errorHandler: any;
      let openHandler: any;

      errorHandler = (err: {message: string}) => {
        clearTimeout(openTimeout);
        serialPort.off('error', errorHandler);
        serialPort.off('open', openHandler);
        reject(err.message);
      };
      openHandler = () => {
        clearTimeout(openTimeout);
        serialPort.off('error', errorHandler);
        serialPort.off('open', openHandler);
        resolve(serialPort as any);
      };

      serialPort.on('error', errorHandler);
      serialPort.on('open', openHandler);

      openTimeout = setTimeout(() => {
        serialPort.off('error', errorHandler);
        serialPort.off('open', openHandler);
        reject(`Serial IO: timeout of opening a serial port has been exceeded`);
      }, SERVER_STARTING_TIMEOUT_SEC * 1000);
    });
  }

  protected prepareBinaryDataToWrite(data: Uint8Array): any {
    return Buffer.from(data);
  }

  protected convertIncomeBinaryData(data: any): Uint8Array {
    if (Buffer.isBuffer(data)) throw new Error(`Unknown type of returned value "${JSON.stringify(data)}"`);

    return convertBufferToUint8Array(data as Buffer);
  }

}
