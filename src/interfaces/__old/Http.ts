export type HttpMethods = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type HttpContentType = 'text/plain'
  | 'text/html'
  | 'application/json'
  | 'application/javascript'
  | 'application/xml'
  | 'application/octet-stream';

interface CommonHeaders {
  'content-type'?: HttpContentType;
}

export interface HttpRequestHeaders extends CommonHeaders {
}

export interface HttpResponseHeaders extends CommonHeaders {
}

export interface HttpRequestBase {
  method: HttpMethods;
  url: string;
  headers: HttpRequestHeaders;
}

export interface HttpRequest extends HttpRequestBase {
  body?: string | Uint8Array;
}

export interface HttpResponse {
  headers: HttpResponseHeaders;
  status: number;
  body?: string | Uint8Array;
}
