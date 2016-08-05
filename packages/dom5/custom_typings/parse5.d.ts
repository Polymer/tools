import * as parse5 from 'parse5';

declare module 'parse5' {
  interface TreeAdapter {}
  export class Parser {
    constructor(treeAdapter?: TreeAdapter, options?: ParserOptions);
    parse(html: string): ASTNode;
    parseFragment(html: string): ASTNode;
  }
  export class Serializer {
    constructor();
    serialize(node: ASTNode): string;
  }
  export const TreeAdapters: {
    default: TreeAdapter;  //
  };
  export interface ASTNode { tagName?: string; }
  export interface CommentNode extends ASTNode { data: string; }
}