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

import * as jsonschema from 'jsonschema';

import {ResolvedUrl} from '../index';
import {Function as ResolvedFunction} from '../javascript/function';
import {Namespace as ResolvedNamespace} from '../javascript/namespace';
import {Analysis as AnalysisResult, Attribute as ResolvedAttribute, Class as ResolvedClass, Element as ResolvedElement, ElementMixin as ResolvedMixin, Event as ResolvedEvent, Feature, Method as ResolvedMethod, Property as ResolvedProperty, SourceRange as ResolvedSourceRange} from '../model/model';
import {Behavior as ResolvedPolymerBehavior} from '../polymer/behavior';
import {UrlResolver} from '../url-loader/url-resolver';

import {Analysis, Attribute, Class, Element, ElementLike, ElementMixin, Event, Function, Method, Namespace, Property, SourceRange} from './analysis-format';

export type ElementOrMixin = ResolvedElement|ResolvedMixin;

export type Filter = (feature: Feature|ResolvedFunction) => boolean;

interface Members {
  elements: Set<ResolvedElement>;
  mixins: Set<ResolvedMixin>;
  namespaces: Set<ResolvedNamespace>;
  functions: Set<ResolvedFunction>;
  polymerBehaviors: Set<ResolvedPolymerBehavior>;
  /**
   * All classes that aren't an element, mixin, behavior, etc.
   */
  classes: Set<ResolvedClass>;
}

export function generateAnalysis(
    input: AnalysisResult, urlResolver: UrlResolver, filter?: Filter):
    Analysis {
  const _filter = filter || ((_: Feature) => true);

  const members: Members = {
    elements: new Set(iFilter(input.getFeatures({kind: 'element'}), _filter)),
    mixins:
        new Set(iFilter(input.getFeatures({kind: 'element-mixin'}), _filter)),
    namespaces:
        new Set(iFilter(input.getFeatures({kind: 'namespace'}), _filter)),
    functions: new Set(iFilter(input.getFeatures({kind: 'function'}), _filter)),
    polymerBehaviors:
        new Set(iFilter(input.getFeatures({kind: 'behavior'}), _filter)),
    classes: new Set()
  };

  const allClasses = iFilter(input.getFeatures({kind: 'class'}), _filter);
  for (const class_ of allClasses) {
    if (members.elements.has(class_ as any) ||
        members.mixins.has(class_ as any) ||
        members.polymerBehaviors.has(class_ as any)) {
      continue;
    }
    members.classes.add(class_);
  }

  return buildAnalysis(members, urlResolver);
}

