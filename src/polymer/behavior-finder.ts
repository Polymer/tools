/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as estraverse from 'estraverse';
import * as estree from 'estree';

import {BehaviorDescriptor, BehaviorOrName, Descriptor, ElementDescriptor, LiteralValue, PropertyDescriptor} from '../ast/ast';
import * as astValue from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptEntityFinder} from '../javascript/javascript-entity-finder';
import * as jsdoc from '../javascript/jsdoc';

import * as analyzeProperties from './analyze-properties';
import {PropertyHandlers, declarationPropertyHandlers} from './declaration-property-handlers';
import * as docs from './docs';

interface KeyFunc<T> {
  (value: T): any;
}

function dedupe<T>(array: T[], keyFunc: KeyFunc<T>): T[] {
  const bucket = {};
  array.forEach((el) => {
    const key = keyFunc(el);
    if (key in bucket) {
      return;
    }
    bucket[key] = el;
  });
  const returned = <Array<T>>[];
  Object.keys(bucket).forEach((k) => {
    returned.push(bucket[k]);
  });
  return returned;
}

const templatizer = 'Polymer.Templatizer';

export class BehaviorFinder implements JavaScriptEntityFinder {
  async findEntities(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>): Promise<Descriptor[]> {
    let visitor = new BehaviorVisitor();
    await visit(visitor);
    return visitor.behaviors;
  }
}

class BehaviorVisitor implements Visitor {
  /** The behaviors we've found. */
  behaviors: BehaviorDescriptor[] = [];

  currentBehavior: BehaviorDescriptor = null;
  propertyHandlers: PropertyHandlers = null;

  /**
   * Look for object declarations with @behavior in the docs.
   */
  enterVariableDeclaration(
      node: estree.VariableDeclaration, parent: estree.Node) {
    if (node.declarations.length !== 1) {
      return;  // Ambiguous.
    }
    this._initBehavior(node, () => {
      return esutil.objectKeyToString(node.declarations[0].id);
    });
  }

  /**
   * Look for object assignments with @polymerBehavior in the docs.
   */
  enterAssignmentExpression(
      node: estree.AssignmentExpression, parent: estree.Node) {
    this._initBehavior(parent, () => esutil.objectKeyToString(node.left));
  }

  /**
   * We assume that the object expression after such an assignment is the
   * behavior's declaration. Seems to be a decent assumption for now.
   */
  enterObjectExpression(node: estree.ObjectExpression, parent: estree.Node) {
    // TODO(justinfagnani): is the second clause required? No test fails w/o it
    if (!this.currentBehavior /* || this.currentBehavior.properties */) {
      return;
    }

    this.currentBehavior.properties = this.currentBehavior.properties || [];
    this.currentBehavior.observers = this.currentBehavior.observers || [];
    for (let i = 0; i < node.properties.length; i++) {
      const prop = node.properties[i];
      const name = esutil.objectKeyToString(prop.key);
      if (!name) {
        throw {
          message: 'Cant determine name for property key.',
          location: node.loc.start
        };
      }
      if (name in this.propertyHandlers) {
        this.propertyHandlers[name](prop.value);
      } else {
        this.currentBehavior.properties.push(esutil.toPropertyDescriptor(prop));
      }
    }
    this._finishBehavior();
  }

  private _startBehavior(behavior: BehaviorDescriptor) {
    console.assert(this.currentBehavior == null);
    this.currentBehavior = behavior;
  }

  private _finishBehavior() {
    console.assert(this.currentBehavior != null);
    this.behaviors.push(this.currentBehavior);
    this.currentBehavior = null;
  }

  private _abandonBehavior() {
    // TODO(justinfagnani): this seems a bit dangerous...
    this.currentBehavior = null;
    this.propertyHandlers = null;
  }

