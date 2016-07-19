/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as dom5 from 'dom5';
import * as espree from 'espree';
import * as parse5 from 'parse5';
import {ASTNode} from 'parse5';

import {Analyzer} from '../analyzer';
import {Document} from './document';
import {Parser} from './parser';
import {JavaScriptDocument} from './javascript-document';

export class JavaScriptParser implements Parser<JavaScriptDocument> {

  analyzer: Analyzer;

  constructor(analyzer: Analyzer) {
    this.analyzer = analyzer;
  }

  parse(contents: string, url: string): JavaScriptDocument {
    let ast = espree.parse(contents, {
      attachComment: true,
      comment: true,
      loc: true,
      ecmaVersion: 6,
    });

    return new JavaScriptDocument({
      url,
      contents,
      ast,
      imports: [],
      inlineDocuments: [],
      analyzer: this.analyzer,
    });
  }

}
