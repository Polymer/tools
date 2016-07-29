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

import {traverse} from 'estraverse';
import {Node, Program} from 'estree';

import {Document, Options} from '../parser/document';

import {Visitor} from './estree-visitor';

export {Visitor} from './estree-visitor';

export class JavaScriptDocument extends Document<Program, Visitor> {
  type = 'js';

  constructor(from: Options<Program>) {
    super(from);
  }

  visit(visitors: Visitor[]) {
    /**
     * Applies all visiting callbacks from `visitors`.
     */
    function applyFinders(callbackName: string, node: Node, parent: Node) {
      for (let visitor of visitors) {
        if (callbackName in visitor) {
          return visitor[callbackName](node, parent) || undefined;
        }
      }
    }

    traverse(this.ast, {
      enter(node, parent) {
        return applyFinders(`enter${node.type}`, node, parent);
      },
      leave(node, parent) {
        return applyFinders(`leave${node.type}`, node, parent);
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
