import {ASTNode} from 'parse5';

declare module 'parse5' {
  // TODO(fks) 11-01-2016: Remove this once @types/parse5 includes `tagName`
  // (https://github.com/DefinitelyTyped/DefinitelyTyped/pull/12424)
  export interface ASTNode { tagName?: string; }
}