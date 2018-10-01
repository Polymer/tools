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
import {Analysis, Document, ParsedHtmlDocument, ParsedJavaScriptDocument} from 'polymer-analyzer';

export function getAnalysisDocument(analysis: Analysis, url: string): Document {
  const result = analysis.getDocument(url);
  if (result.successful) {
    return result.value;
  }
  if (result.error) {
    console.log(result);
    const message = `Unable to get document ${url}: ${result.error.message}`;
    throw new Error(message);
  }
  throw new Error(`Unable to get document ${url}`);
}

export function assertIsHtmlDocument(doc: Document):
    Document<ParsedHtmlDocument> {
  if (doc.kinds.has('html-document')) {
    return doc as Document<ParsedHtmlDocument>;
  } else {
    throw new Error(
        `Document wasn't an HTML document, it's a: ${[...doc.kinds]}`);
  }
}

export function assertIsJsDocument(doc: Document):
    Document<ParsedJavaScriptDocument> {
  if (doc.kinds.has('js-document')) {
    return doc as Document<ParsedJavaScriptDocument>;
  } else {
    throw new Error(
        `Document wasn't an JS document, it's a: ${[...doc.kinds]}`);
  }
}
