declare module 'recast' {
    
  import * as estree from 'estree';

  export interface File {
    name: string;
    program: estree.Program;
  }

  export interface Options {
    quote?: 'single' | 'double' | 'auto';
    wrapColumn?: number;
    tabWidth?: number;
  }

  export function parse(source: string): File;

  export function print(node: estree.Node, options?: Options): {code: string};
}
