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

import * as dom5 from 'dom5';
import * as parse5 from 'parse5';

import {Descriptor, EventDescriptor, Property} from '../ast/ast';
import * as jsdoc from '../javascript/jsdoc';

import {BehaviorDescriptor} from './behavior-descriptor';
import {FunctionDescriptor, PolymerElementDescriptor, PolymerProperty} from './element-descriptor';
import {FeatureDescriptor} from './feature-descriptor';


/** Properties on element prototypes that are purely configuration. */
const ELEMENT_CONFIGURATION = [
  'attached', 'attributeChanged', 'beforeRegister', 'configure', 'constructor',
  'created', 'detached', 'enableCustomStyleProperties', 'extends',
  'hostAttributes', 'is', 'listeners', 'mixins', 'properties', 'ready',
  'registered'
];

/** Tags understood by the annotation process, to be removed during `clean`. */
const HANDLED_TAGS = [
  'param',
  'return',
  'type',
];

/**
 * Annotates Hydrolysis descriptors, processing any `desc` properties as JSDoc.
 *
 * You probably want to use a more specialized version of this, such as
 * `annotateElement`.
 *
 * Processed JSDoc values will be made available via the `jsdoc` property on a
 * descriptor node.
 *
 * @param {Object} descriptor The descriptor node to process.
 * @return {Object} The descriptor that was given.
 */
export function annotate(descriptor: Descriptor): Descriptor {
  if (!descriptor || descriptor.jsdoc)
    return descriptor;

  if (typeof descriptor.description === 'string') {
    descriptor.jsdoc = jsdoc.parseJsdoc(descriptor.description);
    // We want to present the normalized form of a descriptor.
    descriptor.description = descriptor.jsdoc.description;
  }

  return descriptor;
}

/**
 * Annotates @event, @hero, & @demo tags
 */
export function annotateElementHeader(descriptor: PolymerElementDescriptor) {
  descriptor.demos = [];
  if (descriptor.jsdoc && descriptor.jsdoc.tags) {
    descriptor.jsdoc.tags.forEach(function(tag) {
      switch (tag.tag) {
        case 'demo':
          descriptor.demos.push({
            desc: tag.description || 'demo',
            path: tag.name || 'demo/index.html'
          });
          break;
      }
    });
  }
}

/**
 * Annotates behavior descriptor.
 * @param {Object} descriptor behavior descriptor
 * @return {Object} descriptor passed in as param
 */
export function annotateBehavior(descriptor: BehaviorDescriptor):
    BehaviorDescriptor {
  annotate(descriptor);
  annotateElementHeader(descriptor);

  return descriptor;
}

/**
 * Annotates event documentation
 */
export function annotateEvent(annotation: jsdoc.Annotation): EventDescriptor {
  const eventTag = jsdoc.getTag(annotation, 'event');
  const eventDescriptor: EventDescriptor = {
    name: (eventTag && eventTag.description) ?
        (eventTag.description || '').match(/^\S*/)[0] :
        'N/A',
    description: eventTag.description || annotation.description,
    jsdoc: annotation
  };

  const tags = (annotation && annotation.tags || []);
  // process @params
  eventDescriptor.params =
      tags.filter((tag) => tag.tag === 'param').map(function(param) {
        return {
          type: param.type || 'N/A',
          desc: param.description || '',
          name: param.name || 'N/A'
        };
      });
  // process @params
  return eventDescriptor;
}

/**
 * Annotates documentation found about a Hydrolysis property descriptor.
 *
 * @param {Object} descriptor The property descriptor.
 * @param {boolean} ignoreConfiguration If true, `configuration` is not set.
 * @return {Object} The descriptior that was given.
 */
function annotateProperty(
    descriptor: PolymerProperty,
    ignoreConfiguration: boolean): PolymerProperty {
  annotate(descriptor);
  if (descriptor.name[0] === '_' || jsdoc.hasTag(descriptor.jsdoc, 'private')) {
    descriptor.private = true;
  }

  if (!ignoreConfiguration &&
      ELEMENT_CONFIGURATION.indexOf(descriptor.name) !== -1) {
    descriptor.private = true;
    descriptor.configuration = true;
  }

  // @type JSDoc wins
  descriptor.type =
      jsdoc.getTag(descriptor.jsdoc, 'type', 'type') || descriptor.type;

  if (descriptor.type.match(/^function/i)) {
    _annotateFunctionProperty(<FunctionDescriptor><any>descriptor);
  }

  // @default JSDoc wins
  const defaultTag = jsdoc.getTag(descriptor.jsdoc, 'default');
  if (defaultTag !== null) {
    const newDefault = (defaultTag.name || '') + (defaultTag.description || '');
    if (newDefault !== '') {
      descriptor.default = newDefault;
    }
  }

  return descriptor;
}

