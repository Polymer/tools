/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// jshint node: true
'use strict';

var doctrine = require('doctrine');

/**
 * An annotated JSDoc block tag, all fields are optionally processed except for
 * the tag:
 *
 *     @TAG {TYPE} NAME DESC
 *
 * `line` and `col` indicate the position of the first character of text that
 * the tag was extracted from - relative to the first character of the comment
 * contents (e.g. the value of `desc` on a descriptor node). Lines are
 * 1-indexed.
 *
 * @typedef {{
 *   tag:   string,
 *   type: ?string,
 *   name: ?string,
 *   body: ?string,
 * }}
 */
var JsdocTag;

/**
 * The parsed representation of a JSDoc comment.
 *
 * @typedef {{
 *   body: ?string,
 *   tags: Array<JsdocTag>,
 * }}
 */
var JsdocAnnotation;

var IS_TAG_LINE  = /^[ \t]*@/;
var DOC_SPLITTER = /(?=[ \t]*\*?[ \t]?@)/;

/**
 * doctrine configuration,
 * CURRENTLY UNUSED BECAUSE PRIVATE
 */
function configureDoctrine() {

  // @hero [path/to/image]
  doctrine.Rules['hero'] = ['parseNamePathOptional', 'ensureEnd'];

  // // @demo [path/to/demo] [Demo title]
  doctrine.Rules['demo'] = ['parseNamePathOptional', 'parseDescription', 'ensureEnd'];

  // // @polymerBehavior [Polymer.BehaviorName]
  doctrine.Rules['polymerBehavior'] = ['parseNamePathOptional', 'ensureEnd'];
}
// configureDoctrine();

/**
 * Convert doctrine tags to hydrolysis tag format
 */
function _tagsToHydroTags(tags) {
  if (!tags)
    return null;
  return tags.map( function(tag) {
    return {
      tag:  tag.title,
      type: tag.type ? doctrine.type.stringify(tag.type) : null,
      name: tag.name,
      body: tag.description,
    };
  });
}

/**
 * removes leading *, and any space before it
 * @param {string} description -- js doc description
 */
function _removeLeadingAsterisks(description) {
  if ((typeof description) !== 'string')
    return description;

  return description
    .split('\n')
    .map( function(line) {
      // remove leading '\s*' from each line
      var match = line.match(/^[\s]*\*(.*)$/);
      return match ? match[1] : line;
    })
    .join('\n');
}

/**
 * Given a JSDoc string (minus opening/closing comment delimiters), extract its
 * body and tags.
 *
 * @param {string} docs
 * @return {?JsdocAnnotation}
 */
function parseJsdoc(docs) {
  docs = _removeLeadingAsterisks(docs);
  var d = doctrine.parse(docs, {
    unwrap: false,
    lineNumber: true
  });
  return {
    body: d.description,
    tags: _tagsToHydroTags(d.tags)
  }
}

// Utility

/**
 * @param {JsdocAnnotation} jsdoc
 * @param {string} tagName
 * @return {boolean}
 */
function hasTag(jsdoc, tagName) {
  if (!jsdoc || !jsdoc.tags) return false;
  return jsdoc.tags.some(function(tag) { return tag.tag === tagName; });
}

/**
 * Finds the first JSDoc tag matching `name` and returns its value at `key`.
 *
 * @param {JsdocAnnotation} jsdoc
 * @param {string} tagName
 * @param {string=} key If omitted, the entire tag object is returned.
 * @return {?string|Object}
 */
function getTag(jsdoc, tagName, key) {
  if (!jsdoc || !jsdoc.tags) return false;
  for (var i = 0; i < jsdoc.tags.length; i++) {
    var tag = jsdoc.tags[i];
    if (tag.tag === tagName) {
      return key ? tag[key] : tag;
    }
  }
  return null;
}

/**
 * @param {?string} text
 * @return {?string}
 */
function unindent(text) {
  if (!text) return text;
  var lines  = text.replace(/\t/g, '  ').split('\n');
  var indent = lines.reduce(function(prev, line) {
    if (/^\s*$/.test(line)) return prev;  // Completely ignore blank lines.

    var lineIndent = line.match(/^(\s*)/)[0].length;
    if (prev === null) return lineIndent;
    return lineIndent < prev ? lineIndent : prev;
  }, null);

  return lines.map(function(l) { return l.substr(indent); }).join('\n');
}

module.exports = {
  getTag:     getTag,
  hasTag:     hasTag,
  parseJsdoc: parseJsdoc,
  unindent:   unindent
};
