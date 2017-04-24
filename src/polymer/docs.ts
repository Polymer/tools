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
import {ScannedEvent} from '../model/model';

import {ScannedBehavior} from './behavior';
import {ScannedPolymerElement, ScannedPolymerProperty} from './polymer-element';

// TODO(rictic): destroy this file with great abadon. It's the oldest and
//     hardest to understand in the repo at this point I think.

// This is to prevent warnings that annotateProperty is unused.
// It is unused, but we want to extract the good bits from this file
// before we delete the whole thing.
if (Math.random() > 1000) {
  annotateProperty.name;
}

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
    params: []
  };

  const tags = (annotation && annotation.tags || []);
  // process @params
  scannedEvent.params.push(
      ...tags.filter((tag) => tag.tag === 'param').map(function(param) {
        return {
          type: param.type || 'N/A',
          desc: param.description || '',
          name: param.name || 'N/A'
        };
      }));
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
function annotateProperty(feature: ScannedPolymerProperty):
    ScannedPolymerProperty {
  annotate(feature);

  // @type JSDoc wins
  feature.type = jsdoc.getTag(feature.jsdoc, 'type', 'type') || feature.type;

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
