declare module 'resolve-from' {
  function resolveFrom(fromDir: string, moduleId: string): string;
  namespace resolveFrom {
    function silent(fromDir: string, moduleId: string): string;
  }
  export = resolveFrom;
}
