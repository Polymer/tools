declare module 'resolve' {
  interface ResolveOpts {}

  interface ResolveCb {
    function(err: Error, res: string): void;
  }
  function resolve(id: string, opts: ResolveOpts, cb: ResolveCb): void;
  function resolve(id: string, cb: ResolveCb): void;
  namespace resolve {
    function sync(id: string, opts?: ResolveOpts): string;
  }
  export = resolve;
}