function _annotateFunctionProperty(descriptor: FunctionDescriptor) {
  descriptor.function = true;

  const returnTag = jsdoc.getTag(descriptor.jsdoc, 'return');
  if (returnTag) {
    descriptor.return = {
      type: returnTag.type,
      desc: returnTag.description || '',
    };
  }

  const paramsByName = {};
  (descriptor.params || []).forEach((param) => {
    paramsByName[param.name] = param;
  });
  (descriptor.jsdoc && descriptor.jsdoc.tags || []).forEach((tag) => {
    if (tag.tag !== 'param' || tag.name == null)
      return;
    const param = paramsByName[tag.name];
    if (!param) {
      return;
    }

    param.type = tag.type || param.type;
    param.desc = tag.description;
  });
}

/**
 * Converts raw features into an abstract `Polymer.Base` element.
 *
 * Note that docs on this element _are not processed_. You must call
 * `annotateElement` on it yourself if you wish that.
 *
 * @param {Array<FeatureDescriptor>} features
 * @return {ElementDescriptor}
 */
export function featureElement(features: FeatureDescriptor[]):
    PolymerElementDescriptor {
  const properties = features.reduce<PolymerProperty[]>((result, feature) => {
    return result.concat(feature.properties);
  }, []);

  return new PolymerElementDescriptor({
    className: 'Polymer.Base',
    abstract: true,
    properties: properties,
    description: '`Polymer.Base` acts as a base prototype for all Polymer ' +
        'elements. It is composed via various calls to ' +
        '`Polymer.Base._addFeature()`.\n' +
        '\n' +
        'The properties reflected here are the combined view of all ' +
        'features found in this library. There may be more properties ' +
        'added via other libraries, as well.',
  });
}

/**
 * Cleans redundant properties from a descriptor, assuming that you have already
 * called `annotate`.
 *
 * @param {Object} descriptor
 */
export function clean(descriptor: Descriptor) {
  if (!descriptor.jsdoc)
    return;
  // The doctext was written to `descriptor.desc`
  delete descriptor.jsdoc.description;

  const cleanTags: jsdoc.Tag[] = [];
  (descriptor.jsdoc.tags || []).forEach(function(tag) {
    // Drop any tags we've consumed.
    if (HANDLED_TAGS.indexOf(tag.tag) !== -1)
      return;
    cleanTags.push(tag);
  });

  if (cleanTags.length === 0) {
    // No tags? no docs left!
    delete descriptor.jsdoc;
  } else {
    descriptor.jsdoc.tags = cleanTags;
  }
}

/**
 * Cleans redundant properties from an element, assuming that you have already
 * called `annotateElement`.
 *
 * @param {ElementDescriptor|BehaviorDescriptor} element
 */
export function cleanElement(element: PolymerElementDescriptor) {
  clean(element);
  element.properties.forEach(cleanProperty);
}

/**
 * Cleans redundant properties from a property, assuming that you have already
 * called `annotateProperty`.
 *
 * @param {PropertyDescriptor} property
 */
function cleanProperty(property: Property) {
  clean(property);
}

/**
 * Parse elements defined only in comments.
 * @param  {comments} Array<string> A list of comments to parse.
 * @return {ElementDescriptor}      A list of pseudo-elements.
 */
export function parsePseudoElements(comments: string[]):
    PolymerElementDescriptor[] {
  const elements: PolymerElementDescriptor[] = [];
  comments.forEach(function(comment) {
    const parsedJsdoc = jsdoc.parseJsdoc(comment);
    const pseudoTag = jsdoc.getTag(parsedJsdoc, 'pseudoElement', 'name');
    if (pseudoTag) {
      let element = new PolymerElementDescriptor({
        tagName: pseudoTag,
        jsdoc: {description: parsedJsdoc.description, tags: parsedJsdoc.tags},
        properties: [],
        description: parsedJsdoc.description
      });
      annotateElementHeader(element);
      elements.push(element);
    }
  });
  return elements;
}
