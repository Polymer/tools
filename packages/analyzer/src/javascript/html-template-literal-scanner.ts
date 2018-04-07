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

import * as babel from '@babel/types';

import {ScannedInlineDocument} from '../model/model';

import {getIdentifierName} from './ast-value';
import {Visitor} from './estree-visitor';
import {JavaScriptDocument} from './javascript-document';
import {JavaScriptScanner} from './javascript-scanner';

/**
 * Finds inline HTML documents in Javascript source.
 *
 * e.g.
 *     html`<div></div>`;
 */
export class InlineHtmlDocumentScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const features: ScannedInlineDocument[] = [];

    const myVisitor: Visitor = {
      enterTaggedTemplateExpression(node) {
        const tagName = getIdentifierName(node.tag);
        if (tagName === undefined || !/(^|\.)html$/.test(tagName)) {
          return;
        }
        const inlineDocument = getInlineDocument(node, document);
        if (inlineDocument !== undefined) {
          features.push(inlineDocument);
        }
      }
    };

    await visit(myVisitor);

    return {features};
  }
}

export interface Options {
  /**
   * If true, uses the "raw" template string contents rather than the "cooked"
   * contents. For example: raw contents yields `\n` as two characters, cooked
   * yields it as a newline.
   */
  useRawContents?: boolean;
}

/**
 * Parses the given string as an inline HTML document.
 */
export function getInlineDocument(
    node: babel.TaggedTemplateExpression,
    parsedDocument: JavaScriptDocument,
    options: Options = {}): ScannedInlineDocument|undefined {
  const sourceRangeForLiteral = parsedDocument.sourceRangeForNode(node.quasi);
  if (sourceRangeForLiteral === undefined) {
    return;
  }
  const sourceRangeForContents = {
    file: sourceRangeForLiteral.file,
    start: {
      line: sourceRangeForLiteral.start.line,
      column: sourceRangeForLiteral.start.column + 1
    },
    end: {
      line: sourceRangeForLiteral.end.line,
      column: sourceRangeForLiteral.end.column - 1
    }
  };

  let contents = '';
  let previousEnd: number|undefined;
  for (const quasi of node.quasi.quasis) {
    if (previousEnd !== undefined) {
      const fullExpressionTextWithDelimitors =
          parsedDocument.contents.slice(previousEnd, quasi.start);
      /**
       * Replace everything but whitespace in ${expressions} (including the
       * ${} delimitor part) with whitespace.
       * This skips over the problem of handling expressions, and there's lots
       * of cases it doesn't handle correctly, but it's a start.
       * Consider the js file:
       * ```js
       *   html`<div>${
       *     'Hello world'
       *   }</div>
       * ```
       *
       * If we remove the expression entirely, the html parser receives
       * `<div></div>` and when we ask for the source range of the closing tag
       * it'll give one on the first line, and starting just after the `<div>`.
       * By preserving whitespace and replacing every other character with a
       * space, the HTML parser will receive
       *
       * ```html
       *   <div>
       *     (a bunch of spaces on this line)
       *    </div>
       * ```
       *
       * and so the html parser's source locations will map cleanly onto offsets
       * in the original template literal (excluding characters like `\n`). We
       * could do something more sophisticated later, but this works for most
       * cases and is quick and easy to implement.
       */
      contents += fullExpressionTextWithDelimitors.replace(/\S/g, ' ');
    }
    if (options.useRawContents) {
      contents += quasi.value.raw;
    } else {
      contents += quasi.value.cooked;
    }
    previousEnd = quasi.end;
  }

  let commentText;
  if (node.leadingComments != null) {
    commentText = node.leadingComments.map((c) => c.value).join('\n');
  } else {
    commentText = '';
  }

  return new ScannedInlineDocument(
      'html',
      contents,
      {
        filename: sourceRangeForContents.file,
        col: sourceRangeForContents.start.column,
        line: sourceRangeForContents.start.line
      },
      commentText,
      sourceRangeForContents,
      {language: 'js', node, containingDocument: parsedDocument});
}
