declare module 'send' {
  module send {}
  // TODO(justinfagnani): any->Request
  function send(req: any, path:string): any;
  export = send;
}
