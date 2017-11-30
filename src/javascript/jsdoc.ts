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

import * as babel from 'babel-types';
import * as doctrine from 'doctrine';
import {Annotation, Tag} from 'doctrine';

import {Privacy} from '../model/model';
import {ScannedReference, Severity, Warning} from '../model/model';

import {JavaScriptDocument} from './javascript-document';

export {Annotation, Tag} from 'doctrine';


/**
 * Given a JSDoc string (minus opening/closing comment delimiters), extract its
 * description and tags.
 */
export function parseJsdoc(docs: string): doctrine.Annotation {
  docs = removeLeadingAsterisks(docs);
  const d = doctrine.parse(docs, {
    unwrap: false,
    // lineNumbers: true,
    preserveWhitespace: true,
  });
  // Strip any leading and trailing newline characters in the
  // description of multiline comments for readibility.
  // TODO(rictic): figure out if we can trim() here or not. Something something
  //     markdown?
  const description = d.description && d.description.replace(/^\n+|\n+$/g, '');
  return {description, tags: parseCustomTags(d.tags)};
}

// Tags with a name: @title name description
const tagsWithNames = new Set([
  'appliesMixin',
  'demo',
  'hero',
  'mixinFunction',
  'polymerBehavior',
  'pseudoElement'
]);
const firstWordAndRest = /^\s*(\S*)\s*(.*)$/;

function parseCustomTags(tags: Tag[]): Tag[] {
  return tags.map((tag): Tag => {
    if (tag.description != null && tagsWithNames.has(tag.title)) {
      const match = firstWordAndRest.exec(tag.description);
      if (match != null) {
        const name = match[1];
        const description = match[2];
        return {
          ...tag,
          name,
          description,
        };
      }
    }
    return tag;
  });
}

/**
 * removes leading *, and any space before it
 */
export function removeLeadingAsterisks(description: string): string {
  return description.split('\n')
      .map(function(line) {
        // remove leading '\s*' from each line
        const match = line.match(/^[\s]*\*\s?(.*)$/);
        return match ? match[1] : line;
      })
      .join('\n');
}

export function hasTag(jsdoc: Annotation|undefined, title: string): boolean {
  return getTag(jsdoc, title) !== undefined;
}

/**
 * Finds the first JSDoc tag matching `title`.
 */
export function getTag(jsdoc: Annotation|undefined, title: string): Tag|
    undefined {
  return jsdoc && jsdoc.tags && jsdoc.tags.find((t) => t.title === title);
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

export function isAnnotationEmpty(docs: Annotation|undefined) {
  return docs === undefined ||
      docs.tags.length === 0 && docs.description.trim() === '';
}

const privacyTags: Set<string> = new Set(['public', 'private', 'protected']);

export function getPrivacy(jsdoc: Annotation|undefined): Privacy|undefined {
  return jsdoc && jsdoc.tags &&
      jsdoc.tags.filter((t) => privacyTags.has(t.title))
          .map((t) => t.title as Privacy)[0];
}

/**
 * Returns the mixin applications, in the form of ScannedReferences, for the
 * jsdocs of class.
 *
 * The references are returned in presumed order of application - from furthest
 * up the prototype chain to closest to the subclass.
 */
export function getMixinApplications(
    document: JavaScriptDocument,
    node: babel.Node,
    docs: Annotation,
    warnings: Warning[]): ScannedReference[] {
  // TODO(justinfagnani): remove @mixes support
  const appliesMixinAnnotations = docs.tags!.filter(
      (tag) => tag.title === 'appliesMixin' || tag.title === 'mixes');
  return appliesMixinAnnotations
             .map((annotation) => {
               const mixinId = annotation.name;
               // TODO(justinfagnani): we need source ranges for jsdoc
               // annotations
               const sourceRange = document.sourceRangeForNode(node)!;
               if (mixinId === undefined) {
                 warnings.push(new Warning({
                   code: 'class-mixes-annotation-no-id',
                   message:
                       '@appliesMixin annotation with no identifier. Usage `@appliesMixin MixinName`',
                   severity: Severity.WARNING,
                   sourceRange,
                   parsedDocument: document
                 }));
                 return;
               }
               return new ScannedReference(mixinId, sourceRange);
             })
             .filter((m) => m !== undefined) as ScannedReference[];
}

export function extractDemos(jsdoc: Annotation|undefined):
    Array<{desc: string | undefined, path: string}> {
  if (!jsdoc || !jsdoc.tags) {
    return [];
  }
  const demos: Array<{desc: string | undefined, path: string}> = [];
  const demoUrls = new Set<string>();
  for (const tag of jsdoc.tags.filter(
           (tag) => tag.title === 'demo' && tag.name)) {
    const demoUrl = tag.name!;
    if (demoUrls.has(demoUrl)) {
      continue;
    }
    demoUrls.add(demoUrl);
    demos.push({
      desc: tag.description || undefined,
      path: demoUrl,
    });
  }
  return demos;
}

export function join(...jsdocs: Array<Annotation|undefined>): Annotation {
  return {
    description: jsdocs.map((jsdoc) => jsdoc && jsdoc.description || '')
                     .join('\n\n')
                     .trim(),
    tags: jsdocs.map((jsdoc) => jsdoc && jsdoc.tags || [])
              .reduce((acc, tags) => acc.concat(tags)),
  };
}

/**
 * Assume that if the same symbol is documented in multiple places, the longer
 * description is probably the intended one.
 *
 * TODO(rictic): unify logic with join(...)'s above.
 */
export function pickBestDescription(...descriptions: Array<string|undefined>):
    string {
  let description = '';
  for (const desc of descriptions) {
    if (desc && desc.length > description.length) {
      description = desc;
    }
  }
  return description;
}
