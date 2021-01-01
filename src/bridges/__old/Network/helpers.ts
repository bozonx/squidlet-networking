import {asciiToUint8Array, deserializeStringArray, serializeStringArray, uint8ArrayToAscii} from '../squidlet-lib/src/serialize';
import NetworkMessage from './interfaces/NetworkMessage';


/**
 * Encode network message to bytes serial.
 * @param message
 */
export function encodeNetworkMessage(message: NetworkMessage): Uint8Array {
  if (typeof message.TTL !== 'number') {
    throw new Error(`TTL has to be a number`);
  }
  else if (message.TTL <=0 || message.TTL > 255) {
    throw new Error(`Incorrect TTL: ${message.TTL}. It has to be from 1 to 255`);
  }

  if (typeof message.messageId !== 'string') {
    throw new Error(`messageId has to be a string`);
  }
  else if (message.messageId.length !== 8) {
    throw new Error(`Incorrect length of messageId: ${message.messageId.length}`);
  }

  else if (typeof message.uri !== 'string') {
    throw new Error(`uri has to be a string`);
  }
  else if (message.uri.length > 255) {
    throw new Error(`uri is too long: ${message.uri.length}`);
  }

  else if (typeof message.to !== 'string') {
    throw new Error(`"to" has to be a string`);
  }
  else if (message.to.length > 255) {
    throw new Error(`Value of message.to is too long: ${message.to.length}`);
  }

  else if (!Array.isArray(message.completeRoute)) {
    throw new Error(`completeRoute has to be an array`);
  }
  else if (message.completeRoute.length > 255) {
    throw new Error(`completeRoute is too long: ${message.completeRoute.length}`);
  }

  else if (!(message.payload instanceof Uint8Array)) {
    throw new Error(`payload has to be an Uint8Array`);
  }

  for (let item of message.completeRoute) {
    if (typeof item !== 'string') {
      throw new Error(`element "${item}" of completeRoute has to be a string`);
    }
    else if (item.length > 255) {
      throw new Error(`element "${item}" of completeRoute is too long: ${message.uri.length}`);
    }
  }

  const result: Uint8Array = new Uint8Array([
    // 1 byte
    message.TTL,
    // 8 bytes
    ...asciiToUint8Array(message.messageId),
    // 1 byte
    message.completeRoute.length,
    ...serializeStringArray([
      message.uri,
      message.to,
    ]),
    ...serializeStringArray(message.completeRoute),
    ...message.payload,
  ]);

  return result;
}

/**
 * Decode network message to object.
 * @param data
 */
export function decodeNetworkMessage(data: Uint8Array): NetworkMessage {
  const completeRouteLength: number = data[9];
  const [parsedArr, completeRouteStartIndex] = deserializeStringArray(data, 10, 2);
  const [completeRoute, lastIndex] = deserializeStringArray(
    data,
    completeRouteStartIndex + 1,
    completeRouteLength
  );

  return {
    TTL: data[0],
    messageId: uint8ArrayToAscii(data.slice(1, 9)),
    uri: parsedArr[0],
    to: parsedArr[1],
    completeRoute,
    payload: data.slice(lastIndex + 1),
  };
}
