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

import * as estree from 'estree';

import {LiteralObj, LiteralValue} from '../ast/ast';


// useful tool to visualize AST: http://esprima.org/demo/parse.html

/**
 * converts literal: {"type": "Literal", "value": 5,  "raw": "5" }
 * to string
 */
function literalToValue(literal: estree.Literal): LiteralValue {
  return literal.value;
}

/**
 * converts unary to string
 */
function unaryToValue(unary: estree.UnaryExpression): string {
  const argValue = expressionToValue(unary.argument);
  if (argValue === undefined) {
    return;
  }
  return unary.operator + argValue;
}

/**
 * Function is a block statement.
 */
function functionDeclarationToValue(fn: estree.FunctionDeclaration):
    LiteralValue {
  if (fn.body.type === 'BlockStatement') {
    return blockStatementToValue(fn.body);
  }
}

function functionExpressionToValue(fn: estree.FunctionExpression):
    LiteralValue {
  if (fn.body.type === 'BlockStatement') {
    return blockStatementToValue(fn.body);
  }
}

function arrowFunctionExpressionToValue(fn: estree.ArrowFunctionExpression):
    LiteralValue {
  if (fn.body.type === 'BlockStatement') {
    return blockStatementToValue(fn.body);
  } else {
    return expressionToValue(fn.body);
  }
}

/**
 * Block statement: find last return statement, and return its value
 */
function blockStatementToValue(block: estree.BlockStatement): LiteralValue {
  for (let i = block.body.length - 1; i >= 0; i--) {
    const body = block.body[i];
    if (body.type === 'ReturnStatement') {
      return returnStatementToValue(body);
    }
  }
}

/**
 * Evaluates return's argument
 */
function returnStatementToValue(ret: estree.ReturnStatement): LiteralValue {
  return expressionToValue(ret.argument);
}

/**
 * Enclose containing values in []
 */
function arrayExpressionToValue(arry: estree.ArrayExpression): LiteralValue {
  let value: LiteralValue[] = [];
  for (let i = 0; i < arry.elements.length; i++) {
    const v = expressionToValue(arry.elements[i]);
    if (v === undefined) {
      continue;
    }
    value.push(v);
  }
  return value;
}

/**
 * Make it look like an object
 */
function objectExpressionToValue(obj: estree.ObjectExpression): LiteralValue {
  let evaluatedObjectExpression: LiteralObj = {};
  for (const prop of obj.properties) {
    if (prop.key.type !== 'Literal') {
      return;
    }
    const evaluatedKey = literalToValue(prop.key).toString();
    const evaluatedValue = expressionToValue(prop.value);
    if (evaluatedValue === undefined) {
      return;
    }
    evaluatedObjectExpression[evaluatedKey] = evaluatedValue;
  }
  return evaluatedObjectExpression;
}

/**
 * BinaryExpressions are of the form "literal" + "literal"
 */
function binaryExpressionToValue(member: estree.BinaryExpression):
    (number | string) {
  const left = expressionToValue(member.left);
  const right = expressionToValue(member.right);
  if (left == null || right == null) {
    return;
  }
  if (member.operator === '+') {
    // We need to cast to `any` here because, while it's usually not the right
    // thing to do to use '+' on two values of a mix of types because it's
    // unpredictable, that is what the original code we're evaluating does.
    return <any>left + right;
  }
  return;
}

/**
 * Tries to get the value of an expression. Returns undefined on failure.
 */
export function expressionToValue(valueExpression: estree.Node): LiteralValue {
  switch (valueExpression.type) {
    case 'Literal':
      return literalToValue(valueExpression);
    case 'UnaryExpression':
      return unaryToValue(valueExpression);
    case 'FunctionDeclaration':
      return functionDeclarationToValue(valueExpression);
    case 'FunctionExpression':
      return functionExpressionToValue(valueExpression);
    case 'ArrowFunctionExpression':
      return arrowFunctionExpressionToValue(valueExpression);
    case 'ArrayExpression':
      return arrayExpressionToValue(valueExpression);
    case 'ObjectExpression':
      return objectExpressionToValue(valueExpression);
    case 'BinaryExpression':
      return binaryExpressionToValue(valueExpression);
    default:
      return;
  }
}

/**
 * Extracts the name of the identifier or `.` separated chain of identifiers.
 *
 * Returns undefined if the given node isn't a simple identifier or chain of
 * simple identifiers.
 */
export function getIdentifierName(node: estree.Node): string|undefined {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'MemberExpression') {
    const object = getIdentifierName(node.object);
    const property = getIdentifierName(node.property);
    if (object != null && property != null) {
      return `${object}.${property}`;
    }
  }
}

export var CANT_CONVERT = 'UNKNOWN';
