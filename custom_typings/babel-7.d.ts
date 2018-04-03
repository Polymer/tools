// Babel 7 doesn't have typings yet. These are minimal and temporary

declare module '@babel/core';

declare module '@babel/plugin-syntax-import-meta';

declare module '@babel/template';

declare module '@babel/traverse' {
  import * as t from 'babel-types';
  export type Node = t.Node;
  export class NodePath<T = Node> {
    node: T;

    // ------------------------- replacement -------------------------
    /**
     * Replace a node with an array of multiple. This method performs the
     * following steps:
     *
     *  - Inherit the comments of first provided node with that of the current
     * node.
     *  - Insert the provided nodes after the current node.
     *  - Remove the current node.
     */
    replaceWithMultiple(nodes: Node[]): void;

    /**
     * Parse a string as an expression and replace the current node with the
     * result.
     *
     * NOTE: This is typically not a good idea to use. Building source strings
     * when transforming ASTs is an antipattern and SHOULD NOT be encouraged.
     * Even if it's easier to use, your transforms will be extremely brittle.
     */
    replaceWithSourceString(replacement: any): void;

    /** Replace the current node with another. */
    replaceWith(replacement: Node|NodePath): void;

    /**
     * This method takes an array of statements nodes and then explodes it
     * into expressions. This method retains completion records which is
     * extremely important to retain original semantics.
     */
    replaceExpressionWithStatements(nodes: Node[]): Node;

    replaceInline(nodes: Node|Node[]): void;
  }
}
