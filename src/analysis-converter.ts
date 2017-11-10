/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Analysis, Document} from 'polymer-analyzer';

import {BaseConverter, BaseConverterOptions} from './base-converter';
import {ConversionMetadata} from './conversion-metadata';
import {DocumentConverter} from './document-converter';
import {OriginalDocumentUrl} from './urls/types';

const _isInBowerRegex = /(\b|\/|\\)(bower_components)(\/|\\)/;
const _isInNpmRegex = /(\b|\/|\\)(node_modules)(\/|\\)/;
const isNotExternal = (d: Document) =>
    !_isInBowerRegex.test(d.url) && !_isInNpmRegex.test(d.url);

export interface AnalysisConverterOptions extends BaseConverterOptions {
  readonly packageName: string;
  readonly packageType?: 'element'|'application';
  readonly mainFiles?: Iterable<string>;
}

/**
 * Converts an entire Analysis object.
 */
export class AnalysisConverter extends BaseConverter implements
    ConversionMetadata {
  readonly packageName: string;
  readonly packageType: 'element'|'application';

  constructor(analysis: Analysis, options: AnalysisConverterOptions) {
    super(analysis, options);

    this.packageName = options.packageName;
    this.packageType = options.packageType || 'element';

    const includes = this.includes as Set<string>;
    for (const mainfile of options.mainFiles || []) {
      includes.add(mainfile);
    }
  }


  protected getDocumentConverter(
      document: Document,
      visited: Set<OriginalDocumentUrl>): DocumentConverter {
    return new DocumentConverter(
        this, document, this.packageName, this.packageType, visited);
  }

  protected filter(document: Document) {
    return isNotExternal(document) && !!document.url;
  }
}
