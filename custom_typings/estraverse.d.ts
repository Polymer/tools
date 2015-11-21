declare module 'estraverse' {
  import {Node} from 'estree';
  interface Callbacks {
    enter?: (node:Node, parent:Node)=>any;
    leave?: (node:Node, parent:Node)=>any;


    // Methods provided for you, don't override.
    break?: ()=>void;
    remove?: ()=>void;
    skip?: ()=>void;
  }
  export function traverse(n: Node, callbacks:Callbacks):void;
}
