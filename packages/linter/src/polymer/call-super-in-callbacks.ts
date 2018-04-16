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

import babelTraverse from 'babel-traverse';
import * as babel from 'babel-types';
import {Document, Element, ElementMixin, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {Rule} from '../rule';
import {getDocumentContaining, stripIndentation, stripWhitespace} from '../util';

const methodsThatMustCallSuper = new Set([
  'ready',
  'connectedCallback',
  'disconnectedCallback',
  'attributeChangedCallback',
]);

class CallSuperInCallbacks extends Rule {
  code = 'call-super-in-callbacks';
  description = stripIndentation(`
      Warns when a Polymer element overrides one of the custom element callbacks
      but does not call super.callbackName().
  `);

  async check(document: Document) {
    const warnings: Warning[] = [];

    const elementLikes = new Array<Element|ElementMixin>(
        ...document.getFeatures({kind: 'element'}),
        ...document.getFeatures({kind: 'element-mixin'}));

    for (const elementLike of elementLikes) {
      if (elementLike.astNode === undefined ||
          elementLike.astNode.language !== 'js') {
        continue;
      }
      // TODO(rictic): methods should have astNodes, that would make this
      //     simpler. Filed as:
      //     https://github.com/Polymer/polymer-analyzer/issues/562
      const classBody = getClassBody(elementLike.astNode.node);
      if (!classBody) {
        continue;
      }

      for (const method of classBody.body) {
        let methodName: undefined|string = undefined;
        if (method.type !== 'ClassMethod') {
          // Guard against ES2018+ additions to class bodies.
          continue;
        }
        if (method.kind === 'constructor') {
          methodName = 'constructor';
        }
        let classThatRequiresSuper: string|undefined;
        if (method.kind === 'method' && method.key.type === 'Identifier') {
          classThatRequiresSuper =
              mustCallSuper(elementLike, method.key.name, document);
          if (classThatRequiresSuper) {
            methodName = method.key.name;
          }
        }
        if (!methodName) {
          continue;
        }
        // Ok, so now just check that the method does call super.methodName()
        if (!doesCallSuper(method, methodName)) {
          // Construct a nice legible warning.
          const parsedDocumentContaining =
              getDocumentContaining(elementLike.sourceRange, document);
          if (parsedDocumentContaining) {
            const sourceRange =
                parsedDocumentContaining.sourceRangeForNode(method.key)!;
            if (method.kind === 'constructor') {
              warnings.push(new Warning({
                parsedDocument: document.parsedDocument,
                code: 'call-super-in-constructor',
                severity: Severity.ERROR, sourceRange,
                message: stripWhitespace(`
                  ES6 requires super() in constructors with superclasses.
                `)
              }));
            } else {
              let message;
              let code;
              if (elementLike instanceof ElementMixin) {
                code = 'call-super-in-mixin-callbacks';
                message = stripWhitespace(`
                    This method should conditionally call super.${methodName}()
                    because a class ${getName(elementLike, 'this mixin')} is
                    applied to may also define ${methodName}.`);
              } else {
                code = this.code;
                message = stripWhitespace(`
                    You may need to call super.${methodName}() because
                    ${getName(elementLike, 'this class')} extends
                    ${classThatRequiresSuper}, which defines ${methodName} too.
                `);
              }
              warnings.push(new Warning({
                parsedDocument: document.parsedDocument,
                severity: Severity.WARNING, code, sourceRange, message
              }));
            }
          }
        }
      }
    }
    return warnings;
  }
}

function getClassBody(astNode?: babel.Node|null): undefined|babel.ClassBody {
  if (!astNode || !astNode.type) {
    return undefined;
  }
  let classBody: undefined|babel.ClassBody = undefined;

  function findClassBody(node: babel.Node) {
    if (babel.isClassDeclaration(node) || babel.isClassExpression(node)) {
      classBody = node.body;
    }
  }

  // Check the node itself too!
  findClassBody(astNode);
  babelTraverse(astNode, {
    noScope: true,
    enter(path) {
      findClassBody(path.node);
    }
  });
  return classBody;
}

/**
 * Returns the name of the class in element's inheritance chain that requires
 * super[methodName]() be called. Returns undefined if no such class exists.
 */
function mustCallSuper(
    elementLike: Element|ElementMixin, methodName: string, document: Document):
    (string|undefined) {
  // TODO(rictic): look up the inheritance graph for a jsdoc tag that describes
  //     the method as needing to be called?
  if (!methodsThatMustCallSuper.has(methodName)) {
    return;
  }
  // ElementMixins should always conditionally call super in callbacks.
  if (elementLike instanceof ElementMixin) {
    return `some of the classes this mixin may be applied to`;
  }
  // Did the element's super class define the method?
  if (elementLike.superClass) {
    const superElement = onlyOrNone(document.getFeatures(
        {kind: 'element', id: elementLike.superClass.identifier}));
    if (superElement && getMethodDefiner(superElement, methodName)) {
      return superElement.tagName || superElement.className;
    }
  }

  return getMethodDefinerFromMixins(elementLike, methodName, document, true);
}

function doesCallSuper(method: babel.ClassMethod, methodName: string): boolean {
  const superCallTargets: string[] = [];
  const body = method.value ? method.value.body : method.body;
  babelTraverse(body, {
    noScope: true,
    enter(path) {
      const node = path.node;
      if (babel.isExpressionStatement(node) &&
          babel.isCallExpression(node.expression)) {
        const callee = node.expression.callee;
        // Just super()
        if (callee.type === 'Super') {
          superCallTargets.push('constructor');
        }
        // super.foo()
        if (callee.type === 'MemberExpression' &&
            callee.object.type === 'Super' &&
            callee.property.type === 'Identifier') {
          superCallTargets.push(callee.property.name);
        }
      }
    }
  });
  return !!superCallTargets.find((ct) => ct === methodName);
}

function getMethodDefinerFromMixins(
    elementLike: ElementMixin|Element,
    methodName: string,
    document: Document,
    skipLocalCheck: boolean): string|undefined {
  if (!skipLocalCheck) {
    const source = getMethodDefiner(elementLike, methodName);
    if (source) {
      return source;
    }
  }
  for (const mixinReference of elementLike.mixins) {
    // TODO(rictic): once we have a representation of a Class this should be
    //   something like `document.getById('class')` instead.
    //   https://github.com/Polymer/polymer-analyzer/issues/563
    const mixin = onlyOrNone(document.getFeatures(
        {kind: 'element-mixin', id: mixinReference.identifier}));
    // TODO(rictic): if mixins had their own mixins pre-mixed in we wouldn't
    //     need to recurse here, just use definesMethod directly.
    //     https://github.com/Polymer/polymer-analyzer/issues/564
    const cause =
        mixin && getMethodDefinerFromMixins(mixin, methodName, document, false);
    if (cause) {
      return cause;
    }
  }
  return;
}

function getMethodDefiner(
    elementLike: Element|ElementMixin|undefined, methodName: string): string|
    undefined {
  if (!elementLike) {
    return;
  }
  // Note that if elementLike is an element, this will include methods
  // defined on super classes and in mixins. If it's a mixin it doesn't,
  // thus the need for anyMixinDefinesMethod until
  // https://github.com/Polymer/polymer-analyzer/issues/564 is fixed.
  const method = elementLike.methods.get(methodName);
  if (method) {
    return method.inheritedFrom || getName(elementLike);
  }
}

function getName(elementLike: Element|ElementMixin, fallback?: string) {
  if (elementLike instanceof Element) {
    return elementLike.className || elementLike.tagName || fallback ||
        'Unknown Element';
  } else {
    return elementLike.name || fallback || 'Unknown Mixin';
  }
}

function onlyOrNone<V>(iterable: Iterable<V>): V|undefined {
  let first = true;
  let result = undefined;
  for (const val of iterable) {
    if (first) {
      result = val;
      first = false;
    } else {
      return undefined;
    }
  }
  return result;
}

registry.register(new CallSuperInCallbacks());
