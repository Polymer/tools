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

import {VisitorOption, traverse} from 'estraverse';
import {Node, Program} from 'estree';

import {Document, Options} from '../parser/document';

import {VisitResult, Visitor} from './estree-visitor';

export {Visitor} from './estree-visitor';

let __exampleNode: Node;
interface SkipRecord {
  type: typeof __exampleNode.type;
  depth: number;
}

export class JavaScriptDocument extends Document<Program, Visitor> {
  type = 'js';
  private visitorSkips = new Map<Visitor, SkipRecord>();

  constructor(from: Options<Program>) {
    super(from);
  }

  visit(visitors: Visitor[]) {
    /**
     * Applies all visiting callbacks from `visitors`.
     */
    const applyFinders = (callbackName: string, node: Node, parent: Node) => {
      for (let visitor of visitors) {
        if (_shouldSkip(visitor, callbackName, node.type)) {
          continue;
        }
        if (callbackName in visitor) {
          const result: VisitResult = visitor[callbackName](node, parent);
          if (result) {
            handleVisitorResult(result, callbackName, visitor, node.type);
          }
        }
      }
    };

    // These two methods deal with emulating the Visitor behavior of allowing
    // a visitor to break early, or to skip a subtree of the AST. We need to
    // track this ourselves because we're running all the visitors at once.
    const _shouldSkip =
        (visitor: Visitor, callbackName: string,
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
        (visitorOption: VisitorOption, callbackName: string, visitor: Visitor,
         nodeType: typeof __exampleNode.type) => {
          switch (visitorOption) {
            case VisitorOption.Remove:
              throw new Error(
                  `estraverse.VisitorOption.Remove not ` +
                  `supported by JavascriptDocument`);
            case VisitorOption.Break:
              visitors = visitors.filter(v => v !== visitor);
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
      enter(node, parent) {
        applyFinders(`enter${node.type}`, node, parent);
      },
      leave(node, parent) {
        applyFinders(`leave${node.type}`, node, parent);
      },
      fallback: 'iteration',
    });
  }



  forEachNode(callback: (node: Node) => void) {
    traverse(this.ast, {
      enter(node, parent) {
        callback(node);
      },
      fallback: 'iteration',
    });
  }
}
