declare module 'css-what' {
  function parse(cssSource: string): parse.WhatResult;
  namespace parse {
    export type WhatResult = Array<SimpleChain>;
    export type SimpleChain = Array<Simple>;
    export type Simple = Tag | Universal | Combiner | Attribute | Pseudo;
    export interface Tag {
      type: 'tag';
      name: string;
    }

    export interface Universal { type: 'universal'; /* the '*' selector */ }

    export interface Combiner {
      type: 'descendant'|'adjacent'|'sibling'|'parent'|'child';
    }

    export interface Attribute {
      type: 'attribute';
      action: 'equals'|'element'|'start'|'end'|'any'|'exists';
      name: string;
      value: string;
      ignoreCase: boolean;
    }

    export interface Pseudo {
      type: 'pseudo';
      name: string;
      data: null|string;
    }
  }
  export = parse;
}
