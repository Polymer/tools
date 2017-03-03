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

import {Analysis, Attribute, Element, ElementLike, ElementMixin, Event, Function, Method, Namespace, Property, SourceRange} from './analysis-format';
import {Function as ResolvedFunction} from './javascript/function';
import {Namespace as ResolvedNamespace} from './javascript/namespace';
import {Document} from './model/document';
import {Feature} from './model/feature';
import {Attribute as ResolvedAttribute, Element as ResolvedElement, ElementMixin as ResolvedMixin, Event as ResolvedEvent, Method as ResolvedMethod, Property as ResolvedProperty, SourceRange as ResolvedSourceRange} from './model/model';
import {Package} from './model/package';

export type ElementOrMixin = ResolvedElement | ResolvedMixin;

export type Filter = (feature: Feature) => boolean;

interface Members {
  elements: Set<ResolvedElement>;
  mixins: Set<ResolvedMixin>;
  namespaces: Set<ResolvedNamespace>;
  functions: Set<ResolvedFunction>;
}

export function generateElementMetadata(
    input: Package|Document[], packagePath: string, filter?: Filter): Analysis {
  const _filter = filter || ((_: Feature) => true);

  let members: Members;

  if (input instanceof Array) {
    members = {
      elements: new Set(),
      mixins: new Set(),
      namespaces: new Set(),
      functions: new Set(),
    };

    for (const document of input as Document[]) {
      Array.from(document.getByKind('element'))
          .filter(_filter)
          .forEach((f) => members.elements.add(f));
      Array.from(document.getByKind('element-mixin'))
          .filter(_filter)
          .forEach((f) => members.mixins.add(f));
      Array.from(document.getByKind('namespace'))
          .filter(_filter)
          .forEach((f) => members.namespaces.add(f));
      Array.from(document.getByKind('function'))
          .filter(_filter)
          .forEach((f) => members.functions.add(f));
    }
  } else {
    members = {
      elements: new Set(Array.from(input.getByKind('element')).filter(_filter)),
      mixins:
          new Set(Array.from(input.getByKind('element-mixin')).filter(_filter)),
      namespaces:
          new Set(Array.from(input.getByKind('namespace')).filter(_filter)),
      functions:
          new Set(Array.from(input.getByKind('function')).filter(_filter)),
    };
  }

  return buildAnalysis(members, packagePath);
}

function buildAnalysis(members: Members, packagePath: string): Analysis {
  // Build mapping of namespaces
  const namespaces = new Map<string|undefined, Namespace>();
  for (const namespace of members.namespaces) {
    namespaces.set(namespace.name, serializeNamespace(namespace, packagePath));
  }

  const analysis: Analysis = {
    schema_version: '1.0.0',
  };

  for (const namespace of namespaces.values()) {
    const namespaceName = getNamespaceName(namespace.name);
    const parent = namespaces.get(namespaceName) || analysis;
    parent.namespaces = parent.namespaces || [];
    parent.namespaces.push(namespace);
  }

  for (const element of members.elements) {
    const namespaceName = getNamespaceName(element.className);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.elements = namespace.elements || [];
    namespace.elements.push(serializeElement(element, packagePath));
  }

  for (const mixin of members.mixins) {
    const namespaceName = getNamespaceName(mixin.name);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.mixins = namespace.mixins || [];
    namespace.mixins.push(serializeElementMixin(mixin, packagePath));
  }

  for (const _function of members.functions) {
    const namespaceName = getNamespaceName(_function.name);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.functions = namespace.functions || [];
    namespace.functions.push(serializeFunction(_function, packagePath));
  }

  return analysis;
}

function getNamespaceName(name?: string) {
  if (name == null) {
    return undefined;
  }
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return undefined;
  }
  return name.substring(0, lastDotIndex);
}

const validator = new jsonschema.Validator();
const schema = JSON.parse(
    fs.readFileSync(pathLib.join(__dirname, 'analysis.schema.json'), 'utf-8'));

export class ValidationError extends Error {
  errors: jsonschema.ValidationError[];
  constructor(result: jsonschema.ValidatorResult) {
    const message = `Unable to validate serialized Polymer analysis. ` +
        `Got ${result.errors.length} errors: ` +
        `${result.errors.map((err) => '    ' + (err.message || err))
            .join('\n')}`;
    super(message);
    this.errors = result.errors;
  }
}

/**
 * Throws if the given object isn't a valid AnalyzedPackage according to
 * the JSON schema.
 */
