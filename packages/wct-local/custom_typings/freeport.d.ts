declare module 'freeport' {
  function freeport(cb: (error: Error, port: number) => void): void;
  module freeport {}
  export = freeport;
}
