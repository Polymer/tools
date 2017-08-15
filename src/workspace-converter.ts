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

import {Document} from 'polymer-analyzer';

import {BaseConverter} from './base-converter';
import {ConverterMetadata} from './converter-metadata';
import {DocumentConverter} from './document-converter';
import {OriginalDocumentUrl} from './url-converter';

/**
 * Converts an entire workspace object.
 */
export class WorkspaceConverter extends BaseConverter implements
    ConverterMetadata {
  protected getDocumentConverter(
      document: Document,
      visited: Set<OriginalDocumentUrl>): DocumentConverter {
    const basePackageName = document.url.split('/')[0];
    const packageName = `@polymer/${basePackageName}`;
    return new DocumentConverter(
        this, document, packageName, 'element', visited);
  }
}
