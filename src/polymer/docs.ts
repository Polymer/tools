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

import * as jsdoc from '../javascript/jsdoc';
import {ScannedEvent, ScannedFeature, ScannedProperty} from '../model/model';

import {ScannedBehavior} from './behavior';
import {ScannedPolymerCoreFeature} from './polymer-core-feature';
import {ScannedFunction, ScannedPolymerElement, ScannedPolymerProperty} from './polymer-element';



// TODO(rictic): destroy this file with great abadon. It's the oldest and
//     hardest to understand in the repo at this point I think.

// This is to prevent warnings that annotateProperty is unused.
// It is unused, but we want to extract the good bits from this file
// before we delete the whole thing.
if (Math.random() > 1000) {
  annotateProperty.name;
}


/** Properties on element prototypes that are purely configuration. */
const ELEMENT_CONFIGURATION = [
  'attached',
  'attributeChanged',
  'beforeRegister',
  'configure',
  'constructor',
  'created',
  'detached',
  'enableCustomStyleProperties',
  'extends',
  'hostAttributes',
  'is',
  'listeners',
  'mixins',
  'properties',
  'ready',
  'registered'
];

/** Tags understood by the annotation process, to be removed during `clean`. */
const HANDLED_TAGS = [
  'param',
  'return',
  'type',
];

/**
 * Annotates Hydrolysis scanned features, processing any descriptions as
 * JSDoc.
 *
 * You probably want to use a more specialized version of this, such as
 * `annotateElement`.
 *
 * Processed JSDoc values will be made available via the `jsdoc` property on a
 * scanned feature.
 */
export function
annotate<Scanned extends{jsdoc?: jsdoc.Annotation, description?: string}>(
    feature: Scanned): Scanned {
  if (!feature || feature.jsdoc) {
    return feature;
  }

  if (typeof feature.description === 'string') {
    feature.jsdoc = jsdoc.parseJsdoc(feature.description);
    // We want to present the normalized form of a feature.
    feature.description = feature.jsdoc.description;
  }

  return feature;
}

/**
 * Annotates @event, @hero, & @demo tags
 */
export function annotateElementHeader(scannedElement: ScannedPolymerElement) {
  scannedElement.demos = [];
  if (scannedElement.jsdoc && scannedElement.jsdoc.tags) {
    scannedElement.jsdoc.tags.forEach(function(tag) {
      switch (tag.tag) {
        case 'demo':
          scannedElement.demos.push({
            desc: tag.description || 'demo',
            path: tag.name || 'demo/index.html'
          });
          break;
      }
    });
  }
}

export function annotateBehavior(scannedBehavior: ScannedBehavior):
    ScannedBehavior {
  annotate(scannedBehavior);
  annotateElementHeader(scannedBehavior);

  return scannedBehavior;
}

/**
 * Annotates event documentation
 */
export function annotateEvent(annotation: jsdoc.Annotation): ScannedEvent {
  const eventTag = jsdoc.getTag(annotation, 'event');
  let name: string;
  if (eventTag && eventTag.description) {
    name = (eventTag.description || '').match(/^\S*/)![0];
  } else {
    name = 'N/A';
  }
  const scannedEvent: ScannedEvent = {
    name: name,
    description: (eventTag && eventTag.description) || annotation.description,
    jsdoc: annotation,
    sourceRange: undefined,
    astNode: null,
    warnings: [],
  };

  const tags = (annotation && annotation.tags || []);
  // process @params
  scannedEvent.params =
      tags.filter((tag) => tag.tag === 'param').map(function(param) {
        return {
          type: param.type || 'N/A',
          desc: param.description || '',
          name: param.name || 'N/A'
        };
      });
  // process @params
  return scannedEvent;
}

/**
 * Annotates documentation found about a scanned polymer property.
 *
 * @param feature
 * @param ignoreConfiguration If true, `configuration` is not set.
 * @return The descriptior that was given.
 */
