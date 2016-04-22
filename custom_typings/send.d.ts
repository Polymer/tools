declare module 'send' {
  import {ServerRequest} from 'http';
  module send {
    interface SendError extends Error {
      status: number;
    }
    interface SendOptions {
      dotfiles?: string,
      end?: number,
      etag?: boolean,
      extensions?: boolean | Array<string>,
      index?: boolean | string,
      lastModified?: boolean,
      maxAge?: number | string,
      root?: string,
      start?: number,
    }
  }
  // TODO(justinfagnani): any->Request
  function send(
      req: ServerRequest,
      path: string,
      options?: send.SendOptions): any;
  export = send;
}
