/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {Analyzer} from '../analyzer';

/**
 * A parsed Document.
 *
 * @template A The AST type of the document
 * @template V The Visitor type of the document
 */
export abstract class Document<A, V> {

  // abstract type: string; // argh, how do I declare an abstract field?
  type: string;
  url: string;
  contents: string;
  ast: A;
  inlineDocuments: Document<any, any>[];

  constructor(from: DocumentInit<A>) {
    this.url = from.url;
    this.contents = from.contents;
    this.ast = from.ast;
    this.inlineDocuments = from.inlineDocuments;
  }

  abstract visit(visitors: V[]): void;

}

export interface DocumentInit<A> {
  url: string;
  contents: string;
  ast: A;
  inlineDocuments: Document<any, any>[];
}
