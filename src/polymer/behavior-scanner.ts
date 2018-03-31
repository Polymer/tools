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

import {NodePath} from '@babel/traverse';

import * as babel from '@babel/types';

import {getIdentifierName, getNamespacedIdentifier} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {ScannedReference, Severity, Warning} from '../model/model';

import {ScannedBehavior} from './behavior';
import {declarationPropertyHandlers, PropertyHandlers} from './declaration-property-handlers';
import * as docs from './docs';

const templatizer = 'Polymer.Templatizer';

export class BehaviorScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const visitor = new BehaviorVisitor(document);
    await visit(visitor);
    return {
      features: Array.from(visitor.behaviors),
      warnings: visitor.warnings
    };
  }
}

class BehaviorVisitor implements Visitor {
  /** The behaviors we've found. */
  behaviors = new Set<ScannedBehavior>();
  warnings: Warning[] = [];
  currentBehavior: ScannedBehavior|null = null;
  propertyHandlers: PropertyHandlers|null = null;

  document: JavaScriptDocument;
  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  /**
   * Look for object declarations with @polymerBehavior in the docs.
   */
  enterVariableDeclarator(
      node: babel.VariableDeclarator, _parent: babel.Node, path: NodePath) {
    this._initBehavior(node, getIdentifierName(node.id), path);
  }

  enterExportDefaultDeclaration(
      node: babel.ExportDefaultDeclaration, _parent: babel.Node,
      path: NodePath) {
    this._initBehavior(node, 'default', path);
  }

  /**
   * Look for object assignments with @polymerBehavior in the docs.
   */
  enterAssignmentExpression(
      node: babel.AssignmentExpression, parent: babel.Node, path: NodePath) {
    this._initBehavior(parent, getIdentifierName(node.left), path);
  }

  /**
   * We assume that the object expression after such an assignment is the
   * behavior's declaration. Seems to be a decent assumption for now.
   */
  enterObjectExpression(node: babel.ObjectExpression, _parent: babel.Node) {
    if (!this.currentBehavior || !this.propertyHandlers) {
      return;
    }

    for (const prop of esutil.getSimpleObjectProperties(node)) {
      const name = esutil.getPropertyName(prop);
      if (!name) {
        this.currentBehavior.warnings.push(new Warning({
          code: 'cant-determine-name',
          message:
              `Unable to determine property name from expression of type ` +
              `${node.type}`,
          severity: Severity.WARNING,
          sourceRange: this.document.sourceRangeForNode(node)!,
          parsedDocument: this.document
        }));
        continue;
      }
      if (name in this.propertyHandlers) {
        this.propertyHandlers[name](prop.value);
      } else if (
          (babel.isMethod(prop) && prop.kind === 'method') ||
          babel.isFunction(prop.value)) {
        const method = esutil.toScannedMethod(
            prop, this.document.sourceRangeForNode(prop)!, this.document);
        this.currentBehavior.addMethod(method);
      }
    }

    for (const prop of esutil
             .extractPropertiesFromClassOrObjectBody(node, this.document)
             .values()) {
      if (prop.name in this.propertyHandlers) {
        continue;
      }

      this.currentBehavior.addProperty({
        ...prop,
        isConfiguration: esutil.configurationProperties.has(prop.name),
      });
    }

    this._finishBehavior();
  }

  private _startBehavior(behavior: ScannedBehavior) {
    console.assert(this.currentBehavior == null);
    this.currentBehavior = behavior;
  }

  private _finishBehavior() {
    console.assert(this.currentBehavior != null);
    this.behaviors.add(this.currentBehavior!);
    this.currentBehavior = null;
  }