function buildAnalysis(members: Members, urlResolver: UrlResolver): Analysis {
  // Build mapping of namespaces
  const namespaces = new Map<string|undefined, Namespace>();
  for (const namespace of members.namespaces) {
    namespaces.set(namespace.name, serializeNamespace(namespace, urlResolver));
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
    namespace.elements.push(serializeElement(element, urlResolver));
  }

  for (const mixin of members.mixins) {
    const namespaceName = getNamespaceName(mixin.name);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.mixins = namespace.mixins || [];
    namespace.mixins.push(serializeElementMixin(mixin, urlResolver));
  }

  for (const function_ of members.functions) {
    const namespaceName = getNamespaceName(function_.name);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.functions = namespace.functions || [];
    namespace.functions.push(serializeFunction(function_, urlResolver));
  }

  // TODO(usergenic): Consider moving framework-specific code to separate file.
  for (const behavior of members.polymerBehaviors) {
    const namespaceName = getNamespaceName(behavior.className);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.metadata = namespace.metadata || {};
    namespace.metadata.polymer = namespace.metadata.polymer || {};
    namespace.metadata.polymer.behaviors =
        namespace.metadata.polymer.behaviors || [];
    namespace.metadata.polymer.behaviors.push(
        serializePolymerBehaviorAsElementMixin(behavior, urlResolver));
  }


  for (const class_ of members.classes) {
    const namespaceName = getNamespaceName(class_.name);
    const namespace = namespaces.get(namespaceName) || analysis;
    namespace.classes = namespace.classes || [];
    namespace.classes.push(serializeClass(class_, urlResolver));
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
const schema = require('../analysis.schema.json');

export class ValidationError extends Error {
  errors: jsonschema.ValidationError[];
  constructor(result: jsonschema.ValidatorResult) {
    const message =
        `Unable to validate serialized Polymer analysis. ` +
        `Got ${result.errors.length} errors: ` +
        `${
            result.errors.map((err) => '    ' + (err.message || err))
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
    namespace: ResolvedNamespace, urlResolver: UrlResolver): Namespace {
  const metadata = {
    name: namespace.name,
    description: namespace.description,
    summary: namespace.summary,
    sourceRange:
        sourceRangeRelativeTo(namespace.sourceRange, undefined, urlResolver)
  };
  return metadata;
}

function serializeFunction(
    fn: ResolvedFunction, urlResolver: UrlResolver): Function {
  const metadata: Function = {
    name: fn.name,
    description: fn.description,
    summary: fn.summary,
    sourceRange: sourceRangeRelativeTo(fn.sourceRange, undefined, urlResolver),
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

function serializeClass(
    class_: ResolvedClass, urlResolver: UrlResolver): Class {
  let path: undefined|ResolvedUrl;
  let relativeUrl;
  if (class_.sourceRange) {
    path = class_.sourceRange!.file;
    relativeUrl = urlResolver.relative(class_.sourceRange.file);
  }

  const properties = [...class_.properties.values()].map(
      (p) => serializeProperty(class_, path, urlResolver, p));
  const methods = [...class_.methods.values()].map(
      (m) => serializeMethod(class_, path, urlResolver, m));
  const staticMethods = [...class_.staticMethods.values()].map(
      (m) => serializeMethod(class_, path, urlResolver, m));

  const serialized: Class = {
    description: class_.description || '',
    summary: class_.summary || '',
    path: relativeUrl,
    properties: properties,
    methods: methods,
    staticMethods: staticMethods,
    demos: (class_.demos ||
            []).map(({path, desc}) => ({url: path, description: desc || ''})),
    metadata: class_.emitMetadata(),
    sourceRange: sourceRangeRelativeTo(class_.sourceRange, path, urlResolver),
    privacy: class_.privacy,
    superclass: class_.superClass ? class_.superClass.identifier : undefined,
  };
  if (class_.name) {
    serialized.name = class_.name;
  }
  return serialized;
}

function serializeElementLike(
    elementOrMixin: ElementOrMixin, urlResolver: UrlResolver): ElementLike {
  const class_ = serializeClass(elementOrMixin, urlResolver) as ElementLike;
  let path: undefined|ResolvedUrl;
  if (elementOrMixin.sourceRange) {
    path = elementOrMixin.sourceRange.file;
  }

  class_.attributes =
      Array.from(elementOrMixin.attributes.values())
          .map((a) => serializeAttribute(elementOrMixin, path, urlResolver, a));
  class_.events = Array.from(elementOrMixin.events.values())
                      .map((e) => serializeEvent(elementOrMixin, path, e));

  Object.assign(class_, {
    styling: {
      cssVariables: [],
      selectors: [],
    },
    slots: elementOrMixin.slots.map((s) => {
      return {
        description: '',
        name: s.name,
        range: sourceRangeRelativeTo(s.range, path, urlResolver)
      };
    }),
  });

  return class_;
}

function serializeElement(
    element: ResolvedElement, urlResolver: UrlResolver): Element {
  const metadata: Element =
      serializeElementLike(element, urlResolver) as Element;
  metadata.tagname = element.tagName;

  // TODO(justinfagnani): Mixins should be able to have mixins too
  if (element.mixins.length > 0) {
    metadata.mixins = element.mixins.map((m) => m.identifier);
  }
  metadata.superclass = 'HTMLElement';
  if (element.superClass) {
    metadata.superclass = element.superClass.identifier;
  }
  return metadata;
}

function serializeElementMixin(
    mixin: ResolvedMixin, urlResolver: UrlResolver): ElementMixin {
  const metadata = serializeElementLike(mixin, urlResolver) as ElementMixin;
  metadata.name = mixin.name;
  metadata.privacy = mixin.privacy;
  if (mixin.mixins.length > 0) {
    metadata.mixins = mixin.mixins.map((m) => m.identifier);
  }
  return metadata;
}

function serializePolymerBehaviorAsElementMixin(
    behavior: ResolvedPolymerBehavior, urlResolver: UrlResolver): ElementMixin {
  const metadata = serializeElementLike(behavior, urlResolver) as ElementMixin;
  metadata.name = behavior.className!;
  metadata.privacy = behavior.privacy;
  if (behavior.mixins.length > 0) {
    metadata.mixins = behavior.mixins.map((m) => m.identifier);
  }
  return metadata;
}

function serializeProperty(
    class_: ResolvedClass,
    elementPath: ResolvedUrl|undefined,
    urlResolver: UrlResolver,
    resolvedProperty: ResolvedProperty): Property {
  const property: Property = {
    name: resolvedProperty.name,
    type: resolvedProperty.type || '?',
    description: resolvedProperty.description || '',
    privacy: resolvedProperty.privacy,
    sourceRange: sourceRangeRelativeTo(
        resolvedProperty.sourceRange, elementPath, urlResolver),
    metadata: class_.emitPropertyMetadata(resolvedProperty),
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
    elementPath: ResolvedUrl|undefined,
    urlResolver: UrlResolver,
    resolvedAttribute: ResolvedAttribute): Attribute {
  const attribute: Attribute = {
    name: resolvedAttribute.name,
    description: resolvedAttribute.description || '',
    sourceRange: sourceRangeRelativeTo(
        resolvedAttribute.sourceRange, elementPath, urlResolver),
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
    class_: ResolvedClass,
    elementPath: ResolvedUrl|undefined,
    urlResolver: UrlResolver,
    resolvedMethod: ResolvedMethod): Method {
  const method: Method = {
    name: resolvedMethod.name,
    description: resolvedMethod.description || '',
    privacy: resolvedMethod.privacy,
    sourceRange: sourceRangeRelativeTo(
        resolvedMethod.sourceRange, elementPath, urlResolver),
    metadata: class_.emitMethodMetadata(resolvedMethod),
  };
  if (resolvedMethod.params) {
    method.params = Array.from(resolvedMethod.params);
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
    _elementPath: ResolvedUrl|undefined,
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

function sourceRangeRelativeTo(
    sourceRange: ResolvedSourceRange|undefined,
    from: ResolvedUrl|undefined,
    urlResolver: UrlResolver): (SourceRange|undefined) {
  if (sourceRange === undefined) {
    return;
  }
  if (from === sourceRange.file) {
    return {start: sourceRange.start, end: sourceRange.end};
  }
  let file;
  if (from === undefined) {
    file = urlResolver.relative(sourceRange.file);
  } else {
    file = urlResolver.relative(from, sourceRange.file);
  }
  return {file, start: sourceRange.start, end: sourceRange.end};
}

// TODO(rictic): figure out why type inference goes wrong with more general
//     types here.
function*
    iFilter<V extends Feature>(iter: Iterable<V>, f: (v: Feature) => boolean) {
  for (const val of iter) {
    if (f(val)) {
      yield val;
    }
  }
}
