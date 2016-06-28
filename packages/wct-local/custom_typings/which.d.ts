declare module 'which' {
  function which(binName: string, cb: (error?: Error, path?: string) => void): void;
  module which {
    function sync(name: string): string;
  }
  export = which;
}
