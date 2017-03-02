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

import {Attribute, Element, ElementLike, ElementMixin, Elements, Function, Method, Namespace, Property, SourceRange} from './elements-format';
import {Function as ResolvedFunction} from './javascript/function';
import {Namespace as ResolvedNamespace} from './javascript/namespace';
import {Document} from './model/document';
import {Feature} from './model/feature';
import {Attribute as ResolvedAttribute, Element as ResolvedElement, ElementMixin as ResolvedMixin, Method as ResolvedMethod, Property as ResolvedProperty, SourceRange as ResolvedSourceRange} from './model/model';
import {Package} from './model/package';

export type ElementOrMixin = ResolvedElement | ResolvedMixin;

export type Filter = (feature: Feature) => boolean;

export function generateElementMetadata(
    input: Package|Document[], packagePath: string, filter?: Filter): Elements {
  const _filter = filter || ((_: Feature) => true);

  let elements: Set<ResolvedElement>;
  let mixins: Set<ResolvedMixin>;
  let namespaces: Set<ResolvedNamespace>;
  let functions: Set<ResolvedFunction>;

  if (input instanceof Array) {
    elements = new Set();
    mixins = new Set();
    namespaces = new Set();
    functions = new Set();
    for (const document of input as Document[]) {
      Array.from(document.getByKind('element'))
          .filter(_filter)
          .forEach((f) => elements.add(f));
      Array.from(document.getByKind('element-mixin'))
          .filter(_filter)
          .forEach((f) => mixins.add(f));
      Array.from(document.getByKind('namespace'))
          .filter(_filter)
          .forEach((f) => namespaces.add(f));
      Array.from(document.getByKind('function'))
          .filter(_filter)
          .forEach((f) => functions.add(f));
    }
  } else {
    elements = new Set(Array.from(input.getByKind('element')).filter(_filter));
    mixins =
        new Set(Array.from(input.getByKind('element-mixin')).filter(_filter));
    namespaces =
        new Set(Array.from(input.getByKind('namespace')).filter(_filter));
    functions =
        new Set(Array.from(input.getByKind('function')).filter(_filter));
  }

  const metadata: Elements = {
    schema_version: '1.0.0',
  };

  if (namespaces.size > 0) {
    metadata.namespaces = Array.from(namespaces)
                              .map(
                                  (e) => serializeNamespace(
                                      e, packagePath)) as ResolvedNamespace[];
  }

  if (functions.size > 0) {
    metadata.functions = Array.from(functions).map(
        (fn) => serializeFunction(fn, packagePath)) as ResolvedFunction[];
  }

  if (elements.size > 0) {
    metadata.elements = Array.from(elements).map(
        (e) => serializeElement(e, packagePath)) as Element[];
  }

  if (mixins.size > 0) {
    metadata.mixins = Array.from(mixins).map(
        (m) => serializeElementMixin(m, packagePath)) as ElementMixin[];
  }

  return metadata;
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
    }
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
  const metadata: ElementMixin =
      serializeElementLike(mixin, packagePath) as ElementMixin;
  metadata.name = mixin.name;
  return metadata;
}

function serializeElementLike(
    elementOrMixin: ElementOrMixin, packagePath: string): ElementLike {
  const path = elementOrMixin.sourceRange.file;
  const packageRelativePath =
      pathLib.relative(packagePath, elementOrMixin.sourceRange.file);

  const attributes = elementOrMixin.attributes.map(
      (a) => serializeAttribute(elementOrMixin, path, a));
  const properties =
      elementOrMixin.properties.filter((p) => !p.private)
          .map((p) => serializeProperty(elementOrMixin, path, p));
  const methods = elementOrMixin.methods.filter((m) => !m.private)
                      .map((m) => serializeMethod(elementOrMixin, path, m));
  const events =
      elementOrMixin.events.map((e) => ({
                                  name: e.name,
                                  description: e.description || '',
                                  type: 'CustomEvent',
                                  metadata: elementOrMixin.emitEventMetadata(e)
                                }));

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
    sourceRange:
        resolveSourceRangePath(elementPath, resolvedProperty.sourceRange)
  };
  if (resolvedProperty.default) {
    property.defaultValue = resolvedProperty.default;
  }
  property.metadata = elementOrMixin.emitPropertyMetadata(resolvedProperty);
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
        resolveSourceRangePath(elementPath, resolvedAttribute.sourceRange)
  };
  if (resolvedAttribute.type) {
    attribute.type = resolvedAttribute.type;
  }
  attribute.metadata = resolvedElement.emitAttributeMetadata(resolvedAttribute);
  return attribute;
}

function serializeMethod(
    resolvedElement: ElementOrMixin,
    elementPath: string,
    resolvedMethod: ResolvedMethod): Method {
  const method: Method = {
    name: resolvedMethod.name,
    description: resolvedMethod.description || '',
    sourceRange:
        resolveSourceRangePath(elementPath, resolvedMethod.sourceRange),
  };
  if (resolvedMethod.params) {
    method.params = resolvedMethod.params;
  }
  if (resolvedMethod.return ) {
    method.return = resolvedMethod.return;
  }
  method.metadata = resolvedElement.emitMethodMetadata(resolvedMethod);
  return method;
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
