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
import * as util from 'util';

import {Attribute as LinkedAttribute, Element as LinkedElement, Property as LinkedProperty} from './ast/ast';
import {Attribute, Element, Elements, Event, Property, SourceLocation} from './elements-format';
import {ParsedJsonDocument} from './json/json-document';
import {trimLeft} from './utils';



export function generateElementMetadata(
    elements: LinkedElement[], packagePath: string): Elements|undefined {
  return {
    schema_version: '1.0.0',
    elements: elements.map(e => serializeElementDescriptor(e, packagePath))
  };
}

const validator = new jsonschema.Validator();
const schema = JSON.parse(
    fs.readFileSync(pathLib.join(__dirname, 'analysis.schema.json'), 'utf-8'));

export class ValidationError extends Error {
  errors: jsonschema.ValidationError[];
  constructor(result: jsonschema.ValidationResult) {
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


function serializeElementDescriptor(
    elementDescriptor: LinkedElement, packagePath: string): Element|null {
  if (!elementDescriptor.tagName) {
    return null;
  }


  const path = elementDescriptor.sourceLocation.file;
  const packageRelativePath =
      pathLib.relative(packagePath, elementDescriptor.sourceLocation.file);

  const attributes = elementDescriptor.attributes.map(
      a => serializeAttributeDescriptor(elementDescriptor, path, a));
  const properties =
      elementDescriptor.properties
          .filter(
              p => !p.private &&
                  // Blacklist functions until we figure out what to do.
                  p.type !== 'Function')
          .map(p => serializePropertyDescriptor(elementDescriptor, path, p));
  const events = elementDescriptor.events.map(
      e => ({
        name: e.name,
        description: e.description,
        type: 'CustomEvent',
        metadata: elementDescriptor.emitEventMetadata(e)
      }));

  return {
    tagname: elementDescriptor.tagName,
    description: elementDescriptor.description || '',
    superclass: 'HTMLElement',
    path: packageRelativePath,
    attributes: attributes,
    properties: properties,
    styling: {
      cssVariables: [],
      selectors: [],
    },
    demos: (elementDescriptor.demos || []).map(d => d.path),
    slots: [],
    events: events,
    metadata: elementDescriptor.emitMetadata(),
    sourceLocation:
        resolveSourceLocationPath(path, elementDescriptor.sourceLocation)
  };
}

function serializePropertyDescriptor(
    element: LinkedElement, elementPath: string,
    propertyDescriptor: LinkedProperty): Property {
  const property: Property = {
    name: propertyDescriptor.name,
    type: propertyDescriptor.type || '?',
    description: propertyDescriptor.description || '',
    sourceLocation: resolveSourceLocationPath(
        elementPath, propertyDescriptor.sourceLocation)
  };
  if (propertyDescriptor.default) {
    property.defaultValue = propertyDescriptor.default;
  }
  property.metadata = element.emitPropertyMetadata(propertyDescriptor);
  return property;
}

function serializeAttributeDescriptor(
    element: LinkedElement, elementPath: string,
    attributeDescriptor: LinkedAttribute): Attribute {
  const attribute: Attribute = {
    name: attributeDescriptor.name,
    description: attributeDescriptor.description || '',
    sourceLocation: resolveSourceLocationPath(
        elementPath, attributeDescriptor.sourceLocation)
  };
  if (attributeDescriptor.type) {
    attribute.type = attributeDescriptor.type;
  }
  attribute.metadata = element.emitAttributeMetadata(attributeDescriptor);
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
