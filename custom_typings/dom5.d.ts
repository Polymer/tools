declare module 'dom5' {
  export interface Node {
    nodeName: string;
    tagName: string;
    childNodes: Node[];
    parentNode: Node;
    attrs: Attr[];
    value?: string;
    data?: string;
  }
  export interface Attr {
    name: string;
    value: string;
  }
  export type Predicate = (n:Node) => boolean;
  export function parse(text: string):Node;
  export function parseFragment(text: string):Node;
  export function serialize(node: Node): string;
  export function query(root: Node, predicate: Predicate):Node;
  export function queryAll(root: Node, predicate: Predicate):Node[];
  export function nodeWalkAllPrior(node: Node, predicate: Predicate):Node[];
  export var isCommentNode: Predicate;
}
