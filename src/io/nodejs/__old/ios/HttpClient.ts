import axios, {AxiosResponse} from 'axios';

import {HttpClientIo} from '../../../../../../squidlet/__old/system/interfaces/io/HttpClientIo';
import {HttpRequest, HttpResponse} from '../../../../../../squidlet/__old/system/interfaces/Http';


export default class HttpClient implements HttpClientIo {
  async fetch(request: HttpRequest): Promise<HttpResponse> {
    const result: AxiosResponse = await axios({
      method: request.method,
      headers: request.headers,
      url: request.url,
      // TODO: как должен передаваться body
      data: request.body,
    });

    return {
      // TODO: проверить чтобы были в kebab формате
      headers: result.headers,
      status: result.status,
      // TODO: что с body - наверное надо конвертнуть Buffer в Uint если строка то оставить
      body: result.data,
    };
  }

}
