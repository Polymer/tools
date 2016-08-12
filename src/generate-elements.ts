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

import {Attribute as LinkedAttribute, Element as LinkedElement, Property as LinkedProperty} from './ast/ast';
import {Attribute, Element, Elements, Property, SourceLocation} from './elements-format';


export function generateElementMetadata(
    elements: LinkedElement[], packagePath: string): Elements|undefined {
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


function serializeElement(
    linkedElement: LinkedElement, packagePath: string): Element|null {
  if (!linkedElement.tagName) {
    return null;
  }

  const path = linkedElement.sourceLocation.file;
  const packageRelativePath =
      pathLib.relative(packagePath, linkedElement.sourceLocation.file);

  const attributes = linkedElement.attributes.map(
      a => serializeAttribute(linkedElement, path, a));
  const properties =
      linkedElement.properties
          .filter(
              p => !p.private &&
                  // Blacklist functions until we figure out what to do.
                  p.type !== 'Function')
          .map(p => serializeProperty(linkedElement, path, p));
  const events =
      linkedElement.events.map(e => ({
                                 name: e.name,
                                 description: e.description,
                                 type: 'CustomEvent',
                                 metadata: linkedElement.emitEventMetadata(e)
                               }));

  return {
    tagname: linkedElement.tagName,
    description: linkedElement.description || '',
    superclass: 'HTMLElement',
    path: packageRelativePath,
    attributes: attributes,
    properties: properties,
    styling: {
      cssVariables: [],
      selectors: [],
    },
    demos: (linkedElement.demos || []).map(d => d.path),
    slots: [],
    events: events,
    metadata: linkedElement.emitMetadata(),
    sourceLocation:
        resolveSourceLocationPath(path, linkedElement.sourceLocation)
  };
}

function serializeProperty(
    linkedElement: LinkedElement, elementPath: string,
    linkedProperty: LinkedProperty): Property {
  const property: Property = {
    name: linkedProperty.name,
    type: linkedProperty.type || '?',
    description: linkedProperty.description || '',
    sourceLocation:
        resolveSourceLocationPath(elementPath, linkedProperty.sourceLocation)
  };
  if (linkedProperty.default) {
    property.defaultValue = linkedProperty.default;
  }
  property.metadata = linkedElement.emitPropertyMetadata(linkedProperty);
  return property;
}

function serializeAttribute(
    linkedElement: LinkedElement, elementPath: string,
    linkedAttribute: LinkedAttribute): Attribute {
  const attribute: Attribute = {
    name: linkedAttribute.name,
    description: linkedAttribute.description || '',
    sourceLocation:
        resolveSourceLocationPath(elementPath, linkedAttribute.sourceLocation)
  };
  if (linkedAttribute.type) {
    attribute.type = linkedAttribute.type;
  }
  attribute.metadata = linkedElement.emitAttributeMetadata(linkedAttribute);
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
