declare module 'estraverse' {
  import * as estree from 'estree';
  export interface Visitor {
    enter?: (node: estree.Node, parentNode: estree.Node) => (void|
                                                             VisitorOption);
    leave?: (node: estree.Node, parentNode: estree.Node) => (void|
                                                             VisitorOption);

    fallback?: 'iteration';
  }

  export enum VisitorOption {Skip, Break, Remove}

  export function traverse(ast: estree.Node, visitor: Visitor): any;
}
