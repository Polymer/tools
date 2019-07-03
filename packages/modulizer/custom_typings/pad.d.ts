declare module 'pad' {
  interface Options {
    strip: boolean;
  }
  function pad(s: string, padding: number, options?: Options): string;
  namespace pad {}
  export = pad;
}