  private _initBehavior(
      node: babel.Node, name: string|undefined, path: NodePath) {
    if (name === undefined) {
      return;
    }
    const comment = esutil.getBestComment(path);
    // Quickly filter down to potential candidates.
    if (!comment || comment.indexOf('@polymerBehavior') === -1) {
      if (name !== templatizer) {
        return;
      }
    }
    const parsedJsdocs = jsdoc.parseJsdoc(comment || '');
    if (!jsdoc.hasTag(parsedJsdocs, 'polymerBehavior')) {
      if (name !== templatizer) {
        return;
      }
    }

    this._startBehavior(new ScannedBehavior({
      astNode: node,
      statementAst: esutil.getCanonicalStatement(path),
      description: parsedJsdocs.description,
      events: esutil.getEventComments(node),
      sourceRange: this.document.sourceRangeForNode(node),
      privacy: esutil.getOrInferPrivacy(name, parsedJsdocs),
      abstract: jsdoc.hasTag(parsedJsdocs, 'abstract'),
      attributes: new Map(),
      properties: [],
      behaviors: [],
      className: undefined,
      extends: undefined,
      jsdoc: parsedJsdocs,
      listeners: [],
      methods: new Map(),
      staticMethods: new Map(),
      mixins: [],
      observers: [],
      superClass: undefined,
      tagName: undefined
    }));
    const behavior = this.currentBehavior!;

    this.propertyHandlers =
        declarationPropertyHandlers(behavior, this.document, path);

    docs.annotateElementHeader(behavior);
    const behaviorTag = jsdoc.getTag(behavior.jsdoc, 'polymerBehavior');
    behavior.className = behaviorTag && behaviorTag.name ||
        getNamespacedIdentifier(name, behavior.jsdoc);
    if (!behavior.className) {
      throw new Error(
          `Unable to determine name for @polymerBehavior: ${comment}`);
    }

    behavior.privacy =
        esutil.getOrInferPrivacy(behavior.className, behavior.jsdoc);
    this._parseChainedBehaviors(node, path);

    this.currentBehavior = this.mergeBehavior(behavior);
    this.propertyHandlers =
        declarationPropertyHandlers(this.currentBehavior, this.document, path);

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
  mergeBehavior(newBehavior: ScannedBehavior): ScannedBehavior {
    const isBehaviorImpl = (b: ScannedReference<'behavior'>) => {
      // filter out BehaviorImpl
      return newBehavior.className === undefined ||
          b.identifier.indexOf(newBehavior.className) === -1;
    };
    for (const behavior of this.behaviors) {
      if (newBehavior.className !== behavior.className) {
        continue;
      }
      // TODO(justinfagnani): what?
      // merge desc, longest desc wins
      if (newBehavior.description) {
        if (behavior.description) {
          if (newBehavior.description.length > behavior.description.length)
            behavior.description = newBehavior.description;
        } else {
          behavior.description = newBehavior.description;
        }
      }
      // TODO(justinfagnani): move into ScannedBehavior
      behavior.demos = behavior.demos.concat(newBehavior.demos);
      for (const [key, val] of newBehavior.events) {
        behavior.events.set(key, val);
      }
      for (const property of newBehavior.properties.values()) {
        behavior.addProperty(property);
      }
      behavior.observers = behavior.observers.concat(newBehavior.observers);
      behavior.behaviorAssignments =
          (behavior.behaviorAssignments)
              .concat(newBehavior.behaviorAssignments)
              .filter(isBehaviorImpl);
      return behavior;
    }
    return newBehavior;
  }

  _parseChainedBehaviors(node: babel.Node, path: NodePath) {
    if (this.currentBehavior == null) {
      throw new Error(
          `_parsedChainedBehaviors was called without a current behavior.`);
    }
    // If current behavior is part of an array, it gets extended by other
    // behaviors inside the array. Ex:
    // Polymer.IronMultiSelectableBehavior = [
    //     {....},
    //     Polymer.IronSelectableBehavior];
    // We add these to the behaviors array.
    const expression = behaviorExpression(node);
    const chained: Array<ScannedReference<'behavior'>> = [];
    if (expression && babel.isArrayExpression(expression)) {
      for (const arrElement of expression.elements) {
        const behaviorName = getIdentifierName(arrElement);
        if (behaviorName) {
          chained.push(new ScannedReference(
              'behavior',
              behaviorName,
              this.document.sourceRangeForNode(arrElement)!,
              arrElement,
              path));
        }
      }
      if (chained.length > 0) {
        this.currentBehavior.behaviorAssignments = chained;
      }
    }
  }
}

/**
 * gets the expression representing a behavior from a node.
 */
function behaviorExpression(node: babel.Node): babel.Node|null|undefined {
  if (babel.isVariableDeclarator(node)) {
    return node.init;
  }
  if (babel.isAssignmentExpression(node)) {
    return node.right;
  }
  if (babel.isExportDefaultDeclaration(node) ||
      babel.isExportNamedDeclaration(node)) {
    return behaviorExpression(node.declaration);
  }
  if (babel.isExpressionStatement(node)) {
    return behaviorExpression(node.expression);
  }
  if (babel.isVariableDeclaration(node)) {
    return behaviorExpression(node.declarations[0]);
  }
  if (babel.isObjectExpression(node) || babel.isArrayExpression(node)) {
    return node;
  }
}

/**
 * checks whether an expression is a simple array containing only member
 * expressions or identifiers.
 */
function isSimpleBehaviorArray(expression: babel.Node|undefined|null): boolean {
  if (!expression || !babel.isArrayExpression(expression)) {
    return false;
  }
  for (const element of expression.elements) {
    if (!babel.isMemberExpression(element) && !babel.isIdentifier(element)) {
      return false;
    }
  }
  return true;
}
