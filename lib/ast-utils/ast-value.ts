/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// jshint node: true
'use strict';

import * as ESTree from 'estree';

// useful tool to visualize AST: http://esprima.org/demo/parse.html

/**
 * converts literal: {"type": "Literal", "value": 5,  "raw": "5" }
 * to string
 */
function literalToValue(literal:ESTree.Literal) {
  return literal.value;
}

/**
 * converts unary to string
 */
function unaryToValue(unary:ESTree.UnaryExpression):string {
  var argValue = expressionToValue(unary.argument);
  if (argValue === undefined)
    return;
  return unary.operator + argValue;
}

/**
 * converts identifier to its value
 * identifier { "type": "Identifier", "name": "Number }
 */
function identifierToValue(identifier:ESTree.Identifier):string {
  return identifier.name;
}

/**
 * Function is a block statement.
 */
function functionDeclarationToValue(fn:ESTree.FunctionDeclaration) {
  if (fn.body.type == "BlockStatement")
    return blockStatementToValue(fn.body);
}

function functionExpressionToValue(fn:ESTree.FunctionExpression) {
  if (fn.body.type == "BlockStatement")
    return blockStatementToValue(fn.body);
}
/**
 * Block statement: find last return statement, and return its value
 */
function blockStatementToValue(block:ESTree.BlockStatement) {
  for (var i=block.body.length - 1; i>= 0; i--) {
    if (block.body[i].type === "ReturnStatement")
      return returnStatementToValue(<ESTree.ReturnStatement>block.body[i]);
  }
}

/**
 * Evaluates return's argument
 */
function returnStatementToValue(ret:ESTree.ReturnStatement) {
  return expressionToValue(ret.argument);
}

/**
 * Enclose containing values in []
 */
function arrayExpressionToValue(arry:ESTree.ArrayExpression) {
  var value = '[';
  for (var i=0; i<arry.elements.length; i++) {
    var v = expressionToValue(arry.elements[i]);
    if (v === undefined)
      continue;
    if (i !== 0)
      value += ', ';
    value += v;
  }
  value += ']';
  return value;
}

/**
 * Make it look like an object
 */
function objectExpressionToValue(obj:ESTree.ObjectExpression) {
  var value = '{';
  for (var i=0; i<obj.properties.length; i++) {
    var k = expressionToValue(obj.properties[i].key);
    var v = expressionToValue(obj.properties[i].value);
    if (v === undefined)
      continue;
    if (i !== 0)
      value += ', ';
    value += '"' + k + '": ' + v;
  }
  value += '}';
  return value;
}

/**
 * MemberExpression references a variable with name
 */
function memberExpressionToValue(member:ESTree.MemberExpression) {
  return expressionToValue(member.object) + "." + expressionToValue(member.property);
}

/**
 * Tries to get a value from expression. Handles Literal, UnaryExpression
 * returns undefined on failure
 * valueExpression example:
 * { type: "Literal",
 */
export function expressionToValue(valueExpression:ESTree.Node):string|boolean|number|RegExp {
  switch(valueExpression.type) {
    case 'Literal':
      return literalToValue(<ESTree.Literal>valueExpression);
    case 'UnaryExpression':
      return unaryToValue(<ESTree.UnaryExpression>valueExpression);
    case 'Identifier':
      return identifierToValue(<ESTree.Identifier>valueExpression);
    case 'FunctionDeclaration':
      return functionDeclarationToValue(<ESTree.FunctionDeclaration>valueExpression);
    case 'FunctionExpression':
      return functionExpressionToValue(<ESTree.FunctionExpression>valueExpression);
    case 'ArrayExpression':
      return arrayExpressionToValue(<ESTree.ArrayExpression>valueExpression);
    case 'ObjectExpression':
      return objectExpressionToValue(<ESTree.ObjectExpression>valueExpression);
    case 'Identifier':
      return identifierToValue(<ESTree.Identifier>valueExpression);
    case 'MemberExpression':
      return memberExpressionToValue(<ESTree.MemberExpression>valueExpression);
    default:
      return;
  }
}

export var CANT_CONVERT = 'UNKNOWN';
