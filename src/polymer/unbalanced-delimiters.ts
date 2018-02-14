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

import * as dom5 from 'dom5/lib/index-next';
import * as parse5 from 'parse5';
import {ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {stripIndentation} from '../util';

import * as matchers from './matchers';

/**
 * Unbalanced binding expression delimiters occurs when a value such as
 * `[[myValue]]` or `{{myValue}}` have too many or too few brackets on either
 * side.
 */
class UnbalancedDelimiters extends HtmlRule {
  code = 'unbalanced-polymer-delimiters';
  description = stripIndentation(`
      Matches unbalanced delimiters around Polymer databinding expressions.

      For example, {{foo} is missing a } at the end, it should instead be
      {{foo}}.
  `);

  public async checkDocument(parsedHtml: ParsedHtmlDocument):
      Promise<Warning[]> {
    let warnings: Warning[] = [];

    const templates = dom5.queryAll(
        parsedHtml.ast,
        matchers.isDatabindingTemplate,
        dom5.childNodesIncludeTemplate);
    for (const template of templates) {
      warnings =
          warnings.concat(this._getWarningsForTemplate(parsedHtml, template));
    }

    return warnings;
  }

  private _getWarningsForElementAttrs(
      parsedHtml: ParsedHtmlDocument, element: parse5.ASTNode): Warning[] {
    const warnings: Warning[] = [];
    for (const attr of element.attrs) {
      if (this._extractBadBindingExpression(attr.value || '')) {
        warnings.push(new Warning({
          parsedDocument: parsedHtml,
          code: 'unbalanced-delimiters',
          message: this._getMessageForBadBindingExpression(attr.value),
          severity: Severity.ERROR,
          sourceRange:
              parsedHtml.sourceRangeForAttributeValue(element, attr.name)!
        }));
      }
    }
    return warnings;
  }

  private _getWarningsForTemplate(
      parsedHtml: ParsedHtmlDocument, template: parse5.ASTNode): Warning[] {
    let warnings: Warning[] = [];
    const content = parse5.treeAdapters.default.getTemplateContent(template);

    for (const node of dom5.depthFirst(content)) {
      if (dom5.isElement(node) && node.attrs.length > 0) {
        warnings =
            warnings.concat(this._getWarningsForElementAttrs(parsedHtml, node));
      } else if (
          dom5.isTextNode(node) && typeof node.value === 'string' &&
          this._extractBadBindingExpression(node.value)) {
        warnings.push(new Warning({
          parsedDocument: parsedHtml,
          code: 'unbalanced-delimiters',
          message: this._getMessageForBadBindingExpression(node.value),
          severity: Severity.ERROR,
          sourceRange: parsedHtml.sourceRangeForNode(node)!
        }));
      }
    }
    return warnings;
  }

  private _getMessageForBadBindingExpression(text: string): string {
    const delimitersOnly = text.replace(/[^\[\]{}]/g, '');
    const suggestions: {[delimitors: string]: string} = {
      '{{}': ' are you missing a closing \'}\'?',
      '[[]': ' are you missing a closing \']\'?',
      '{}}': ' are you missing an opening \'{\'?',
      '[]]': ' are you missing an opening \'[\'?'
    };
    const suggestion: string = suggestions[delimitersOnly] || '';
    return 'Invalid polymer expression delimiters.  You put \'' +
        delimitersOnly + '\'' + suggestion;
  }

  private _extractBadBindingExpression(text: string): string|undefined {
    // 4 cases, {{}, {}}, [[], []]
    const match = text.match(/\{\{([^\}]*)\}(?!\})|\[\[([^\]]*)\](?!\])/) ||
        text.split('').reverse().join('').match(
            /\}\}([^\{]*)\{(?!\{)|\]\]([^\[]*)\[(?!\[)/);
    if (match) {
      return text;
    }
    return undefined;
  }
}

registry.register(new UnbalancedDelimiters());