  private _initBehavior(node: estree.Node, getName: () => string) {
    const comment = esutil.getAttachedComment(node);
    const symbol = getName();
    // Quickly filter down to potential candidates.
    if (!comment || comment.indexOf('@polymerBehavior') === -1) {
      if (symbol !== templatizer) {
        return;
      }
    }

    this._startBehavior(new BehaviorDescriptor({
      type: 'behavior',
      desc: comment,
      events: esutil.getEventComments(node).map(function(event) {
        return {desc: event};
      }),
    }));
    this.propertyHandlers = declarationPropertyHandlers(this.currentBehavior);

    docs.annotateBehavior(this.currentBehavior);
    // Make sure that we actually parsed a behavior tag!
    if (!jsdoc.hasTag(this.currentBehavior.jsdoc, 'polymerBehavior') &&
        symbol !== templatizer) {
      this._abandonBehavior();
      return;
    }

    let name =
        jsdoc.getTag(this.currentBehavior.jsdoc, 'polymerBehavior', 'name');
    this.currentBehavior.symbol = symbol;
    if (!name) {
      name = this.currentBehavior.symbol;
    }
    if (!name) {
      console.warn('Unable to determine name for @polymerBehavior:', comment);
    }
    this.currentBehavior.is = name;

    this._parseChainedBehaviors(node);

    this.currentBehavior = this.mergeBehavior(this.currentBehavior);
    this.propertyHandlers = declarationPropertyHandlers(this.currentBehavior);

    // Some behaviors are just lists of other behaviors. If this is one then
    // add it to behaviors right away.
    if (isSimpleBehaviorArray(behaviorExpression(node))) {
      this._finishBehavior();
    }
  }

  /**
   * merges behavior with preexisting behavior with the same name.
   * here to support multiple @polymerBehavior tags referring
   * to same behavior. See iron-multi-selectable for example.
   */
  mergeBehavior(newBehavior: BehaviorDescriptor): BehaviorDescriptor {
    const isBehaviorImpl = (b: string) => {
      // filter out BehaviorImpl
      return b.indexOf(newBehavior.is) === -1;
    };
    for (let i = 0; i < this.behaviors.length; i++) {
      if (newBehavior.is !== this.behaviors[i].is) {
        continue;
      }
      // merge desc, longest desc wins
      if (newBehavior.desc) {
        if (this.behaviors[i].desc) {
          if (newBehavior.desc.length > this.behaviors[i].desc.length)
            this.behaviors[i].desc = newBehavior.desc;
        } else {
          this.behaviors[i].desc = newBehavior.desc;
        }
      }
      // TODO(justinfagnani): move into BehaviorDescriptor
      this.behaviors[i].demos =
          this.behaviors[i].demos.concat(newBehavior.demos);
      this.behaviors[i].events =
          this.behaviors[i].events.concat(newBehavior.events);
      this.behaviors[i].events =
          dedupe(this.behaviors[i].events, (e) => e.name);
      this.behaviors[i].properties =
          this.behaviors[i].properties.concat(newBehavior.properties);
      this.behaviors[i].observers =
          this.behaviors[i].observers.concat(newBehavior.observers);
      this.behaviors[i].behaviors = (this.behaviors[i].behaviors)
                                        .concat(newBehavior.behaviors)
                                        .filter(isBehaviorImpl);
      return this.behaviors[i];
    }
    return newBehavior;
  }

  _parseChainedBehaviors(node: estree.Node) {
    // if current behavior is part of an array, it gets extended by other
    // behaviors
    // inside the array. Ex:
    // Polymer.IronMultiSelectableBehavior = [ {....},
    // Polymer.IronSelectableBehavior]
    // We add these to behaviors array
    const expression = behaviorExpression(node);
    const chained: BehaviorOrName[] = [];
    if (expression && expression.type === 'ArrayExpression') {
      for (const element of expression.elements) {
        if (element.type === 'MemberExpression' ||
            element.type === 'Identifier') {
          chained.push(<BehaviorOrName>astValue.expressionToValue(element));
        }
      }
      if (chained.length > 0) {
        this.currentBehavior.behaviors = chained;
      }
    }
  }
}

/**
 * gets the expression representing a behavior from a node.
 */
function behaviorExpression(node: estree.Node): estree.Node {
  switch (node.type) {
    case 'ExpressionStatement':
      // need to cast to `any` here because ExpressionStatement is super
      // super general. this code is suspicious.
      return (<any>node).expression.right;
    case 'VariableDeclaration':
      return node.declarations.length > 0 ? node.declarations[0].init : null;
  }
}

/**
 * checks whether an expression is a simple array containing only member
 * expressions or identifiers.
 */
function isSimpleBehaviorArray(expression: estree.Node|null): boolean {
  if (!expression || expression.type !== 'ArrayExpression') {
    return false;
  }
  for (const element of expression.elements) {
    if (element.type !== 'MemberExpression' && element.type !== 'Identifier') {
      return false;
    }
  }
  return true;
}
