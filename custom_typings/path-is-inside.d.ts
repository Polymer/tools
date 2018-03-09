declare module 'path-is-inside' {
  function pathIsInside(thePath: string, potentialParent: string): boolean;
  export = pathIsInside;
}
