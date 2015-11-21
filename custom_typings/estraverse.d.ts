declare module 'estraverse' {
  import {Node} from 'estree';
  interface Callbacks {
    enter?: (node:Node, parent:Node)=>any;
    exit?: (node:Node, parent:Node)=>any;
  }
  export function traverse(n: Node, callbacks:Callbacks):void;
}
