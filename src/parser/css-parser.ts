/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as shadyCss from 'shady-css-parser';

import {Analyzer} from '../analyzer';
import {Document} from './document';
import {Parser} from './parser';
import {CssDocument} from './css-document';

export class CssParser implements Parser<CssDocument> {

  analyzer: Analyzer;
  private _parser: shadyCss.Parser;

  constructor(analyzer: Analyzer) {
    this.analyzer = analyzer;
    this._parser = new shadyCss.Parser();
  }

  parse(contents: string, url: string): CssDocument {
    let ast = this._parser.parse(contents);

    return new CssDocument({
      url,
      contents,
      ast,
      imports: [],
      inlineDocuments: [],
      analyzer: this.analyzer,
    });
  }

}
