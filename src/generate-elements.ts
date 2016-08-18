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

import * as fs from 'fs';
import * as jsonschema from 'jsonschema';
import * as pathLib from 'path';

import {Attribute as ResolvedAttribute, Element as ResolvedElement, Property as ResolvedProperty} from './ast/ast';
import {Attribute, Element, Elements, Property, SourceLocation} from './elements-format';


export function generateElementMetadata(
    elements: ResolvedElement[], packagePath: string): Elements|undefined {
  return {
    schema_version: '1.0.0',
    elements: elements.map(e => serializeElement(e, packagePath))
  };
}

const validator = new jsonschema.Validator();
const schema = JSON.parse(
    fs.readFileSync(pathLib.join(__dirname, 'analysis.schema.json'), 'utf-8'));

export class ValidationError extends Error {
  errors: jsonschema.ValidationError[];
  constructor(result: jsonschema.ValidatorResult) {
    const message = `Unable to validate serialized Polymer analysis. ` +
        `Got ${result.errors.length} errors: ` +
        `${result.errors.map(err => '    ' + (err.message || err)).join('\n')}`;
    super(message);
    this.errors = result.errors;
  }
}

/**
 * Throws if the given object isn't a valid AnalyzedPackage according to
 * the JSON schema.
 */
export function validateElements(analyzedPackage: Elements|null|undefined) {
  const result = validator.validate(analyzedPackage, schema);
  if (result.throwError) {
    throw result.throwError;
  }
  if (result.errors.length > 0) {
    throw new ValidationError(result);
  }
  if (!/^1\.\d+\.\d+$/.test(analyzedPackage!.schema_version)) {
    throw new Error(
        `Invalid schema_version in AnalyzedPackage. ` +
        `Expected 1.x.x, got ${analyzedPackage!.schema_version}`);
  }
}


function serializeElement(
    resolvedElement: ResolvedElement, packagePath: string): Element|null {
  if (!resolvedElement.tagName) {
    return null;
  }

  const path = resolvedElement.sourceLocation.file;
  const packageRelativePath =
      pathLib.relative(packagePath, resolvedElement.sourceLocation.file);

  const attributes = resolvedElement.attributes.map(
      a => serializeAttribute(resolvedElement, path, a));
  const properties =
      resolvedElement.properties
          .filter(
              p => !p.private &&
                  // Blacklist functions until we figure out what to do.
                  p.type !== 'Function')
          .map(p => serializeProperty(resolvedElement, path, p));
  const events = resolvedElement.events.map(
      e => ({
        name: e.name,
        description: e.description,
        type: 'CustomEvent',
        metadata: resolvedElement.emitEventMetadata(e)
      }));

  return {
    tagname: resolvedElement.tagName,
    description: resolvedElement.description || '',
    superclass: 'HTMLElement',
    path: packageRelativePath,
    attributes: attributes,
    properties: properties,
    styling: {
      cssVariables: [],
      selectors: [],
    },
    demos: (resolvedElement.demos || []).map(d => d.path),
    slots: [],
    events: events,
    metadata: resolvedElement.emitMetadata(),
    sourceLocation:
        resolveSourceLocationPath(path, resolvedElement.sourceLocation)
  };
}

function serializeProperty(
    resolvedElement: ResolvedElement, elementPath: string,
    resolvedProperty: ResolvedProperty): Property {
  const property: Property = {
    name: resolvedProperty.name,
    type: resolvedProperty.type || '?',
    description: resolvedProperty.description || '',
    sourceLocation:
        resolveSourceLocationPath(elementPath, resolvedProperty.sourceLocation)
  };
  if (resolvedProperty.default) {
    property.defaultValue = resolvedProperty.default;
  }
  property.metadata = resolvedElement.emitPropertyMetadata(resolvedProperty);
  return property;
}

function serializeAttribute(
    resolvedElement: ResolvedElement, elementPath: string,
    resolvedAttribute: ResolvedAttribute): Attribute {
  const attribute: Attribute = {
    name: resolvedAttribute.name,
    description: resolvedAttribute.description || '',
    sourceLocation:
        resolveSourceLocationPath(elementPath, resolvedAttribute.sourceLocation)
  };
  if (resolvedAttribute.type) {
    attribute.type = resolvedAttribute.type;
  }
  attribute.metadata = resolvedElement.emitAttributeMetadata(resolvedAttribute);
  return attribute;
}

function resolveSourceLocationPath(
    elementPath: string,
    sourceLocation: SourceLocation|undefined): SourceLocation|undefined {
  if (!sourceLocation) {
    return undefined;
  }
  if (!sourceLocation.file) {
    return sourceLocation;
  }
  if (elementPath === sourceLocation.file) {
    return {line: sourceLocation.line, column: sourceLocation.column};
  }
  // The source location's path is relative to file resolver's base, so first
  // we need to make it relative to the package dir so that it's
  const filePath =
      pathLib.relative(pathLib.dirname(elementPath), sourceLocation.file);
  return {
    line: sourceLocation.line,
    column: sourceLocation.column,
    file: filePath
  };
}
