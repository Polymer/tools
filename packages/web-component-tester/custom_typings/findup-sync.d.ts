declare module 'findup-sync' {
import * as minimatch from 'minimatch';

  interface Options extends minimatch.IOptions {
    cwd?: string;
  }

  function mod(pattern: string[]|string, opts?: Options): string;
  namespace mod {}
  export = mod;
}