export function validateAnalysis(analyzedPackage: Analysis|null|undefined) {
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

function serializeNamespace(
    namespace: ResolvedNamespace, packagePath: string): Namespace {
  const packageRelativePath =
      pathLib.relative(packagePath, namespace.sourceRange.file);
  const metadata = {
    name: namespace.name,
    description: namespace.description,
    summary: namespace.summary,
    sourceRange: {
      file: packageRelativePath,
      start: namespace.sourceRange.start,
      end: namespace.sourceRange.end
    }
  };
  return metadata;
}

function serializeFunction(
    fn: ResolvedFunction, packagePath: string): Function {
  const packageRelativePath =
      pathLib.relative(packagePath, fn.sourceRange.file);
  const metadata: Function = {
    name: fn.name,
    description: fn.description,
    summary: fn.summary,
    sourceRange: {
      file: packageRelativePath,
      start: fn.sourceRange.start,
      end: fn.sourceRange.end
    },
    privacy: fn.privacy,
  };
  if (fn.params) {
    metadata.params = fn.params;
  }
  if (fn.return ) {
    metadata.return = fn.return;
  }
  return metadata;
}

function serializeElement(
    element: ResolvedElement, packagePath: string): Element {
  const metadata: Element =
      serializeElementLike(element, packagePath) as Element;
  metadata.tagname = element.tagName;
  if (element.className) {
    metadata.classname = element.className;
  }

  // TODO(justinfagnani): Mixins should be able to have mixins too
  if (element.mixins.length > 0) {
    metadata.mixins = element.mixins.map((m) => m.identifier);
  }
  metadata.superclass = 'HTMLElement';
  return metadata;
}

function serializeElementMixin(
    mixin: ResolvedMixin, packagePath: string): ElementMixin {
  const metadata = serializeElementLike(mixin, packagePath) as ElementMixin;
  metadata.name = mixin.name;
  metadata.privacy = mixin.privacy;
  return metadata;
}

function serializeElementLike(
    elementOrMixin: ElementOrMixin, packagePath: string): ElementLike {
  const path = elementOrMixin.sourceRange.file;
  const packageRelativePath =
      pathLib.relative(packagePath, elementOrMixin.sourceRange.file);

  const attributes = elementOrMixin.attributes.map(
      (a) => serializeAttribute(elementOrMixin, path, a));
  const properties = elementOrMixin.properties.map(
      (p) => serializeProperty(elementOrMixin, path, p));
  const methods = elementOrMixin.methods.map(
      (m) => serializeMethod(elementOrMixin, path, m));
  const events =
      elementOrMixin.events.map((e) => serializeEvent(elementOrMixin, path, e));

  return {
    description: elementOrMixin.description || '',
    summary: elementOrMixin.summary || '',
    path: packageRelativePath,
    attributes: attributes,
    properties: properties,
    methods: methods,
    styling: {
      cssVariables: [],
      selectors: [],
    },
    demos: (elementOrMixin.demos || []).map((d) => d.path),
    slots: elementOrMixin.slots.map((s) => {
      return {description: '', name: s.name, range: s.range};
    }),
    events: events,
    metadata: elementOrMixin.emitMetadata(),
    sourceRange: resolveSourceRangePath(path, elementOrMixin.sourceRange),
    privacy: elementOrMixin.privacy,
  };
}

function serializeProperty(
    elementOrMixin: ElementOrMixin,
    elementPath: string,
    resolvedProperty: ResolvedProperty): Property {
  const property: Property = {
    name: resolvedProperty.name,
    type: resolvedProperty.type || '?',
    description: resolvedProperty.description || '',
    privacy: resolvedProperty.privacy,
    sourceRange:
        resolveSourceRangePath(elementPath, resolvedProperty.sourceRange),
    metadata: elementOrMixin.emitPropertyMetadata(resolvedProperty),
  };
  if (resolvedProperty.default) {
    property.defaultValue = resolvedProperty.default;
  }
  if (resolvedProperty.inheritedFrom) {
    property.inheritedFrom = resolvedProperty.inheritedFrom;
  }
  return property;
}

function serializeAttribute(
    resolvedElement: ElementOrMixin,
    elementPath: string,
    resolvedAttribute: ResolvedAttribute): Attribute {
  const attribute: Attribute = {
    name: resolvedAttribute.name,
    description: resolvedAttribute.description || '',
    sourceRange:
        resolveSourceRangePath(elementPath, resolvedAttribute.sourceRange),
    metadata: resolvedElement.emitAttributeMetadata(resolvedAttribute),
  };
  if (resolvedAttribute.type) {
    attribute.type = resolvedAttribute.type;
  }
  if (resolvedAttribute.inheritedFrom != null) {
    attribute.inheritedFrom = resolvedAttribute.inheritedFrom;
  }
  return attribute;
}

function serializeMethod(
    resolvedElement: ElementOrMixin,
    elementPath: string,
    resolvedMethod: ResolvedMethod): Method {
  const method: Method = {
    name: resolvedMethod.name,
    description: resolvedMethod.description || '',
    privacy: resolvedMethod.privacy,
    sourceRange:
        resolveSourceRangePath(elementPath, resolvedMethod.sourceRange),
    metadata: resolvedElement.emitMethodMetadata(resolvedMethod),
  };
  if (resolvedMethod.params) {
    method.params = resolvedMethod.params;
  }
  if (resolvedMethod.return ) {
    method.return = resolvedMethod.return;
  }
  if (resolvedMethod.inheritedFrom != null) {
    method.inheritedFrom = resolvedMethod.inheritedFrom;
  }
  return method;
}

function serializeEvent(
    resolvedElement: ElementOrMixin,
    _elementPath: string,
    resolvedEvent: ResolvedEvent): Event {
  const event: Event = {
    type: 'CustomEvent',
    name: resolvedEvent.name,
    description: resolvedEvent.description || '',
    metadata: resolvedElement.emitEventMetadata(resolvedEvent),
  };
  if (resolvedEvent.inheritedFrom != null) {
    event.inheritedFrom = resolvedEvent.inheritedFrom;
  }
  return event;
}

function resolveSourceRangePath(
    elementPath: string,
    sourceRange?: ResolvedSourceRange): (SourceRange|undefined) {
  if (!sourceRange) {
    return;
  }
  if (!sourceRange.file) {
    return sourceRange;
  }
  if (elementPath === sourceRange.file) {
    return {start: sourceRange.start, end: sourceRange.end};
  }
  // The source location's path is relative to file resolver's base, so first
  // we need to make it relative to the element.
  const filePath =
      pathLib.relative(pathLib.dirname(elementPath), sourceRange.file);
  return {file: filePath, start: sourceRange.start, end: sourceRange.end};
}