function annotateProperty(
    feature: ScannedPolymerProperty,
    ignoreConfiguration: boolean): ScannedPolymerProperty {
  annotate(feature);
  if (feature.name[0] === '_' || jsdoc.hasTag(feature.jsdoc, 'private')) {
    feature.private = true;
  }

  if (!ignoreConfiguration &&
      ELEMENT_CONFIGURATION.indexOf(feature.name) !== -1) {
    feature.private = true;
    feature.configuration = true;
  }

  // @type JSDoc wins
  feature.type = jsdoc.getTag(feature.jsdoc, 'type', 'type') || feature.type;

  if (feature.type && feature.type.match(/^function/i)) {
    _annotateFunctionProperty(<ScannedFunction><any>feature);
  }

  // @default JSDoc wins
  const defaultTag = jsdoc.getTag(feature.jsdoc, 'default');
  if (defaultTag !== null) {
    const newDefault = (defaultTag.name || '') + (defaultTag.description || '');
    if (newDefault !== '') {
      feature.default = newDefault;
    }
  }

  return feature;
}

function _annotateFunctionProperty(scannedFunction: ScannedFunction) {
  scannedFunction.function = true;

  const returnTag = jsdoc.getTag(scannedFunction.jsdoc, 'return');
  if (returnTag) {
    scannedFunction.return = {
      type: returnTag.type,
      desc: returnTag.description || '',
    };
  }

  const paramsByName = {};
  (scannedFunction.params || []).forEach((param) => {
    paramsByName[param.name] = param;
  });
  (scannedFunction.jsdoc && scannedFunction.jsdoc.tags || []).forEach((tag) => {
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
 */
export function featureElement(features: ScannedPolymerCoreFeature[]):
    ScannedPolymerElement {
  const properties =
      features.reduce<ScannedPolymerProperty[]>((result, feature) => {
        return result.concat(feature.properties);
      }, []);

  return new ScannedPolymerElement({
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
    sourceRange: undefined
  });
}

/**
 * Cleans redundant properties from a feature, assuming that you have already
 * called `annotate`.
 */
export function clean(scannedFeature: ScannedFeature) {
  if (!scannedFeature.jsdoc) {
    return;
  }
  // The doctext was written to `scannedFeature.description`
  delete scannedFeature.jsdoc.description;

  const cleanTags: jsdoc.Tag[] = [];
  (scannedFeature.jsdoc.tags || []).forEach(function(tag) {
    // Drop any tags we've consumed.
    if (HANDLED_TAGS.indexOf(tag.tag) !== -1)
      return;
    cleanTags.push(tag);
  });

  if (cleanTags.length === 0) {
    // No tags? no docs left!
    delete scannedFeature.jsdoc;
  } else {
    scannedFeature.jsdoc.tags = cleanTags;
  }
}

/**
 * Cleans redundant properties from an element, assuming that you have already
 * called `annotateElement`.
 */
export function cleanElement(element: ScannedPolymerElement) {
  clean(element);
  element.properties.forEach(cleanProperty);
}

/**
 * Cleans redundant properties from a property, assuming that you have already
 * called `annotateProperty`.
 */
function cleanProperty(property: ScannedProperty) {
  clean(property);
}

/**
 * Parse elements defined only in comments.
 */
export function parsePseudoElements(comments: string[]):
    ScannedPolymerElement[] {
  const elements: ScannedPolymerElement[] = [];
  comments.forEach(function(comment) {
    const parsedJsdoc = jsdoc.parseJsdoc(comment);
    const pseudoTag = jsdoc.getTag(parsedJsdoc, 'pseudoElement', 'name');
    if (pseudoTag) {
      let element = new ScannedPolymerElement({
        tagName: pseudoTag,
        jsdoc: {description: parsedJsdoc.description, tags: parsedJsdoc.tags},
        properties: [],
        description: parsedJsdoc.description,
        sourceRange: undefined
      });
      annotateElementHeader(element);
      elements.push(element);
    }
  });
  return elements;
}
