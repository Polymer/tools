declare module 'dom5' {
  export interface Node {
    nodeName: string;
    tagName: string;
    childNodes: Node[];
    parentNode: Node;
    attrs: Attr[];
    value?: string;
    data?: string;
    __location?: {
      start: number;
    }
  }
  export interface Attr {
    name: string;
    value: string;
  }
  interface ParseOptions {
    locationInfo: boolean;
  }

  export function parse(text: string, opts?: ParseOptions):Node;
  export function parseFragment(text: string, opts?: ParseOptions):Node;

  export function serialize(node: Node): string;

  export type Predicate = (n:Node) => boolean;
  export function query(root: Node, predicate: Predicate):Node;
  export function queryAll(root: Node, predicate: Predicate):Node[];
  export function nodeWalkAllPrior(node: Node, predicate: Predicate):Node[];
  export function treeMap(node: Node, walker:(node: Node)=>void):void;
  export var isCommentNode: Predicate;

  export interface PredicateCombinators {
    hasTagName(name: string):Predicate;
    hasAttr(name: string): Predicate;
    hasAttrValue(name: string, value: string): Predicate;
    NOT(pred: Predicate):Predicate;
    AND(...preds: Predicate[]):Predicate;
    OR(...preds: Predicate[]):Predicate;
  }
  export var predicates: PredicateCombinators;
}
