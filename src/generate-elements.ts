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
    elements: elementDescriptors.map(
        e => serializeElementDescriptor(e, analysis, packagePath))
  };
}

function serializeElementDescriptor(
    elementDescriptor: ElementDescriptor, analysis: Analysis,
    packagePath: string): Element|null {
  if (!elementDescriptor.tagName) {
    return null;
  }
  let properties = elementDescriptor.properties;
  let attributes = elementDescriptor.attributes;
  let events = elementDescriptor.events;
  if (elementDescriptor instanceof PolymerElementDescriptor) {
    const behaviors = Array.from(getFlattenedAndResolvedBehaviors(
        elementDescriptor.behaviors, analysis));
    properties =
        mergeByName([properties].concat(behaviors.map(b => b.properties)));
    attributes =
        mergeByName([attributes].concat(behaviors.map(b => b.attributes)));
    events = mergeByName([events].concat(behaviors.map(b => b.events)));
  }
  properties = properties.filter(p => !p.private);

  const path = elementDescriptor.sourceLocation.file;
  const packageRelativePath =
      pathLib.relative(packagePath, elementDescriptor.sourceLocation.file);

  return {
    tagname: elementDescriptor.tagName,
    description: elementDescriptor.description || '',
    superclass: 'HTMLElement',
    path: packageRelativePath,
    attributes: attributes.map(a => serializeAttributeDescriptor(path, a)),
    properties: properties.map(p => serializePropertyDescriptor(path, p)),
    styling: {
      cssVariables: [],
      selectors: [],
    },
    demos: (elementDescriptor.demos || []).map(d => d.path),
    slots: [],
    events: events.map(
        e => ({name: e.name, description: e.description, type: 'CustomEvent'})),
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

function getFlattenedAndResolvedBehaviors(
    behaviors: (string | BehaviorDescriptor)[], analysis: Analysis) {
  const resolvedBehaviors = new Set<BehaviorDescriptor>();
  _getFlattenedAndResolvedBehaviors(behaviors, analysis, resolvedBehaviors);
  return resolvedBehaviors;
}

function _getFlattenedAndResolvedBehaviors(
    behaviors: (string | BehaviorDescriptor)[], analysis: Analysis,
    resolvedBehaviors: Set<BehaviorDescriptor>) {
  const toLookup = behaviors.slice();
  for (let behavior of toLookup) {
    if (typeof behavior === 'string') {
      const behaviorName = behavior;
      behavior = analysis.getBehavior(behavior);
      if (!behavior) {
        throw new Error(
            `Unable to resolve behavior \`${behaviorName}\` ` +
            `Did you import it? Is it annotated with @polymerBehavior?`);
      }
    }
    if (resolvedBehaviors.has(behavior)) {
      continue;
    }
    resolvedBehaviors.add(behavior);
    _getFlattenedAndResolvedBehaviors(
        behavior.behaviors, analysis, resolvedBehaviors);
  }
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

function mergeByName<T extends{name: string}>(buckets: T[][]): T[] {
  const byName = new Map<string, T>();
  for (const bucket of buckets) {
    for (const element of bucket) {
      if (!byName.has(element.name)) {
        byName.set(element.name, element);
      }
    }
  }
  return Array.from(byName.values());
}