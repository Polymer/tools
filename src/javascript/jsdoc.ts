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

import * as doctrine from 'doctrine';
import {Privacy} from '../model/model';

/**
 * An annotated JSDoc block tag, all fields are optionally processed except for
 * the tag:
 *
 *     @TAG {TYPE} NAME DESC
 */
export interface Tag {
  tag: string;
  type: string|null;
  name: string|null;
  description: string|null;
}

/**
 * The parsed representation of a JSDoc comment.
 */
export interface Annotation {
  // If no description is found, the property will be an empty string.
  description: string;
  tags: Tag[]|null;
}

/**
 * doctrine configuration,
 * CURRENTLY UNUSED BECAUSE PRIVATE
 */
// function configureDoctrine() {

//   // @hero [path/to/image]
//   doctrine.Rules['hero'] = ['parseNamePathOptional', 'ensureEnd'];

//   // // @demo [path/to/demo] [Demo title]
//   doctrine.Rules['demo'] = ['parseNamePathOptional', 'parseDescription',
//   'ensureEnd'];

//   // // @polymerBehavior [Polymer.BehaviorName]
//   doctrine.Rules['polymerBehavior'] = ['parseNamePathOptional', 'ensureEnd'];
// }
// configureDoctrine();

// @demo [path] [title]
function parseDemo(tag: doctrine.Tag): Tag {
  const match = (tag.description || '').match(/^\s*(\S*)\s*(.*)$/);
  return {
    tag: 'demo',
    type: null,
    name: match ? match[1] : null,
    description: match ? match[2] : null
  };
}

// @hero [path]
function parseHero(tag: doctrine.Tag): Tag {
  return {tag: tag.title, type: null, name: tag.description, description: null};
}

// @polymerElement
function parsePolymerElement(tag: doctrine.Tag): Tag {
  return {tag: tag.title, type: null, name: tag.description, description: null};
}

// @polymerMixin [name]
function parsePolymerMixin(tag: doctrine.Tag): Tag {
  return {tag: tag.title, type: null, name: tag.description, description: null};
}

// @polymerMixinClass [name]
function parsePolymerMixinClass(tag: doctrine.Tag): Tag {
  return {tag: tag.title, type: null, name: tag.description, description: null};
}

// @polymerBehavior [name]
function parsePolymerBehavior(tag: doctrine.Tag): Tag {
  return {tag: tag.title, type: null, name: tag.description, description: null};
}

// @pseudoElement name
function parsePseudoElement(tag: doctrine.Tag): Tag {
  return {tag: tag.title, type: null, name: tag.description, description: null};
}

const CUSTOM_TAGS: {[name: string]: (tag: doctrine.Tag) => Tag} = {
  demo: parseDemo,
  hero: parseHero,
  polymerBehavior: parsePolymerBehavior,
  polymerElement: parsePolymerElement,
  polymerMixin: parsePolymerMixin,
  polymerMixinClass: parsePolymerMixinClass,
  pseudoElement: parsePseudoElement,
};

/**
 * Convert doctrine tags to our tag format
 */
function _tagsToHydroTags(tags: doctrine.Tag[]|null): Tag[]|null {
  if (!tags)
    return null;
  return tags.map(function(tag): Tag {
    if (tag.title in CUSTOM_TAGS) {
      return CUSTOM_TAGS[tag.title](tag);
    } else {
      return {
        tag: tag.title,
        type: tag.type ? doctrine.type.stringify(tag.type) : null,
        name: tag.name == null ? null : tag.name,
        description: tag.description
      };
    }
  });
}

/**
 * removes leading *, and any space before it
 */
export function removeLeadingAsterisks(description: string): string {
  if ((typeof description) !== 'string')
    return description;

  return description.split('\n')
      .map(function(line) {
        // remove leading '\s*' from each line
        const match = line.match(/^[\s]*\*\s?(.*)$/);
        return match ? match[1] : line;
      })
      .join('\n');
}

/**
 * Given a JSDoc string (minus opening/closing comment delimiters), extract its
 * description and tags.
 */
export function parseJsdoc(docs: string): Annotation {
  docs = removeLeadingAsterisks(docs);
  const d = doctrine.parse(
      docs, {unwrap: false, lineNumbers: true, preserveWhitespace: true});
  // Strip any leading and trailing newline characters in the
  // description of multiline comments for readibility.
  const description = d.description && d.description.replace(/^\n+|\n+$/g, '');
  return {description: description, tags: _tagsToHydroTags(d.tags)};
}

// Utility

export function hasTag(
    jsdoc: Annotation|null|undefined, tagName: string): boolean {
  if (!jsdoc || !jsdoc.tags)
    return false;
  return jsdoc.tags.some(function(tag) {
    return tag.tag === tagName;
  });
}

/**
 * Finds the first JSDoc tag matching `name` and returns its value at `key`.
 *
 * If `key` is omitted, the entire tag object is returned.
 */
export function getTag(
    jsdoc: Annotation|null|undefined, tagName: string): (Tag|null);
export function getTag(
    jsdoc: Annotation|null|undefined, tagName: string, key: string): (string|
                                                                      null);
export function getTag(
    jsdoc: Annotation|null|undefined, tagName: string, key?: string): any {
  if (!jsdoc || !jsdoc.tags)
    return null;
  for (let i = 0; i < jsdoc.tags.length; i++) {
    const tag = jsdoc.tags[i];
    if (tag.tag === tagName) {
      return key ? tag[key] : tag;
    }
  }
  return null;
}

export function unindent(text: string): string {
  if (!text)
    return text;
  const lines = text.replace(/\t/g, '  ').split('\n');
  const indent = lines.reduce<number>(function(prev, line) {
    if (/^\s*$/.test(line))
      return prev;  // Completely ignore blank lines.

    const lineIndent = line.match(/^(\s*)/)![0].length;
    if (prev === null)
      return lineIndent;
    return lineIndent < prev ? lineIndent : prev;
  }, 0);

  return lines
      .map(function(l) {
        return l.substr(indent);
      })
      .join('\n');
}

export function isAnnotationEmpty(docs?: Annotation) {
  if (!docs) {
    return false;
  }
  const hasNoTags = !docs.tags || docs.tags.length === 0;
  return docs.description.trim() === '' && hasNoTags;
}

function isPrivacy(maybePrivacy: string): maybePrivacy is Privacy {
  switch (maybePrivacy) {
    case 'public':
    case 'private':
    case 'protected':
      return true;
  }
  return false;
}

export function getPrivacy(jsdoc: Annotation|null|undefined): Privacy|null {
  if (!jsdoc || !jsdoc.tags) {
    return null;
  }
  for (const tag of jsdoc.tags) {
    if (isPrivacy(tag.tag)) {
      return tag.tag;
    }
  }
  return null;
}
