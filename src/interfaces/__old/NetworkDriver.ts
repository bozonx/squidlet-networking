export enum NetworkStatus {
  ok = 0,
  // body contains an error string
  errorMessage,
}

export interface NetworkRequest {
  // should be 16 bits
  requestId: number;
  body: Uint8Array;
}

export interface NetworkResponse {
  requestId: number;
  status: NetworkStatus;
  body?: Uint8Array;
  error?: string;
}

export interface NetworkDriverProps {
  busId: number | string;
  // wait seconds for data transfer ends
  //requestTimeoutSec: number;
}

export type IncomeRequestHandler = (request: NetworkRequest) => Promise<NetworkResponse>;
export type IncomeResponseHandler = (request: NetworkResponse) => void;


export default interface NetworkDriver {
  /**
   * Send data and waiting of response.
   * On the other side you should listen to this address and send data to the same address on this side.
   * An error will be risen only if request hasn't been sent or on response timeout.
   * Register is 8 bits.
   * Port is from 0 to 255 but don't use port 255 it is registered for network data transfer.
   */
  request(port: number, body: Uint8Array): Promise<NetworkResponse>;

  /**
   * Handle income request at specified register.
   * You have to generate a response
   */
  onRequest(port: number, handler: IncomeRequestHandler): number;

  /**
   * Remove listener that has been set by `onRequest` or `onResponse`
   */
  removeListener(handlerIndex: number): void;
}
