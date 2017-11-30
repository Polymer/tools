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

import * as babel from 'babel-types';

import * as astValue from '../javascript/ast-value';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {Severity, Warning} from '../model/model';
import {ScannedBehaviorAssignment} from '../polymer/behavior';

import {analyzeProperties} from './analyze-properties';
import {parseExpressionInJsStringLiteral} from './expression-scanner';
import {Observer, ScannedPolymerElement} from './polymer-element';

export type BehaviorAssignmentOrWarning = {
  kind: 'warning',
  warning: Warning
}|{kind: 'behaviorAssignment', assignment: ScannedBehaviorAssignment};

export function getBehaviorAssignmentOrWarning(
    argNode: babel.Node,
    document: JavaScriptDocument): BehaviorAssignmentOrWarning {
  const behaviorName = astValue.getIdentifierName(argNode);
  if (!behaviorName) {
    return {
      kind: 'warning',
      warning: new Warning({
        code: 'could-not-determine-behavior-name',
        message: `Could not determine behavior name from expression of type ` +
            `${argNode.type}`,
        severity: Severity.WARNING,
        sourceRange: document.sourceRangeForNode(argNode)!,
        parsedDocument: document
      })
    };
  }
  return {
    kind: 'behaviorAssignment',
    assignment: {
      name: behaviorName,
      sourceRange: document.sourceRangeForNode(argNode)!
    }
  };
}

export type PropertyHandlers = {
  [key: string]: (node: babel.Node) => void
};


/**
 * Returns an object containing functions that will annotate `declaration` with
 * the polymer-specific meaning of the value nodes for the named properties.
 */
export function declarationPropertyHandlers(
    declaration: ScannedPolymerElement,
    document: JavaScriptDocument): PropertyHandlers {
  return {
    is(node: babel.Node) {
      if (babel.isLiteral(node)) {
        declaration.tagName = '' + astValue.expressionToValue(node);
      }
    },
    properties(node: babel.Node) {
      for (const prop of analyzeProperties(node, document)) {
        declaration.addProperty(prop);
      }
    },
    behaviors(node: babel.Node) {
      if (!babel.isArrayExpression(node)) {
        return;
      }
      for (const element of node.elements) {
        const result = getBehaviorAssignmentOrWarning(element, document);
        if (result.kind === 'warning') {
          declaration.warnings.push(result.warning);
        } else {
          declaration.behaviorAssignments.push(result.assignment);
        }
      }
    },
    observers(node: babel.Node) {
      const observers = extractObservers(node, document);
      if (!observers) {
        return;
      }
      declaration.warnings = declaration.warnings.concat(observers.warnings);
      declaration.observers = declaration.observers.concat(observers.observers);
    },
    listeners(node: babel.Node) {
      if (!babel.isObjectExpression(node)) {
        declaration.warnings.push(new Warning({
          code: 'invalid-listeners-declaration',
          message: '`listeners` property should be an object expression',
          severity: Severity.WARNING,
          sourceRange: document.sourceRangeForNode(node)!,
          parsedDocument: document
        }));
        return;
      }

      for (const p of node.properties) {
        if (babel.isSpreadProperty(p)) {
          continue;
        }
        const evtName =
            babel.isLiteral(p.key) && astValue.expressionToValue(p.key) ||
            babel.isIdentifier(p.key) && p.key.name;
        const handler =
            !babel.isLiteral(p.value) || astValue.expressionToValue(p.value);

        if (typeof evtName !== 'string' || typeof handler !== 'string') {
          // TODO (maklesoft): Notifiy the user somehow that a listener entry
          // was not extracted
          // because the event or handler namecould not be statically analyzed.
          // E.g. add a low-severity
          // warning once opting out of rules is supported.
          continue;
        }

        declaration.listeners.push({event: evtName, handler: handler});
      }
    }
  };
}


export function extractObservers(
    observersArray: babel.Node, document: JavaScriptDocument): undefined|
    {observers: Observer[], warnings: Warning[]} {
  if (!babel.isArrayExpression(observersArray)) {
    return;
  }
  let warnings: Warning[] = [];
  const observers = [];
  for (const element of observersArray.elements) {
    let v = astValue.expressionToValue(element);
    if (v === undefined) {
      v = astValue.CANT_CONVERT;
    }
    const parseResult =
        parseExpressionInJsStringLiteral(document, element, 'callExpression');
    warnings = warnings.concat(parseResult.warnings);
    observers.push({
      javascriptNode: element,
      expression: v,
      parsedExpression: parseResult.databinding
    });
  }
  return {observers, warnings};
}
