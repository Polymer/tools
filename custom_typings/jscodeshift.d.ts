declare module 'jscodeshift' {
  import * as estree from 'estree';

  export function jscodeshift(source: string): estree.Program;

  export = jscodeshift;
}