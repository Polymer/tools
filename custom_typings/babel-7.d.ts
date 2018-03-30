// Babel 7 doesn't have typings yet. These are minimal and temporary

declare module '@babel/core';

declare module '@babel/traverse' {
  import * as t from 'babel-types';
  export type Node = t.Node;
  export class NodePath<T = Node> { node: T; }
}
