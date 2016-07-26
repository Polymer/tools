declare module 'shady-css-parser' {
  export class Parser { parse(cssText: string): Node; }
  export interface Node { type: string; }
  export class NodeVisitor {
    path: Node[];
    visit(node: Node): any;
  }
}
