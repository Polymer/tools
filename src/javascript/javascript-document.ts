/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import generate from 'babel-generator';
import {Node, Program} from 'babel-types';
import indent = require('indent');

import {SourceRange} from '../model/model';
import {Options as ParsedDocumentOptions, ParsedDocument, StringifyOptions} from '../parser/document';

import {traverse, VisitorOption} from './estraverse-shim';
import {Visitor, VisitResult} from './estree-visitor';

export {Visitor} from './estree-visitor';

/**
 * babel.Node#type is one of around a hundred string literals. We don't have
 * a direct reference to the type that represents any of those string literals
 * though. We can get a reference by taking a Node and using the `typeof`
 * operator, and it doesn't need to be a real Node as all of this happens at
 * analysis time, and nothing happens at runtime.
 */
const __exampleNode: Node = <any>null;
type EstreeType = typeof __exampleNode.type;
interface SkipRecord {
  type: EstreeType;
  depth: number;
}

export interface Options extends ParsedDocumentOptions<Program> {
  parsedAsSourceType: 'script'|'module';
}

export class JavaScriptDocument extends ParsedDocument<Node, Visitor> {
  type = 'js';
  private visitorSkips = new Map<Visitor, SkipRecord>();
  ast: Program;

  /**
   * How the js document was parsed. If 'module' then the source code is
   * definitely an ES6 module, as it has imports or exports. If 'script' then
   * it may be an ES6 module with no imports or exports, or it may be a
   * script.
   */
  parsedAsSourceType: 'script'|'module';

  constructor(from: Options) {
    super(from);
    this.parsedAsSourceType = from.parsedAsSourceType;
  }

  visit(visitors: Visitor[]) {
    /**
     * Applies all visiting callbacks from `visitors`.
     */
    const applyScanners =
        (callbackName: string, node: Node, parent: Node|null) => {
          for (const visitor of visitors) {
            if (_shouldSkip(visitor, callbackName, node.type)) {
              continue;
            }
            if (callbackName in visitor) {
              // TODO(rictic): is there a maintainable way to enforce the
              //     mapping between callback names and the types of the first
              //     arg?
              const result: VisitResult =
                  (visitor as any)[callbackName](node, parent);
              if (result) {
                handleVisitorResult(result, callbackName, visitor, node.type);
              }
            }
          }
        };

    // a visitor to break early, or to skip a subtree of the AST. We need to
    // track this ourselves because we're running all the visitors at once.
    const _shouldSkip =
        (visitor: Visitor,
         callbackName: string,
         nodeType: typeof __exampleNode.type) => {
          const skipRecord = this.visitorSkips.get(visitor);
          if (!skipRecord) {
            return false;
          }
          if (callbackName === `enter${nodeType}`) {
            skipRecord.depth += 1;
            return true;
          } else if (callbackName === `leave${nodeType}`) {
            skipRecord.depth -= 1;
            if (skipRecord.depth === 0) {
              this.visitorSkips.delete(visitor);
              // Note that we don't `continue` here. This is deliberate so that
              // we call the leave handler for the node where we started
              // skipping.
            } else {
              return true;
            }
          } else {
            return true;
          }
        };

    const handleVisitorResult =
        (visitorOption: VisitorOption,
         callbackName: string,
         visitor: Visitor,
         nodeType: typeof __exampleNode.type) => {
          switch (visitorOption) {
            case VisitorOption.Remove:
              throw new Error(
                  `estraverse.VisitorOption.Remove not ` +
                  `supported by JavascriptDocument`);
            case VisitorOption.Break:
              visitors = visitors.filter((v) => v !== visitor);
              break;
            case VisitorOption.Skip:
              if (callbackName.startsWith('leave')) {
                throw new Error(
                    `estraverse.VisitorOption.Skip was returned from ` +
                    `${callbackName} but it's not supported in a leave method`);
              }
              this.visitorSkips.set(visitor, {type: nodeType, depth: 1});
              break;
          }
        };

    traverse(this.ast, {
      enter(node: Node, parent: Node) {
        applyScanners(`enter${node.type}`, node, parent);
      },
      leave(node: Node, parent: Node) {
        applyScanners(`leave${node.type}`, node, parent);
      },
      fallback: 'iteration',
    });
  }
  protected _sourceRangeForNode(node: Node): SourceRange|undefined {
    if (!node || !node.loc) {
      return;
    }
    return {
      file: this.url,
      // Note: estree uses 1-indexed lines, but SourceRange uses 0 indexed.
      start: {line: (node.loc.start.line - 1), column: node.loc.start.column},
      end: {line: (node.loc.end.line - 1), column: node.loc.end.column}
    };
  }

  stringify(options: StringifyOptions) {
    options = options || {};
    const formatOptions = {
      comments: true,
      retainLines: false,
      quotes: 'single' as 'single',
    };

    const code = generate(this.ast, formatOptions).code + '\n';
    return options.indent != null ? indent(code, options.indent * 2) : code;
  }
}
