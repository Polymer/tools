// TODO(rictic): upstream this to dom5 itself.

declare module 'dom5' {
  import {ASTNode} from 'parse5';

  export interface Node extends ASTNode {
    value?: string;
    data?: string;
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
  export function nodeWalk(node: Node, predicate: Predicate):Node;
  export function nodeWalkAll(node: Node, predicate: Predicate):Node[];
  export function nodeWalkAllPrior(node: Node, predicate: Predicate):Node[];
  export function treeMap(node: Node, walker:(node: Node)=>void):void;
  export function getAttribute(node: Node, attrName: string): string;
  export function removeAttribute(node: Node, attrName: string): string;
  export function getTextContent(node: Node): string;
  export function setTextContent(node: Node, string: string): void;
  export function append(parent: Node, newNode: Node): void;
  export function remove(willBeRemoved: Node): void;
  export function replace(current: Node, replacement: Node): void;

  export var isCommentNode: Predicate;
  interface PredicateCombinators {
    hasTagName(name: string):Predicate;
    hasAttr(name: string): Predicate;
    hasAttrValue(name: string, value: string): Predicate;
    NOT(pred: Predicate):Predicate;
    AND(...preds: Predicate[]):Predicate;
    OR(...preds: Predicate[]):Predicate;
  }
  export var predicates: PredicateCombinators;

  interface Constructors {
    element(tagName: string): Node;
    text(content: string): Node;
  }
  export var constructors: Constructors;
}
