import * as estree from 'estree';

import {getIdentifierName} from '../javascript/ast-value';
import {getPropertyValue} from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';

import {analyzeProperties} from './analyze-properties';
import {ScannedPolymerProperty} from './polymer-element';

export function getConfig(node: estree.ClassDeclaration|estree.ClassExpression):
    estree.ObjectExpression|null {
  const possibleConfigs = node.body.body.filter(
      (n) => n.type === 'MethodDefinition' && n.static === true &&
          n.kind === 'get' && getIdentifierName(n.key) === 'config');
  const config = possibleConfigs.length === 1 && possibleConfigs[0];
  if (!config) {
    return null;
  }

  const configBody = config.value.body;
  if (configBody.body.length !== 1) {
    // not a single statement function
    return null;
  }
  if (configBody.body[0].type !== 'ReturnStatement') {
    return null;
  }

  const returnStatement = configBody.body[0] as estree.ReturnStatement;
  const returnValue = returnStatement.argument;
  if (!returnValue || returnValue.type !== 'ObjectExpression') {
    // TODO: warn
    return null;
  }
  return returnValue as estree.ObjectExpression;
}

export function getProperties(
    node: estree.ObjectExpression,
    document: JavaScriptDocument): ScannedPolymerProperty[] {
  const propertiesNode = getPropertyValue(node, 'properties');
  return propertiesNode ? analyzeProperties(propertiesNode, document) : [];
}
