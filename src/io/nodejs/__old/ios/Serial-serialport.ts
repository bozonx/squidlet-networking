import * as SerialPort from 'serialport';
import {OpenOptions} from 'serialport';

import SerialIo, {SerialParams, SerialPortItemEvent, SerialPortLike} from '../../../../../../squidlet/__old/system/interfaces/io/SerialIo';
import {omitObj} from '../squidlet-lib/src/objects';
import SerialIoBase from '../../../../../../squidlet/__old/system/lib/base/SerialIoBase';
import {convertBufferToUint8Array} from '../squidlet-lib/src/buffer';
import {callPromised} from '../squidlet-lib/src/common';


export default class Serial extends SerialIoBase implements SerialIo {
  protected async createConnection(portNum: number | string, params: SerialParams): Promise<SerialPortLike> {
    if (!params.dev) {
      throw new Error(
        `Params of serial port ${portNum} has to have a "dev" parameter ` +
        `which points to serial device`
      );
    }

    // pick options. baudRate has the same name
    const options: OpenOptions = omitObj(params, 'dev', 'pinRX', 'pinTX');
    const serialPort: SerialPort = new SerialPort(params.dev, options);

    return {
      write(data: any, encode?: string): Promise<void> {
        const bufer: Buffer = Buffer.from(data);

        return callPromised(serialPort.write, bufer, encode);
      },
      close(): Promise<void> {
        return callPromised(serialPort.close);
      },
      on(eventName: SerialPortItemEvent, cb: (...p: any[]) => void) {
        switch (eventName) {
          case 'data':
            serialPort.on('data', (receivedBuffer: Buffer) => {
              if (!Buffer.isBuffer(receivedBuffer)) {
                throw new Error(`Unknown type of returned value "${JSON.stringify(receivedBuffer)}"`);
              }

              return cb(convertBufferToUint8Array(receivedBuffer));
            });
            break;
          case 'error':
            // TODO: check
            serialPort.on('error', (error: { message: string }) => {
              cb(error.message);
            });
            break;
          case 'open':
            serialPort.on('open', cb);
            break;
          default:
            throw new Error(`Unknown event name "${eventName}"`);
        }
      },

      off(eventName: SerialPortItemEvent, cb: (...p: any[]) => void) {
        serialPort.off(eventName, cb);
      }
    };

  }


  // private prepareBinaryDataToWrite(data: Uint8Array): any {
  //   return Buffer.from(data);
  // }

  // private convertIncomeBinaryData(data: any): Uint8Array {
  //   if (Buffer.isBuffer(data)) throw new Error(`Unknown type of returned value "${JSON.stringify(data)}"`);
  //
  //   return convertBufferToUint8Array(data as Buffer);
  // }

}
