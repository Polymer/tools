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

import {Analysis} from './analysis';
import {Attribute as AttributeDescriptor, Descriptor, DocumentDescriptor, ElementDescriptor, ImportDescriptor, InlineDocumentDescriptor, Property as PropertyDescriptor} from './ast/ast';
import {Attribute, Element, Elements, Event, Property, SourceLocation} from './elements-format';
import {JsonDocument} from './json/json-document';
import {Document} from './parser/document';
import {BehaviorDescriptor} from './polymer/behavior-descriptor';
import {PolymerElementDescriptor, PolymerProperty} from './polymer/element-descriptor';
import {trimLeft} from './utils';


export function generateElementMetadata(
    analysis: Analysis, packagePath: string): Elements|undefined {
  const elementDescriptors = analysis.getElementsForPackage(packagePath);
  if (!elementDescriptors) {
    return undefined;
  }
  return {
    schema_version: '1.0.0',
    elements:
        elementDescriptors.map(e => serializeElementDescriptor(e, packagePath))
  };
}

function serializeElementDescriptor(
    elementDescriptor: ElementDescriptor, packagePath: string): Element|null {
  if (!elementDescriptor.tagName) {
    return null;
  }


  const path = elementDescriptor.sourceLocation.file;
  const packageRelativePath =
      pathLib.relative(packagePath, elementDescriptor.sourceLocation.file);

  const attributes = elementDescriptor.attributes.map(
      a => serializeAttributeDescriptor(path, a));
  const properties =
      elementDescriptor.properties
          .filter(
              p => !p.private &&
                  // Blacklist functions until we figure out what to do.
                  p.type !== 'Function')
          .map(p => serializePropertyDescriptor(path, p));
  const events = elementDescriptor.events.map(
      e => ({name: e.name, description: e.description, type: 'CustomEvent'}));

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
    metadata: {},
    sourceLocation:
        resolveSourceLocationPath(path, elementDescriptor.sourceLocation)
  };
}

function serializePropertyDescriptor(
    elementPath: string, propertyDescriptor: PropertyDescriptor): Property {
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
  const polymerMetadata: any = {};
  const polymerMetadataFields = ['notify', 'observer', 'readOnly'];
  for (const field of polymerMetadataFields) {
    if (field in propertyDescriptor) {
      polymerMetadata[field] = propertyDescriptor[field];
    }
  }
  property.metadata = {polymer: polymerMetadata};
  return property;
}

function serializeAttributeDescriptor(
    elementPath: string, attributeDescriptor: AttributeDescriptor): Attribute {
  const attribute: Attribute = {
    name: attributeDescriptor.name,
    description: attributeDescriptor.description || '',
    sourceLocation: resolveSourceLocationPath(
        elementPath, attributeDescriptor.sourceLocation)
  };
  if (attributeDescriptor.type) {
    attribute.type = attributeDescriptor.type;
  }
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
