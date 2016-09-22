// The upstream version of this file isn't es module compatible.
// Need to send a PR to fix that.

declare module 'split' {
  interface SplitOptions {
    maxLength: number
  }

  function split(matcher?: any, mapper?: any, options?: SplitOptions): any;
  namespace split {}

  export = split;
}